import {
  Campaign,
  Currency,
  ExchangeRateConfig,
  Expense,
  Income,
  MachineryJob,
} from '../types';

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
 * Matches a record to a target campaign using the same rules as ReportsView
 * (exact campanaId, campana name, year fallback, or date window).
 */
export function matchesCampaignRecord(
  item: { campanaId?: string; campana?: string; campanaNombre?: string; fecha?: string } | null | undefined,
  targetCamp: Campaign | null | undefined
): boolean {
  if (!item || !targetCamp) return false;
  if (item.campanaId && targetCamp.id && String(item.campanaId) === String(targetCamp.id)) {
    return true;
  }
  const targetName = String(targetCamp.nombre ?? '').trim().toLowerCase();
  const itemCampName = String(item.campana || item.campanaNombre || '').trim().toLowerCase();
  if (itemCampName && targetName && itemCampName === targetName) {
    return true;
  }
  const yearMatch = targetName.match(/\b(20\d{2})\b/);
  if (yearMatch && item.fecha && String(item.fecha).startsWith(yearMatch[1])) {
    return true;
  }
  if (item.fecha && targetCamp.fechaInicio && targetCamp.fechaFin) {
    if (item.fecha >= targetCamp.fechaInicio && item.fecha <= targetCamp.fechaFin) {
      return true;
    }
  }
  return false;
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
 * Formats an amount in USD or Bs using Bolivian regional separators
 * (dot thousands, comma decimals). Display-only.
 */
export function formatCurrencyAmount(val: number | undefined | null, currency: Currency = 'USD'): string {
  const symbol = currency === 'USD' ? 'USD' : 'Bs';
  const num = typeof val === 'number' && isFinite(val) ? val : 0;
  const absFormatted = Math.abs(num).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const normalized = /^\d{1,3}(,\d{3})*\.\d{2}$/.test(absFormatted)
    ? absFormatted.replace(/,/g, '_').replace(/\./g, ',').replace(/_/g, '.')
    : absFormatted;
  if (num < -0.004) return `-${symbol} ${normalized}`;
  return `${symbol} ${normalized}`;
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

  // 1. Maquinarias: all services (external + internal property) minus machinery expenses
  const machIngresos = campaignJobs.reduce(
    (sum, j) =>
      sum +
      convertHistoricalAmount(Number(j.total) || 0, j.moneda, currency, j.tipoCambio || j.tc, exchangeRate),
    0
  );
  const machGastos = campaignExpenses
    .filter((e) => e.modulo === 'maquinarias')
    .reduce(
      (sum, e) =>
        sum +
        convertHistoricalAmount(Number(e.total) || 0, e.moneda, currency, e.tipoCambio || e.tc, exchangeRate),
      0
    );

  // 2. Propiedad: direct crop/property incomes minus (direct property expenses + internal machinery jobs)
  const propIngresos = campaignIncomes
    .filter((i) => !i.trabajoId)
    .reduce(
      (sum, i) =>
        sum +
        convertHistoricalAmount(Number(i.total) || 0, i.moneda, currency, i.tipoCambio || i.tc, exchangeRate),
      0
    );
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
