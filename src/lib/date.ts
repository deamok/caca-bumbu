const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function startOfDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateKey(input: Date | string = new Date()): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function isoAtDay(offsetDays: number, hour = 10, minute = 0): string {
  const date = startOfDay();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function isoFromDateKey(key: string, time = '10:00'): string {
  const [hour, minute] = time.split(':').map(Number);
  const date = parseDateKey(key);
  date.setHours(Number.isFinite(hour) ? hour : 10, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date.toISOString();
}

export function addDaysKey(key: string, amount: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

export function shiftDaysISO(iso: string, amount: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + amount);
  return date.toISOString();
}

export function daysUntil(key: string, baseKey = todayKey()): number {
  const target = parseDateKey(key).getTime();
  const base = parseDateKey(baseKey).getTime();
  return Math.round((target - base) / 86_400_000);
}

export function formatDate(isoOrKey: string, style: 'short' | 'long' | 'full' = 'short'): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoOrKey) ? parseDateKey(isoOrKey) : new Date(isoOrKey);
  if (Number.isNaN(date.getTime())) return '—';
  if (style === 'long') return `${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
  if (style === 'full') return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDayMonth(isoOrKey: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoOrKey) ? parseDateKey(isoOrKey) : new Date(isoOrKey);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

export function formatWeekdayShort(key: string): string {
  return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][parseDateKey(key).getDay()];
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
}

export function dueLabel(key: string): string {
  const diff = daysUntil(key);
  if (diff < 0) return `Terlambat ${Math.abs(diff)} hari`;
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  return `${diff} hari lagi`;
}

export function relativeLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && dateKey(date) === todayKey()) return `${hours} jam lalu`;
  const diff = daysUntil(dateKey(date));
  if (diff === 1) return 'Kemarin';
  if (diff > 1 && diff < 7) return `${diff} hari lalu`;
  return formatDate(iso);
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function startOfMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthLabel(key = monthKey()): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS_LONG[month - 1]} ${year}`;
}

export function periodRange(period: 'today' | '7d' | '30d' | 'month'): { from: string; to: string; label: string; days: number } {
  const to = todayKey();
  if (period === 'today') return { from: to, to, label: 'Hari ini', days: 1 };
  if (period === '7d') return { from: addDaysKey(to, -6), to, label: '7 hari terakhir', days: 7 };
  if (period === 'month') {
    const from = startOfMonthKey();
    const days = Math.max(1, daysUntil(to, from) + 1);
    return { from, to, label: 'Bulan ini', days };
  }
  return { from: addDaysKey(to, -29), to, label: '30 hari terakhir', days: 30 };
}

export function isWithin(iso: string, fromKey: string, toKey: string): boolean {
  const key = dateKey(iso);
  return key >= fromKey && key <= toKey;
}

export function lastNDays(count: number): string[] {
  const days: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    days.push(addDaysKey(todayKey(), -index));
  }
  return days;
}

export function formatDurationFromNow(iso: string): string {
  return relativeLabel(iso);
}
