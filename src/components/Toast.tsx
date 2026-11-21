import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastContextValue {
  notify: (title: string, options?: { tone?: ToastTone; message?: string }) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((title: string, options?: { tone?: ToastTone; message?: string }) => {
    counter.current += 1;
    const id = counter.current;
    const item: ToastItem = { id, title, tone: options?.tone ?? 'success', message: options?.message };
    setItems((current) => [...current.slice(-2), item]);
    const timer = window.setTimeout(() => dismiss(id), 4200);
    timers.current.push(timer);
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifikasi">
        {items.map((item) => {
          const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertCircle : Info;
          return (
            <div className={`toast toast--${item.tone}`} key={item.id} role="status">
              <span className="toast__icon"><Icon size={19} strokeWidth={2.2} /></span>
              <div className="toast__body">
                <strong>{item.title}</strong>
                {item.message ? <p>{item.message}</p> : null}
              </div>
              <button className="toast__close" type="button" onClick={() => dismiss(item.id)} aria-label="Tutup notifikasi">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return context;
}
