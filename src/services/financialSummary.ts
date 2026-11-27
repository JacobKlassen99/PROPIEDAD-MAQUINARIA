import {
  Campaign,
  Currency,
  ExchangeRateConfig,
  Expense,
  Income,
  MachineryJob,
} from '../types';
import { toBoliviaIsoDate } from './boliviaDate';
import { getCurrentLanguage } from './i18n';
import { formatNumberLocale } from './formatters';

export interface ModuleOperationalResult {
  ingresos: number;
  gastos: number;
  resultado: number;
}

export interface OperationalSummaryPair {
  machinery: ModuleOperationalResult;
  property: ModuleOperationalResult;
}

/**
 * Matches a record to a target campaign cleanly without cross-campaign leakage:
 * 1. If campanaId is present, it must match targetCamp.id (or targetCamp.nombre fallback).
 * 2. Otherwise, if campana/campanaNombre is present, it must match targetCamp.nombre.
 * 3. Only when both are absent, falls back to parsed date window or campaign year.
 */
export function matchesCampaignRecord(
  item: { campanaId?: string; campana?: string; campanaNombre?: string; fecha?: string } | null | undefined,
  targetCamp: Campaign | null | undefined
): boolean {
  if (!item || !targetCamp) return false;
  const targetId = String(targetCamp.id ?? '').trim();
  const targetName = String(targetCamp.nombre ?? '').trim().toLowerCase();
  const itemCampId = String(item.campanaId ?? '').trim();
  const itemCampName = String(item.campana || item.campanaNombre || '').trim().toLowerCase();

  if (itemCampId) {
    if (targetId && itemCampId === targetId) return true;
    if (targetName && itemCampId.toLowerCase() === targetName) return true;
    return false;
  }

  if (itemCampName) {
    if (targetName && itemCampName === targetName) return true;
    if (targetId && itemCampName === targetId.toLowerCase()) return true;
    return false;
  }

  const itemIso = toBoliviaIsoDate(item.fecha, false);
  if (!itemIso) return false;

  const startIso = toBoliviaIsoDate(targetCamp.fechaInicio, false);
  const endIso = toBoliviaIsoDate(targetCamp.fechaFin, false);
  if (startIso && endIso) {
    return itemIso >= startIso && itemIso <= endIso;
  }

  const yearMatch = targetName.match(/\b(20\d{2})\b/);
  if (yearMatch && itemIso.slice(0, 4) === yearMatch[1]) {
    return true;
  }

  if (startIso && !endIso) {
    return itemIso >= startIso;
  }

  return false;
}

/**
 * Identifies automatic late-payment interest income generated ONLY when
 * late-payment interest is actually collected (SYS_INTERES_MORA / INTERES_COBRO:*).
 */
export function isInterestIncome(i: Income | null | undefined): boolean {
  if (!i) return false;
  const itemId = String(i.itemId || '').trim().toUpperCase();
  if (itemId === 'SYS_INTERES_MORA') return true;
  const tid = String(i.trabajoId || '').trim().toUpperCase();
  if (tid.startsWith('INTERES_COBRO:')) return true;
  const name = String(i.concepto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return name.startsWith('interes por mora') || name.startsWith('late payment interest');
}

export function isMachineryInterestIncome(i: Income | null | undefined): boolean {
  if (!isInterestIncome(i)) return false;
  return i?.modulo === 'maquinarias';
}

export function isPropertyInterestIncome(i: Income | null | undefined): boolean {
  if (!isInterestIncome(i)) return false;
  return !i?.modulo || i.modulo === 'propiedad';
}

/**
 * Identifies direct property crop/harvest incomes (direct crop sales AND priced harvests
 * whose trabajoId starts with "COSECHA:"), excluding machinery service mirror rows
 * and excluding collected late-payment interest rows (which are reported separately).
 */
export function isDirectPropertyIncome(i: Income | null | undefined): boolean {
  if (!i) return false;
  if (isInterestIncome(i)) return false;
  if (i.modulo && i.modulo !== 'propiedad') return false;
  const tid = String(i.trabajoId || '').trim();
  if (tid) {
    return tid.toUpperCase().startsWith('COSECHA:');
  }
  return !i.esTrabajoPropio;
}

/**
 * Identifies expense rows that mirror an internal machinery job in Propiedad
 * so internal machinery jobs are counted once (from jobs) without duplication.
 */
export function isInternalMachineryJobExpense(e: Expense | null | undefined): boolean {
  if (!e) return false;
  if (e.esTrabajoPropio) return true;
  if (e.trabajoId) return true;
  const item = (e.itemGasto || (e as any).rubro || (e as any).concepto || '').trim();
  const obs = (e.observacion || (e as any).descripcion || '').trim();
  const pattern =
    /Servicio\s+Maquinaria\s+Propia|Trabajo\s+de\s+Maquinaria|Trabajo\s+en\s+Propiedad|Labores?\s+de\s+Maquinaria|Servicio\s+de\s+Maquinaria/i;
  return pattern.test(item) || pattern.test(obs);
}

/**
 * Converts a historical movement amount to target display currency using the
 * movement's historical exchange rate first, falling back to active configured TC.
 */
export function convertHistoricalAmount(
  amount: number | undefined | null,
  origCurrency: Currency | string = 'BOB',
  targetCurrency: Currency = 'USD',
  historicalTc?: number,
  fallbackExchangeRate?: ExchangeRateConfig | null
): number {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const normalizedOrig: Currency = String(origCurrency || 'BOB')
    .toUpperCase()
    .includes('USD')
    ? 'USD'
    : 'BOB';

  if (normalizedOrig === targetCurrency) return num;

  const rate =
    typeof historicalTc === 'number' && historicalTc > 0
      ? historicalTc
      : fallbackExchangeRate?.tasaBobPerUsd && fallbackExchangeRate.tasaBobPerUsd > 0
      ? fallbackExchangeRate.tasaBobPerUsd
      : 6.96;

  if (normalizedOrig === 'USD' && targetCurrency === 'BOB') {
    return num * rate;
  }
  if (normalizedOrig === 'BOB' && targetCurrency === 'USD') {
    return num / rate;
  }
  return num;
}

/**
 * Formats an amount in USD or Bs using locale separators
 * (Spanish: 1.250,50 | English: 1,250.50). Display-only.
 */
export function formatCurrencyAmount(val: number | undefined | null, currency: Currency = 'USD'): string {
  const symbol = currency === 'USD' ? 'USD' : 'Bs';
  const num = typeof val === 'number' && isFinite(val) ? val : 0;
  const formatted = formatNumberLocale(Math.abs(num), getCurrentLanguage(), 2);
  if (num < -0.004) return `-${symbol} ${formatted}`;
  return `${symbol} ${formatted}`;
}

/**
 * Computes separate operational results for Maquinarias and Propiedad for the
 * active campaign. Never calculates or returns a combined result because
 * internal jobs are income for Maquinarias and expense for Propiedad.
 */
export function computeOperationalSummaries(params: {
  activeCampaign: Campaign | null;
  jobs: MachineryJob[];
  expenses: Expense[];
  incomes: Income[];
  exchangeRate: ExchangeRateConfig | null;
  currency: Currency;
}): OperationalSummaryPair {
  const { activeCampaign, jobs, expenses, incomes, exchangeRate, currency } = params;

  const safeJobs = Array.isArray(jobs) ? jobs.filter(Boolean) : [];
  const safeExpenses = Array.isArray(expenses) ? expenses.filter(Boolean) : [];
  const safeIncomes = Array.isArray(incomes) ? incomes.filter(Boolean) : [];

  const campaignJobs = activeCampaign
    ? safeJobs.filter((j) => matchesCampaignRecord(j, activeCampaign))
    : safeJobs;
  const campaignExpenses = activeCampaign
    ? safeExpenses.filter((e) => matchesCampaignRecord(e, activeCampaign))
    : safeExpenses;
  const campaignIncomes = activeCampaign
    ? safeIncomes.filter((i) => matchesCampaignRecord(i, activeCampaign))
    : safeIncomes;

  // 1. Maquinarias: all services (external + internal property) + collected machinery late-payment interest minus machinery expenses
  const machServicios = campaignJobs.reduce(
    (sum, j) =>
      sum +
      convertHistoricalAmount(Number(j.total) || 0, j.moneda, currency, j.tipoCambio || j.tc, exchangeRate),
    0
  );
  const machIntereses = campaignIncomes
    .filter(isMachineryInterestIncome)
    .reduce(
      (sum, i) =>
        sum +
        convertHistoricalAmount(Number(i.total) || 0, i.moneda, currency, i.tipoCambio || i.tc, exchangeRate),
      0
    );
  const machIngresos = machServicios + machIntereses;
  const machGastos = campaignExpenses
    .filter((e) => e.modulo === 'maquinarias')
    .reduce(
      (sum, e) =>
        sum +
        convertHistoricalAmount(Number(e.total) || 0, e.moneda, currency, e.tipoCambio || e.tc, exchangeRate),
      0
    );

  // 2. Propiedad: direct crop/property incomes (incl. priced harvests) + collected property late-payment interest minus (direct property expenses + internal machinery jobs)
  const propCosechas = campaignIncomes
    .filter(isDirectPropertyIncome)
    .reduce(
      (sum, i) =>
        sum +
        convertHistoricalAmount(Number(i.total) || 0, i.moneda, currency, i.tipoCambio || i.tc, exchangeRate),
      0
    );
  const propIntereses = campaignIncomes
    .filter(isPropertyInterestIncome)
    .reduce(
      (sum, i) =>
        sum +
        convertHistoricalAmount(Number(i.total) || 0, i.moneda, currency, i.tipoCambio || i.tc, exchangeRate),
      0
    );
  const propIngresos = propCosechas + propIntereses;
  const propDirectGastos = campaignExpenses
    .filter((e) => e.modulo === 'propiedad' && !isInternalMachineryJobExpense(e))
    .reduce(
      (sum, e) =>
        sum +
        convertHistoricalAmount(Number(e.total) || 0, e.moneda, currency, e.tipoCambio || e.tc, exchangeRate),
      0
    );
  const propMachineryGastos = campaignJobs
    .filter((j) => j.tipoTrabajo === 'propiedad')
    .reduce(
      (sum, j) =>
        sum +
        convertHistoricalAmount(Number(j.total) || 0, j.moneda, currency, j.tipoCambio || j.tc, exchangeRate),
      0
    );
  const propGastos = propDirectGastos + propMachineryGastos;

  return {
    machinery: {
      ingresos: machIngresos,
      gastos: machGastos,
      resultado: machIngresos - machGastos,
    },
    property: {
      ingresos: propIngresos,
      gastos: propGastos,
      resultado: propIngresos - propGastos,
    },
  };
}
