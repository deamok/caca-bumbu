import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudEnabled as cloudConfigured, getSupabase } from '../lib/supabase';

const OFFLINE_KEY = 'caca-bumbu:auth:offline';

export type AuthStatus = 'disabled' | 'loading' | 'signed-in' | 'signed-out';

interface AuthValue {
  cloudEnabled: boolean;
  status: AuthStatus;
  session: Session | null;
  email: string | null;
  offline: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<'signed-in' | 'confirm-email'>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  continueOffline: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function readOffline(): boolean {
  try {
    return localStorage.getItem(OFFLINE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOffline(value: boolean): void {
  try {
    if (value) localStorage.setItem(OFFLINE_KEY, '1');
    else localStorage.removeItem(OFFLINE_KEY);
  } catch {
    // abaikan: mode luring tetap dipakai lewat state di memori
  }
}

/** Terjemahkan pesan Supabase Auth yang umum ke bahasa yang ramah. */
export function translateAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'Email atau password salah.';
  if (text.includes('email not confirmed')) return 'Email belum dikonfirmasi. Buka tautan di kotak masuk lalu coba lagi.';
  if (text.includes('user already registered')) return 'Email ini sudah terdaftar. Coba masuk.';
  if (text.includes('password should be at least')) return 'Password minimal 6 karakter.';
  if (text.includes('rate limit') || text.includes('too many requests')) {
    return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  }
  if (text.includes('unable to validate email') || text.includes('invalid email')) return 'Format email tidak valid.';
  if (text.includes('signup is disabled')) return 'Pendaftaran akun sedang dinonaktifkan di Supabase.';
  if (text.includes('failed to fetch') || text.includes('networkerror')) {
    return 'Tidak ada koneksi ke server. Periksa sinyal lalu coba lagi.';
  }
  return message;
}

function asError(err: unknown, fallback: string): Error {
  return err instanceof Error ? err : new Error(fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(cloudConfigured ? 'loading' : 'disabled');
  const [offline, setOffline] = useState<boolean>(() => (cloudConfigured ? readOffline() : true));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloudConfigured) {
      setStatus('disabled');
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      try {
        const client = await getSupabase();
        if (!active) return;

        const { data } = await client.auth.getSession();
        if (!active) return;
        setSession(data.session ?? null);
        if (data.session) {
          writeOffline(false);
          setOffline(false);
        }
        setStatus(data.session ? 'signed-in' : 'signed-out');

        const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
          setSession(nextSession);
          if (nextSession) {
            writeOffline(false);
            setOffline(false);
            setStatus('signed-in');
          } else {
            setStatus('signed-out');
          }
        });
        unsubscribe = () => listener.subscription.unsubscribe();
      } catch {
        if (active) setStatus('signed-out');
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const fail = useCallback((err: unknown, fallback: string) => {
    const message = translateAuthError(asError(err, fallback).message);
    setError(message);
    throw new Error(message);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const client = await getSupabase();
      setError(null);
      const { error: authError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
    } catch (err) {
      fail(err, 'Tidak bisa masuk.');
    }
  }, [fail]);

  const signUp = useCallback(async (email: string, password: string): Promise<'signed-in' | 'confirm-email'> => {
    try {
      const client = await getSupabase();
      setError(null);
      const { data, error: authError } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (authError) throw authError;
      return data.session ? 'signed-in' : 'confirm-email';
    } catch (err) {
      return fail(err, 'Tidak bisa membuat akun.');
    }
  }, [fail]);

  const signOut = useCallback(async () => {
    try {
      const client = await getSupabase();
      setError(null);
      const { error: authError } = await client.auth.signOut();
      if (authError) throw authError;
    } catch (err) {
      fail(err, 'Tidak bisa keluar.');
    }
  }, [fail]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const client = await getSupabase();
      setError(null);
      const { error: authError } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (authError) throw authError;
    } catch (err) {
      fail(err, 'Tidak bisa mengirim email atur ulang password.');
    }
  }, [fail]);

  const updatePassword = useCallback(async (password: string) => {
    try {
      const client = await getSupabase();
      setError(null);
      const { error: authError } = await client.auth.updateUser({ password });
      if (authError) throw authError;
    } catch (err) {
      fail(err, 'Tidak bisa memperbarui password.');
    }
  }, [fail]);

  const continueOffline = useCallback(() => {
    writeOffline(true);
    setOffline(true);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthValue>(
    () => ({
      cloudEnabled: cloudConfigured,
      status,
      session,
      email: session?.user.email ?? null,
      offline,
      error,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      continueOffline,
      clearError,
    }),
    [status, session, offline, error, signIn, signUp, signOut, resetPassword, updatePassword, continueOffline, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}
