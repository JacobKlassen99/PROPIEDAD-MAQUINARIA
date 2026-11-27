/**
 * Centralized Bolivia operational timezone helpers (America/La_Paz, UTC-4, no DST).
 *
 * Design principles:
 * - Operational dates (YYYY-MM-DD / DD/MM/YYYY) represent calendar days in Bolivia.
 * - Operational day rolls over strictly at 00:00 America/La_Paz (04:00 UTC),
 *   never at 20:00 Bolivia (00:00 UTC).
 * - Plain date-only values (YYYY-MM-DD or DD/MM/YYYY) are never shifted by
 *   the browser's local timezone or UTC conversions.
 * - Full ISO timestamps (e.g. creadoEn / actualizadoEn with Z or ±HH:MM) are
 *   converted into America/La_Paz when extracting their Bolivia operational day.
 */

export const BOLIVIA_TIMEZONE = 'America/La_Paz';
const BOLIVIA_UTC_OFFSET_MS = -4 * 60 * 60 * 1000;

let boliviaDateFormatter: Intl.DateTimeFormat | null = null;
try {
  boliviaDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOLIVIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
} catch {
  boliviaDateFormatter = null;
}

function formatDateInBoliviaFromUtcMs(ms: number): string {
  const safeDate = new Date(ms);
  if (isNaN(safeDate.getTime())) return '';

  if (boliviaDateFormatter) {
    try {
      const parts = boliviaDateFormatter.formatToParts(safeDate);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) {
        return `${y}-${m}-${d}`;
      }
    } catch {
      // Fallback below
    }
  }

  // Deterministic UTC-4 fallback (Bolivia does not observe DST)
  const shifted = new Date(ms + BOLIVIA_UTC_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's operational calendar date in Bolivia (America/La_Paz) as YYYY-MM-DD.
 * Optionally accepts a custom Date instance (useful for testing or formatting a Date).
 */
export function getBoliviaTodayIso(now: Date = new Date()): string {
  return formatDateInBoliviaFromUtcMs(now.getTime());
}

/**
 * Normalizes any operational date input (YYYY-MM-DD, DD/MM/YYYY, Date, or ISO timestamp)
 * into a Bolivia operational calendar date string YYYY-MM-DD.
 */
export function toBoliviaIsoDate(
  input?: string | Date | null,
  fallbackToToday = false
): string {
  if (input === null || input === undefined || input === '') {
    return fallbackToToday ? getBoliviaTodayIso() : '';
  }

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return fallbackToToday ? getBoliviaTodayIso() : '';
    return formatDateInBoliviaFromUtcMs(input.getTime());
  }

  const s = String(input).trim();
  if (!s) return fallbackToToday ? getBoliviaTodayIso() : '';

  // 1. Strict date-only YYYY-MM-DD (no timezone shift)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // 2. Date + time WITHOUT timezone suffix (e.g. "2026-11-26 22:30" already Bolivia local)
  const localYmd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (localYmd) {
    return `${localYmd[1]}-${localYmd[2].padStart(2, '0')}-${localYmd[3].padStart(2, '0')}`;
  }

  // 3. DD/MM/YYYY or D/M/YYYY (with optional time, no timezone shift)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (dmy) {
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    const month = String(parseInt(dmy[2], 10)).padStart(2, '0');
    const day = String(parseInt(dmy[1], 10)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 4. Full ISO timestamp with time + timezone (e.g. "2026-11-27T02:30:00.000Z")
  //    MUST be converted to America/La_Paz!
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return formatDateInBoliviaFromUtcMs(parsed.getTime());
  }

  return fallbackToToday ? getBoliviaTodayIso() : '';
}

/**
 * Formats an operational date into DD/MM/YYYY for UI display & reports.
 * Never shifts plain calendar dates across browser timezones.
 */
export function formatBoliviaDateDDMMAAAA(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const iso = toBoliviaIsoDate(dateInput, false);
  if (!iso) return typeof dateInput === 'string' ? dateInput : '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return typeof dateInput === 'string' ? dateInput : '';
  return `${d}/${m}/${y}`;
}

/**
 * Parses an operational date string into a timezone-independent epoch ms timestamp
 * (UTC midnight for calendar dates, exact epoch for full timestamps with timezone).
 */
export function parseOperationalDateTimestamp(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const s = String(dateStr).trim();
  if (!s) return 0;

  // Full ISO timestamp with explicit timezone (e.g. creadoEn)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(Z|[+\-]\d{2}:?\d{2})$/i.test(s)) {
    const parsed = Date.parse(s);
    return isNaN(parsed) ? 0 : parsed;
  }

  // DD/MM/YYYY with optional HH:mm:ss
  const dmy = s.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    const hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
    const minute = dmy[5] ? parseInt(dmy[5], 10) : 0;
    const second = dmy[6] ? parseInt(dmy[6], 10) : 0;
    return Date.UTC(year, month, day, hour, minute, second);
  }

  // YYYY-MM-DD with optional HH:mm:ss
  const ymd = s.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10) - 1;
    const day = parseInt(ymd[3], 10);
    const hour = ymd[4] ? parseInt(ymd[4], 10) : 0;
    const minute = ymd[5] ? parseInt(ymd[5], 10) : 0;
    const second = ymd[6] ? parseInt(ymd[6], 10) : 0;
    return Date.UTC(year, month, day, hour, minute, second);
  }

  const parsed = Date.parse(s);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Adds calendar days to an operational date without any local timezone drift.
 */
export function addDaysOperational(dateInput: string | Date, days: number): string {
  const base = toBoliviaIsoDate(dateInput, false);
  if (!base) return '';
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Math.round(Number(days) || 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Pure calendar day difference (toDate - fromDate) between two operational dates.
 */
export function diffDaysOperational(
  fromDate: string | Date,
  toDate: string | Date
): number {
  const a = toBoliviaIsoDate(fromDate, false);
  const b = toBoliviaIsoDate(toDate, false);
  if (!a || !b) return 0;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.round((tb - ta) / 86400000);
}
