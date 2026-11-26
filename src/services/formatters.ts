import type { Currency } from '../types';
import type { AppLanguage } from './translations';

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
 * Formats a date string (ISO YYYY-MM-DD, DD/MM/YYYY, or Date timestamp) for display:
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

  // ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm...
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return lang === 'en' ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    return lang === 'en' ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
  }

  return s;
}
