import type {
  Currency,
  DebitNoteLine,
  DebitNoteRecord,
  PaymentReceiptLine,
  PaymentReceiptRecord,
} from '../types';
import type { AppLanguage } from './translations';
import { formatDateLocale, formatMoneyLocale, formatNumberLocale } from './formatters';

export interface ParsedDocumentConcept {
  primary: string;
  secondary: string;
}

export interface DebitNoteDueDisplay {
  dueDateText: string;
  overdueText: string | null;
}

export interface DebitNoteCurrencyTotals {
  currency: Currency;
  hasItems: boolean;
  principal: number;
  interest: number;
  total: number;
}

export interface DebitNoteSummary {
  singleCurrency: Currency | null;
  usd: DebitNoteCurrencyTotals;
  bob: DebitNoteCurrencyTotals;
  blocks: DebitNoteCurrencyTotals[];
}

export interface PaymentReceiptCurrencyTotals {
  currency: Currency;
  hasItems: boolean;
  capital: number;
  interest: number;
  total: number;
  remaining: number;
}

export interface PaymentReceiptAmountCell {
  value: number;
  currency: Currency;
  isActualReceived: boolean;
  isEquivalentApplied: boolean;
}

export interface PaymentReceiptLineDisplay {
  paidUsd: PaymentReceiptAmountCell | null;
  paidBs: PaymentReceiptAmountCell | null;
  isCrossCurrency: boolean;
}

export interface PaymentReceiptSummary {
  singleCurrency: Currency | null;
  usd: PaymentReceiptCurrencyTotals;
  bob: PaymentReceiptCurrencyTotals;
  blocks: PaymentReceiptCurrencyTotals[];
  hasCrossCurrency: boolean;
  hasAnyInterest: boolean;
  hasAnyRemaining: boolean;
  hasAnyPaidUsd: boolean;
  hasAnyPaidBs: boolean;
  totalReceivedCurrency: Currency;
  totalReceivedAmount: number;
}

function round2(n: number): number {
  const safe = Number.isFinite(n) ? n : 0;
  return Math.round((safe + Number.EPSILON) * 100) / 100;
}

export function getCurrencyShortLabel(currency: Currency): string {
  return currency === 'USD' ? 'USD' : 'Bs';
}

/**
 * Splits a raw debt concept into a bold primary title and a smaller secondary detail line:
 * - Machinery jobs ("New Holland TS115 — Ripper (subsolador)") ->
 *   primary: "Ripper (subsolador)", secondary: "New Holland TS115"
 * - Harvest sales ("Venta de Soya — Lote Norte" or "Venta de Soya — 3 lotes (...)") ->
 *   primary: "Venta de Soya", secondary: "Lote Norte" / "3 lotes (...)"
 */
export function parseDocumentConcept(item: {
  concepto?: string;
  deudaTipo?: string;
  origen?: string;
  maquinaNombre?: string;
  loteNombre?: string;
}): ParsedDocumentConcept {
  const raw = String(item.concepto || '').trim();
  const isMachinery =
    String(item.deudaTipo || '').toUpperCase() === 'TRABAJO' ||
    String(item.origen || '').toUpperCase() === 'MAQUINARIAS';

  const sepMatch = raw.match(/\s+[—–]\s+/);
  if (sepMatch && sepMatch.index !== undefined) {
    const left = raw.slice(0, sepMatch.index).trim();
    const right = raw.slice(sepMatch.index + sepMatch[0].length).trim();
    if (left && right) {
      if (isMachinery) {
        return {
          primary: right,
          secondary: item.maquinaNombre?.trim() || left,
        };
      }
      return {
        primary: left,
        secondary: item.loteNombre?.trim() || right,
      };
    }
  }

  if (isMachinery) {
    return {
      primary: raw || 'Servicio de maquinaria',
      secondary: item.maquinaNombre?.trim() || '',
    };
  }

  return {
    primary: raw || 'Venta de cosecha',
    secondary: item.loteNombre?.trim() || '',
  };
}

export function detectSingleCurrency(currencies: Currency[]): Currency | null {
  if (!currencies.length) return null;
  const first = currencies[0];
  return currencies.every((c) => c === first) ? first : null;
}

export function formatDocumentAmount(
  value: number,
  currency: Currency,
  singleCurrency: Currency | null,
  lang: AppLanguage
): string {
  if (singleCurrency) {
    return formatNumberLocale(value, lang, 2);
  }
  return formatMoneyLocale(value, currency, lang);
}

/**
 * Secondary detail lines under Concepto in Debit Note.
 * Due date and overdue days now live in their own dedicated Vencimiento column,
 * so Concepto only carries clean secondary origin/equipment context.
 */
export function buildDebitNoteSecondaryMeta(
  item: DebitNoteLine,
  _lang?: AppLanguage
): string[] {
  const parsed = parseDocumentConcept(item);
  const lines: string[] = [];
  if (parsed.secondary) {
    lines.push(parsed.secondary);
  }
  return lines;
}

/**
 * Formats the dedicated Vencimiento column cell for a Debit Note line:
 * primary due date + optional subtle secondary overdue-days label.
 */
export function formatDebitNoteDueCell(
  item: DebitNoteLine,
  lang: AppLanguage
): DebitNoteDueDisplay {
  const dueDateText = item.fechaVencimiento
    ? formatDateLocale(item.fechaVencimiento, lang)
    : '—';
  const overdueDays = Math.max(0, Math.round(Number(item.diasAtraso) || 0));
  const overdueText =
    overdueDays > 0
      ? lang === 'en'
        ? `${overdueDays}d overdue`
        : `${overdueDays} d. mora`
      : null;
  return { dueDateText, overdueText };
}

/**
 * Secondary detail lines under Concepto in Payment Receipt.
 * When cross-currency, keeps subtle historical FX reference alongside equipment/lot info.
 */
export function buildPaymentReceiptSecondaryMeta(
  item: PaymentReceiptLine,
  lang: AppLanguage
): string[] {
  const parsed = parseDocumentConcept(item);
  const lines: string[] = [];
  if (parsed.secondary) {
    lines.push(parsed.secondary);
  }
  if (item.monedaPago !== item.monedaDeuda && item.tcAplicado > 0) {
    const tcTxt = formatNumberLocale(item.tcAplicado, lang, 2);
    lines.push(lang === 'en' ? `FX ${tcTxt}` : `TC ${tcTxt}`);
  }
  return lines;
}

/**
 * Computes the independent Pagado USD and Pagado Bs display cells for a Payment Receipt line.
 * - Clearly distinguishes actual amount received vs converted equivalent applied.
 * - Never sums USD and Bs as two separate payments.
 * - Uses the historical payment exchange rate (`tcAplicado`).
 */
export function computePaymentReceiptLineDisplay(
  item: PaymentReceiptLine,
  fallbackTc?: number
): PaymentReceiptLineDisplay {
  const isCrossCurrency = item.monedaPago !== item.monedaDeuda;
  const tc =
    Number(item.tcAplicado) > 0
      ? Number(item.tcAplicado)
      : Number(fallbackTc) > 0
      ? Number(fallbackTc)
      : 6.96;

  const totalDebtApplied = round2(
    Number(item.totalPagado) > 0
      ? Number(item.totalPagado)
      : (Number(item.capitalPagado) || 0) + (Number(item.interesPagado) || 0)
  );

  let origPaid = round2(Number(item.importeOriginalPagado) || 0);
  if (origPaid <= 0 && totalDebtApplied > 0) {
    if (!isCrossCurrency) {
      origPaid = totalDebtApplied;
    } else if (item.monedaDeuda === 'USD' && item.monedaPago === 'BOB') {
      origPaid = round2(totalDebtApplied * tc);
    } else if (item.monedaDeuda === 'BOB' && item.monedaPago === 'USD') {
      origPaid = round2(totalDebtApplied / tc);
    }
  }

  // Case 1: USD debt paid in USD
  if (item.monedaDeuda === 'USD' && item.monedaPago === 'USD') {
    return {
      paidUsd: {
        value: totalDebtApplied,
        currency: 'USD',
        isActualReceived: true,
        isEquivalentApplied: false,
      },
      paidBs: null,
      isCrossCurrency: false,
    };
  }

  // Case 2: USD debt paid in Bs (most common cross-currency case)
  if (item.monedaDeuda === 'USD' && item.monedaPago === 'BOB') {
    return {
      paidUsd: {
        value: totalDebtApplied,
        currency: 'USD',
        isActualReceived: false,
        isEquivalentApplied: true,
      },
      paidBs: {
        value: origPaid,
        currency: 'BOB',
        isActualReceived: true,
        isEquivalentApplied: false,
      },
      isCrossCurrency: true,
    };
  }

  // Case 3: Bs debt paid in Bs
  if (item.monedaDeuda === 'BOB' && item.monedaPago === 'BOB') {
    return {
      paidUsd: null,
      paidBs: {
        value: totalDebtApplied,
        currency: 'BOB',
        isActualReceived: true,
        isEquivalentApplied: false,
      },
      isCrossCurrency: false,
    };
  }

  // Case 4: Bs debt paid in USD
  return {
    paidUsd: {
      value: origPaid,
      currency: 'USD',
      isActualReceived: true,
      isEquivalentApplied: false,
    },
    paidBs: {
      value: totalDebtApplied,
      currency: 'BOB',
      isActualReceived: false,
      isEquivalentApplied: true,
    },
    isCrossCurrency: true,
  };
}

export function computeDebitNoteSummary(note: DebitNoteRecord): DebitNoteSummary {
  const items = Array.isArray(note.items) ? note.items : [];
  const singleCurrency = detectSingleCurrency(items.map((i) => i.moneda));

  const calcBucket = (currency: Currency): DebitNoteCurrencyTotals => {
    const list = items.filter((i) => i.moneda === currency);
    const principal = round2(list.reduce((s, i) => s + (Number(i.saldoPendiente) || 0), 0));
    const interest = round2(list.reduce((s, i) => s + (Number(i.interes) || 0), 0));
    const sumTotal = round2(list.reduce((s, i) => s + (Number(i.totalPorCobrar) || 0), 0));
    const total = sumTotal > 0 ? sumTotal : round2(principal + interest);
    return {
      currency,
      hasItems: list.length > 0,
      principal,
      interest,
      total,
    };
  };

  const usd = calcBucket('USD');
  const bob = calcBucket('BOB');
  const blocks: DebitNoteCurrencyTotals[] = [];
  if (usd.hasItems) blocks.push(usd);
  if (bob.hasItems) blocks.push(bob);

  // Fallback for header-only legacy snapshots without items
  if (blocks.length === 0) {
    if (note.totalUsd > 0) {
      blocks.push({
        currency: 'USD',
        hasItems: true,
        principal: round2(note.totalUsd),
        interest: 0,
        total: round2(note.totalUsd),
      });
    }
    if (note.totalBob > 0) {
      blocks.push({
        currency: 'BOB',
        hasItems: true,
        principal: round2(note.totalBob),
        interest: 0,
        total: round2(note.totalBob),
      });
    }
  }

  return { singleCurrency, usd, bob, blocks };
}

export function computePaymentReceiptSummary(receipt: PaymentReceiptRecord): PaymentReceiptSummary {
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const singleCurrency = detectSingleCurrency(items.map((i) => i.monedaDeuda));

  const calcBucket = (currency: Currency): PaymentReceiptCurrencyTotals => {
    const list = items.filter((i) => i.monedaDeuda === currency);
    const capital = round2(list.reduce((s, i) => s + (Number(i.capitalPagado) || 0), 0));
    const interest = round2(list.reduce((s, i) => s + (Number(i.interesPagado) || 0), 0));
    const sumTotal = round2(list.reduce((s, i) => s + (Number(i.totalPagado) || 0), 0));
    const total = sumTotal > 0 ? sumTotal : round2(capital + interest);
    const remaining = round2(list.reduce((s, i) => s + (Number(i.saldoRestante) || 0), 0));
    return {
      currency,
      hasItems: list.length > 0,
      capital,
      interest,
      total,
      remaining,
    };
  };

  const usd = calcBucket('USD');
  const bob = calcBucket('BOB');
  const blocks: PaymentReceiptCurrencyTotals[] = [];
  if (usd.hasItems) blocks.push(usd);
  if (bob.hasItems) blocks.push(bob);

  if (blocks.length === 0) {
    if (receipt.totalAplicadoUsd > 0) {
      blocks.push({
        currency: 'USD',
        hasItems: true,
        capital: round2(receipt.totalAplicadoUsd),
        interest: 0,
        total: round2(receipt.totalAplicadoUsd),
        remaining: 0,
      });
    }
    if (receipt.totalAplicadoBob > 0) {
      blocks.push({
        currency: 'BOB',
        hasItems: true,
        capital: round2(receipt.totalAplicadoBob),
        interest: 0,
        total: round2(receipt.totalAplicadoBob),
        remaining: 0,
      });
    }
  }

  const lineDisplays = items.map((item) =>
    computePaymentReceiptLineDisplay(item, receipt.tcAplicado)
  );
  const hasCrossCurrency = items.some((i) => i.monedaPago !== i.monedaDeuda);
  const hasAnyInterest = blocks.some((b) => b.interest > 0.005);
  const hasAnyRemaining = blocks.some((b) => b.remaining > 0.005);
  const hasAnyPaidUsd = lineDisplays.some((d) => d.paidUsd !== null);
  const hasAnyPaidBs = lineDisplays.some((d) => d.paidBs !== null);

  return {
    singleCurrency,
    usd,
    bob,
    blocks,
    hasCrossCurrency,
    hasAnyInterest,
    hasAnyRemaining,
    hasAnyPaidUsd,
    hasAnyPaidBs,
    totalReceivedCurrency: receipt.monedaPago,
    totalReceivedAmount: round2(Number(receipt.importeOriginalPagado) || 0),
  };
}
