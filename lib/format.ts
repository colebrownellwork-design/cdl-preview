const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const parse = (d: string | null) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')) : null);

/** "12 Mar 2025" */
export function fmtDate(d: string | null): string {
  const t = parse(d);
  return t ? `${String(t.getDate()).padStart(2, '0')} ${SHORT[t.getMonth()]} ${t.getFullYear()}` : '';
}

/** "07 Sep" */
export function fmtDay(d: string | null): string {
  const t = parse(d);
  return t ? `${String(t.getDate()).padStart(2, '0')} ${SHORT[t.getMonth()]}` : '';
}

/** "September 2026" */
export function fmtMonth(d: string | null): string {
  const t = parse(d);
  return t ? `${MONTHS[t.getMonth()]} ${t.getFullYear()}` : '';
}

export const yearOf = (d: string) => Number(d.slice(0, 4));

/** "YC" from "Your Company LLC" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export const money = (cents: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

export const PLAN_LABEL: Record<string, string> = {
  standard: 'Standard',
  multi: 'Multi-Entity',
  enterprise: 'Enterprise',
};
