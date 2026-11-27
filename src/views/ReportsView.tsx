import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Tractor,
  Sprout,
  Calendar,
  FileText,
  List,
} from 'lucide-react';
import {
  Campaign,
  Machine,
  MachineJobType,
  Lot,
  MachineryJob,
  Expense,
  Income,
  Currency,
  ExchangeRateConfig,
  HarvestRecord,
  HarvestSale,
} from '../types';
import {
  matchesCampaignRecord,
  isDirectPropertyIncome,
  isMachineryInterestIncome,
  isPropertyInterestIncome,
  isInternalMachineryJobExpense,
  convertHistoricalAmount,
  formatCurrencyAmount,
} from '../services/financialSummary';
import {
  formatDateDDMMAAAA,
  getBoliviaDateString,
  getHarvests,
  hasAdminAuthorization,
} from '../services/backend';
import { cacheKeys, getCachedQuery, revalidateQuery } from '../services/dataCache';
import { fetchNormalizedHarvestSalesBundle } from '../services/preloader';
import { computeHarvestAvailability, roundPct2, roundTons } from '../services/harvestAvailability';
import { formatNumberLocale, formatPercentMax1 } from '../services/formatters';
import { resolveJobDisplay } from '../services/jobDisplay';
import { CompactFilter } from '../components/CompactListUI';
import { Switch } from '../components/Switch';
import { SlidingSelector } from '../components/SlidingSelector';
import { usePersistedMemoryState } from '../hooks/useSwrQuery';
import { getCurrentLanguage, useI18n } from '../services/i18n';

export type ReportScreen =
  | 'general'
  | 'maquinarias'
  | 'propiedad'
  // Legacy aliases kept for backwards compatibility
  | 'menu'
  | 'balance_general'
  | 'propiedad_menu'
  | 'propiedad_balance'
  | 'lotes'
  | 'lote_detail'
  | 'campanas'
  | 'campana_detail'
  | 'libro_diario';

type ReportMode = 'general' | 'maquinarias' | 'propiedad';
type ReportDetailLevel = 'resumido' | 'detallado';
type GeneralScopeTab = 'consolidado' | 'maquinarias' | 'propiedad';

interface Props {
  campaigns?: Campaign[];
  activeCampaign?: Campaign | null;
  machines?: Machine[];
  machineJobTypes?: MachineJobType[];
  lots?: Lot[];
  jobs?: MachineryJob[];
  expenses?: Expense[];
  incomes?: Income[];
  currency?: Currency;
  exchangeRate?: ExchangeRateConfig;
  initialScreen?: ReportScreen;
  onRootBackLabel?: string;
  onBack?: () => void;
}

// ============================================================================
// REACT ERROR BOUNDARY
// ============================================================================
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ReportsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ReportsErrorBoundary]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isEn = getCurrentLanguage() === 'en';
      return (
        <div className="rounded-2xl border border-[#C44545]/30 bg-[#FCECEC] p-5 text-center space-y-3 max-w-xl mx-auto my-6">
          <div className="flex items-center justify-center gap-3">
            <AlertCircle className="h-6 w-6 text-[#C44545] shrink-0" />
            <div className="text-left">
              <h3 className="text-base font-bold text-[#26352D]">
                {isEn ? 'Could not load report' : 'No se pudo cargar el reporte'}
              </h3>
              <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">
                {this.state.error?.message ||
                  (isEn
                    ? 'A problem occurred while processing the financial information.'
                    : 'Ocurrió un problema al procesar la información financiera.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2.5 bg-[#24875B] hover:bg-[#1D704B] text-white font-semibold text-sm rounded-xl transition cursor-pointer min-h-[44px]"
          >
            {isEn ? 'Retry' : 'Reintentar'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// HELPERS
// ============================================================================
function normalizeInitialMode(screen?: ReportScreen): ReportMode {
  if (screen === 'maquinarias') return 'maquinarias';
  if (
    screen === 'propiedad' ||
    screen === 'propiedad_menu' ||
    screen === 'propiedad_balance' ||
    screen === 'lotes' ||
    screen === 'lote_detail'
  ) {
    return 'propiedad';
  }
  return 'general';
}

function cleanConceptLabel(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  let clean = String(raw).trim();
  if (!clean) return fallback;
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
  return clean || fallback;
}

function getNetColorClass(value: number): string {
  if (value > 0.004) return 'text-[#24875B]';
  if (value < -0.004) return 'text-[#C44545]';
  return 'text-[#26352D]';
}

function getNetBgClass(value: number): string {
  if (value > 0.004) return 'bg-[#EAF5EE] border-[#24875B]/25';
  if (value < -0.004) return 'bg-[#FCECEC] border-[#C44545]/25';
  return 'bg-slate-50 border-slate-200';
}

function formatNumberEs(val: number, decimals = 2): string {
  return formatNumberLocale(val, getCurrentLanguage(), decimals);
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

interface GroupedAmountRow {
  key: string;
  label: string;
  sublabel?: string;
  amount: number;
  count: number;
}

interface LotDetailedResult {
  lotId: string;
  lotName: string;
  hectares: number;
  toneladasCosechadas: number;
  toneladasVendidas: number;
  toneladasDisponibles: number;
  porcentajeVendido: number;
  ingresosCosechas: number;
  ingresosIntereses: number;
  ingresos: number;
  gastosDirectos: number;
  gastosMaquinaria: number;
  gastosTotales: number;
  resultadoNeto: number;
  ingresoPorHa: number | null;
  gastoPorHa: number | null;
  utilidadPorHa: number | null;
  gastosDirectosPorConcepto: GroupedAmountRow[];
  trabajosMaquinariaPorLabor: GroupedAmountRow[];
  ingresosPorConcepto: GroupedAmountRow[];
}

// ============================================================================
// MAIN REPORTS COMPONENT
// ============================================================================
const ReportsViewInner: React.FC<Props> = ({
  campaigns = [],
  activeCampaign = null,
  machines = [],
  machineJobTypes = [],
  lots = [],
  jobs = [],
  expenses = [],
  incomes = [],
  exchangeRate,
  initialScreen = 'general',
  onRootBackLabel,
  onBack,
}) => {
  const { lang, t, bi } = useI18n();
  const rootMode: ReportMode = normalizeInitialMode(initialScreen);

  const safeCampaigns = useMemo(
    () => (Array.isArray(campaigns) ? campaigns.filter(Boolean) : []),
    [campaigns]
  );
  const safeMachines = useMemo(
    () =>
      (Array.isArray(machines) ? machines.filter(Boolean) : []).sort((a, b) =>
        naturalCompare(a.nombre || '', b.nombre || '')
      ),
    [machines]
  );
  const safeMachineJobTypes = useMemo(
    () => (Array.isArray(machineJobTypes) ? machineJobTypes.filter(Boolean) : []),
    [machineJobTypes]
  );
  const safeLots = useMemo(
    () =>
      (Array.isArray(lots) ? lots.filter(Boolean) : []).sort((a, b) =>
        naturalCompare(a.nombre || '', b.nombre || '')
      ),
    [lots]
  );
  const safeJobs = useMemo(
    () => (Array.isArray(jobs) ? jobs.filter(Boolean) : []),
    [jobs]
  );
  const safeExpenses = useMemo(
    () => (Array.isArray(expenses) ? expenses.filter(Boolean) : []),
    [expenses]
  );
  const safeIncomes = useMemo(
    () => (Array.isArray(incomes) ? incomes.filter(Boolean) : []),
    [incomes]
  );
  const safeExchangeRate = useMemo(
    () =>
      exchangeRate && typeof exchangeRate === 'object'
        ? exchangeRate
        : { tasaBobPerUsd: 6.96, fuente: 'manual' as const, fechaActualizacion: '' },
    [exchangeRate]
  );

  // Default campaign id
  const defaultCampaignId = useMemo(() => {
    if (activeCampaign?.id) return String(activeCampaign.id);
    const active = safeCampaigns.find((c) => c.activa);
    if (active?.id) return String(active.id);
    if (safeCampaigns[0]?.id) return String(safeCampaigns[0].id);
    return 'all';
  }, [activeCampaign, safeCampaigns]);

  const [selectedCampaignId, setSelectedCampaignId] = usePersistedMemoryState<string>(
    `reports.${rootMode}.campaignId`,
    defaultCampaignId
  );
  const [activeCurrency, setActiveCurrency] = useState<Currency>('USD');
  const [detailLevel, setDetailLevel] = usePersistedMemoryState<ReportDetailLevel>(
    `reports.${rootMode}.detailLevel`,
    'resumido'
  );
  const [generalTab, setGeneralTab] = usePersistedMemoryState<GeneralScopeTab>(
    `reports.${rootMode}.generalTab`,
    'consolidado'
  );
  const [selectedMachineId, setSelectedMachineId] = usePersistedMemoryState<string>(
    `reports.${rootMode}.machineId`,
    'all'
  );
  const [selectedLotId, setSelectedLotId] = usePersistedMemoryState<string>(
    `reports.${rootMode}.lotId`,
    'all'
  );
  const [expandedReportLotId, setExpandedReportLotId] = useState<string | null>(null);

  // Load harvests & sale distributions (via shared SWR cache) for per-lot physical production & sales metrics
  const cachedHarvestBundle = getCachedQuery<{ sales: HarvestSale[]; harvests: HarvestRecord[] }>(
    cacheKeys.harvestSalesList('all')
  );
  const cachedHarvestList = getCachedQuery<HarvestRecord[]>(cacheKeys.harvestList('all'));
  const [warehouseHarvests, setWarehouseHarvests] = useState<HarvestRecord[]>(() => {
    if (cachedHarvestBundle?.data) {
      return computeHarvestAvailability(
        cachedHarvestBundle.data.harvests,
        cachedHarvestBundle.data.sales
      );
    }
    return cachedHarvestList?.data || [];
  });

  useEffect(() => {
    let cancelled = false;
    const loadPromise = hasAdminAuthorization()
      ? revalidateQuery(
          cacheKeys.harvestSalesList('all'),
          () => fetchNormalizedHarvestSalesBundle(true),
          { force: false, minIntervalMs: 30_000 }
        ).then((bundle) => bundle.harvests)
      : revalidateQuery(
          cacheKeys.harvestList('all'),
          () => getHarvests({ soloPendientes: false }, false),
          { force: false, minIntervalMs: 30_000 }
        );

    loadPromise
      .then((reconciled) => {
        if (cancelled) return;
        setWarehouseHarvests(reconciled);
      })
      .catch(() => {
        // Non-blocking: financial results from Movimientos still render accurately
      });
    return () => {
      cancelled = true;
    };
  }, [safeIncomes.length, safeCampaigns.length]);

  const effectiveCampaignId = useMemo(() => {
    if (selectedCampaignId === 'all') return 'all';
    if (safeCampaigns.some((c) => String(c.id) === String(selectedCampaignId))) {
      return String(selectedCampaignId);
    }
    return defaultCampaignId;
  }, [selectedCampaignId, safeCampaigns, defaultCampaignId]);

  const currentCampaign = useMemo(() => {
    if (effectiveCampaignId === 'all') return null;
    return (
      safeCampaigns.find((c) => String(c.id) === String(effectiveCampaignId)) ||
      activeCampaign ||
      safeCampaigns[0] ||
      null
    );
  }, [safeCampaigns, effectiveCampaignId, activeCampaign]);

  const activeScope: GeneralScopeTab =
    rootMode === 'maquinarias'
      ? 'maquinarias'
      : rootMode === 'propiedad'
      ? 'propiedad'
      : generalTab;

  const toView = (
    amount: number | undefined | null,
    moneda: Currency | string = 'BOB',
    tc?: number
  ) => convertHistoricalAmount(amount, moneda, activeCurrency, tc, safeExchangeRate);

  const fmt = (val: number) => formatCurrencyAmount(val, activeCurrency);

  // Campaign-filtered base records
  const campaignJobs = useMemo(
    () =>
      currentCampaign
        ? safeJobs.filter((j) => matchesCampaignRecord(j, currentCampaign))
        : safeJobs,
    [safeJobs, currentCampaign]
  );

  const campaignExpenses = useMemo(
    () =>
      currentCampaign
        ? safeExpenses.filter((e) => matchesCampaignRecord(e, currentCampaign))
        : safeExpenses,
    [safeExpenses, currentCampaign]
  );

  const campaignIncomes = useMemo(
    () =>
      currentCampaign
        ? safeIncomes.filter((i) => matchesCampaignRecord(i, currentCampaign))
        : safeIncomes,
    [safeIncomes, currentCampaign]
  );

  // Source-campaign harvests (prior-campaign harvests sold later remain attributed to their source campaign)
  const campaignHarvests = useMemo(
    () =>
      currentCampaign
        ? warehouseHarvests.filter((h) => matchesCampaignRecord(h, currentCampaign))
        : warehouseHarvests,
    [warehouseHarvests, currentCampaign]
  );

  // Name resolvers
  const getMachineName = (mId?: string, fallbackName?: string): string => {
    if (mId) {
      const found = safeMachines.find((m) => String(m.id) === String(mId));
      if (found?.nombre) return found.nombre;
    }
    if (fallbackName && fallbackName.trim()) return fallbackName.trim();
    return bi('Máquina sin asignar', 'Unassigned machine');
  };

  const getLotInfo = (lId?: string, fallbackName?: string): { id: string; name: string; ha: number } => {
    if (lId) {
      const found = safeLots.find((l) => String(l.id) === String(lId));
      if (found) {
        const ha = Number(found.superficieHectareas ?? found.superficie ?? 0) || 0;
        return { id: String(found.id), name: found.nombre, ha };
      }
    }
    if (fallbackName && fallbackName.trim()) {
      const byName = safeLots.find(
        (l) => l.nombre.trim().toLowerCase() === fallbackName.trim().toLowerCase()
      );
      if (byName) {
        const ha = Number(byName.superficieHectareas ?? byName.superficie ?? 0) || 0;
        return { id: String(byName.id), name: byName.nombre, ha };
      }
      return { id: `name:${fallbackName.trim()}`, name: fallbackName.trim(), ha: 0 };
    }
    return { id: 'sin_lote', name: bi('General / Sin lote', 'General / No lot'), ha: 0 };
  };

  // ==========================================================================
  // 1. MAQUINARIAS CALCULATIONS (COUNTING EACH JOB ONCE, NO ARTIFICIAL EXPENSE ALLOCATION)
  // ==========================================================================
  const machineryData = useMemo(() => {
    const allMachExpenses = campaignExpenses.filter((e) => e.modulo === 'maquinarias');
    const unassignedMachExpenses = allMachExpenses.filter(
      (e) => !(e.maquinariaId || (e as any).maquinaId)
    );
    const unassignedMachExpensesTotal = unassignedMachExpenses.reduce(
      (sum, e) => sum + toView(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );

    const isFilteredByMachine = activeScope === 'maquinarias' && selectedMachineId !== 'all';

    const scopedJobs = isFilteredByMachine
      ? campaignJobs.filter(
          (j) => String(j.maquinariaId || (j as any).maquinaId || '') === String(selectedMachineId)
        )
      : campaignJobs;

    const scopedExpenses = isFilteredByMachine
      ? allMachExpenses.filter(
          (e) => String(e.maquinariaId || (e as any).maquinaId || '') === String(selectedMachineId)
        )
      : allMachExpenses;

    const propJobs = scopedJobs.filter((j) => j.tipoTrabajo === 'propiedad');
    const extJobs = scopedJobs.filter((j) => j.tipoTrabajo === 'tercero');

    const ingresosPropiedad = propJobs.reduce(
      (sum, j) => sum + toView(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );
    const ingresosTerceros = extJobs.reduce(
      (sum, j) => sum + toView(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );
    const ingresosServicios = ingresosPropiedad + ingresosTerceros;
    const machInterestRows = campaignIncomes.filter((i) => {
      if (!isMachineryInterestIncome(i)) return false;
      if (!isFilteredByMachine) return true;
      const mId = String((i as any).maquinariaId || (i as any).maquinaId || '');
      return mId === String(selectedMachineId);
    });
    const ingresosIntereses = machInterestRows.reduce(
      (sum, i) => sum + toView(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );
    const totalIngresos = ingresosServicios + ingresosIntereses;

    // Breakdown by machine (sums to exact totalIngresos, never duplicated)
    const byMachineMap = new Map<string, GroupedAmountRow>();
    // Breakdown by machine + equipment/labor (sums to exact totalIngresos, counted ONCE)
    const byMachineEquipmentMap = new Map<string, GroupedAmountRow>();

    scopedJobs.forEach((j) => {
      const mId = String(j.maquinariaId || (j as any).maquinaId || 'sin_maquina');
      const mName = getMachineName(mId, j.maquinariaNombre);
      const val = toView(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc);

      const mPrev = byMachineMap.get(mId);
      if (mPrev) {
        mPrev.amount += val;
        mPrev.count += 1;
      } else {
        byMachineMap.set(mId, { key: mId, label: mName, amount: val, count: 1 });
      }

      const rawEquip = cleanConceptLabel(
        j.trabajoNombre || (j as any).trabajo,
        bi('Trabajo directo (sin equipo)', 'Direct job (no implement)')
      );
      const equipKey = `${mId}::${rawEquip.toLowerCase()}`;
      const isSameAsMachine = rawEquip.toLowerCase() === mName.toLowerCase();
      const equipLabel = isSameAsMachine
        ? `${mName} (${bi('directo', 'direct')})`
        : `${mName} · ${rawEquip}`;
      const ePrev = byMachineEquipmentMap.get(equipKey);
      if (ePrev) {
        ePrev.amount += val;
        ePrev.count += 1;
      } else {
        byMachineEquipmentMap.set(equipKey, {
          key: equipKey,
          label: equipLabel,
          sublabel: isSameAsMachine
            ? bi('Solo máquina', 'Machine only')
            : `${bi('Equipo', 'Implement')}: ${rawEquip}`,
          amount: val,
          count: 1,
        });
      }
    });

    const ingresosPorMaquina = Array.from(byMachineMap.values()).sort((a, b) => b.amount - a.amount);
    const ingresosPorMaquinaEquipo = Array.from(byMachineEquipmentMap.values()).sort(
      (a, b) => b.amount - a.amount
    );

    // Expenses grouped by concept
    const expByConceptMap = new Map<string, GroupedAmountRow>();
    scopedExpenses.forEach((e) => {
      const concept = cleanConceptLabel(
        e.itemGasto || (e as any).rubro || (e as any).categoria,
        bi('Otros gastos', 'Other expenses')
      );
      const key = concept.toLowerCase();
      const val = toView(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc);
      const prev = expByConceptMap.get(key);
      if (prev) {
        prev.amount += val;
        prev.count += 1;
      } else {
        expByConceptMap.set(key, { key, label: concept, amount: val, count: 1 });
      }
    });

    const gastosPorConcepto = Array.from(expByConceptMap.values()).sort(
      (a, b) => b.amount - a.amount
    );
    const totalGastos = gastosPorConcepto.reduce((sum, r) => sum + r.amount, 0);

    // Per requirement: do not show individual machine net profit when there are no individualized expenses
    // or when general unallocated expenses exist that would distort individual profitability.
    const hasIndividualizedExpenses = scopedExpenses.length > 0 && totalGastos > 0.004;
    const canShowNetResult =
      !isFilteredByMachine || (hasIndividualizedExpenses && unassignedMachExpenses.length === 0);

    return {
      isFilteredByMachine,
      selectedMachineName: isFilteredByMachine ? getMachineName(selectedMachineId) : null,
      ingresosPropiedad,
      ingresosTerceros,
      ingresosServicios,
      ingresosIntereses,
      interesesCount: machInterestRows.length,
      extJobsCount: extJobs.length,
      propJobsCount: propJobs.length,
      totalIngresos,
      ingresosPorMaquina,
      ingresosPorMaquinaEquipo,
      gastosPorConcepto,
      totalGastos,
      resultadoNeto: totalIngresos - totalGastos,
      canShowNetResult,
      hasIndividualizedExpenses,
      unassignedMachExpensesTotal,
      unassignedMachExpensesCount: unassignedMachExpenses.length,
    };
  }, [
    campaignJobs,
    campaignExpenses,
    campaignIncomes,
    activeScope,
    selectedMachineId,
    activeCurrency,
    safeExchangeRate,
    safeMachines,
    lang,
  ]);

  // ==========================================================================
  // 2. PROPIEDAD CALCULATIONS (BY LOT SORTED BY NAME/NUMBER, PER-HECTARE METRICS)
  // ==========================================================================
  const propertyData = useMemo(() => {
    const directIncomes = campaignIncomes.filter(isDirectPropertyIncome);
    const interestIncomes = campaignIncomes.filter(isPropertyInterestIncome);
    const directExpenses = campaignExpenses.filter(
      (e) => e.modulo === 'propiedad' && !isInternalMachineryJobExpense(e)
    );
    const internalJobs = campaignJobs.filter((j) => j.tipoTrabajo === 'propiedad');

    const isFilteredByLot = activeScope === 'propiedad' && selectedLotId !== 'all';

    // Build per-lot map starting with registered lots so empty lots can still be selected cleanly
    const lotMap = new Map<
      string,
      {
        lotId: string;
        lotName: string;
        hectares: number;
        toneladasCosechadas: number;
        toneladasVendidas: number;
        toneladasDisponibles: number;
        ingresosCosechas: number;
        ingresosIntereses: number;
        ingresos: number;
        gastosDirectos: number;
        gastosMaquinaria: number;
        directosByConcept: Map<string, GroupedAmountRow>;
        maquinariaByLabor: Map<string, GroupedAmountRow>;
        ingresosByConcept: Map<string, GroupedAmountRow>;
      }
    >();

    const ensureLot = (lId?: string, fallbackName?: string) => {
      const info = getLotInfo(lId, fallbackName);
      let entry = lotMap.get(info.id);
      if (!entry) {
        entry = {
          lotId: info.id,
          lotName: info.name,
          hectares: info.ha,
          toneladasCosechadas: 0,
          toneladasVendidas: 0,
          toneladasDisponibles: 0,
          ingresosCosechas: 0,
          ingresosIntereses: 0,
          ingresos: 0,
          gastosDirectos: 0,
          gastosMaquinaria: 0,
          directosByConcept: new Map(),
          maquinariaByLabor: new Map(),
          ingresosByConcept: new Map(),
        };
        lotMap.set(info.id, entry);
      }
      return entry;
    };

    // Pre-populate registered lots so sorting and filtering work consistently
    safeLots.forEach((l) => {
      ensureLot(String(l.id), l.nombre);
    });

    // Aggregate physical production & distribution-reconciled sold/available quantities per source lot
    campaignHarvests.forEach((h) => {
      const entry = ensureLot(h.loteId, h.loteNombre);
      entry.toneladasCosechadas = roundTons(entry.toneladasCosechadas + (Number(h.toneladas) || 0));
      entry.toneladasVendidas = roundTons(entry.toneladasVendidas + (Number(h.asignadas) || 0));
      entry.toneladasDisponibles = roundTons(entry.toneladasDisponibles + (Number(h.pendiente) || 0));
    });

    directIncomes.forEach((inc) => {
      const entry = ensureLot(inc.loteId, inc.loteNombre);
      const val = toView(Number(inc.total) || 0, inc.moneda, inc.tipoCambio || inc.tc);
      entry.ingresosCosechas += val;
      entry.ingresos += val;
      const concept = cleanConceptLabel(inc.concepto || (inc as any).rubro, bi('Venta agrícola', 'Farm sale'));
      const key = concept.toLowerCase();
      const prev = entry.ingresosByConcept.get(key);
      if (prev) {
        prev.amount += val;
        prev.count += 1;
      } else {
        entry.ingresosByConcept.set(key, { key, label: concept, amount: val, count: 1 });
      }
    });

    interestIncomes.forEach((inc) => {
      const entry = ensureLot(inc.loteId, inc.loteNombre);
      const val = toView(Number(inc.total) || 0, inc.moneda, inc.tipoCambio || inc.tc);
      entry.ingresosIntereses += val;
      entry.ingresos += val;
      const concept = t('finances.lateInterestConcept');
      const key = 'sys_interes_mora';
      const prev = entry.ingresosByConcept.get(key);
      if (prev) {
        prev.amount += val;
        prev.count += 1;
      } else {
        entry.ingresosByConcept.set(key, { key, label: concept, amount: val, count: 1 });
      }
    });

    directExpenses.forEach((exp) => {
      const entry = ensureLot(exp.loteId, exp.loteNombre);
      const val = toView(Number(exp.total) || 0, exp.moneda, exp.tipoCambio || exp.tc);
      entry.gastosDirectos += val;
      const concept = cleanConceptLabel(
        exp.itemGasto || (exp as any).rubro || (exp as any).categoria,
        bi('Gasto directo', 'Direct expense')
      );
      const key = concept.toLowerCase();
      const prev = entry.directosByConcept.get(key);
      if (prev) {
        prev.amount += val;
        prev.count += 1;
      } else {
        entry.directosByConcept.set(key, { key, label: concept, amount: val, count: 1 });
      }
    });

    internalJobs.forEach((job) => {
      const entry = ensureLot(job.loteId, job.loteNombre);
      const val = toView(Number(job.total) || 0, job.moneda, job.tipoCambio || job.tc);
      entry.gastosMaquinaria += val;
      const labor = resolveJobDisplay(job, safeMachines, safeMachineJobTypes, lang).title;
      const key = labor.toLowerCase();
      const prev = entry.maquinariaByLabor.get(key);
      if (prev) {
        prev.amount += val;
        prev.count += 1;
      } else {
        entry.maquinariaByLabor.set(key, { key, label: labor, amount: val, count: 1 });
      }
    });

    const allLotResults: LotDetailedResult[] = Array.from(lotMap.values())
      .filter((entry) => {
        if (isFilteredByLot) {
          return String(entry.lotId) === String(selectedLotId);
        }
        const isRegistered = safeLots.some((l) => String(l.id) === String(entry.lotId));
        const hasActivity =
          entry.toneladasCosechadas > 0.0001 ||
          entry.ingresos > 0.004 ||
          entry.gastosDirectos > 0.004 ||
          entry.gastosMaquinaria > 0.004;
        return isRegistered || hasActivity;
      })
      .map((entry) => {
        const gastosTotales = entry.gastosDirectos + entry.gastosMaquinaria;
        const resultadoNeto = entry.ingresos - gastosTotales;
        const ingresoPorHa = entry.hectares > 0 ? entry.ingresos / entry.hectares : null;
        const gastoPorHa = entry.hectares > 0 ? gastosTotales / entry.hectares : null;
        const utilidadPorHa = entry.hectares > 0 ? resultadoNeto / entry.hectares : null;
        const porcentajeVendido =
          entry.toneladasCosechadas > 0.0001
            ? Math.min(100, roundPct2((entry.toneladasVendidas / entry.toneladasCosechadas) * 100))
            : 0;
        return {
          lotId: entry.lotId,
          lotName: entry.lotName,
          hectares: entry.hectares,
          toneladasCosechadas: entry.toneladasCosechadas,
          toneladasVendidas: entry.toneladasVendidas,
          toneladasDisponibles: entry.toneladasDisponibles,
          porcentajeVendido,
          ingresosCosechas: entry.ingresosCosechas,
          ingresosIntereses: entry.ingresosIntereses,
          ingresos: entry.ingresos,
          gastosDirectos: entry.gastosDirectos,
          gastosMaquinaria: entry.gastosMaquinaria,
          gastosTotales,
          resultadoNeto,
          ingresoPorHa,
          gastoPorHa,
          utilidadPorHa,
          gastosDirectosPorConcepto: Array.from(entry.directosByConcept.values()).sort(
            (a, b) => b.amount - a.amount
          ),
          trabajosMaquinariaPorLabor: Array.from(entry.maquinariaByLabor.values()).sort(
            (a, b) => b.amount - a.amount
          ),
          ingresosPorConcepto: Array.from(entry.ingresosByConcept.values()).sort(
            (a, b) => b.amount - a.amount
          ),
        };
      })
      .sort((a, b) => {
        if (a.lotId === 'sin_lote') return 1;
        if (b.lotId === 'sin_lote') return -1;
        return naturalCompare(a.lotName, b.lotName);
      });

    const totalToneladasCosechadas = roundTons(allLotResults.reduce((sum, l) => sum + l.toneladasCosechadas, 0));
    const totalToneladasVendidas = roundTons(allLotResults.reduce((sum, l) => sum + l.toneladasVendidas, 0));
    const totalToneladasDisponibles = roundTons(allLotResults.reduce((sum, l) => sum + l.toneladasDisponibles, 0));
    const totalPorcentajeVendido =
      totalToneladasCosechadas > 0.0001
        ? Math.min(100, roundPct2((totalToneladasVendidas / totalToneladasCosechadas) * 100))
        : 0;

    const totalIngresosCosechas = allLotResults.reduce((sum, l) => sum + l.ingresosCosechas, 0);
    const totalIngresosIntereses = allLotResults.reduce((sum, l) => sum + l.ingresosIntereses, 0);
    const totalIngresos = totalIngresosCosechas + totalIngresosIntereses;
    const totalGastosDirectos = allLotResults.reduce((sum, l) => sum + l.gastosDirectos, 0);
    const totalGastosMaquinaria = allLotResults.reduce((sum, l) => sum + l.gastosMaquinaria, 0);
    const totalGastos = totalGastosDirectos + totalGastosMaquinaria;
    const resultadoNeto = totalIngresos - totalGastos;
    const totalHectares = allLotResults.reduce((sum, l) => sum + l.hectares, 0);

    // Aggregated direct expenses by concept across selected lots
    const aggDirectExp = new Map<string, GroupedAmountRow>();
    allLotResults.forEach((lot) => {
      lot.gastosDirectosPorConcepto.forEach((row) => {
        const prev = aggDirectExp.get(row.key);
        if (prev) {
          prev.amount += row.amount;
          prev.count += row.count;
        } else {
          aggDirectExp.set(row.key, { ...row });
        }
      });
    });

    const aggMachLabor = new Map<string, GroupedAmountRow>();
    allLotResults.forEach((lot) => {
      lot.trabajosMaquinariaPorLabor.forEach((row) => {
        const prev = aggMachLabor.get(row.key);
        if (prev) {
          prev.amount += row.amount;
          prev.count += row.count;
        } else {
          aggMachLabor.set(row.key, { ...row });
        }
      });
    });

    return {
      isFilteredByLot,
      selectedLotName: isFilteredByLot ? getLotInfo(selectedLotId).name : null,
      lotResults: allLotResults,
      totalToneladasCosechadas,
      totalToneladasVendidas,
      totalToneladasDisponibles,
      totalPorcentajeVendido,
      totalIngresosCosechas,
      totalIngresosIntereses,
      totalIngresos,
      totalGastosDirectos,
      totalGastosMaquinaria,
      totalGastos,
      resultadoNeto,
      totalHectares,
      ingresoPorHaGlobal: totalHectares > 0 ? totalIngresos / totalHectares : null,
      gastoPorHaGlobal: totalHectares > 0 ? totalGastos / totalHectares : null,
      utilidadPorHaGlobal: totalHectares > 0 ? resultadoNeto / totalHectares : null,
      gastosDirectosPorConcepto: Array.from(aggDirectExp.values()).sort(
        (a, b) => b.amount - a.amount
      ),
      trabajosMaquinariaPorLabor: Array.from(aggMachLabor.values()).sort(
        (a, b) => b.amount - a.amount
      ),
    };
  }, [
    campaignIncomes,
    campaignExpenses,
    campaignJobs,
    campaignHarvests,
    safeLots,
    safeMachines,
    safeMachineJobTypes,
    activeScope,
    selectedLotId,
    activeCurrency,
    safeExchangeRate,
    lang,
  ]);

  // ==========================================================================
  // 3. CONSOLIDADO GENERAL (STRICT INTERNAL OPERATION ELIMINATION & RECONCILIATION)
  // ==========================================================================
  const consolidatedData = useMemo(() => {
    // Full campaign totals for each module (unfiltered)
    const extJobs = campaignJobs.filter((j) => j.tipoTrabajo === 'tercero');
    const internalJobs = campaignJobs.filter((j) => j.tipoTrabajo === 'propiedad');
    const machExpenses = campaignExpenses.filter((e) => e.modulo === 'maquinarias');

    const propIncomes = campaignIncomes.filter(isDirectPropertyIncome);
    const machInterestIncomes = campaignIncomes.filter(isMachineryInterestIncome);
    const propInterestIncomes = campaignIncomes.filter(isPropertyInterestIncome);
    const propDirectExpenses = campaignExpenses.filter(
      (e) => e.modulo === 'propiedad' && !isInternalMachineryJobExpense(e)
    );

    const machIngresosExternos = extJobs.reduce(
      (s, j) => s + toView(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );
    const operacionesInternas = internalJobs.reduce(
      (s, j) => s + toView(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc),
      0
    );
    const machIngresosIntereses = machInterestIncomes.reduce(
      (s, i) => s + toView(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );
    const machIngresosTotales = machIngresosExternos + operacionesInternas + machIngresosIntereses;
    const machGastosTotales = machExpenses.reduce(
      (s, e) => s + toView(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );
    const machResultado = machIngresosTotales - machGastosTotales;

    const propIngresosCosechas = propIncomes.reduce(
      (s, i) => s + toView(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );
    const propIngresosIntereses = propInterestIncomes.reduce(
      (s, i) => s + toView(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );
    const propIngresosTotales = propIngresosCosechas + propIngresosIntereses;
    const propGastosDirectos = propDirectExpenses.reduce(
      (s, e) => s + toView(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );
    const propGastosTotales = propGastosDirectos + operacionesInternas;
    const propResultado = propIngresosTotales - propGastosTotales;

    const ingresosInteresesTotales = machIngresosIntereses + propIngresosIntereses;
    // Consolidated frente a terceros (eliminating both sides of internal jobs)
    const ingresosConsolidados = machIngresosExternos + propIngresosCosechas + ingresosInteresesTotales;
    const gastosConsolidados = machGastosTotales + propGastosDirectos;
    const resultadoConsolidado = ingresosConsolidados - gastosConsolidados;

    // Reconciliation check: machResultado + propResultado MUST equal resultadoConsolidado
    const sumaResultadosModulos = machResultado + propResultado;
    const diferenciaConciliacion = Math.abs(sumaResultadosModulos - resultadoConsolidado);
    const conciliacionExacta = diferenciaConciliacion < 0.01;

    // Detailed groupings for Consolidated Detallado
    const groupExpenses = (list: Expense[]): GroupedAmountRow[] => {
      const m = new Map<string, GroupedAmountRow>();
      list.forEach((e) => {
        const label = cleanConceptLabel(
          e.itemGasto || (e as any).rubro || (e as any).categoria,
          bi('Otros gastos', 'Other expenses')
        );
        const key = label.toLowerCase();
        const val = toView(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc);
        const prev = m.get(key);
        if (prev) {
          prev.amount += val;
          prev.count += 1;
        } else {
          m.set(key, { key, label, amount: val, count: 1 });
        }
      });
      return Array.from(m.values()).sort((a, b) => b.amount - a.amount);
    };

    const ingresosPropPorLoteMap = new Map<string, GroupedAmountRow>();
    propIncomes.forEach((i) => {
      const info = getLotInfo(i.loteId, i.loteNombre);
      const val = toView(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc);
      const prev = ingresosPropPorLoteMap.get(info.id);
      if (prev) {
        prev.amount += val;
        prev.count += 1;
      } else {
        ingresosPropPorLoteMap.set(info.id, {
          key: info.id,
          label: info.name,
          amount: val,
          count: 1,
        });
      }
    });

    const ingresosExtPorMaquinaMap = new Map<string, GroupedAmountRow>();
    extJobs.forEach((j) => {
      const mId = String(j.maquinariaId || (j as any).maquinaId || 'sin_maquina');
      const mName = getMachineName(mId, j.maquinariaNombre);
      const val = toView(Number(j.total) || 0, j.moneda, j.tipoCambio || j.tc);
      const prev = ingresosExtPorMaquinaMap.get(mId);
      if (prev) {
        prev.amount += val;
        prev.count += 1;
      } else {
        ingresosExtPorMaquinaMap.set(mId, { key: mId, label: mName, amount: val, count: 1 });
      }
    });

    return {
      machIngresosExternos,
      machIngresosIntereses,
      operacionesInternas,
      operacionesInternasCount: internalJobs.length,
      machIngresosTotales,
      machGastosTotales,
      machResultado,
      propIngresosCosechas,
      propIngresosIntereses,
      propIngresosTotales,
      propGastosDirectos,
      propGastosTotales,
      propResultado,
      ingresosInteresesTotales,
      ingresosConsolidados,
      gastosConsolidados,
      resultadoConsolidado,
      sumaResultadosModulos,
      conciliacionExacta,
      gastosMaqPorConcepto: groupExpenses(machExpenses),
      gastosPropPorConcepto: groupExpenses(propDirectExpenses),
      ingresosPropPorLote: Array.from(ingresosPropPorLoteMap.values()).sort((a, b) =>
        naturalCompare(a.label, b.label)
      ),
      ingresosExtPorMaquina: Array.from(ingresosExtPorMaquinaMap.values()).sort(
        (a, b) => b.amount - a.amount
      ),
    };
  }, [campaignJobs, campaignExpenses, campaignIncomes, activeCurrency, safeExchangeRate, safeLots, safeMachines, lang]);

  // ==========================================================================
  // PRINT & EXCEL HEADERS (NO LOGO, NO COMPANY NAME)
  // ==========================================================================
  const reportHeaderTitle =
    rootMode === 'maquinarias'
      ? t('nav.machinery')
      : rootMode === 'propiedad'
      ? t('nav.property')
      : t('reports.title');

  const reportTypeDescription = useMemo(() => {
    const levelText =
      detailLevel === 'resumido'
        ? bi('Resumido', 'Summary')
        : bi('Detallado', 'Detailed');
    if (rootMode === 'general') {
      const scopeText =
        generalTab === 'consolidado'
          ? bi('Consolidado general', 'General consolidated')
          : generalTab === 'maquinarias'
          ? t('nav.machinery')
          : t('nav.property');
      return `${scopeText} · ${levelText}`;
    }
    if (rootMode === 'maquinarias' && selectedMachineId !== 'all') {
      return `${levelText} · ${machineryData.selectedMachineName || t('common.machine')}`;
    }
    if (rootMode === 'propiedad' && selectedLotId !== 'all') {
      return `${levelText} · ${propertyData.selectedLotName || t('common.lot')}`;
    }
    return levelText;
  }, [
    detailLevel,
    rootMode,
    generalTab,
    selectedMachineId,
    selectedLotId,
    machineryData.selectedMachineName,
    propertyData.selectedLotName,
    bi,
    t,
  ]);

  const campaignLabel = currentCampaign?.nombre || bi('Todas las campañas', 'All campaigns');
  const printDateStr = formatDateDDMMAAAA(getBoliviaDateString(new Date()));
  const currencyLabel = activeCurrency === 'USD' ? 'USD' : 'Bs';

  const handlePrint = () => {
    window.print();
  };

  // ==========================================================================
  // EXCEL EXPORT — EXACT MATCH WITH ACTIVE SCREEN & GROUPINGS
  // ==========================================================================
  const handleExportExcel = () => {
    const rows: (string | number)[][] = [
      [reportHeaderTitle],
      [`${t('common.campaign')}: ${campaignLabel}`],
      [`${bi('Tipo de reporte', 'Report type')}: ${reportTypeDescription}`],
      [`${t('common.currency')}: ${currencyLabel}`],
      [`${bi('Fecha de emisión', 'Issue date')}: ${printDateStr}`],
      [],
    ];

    if (activeScope === 'maquinarias') {
      if (detailLevel === 'resumido') {
        rows.push([t('common.concept'), `${t('common.amount')} (${currencyLabel})`]);
        rows.push([t('finances.serviceIncome'), Number(machineryData.ingresosServicios.toFixed(2))]);
        if (machineryData.ingresosIntereses > 0.004) {
          rows.push([t('finances.interestIncome'), Number(machineryData.ingresosIntereses.toFixed(2))]);
        }
        rows.push([bi('Total de ingresos', 'Total income'), Number(machineryData.totalIngresos.toFixed(2))]);
        rows.push([bi('Total de gastos', 'Total expenses'), Number(machineryData.totalGastos.toFixed(2))]);
        if (machineryData.canShowNetResult) {
          rows.push([t('reports.netResult'), Number(machineryData.resultadoNeto.toFixed(2))]);
        } else {
          rows.push([
            bi('Nota', 'Note'),
            bi(
              'Los gastos generales no se atribuyen a una máquina individual.',
              'General expenses are not attributed to an individual machine.'
            ),
          ]);
        }
      } else {
        rows.push([bi('Sección', 'Section'), t('common.concept'), `${t('common.amount')} (${currencyLabel})`]);
        rows.push([t('reports.incomes'), bi('Trabajos para propiedad propia', 'Own property jobs'), Number(machineryData.ingresosPropiedad.toFixed(2))]);
        rows.push([t('reports.incomes'), bi('Servicios para clientes externos', 'External client services'), Number(machineryData.ingresosTerceros.toFixed(2))]);
        if (machineryData.ingresosIntereses > 0.004) {
          rows.push([t('reports.incomes'), t('finances.interestIncome'), Number(machineryData.ingresosIntereses.toFixed(2))]);
        }
        rows.push([t('reports.incomes'), bi('Total de ingresos', 'Total income'), Number(machineryData.totalIngresos.toFixed(2))]);
        rows.push([]);
        rows.push([
          bi(
            'Desglose por máquina e implemento agrícola (contabilizado una sola vez)',
            'Breakdown by machine & implement (counted once)'
          ),
          t('common.detail'),
          `${t('common.amount')} (${currencyLabel})`,
        ]);
        machineryData.ingresosPorMaquinaEquipo.forEach((r) => {
          rows.push([bi('Máquina / Implemento', 'Machine / Implement'), r.label, Number(r.amount.toFixed(2))]);
        });
        rows.push([]);
        rows.push([bi('Gastos por concepto', 'Expenses by concept'), t('common.concept'), `${t('common.amount')} (${currencyLabel})`]);
        machineryData.gastosPorConcepto.forEach((r) => {
          rows.push([t('reports.expenses'), r.label, Number(r.amount.toFixed(2))]);
        });
        rows.push([t('reports.expenses'), bi('Total de gastos', 'Total expenses'), Number(machineryData.totalGastos.toFixed(2))]);
        if (machineryData.canShowNetResult) {
          rows.push([]);
          rows.push([bi('Resultado', 'Result'), t('reports.netResult'), Number(machineryData.resultadoNeto.toFixed(2))]);
        }
      }
    } else if (activeScope === 'propiedad') {
      if (detailLevel === 'resumido') {
        rows.push([t('common.concept'), `${t('common.amount')} (${currencyLabel})`]);
        rows.push([t('finances.harvestIncome'), Number(propertyData.totalIngresosCosechas.toFixed(2))]);
        if (propertyData.totalIngresosIntereses > 0.004) {
          rows.push([t('finances.interestIncome'), Number(propertyData.totalIngresosIntereses.toFixed(2))]);
        }
        rows.push([bi('Total de ingresos', 'Total income'), Number(propertyData.totalIngresos.toFixed(2))]);
        rows.push([bi('Gastos directos', 'Direct expenses'), Number(propertyData.totalGastosDirectos.toFixed(2))]);
        rows.push([bi('Gastos por maquinaria recibida', 'Machinery received expenses'), Number(propertyData.totalGastosMaquinaria.toFixed(2))]);
        rows.push([bi('Gastos totales', 'Total expenses'), Number(propertyData.totalGastos.toFixed(2))]);
        rows.push([t('reports.netResult'), Number(propertyData.resultadoNeto.toFixed(2))]);
      } else {
        rows.push([
          t('common.lot'),
          bi('Superficie (ha)', 'Area (ha)'),
          bi('Cosechado (t)', 'Harvested (t)'),
          bi('Vendido (t)', 'Sold (t)'),
          bi('% vendido', '% sold'),
          bi('Disponible (t)', 'Available (t)'),
          `${t('reports.incomes')} (${currencyLabel})`,
          `${bi('Gastos directos', 'Direct expenses')} (${currencyLabel})`,
          `${bi('Maquinaria recibida', 'Machinery received')} (${currencyLabel})`,
          `${bi('Gasto total', 'Total expense')} (${currencyLabel})`,
          `${t('reports.netResult')} (${currencyLabel})`,
          `${bi('Ingreso/ha', 'Income/ha')} (${currencyLabel})`,
          `${bi('Gasto/ha', 'Expense/ha')} (${currencyLabel})`,
          `${bi('Resultado/ha', 'Result/ha')} (${currencyLabel})`,
        ]);
        propertyData.lotResults.forEach((lot) => {
          rows.push([
            lot.lotName,
            Number(lot.hectares.toFixed(2)),
            Number(lot.toneladasCosechadas.toFixed(2)),
            Number(lot.toneladasVendidas.toFixed(2)),
            Number(lot.porcentajeVendido.toFixed(1)),
            Number(lot.toneladasDisponibles.toFixed(2)),
            Number(lot.ingresos.toFixed(2)),
            Number(lot.gastosDirectos.toFixed(2)),
            Number(lot.gastosMaquinaria.toFixed(2)),
            Number(lot.gastosTotales.toFixed(2)),
            Number(lot.resultadoNeto.toFixed(2)),
            lot.ingresoPorHa !== null ? Number(lot.ingresoPorHa.toFixed(2)) : '—',
            lot.gastoPorHa !== null ? Number(lot.gastoPorHa.toFixed(2)) : '—',
            lot.utilidadPorHa !== null ? Number(lot.utilidadPorHa.toFixed(2)) : '—',
          ]);
        });
        rows.push([
          'TOTAL',
          Number(propertyData.totalHectares.toFixed(2)),
          Number(propertyData.totalToneladasCosechadas.toFixed(2)),
          Number(propertyData.totalToneladasVendidas.toFixed(2)),
          Number(propertyData.totalPorcentajeVendido.toFixed(1)),
          Number(propertyData.totalToneladasDisponibles.toFixed(2)),
          Number(propertyData.totalIngresos.toFixed(2)),
          Number(propertyData.totalGastosDirectos.toFixed(2)),
          Number(propertyData.totalGastosMaquinaria.toFixed(2)),
          Number(propertyData.totalGastos.toFixed(2)),
          Number(propertyData.resultadoNeto.toFixed(2)),
          propertyData.ingresoPorHaGlobal !== null ? Number(propertyData.ingresoPorHaGlobal.toFixed(2)) : '—',
          propertyData.gastoPorHaGlobal !== null ? Number(propertyData.gastoPorHaGlobal.toFixed(2)) : '—',
          propertyData.utilidadPorHaGlobal !== null ? Number(propertyData.utilidadPorHaGlobal.toFixed(2)) : '—',
        ]);
        rows.push([]);
        rows.push([bi('Gastos directos por concepto', 'Direct expenses by concept'), `${t('common.amount')} (${currencyLabel})`]);
        propertyData.gastosDirectosPorConcepto.forEach((r) => {
          rows.push([r.label, Number(r.amount.toFixed(2))]);
        });
        rows.push([]);
        rows.push([bi('Trabajos de maquinaria recibidos', 'Machinery jobs received'), `${t('common.amount')} (${currencyLabel})`]);
        propertyData.trabajosMaquinariaPorLabor.forEach((r) => {
          rows.push([r.label, Number(r.amount.toFixed(2))]);
        });
      }
    } else {
      rows.push([
        bi('Módulo / Concepto', 'Module / Concept'),
        `${t('reports.incomes')} (${currencyLabel})`,
        `${t('reports.expenses')} (${currencyLabel})`,
        `${t('reports.netResult')} (${currencyLabel})`,
      ]);
      rows.push([
        t('nav.machinery'),
        Number(consolidatedData.machIngresosTotales.toFixed(2)),
        Number(consolidatedData.machGastosTotales.toFixed(2)),
        Number(consolidatedData.machResultado.toFixed(2)),
      ]);
      rows.push([
        t('nav.property'),
        Number(consolidatedData.propIngresosTotales.toFixed(2)),
        Number(consolidatedData.propGastosTotales.toFixed(2)),
        Number(consolidatedData.propResultado.toFixed(2)),
      ]);
      rows.push([
        bi('CONSOLIDADO GENERAL', 'GENERAL CONSOLIDATED'),
        Number(consolidatedData.ingresosConsolidados.toFixed(2)),
        Number(consolidatedData.gastosConsolidados.toFixed(2)),
        Number(consolidatedData.resultadoConsolidado.toFixed(2)),
      ]);

      if (detailLevel === 'detallado') {
        rows.push([]);
        rows.push([
          bi('Detalle consolidado — Ingresos', 'Consolidated detail — Income'),
          `${t('common.amount')} (${currencyLabel})`,
        ]);
        consolidatedData.ingresosExtPorMaquina.forEach((r) => {
          rows.push([`${t('nav.machinery')} · ${r.label}`, Number(r.amount.toFixed(2))]);
        });
        consolidatedData.ingresosPropPorLote.forEach((r) => {
          rows.push([`${t('nav.property')} · ${r.label}`, Number(r.amount.toFixed(2))]);
        });
        if (consolidatedData.machIngresosIntereses > 0.004) {
          rows.push([`${t('nav.machinery')} · ${t('finances.interestIncome')}`, Number(consolidatedData.machIngresosIntereses.toFixed(2))]);
        }
        if (consolidatedData.propIngresosIntereses > 0.004) {
          rows.push([`${t('nav.property')} · ${t('finances.interestIncome')}`, Number(consolidatedData.propIngresosIntereses.toFixed(2))]);
        }
        rows.push([
          bi('Total ingresos consolidados', 'Total consolidated income'),
          Number(consolidatedData.ingresosConsolidados.toFixed(2)),
        ]);

        rows.push([]);
        rows.push([
          bi('Detalle consolidado — Gastos', 'Consolidated detail — Expenses'),
          `${t('common.amount')} (${currencyLabel})`,
        ]);
        consolidatedData.gastosMaqPorConcepto.forEach((r) => {
          rows.push([`${t('nav.machinery')} · ${r.label}`, Number(r.amount.toFixed(2))]);
        });
        consolidatedData.gastosPropPorConcepto.forEach((r) => {
          rows.push([`${t('nav.property')} · ${r.label}`, Number(r.amount.toFixed(2))]);
        });
        rows.push([
          bi('Total gastos consolidados', 'Total consolidated expenses'),
          Number(consolidatedData.gastosConsolidados.toFixed(2)),
        ]);
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 36 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, bi('Reporte', 'Report'));
    const safeName = `${reportHeaderTitle}_${campaignLabel}_${detailLevel}`
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .toLowerCase();
    XLSX.writeFile(wb, `${safeName}.xlsx`);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="print-report-root w-full max-w-4xl mx-auto space-y-3.5">
      {/* PRINT-ONLY SIMPLE BLACK & WHITE HEADER */}
      <div className="hidden print-only border-b-2 border-black pb-2 mb-4">
        <h1 className="text-lg font-bold text-black">{reportHeaderTitle}</h1>
        <div className="text-xs text-black mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
          <span>{t('common.campaign')}: {campaignLabel}</span>
          <span>{t('common.type')}: {reportTypeDescription}</span>
          <span>{t('common.currency')}: {currencyLabel}</span>
          <span>{bi('Fecha de impresión', 'Print date')}: {printDateStr}</span>
        </div>
      </div>

      {/* COMPACT SCREEN HEADER */}
      <div className="no-print flex items-center justify-between gap-2 pb-2 border-b border-[#E2E7E3]">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={onRootBackLabel || t('common.back')}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-[#DCE2DD] text-[#26352D] hover:bg-[#F5F7F4] active:scale-95 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-[#26352D]" />
            </button>
          )}
          <h2 className="text-base sm:text-lg font-bold text-[#26352D] tracking-tight leading-tight">
            {reportHeaderTitle}
          </h2>
        </div>

        {/* Icon-only Print & Excel Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            aria-label={bi('Imprimir reporte', 'Print report')}
            title={bi('Imprimir reporte', 'Print report')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white hover:bg-[#F5F7F4] text-[#26352D] transition cursor-pointer"
          >
            <Printer className="h-4 w-4 text-[#526058]" />
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            aria-label={bi('Exportar a Excel', 'Export to Excel')}
            title={bi('Exportar a Excel', 'Export to Excel')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white hover:bg-[#F5F7F4] text-[#24875B] transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* COMPACT 3-ROW MOBILE-FIRST FILTERS */}
      <div className="no-print space-y-2">
        {/* Row 1: General | Maquinarias | Propiedad */}
        {rootMode === 'general' && (
          <SlidingSelector<GeneralScopeTab>
            value={generalTab}
            onChange={(val) => setGeneralTab(val)}
            ariaLabel={bi('Sección del reporte', 'Report section')}
            options={[
              {
                value: 'consolidado',
                label: bi('General', 'General'),
                icon: <BarChart3 className="h-3.5 w-3.5" />,
              },
              {
                value: 'maquinarias',
                label: t('reports.tab.machinery'),
                icon: <Tractor className="h-3.5 w-3.5" />,
              },
              {
                value: 'propiedad',
                label: t('reports.tab.property'),
                icon: <Sprout className="h-3.5 w-3.5" />,
              },
            ]}
          />
        )}

        {/* Row 2: Campaign / Gestión dropdown | USD/Bs Switch (2 equal columns) */}
        <div className="grid grid-cols-2 gap-2 items-center">
          <div className="relative w-full min-w-0">
            <Calendar
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#526058]"
              aria-hidden="true"
            />
            <select
              value={effectiveCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              aria-label={t('common.campaign')}
              className="w-full h-9 appearance-none rounded-xl border border-[#DCE3DF] bg-[#F8FAF8] pl-7 pr-6 text-xs sm:text-[13px] font-semibold text-[#26352D] truncate focus:border-[#24875B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#24875B]/20 cursor-pointer transition-colors"
            >
              {safeCampaigns.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.activa ? `${c.nombre} (${t('common.activeFem')})` : c.nombre}
                </option>
              ))}
              {(safeCampaigns.length > 1 || effectiveCampaignId === 'all' || safeCampaigns.length === 0) && (
                <option value="all">{bi('Todas las campañas', 'All campaigns')}</option>
              )}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64746B]"
              aria-hidden="true"
            />
          </div>

          <Switch<Currency>
            size="sm"
            value={activeCurrency}
            onChange={(val) => setActiveCurrency(val)}
            ariaLabel={t('common.currency')}
            leftOption={{ value: 'USD', label: 'USD' }}
            rightOption={{ value: 'BOB', label: 'Bs' }}
          />
        </div>

        {/* Row 3: Resumen | Detallado */}
        <SlidingSelector<ReportDetailLevel>
          value={detailLevel}
          onChange={(val) => setDetailLevel(val)}
          ariaLabel={bi('Nivel de detalle', 'Detail level')}
          options={[
            {
              value: 'resumido',
              label: bi('Resumen', 'Summary'),
              icon: <FileText className="h-3.5 w-3.5" />,
            },
            {
              value: 'detallado',
              label: bi('Detallado', 'Detailed'),
              icon: <List className="h-3.5 w-3.5" />,
            },
          ]}
        />

        {/* Secondary entity filter when viewing Maquinarias or Propiedad */}
        {activeScope === 'maquinarias' && (
          <CompactFilter
            value={selectedMachineId}
            onChange={(val) => setSelectedMachineId(val)}
            ariaLabel={bi('Filtrar por máquina', 'Filter by machine')}
            className="w-full"
            options={[
              { value: 'all', label: t('picker.machineAll') },
              ...safeMachines.map((m) => ({
                value: String(m.id),
                label: m.nombre,
              })),
            ]}
          />
        )}

        {activeScope === 'propiedad' && (
          <CompactFilter
            value={selectedLotId}
            onChange={(val) => setSelectedLotId(val)}
            ariaLabel={bi('Filtrar por lote', 'Filter by lot')}
            className="w-full"
            options={[
              { value: 'all', label: t('picker.lotAll') },
              ...safeLots.map((l) => ({
                value: String(l.id),
                label: l.nombre,
              })),
            ]}
          />
        )}
      </div>

      {/* ==================================================================== */}
      {/* VIEW A: MAQUINARIAS — RESUMIDO Y DETALLADO                           */}
      {/* ==================================================================== */}
      {activeScope === 'maquinarias' && (
        <div className="space-y-3">
          {detailLevel === 'resumido' ? (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden divide-y divide-[#EFF2EF]">
              {machineryData.ingresosIntereses > 0.004 && (
                <>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="text-[#5E6D64]">{t('finances.serviceIncome')}</span>
                    <span className="font-semibold text-[#24875B] tabular-nums">
                      {fmt(machineryData.ingresosServicios)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="text-[#5E6D64]">{t('finances.interestIncome')}</span>
                    <span className="font-semibold text-[#24875B] tabular-nums">
                      {fmt(machineryData.ingresosIntereses)}
                    </span>
                  </div>
                </>
              )}
              <div className="px-4 py-3 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-[#26352D]">{bi('Total de ingresos', 'Total income')}</span>
                <span className="font-bold text-[#24875B] tabular-nums">
                  {fmt(machineryData.totalIngresos)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-[#26352D]">
                  {machineryData.isFilteredByMachine
                    ? bi('Gastos asignados', 'Assigned expenses')
                    : bi('Total de gastos', 'Total expenses')}
                </span>
                <span className="font-bold text-[#C44545] tabular-nums">
                  {fmt(machineryData.totalGastos)}
                </span>
              </div>
              {machineryData.canShowNetResult ? (
                <div
                  className={`px-4 py-3.5 flex items-center justify-between gap-2 text-sm ${getNetBgClass(
                    machineryData.resultadoNeto
                  )}`}
                >
                  <span className="font-bold text-[#26352D]">{t('reports.netResult')}</span>
                  <span
                    className={`text-base font-extrabold tabular-nums ${getNetColorClass(
                      machineryData.resultadoNeto
                    )}`}
                  >
                    {fmt(machineryData.resultadoNeto)}
                  </span>
                </div>
              ) : (
                <div className="px-4 py-3 bg-[#FAFBF8] flex items-start gap-2 text-xs text-[#5E6D64]">
                  <Info className="h-4 w-4 text-[#7A8780] shrink-0 mt-0.5" />
                  <span>
                    {bi(
                      `Existen gastos generales (${fmt(machineryData.unassignedMachExpensesTotal)}) no asignados a una máquina individual.`,
                      `There are general expenses (${fmt(machineryData.unassignedMachExpensesTotal)}) not assigned to an individual machine.`
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* INGRESOS AGRUPADOS */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#EAF5EE]/55 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-[#24875B]">{t('reports.incomes')}</h3>
                  <span className="text-xs sm:text-sm font-extrabold text-[#24875B] tabular-nums">
                    {fmt(machineryData.totalIngresos)}
                  </span>
                </div>
                <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm">
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="font-medium text-[#26352D]">
                      {bi('Trabajos en propiedad propia', 'Own property jobs')}{' '}
                      <span className="text-[11px] text-[#7A8780] font-normal">
                        ({machineryData.propJobsCount})
                      </span>
                    </span>
                    <span className="font-bold text-[#24875B] tabular-nums shrink-0">
                      {fmt(machineryData.ingresosPropiedad)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="font-medium text-[#26352D]">
                      {bi('Servicios a clientes externos', 'External client services')}{' '}
                      <span className="text-[11px] text-[#7A8780] font-normal">
                        ({machineryData.extJobsCount})
                      </span>
                    </span>
                    <span className="font-bold text-[#24875B] tabular-nums shrink-0">
                      {fmt(machineryData.ingresosTerceros)}
                    </span>
                  </div>
                  {machineryData.ingresosIntereses > 0.004 && (
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="font-medium text-[#26352D]">
                        {t('finances.interestIncome')}{' '}
                        <span className="text-[11px] text-[#7A8780] font-normal">
                          ({machineryData.interesesCount})
                        </span>
                      </span>
                      <span className="font-bold text-[#24875B] tabular-nums shrink-0">
                        {fmt(machineryData.ingresosIntereses)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* DESGLOSE POR MÁQUINA E IMPLEMENTO AGRÍCOLA */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#F8FAF8] flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-[#26352D]">
                    {bi('Ingresos por máquina e implemento', 'Income by machine & implement')}
                  </h3>
                  <span className="text-xs sm:text-sm font-extrabold text-[#24875B] tabular-nums">
                    {fmt(machineryData.totalIngresos)}
                  </span>
                </div>
                {machineryData.ingresosPorMaquinaEquipo.length > 0 ? (
                  <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm">
                    {machineryData.ingresosPorMaquinaEquipo.map((row) => (
                      <div key={row.key} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <span className="font-medium text-[#26352D] truncate">{row.label}</span>
                        <span className="font-bold text-[#24875B] tabular-nums shrink-0">
                          {fmt(row.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-5 text-xs text-[#7A8780] text-center">
                    {bi('Sin ingresos de maquinaria en esta selección.', 'No machinery income in this selection.')}
                  </p>
                )}
              </div>

              {/* GASTOS AGRUPADOS POR CONCEPTO */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#FCECEC]/55 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-[#C44545]">
                    {machineryData.isFilteredByMachine
                      ? bi('Gastos asignados por concepto', 'Assigned expenses by concept')
                      : bi('Gastos por concepto', 'Expenses by concept')}
                  </h3>
                  <span className="text-xs sm:text-sm font-extrabold text-[#C44545] tabular-nums">
                    {fmt(machineryData.totalGastos)}
                  </span>
                </div>
                {machineryData.gastosPorConcepto.length > 0 ? (
                  <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm">
                    {machineryData.gastosPorConcepto.map((row) => (
                      <div key={row.key} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <span className="font-medium text-[#26352D] truncate">{row.label}</span>
                        <span className="font-bold text-[#C44545] tabular-nums shrink-0">
                          {fmt(row.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-5 text-xs text-[#7A8780] text-center">
                    {bi('Sin gastos registrados en esta selección.', 'No expenses recorded in this selection.')}
                  </p>
                )}
              </div>

              {/* RESULTADO NETO */}
              {machineryData.canShowNetResult ? (
                <div
                  className={`rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 ${getNetBgClass(
                    machineryData.resultadoNeto
                  )}`}
                >
                  <span className="text-sm font-bold text-[#26352D]">{t('reports.netResult')}</span>
                  <span
                    className={`text-base sm:text-lg font-extrabold tabular-nums ${getNetColorClass(
                      machineryData.resultadoNeto
                    )}`}
                  >
                    {fmt(machineryData.resultadoNeto)}
                  </span>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#E2E7E3] bg-white px-4 py-3 text-xs text-[#5E6D64] flex items-start gap-2">
                  <Info className="h-4 w-4 text-[#7A8780] shrink-0 mt-0.5" />
                  <span>
                    {bi(
                      `Los gastos generales (${fmt(machineryData.unassignedMachExpensesTotal)}) no se atribuyen a una máquina individual, por lo que no se muestra utilidad neta para ${machineryData.selectedMachineName}.`,
                      `General expenses (${fmt(machineryData.unassignedMachExpensesTotal)}) are not attributed to an individual machine, so net profit is not shown for ${machineryData.selectedMachineName}.`
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW B: PROPIEDAD — RESUMIDO Y DETALLADO                             */}
      {/* ==================================================================== */}
      {activeScope === 'propiedad' && (
        <div className="space-y-3">
          {detailLevel === 'resumido' ? (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden divide-y divide-[#EFF2EF] text-sm">
              {propertyData.totalIngresosIntereses > 0.004 && (
                <>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="text-[#5E6D64]">{t('finances.harvestIncome')}</span>
                    <span className="font-semibold text-[#24875B] tabular-nums">
                      {fmt(propertyData.totalIngresosCosechas)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="text-[#5E6D64]">{t('finances.interestIncome')}</span>
                    <span className="font-semibold text-[#24875B] tabular-nums">
                      {fmt(propertyData.totalIngresosIntereses)}
                    </span>
                  </div>
                </>
              )}
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="font-medium text-[#26352D]">{t('reports.incomes')}</span>
                <span className="font-bold text-[#24875B] tabular-nums">
                  {fmt(propertyData.totalIngresos)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-[#5E6D64]">{bi('Gastos directos', 'Direct expenses')}</span>
                <span className="font-semibold text-[#C44545] tabular-nums">
                  {fmt(propertyData.totalGastosDirectos)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-[#5E6D64]">{bi('Maquinaria recibida', 'Machinery received')}</span>
                <span className="font-semibold text-[#C44545] tabular-nums">
                  {fmt(propertyData.totalGastosMaquinaria)}
                </span>
              </div>
              <div className="px-4 py-3 bg-[#FCECEC]/40 flex items-center justify-between gap-2">
                <span className="font-bold text-[#C44545]">{bi('Gastos totales', 'Total expenses')}</span>
                <span className="font-extrabold text-[#C44545] tabular-nums">
                  {fmt(propertyData.totalGastos)}
                </span>
              </div>
              {propertyData.ingresoPorHaGlobal !== null && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#5E6D64]">
                    {bi('Ingreso / ha', 'Income / ha')} ({formatNumberEs(propertyData.totalHectares, 1)} ha)
                  </span>
                  <span className="font-semibold text-[#24875B] tabular-nums">
                    {fmt(propertyData.ingresoPorHaGlobal)}
                  </span>
                </div>
              )}
              {propertyData.gastoPorHaGlobal !== null && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#5E6D64]">
                    {bi('Gasto / ha', 'Expense / ha')} ({formatNumberEs(propertyData.totalHectares, 1)} ha)
                  </span>
                  <span className="font-semibold text-[#C44545] tabular-nums">
                    {fmt(propertyData.gastoPorHaGlobal)}
                  </span>
                </div>
              )}
              {propertyData.utilidadPorHaGlobal !== null && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#5E6D64]">{bi('Resultado / ha', 'Result / ha')}</span>
                  <span
                    className={`font-semibold tabular-nums ${getNetColorClass(
                      propertyData.utilidadPorHaGlobal
                    )}`}
                  >
                    {fmt(propertyData.utilidadPorHaGlobal)}
                  </span>
                </div>
              )}
              <div
                className={`px-4 py-3.5 flex items-center justify-between gap-2 ${getNetBgClass(
                  propertyData.resultadoNeto
                )}`}
              >
                <span className="font-bold text-[#26352D]">{t('reports.netResult')}</span>
                <span
                  className={`text-base font-extrabold tabular-nums ${getNetColorClass(
                    propertyData.resultadoNeto
                  )}`}
                >
                  {fmt(propertyData.resultadoNeto)}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* RESULTADOS POR LOTE */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#F8FAF8] flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-[#26352D]">
                    {bi('Resultados por lote', 'Results by lot')} ({propertyData.lotResults.length})
                  </h3>
                  {propertyData.totalHectares > 0 && (
                    <span className="text-[11px] font-semibold text-[#5E6D64] tabular-nums">
                      {formatNumberEs(propertyData.totalHectares, 1)} ha
                    </span>
                  )}
                </div>

                {propertyData.lotResults.length > 0 ? (
                  <div className="divide-y divide-[#EFF2EF]">
                    {propertyData.lotResults.map((lot) => {
                      const isLotExpanded = expandedReportLotId === lot.lotId;
                      return (
                        <div key={lot.lotId} className="bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedReportLotId(isLotExpanded ? null : lot.lotId)
                            }
                            aria-expanded={isLotExpanded}
                            className="w-full px-4 py-3 flex items-center justify-between gap-2.5 hover:bg-[#F8FAF8] active:bg-[#F1F5F2] transition text-left cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-1.5 min-w-0">
                                <span className="text-sm font-bold text-[#26352D] truncate">
                                  {lot.lotName}
                                </span>
                                {lot.hectares > 0 && (
                                  <span className="text-[11px] font-medium text-[#7A8780] tabular-nums shrink-0">
                                    · {formatNumberEs(lot.hectares, 1)} ha
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] tabular-nums mt-0.5">
                                <span className="text-[#24875B] font-semibold">
                                  {bi('Ing', 'Inc')}: {fmt(lot.ingresos)}
                                </span>
                                <span className="text-[#C44545] font-semibold">
                                  {bi('Gas', 'Exp')}: {fmt(lot.gastosTotales)}
                                </span>
                                {lot.toneladasCosechadas > 0.0001 && (
                                  <span className="text-[#5E6D64] font-medium">
                                    · {formatNumberEs(lot.toneladasVendidas, 1)}/{formatNumberEs(lot.toneladasCosechadas, 1)} t ({formatPercentMax1(lot.porcentajeVendido, lang)})
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-sm font-extrabold tabular-nums ${getNetColorClass(
                                  lot.resultadoNeto
                                )}`}
                              >
                                {fmt(lot.resultadoNeto)}
                              </span>
                              <span className="no-print text-[#8A968F]">
                                {isLotExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </span>
                            </div>
                          </button>

                          <div
                            className={`${
                              isLotExpanded ? 'block' : 'hidden print:block'
                            } px-4 pb-3 pt-2 bg-[#FAFBF8] border-t border-[#EFF2EF] space-y-2.5 text-xs`}
                          >
                            {lot.toneladasCosechadas > 0.0001 && (
                              <div className="rounded-xl bg-white border border-[#E2E7E3] p-2.5 space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-bold text-[#26352D]">
                                  <span>{bi('Producción y ventas', 'Production & sales')}</span>
                                  <span className="text-[#1D704B] tabular-nums">
                                    {formatPercentMax1(lot.porcentajeVendido, lang)} {bi('vendido', 'sold')}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-[#E8EFEA] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#24875B]"
                                    style={{ width: `${Math.min(100, Math.max(0, lot.porcentajeVendido))}%` }}
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                                  <div>
                                    <span className="block text-[10px] text-[#5E6D64]">{bi('Cosechado', 'Harvested')}</span>
                                    <strong className="text-[#26352D]">{formatNumberEs(lot.toneladasCosechadas, 2)} t</strong>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-[#5E6D64]">{bi('Vendido', 'Sold')}</span>
                                    <strong className="text-[#26352D]">{formatNumberEs(lot.toneladasVendidas, 2)} t</strong>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-[#5E6D64]">{bi('Disponible', 'Available')}</span>
                                    <strong className="text-[#1D704B]">{formatNumberEs(lot.toneladasDisponibles, 2)} t</strong>
                                  </div>
                                </div>
                              </div>
                            )}

                            {(lot.ingresoPorHa !== null ||
                              lot.gastoPorHa !== null ||
                              lot.utilidadPorHa !== null) && (
                              <div className="grid grid-cols-3 gap-2 pb-2 border-b border-[#EFF2EF] tabular-nums text-center">
                                <div className="rounded-lg bg-white border border-[#E2E7E3] px-2 py-1.5">
                                  <span className="block text-[10px] text-[#5E6D64]">{bi('Ingreso/ha', 'Income/ha')}</span>
                                  <strong className="text-[#24875B]">
                                    {lot.ingresoPorHa !== null ? fmt(lot.ingresoPorHa) : '—'}
                                  </strong>
                                </div>
                                <div className="rounded-lg bg-white border border-[#E2E7E3] px-2 py-1.5">
                                  <span className="block text-[10px] text-[#5E6D64]">{bi('Gasto/ha', 'Expense/ha')}</span>
                                  <strong className="text-[#C44545]">
                                    {lot.gastoPorHa !== null ? fmt(lot.gastoPorHa) : '—'}
                                  </strong>
                                </div>
                                <div className="rounded-lg bg-white border border-[#E2E7E3] px-2 py-1.5">
                                  <span className="block text-[10px] text-[#5E6D64]">{bi('Resultado/ha', 'Result/ha')}</span>
                                  <strong
                                    className={
                                      lot.utilidadPorHa !== null
                                        ? getNetColorClass(lot.utilidadPorHa)
                                        : 'text-[#5E6D64]'
                                    }
                                  >
                                    {lot.utilidadPorHa !== null ? fmt(lot.utilidadPorHa) : '—'}
                                  </strong>
                                </div>
                              </div>
                            )}

                            {lot.ingresosPorConcepto.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between font-bold text-[#24875B]">
                                  <span>{bi('Ingresos de cosecha / ventas', 'Harvest / sales income')}</span>
                                  <span className="tabular-nums">{fmt(lot.ingresos)}</span>
                                </div>
                                <div className="divide-y divide-[#EFF2EF] rounded-xl border border-[#E2E7E3] bg-white overflow-hidden">
                                  {lot.ingresosPorConcepto.map((c) => (
                                    <div
                                      key={c.key}
                                      className="px-3 py-1.5 flex items-center justify-between gap-2"
                                    >
                                      <span className="text-[#26352D] truncate">{c.label}</span>
                                      <span className="font-semibold text-[#24875B] tabular-nums shrink-0">
                                        {fmt(c.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {lot.gastosDirectosPorConcepto.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between font-bold text-[#C44545]">
                                  <span>{bi('Gastos directos', 'Direct expenses')}</span>
                                  <span className="tabular-nums">{fmt(lot.gastosDirectos)}</span>
                                </div>
                                <div className="divide-y divide-[#EFF2EF] rounded-xl border border-[#E2E7E3] bg-white overflow-hidden">
                                  {lot.gastosDirectosPorConcepto.map((c) => (
                                    <div
                                      key={c.key}
                                      className="px-3 py-1.5 flex items-center justify-between gap-2"
                                    >
                                      <span className="text-[#26352D] truncate">{c.label}</span>
                                      <span className="font-semibold text-[#C44545] tabular-nums shrink-0">
                                        {fmt(c.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {lot.trabajosMaquinariaPorLabor.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between font-bold text-[#C44545]">
                                  <span>{bi('Trabajos de maquinaria recibidos', 'Machinery jobs received')}</span>
                                  <span className="tabular-nums">{fmt(lot.gastosMaquinaria)}</span>
                                </div>
                                <div className="divide-y divide-[#EFF2EF] rounded-xl border border-[#E2E7E3] bg-white overflow-hidden">
                                  {lot.trabajosMaquinariaPorLabor.map((m) => (
                                    <div
                                      key={m.key}
                                      className="px-3 py-1.5 flex items-center justify-between gap-2"
                                    >
                                      <span className="text-[#26352D] truncate">{m.label}</span>
                                      <span className="font-semibold text-[#C44545] tabular-nums shrink-0">
                                        {fmt(m.amount)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {lot.gastosDirectosPorConcepto.length === 0 &&
                              lot.trabajosMaquinariaPorLabor.length === 0 &&
                              lot.ingresos === 0 && (
                                <p className="text-[11px] text-[#7A8780]">
                                  {bi(
                                    'Sin movimientos registrados en esta campaña.',
                                    'No movements recorded in this campaign.'
                                  )}
                                </p>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-4 py-5 text-xs text-[#7A8780] text-center">
                    {bi('Sin datos de lotes en esta campaña.', 'No lot data in this campaign.')}
                  </p>
                )}
              </div>

              {/* RESUMEN DE PROPIEDAD */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#F8FAF8] flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-[#26352D]">
                    {bi('Resumen de Propiedad', 'Property Summary')}
                  </h3>
                  {propertyData.totalHectares > 0 && (
                    <span className="text-[11px] font-semibold text-[#5E6D64] tabular-nums">
                      {formatNumberEs(propertyData.totalHectares, 1)} ha
                    </span>
                  )}
                </div>
                <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm">
                  {propertyData.totalIngresosIntereses > 0.004 && (
                    <>
                      <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <span className="text-[#5E6D64]">{t('finances.harvestIncome')}</span>
                        <span className="font-semibold text-[#24875B] tabular-nums">
                          {fmt(propertyData.totalIngresosCosechas)}
                        </span>
                      </div>
                      <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <span className="text-[#5E6D64]">{t('finances.interestIncome')}</span>
                        <span className="font-semibold text-[#24875B] tabular-nums">
                          {fmt(propertyData.totalIngresosIntereses)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#26352D]">{t('reports.incomes')}</span>
                    <span className="font-bold text-[#24875B] tabular-nums">
                      {fmt(propertyData.totalIngresos)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#5E6D64]">{bi('Gastos directos', 'Direct expenses')}</span>
                    <span className="font-semibold text-[#C44545] tabular-nums">
                      {fmt(propertyData.totalGastosDirectos)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#5E6D64]">{bi('Maquinaria recibida', 'Machinery received')}</span>
                    <span className="font-semibold text-[#C44545] tabular-nums">
                      {fmt(propertyData.totalGastosMaquinaria)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-[#FCECEC]/35">
                    <span className="font-bold text-[#C44545]">{bi('Gastos totales', 'Total expenses')}</span>
                    <span className="font-extrabold text-[#C44545] tabular-nums">
                      {fmt(propertyData.totalGastos)}
                    </span>
                  </div>
                  {propertyData.ingresoPorHaGlobal !== null && (
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#5E6D64]">{bi('Ingreso / ha', 'Income / ha')}</span>
                      <span className="font-semibold text-[#24875B] tabular-nums">
                        {fmt(propertyData.ingresoPorHaGlobal)}
                      </span>
                    </div>
                  )}
                  {propertyData.gastoPorHaGlobal !== null && (
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#5E6D64]">{bi('Gasto / ha', 'Expense / ha')}</span>
                      <span className="font-semibold text-[#C44545] tabular-nums">
                        {fmt(propertyData.gastoPorHaGlobal)}
                      </span>
                    </div>
                  )}
                  {propertyData.utilidadPorHaGlobal !== null && (
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#5E6D64]">{bi('Resultado / ha', 'Result / ha')}</span>
                      <span
                        className={`font-semibold tabular-nums ${getNetColorClass(
                          propertyData.utilidadPorHaGlobal
                        )}`}
                      >
                        {fmt(propertyData.utilidadPorHaGlobal)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`px-4 py-3 flex items-center justify-between gap-2 ${getNetBgClass(
                      propertyData.resultadoNeto
                    )}`}
                  >
                    <span className="font-bold text-[#26352D]">{t('reports.netResult')}</span>
                    <span
                      className={`text-base font-extrabold tabular-nums ${getNetColorClass(
                        propertyData.resultadoNeto
                      )}`}
                    >
                      {fmt(propertyData.resultadoNeto)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW C: REPORTE GENERAL — CONSOLIDADO                                */}
      {/* ==================================================================== */}
      {activeScope === 'consolidado' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
            <div className="divide-y divide-[#EFF2EF] tabular-nums">
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#26352D] flex items-center gap-1.5">
                    <Tractor className="h-4 w-4 text-[#526058] shrink-0" />
                    <span className="truncate">{t('nav.machinery')}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] mt-0.5">
                    <span className="text-[#24875B] font-semibold">
                      {bi('Ing', 'Inc')}: {fmt(consolidatedData.machIngresosTotales)}
                    </span>
                    <span className="text-[#C44545] font-semibold">
                      {bi('Gas', 'Exp')}: {fmt(consolidatedData.machGastosTotales)}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-sm sm:text-base font-extrabold shrink-0 ${getNetColorClass(
                    consolidatedData.machResultado
                  )}`}
                >
                  {fmt(consolidatedData.machResultado)}
                </span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#26352D] flex items-center gap-1.5">
                    <Sprout className="h-4 w-4 text-[#526058] shrink-0" />
                    <span className="truncate">{t('nav.property')}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] mt-0.5">
                    <span className="text-[#24875B] font-semibold">
                      {bi('Ing', 'Inc')}: {fmt(consolidatedData.propIngresosTotales)}
                    </span>
                    <span className="text-[#C44545] font-semibold">
                      {bi('Gas', 'Exp')}: {fmt(consolidatedData.propGastosTotales)}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-sm sm:text-base font-extrabold shrink-0 ${getNetColorClass(
                    consolidatedData.propResultado
                  )}`}
                >
                  {fmt(consolidatedData.propResultado)}
                </span>
              </div>

              <div
                className={`px-4 py-3.5 flex items-center justify-between gap-2 ${getNetBgClass(
                  consolidatedData.resultadoConsolidado
                )}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-[#26352D] flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-[#24875B] shrink-0" />
                    <span className="truncate">
                      {bi('Consolidado general', 'General consolidated')}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] mt-0.5">
                    <span className="text-[#24875B] font-bold">
                      {bi('Ing', 'Inc')}: {fmt(consolidatedData.ingresosConsolidados)}
                    </span>
                    <span className="text-[#C44545] font-bold">
                      {bi('Gas', 'Exp')}: {fmt(consolidatedData.gastosConsolidados)}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-base sm:text-lg font-extrabold shrink-0 ${getNetColorClass(
                    consolidatedData.resultadoConsolidado
                  )}`}
                >
                  {fmt(consolidatedData.resultadoConsolidado)}
                </span>
              </div>
            </div>
          </div>

          {detailLevel === 'detallado' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#EAF5EE]/55 flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-[#24875B]">
                    {t('reports.incomes')}
                  </h4>
                  <span className="text-xs sm:text-sm font-extrabold text-[#24875B] tabular-nums">
                    {fmt(consolidatedData.ingresosConsolidados)}
                  </span>
                </div>
                <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm tabular-nums">
                  {consolidatedData.ingresosExtPorMaquina.map((r) => (
                    <div key={`ext_${r.key}`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">{t('nav.machinery')} · {r.label}</span>
                      <span className="font-semibold text-[#24875B] shrink-0">
                        {fmt(r.amount)}
                      </span>
                    </div>
                  ))}
                  {consolidatedData.ingresosPropPorLote.map((r) => (
                    <div key={`prop_${r.key}`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">{t('nav.property')} · {r.label}</span>
                      <span className="font-semibold text-[#24875B] shrink-0">
                        {fmt(r.amount)}
                      </span>
                    </div>
                  ))}
                  {consolidatedData.machIngresosIntereses > 0.004 && (
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">
                        {t('nav.machinery')} · {t('finances.interestIncome')}
                      </span>
                      <span className="font-semibold text-[#24875B] shrink-0">
                        {fmt(consolidatedData.machIngresosIntereses)}
                      </span>
                    </div>
                  )}
                  {consolidatedData.propIngresosIntereses > 0.004 && (
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">
                        {t('nav.property')} · {t('finances.interestIncome')}
                      </span>
                      <span className="font-semibold text-[#24875B] shrink-0">
                        {fmt(consolidatedData.propIngresosIntereses)}
                      </span>
                    </div>
                  )}
                  {consolidatedData.ingresosExtPorMaquina.length === 0 &&
                    consolidatedData.ingresosPropPorLote.length === 0 &&
                    consolidatedData.ingresosInteresesTotales <= 0.004 && (
                      <p className="px-4 py-5 text-center text-xs text-[#7A8780]">
                        {bi(
                          'No hay ingresos en esta campaña.',
                          'No income in this campaign.'
                        )}
                      </p>
                    )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#FCECEC]/55 flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-[#C44545]">
                    {t('reports.expenses')}
                  </h4>
                  <span className="text-xs sm:text-sm font-extrabold text-[#C44545] tabular-nums">
                    {fmt(consolidatedData.gastosConsolidados)}
                  </span>
                </div>
                <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm tabular-nums">
                  {consolidatedData.gastosMaqPorConcepto.map((r) => (
                    <div key={`gm_${r.key}`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">{t('nav.machinery')} · {r.label}</span>
                      <span className="font-semibold text-[#C44545] shrink-0">
                        {fmt(r.amount)}
                      </span>
                    </div>
                  ))}
                  {consolidatedData.gastosPropPorConcepto.map((r) => (
                    <div key={`gp_${r.key}`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">{t('nav.property')} · {r.label}</span>
                      <span className="font-semibold text-[#C44545] shrink-0">
                        {fmt(r.amount)}
                      </span>
                    </div>
                  ))}
                  {consolidatedData.gastosMaqPorConcepto.length === 0 &&
                    consolidatedData.gastosPropPorConcepto.length === 0 && (
                      <p className="px-4 py-5 text-center text-xs text-[#7A8780]">
                        {bi(
                          'No hay gastos en esta campaña.',
                          'No expenses in this campaign.'
                        )}
                      </p>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ReportsView: React.FC<Props> = (props) => (
  <ReportsErrorBoundary>
    <ReportsViewInner {...props} />
  </ReportsErrorBoundary>
);
