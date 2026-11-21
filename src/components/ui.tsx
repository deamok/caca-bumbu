import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Minus, Plus, Search, X } from 'lucide-react';
import type { ProductTone } from '../types';
import { initials } from '../lib/format';
import { navigate } from '../lib/router';

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger' | 'soft' | 'welcome';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  icon,
  iconAfter,
  loading = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${full ? 'btn--full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <span className="btn__icon">{icon}</span> : null}
      <span>{children}</span>
      {iconAfter ? <span className="btn__icon">{iconAfter}</span> : null}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function BackButton({ fallback = '/' }: { fallback?: string }) {
  return (
    <button
      type="button"
      className="back-btn"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else navigate(fallback);
      }}
      aria-label="Kembali"
    >
      <ChevronLeft size={21} />
    </button>
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}

export type BadgeTone = 'green' | 'gold' | 'red' | 'neutral' | 'blue' | 'outline';

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={`badge badge--${tone} ${className}`}>
      {dot ? <i className="badge__dot" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------- Page headers ------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  back = false,
  fallback = '/',
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  back?: boolean;
  fallback?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      {back ? (
        <div className="page-header__back">
          <BackButton fallback={fallback} />
        </div>
      ) : null}
      <div className="page-header__main">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`section-head ${className}`}>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="section-head__action">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------- Form ---------------------------------- */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  optional = false,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  optional?: boolean;
  className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      <div className="field__top">
        <label htmlFor={htmlFor}>{label}{optional ? <span className="field__optional">opsional</span> : null}</label>
        {hint ? <span className="field__hint">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="field__error">{error}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`input ${className}`} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return <select ref={ref} className={`input select ${className}`} {...rest}>{children}</select>;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return <textarea ref={ref} className={`input textarea ${className}`} {...rest} />;
  },
);

export function MoneyInput({
  value,
  onChange,
  placeholder = '0',
  id,
  min = 0,
  max,
  disabled,
  autoFocus,
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  id?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className={`money-input ${disabled ? 'money-input--disabled' : ''}`}>
      <span>Rp</span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
      />
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Cari…',
  label = 'Cari',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="search-field">
      <Search size={18} aria-hidden="true" />
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Hapus pencarian">
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  label = 'Jumlah',
  size = 'md',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`stepper stepper--${size}`}>
      <button
        type="button"
        aria-label={`Kurangi ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Minus size={15} />
      </button>
      <input
        aria-label={label}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : min);
        }}
      />
      <button
        type="button"
        aria-label={`Tambah ${label}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="toggle-row">
      <div>
        <strong>{label}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

/* ---------------------------------- Sheet --------------------------------- */

const SheetLockContext = createContext(false);

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const lock = useContext(SheetLockContext);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || lock) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('input, button, textarea, select');
      target?.focus({ preventScroll: true });
    }, 80);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, lock, onClose]);

  if (!open) return null;

  return createPortal(
    <SheetLockContext.Provider value>
      <div className="sheet-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <div className={`sheet ${wide ? 'sheet--wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={panelRef}>
          <div className="sheet__handle" />
          <header className="sheet__head">
            <div>
              <h2>{title}</h2>
              {description ? <p>{description}</p> : null}
            </div>
            <IconButton label="Tutup" onClick={onClose}><X size={20} /></IconButton>
          </header>
          <div className="sheet__content">{children}</div>
          {footer ? <footer className="sheet__footer">{footer}</footer> : null}
        </div>
      </div>
    </SheetLockContext.Provider>,
    document.body,
  );
}

/* --------------------------------- Display -------------------------------- */

export function Avatar({
  name,
  size = 'md',
  tone,
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tone?: 'green' | 'gold' | 'clay' | 'blue';
}) {
  const tones = ['green', 'gold', 'clay', 'blue'];
  const selected = tone ?? tones[name.length % tones.length];
  return <span className={`avatar avatar--${size} avatar--${selected}`} aria-hidden="true">{initials(name) || '?'}</span>;
}

export function ProductMark({
  name,
  tone = 'saffron',
  size = 'md',
}: {
  name: string;
  tone?: ProductTone;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  return (
    <span className={`product-mark product-mark--${tone} product-mark--${size}`} aria-hidden="true">
      <span>{initials(name).slice(0, 2)}</span>
      <i />
    </span>
  );
}

export function Progress({ value, max = 100, tone = 'green' }: { value: number; max?: number; tone?: 'green' | 'gold' | 'red' }) {
  const width = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`progress progress--${tone}`} aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={`segmented ${className}`} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {typeof option.count === 'number' ? <span>{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  illustration,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''}`}>
      {illustration ? <div className="empty-state__illustration">{illustration}</div> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function InlineNotice({
  tone = 'info',
  children,
  icon,
}: {
  tone?: 'info' | 'warning' | 'success';
  children: ReactNode;
  icon?: ReactNode;
}) {
  return <div className={`notice notice--${tone}`}>{icon ? <span className="notice__icon">{icon}</span> : null}<div>{children}</div></div>;
}

export function SummaryRow({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`summary-row ${strong ? 'summary-row--strong' : ''} ${muted ? 'summary-row--muted' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'plain',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'plain' | 'green' | 'gold' | 'red';
}) {
  return (
    <div className={`stat stat--${tone}`}>
      <div className="stat__top">
        <span>{label}</span>
        {icon ? <i className="stat__icon">{icon}</i> : null}
      </div>
      <strong>{value}</strong>
      {hint ? <div className="stat__hint">{hint}</div> : null}
    </div>
  );
}
