import {
  Campaign,
  Currency,
  ExchangeRateConfig,
  Expense,
  Income,
  ItemConfig,
  MachineryJob,
} from '../types';
import { toBoliviaIsoDate } from './boliviaDate';
import { getCurrentLanguage } from './i18n';
import { formatNumberLocale } from './formatters';
import { IconCategory } from './iconCatalog';
import { AppLanguage } from './translations';
import {
  isPropertyIncomeConcept,
  normalizeConceptText,
  resolveAgriculturalConcept,
} from './agriculturalProducts';

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

// ============================================================================
// CONCEPT BREAKDOWN ENGINE (SINGLE SOURCE OF TRUTH FOR GENERAL, MAQUINARIAS, PROPIEDAD)
// ============================================================================

export interface ConceptBreakdownRow {
  key: string;
  conceptId?: string;
  label: string;
  sublabel?: string;
  iconId?: string;
  iconCategory: IconCategory;
  amount: number;
  count: number;
  modulo?: 'maquinarias' | 'propiedad';
  isUnlinked?: boolean;
  isInactive?: boolean;
  isSystem?: boolean;
}

export interface ModuleConceptBreakdowns {
  ingresosPorConcepto: ConceptBreakdownRow[];
  gastosPorConcepto: ConceptBreakdownRow[];
  totalIngresos: number;
  totalGastos: number;
}

const GENERIC_EXPENSE_LABELS = new Set([
  '',
  'gasto',
  'gastos',
  'gasto directo',
  'otros gastos',
  'expense',
  'expenses',
  'direct expense',
  'other expenses',
]);

const GENERIC_INCOME_LABELS = new Set([
  '',
  'ingreso',
  'ingresos',
  'ingreso cosecha',
  'venta agricola',
  'venta',
  'otros ingresos',
  'income',
  'farm sale',
  'other income',
]);

function cleanBreakdownLabel(raw: string | undefined | null): string {
  if (!raw) return '';
  let clean = String(raw).trim();
  if (!clean) return '';
  clean = clean.replace(/^Servicio\s+Maquinaria\s+Propia\s*-\s*/i, '');
  clean = clean.replace(/^Servicio\s+Maquinaria\s+Propia\s*/i, '');
  clean = clean.replace(/^Servicio\s+a\s+terceros\s*-\s*/i, '');
  clean = clean.replace(/^Trabajo\s+en\s+propiedad\s*-\s*/i, '');
  clean = clean.replace(/^Trabajo\s+de\s+maquinaria\s*-\s*/i, '');
  clean = clean.replace(/^Labores?\s+de\s+maquinaria\s*-\s*/i, '');
  clean = clean.replace(/^con\s+/i, '');
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean;
}

function getItemModule(item: ItemConfig): 'maquinarias' | 'propiedad' | '' {
  const mod = String(item.modulo || '').trim().toUpperCase();
  const tipo = String(item.tipo || '').trim().toLowerCase();
  if (mod === 'MAQUINARIAS' || tipo.includes('maquinaria')) return 'maquinarias';
  if (mod === 'PROPIEDAD' || tipo.includes('propiedad')) return 'propiedad';
  return '';
}

function isExpenseItemConfig(item: ItemConfig | null | undefined): boolean {
  if (!item) return false;
  const cls = String(item.clase || '').trim().toUpperCase();
  const tipo = String(item.tipo || '').trim().toLowerCase();
  if (cls) return cls === 'GASTO';
  return tipo.startsWith('gasto_');
}

function normalizeConceptIcon(iconId: string | undefined | null): string | undefined {
  const raw = String(iconId || '').trim();
  if (!raw || raw.toLowerCase() === 'tag') return undefined;
  return raw;
}

/**
 * Resolves an Expense movement to its registered concept in Administration -> Concepts -> Expenses
 * using stable ID priority (preserving inactive concepts). Falls back to unambiguous exact name
 * match for legacy movements without itemId, and never invents associations for unlinked rows.
 */
export function resolveExpenseConceptMeta(
  expense: Expense,
  itemsConfig: ItemConfig[],
  lang: AppLanguage = getCurrentLanguage()
): Omit<ConceptBreakdownRow, 'amount' | 'count'> {
  const safeItems = Array.isArray(itemsConfig) ? itemsConfig.filter(Boolean) : [];
  const rawItemId = String(expense.itemId || '').trim();

  // 1. Stable ID match (works even when concept is renamed or inactive)
  if (rawItemId) {
    const byId = safeItems.find((it) => String(it.id || '').trim() === rawItemId);
    if (byId) {
      return {
        key: `cid:${byId.id}`,
        conceptId: String(byId.id),
        label: byId.nombre,
        iconId: normalizeConceptIcon(byId.icono),
        iconCategory: 'gasto',
        modulo: expense.modulo,
        isInactive: byId.activo === false,
      };
    }
  }

  // 2. Unambiguous exact normalized name match among registered Expense concepts
  const rawText = cleanBreakdownLabel(
    expense.itemGasto || (expense as any).rubro || (expense as any).categoria
  );
  const normText = normalizeConceptText(rawText);

  if (normText && safeItems.length > 0) {
    const expenseItems = safeItems.filter(isExpenseItemConfig);
    const sameModMatches = expenseItems.filter(
      (it) => getItemModule(it) === expense.modulo && normalizeConceptText(it.nombre) === normText
    );
    const pickUnique = (candidates: ItemConfig[]): ItemConfig | null => {
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) {
        const active = candidates.filter((c) => c.activo !== false);
        if (active.length === 1) return active[0];
      }
      return null;
    };

    const matched =
      pickUnique(sameModMatches) ||
      pickUnique(expenseItems.filter((it) => normalizeConceptText(it.nombre) === normText));

    if (matched) {
      return {
        key: `cid:${matched.id}`,
        conceptId: String(matched.id),
        label: matched.nombre,
        iconId: normalizeConceptIcon(matched.icono),
        iconCategory: 'gasto',
        modulo: expense.modulo,
        isInactive: matched.activo === false,
      };
    }
  }

  // 3. Historical movement without a linked concept — identifiable, never omitted, never falsely merged
  if (!normText || GENERIC_EXPENSE_LABELS.has(normText)) {
    return {
      key: 'unlinked:expense',
      label: lang === 'en' ? 'Unlinked expenses' : 'Gastos sin concepto vinculado',
      iconId: 'otros-gastos',
      iconCategory: 'gasto',
      modulo: expense.modulo,
      isUnlinked: true,
    };
  }

  return {
    key: `unlinked:expense:${normText}`,
    label: rawText,
    iconId: 'otros-gastos',
    iconCategory: 'gasto',
    modulo: expense.modulo,
    isUnlinked: true,
  };
}

/**
 * Resolves a Property Income movement (harvest sales, direct incomes, or collected late-payment interest)
 * to its registered concept in Administration -> Concepts -> Income using stable ID priority.
 */
export function resolvePropertyIncomeConceptMeta(
  income: Income,
  itemsConfig: ItemConfig[],
  lang: AppLanguage = getCurrentLanguage()
): Omit<ConceptBreakdownRow, 'amount' | 'count'> {
  const safeItems = Array.isArray(itemsConfig) ? itemsConfig.filter(Boolean) : [];

  if (isInterestIncome(income)) {
    const sysConcept = safeItems.find(
      (it) => String(it.id || '').trim().toUpperCase() === 'SYS_INTERES_MORA'
    );
    return {
      key: 'sys:interest_mora',
      conceptId: sysConcept?.id || 'SYS_INTERES_MORA',
      label:
        sysConcept?.nombre ||
        (lang === 'en' ? 'Late-payment interest' : 'Interés por mora'),
      iconId: normalizeConceptIcon(sysConcept?.icono) || 'otros-ingresos',
      iconCategory: 'ingreso',
      modulo: income.modulo || 'propiedad',
      isSystem: true,
    };
  }

  const rawItemId = String(income.itemId || '').trim();
  // 1. Stable ID match (works even when concept is renamed or inactive)
  if (rawItemId) {
    const byId = safeItems.find((it) => String(it.id || '').trim() === rawItemId);
    if (byId) {
      return {
        key: `cid:${byId.id}`,
        conceptId: String(byId.id),
        label: byId.nombre,
        iconId: normalizeConceptIcon(byId.icono),
        iconCategory: 'ingreso',
        modulo: 'propiedad',
        isInactive: byId.activo === false,
      };
    }
  }

  const rawLabel = cleanBreakdownLabel(income.concepto || (income as any).rubro);
  // Strip legacy " (Buyer)" suffix if present only for unambiguous registered concept resolution
  const withoutBuyer = rawLabel.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const normWithoutBuyer = normalizeConceptText(withoutBuyer);

  if (safeItems.length > 0 && withoutBuyer) {
    // 2. Agricultural & property income concept resolution (handles legacy "Soya" -> "Venta de Soya" unambiguously)
    const agriRes = resolveAgriculturalConcept(
      { conceptoId: rawItemId, producto: withoutBuyer },
      safeItems
    );
    if (agriRes.concept) {
      return {
        key: `cid:${agriRes.concept.id}`,
        conceptId: String(agriRes.concept.id),
        label: agriRes.concept.nombre,
        iconId: normalizeConceptIcon(agriRes.concept.icono),
        iconCategory: 'ingreso',
        modulo: 'propiedad',
        isInactive: agriRes.concept.activo === false,
      };
    }

    // 3. Exact match against all registered Property income concepts (including non-harvest incomes)
    const propIncomeItems = safeItems.filter(isPropertyIncomeConcept);
    const exactMatches = propIncomeItems.filter(
      (it) => normalizeConceptText(it.nombre) === normWithoutBuyer
    );
    const uniqueExact =
      exactMatches.length === 1
        ? exactMatches[0]
        : exactMatches.filter((it) => it.activo !== false).length === 1
        ? exactMatches.filter((it) => it.activo !== false)[0]
        : null;

    if (uniqueExact) {
      return {
        key: `cid:${uniqueExact.id}`,
        conceptId: String(uniqueExact.id),
        label: uniqueExact.nombre,
        iconId: normalizeConceptIcon(uniqueExact.icono),
        iconCategory: 'ingreso',
        modulo: 'propiedad',
        isInactive: uniqueExact.activo === false,
      };
    }
  }

  // 4. Historical unlinked income — identifiable, never omitted, never falsely merged
  if (!normWithoutBuyer || GENERIC_INCOME_LABELS.has(normWithoutBuyer)) {
    return {
      key: 'unlinked:income',
      label: lang === 'en' ? 'Unlinked income' : 'Ingresos sin concepto vinculado',
      iconId: 'otros-ingresos',
      iconCategory: 'ingreso',
      modulo: 'propiedad',
      isUnlinked: true,
    };
  }

  return {
    key: `unlinked:income:${normWithoutBuyer}`,
    label: withoutBuyer,
    iconId: 'otros-ingresos',
    iconCategory: 'ingreso',
    modulo: 'propiedad',
    isUnlinked: true,
  };
}

function addConceptAmount(
  map: Map<string, ConceptBreakdownRow>,
  meta: Omit<ConceptBreakdownRow, 'amount' | 'count'>,
  amount: number
) {
  const prev = map.get(meta.key);
  if (prev) {
    prev.amount += amount;
    prev.count += 1;
  } else {
    map.set(meta.key, { ...meta, amount, count: 1 });
  }
}

function finalizeConceptRows(map: Map<string, ConceptBreakdownRow>): ConceptBreakdownRow[] {
  return Array.from(map.values())
    .filter((r) => r.count > 0 && Math.abs(r.amount) > 0.0001)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Disambiguates rows in General consolidated view ONLY when two distinct concept IDs
 * (from Maquinarias vs Propiedad) share the exact same display label.
 */
function disambiguateCollidingLabels(
  rows: ConceptBreakdownRow[],
  lang: AppLanguage
): ConceptBreakdownRow[] {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const k = normalizeConceptText(r.label);
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  return rows.map((r) => {
    const k = normalizeConceptText(r.label);
    if ((counts.get(k) || 0) > 1 && r.modulo && !r.sublabel) {
      return {
        ...r,
        sublabel:
          r.modulo === 'maquinarias'
            ? lang === 'en'
              ? 'Machinery'
              : 'Maquinarias'
            : lang === 'en'
            ? 'Property'
            : 'Propiedad',
      };
    }
    return r;
  });
}

/**
 * Builds Ingresos por concepto and Gastos por concepto for Maquinarias.
 * Totals match machinery accounting summary 100% using historical exchange rates.
 */
export function buildMachineryConceptBreakdowns(params: {
  jobs: MachineryJob[];
  expenses: Expense[];
  interestIncomes: Income[];
  itemsConfig: ItemConfig[];
  currency: Currency;
  exchangeRate: ExchangeRateConfig | null;
  lang?: AppLanguage;
}): ModuleConceptBreakdowns {
  const { jobs, expenses, interestIncomes, itemsConfig, currency, exchangeRate } = params;
  const lang = params.lang || getCurrentLanguage();

  const incMap = new Map<string, ConceptBreakdownRow>();
  jobs.forEach((j) => {
    const val = convertHistoricalAmount(
      Number(j.total) || 0,
      j.moneda,
      currency,
      j.tipoCambio || j.tc,
      exchangeRate
    );
    if (j.tipoTrabajo === 'propiedad') {
      addConceptAmount(
        incMap,
        {
          key: 'sys:mach_prop_jobs',
          label: lang === 'en' ? 'Own property jobs' : 'Trabajos en propiedad propia',
          iconId: 'sembradora',
          iconCategory: 'implemento',
          modulo: 'maquinarias',
          isSystem: true,
        },
        val
      );
    } else {
      addConceptAmount(
        incMap,
        {
          key: 'sys:mach_ext_services',
          label: lang === 'en' ? 'External client services' : 'Servicios a terceros',
          iconId: 'tractor',
          iconCategory: 'maquinaria',
          modulo: 'maquinarias',
          isSystem: true,
        },
        val
      );
    }
  });

  interestIncomes.forEach((inc) => {
    const val = convertHistoricalAmount(
      Number(inc.total) || 0,
      inc.moneda,
      currency,
      inc.tipoCambio || inc.tc,
      exchangeRate
    );
    const meta = resolvePropertyIncomeConceptMeta(inc, itemsConfig, lang);
    addConceptAmount(incMap, { ...meta, modulo: 'maquinarias' }, val);
  });

  const expMap = new Map<string, ConceptBreakdownRow>();
  expenses
    .filter((e) => e.modulo === 'maquinarias')
    .forEach((e) => {
      const val = convertHistoricalAmount(
        Number(e.total) || 0,
        e.moneda,
        currency,
        e.tipoCambio || e.tc,
        exchangeRate
      );
      const meta = resolveExpenseConceptMeta(e, itemsConfig, lang);
      addConceptAmount(expMap, meta, val);
    });

  const ingresosPorConcepto = finalizeConceptRows(incMap);
  const gastosPorConcepto = finalizeConceptRows(expMap);
  return {
    ingresosPorConcepto,
    gastosPorConcepto,
    totalIngresos: ingresosPorConcepto.reduce((s, r) => s + r.amount, 0),
    totalGastos: gastosPorConcepto.reduce((s, r) => s + r.amount, 0),
  };
}

/**
 * Builds Ingresos por concepto and Gastos por concepto for Propiedad.
 * Includes own-machinery jobs once under "Trabajos de maquinaria propia" without double-counting
 * internal mirror expense rows. Totals match property accounting summary 100%.
 */
export function buildPropertyConceptBreakdowns(params: {
  directIncomes: Income[];
  interestIncomes: Income[];
  directExpenses: Expense[];
  internalJobs: MachineryJob[];
  itemsConfig: ItemConfig[];
  currency: Currency;
  exchangeRate: ExchangeRateConfig | null;
  lang?: AppLanguage;
}): ModuleConceptBreakdowns {
  const {
    directIncomes,
    interestIncomes,
    directExpenses,
    internalJobs,
    itemsConfig,
    currency,
    exchangeRate,
  } = params;
  const lang = params.lang || getCurrentLanguage();

  const incMap = new Map<string, ConceptBreakdownRow>();
  directIncomes.forEach((inc) => {
    const val = convertHistoricalAmount(
      Number(inc.total) || 0,
      inc.moneda,
      currency,
      inc.tipoCambio || inc.tc,
      exchangeRate
    );
    const meta = resolvePropertyIncomeConceptMeta(inc, itemsConfig, lang);
    addConceptAmount(incMap, meta, val);
  });

  interestIncomes.forEach((inc) => {
    const val = convertHistoricalAmount(
      Number(inc.total) || 0,
      inc.moneda,
      currency,
      inc.tipoCambio || inc.tc,
      exchangeRate
    );
    const meta = resolvePropertyIncomeConceptMeta(inc, itemsConfig, lang);
    addConceptAmount(incMap, meta, val);
  });

  const expMap = new Map<string, ConceptBreakdownRow>();
  directExpenses
    .filter((e) => e.modulo === 'propiedad' && !isInternalMachineryJobExpense(e))
    .forEach((e) => {
      const val = convertHistoricalAmount(
        Number(e.total) || 0,
        e.moneda,
        currency,
        e.tipoCambio || e.tc,
        exchangeRate
      );
      const meta = resolveExpenseConceptMeta(e, itemsConfig, lang);
      addConceptAmount(expMap, meta, val);
    });

  internalJobs
    .filter((j) => j.tipoTrabajo === 'propiedad')
    .forEach((j) => {
      const val = convertHistoricalAmount(
        Number(j.total) || 0,
        j.moneda,
        currency,
        j.tipoCambio || j.tc,
        exchangeRate
      );
      addConceptAmount(
        expMap,
        {
          key: 'sys:machinery_own_jobs',
          label: lang === 'en' ? 'Own machinery jobs' : 'Trabajos de maquinaria propia',
          iconId: 'tractor',
          iconCategory: 'maquinaria',
          modulo: 'propiedad',
          isSystem: true,
        },
        val
      );
    });

  const ingresosPorConcepto = finalizeConceptRows(incMap);
  const gastosPorConcepto = finalizeConceptRows(expMap);
  return {
    ingresosPorConcepto,
    gastosPorConcepto,
    totalIngresos: ingresosPorConcepto.reduce((s, r) => s + r.amount, 0),
    totalGastos: gastosPorConcepto.reduce((s, r) => s + r.amount, 0),
  };
}

/**
 * Builds consolidated Ingresos por concepto and Gastos por concepto for General.
 * Strictly excludes internal operations between Maquinarias and Propiedad from both totals and breakdowns.
 */
export function buildGeneralConceptBreakdowns(params: {
  jobs: MachineryJob[];
  expenses: Expense[];
  incomes: Income[];
  itemsConfig: ItemConfig[];
  currency: Currency;
  exchangeRate: ExchangeRateConfig | null;
  lang?: AppLanguage;
}): ModuleConceptBreakdowns {
  const { jobs, expenses, incomes, itemsConfig, currency, exchangeRate } = params;
  const lang = params.lang || getCurrentLanguage();

  const incMap = new Map<string, ConceptBreakdownRow>();

  // External machinery services ONLY (internal property jobs excluded!)
  jobs
    .filter((j) => j.tipoTrabajo === 'tercero')
    .forEach((j) => {
      const val = convertHistoricalAmount(
        Number(j.total) || 0,
        j.moneda,
        currency,
        j.tipoCambio || j.tc,
        exchangeRate
      );
      addConceptAmount(
        incMap,
        {
          key: 'sys:mach_ext_services',
          label:
            lang === 'en'
              ? 'External machinery services'
              : 'Servicios de maquinaria a terceros',
          iconId: 'tractor',
          iconCategory: 'maquinaria',
          modulo: 'maquinarias',
          isSystem: true,
        },
        val
      );
    });

  // Direct property incomes (harvest sales & other property income)
  incomes.filter(isDirectPropertyIncome).forEach((inc) => {
    const val = convertHistoricalAmount(
      Number(inc.total) || 0,
      inc.moneda,
      currency,
      inc.tipoCambio || inc.tc,
      exchangeRate
    );
    const meta = resolvePropertyIncomeConceptMeta(inc, itemsConfig, lang);
    addConceptAmount(incMap, meta, val);
  });

  // Collected late-payment interest (both modules)
  incomes
    .filter((i) => isMachineryInterestIncome(i) || isPropertyInterestIncome(i))
    .forEach((inc) => {
      const val = convertHistoricalAmount(
        Number(inc.total) || 0,
        inc.moneda,
        currency,
        inc.tipoCambio || inc.tc,
        exchangeRate
      );
      const meta = resolvePropertyIncomeConceptMeta(inc, itemsConfig, lang);
      addConceptAmount(incMap, meta, val);
    });

  // Consolidated expenses: Machinery expenses + Direct property expenses (internal jobs excluded!)
  const expMap = new Map<string, ConceptBreakdownRow>();
  expenses
    .filter(
      (e) =>
        e.modulo === 'maquinarias' ||
        (e.modulo === 'propiedad' && !isInternalMachineryJobExpense(e))
    )
    .forEach((e) => {
      const val = convertHistoricalAmount(
        Number(e.total) || 0,
        e.moneda,
        currency,
        e.tipoCambio || e.tc,
        exchangeRate
      );
      const meta = resolveExpenseConceptMeta(e, itemsConfig, lang);
      addConceptAmount(expMap, meta, val);
    });

  const ingresosPorConcepto = disambiguateCollidingLabels(finalizeConceptRows(incMap), lang);
  const gastosPorConcepto = disambiguateCollidingLabels(finalizeConceptRows(expMap), lang);
  return {
    ingresosPorConcepto,
    gastosPorConcepto,
    totalIngresos: ingresosPorConcepto.reduce((s, r) => s + r.amount, 0),
    totalGastos: gastosPorConcepto.reduce((s, r) => s + r.amount, 0),
  };
}

