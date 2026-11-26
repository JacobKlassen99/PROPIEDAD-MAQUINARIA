import type { Currency } from '../types';

/**
 * Simple Mora Interest & Multi-Currency Accounts Receivable Calculation Engine.
 * Mirrors the definitive calculation in Google Apps Script so UI previews match 100%.
 *
 * Rules:
 * - Simple interest ONLY (never compound, never interest on pending interest).
 * - Formula: Interest = remaining_principal * (monthly_rate / 100) * (overdue_days / 30).
 * - Begins accruing strictly AFTER dueDate and ONLY when aplicarInteres === true and rate > 0.
 * - Period-by-period history: partial payments preserve accrued interest up to payment date,
 *   and subsequent interest is calculated ONLY on the remaining principal.
 * - Payment application order per debt: 1) Accrued pending interest, 2) Remaining principal.
 */

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseIsoDay(isoDate?: string | null): Date | null {
  if (!isoDate) return null;
  const s = String(isoDate).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(Date.UTC(y, mo, d));
  if (isNaN(dt.getTime())) return null;
  return dt;
}

export function formatIsoDay(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToIso(isoDate: string, days: number): string {
  const dt = parseIsoDay(isoDate);
  if (!dt) return isoDate;
  const cleanDays = Math.max(0, Math.round(Number(days) || 0));
  dt.setUTCDate(dt.getUTCDate() + cleanDays);
  return formatIsoDay(dt);
}

export function diffDaysIso(fromIso: string, toIso: string): number {
  const a = parseIsoDay(fromIso);
  const b = parseIsoDay(toIso);
  if (!a || !b) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

export interface InterestPeriodPayment {
  fechaCobro: string;
  interesPagado: number;
  capitalPagado: number;
  creadoEn?: string;
}

export interface DebtInterestComputation {
  capitalOriginal: number;
  pagosCapitalAnteriores: number;
  pagosInteresAnteriores: number;
  pagosTotalesAnteriores: number;
  capitalPendiente: number;
  interesAcumulado: number;
  totalPendiente: number;
  diasAtraso: number;
  vencida: boolean;
}

export function calculateSimpleDebtState(params: {
  importeOriginal: number;
  fechaVencimiento?: string | null;
  aplicarInteres: boolean;
  tasaInteresMensual: number;
  pagos: InterestPeriodPayment[];
  asOfDate: string;
}): DebtInterestComputation {
  const original = Math.max(0, round2(Number(params.importeOriginal) || 0));
  const aplicar = Boolean(params.aplicarInteres);
  const rate = aplicar && Number(params.tasaInteresMensual) > 0 ? Number(params.tasaInteresMensual) : 0;
  const dueDate = params.fechaVencimiento ? String(params.fechaVencimiento).trim().slice(0, 10) : '';
  const asOf = String(params.asOfDate || '').trim().slice(0, 10);

  const sortedPayments = [...(params.pagos || [])]
    .filter((pay) => {
      const pDate = String(pay?.fechaCobro || '').trim().slice(0, 10);
      if (!pDate) return false;
      if (asOf && pDate > asOf) return false;
      return true;
    })
    .sort((a, b) => {
      const cmp = String(a.fechaCobro || '').localeCompare(String(b.fechaCobro || ''));
      if (cmp !== 0) return cmp;
      return String(a.creadoEn || '').localeCompare(String(b.creadoEn || ''));
    });

  let capital = original;
  let accruedInterest = 0;
  let pagosCapital = 0;
  let pagosInteres = 0;
  let cursorDate = dueDate;

  for (const pay of sortedPayments) {
    const pDate = String(pay.fechaCobro || '').trim().slice(0, 10);
    if (!pDate || (asOf && pDate > asOf)) continue;
    if (aplicar && rate > 0 && cursorDate && pDate && capital > 0.004) {
      const days = diffDaysIso(cursorDate, pDate);
      if (days > 0) {
        const periodInterest = round2(capital * (rate / 100) * (days / 30));
        accruedInterest = round2(accruedInterest + periodInterest);
        cursorDate = pDate;
      }
    }
    const intPaid = Math.max(0, round2(Number(pay.interesPagado) || 0));
    const capPaid = Math.max(0, round2(Number(pay.capitalPagado) || 0));

    pagosInteres = round2(pagosInteres + intPaid);
    pagosCapital = round2(pagosCapital + capPaid);

    accruedInterest = Math.max(0, round2(accruedInterest - intPaid));
    capital = Math.max(0, round2(capital - capPaid));
  }

  if (aplicar && rate > 0 && cursorDate && asOf && capital > 0.004) {
    const days = diffDaysIso(cursorDate, asOf);
    if (days > 0) {
      const tailInterest = round2(capital * (rate / 100) * (days / 30));
      accruedInterest = round2(accruedInterest + tailInterest);
    }
  }

  const totalPending = round2(capital + accruedInterest);
  const rawOverdueDays = dueDate && asOf && totalPending > 0.004 ? Math.max(0, diffDaysIso(dueDate, asOf)) : 0;

  return {
    capitalOriginal: original,
    pagosCapitalAnteriores: pagosCapital,
    pagosInteresAnteriores: pagosInteres,
    pagosTotalesAnteriores: round2(pagosCapital + pagosInteres),
    capitalPendiente: capital,
    interesAcumulado: accruedInterest,
    totalPendiente: totalPending,
    diasAtraso: rawOverdueDays,
    vencida: rawOverdueDays > 0 && totalPending > 0.004,
  };
}

/**
 * Convert an amount paid in `paymentCurrency` into the debt's original `debtCurrency`
 * using the explicit historical exchange rate `tc` (Bs per 1 USD).
 *
 * Rules (Section 14):
 * - Debt USD, Payment USD -> direct
 * - Debt USD, Payment BOB -> amount / tc
 * - Debt BOB, Payment BOB -> direct
 * - Debt BOB, Payment USD -> amount * tc
 */
export function convertPaymentToDebtCurrency(
  amountInPaymentCurrency: number,
  paymentCurrency: Currency,
  debtCurrency: Currency,
  tc: number
): number {
  const amt = Number(amountInPaymentCurrency) || 0;
  if (amt <= 0) return 0;
  if (paymentCurrency === debtCurrency) return round2(amt);
  if (!(tc > 0)) return 0;
  if (debtCurrency === 'USD' && paymentCurrency === 'BOB') {
    return round2(amt / tc);
  }
  if (debtCurrency === 'BOB' && paymentCurrency === 'USD') {
    return round2(amt * tc);
  }
  return round2(amt);
}

/**
 * Convert a debt balance in `debtCurrency` into the `paymentCurrency` needed to settle it.
 */
export function convertDebtToPaymentCurrency(
  amountInDebtCurrency: number,
  debtCurrency: Currency,
  paymentCurrency: Currency,
  tc: number
): number {
  const amt = Number(amountInDebtCurrency) || 0;
  if (amt <= 0) return 0;
  if (debtCurrency === paymentCurrency) return round2(amt);
  if (!(tc > 0)) return 0;
  if (debtCurrency === 'USD' && paymentCurrency === 'BOB') {
    return round2(amt * tc);
  }
  if (debtCurrency === 'BOB' && paymentCurrency === 'USD') {
    return round2(amt / tc);
  }
  return round2(amt);
}

/**
 * Split a payment applied to a single debt strictly in priority order:
 * 1) Accrued pending interest
 * 2) Remaining principal
 */
export function splitDebtApplication(
  appliedInDebtCurrency: number,
  pendingInterest: number,
  pendingPrincipal: number
): {
  interesPagado: number;
  capitalPagado: number;
  interesRestante: number;
  capitalRestante: number;
  totalRestante: number;
} {
  const applied = Math.max(0, round2(appliedInDebtCurrency));
  const interest = Math.max(0, round2(pendingInterest));
  const principal = Math.max(0, round2(pendingPrincipal));

  const interesPagado = Math.min(applied, interest);
  const afterInterest = round2(applied - interesPagado);
  const capitalPagado = Math.min(afterInterest, principal);

  const interesRestante = Math.max(0, round2(interest - interesPagado));
  const capitalRestante = Math.max(0, round2(principal - capitalPagado));
  const totalRestante = round2(interesRestante + capitalRestante);

  return {
    interesPagado: round2(interesPagado),
    capitalPagado: round2(capitalPagado),
    interesRestante,
    capitalRestante,
    totalRestante,
  };
}
