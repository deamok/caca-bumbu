import { CookingPot } from 'lucide-react';

export function BrandSymbol({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`brand-symbol ${className}`}
      role="img"
      aria-label="Caca Bumbu"
    >
      <rect width="48" height="48" rx="14" fill="#173f30" />
      <circle cx="24" cy="24" r="16.5" fill="#f5e8ce" />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="#e8a23e" strokeWidth="1" strokeDasharray="1.5 3.2" />
      <path d="M13.5 24.5h21c-.4 7.1-4.6 11-10.5 11s-10.1-3.9-10.5-11Z" fill="#173f30" />
      <path d="M17 27.2c1.3 3.2 3.7 4.9 7 4.9" stroke="#e8a23e" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m29.2 12.2 3.5 2.7-7.1 9.2-3.5-2.7 7.1-9.2Z" fill="#e8a23e" />
      <path d="M19.2 17.3c-2.2-1.9-4.6-1.6-5.7-.7 1.1 2.6 3.2 3.2 5.6 2.8" fill="#5f8b5a" />
      <circle cx="34" cy="17" r="1.2" fill="#d65a3f" />
      <circle cx="12.8" cy="21.4" r=".9" fill="#d65a3f" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <BrandSymbol size={compact ? 34 : 42} />
      <div className="brand__text">
        <span className="brand__name">Caca Bumbu</span>
        {!compact ? <span className="brand__tagline">Bumbu rumahan · Sejak dapur sendiri</span> : null}
      </div>
    </div>
  );
}

export function EmptyBowl({ size = 58 }: { size?: number }) {
  return (
    <span className="empty-bowl" aria-hidden="true">
      <CookingPot size={size} strokeWidth={1.2} />
      <i />
    </span>
  );
}
