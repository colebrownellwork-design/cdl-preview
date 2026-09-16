/** Trims, caps length, and coerces anything non-string to ''. */
export const str = (v: unknown, max = 500): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

export const isEmail = (v: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/** Plan values the pricing funnel can hand to the check form via `?plan=`. */
export const asPlan = (v: unknown): 'standard' | 'multi' | 'enterprise' | null =>
  v === 'standard' || v === 'multi' || v === 'enterprise' ? v : null;
