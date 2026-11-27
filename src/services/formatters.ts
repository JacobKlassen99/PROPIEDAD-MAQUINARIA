import type { Currency } from '../types';
import type { AppLanguage } from './translations';
import { toBoliviaIsoDate } from './boliviaDate';

/**
 * Formats a numeric value using locale conventions:
 * - Spanish ('es'): 1.250,50 (dot thousands, comma decimal)
 * - English ('en'): 1,250.50 (comma thousands, dot decimal)
 * Presentation-only helper; never alters underlying calculations or backend values.
 */
export function formatNumberLocale(
  value: number,
  lang: AppLanguage = 'es',
  decimals = 2
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(decimals);
  const [intPartRaw, decPart] = fixed.split('.');
  const isNeg = intPartRaw.startsWith('-');
  const digits = isNeg ? intPartRaw.slice(1) : intPartRaw;
  const thousandSep = lang === 'en' ? ',' : '.';
  const decimalSep = lang === 'en' ? '.' : ',';
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  const signed = isNeg ? `-${grouped}` : grouped;
  return decimals > 0 && decPart !== undefined ? `${signed}${decimalSep}${decPart}` : signed;
}

/**
 * Formats a percentage with at most 1 decimal place (never 2+ decimals).
 * Shows integer values cleanly without trailing ",0" / ".0" (e.g., 50% or 33,3%).
 */
export function formatPercentMax1(
  value: number,
  lang: AppLanguage = 'es'
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Math.round((safe + Number.EPSILON) * 10) / 10;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  return `${formatNumberLocale(rounded, lang, isWhole ? 0 : 1)}%`;
}

/**
 * Formats a monetary amount with currency prefix ('USD' or 'Bs') and 2 decimals.
 */
export function formatMoneyLocale(
  value: number,
  currency: Currency,
  lang: AppLanguage = 'es'
): string {
  const prefix = currency === 'USD' ? 'USD' : 'Bs';
  return `${prefix} ${formatNumberLocale(value, lang, 2)}`;
}

/**
 * Formats a date string (ISO YYYY-MM-DD, DD/MM/YYYY, or Date timestamp) for display
 * in Bolivia operational calendar date:
 * - Spanish ('es'): DD/MM/AAAA
 * - English ('en'): MM/DD/YYYY
 */
export function formatDateLocale(
  dateStr: string | undefined | null,
  lang: AppLanguage = 'es'
): string {
  if (!dateStr) return '—';
  const s = String(dateStr).trim();
  if (!s) return '—';

  const iso = toBoliviaIsoDate(s, false);
  if (iso) {
    const [yyyy, mm, dd] = iso.split('-');
    if (yyyy && mm && dd) {
      return lang === 'en' ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
    }
  }

  return s;
}
