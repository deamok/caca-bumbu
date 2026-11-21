import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudEnabled as cloudConfigured, getSupabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useStore } from './StoreContext';
import { createInitialState } from '../data/seed';
import {
  diffStateRows,
  emptyStateRows,
  isEmptyChangeSet,
  isEmptyRows,
  isEmptyState,
  mergeStates,
  rowsToState,
  stateToRows,
  type StateRows,
} from '../lib/cloudSchema';
import { deleteAllRows, fetchRemoteRows, pushChanges } from '../lib/cloudSync';
import type { AppState } from '../types';

export type SyncStatus = 'disabled' | 'signed-out' | 'offline' | 'syncing' | 'pending' | 'synced' | 'error';

const MARKER_KEY = 'caca-bumbu:sync:v1';
const PUSH_DELAY = 900;
const RETRY_DELAY = 12_000;
const POLL_INTERVAL = 60_000;
const REFRESH_THROTTLE = 20_000;

type SyncMode = 'auto' | 'pull';

interface SyncMarker {
  userId: string;
  base: StateRows | null;
  syncedAt: string | null;
  dirty: boolean;
}

interface SyncValue {
  cloudEnabled: boolean;
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
  syncNow: () => Promise<void>;
  pushLocal: () => Promise<void>;
  pullRemote: () => Promise<void>;
  wipeCloud: () => Promise<void>;
}

const SyncContext = createContext<SyncValue | null>(null);

function readMarker(): SyncMarker | null {
  try {
    const raw = localStorage.getItem(MARKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncMarker>;
    if (!parsed || typeof parsed.userId !== 'string') return null;
    return {
      userId: parsed.userId,
      base: parsed.base && typeof parsed.base === 'object' ? (parsed.base as StateRows) : null,
      syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : null,
      dirty: parsed.dirty === true,
    };
  } catch {
    return null;
  }
}

function writeMarker(marker: SyncMarker): boolean {
  try {
    localStorage.setItem(MARKER_KEY, JSON.stringify(marker));
    return true;
  } catch {
    // Kuota localStorage habis: sinkronisasi tetap jalan di memori.
    return false;
  }
}

function clearMarker(): void {
  try {
    localStorage.removeItem(MARKER_KEY);
  } catch {
    // abaikan
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Gagal menyinkronkan data ke cloud.';
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { state, replaceState, resetAll } = useStore();
  const { session, cloudEnabled, offline } = useAuth();

  const [status, setStatus] = useState<SyncStatus>(cloudEnabled ? 'signed-out' : 'disabled');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef(state);
  const baseRef = useRef<StateRows | null>(null);
  const dirtyRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const applyingRef = useRef(false);
  const initializingRef = useRef(false);
  const mountedRef = useRef(true);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPullRef = useRef(0);
  const lastSyncedRef = useRef<string | null>(null);
  const runSyncRef = useRef<(mode?: SyncMode) => Promise<void>>(async () => {});

  const applyState = useCallback(
    (next: AppState) => {
      applyingRef.current = true;
      stateRef.current = next;
      replaceState(next);
    },
    [replaceState],
  );

  const persist = useCallback((uid: string, base: StateRows | null, dirty: boolean, syncedAt: string | null) => {
    writeMarker({ userId: uid, base, syncedAt, dirty });
  }, []);

  const handleFailure = useCallback((err: unknown) => {
    const message = messageOf(err);
    if (mountedRef.current) {
      setError(message);
      setStatus(isOnline() ? 'error' : 'offline');
    }
    if (dirtyRef.current && isOnline()) {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        void runSyncRef.current('auto');
      }, RETRY_DELAY);
    }
  }, []);

  const pullNow = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (mountedRef.current) setStatus('syncing');
    try {
      const client = await getSupabase();
      const remoteRows = await fetchRemoteRows(client, uid);
      if (!mountedRef.current) return;
      lastPullRef.current = Date.now();
      baseRef.current = remoteRows;

      if (dirtyRef.current) {
        // Ada perubahan lokal yang belum terkirim: jangan timpa, kirim dulu.
        persist(uid, remoteRows, true, lastSyncedRef.current);
        void runSyncRef.current('auto');
        return;
      }

      applyState(rowsToState(remoteRows));
      const syncedAt = new Date().toISOString();
      lastSyncedRef.current = syncedAt;
      persist(uid, remoteRows, false, syncedAt);
      setLastSyncedAt(syncedAt);
      setError(null);
      setStatus('synced');
    } catch (err) {
      handleFailure(err);
    }
  }, [applyState, handleFailure, persist]);

  const pushNow = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const snapshot = stateRef.current;
    const nextRows = stateToRows(snapshot, uid);
    const changes = diffStateRows(baseRef.current, nextRows);

    if (isEmptyChangeSet(changes)) {
      dirtyRef.current = false;
      persist(uid, nextRows, false, lastSyncedRef.current);
      if (mountedRef.current) setStatus(isOnline() ? 'synced' : 'offline');
      return;
    }

    if (mountedRef.current) setStatus('syncing');
    try {
      const client = await getSupabase();
      await pushChanges(client, uid, changes);
      if (!mountedRef.current) return;
      const syncedAt = new Date().toISOString();
      baseRef.current = nextRows;
      dirtyRef.current = false;
      lastSyncedRef.current = syncedAt;
      persist(uid, nextRows, false, syncedAt);
      setLastSyncedAt(syncedAt);
      setError(null);
      setStatus('synced');

      // Ambil perubahan dari perangkat lain, asal pengguna tidak mengedit lagi.
      if (stateRef.current === snapshot) await pullNow();
    } catch (err) {
      handleFailure(err);
    }
  }, [handleFailure, persist, pullNow]);

  const runSync = useCallback(
    async (mode: SyncMode = 'auto') => {
      if (!userIdRef.current || !cloudConfigured) return;
      if (mode === 'pull') {
        if (dirtyRef.current) await pushNow();
        await pullNow();
        return;
      }
      if (dirtyRef.current) await pushNow();
      else await pullNow();
    },
    [pullNow, pushNow],
  );
  runSyncRef.current = runSync;

  const schedulePush = useCallback(() => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      void runSyncRef.current('auto');
    }, PUSH_DELAY);
  }, []);

  const initialize = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid || initializingRef.current) return;

    initializingRef.current = true;
    readyRef.current = false;
    if (mountedRef.current) setStatus('syncing');

    try {
      const client = await getSupabase();
      const marker = readMarker();
      const sameUser = marker?.userId === uid;
      const foreignUser = Boolean(marker && marker.userId !== uid);

      if (sameUser && marker?.syncedAt && !lastSyncedRef.current) {
        lastSyncedRef.current = marker.syncedAt;
        if (mountedRef.current) setLastSyncedAt(marker.syncedAt);
      }

      if (foreignUser) {
        // Perangkat ini sebelumnya dipakai akun lain: mulai dari data akun baru.
        clearMarker();
        resetAll();
      }

      const remoteRows = await fetchRemoteRows(client, uid);
      if (!mountedRef.current) return;
      const remoteState = rowsToState(remoteRows);
      const local = foreignUser ? createInitialState() : stateRef.current;

      let base: StateRows | null = remoteRows;
      let dirty = false;
      let adoptRemote = false;

      if (sameUser && !foreignUser) {
        base = marker?.base ?? null;
        dirty = Boolean(marker?.dirty);
        if (!dirty) adoptRemote = true;
      } else if (isEmptyRows(remoteRows)) {
        dirty = !isEmptyState(local);
      } else if (isEmptyState(local)) {
        adoptRemote = true;
      } else {
        const merged = mergeStates(local, remoteState);
        dirty = true;
        applyState(merged);
      }

      baseRef.current = base;
      dirtyRef.current = dirty;
      readyRef.current = true;

      if (adoptRemote) {
        applyState(remoteState);
        dirtyRef.current = false;
        baseRef.current = remoteRows;
        const syncedAt = new Date().toISOString();
        lastSyncedRef.current = syncedAt;
        persist(uid, remoteRows, false, syncedAt);
        setLastSyncedAt(syncedAt);
        setError(null);
        setStatus('synced');
      } else if (dirty) {
        persist(uid, base, true, lastSyncedRef.current);
        setStatus('pending');
        await runSyncRef.current('auto');
      } else {
        const syncedAt = new Date().toISOString();
        lastSyncedRef.current = syncedAt;
        persist(uid, remoteRows, false, syncedAt);
        setLastSyncedAt(syncedAt);
        setError(null);
        setStatus('synced');
      }
    } catch (err) {
      handleFailure(err);
      readyRef.current = true;
    } finally {
      initializingRef.current = false;
    }
  }, [applyState, handleFailure, persist, resetAll]);

  // Reaksi terhadap perubahan state lokal (dari UI) — bukan hasil tarikan cloud.
  useEffect(() => {
    stateRef.current = state;
    if (applyingRef.current) {
      applyingRef.current = false;
      return;
    }
    if (!readyRef.current || !userIdRef.current) return;
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      persist(userIdRef.current, baseRef.current, true, lastSyncedRef.current);
      if (mountedRef.current) setStatus(isOnline() ? 'pending' : 'offline');
    }
    schedulePush();
  }, [state, persist, schedulePush]);

  // Mulai/berhenti sinkronisasi mengikuti sesi login.
  useEffect(() => {
    if (!cloudEnabled) {
      userIdRef.current = null;
      readyRef.current = false;
      setStatus('disabled');
      return;
    }

    const uid = session?.user.id ?? null;
    if (!uid) {
      userIdRef.current = null;
      readyRef.current = false;
      dirtyRef.current = false;
      baseRef.current = null;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      setStatus(offline ? 'disabled' : 'signed-out');
      return;
    }

    if (userIdRef.current === uid && readyRef.current) return;
    userIdRef.current = uid;
    void initialize();
  }, [session?.user.id, cloudEnabled, offline, initialize]);

  // Sinkronisasi saat kembali online / fokus / berkala.
  useEffect(() => {
    if (!cloudEnabled || !session) return;

    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastPullRef.current < REFRESH_THROTTLE) return;
      void runSyncRef.current(dirtyRef.current ? 'auto' : 'pull');
    };
    const onOnline = () => {
      void runSyncRef.current('auto');
    };
    const onOffline = () => {
      setStatus('offline');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = setInterval(refresh, POLL_INTERVAL);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(interval);
    };
  }, [cloudEnabled, session?.user.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  const syncNow = useCallback(async () => {
    await runSyncRef.current('auto');
  }, []);

  const pushLocal = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      if (mountedRef.current) setStatus('syncing');
      const client = await getSupabase();
      const remoteRows = await fetchRemoteRows(client, uid);
      baseRef.current = remoteRows;
      dirtyRef.current = true;
      await runSyncRef.current('auto');
    } catch (err) {
      handleFailure(err);
    }
  }, [handleFailure]);

  const pullRemote = useCallback(async () => {
    dirtyRef.current = false;
    await runSyncRef.current('pull');
  }, []);

  const wipeCloud = useCallback(async () => {
    const uid = userIdRef.current;
    let client: SupabaseClient | null = null;
    if (cloudConfigured && uid) {
      try {
        client = await getSupabase();
      } catch {
        client = null;
      }
    }
    readyRef.current = false;
    if (client && uid) {
      try {
        await deleteAllRows(client, uid);
      } catch (err) {
        handleFailure(err);
      }
    }
    clearMarker();
    dirtyRef.current = false;
    baseRef.current = emptyStateRows();
    resetAll();

    if (client && uid) {
      const initialRows = stateToRows(createInitialState(), uid);
      const changes = diffStateRows(emptyStateRows(), initialRows);
      try {
        await pushChanges(client, uid, changes);
        baseRef.current = initialRows;
        const syncedAt = new Date().toISOString();
        lastSyncedRef.current = syncedAt;
        persist(uid, initialRows, false, syncedAt);
        setLastSyncedAt(syncedAt);
        setError(null);
        setStatus('synced');
      } catch (err) {
        handleFailure(err);
      }
    } else {
      setStatus('disabled');
    }
    readyRef.current = true;
  }, [handleFailure, persist, resetAll]);

  const value = useMemo<SyncValue>(
    () => ({
      cloudEnabled,
      status,
      lastSyncedAt,
      error,
      syncNow,
      pushLocal,
      pullRemote,
      wipeCloud,
    }),
    [cloudEnabled, status, lastSyncedAt, error, syncNow, pushLocal, pullRemote, wipeCloud],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync harus dipakai di dalam SyncProvider');
  return context;
}
