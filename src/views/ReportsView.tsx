import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
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
} from '../types';
import {
  matchesCampaignRecord,
  isDirectPropertyIncome,
  isInternalMachineryJobExpense,
  convertHistoricalAmount,
  formatCurrencyAmount,
} from '../services/financialSummary';
import { formatDateDDMMAAAA, getBoliviaDateString } from '../services/backend';
import { CompactFilter } from '../components/CompactListUI';
import { usePersistedMemoryState } from '../hooks/useSwrQuery';

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
      return (
        <div className="rounded-2xl border border-[#C44545]/30 bg-[#FCECEC] p-5 text-center space-y-3 max-w-xl mx-auto my-6">
          <div className="flex items-center justify-center gap-3">
            <AlertCircle className="h-6 w-6 text-[#C44545] shrink-0" />
            <div className="text-left">
              <h3 className="text-base font-bold text-[#26352D]">
                No se pudo cargar el reporte
              </h3>
              <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">
                {this.state.error?.message ||
                  'Ocurrió un problema al procesar la información financiera.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2.5 bg-[#24875B] hover:bg-[#1D704B] text-white font-semibold text-sm rounded-xl transition cursor-pointer min-h-[44px]"
          >
            Reintentar
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
  if (!isFinite(val)) return '0,00';
  const formatted = val.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (/^-?\d{1,3}(,\d{3})*\.\d+$/.test(formatted)) {
    return formatted.replace(/,/g, '_').replace(/\./g, ',').replace(/_/g, '.');
  }
  return formatted;
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
  lots = [],
  jobs = [],
  expenses = [],
  incomes = [],
  currency: initialCurrency = 'USD',
  exchangeRate,
  initialScreen = 'general',
  onRootBackLabel,
  onBack,
}) => {
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
  const [activeCurrency, setActiveCurrency] = useState<Currency>(initialCurrency || 'USD');
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
  const [showReconciliation, setShowReconciliation] = useState<boolean>(false);
  const [expandedReportLotId, setExpandedReportLotId] = useState<string | null>(null);

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

  // Name resolvers
  const getMachineName = (mId?: string, fallbackName?: string): string => {
    if (mId) {
      const found = safeMachines.find((m) => String(m.id) === String(mId));
      if (found?.nombre) return found.nombre;
    }
    if (fallbackName && fallbackName.trim()) return fallbackName.trim();
    return 'Máquina sin asignar';
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
    return { id: 'sin_lote', name: 'General / Sin lote', ha: 0 };
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
    const totalIngresos = ingresosPropiedad + ingresosTerceros;

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

      const rawEquip = cleanConceptLabel(j.trabajoNombre || (j as any).trabajo, 'Trabajo directo (sin equipo)');
      const equipKey = `${mId}::${rawEquip.toLowerCase()}`;
      const isSameAsMachine = rawEquip.toLowerCase() === mName.toLowerCase();
      const equipLabel = isSameAsMachine ? `${mName} (directo)` : `${mName} · ${rawEquip}`;
      const ePrev = byMachineEquipmentMap.get(equipKey);
      if (ePrev) {
        ePrev.amount += val;
        ePrev.count += 1;
      } else {
        byMachineEquipmentMap.set(equipKey, {
          key: equipKey,
          label: equipLabel,
          sublabel: isSameAsMachine ? 'Solo máquina' : `Equipo: ${rawEquip}`,
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
        'Otros gastos'
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
    activeScope,
    selectedMachineId,
    activeCurrency,
    safeExchangeRate,
    safeMachines,
  ]);

  // ==========================================================================
  // 2. PROPIEDAD CALCULATIONS (BY LOT SORTED BY NAME/NUMBER, PER-HECTARE METRICS)
  // ==========================================================================
  const propertyData = useMemo(() => {
    const directIncomes = campaignIncomes.filter(isDirectPropertyIncome);
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

    directIncomes.forEach((inc) => {
      const entry = ensureLot(inc.loteId, inc.loteNombre);
      const val = toView(Number(inc.total) || 0, inc.moneda, inc.tipoCambio || inc.tc);
      entry.ingresos += val;
      const concept = cleanConceptLabel(inc.concepto || (inc as any).rubro, 'Venta agrícola');
      const key = concept.toLowerCase();
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
        'Gasto directo'
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
      const labor = cleanConceptLabel(job.trabajoNombre || (job as any).trabajo, 'Labor de maquinaria');
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
        // When showing all lots, include every registered lot or any uncategorized bucket that has movements
        const isRegistered = safeLots.some((l) => String(l.id) === String(entry.lotId));
        const hasActivity =
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
        return {
          lotId: entry.lotId,
          lotName: entry.lotName,
          hectares: entry.hectares,
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
        // Put "General / Sin lote" at the bottom; sort real lots naturally by name/number
        if (a.lotId === 'sin_lote') return 1;
        if (b.lotId === 'sin_lote') return -1;
        return naturalCompare(a.lotName, b.lotName);
      });

    const totalIngresos = allLotResults.reduce((sum, l) => sum + l.ingresos, 0);
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
    safeLots,
    activeScope,
    selectedLotId,
    activeCurrency,
    safeExchangeRate,
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
    const machIngresosTotales = machIngresosExternos + operacionesInternas;
    const machGastosTotales = machExpenses.reduce(
      (s, e) => s + toView(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );
    const machResultado = machIngresosTotales - machGastosTotales;

    const propIngresosTotales = propIncomes.reduce(
      (s, i) => s + toView(Number(i.total) || 0, i.moneda, i.tipoCambio || i.tc),
      0
    );
    const propGastosDirectos = propDirectExpenses.reduce(
      (s, e) => s + toView(Number(e.total) || 0, e.moneda, e.tipoCambio || e.tc),
      0
    );
    const propGastosTotales = propGastosDirectos + operacionesInternas;
    const propResultado = propIngresosTotales - propGastosTotales;

    // Consolidated frente a terceros (eliminating both sides of internal jobs)
    const ingresosConsolidados = machIngresosExternos + propIngresosTotales;
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
          'Otros gastos'
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
      operacionesInternas,
      operacionesInternasCount: internalJobs.length,
      machIngresosTotales,
      machGastosTotales,
      machResultado,
      propIngresosTotales,
      propGastosDirectos,
      propGastosTotales,
      propResultado,
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
  }, [campaignJobs, campaignExpenses, campaignIncomes, activeCurrency, safeExchangeRate, safeLots, safeMachines]);

  // ==========================================================================
  // PRINT & EXCEL HEADERS (NO LOGO, NO COMPANY NAME)
  // ==========================================================================
  const reportHeaderTitle =
    rootMode === 'maquinarias'
      ? 'Maquinarias'
      : rootMode === 'propiedad'
      ? 'Propiedad'
      : 'Reporte general';

  const reportTypeDescription = useMemo(() => {
    const levelText = detailLevel === 'resumido' ? 'Resumido' : 'Detallado';
    if (rootMode === 'general') {
      const scopeText =
        generalTab === 'consolidado'
          ? 'Consolidado general'
          : generalTab === 'maquinarias'
          ? 'Maquinarias'
          : 'Propiedad';
      return `${scopeText} · ${levelText}`;
    }
    if (rootMode === 'maquinarias' && selectedMachineId !== 'all') {
      return `${levelText} · ${machineryData.selectedMachineName || 'Máquina'}`;
    }
    if (rootMode === 'propiedad' && selectedLotId !== 'all') {
      return `${levelText} · ${propertyData.selectedLotName || 'Lote'}`;
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
  ]);

  const campaignLabel = currentCampaign?.nombre || 'Todas las campañas';
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
      [`Campaña: ${campaignLabel}`],
      [`Tipo de reporte: ${reportTypeDescription}`],
      [`Moneda: ${currencyLabel}`],
      [`Fecha de emisión: ${printDateStr}`],
      [],
    ];

    if (activeScope === 'maquinarias') {
      if (detailLevel === 'resumido') {
        rows.push(['Concepto', `Importe (${currencyLabel})`]);
        rows.push(['Total de ingresos', Number(machineryData.totalIngresos.toFixed(2))]);
        rows.push(['Total de gastos', Number(machineryData.totalGastos.toFixed(2))]);
        if (machineryData.canShowNetResult) {
          rows.push(['Resultado neto', Number(machineryData.resultadoNeto.toFixed(2))]);
        } else {
          rows.push([
            'Nota',
            'Los gastos generales no se atribuyen a una máquina individual.',
          ]);
        }
      } else {
        rows.push(['Sección', 'Concepto', `Importe (${currencyLabel})`]);
        rows.push(['Ingresos', 'Trabajos para propiedad propia', Number(machineryData.ingresosPropiedad.toFixed(2))]);
        rows.push(['Ingresos', 'Servicios para clientes externos', Number(machineryData.ingresosTerceros.toFixed(2))]);
        rows.push(['Ingresos', 'Total de ingresos', Number(machineryData.totalIngresos.toFixed(2))]);
        rows.push([]);
        rows.push(['Desglose por máquina e implemento agrícola (contabilizado una sola vez)', 'Detalle', `Importe (${currencyLabel})`]);
        machineryData.ingresosPorMaquinaEquipo.forEach((r) => {
          rows.push(['Máquina / Implemento', r.label, Number(r.amount.toFixed(2))]);
        });
        rows.push([]);
        rows.push(['Gastos por concepto', 'Concepto', `Importe (${currencyLabel})`]);
        machineryData.gastosPorConcepto.forEach((r) => {
          rows.push(['Gastos', r.label, Number(r.amount.toFixed(2))]);
        });
        rows.push(['Gastos', 'Total de gastos', Number(machineryData.totalGastos.toFixed(2))]);
        if (machineryData.canShowNetResult) {
          rows.push([]);
          rows.push(['Resultado', 'Resultado neto', Number(machineryData.resultadoNeto.toFixed(2))]);
        }
      }
    } else if (activeScope === 'propiedad') {
      if (detailLevel === 'resumido') {
        rows.push(['Concepto', `Importe (${currencyLabel})`]);
        rows.push(['Ingresos', Number(propertyData.totalIngresos.toFixed(2))]);
        rows.push(['Gastos directos', Number(propertyData.totalGastosDirectos.toFixed(2))]);
        rows.push(['Gastos por maquinaria recibida', Number(propertyData.totalGastosMaquinaria.toFixed(2))]);
        rows.push(['Gastos totales', Number(propertyData.totalGastos.toFixed(2))]);
        rows.push(['Resultado neto', Number(propertyData.resultadoNeto.toFixed(2))]);
      } else {
        rows.push([
          'Lote',
          'Superficie (ha)',
          `Ingresos (${currencyLabel})`,
          `Gastos directos (${currencyLabel})`,
          `Maquinaria recibida (${currencyLabel})`,
          `Gasto total (${currencyLabel})`,
          `Resultado neto (${currencyLabel})`,
          `Ingreso/ha (${currencyLabel})`,
          `Gasto/ha (${currencyLabel})`,
          `Resultado/ha (${currencyLabel})`,
        ]);
        propertyData.lotResults.forEach((lot) => {
          rows.push([
            lot.lotName,
            Number(lot.hectares.toFixed(2)),
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
        rows.push(['Gastos directos por concepto', `Importe (${currencyLabel})`]);
        propertyData.gastosDirectosPorConcepto.forEach((r) => {
          rows.push([r.label, Number(r.amount.toFixed(2))]);
        });
        rows.push([]);
        rows.push(['Trabajos de maquinaria recibidos', `Importe (${currencyLabel})`]);
        propertyData.trabajosMaquinariaPorLabor.forEach((r) => {
          rows.push([r.label, Number(r.amount.toFixed(2))]);
        });
      }
    } else {
      // Consolidado general
      rows.push([
        'Módulo / Concepto',
        `Ingresos (${currencyLabel})`,
        `Gastos (${currencyLabel})`,
        `Resultado neto (${currencyLabel})`,
      ]);
      rows.push([
        'Maquinarias',
        Number(consolidatedData.machIngresosTotales.toFixed(2)),
        Number(consolidatedData.machGastosTotales.toFixed(2)),
        Number(consolidatedData.machResultado.toFixed(2)),
      ]);
      rows.push([
        'Propiedad',
        Number(consolidatedData.propIngresosTotales.toFixed(2)),
        Number(consolidatedData.propGastosTotales.toFixed(2)),
        Number(consolidatedData.propResultado.toFixed(2)),
      ]);
      rows.push([
        'Eliminación de operaciones internas (Maquinarias ↔ Propiedad)',
        Number((-consolidatedData.operacionesInternas).toFixed(2)),
        Number((-consolidatedData.operacionesInternas).toFixed(2)),
        0,
      ]);
      rows.push([
        'CONSOLIDADO GENERAL (frente a terceros)',
        Number(consolidatedData.ingresosConsolidados.toFixed(2)),
        Number(consolidatedData.gastosConsolidados.toFixed(2)),
        Number(consolidatedData.resultadoConsolidado.toFixed(2)),
      ]);

      if (detailLevel === 'detallado') {
        rows.push([]);
        rows.push(['Detalle consolidado — Ingresos frente a terceros', `Importe (${currencyLabel})`]);
        consolidatedData.ingresosExtPorMaquina.forEach((r) => {
          rows.push([`Maquinarias externos · ${r.label}`, Number(r.amount.toFixed(2))]);
        });
        consolidatedData.ingresosPropPorLote.forEach((r) => {
          rows.push([`Propiedad · ${r.label}`, Number(r.amount.toFixed(2))]);
        });
        rows.push(['Total ingresos consolidados', Number(consolidatedData.ingresosConsolidados.toFixed(2))]);

        rows.push([]);
        rows.push(['Detalle consolidado — Gastos frente a terceros', `Importe (${currencyLabel})`]);
        consolidatedData.gastosMaqPorConcepto.forEach((r) => {
          rows.push([`Maquinarias · ${r.label}`, Number(r.amount.toFixed(2))]);
        });
        consolidatedData.gastosPropPorConcepto.forEach((r) => {
          rows.push([`Propiedad · ${r.label}`, Number(r.amount.toFixed(2))]);
        });
        rows.push(['Total gastos consolidados', Number(consolidatedData.gastosConsolidados.toFixed(2))]);
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
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
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
      {/* PRINT-ONLY SIMPLE BLACK & WHITE HEADER (NO LOGO, NO COMPANY NAME) */}
      <div className="hidden print-only border-b-2 border-black pb-2 mb-4">
        <h1 className="text-lg font-bold text-black">{reportHeaderTitle}</h1>
        <div className="text-xs text-black mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
          <span>Campaña: {campaignLabel}</span>
          <span>Tipo: {reportTypeDescription}</span>
          <span>Moneda: {currencyLabel}</span>
          <span>Fecha de impresión: {printDateStr}</span>
        </div>
      </div>

      {/* COMPACT SCREEN HEADER: [←] Full Title + Icon-only Print & Excel */}
      <div className="no-print flex items-center justify-between gap-2 pb-2 border-b border-[#E2E7E3]">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={onRootBackLabel || 'Volver'}
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
            aria-label="Imprimir reporte"
            title="Imprimir reporte"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white hover:bg-[#F5F7F4] text-[#26352D] transition cursor-pointer"
          >
            <Printer className="h-4 w-4 text-[#526058]" />
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            aria-label="Exportar a Excel"
            title="Exportar a Excel"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white hover:bg-[#F5F7F4] text-[#24875B] transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* COMPACT SELECTORS (NO BIG BLOCKS, NO HORIZONTAL SCROLL) */}
      <div className="no-print flex flex-wrap items-center gap-1.5">
        {rootMode === 'general' && (
          <CompactFilter
            value={generalTab}
            onChange={(val) => setGeneralTab(val as GeneralScopeTab)}
            ariaLabel="Sección del reporte"
            options={[
              { value: 'consolidado', label: 'Consolidado' },
              { value: 'maquinarias', label: 'Maquinarias' },
              { value: 'propiedad', label: 'Propiedad' },
            ]}
          />
        )}

        <CompactFilter
          value={effectiveCampaignId}
          onChange={(val) => setSelectedCampaignId(val)}
          ariaLabel="Campaña"
          options={[
            ...safeCampaigns.map((c) => ({
              value: String(c.id),
              label: c.activa ? `${c.nombre} (Activa)` : c.nombre,
            })),
            ...(safeCampaigns.length > 1 || effectiveCampaignId === 'all' || safeCampaigns.length === 0
              ? [{ value: 'all', label: 'Todas las campañas' }]
              : []),
          ]}
        />

        <CompactFilter
          value={activeCurrency}
          onChange={(val) => setActiveCurrency(val as Currency)}
          ariaLabel="Moneda"
          options={[
            { value: 'USD', label: 'USD' },
            { value: 'BOB', label: 'Bs' },
          ]}
        />

        <CompactFilter
          value={detailLevel}
          onChange={(val) => setDetailLevel(val as ReportDetailLevel)}
          ariaLabel="Nivel de detalle"
          options={[
            { value: 'resumido', label: 'Resumido' },
            { value: 'detallado', label: 'Detallado' },
          ]}
        />

        {activeScope === 'maquinarias' && (
          <CompactFilter
            value={selectedMachineId}
            onChange={(val) => setSelectedMachineId(val)}
            ariaLabel="Filtrar por máquina"
            options={[
              { value: 'all', label: 'Todas las máquinas' },
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
            ariaLabel="Filtrar por lote"
            options={[
              { value: 'all', label: 'Todos los lotes' },
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
              <div className="px-4 py-3 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-[#26352D]">Total de ingresos</span>
                <span className="font-bold text-[#24875B] tabular-nums">
                  {fmt(machineryData.totalIngresos)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-[#26352D]">
                  {machineryData.isFilteredByMachine ? 'Gastos asignados' : 'Total de gastos'}
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
                  <span className="font-bold text-[#26352D]">Resultado neto</span>
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
                    Existen gastos generales ({fmt(machineryData.unassignedMachExpensesTotal)}) no asignados a una máquina individual.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* INGRESOS AGRUPADOS */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#EAF5EE]/55 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-[#24875B]">Ingresos</h3>
                  <span className="text-xs sm:text-sm font-extrabold text-[#24875B] tabular-nums">
                    {fmt(machineryData.totalIngresos)}
                  </span>
                </div>
                <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm">
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="font-medium text-[#26352D]">
                      Trabajos en propiedad propia{' '}
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
                      Servicios a clientes externos{' '}
                      <span className="text-[11px] text-[#7A8780] font-normal">
                        ({machineryData.extJobsCount})
                      </span>
                    </span>
                    <span className="font-bold text-[#24875B] tabular-nums shrink-0">
                      {fmt(machineryData.ingresosTerceros)}
                    </span>
                  </div>
                </div>
              </div>

              {/* DESGLOSE POR MÁQUINA E IMPLEMENTO AGRÍCOLA */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#F8FAF8] flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-[#26352D]">
                    Ingresos por máquina e implemento
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
                    Sin ingresos de maquinaria en esta selección.
                  </p>
                )}
              </div>

              {/* GASTOS AGRUPADOS POR CONCEPTO */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#FCECEC]/55 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-[#C44545]">
                    {machineryData.isFilteredByMachine
                      ? 'Gastos asignados por concepto'
                      : 'Gastos por concepto'}
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
                    Sin gastos registrados en esta selección.
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
                  <span className="text-sm font-bold text-[#26352D]">Resultado neto</span>
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
                    Los gastos generales ({fmt(machineryData.unassignedMachExpensesTotal)}) no se atribuyen a una máquina individual, por lo que no se muestra utilidad neta para {machineryData.selectedMachineName}.
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
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="font-medium text-[#26352D]">Ingresos</span>
                <span className="font-bold text-[#24875B] tabular-nums">
                  {fmt(propertyData.totalIngresos)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-[#5E6D64]">Gastos directos</span>
                <span className="font-semibold text-[#C44545] tabular-nums">
                  {fmt(propertyData.totalGastosDirectos)}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-[#5E6D64]">Maquinaria recibida</span>
                <span className="font-semibold text-[#C44545] tabular-nums">
                  {fmt(propertyData.totalGastosMaquinaria)}
                </span>
              </div>
              <div className="px-4 py-3 bg-[#FCECEC]/40 flex items-center justify-between gap-2">
                <span className="font-bold text-[#C44545]">Gastos totales</span>
                <span className="font-extrabold text-[#C44545] tabular-nums">
                  {fmt(propertyData.totalGastos)}
                </span>
              </div>
              {propertyData.ingresoPorHaGlobal !== null && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#5E6D64]">
                    Ingreso / ha ({formatNumberEs(propertyData.totalHectares, 1)} ha)
                  </span>
                  <span className="font-semibold text-[#24875B] tabular-nums">
                    {fmt(propertyData.ingresoPorHaGlobal)}
                  </span>
                </div>
              )}
              {propertyData.gastoPorHaGlobal !== null && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#5E6D64]">
                    Gasto / ha ({formatNumberEs(propertyData.totalHectares, 1)} ha)
                  </span>
                  <span className="font-semibold text-[#C44545] tabular-nums">
                    {fmt(propertyData.gastoPorHaGlobal)}
                  </span>
                </div>
              )}
              {propertyData.utilidadPorHaGlobal !== null && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#5E6D64]">Resultado / ha</span>
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
                <span className="font-bold text-[#26352D]">Resultado neto</span>
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
              {/* RESULTADOS POR LOTE — LISTA CONTINUA COMPACTA EXPANDIBLE */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#F8FAF8] flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-[#26352D]">
                    Resultados por lote ({propertyData.lotResults.length})
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
                                  Ing: {fmt(lot.ingresos)}
                                </span>
                                <span className="text-[#C44545] font-semibold">
                                  Gas: {fmt(lot.gastosTotales)}
                                </span>
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

                          {/* Detalle inline expandible (siempre visible en impresión) */}
                          <div
                            className={`${
                              isLotExpanded ? 'block' : 'hidden print:block'
                            } px-4 pb-3 pt-2 bg-[#FAFBF8] border-t border-[#EFF2EF] space-y-2.5 text-xs`}
                          >
                            {/* Indicadores por hectárea */}
                            {(lot.ingresoPorHa !== null ||
                              lot.gastoPorHa !== null ||
                              lot.utilidadPorHa !== null) && (
                              <div className="grid grid-cols-3 gap-2 pb-2 border-b border-[#EFF2EF] tabular-nums text-center">
                                <div className="rounded-lg bg-white border border-[#E2E7E3] px-2 py-1.5">
                                  <span className="block text-[10px] text-[#5E6D64]">Ingreso/ha</span>
                                  <strong className="text-[#24875B]">
                                    {lot.ingresoPorHa !== null ? fmt(lot.ingresoPorHa) : '—'}
                                  </strong>
                                </div>
                                <div className="rounded-lg bg-white border border-[#E2E7E3] px-2 py-1.5">
                                  <span className="block text-[10px] text-[#5E6D64]">Gasto/ha</span>
                                  <strong className="text-[#C44545]">
                                    {lot.gastoPorHa !== null ? fmt(lot.gastoPorHa) : '—'}
                                  </strong>
                                </div>
                                <div className="rounded-lg bg-white border border-[#E2E7E3] px-2 py-1.5">
                                  <span className="block text-[10px] text-[#5E6D64]">Resultado/ha</span>
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

                            {/* Ingresos / Cosechas por concepto (solo si > 0) */}
                            {lot.ingresosPorConcepto.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between font-bold text-[#24875B]">
                                  <span>Ingresos de cosecha / ventas</span>
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

                            {/* Gastos directos por concepto (solo si > 0) */}
                            {lot.gastosDirectosPorConcepto.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between font-bold text-[#C44545]">
                                  <span>Gastos directos</span>
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

                            {/* Trabajos de maquinaria recibidos (solo si > 0) */}
                            {lot.trabajosMaquinariaPorLabor.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between font-bold text-[#C44545]">
                                  <span>Trabajos de maquinaria recibidos</span>
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
                                  Sin movimientos registrados en esta campaña.
                                </p>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-4 py-5 text-xs text-[#7A8780] text-center">
                    Sin datos de lotes en esta campaña.
                  </p>
                )}
              </div>

              {/* RESUMEN DE PROPIEDAD */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#F8FAF8] flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-[#26352D]">
                    Resumen de Propiedad
                  </h3>
                  {propertyData.totalHectares > 0 && (
                    <span className="text-[11px] font-semibold text-[#5E6D64] tabular-nums">
                      {formatNumberEs(propertyData.totalHectares, 1)} ha
                    </span>
                  )}
                </div>
                <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm">
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#26352D]">Ingresos</span>
                    <span className="font-bold text-[#24875B] tabular-nums">
                      {fmt(propertyData.totalIngresos)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#5E6D64]">Gastos directos</span>
                    <span className="font-semibold text-[#C44545] tabular-nums">
                      {fmt(propertyData.totalGastosDirectos)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[#5E6D64]">Maquinaria recibida</span>
                    <span className="font-semibold text-[#C44545] tabular-nums">
                      {fmt(propertyData.totalGastosMaquinaria)}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-[#FCECEC]/35">
                    <span className="font-bold text-[#C44545]">Gastos totales</span>
                    <span className="font-extrabold text-[#C44545] tabular-nums">
                      {fmt(propertyData.totalGastos)}
                    </span>
                  </div>
                  {propertyData.ingresoPorHaGlobal !== null && (
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#5E6D64]">Ingreso / ha</span>
                      <span className="font-semibold text-[#24875B] tabular-nums">
                        {fmt(propertyData.ingresoPorHaGlobal)}
                      </span>
                    </div>
                  )}
                  {propertyData.gastoPorHaGlobal !== null && (
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#5E6D64]">Gasto / ha</span>
                      <span className="font-semibold text-[#C44545] tabular-nums">
                        {fmt(propertyData.gastoPorHaGlobal)}
                      </span>
                    </div>
                  )}
                  {propertyData.utilidadPorHaGlobal !== null && (
                    <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#5E6D64]">Resultado / ha</span>
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
                    <span className="font-bold text-[#26352D]">Resultado neto</span>
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
      {/* VIEW C: REPORTE GENERAL — CONSOLIDADO COMPACTO SIN SCROLL HORIZONTAL */}
      {/* ==================================================================== */}
      {activeScope === 'consolidado' && (
        <div className="space-y-3">
          {/* 1. RESUMEN COMPACTO POR MÓDULO + CONSOLIDADO GENERAL */}
          <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
            <div className="divide-y divide-[#EFF2EF] tabular-nums">
              {/* Maquinarias */}
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#26352D]">Maquinarias</p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] mt-0.5">
                    <span className="text-[#24875B] font-semibold">
                      Ing: {fmt(consolidatedData.machIngresosTotales)}
                    </span>
                    <span className="text-[#C44545] font-semibold">
                      Gas: {fmt(consolidatedData.machGastosTotales)}
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

              {/* Propiedad */}
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#26352D]">Propiedad</p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] mt-0.5">
                    <span className="text-[#24875B] font-semibold">
                      Ing: {fmt(consolidatedData.propIngresosTotales)}
                    </span>
                    <span className="text-[#C44545] font-semibold">
                      Gas: {fmt(consolidatedData.propGastosTotales)}
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

              {/* Consolidado general */}
              <div
                className={`px-4 py-3.5 flex items-center justify-between gap-2 ${getNetBgClass(
                  consolidatedData.resultadoConsolidado
                )}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-[#26352D]">Consolidado general</p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] mt-0.5">
                    <span className="text-[#24875B] font-bold">
                      Ing: {fmt(consolidatedData.ingresosConsolidados)}
                    </span>
                    <span className="text-[#C44545] font-bold">
                      Gas: {fmt(consolidatedData.gastosConsolidados)}
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

            {/* Botón discreto «Ver conciliación» (cerrado inicialmente; siempre visible al imprimir) */}
            <div className="no-print border-t border-[#EFF2EF] bg-[#FAFBF8]">
              <button
                type="button"
                onClick={() => setShowReconciliation((prev) => !prev)}
                aria-expanded={showReconciliation}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-[#526058] hover:text-[#26352D] transition cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    className={`h-3.5 w-3.5 shrink-0 ${
                      consolidatedData.conciliacionExacta ? 'text-[#24875B]' : 'text-[#C44545]'
                    }`}
                  />
                  <span>Ver conciliación</span>
                </span>
                {showReconciliation ? (
                  <ChevronUp className="h-4 w-4 text-[#7A8780]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#7A8780]" />
                )}
              </button>
            </div>

            <div
              className={`${
                showReconciliation ? 'block' : 'hidden print:block'
              } px-4 py-3 border-t border-[#EFF2EF] bg-[#FAFBF8] space-y-2 text-xs text-[#526058] tabular-nums`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>Eliminación interna (Maquinarias ↔ Propiedad)</span>
                <span className="font-semibold text-[#26352D] shrink-0">
                  −{fmt(consolidatedData.operacionesInternas)}
                </span>
              </div>
              {consolidatedData.operacionesInternasCount > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span>Trabajos internos eliminados</span>
                  <span className="font-semibold text-[#26352D]">
                    {consolidatedData.operacionesInternasCount}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#E6EBE7]">
                <span>Suma de resultados (Maquinarias + Propiedad)</span>
                <strong className="text-[#26352D] shrink-0">
                  {fmt(consolidatedData.sumaResultadosModulos)}
                </strong>
              </div>
            </div>
          </div>

          {/* 2. DETALLE CONSOLIDADO (ONLY IN DETALLADO MODE) */}
          {detailLevel === 'detallado' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Ingresos frente a terceros */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#EAF5EE]/55 flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-[#24875B]">
                    Ingresos frente a terceros
                  </h4>
                  <span className="text-xs sm:text-sm font-extrabold text-[#24875B] tabular-nums">
                    {fmt(consolidatedData.ingresosConsolidados)}
                  </span>
                </div>
                <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm tabular-nums">
                  {consolidatedData.ingresosExtPorMaquina.map((r) => (
                    <div key={`ext_${r.key}`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">Maquinarias · {r.label}</span>
                      <span className="font-semibold text-[#24875B] shrink-0">
                        {fmt(r.amount)}
                      </span>
                    </div>
                  ))}
                  {consolidatedData.ingresosPropPorLote.map((r) => (
                    <div key={`prop_${r.key}`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">Propiedad · {r.label}</span>
                      <span className="font-semibold text-[#24875B] shrink-0">
                        {fmt(r.amount)}
                      </span>
                    </div>
                  ))}
                  {consolidatedData.ingresosExtPorMaquina.length === 0 &&
                    consolidatedData.ingresosPropPorLote.length === 0 && (
                      <p className="px-4 py-5 text-center text-xs text-[#7A8780]">
                        Sin ingresos frente a terceros en esta campaña.
                      </p>
                    )}
                </div>
              </div>

              {/* Gastos frente a terceros */}
              <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#EFF2EF] bg-[#FCECEC]/55 flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-[#C44545]">
                    Gastos frente a terceros
                  </h4>
                  <span className="text-xs sm:text-sm font-extrabold text-[#C44545] tabular-nums">
                    {fmt(consolidatedData.gastosConsolidados)}
                  </span>
                </div>
                <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm tabular-nums">
                  {consolidatedData.gastosMaqPorConcepto.map((r) => (
                    <div key={`gm_${r.key}`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">Maquinarias · {r.label}</span>
                      <span className="font-semibold text-[#C44545] shrink-0">
                        {fmt(r.amount)}
                      </span>
                    </div>
                  ))}
                  {consolidatedData.gastosPropPorConcepto.map((r) => (
                    <div key={`gp_${r.key}`} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-[#26352D] truncate">Propiedad · {r.label}</span>
                      <span className="font-semibold text-[#C44545] shrink-0">
                        {fmt(r.amount)}
                      </span>
                    </div>
                  ))}
                  {consolidatedData.gastosMaqPorConcepto.length === 0 &&
                    consolidatedData.gastosPropPorConcepto.length === 0 && (
                      <p className="px-4 py-5 text-center text-xs text-[#7A8780]">
                        Sin gastos frente a terceros en esta campaña.
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
