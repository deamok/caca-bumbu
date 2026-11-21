export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function documentCode(prefix: 'JL' | 'TT' | 'BH' | 'BY', date: string, sequence: number): string {
  const datePart = date.replace(/-/g, '').slice(2, 8);
  return `${prefix}-${datePart}-${String(sequence).padStart(2, '0')}`;
}
