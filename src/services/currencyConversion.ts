import { Currency, Lot } from '../types';
import { tStatic } from './i18n';

/**
 * Anchor stored in a ref per monetary form so repeated USD <-> Bs toggles
 * recover the exact original figure without cumulative rounding drift.
 */
export interface CurrencyConversionAnchor {
  baseAmount: number;
  baseCurrency: Currency;
  lastDisplayedValue: number;
  lastCurrency: Currency;
  lastTc: number;
}

export interface CurrencyConversionResult {
  converted: boolean;
  currency: Currency;
  valueNum: number | '';
  valueStr: string;
  nextAnchor: CurrencyConversionAnchor | null;
  error?: string;
}

function parseNumericValue(raw: number | string | '' | null | undefined): number | null {
  if (raw === '' || raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return isFinite(raw) ? raw : null;
  }
  const normalized = String(raw).trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return isFinite(parsed) ? parsed : null;
}

function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Converts a monetary input value when the user toggles currency (USD <-> Bs).
 * - USD -> Bs: multiplies by tc
 * - Bs -> USD: divides by tc
 * - Preserves exact original value on round-trip toggles using the anchor
 * - Prevents conversion when tc <= 0 or when fromCurrency === toCurrency
 * - Never alters empty or zero inputs (still allows currency switch)
 */
export function convertFormCurrencyValue(params: {
  currentValue: number | string | '' | null | undefined;
  fromCurrency: Currency;
  toCurrency: Currency;
  tc: number | string | '' | null | undefined;
  anchor: CurrencyConversionAnchor | null;
}): CurrencyConversionResult {
  const { currentValue, fromCurrency, toCurrency, tc, anchor } = params;
  const parsedCurrent = parseNumericValue(currentValue);

  if (fromCurrency === toCurrency) {
    return {
      converted: false,
      currency: fromCurrency,
      valueNum: parsedCurrent === null ? '' : parsedCurrent,
      valueStr: parsedCurrent === null ? '' : String(currentValue ?? ''),
      nextAnchor: anchor,
    };
  }

  // Empty field: allow switching currency without error or fabricated numbers
  if (parsedCurrent === null) {
    return {
      converted: true,
      currency: toCurrency,
      valueNum: '',
      valueStr: '',
      nextAnchor: null,
    };
  }

  // Zero amount: keep 0 and allow switching currency
  if (parsedCurrent === 0) {
    return {
      converted: true,
      currency: toCurrency,
      valueNum: 0,
      valueStr: '0',
      nextAnchor: null,
    };
  }

  const tcNum = parseNumericValue(tc);
  if (tcNum === null || tcNum <= 0) {
    return {
      converted: false,
      currency: fromCurrency,
      valueNum: parsedCurrent,
      valueStr: String(currentValue ?? ''),
      nextAnchor: anchor,
      error: tStatic('common.tcInvalidConvert'),
    };
  }

  // Check if we can recover the exact base value from the anchor (round-trip toggle)
  const anchorStillValid =
    anchor !== null &&
    anchor.lastCurrency === fromCurrency &&
    Math.abs(anchor.lastDisplayedValue - parsedCurrent) < 0.005 &&
    Math.abs(anchor.lastTc - tcNum) < 0.0001;

  if (anchorStillValid && anchor.baseCurrency === toCurrency) {
    const recovered = roundTo2(anchor.baseAmount);
    return {
      converted: true,
      currency: toCurrency,
      valueNum: recovered,
      valueStr: recovered.toFixed(2),
      nextAnchor: {
        ...anchor,
        lastDisplayedValue: recovered,
        lastCurrency: toCurrency,
        lastTc: tcNum,
      },
    };
  }

  const rawConverted =
    fromCurrency === 'USD' && toCurrency === 'BOB'
      ? parsedCurrent * tcNum
      : parsedCurrent / tcNum;

  const rounded = roundTo2(rawConverted);

  return {
    converted: true,
    currency: toCurrency,
    valueNum: rounded,
    valueStr: rounded.toFixed(2),
    nextAnchor: {
      baseAmount: parsedCurrent,
      baseCurrency: fromCurrency,
      lastDisplayedValue: rounded,
      lastCurrency: toCurrency,
      lastTc: tcNum,
    },
  };
}

/**
 * Returns true strictly when a unit represents hectares (ha / hectárea / hectáreas).
 * Never matches hours, tons, liters, kilograms, bags, or generic units.
 */
export function isHectareUnit(unit?: string | null): boolean {
  const normalized = String(unit || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!normalized) return false;
  return (
    normalized === 'ha' ||
    normalized === 'has' ||
    normalized === 'hectarea' ||
    normalized === 'hectareas' ||
    normalized.startsWith('hectarea')
  );
}

/**
 * Resolves a lot's valid positive surface in hectares from the lots catalog.
 */
export function getLotSurfaceHa(lots: Lot[], lotId?: string | null): number | null {
  if (!lotId || !Array.isArray(lots)) return null;
  const lot = lots.find((l) => l && String(l.id) === String(lotId));
  if (!lot) return null;
  const raw = lot.superficieHectareas ?? lot.superficie;
  const parsed = parseNumericValue(raw);
  if (parsed === null || parsed <= 0) return null;
  return roundTo2(parsed);
}
