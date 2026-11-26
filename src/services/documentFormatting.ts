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

export interface PaymentReceiptSummary {
  singleCurrency: Currency | null;
  usd: PaymentReceiptCurrencyTotals;
  bob: PaymentReceiptCurrencyTotals;
  blocks: PaymentReceiptCurrencyTotals[];
  hasCrossCurrency: boolean;
  hasAnyInterest: boolean;
  hasAnyRemaining: boolean;
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
 * - Harvest sales ("Venta de Soya — Lote Norte") ->
 *   primary: "Venta de Soya", secondary: "Lote Norte"
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

export function buildDebitNoteSecondaryMeta(
  item: DebitNoteLine,
  lang: AppLanguage
): string[] {
  const parsed = parseDocumentConcept(item);
  const lines: string[] = [];
  if (parsed.secondary) {
    lines.push(parsed.secondary);
  }
  if (item.fechaVencimiento) {
    const dueFormatted = formatDateLocale(item.fechaVencimiento, lang);
    const dueLabel = lang === 'en' ? `Due: ${dueFormatted}` : `Vence: ${dueFormatted}`;
    if (item.diasAtraso > 0) {
      const lateLabel =
        lang === 'en'
          ? `${item.diasAtraso}d overdue`
          : `${item.diasAtraso} d. mora`;
      lines.push(`${dueLabel} · ${lateLabel}`);
    } else {
      lines.push(dueLabel);
    }
  }
  return lines;
}

export function buildPaymentReceiptSecondaryMeta(
  item: PaymentReceiptLine,
  lang: AppLanguage
): string[] {
  const parsed = parseDocumentConcept(item);
  const lines: string[] = [];
  if (parsed.secondary) {
    lines.push(parsed.secondary);
  }
  if (item.monedaPago !== item.monedaDeuda) {
    const paidTxt = formatMoneyLocale(item.importeOriginalPagado, item.monedaPago, lang);
    const tcTxt = formatNumberLocale(item.tcAplicado, lang, 2);
    lines.push(
      lang === 'en'
        ? `Paid ${paidTxt} (FX ${tcTxt})`
        : `Pagado ${paidTxt} (TC ${tcTxt})`
    );
  }
  return lines;
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

  const hasCrossCurrency = items.some((i) => i.monedaPago !== i.monedaDeuda);
  const hasAnyInterest = blocks.some((b) => b.interest > 0.005);
  const hasAnyRemaining = blocks.some((b) => b.remaining > 0.005);

  return {
    singleCurrency,
    usd,
    bob,
    blocks,
    hasCrossCurrency,
    hasAnyInterest,
    hasAnyRemaining,
  };
}
