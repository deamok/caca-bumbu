export function formatMoney(value: number, options: { sign?: boolean; compact?: boolean } = {}): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const negative = safe < 0;
  const absolute = Math.abs(safe);
  let body: string;
  if (options.compact && absolute >= 1_000_000) {
    body = `${(absolute / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  } else if (options.compact && absolute >= 1_000) {
    body = `${(absolute / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  } else {
    body = absolute.toLocaleString('id-ID');
  }
  const prefix = negative ? '−' : options.sign && safe > 0 ? '+' : '';
  return `${prefix}Rp ${body}`;
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits });
}

export function parseNumber(value: string): number {
  const normalized = value.replace(/[^0-9,-]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}
