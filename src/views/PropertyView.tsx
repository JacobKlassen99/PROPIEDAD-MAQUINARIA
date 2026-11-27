import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Trees,
  CirclePlus,
  CircleMinus,
  TrendingDown,
  LandPlot,
  Tractor,
  History,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Trash2,
  Check,
  X,
  AlertCircle,
  Search,
  Calendar,
  DollarSign,
  Plus,
  Wheat,
  Receipt,
  Layers,
  Edit3,
  Sparkles,
  ClipboardList,
  Clock,
  Info,
  Save,
  Lock,
  CheckSquare,
  Square,
  RefreshCw,
  List,
} from 'lucide-react';
import { VisualIcon } from '../components/VisualIcon';
import {
  VisualExpenseItemPicker,
  VisualLotPicker,
} from '../components/VisualEntityPicker';
import {
  AppSelect,
  CurrencySelect,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
} from '../components/AppSelect';
import { ObservationField } from '../components/ObservationField';
import { Switch } from '../components/Switch';
import { useI18n } from '../services/i18n';
import { getIconDefinition } from '../services/iconCatalog';
import {
  Campaign,
  Lot,
  Expense,
  Income,
  MachineryJob,
  Currency,
  ExchangeRateConfig,
  ItemConfig,
  HarvestRecord,
  ExpenseAllocationGroup,
  Machine,
  MachineJobType,
  Customer,
  PaymentSettings,
} from '../types';
import { HarvestSalesView } from './HarvestSalesView';
import {
  createExpense,
  updateExpense,
  deleteExpense,
  updateIncome,
  deleteIncome,
  formatDateDDMMAAAA,
  hasAdminAuthorization,
  isTechnicalId,
  parseDecimalNumber,
  getHarvests,
  getPendingHarvests,
  createHarvest,
  updateHarvest,
  deleteHarvest,
  assignHarvestPrice,
  allocateExpense,
  getExpenseAllocations,
  compareChronologicalDesc,
  getMachineIcon,
  getBoliviaTodayIso,
  toBoliviaIsoDate,
} from '../services/backend';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { isDirectPropertyIncome } from '../services/financialSummary';
import { countAvailableHarvests } from '../services/harvestAvailability';
import { resolveJobDisplay } from '../services/jobDisplay';
import {
  CurrencyConversionAnchor,
  convertFormCurrencyValue,
  getLotSurfaceHa,
  isHectareUnit,
} from '../services/currencyConversion';
import {
  CompactList,
  CompactListRow,
  CompactFilter,
  ListToolbar,
} from '../components/CompactListUI';
import {
  cacheKeys,
  invalidateQueries,
  patchQueriesByPrefix,
} from '../services/dataCache';
import { usePersistedMemoryState, useSwrQuery } from '../hooks/useSwrQuery';
import type { RefreshScope } from '../App';

interface Props {
  campaigns?: Campaign[];
  activeCampaign: Campaign | null;
  lots: Lot[];
  machines: Machine[];
  machineJobTypes?: MachineJobType[];
  expenses: Expense[];
  incomes: Income[];
  jobs: MachineryJob[];
  itemsConfig: ItemConfig[];
  customers?: Customer[];
  paymentSettings?: PaymentSettings | null;
  currency: Currency;
  exchangeRate: ExchangeRateConfig;
  isAdmin?: boolean;
  isSyncingGlobal?: boolean;
  hasLoadedGlobal?: boolean;
  onRefreshData: (scope?: RefreshScope) => void;
}

type PropertyScreen =
  | 'main'
  | 'ingreso'
  | 'gasto'
  | 'lotes'
  | 'lote_trabajos'
  | 'lote_cosechas'
  | 'lote_gastos'
  | 'maquinaria_recibida'
  | 'historial'
  | 'pendientes_precio';

interface MovementItem {
  id: string;
  tipo: 'ingreso' | 'gasto_directo' | 'maquinaria_recibida' | 'cosecha';
  fecha: string;
  loteId?: string;
  loteNombre: string;
  titulo: string;
  detalle: string;
  monto: number;
  moneda: Currency;
  tipoCambio?: number;
  cantidad?: number;
  unidad?: string;
  precioUnitario?: number;
  observacion?: string;
  esTrabajoPropio?: boolean;
  trabajoId?: string;
  icono?: string;
  cosechaRecord?: HarvestRecord;
  creadoEn?: string;
}

export const PropertyView: React.FC<Props> = ({
  campaigns = [],
  activeCampaign,
  lots,
  machines = [],
  machineJobTypes = [],
  expenses,
  incomes,
  jobs,
  itemsConfig = [],
  customers = [],
  paymentSettings = null,
  currency,
  exchangeRate,
  isAdmin,
  onRefreshData,
}) => {
  const { lang, bi, t, translateUnit, translateError } = useI18n();
  const effectiveIsAdmin = isAdmin ?? hasAdminAuthorization();
  const [currentScreen, setCurrentScreen] = useState<PropertyScreen>('main');
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Strict admin guard: if admin authorization is revoked while on Ventas de cosecha, redirect to main
  useEffect(() => {
    if (!effectiveIsAdmin && currentScreen === 'pendientes_precio') {
      setCurrentScreen('main');
    }
  }, [effectiveIsAdmin, currentScreen]);

  // Search & Filters for Movimientos (persisted in memory across navigation)
  const [historialSearch, setHistorialSearch] = usePersistedMemoryState<string>('property.historial.search', '');
  const [historialFilter, setHistorialFilter] = usePersistedMemoryState<'todos' | 'ingresos' | 'gastos' | 'maquinaria' | 'distribuidos'>('property.historial.filter', 'todos');
  const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);

  // Accordion & search state for Mis lotes, Lot drill-down screens, and Trabajos de maquinaria (persisted in memory)
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);
  const [activeLotScreenId, setActiveLotScreenId] = useState<string | null>(null);
  const [lotDetailSearch, setLotDetailSearch] = useState<string>('');
  const [expandedLotDetailItemId, setExpandedLotDetailItemId] = useState<string | null>(null);
  const [lotsSearch, setLotsSearch] = usePersistedMemoryState<string>('property.lots.search', '');
  const [machineryJobsSearch, setMachineryJobsSearch] = usePersistedMemoryState<string>('property.machineryJobs.search', '');

  // State for Delete confirmation modal
  const [itemToDelete, setItemToDelete] = useState<{ id: string; tipo: 'ingreso' | 'gasto'; titulo: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  // State for Edit modal (Manual Incomes and Expenses)
  const [editingMovement, setEditingMovement] = useState<MovementItem | null>(null);
  const [editFecha, setEditFecha] = useState('');
  const [editLotId, setEditLotId] = useState('');
  const [editConcepto, setEditConcepto] = useState('');
  const [editCantidad, setEditCantidad] = useState<number | ''>(1);
  const [editUnidad, setEditUnidad] = useState('');
  const [editPrecio, setEditPrecio] = useState<number | ''>('');
  const [editMoneda, setEditMoneda] = useState<Currency>('BOB');
  const [editTc, setEditTc] = useState<number | ''>('');
  const [editObs, setEditObs] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Form State for Agricultural Expense (sin preselección de catálogo)
  const [expFecha, setExpFecha] = useState(() => getBoliviaTodayIso());
  const [expLotMode, setExpLotMode] = useState<'single' | 'multi'>('single');
  const [expLotId, setExpLotId] = useState('');
  const [expMultiLotHa, setExpMultiLotHa] = useState<Record<string, number | ''>>({});
  const [expItem, setExpItem] = useState('');
  const [expCantidad, setExpCantidad] = useState<number | ''>(1);
  const [expUnidad, setExpUnidad] = useState('');
  const [expPrecio, setExpPrecio] = useState<number | ''>('');
  const [expMoneda, setExpMoneda] = useState<Currency>('BOB');
  const [expTc, setExpTc] = useState(
    exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? String(exchangeRate.tasaBobPerUsd) : ''
  );
  const [expObs, setExpObs] = useState('');

  // UI expansion state for Distributed Expense Groups (data managed via shared SWR cache below)
  const [expandedAllocationId, setExpandedAllocationId] = useState<string | null>(null);
  const [showAllocationsPanelInGasto, setShowAllocationsPanelInGasto] = useState(false);

  // Form State for Cosecha (production only — no price, currency, buyer, or payment terms)
  const [harvFecha, setHarvFecha] = useState(() => getBoliviaTodayIso());
  const [harvCampanaId, setHarvCampanaId] = useState(activeCampaign?.id || '');
  const [harvLotId, setHarvLotId] = useState('');
  const [harvProducto, setHarvProducto] = useState('');
  const [harvUseCustomProduct, setHarvUseCustomProduct] = useState(false);
  const [harvToneladas, setHarvToneladas] = useState('');
  const [harvUnidad, setHarvUnidad] = useState('toneladas');
  const [harvObs, setHarvObs] = useState('');
  const harvIdempotencyRef = useRef<string>(`harv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // Filters for Pending / Listed Harvests (persisted in memory; data managed via shared SWR cache below)
  const [pendientesMode, setPendientesMode] = usePersistedMemoryState<'pendientes' | 'todas'>('property.pendientes.mode', 'pendientes');
  const [pendientesSearch, setPendientesSearch] = usePersistedMemoryState<string>('property.pendientes.search', '');
  const [pendientesCampaignId, setPendientesCampaignId] = usePersistedMemoryState<string>('property.pendientes.campaignId', 'all');
  const [expandedHarvestId, setExpandedHarvestId] = useState<string | null>(null);

  // State for Assigning Price to Harvest (harvest.price)
  const [selectedHarvestForPrice, setSelectedHarvestForPrice] = useState<HarvestRecord | null>(null);
  const [priceFecha, setPriceFecha] = useState(() => getBoliviaTodayIso());
  const [priceCampanaId, setPriceCampanaId] = useState(activeCampaign?.id || '');
  const [priceToneladas, setPriceToneladas] = useState('');
  const [priceUsdTon, setPriceUsdTon] = useState('');
  const [priceMoneda, setPriceMoneda] = useState<Currency>('USD');
  const [priceTc, setPriceTc] = useState(
    exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? String(exchangeRate.tasaBobPerUsd) : ''
  );
  const [savingHarvestPrice, setSavingHarvestPrice] = useState(false);
  const [priceModalError, setPriceModalError] = useState<string | null>(null);

  // Currency conversion anchors (prevent cumulative rounding drift on repeated USD <-> Bs toggles)
  const expCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);
  const editMovCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);
  const priceCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);

  // State for Editing Harvest (harvest.update — Admin only)
  const [editingHarvest, setEditingHarvest] = useState<HarvestRecord | null>(null);
  const [editHarvFecha, setEditHarvFecha] = useState('');
  const [editHarvCampanaId, setEditHarvCampanaId] = useState('');
  const [editHarvLotId, setEditHarvLotId] = useState('');
  const [editHarvProducto, setEditHarvProducto] = useState('');
  const [editHarvToneladas, setEditHarvToneladas] = useState('');
  const [editHarvUnidad, setEditHarvUnidad] = useState('t');
  const [editHarvObs, setEditHarvObs] = useState('');
  const [savingEditHarvest, setSavingEditHarvest] = useState(false);
  const [editHarvestError, setEditHarvestError] = useState<string | null>(null);

  // State for Deleting Harvest (harvest.delete — Admin only)
  const [harvestToDelete, setHarvestToDelete] = useState<HarvestRecord | null>(null);
  const [deletingHarvest, setDeletingHarvest] = useState(false);
  const [deleteHarvestError, setDeleteHarvestError] = useState<string | null>(null);

  useEffect(() => {
    if (activeCampaign?.id && !harvCampanaId) {
      setHarvCampanaId(activeCampaign.id);
    }
    if (activeCampaign?.id && !priceCampanaId) {
      setPriceCampanaId(activeCampaign.id);
    }
  }, [activeCampaign?.id, harvCampanaId, priceCampanaId]);

  useEffect(() => {
    if (exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0) {
      const rateStr = String(exchangeRate.tasaBobPerUsd);
      setPriceTc((prev) => (prev ? prev : rateStr));
      setExpTc((prev) => (prev ? prev : rateStr));
    }
  }, [exchangeRate?.tasaBobPerUsd]);

  const resetNewHarvestForm = () => {
    setHarvFecha(getBoliviaTodayIso());
    setHarvCampanaId(activeCampaign?.id || '');
    setHarvLotId('');
    setHarvProducto('');
    setHarvUseCustomProduct(false);
    setHarvToneladas('');
    setHarvUnidad('toneladas');
    setHarvObs('');
    harvIdempotencyRef.current = `harv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setErrorMsg(null);
  };

  const resetNewExpenseForm = () => {
    expCurrencyAnchorRef.current = null;
    setExpFecha(getBoliviaTodayIso());
    setExpLotMode('single');
    setExpLotId('');
    setExpMultiLotHa({});
    setExpItem('');
    setExpCantidad(1);
    setExpUnidad('');
    setExpPrecio('');
    setExpMoneda('BOB');
    setExpTc(
      exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
        ? String(exchangeRate.tasaBobPerUsd)
        : ''
    );
    setExpObs('');
    setErrorMsg(null);
  };

  // Automatic USD <-> Bs conversion handlers across all property forms

  const handleExpCurrencyChange = (nextCurr: Currency) => {
    const res = convertFormCurrencyValue({
      currentValue: expPrecio,
      fromCurrency: expMoneda,
      toCurrency: nextCurr,
      tc: expTc,
      anchor: expCurrencyAnchorRef.current,
    });
    if (res.error) {
      setErrorMsg(translateError(res.error));
      return;
    }
    if (!res.converted) return;
    expCurrencyAnchorRef.current = res.nextAnchor;
    setExpMoneda(res.currency);
    setExpPrecio(res.valueNum);
    setErrorMsg(null);
  };

  const handleEditMovCurrencyChange = (nextCurr: Currency) => {
    const res = convertFormCurrencyValue({
      currentValue: editPrecio,
      fromCurrency: editMoneda,
      toCurrency: nextCurr,
      tc: editTc,
      anchor: editMovCurrencyAnchorRef.current,
    });
    if (res.error) {
      setErrorMsg(translateError(res.error));
      return;
    }
    if (!res.converted) return;
    editMovCurrencyAnchorRef.current = res.nextAnchor;
    setEditMoneda(res.currency);
    setEditPrecio(res.valueNum);
    setErrorMsg(null);
  };

  const handlePriceCurrencyChange = (nextCurr: Currency) => {
    const res = convertFormCurrencyValue({
      currentValue: priceUsdTon,
      fromCurrency: priceMoneda,
      toCurrency: nextCurr,
      tc: priceTc,
      anchor: priceCurrencyAnchorRef.current,
    });
    if (res.error) {
      setPriceModalError(translateError(res.error));
      return;
    }
    if (!res.converted) return;
    priceCurrencyAnchorRef.current = res.nextAnchor;
    setPriceMoneda(res.currency);
    setPriceUsdTon(res.valueStr);
    setPriceModalError(null);
  };

  // Shared SWR query: pending harvests (reused by Main badge, Pendientes de precio, and Asignar precio)
  const pendingHarvestsQuery = useSwrQuery<HarvestRecord[]>(
    cacheKeys.harvestPending(),
    () => getPendingHarvests(false),
    { enabled: true, minIntervalMs: 3000 }
  );

  // Shared SWR query: all harvests list (used by Main counter, Historial, Lotes, and Pendientes "Todas")
  const allHarvestsTargetCamp =
    currentScreen === 'pendientes_precio'
      ? pendientesCampaignId
      : activeCampaign?.id || 'all';
  const allHarvestsKey = cacheKeys.harvestList(allHarvestsTargetCamp);
  const allHarvestsQuery = useSwrQuery<HarvestRecord[]>(
    allHarvestsKey,
    () =>
      getHarvests(
        {
          ...(allHarvestsTargetCamp && allHarvestsTargetCamp !== 'all'
            ? { campanaId: allHarvestsTargetCamp }
            : {}),
          soloPendientes: false,
        },
        false
      ),
    {
      enabled:
        currentScreen === 'main' ||
        currentScreen === 'historial' ||
        currentScreen === 'lotes' ||
        (currentScreen === 'pendientes_precio' && pendientesMode === 'todas'),
      minIntervalMs: 2500,
    }
  );

  // Shared SWR query: distributed expense groups (used in Gasto panel and Historial -> Distribuidos)
  const allocationsKey = cacheKeys.expenseAllocations(activeCampaign?.id);
  const expenseAllocationsQuery = useSwrQuery<ExpenseAllocationGroup[]>(
    allocationsKey,
    () =>
      getExpenseAllocations(
        activeCampaign?.id ? { campanaId: activeCampaign.id } : {},
        false
      ),
    {
      enabled:
        currentScreen === 'gasto' ||
        (currentScreen === 'historial' && historialFilter === 'distribuidos'),
      minIntervalMs: 3000,
    }
  );

  const pendingHarvests = pendingHarvestsQuery.data ?? [];
  const pendingHarvestsHasLoaded = pendingHarvestsQuery.hasLoaded;
  const pendingHarvestsLoading = pendingHarvestsQuery.isFetching;
  const pendingHarvestsInitialLoading = pendingHarvestsQuery.isInitialLoading;
  const pendingHarvestsRevalidating = pendingHarvestsQuery.isRevalidating;
  const pendingHarvestsError = pendingHarvestsQuery.error;

  const pendingHarvestsCount = useMemo(() => {
    if (!pendingHarvestsQuery.hasLoaded) return null;
    return countAvailableHarvests(pendingHarvestsQuery.data || []);
  }, [pendingHarvestsQuery.hasLoaded, pendingHarvestsQuery.data]);

  const allHarvestsList = allHarvestsQuery.data ?? [];
  const activeHarvestQuery = pendientesMode === 'pendientes' ? pendingHarvestsQuery : allHarvestsQuery;
  const harvestsHasLoaded = activeHarvestQuery.hasLoaded;
  const harvestsLoading = activeHarvestQuery.isFetching;
  const harvestsInitialLoading = activeHarvestQuery.isInitialLoading;
  const harvestsRevalidating = activeHarvestQuery.isRevalidating;
  const harvestsError = activeHarvestQuery.error;

  const expenseAllocations = expenseAllocationsQuery.data ?? [];
  const allocationsHasLoaded = expenseAllocationsQuery.hasLoaded;
  const allocationsLoading = expenseAllocationsQuery.isFetching;
  const allocationsInitialLoading = expenseAllocationsQuery.isInitialLoading;
  const allocationsRevalidating = expenseAllocationsQuery.isRevalidating;
  const allocationsError = expenseAllocationsQuery.error;

  const loadPendingHarvests = useCallback(async () => {
    await pendingHarvestsQuery.refresh();
  }, [pendingHarvestsQuery]);

  const loadAllHarvests = useCallback(async () => {
    await allHarvestsQuery.refresh();
  }, [allHarvestsQuery]);

  const loadExpenseAllocations = useCallback(async () => {
    await expenseAllocationsQuery.refresh();
  }, [expenseAllocationsQuery]);

  const patchHarvestAcrossCaches = useCallback((updated: HarvestRecord) => {
    if (!updated || !updated.id) return;
    patchQueriesByPrefix<HarvestRecord[]>('harvest.pending:', (list) => {
      const exists = list.some((h) => String(h.id) === String(updated.id));
      const mapped = exists
        ? list.map((h) => (String(h.id) === String(updated.id) ? { ...h, ...updated } : h))
        : [updated, ...list];
      return mapped.filter((h) => h.pendiente > 0.0001);
    });
    patchQueriesByPrefix<HarvestRecord[]>('harvest.list:', (list) => {
      const exists = list.some((h) => String(h.id) === String(updated.id));
      return exists
        ? list.map((h) => (String(h.id) === String(updated.id) ? { ...h, ...updated } : h))
        : [updated, ...list];
    });
  }, []);

  const removeHarvestFromCaches = useCallback((harvestId: string) => {
    if (!harvestId) return;
    patchQueriesByPrefix<HarvestRecord[]>('harvest.pending:', (list) =>
      list.filter((h) => String(h.id) !== String(harvestId))
    );
    patchQueriesByPrefix<HarvestRecord[]>('harvest.list:', (list) =>
      list.filter((h) => String(h.id) !== String(harvestId))
    );
  }, []);

  const propertyExpenses = (expenses || []).filter((e) => e.modulo === 'propiedad');
  const propertyIncomes = incomes || [];
  const linkedPropertyJobs = (jobs || []).filter((j) => j.tipoTrabajo === 'propiedad');

  const propertyExpenseItems = (itemsConfig || []).filter(
    (item) =>
      item.activo !== false &&
      item.clase !== 'INGRESO' &&
      ((item.modulo === 'PROPIEDAD' && item.clase === 'GASTO') ||
        item.tipo === 'gasto_propiedad')
  );

  const propertyIncomeItems = (itemsConfig || []).filter(
    (item) =>
      item.activo !== false &&
      ((item.modulo === 'PROPIEDAD' && item.clase === 'INGRESO') ||
        item.tipo === 'ingreso_propiedad')
  );

  const propertyExpenseDirects = propertyExpenses.filter((e) => !e.esTrabajoPropio && !e.trabajoId);
  const propertyIncomeDirects = propertyIncomes.filter(isDirectPropertyIncome);

  const formatConcept = (raw: string | undefined): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  const formatTC = (tc: number | undefined | null) => {
    if (!tc) return '';
    return String(tc).replace('.', ',');
  };

  const formatHarvestQty = (qty: number | undefined | null, unit?: string): string => {
    const num = Number(qty || 0);
    const formatted = num.toLocaleString(lang === 'es' ? 'es-BO' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const cleanUnit = (unit || 't').trim() || 't';
    return `${formatted} ${translateUnit(cleanUnit)}`;
  };

  // Use all harvests loaded for the active campaign (fallback to pendingHarvests filtered by campaign until allHarvests resolves)
  const historyHarvestsSource: HarvestRecord[] = allHarvestsQuery.hasLoaded
    ? allHarvestsList
    : pendingHarvests.filter((h) => !activeCampaign?.id || String(h.campanaId) === String(activeCampaign.id));

  // Build combined chronological records for Historial (legacy direct incomes, direct expenses, and all physical harvests — no duplicates)
  const allMovements: MovementItem[] = [
    ...propertyIncomeDirects.map((i) => ({
      id: i.id,
      tipo: 'ingreso' as const,
      fecha: i.fecha,
      loteId: i.loteId,
      loteNombre: i.loteNombre || (lots.find((l) => l.id === i.loteId)?.nombre) || bi('Lote', 'Lot'),
      titulo: formatConcept(i.concepto),
      detalle: `${i.cantidad} ${translateUnit(i.unidad || '')} ${i.precio ? `@ ${i.moneda === 'USD' ? 'USD' : 'Bs'} ${i.precio}` : ''} ${i.observacion ? `• ${i.observacion}` : ''}`.trim(),
      monto: i.total,
      moneda: (i.moneda === 'USD' ? 'USD' : 'BOB') as Currency,
      tipoCambio: i.tipoCambio || i.tc || exchangeRate?.tasaBobPerUsd,
      cantidad: i.cantidad,
      unidad: i.unidad,
      precioUnitario: i.precio,
      observacion: i.observacion,
      icono:
        i.icono ||
        (itemsConfig.find((it) => it.nombre.toLowerCase() === i.concepto.toLowerCase())?.icono) ||
        getIconDefinition(i.concepto, 'ingreso').id,
      creadoEn: i.creadoEn,
    })),
    ...propertyExpenseDirects.map((e) => ({
      id: e.id,
      tipo: 'gasto_directo' as const,
      fecha: e.fecha,
      loteId: e.loteId,
      loteNombre: e.loteNombre || (lots.find((l) => l.id === e.loteId)?.nombre) || bi('Lote', 'Lot'),
      titulo: formatConcept(e.itemGasto),
      detalle: `${e.cantidad} ${translateUnit(e.unidad || '')} ${e.precio ? `@ ${e.moneda === 'USD' ? 'USD' : 'Bs'} ${e.precio}` : ''} ${e.observacion ? `• ${e.observacion}` : ''}`.trim(),
      monto: e.total,
      moneda: (e.moneda === 'USD' ? 'USD' : 'BOB') as Currency,
      tipoCambio: e.tipoCambio || e.tc || exchangeRate?.tasaBobPerUsd,
      cantidad: e.cantidad,
      unidad: e.unidad,
      precioUnitario: e.precio,
      observacion: e.observacion,
      esTrabajoPropio: false,
      trabajoId: e.trabajoId,
      icono: e.icono || (itemsConfig.find((it) => it.nombre.toLowerCase() === e.itemGasto.toLowerCase())?.icono) || 'semillas',
      creadoEn: e.creadoEn,
    })),
    ...historyHarvestsSource.map((h) => {
      const unitStr = h.unidad || 't';
      return {
        id: `harv_${h.id}`,
        tipo: 'cosecha' as const,
        fecha: h.fecha,
        loteId: h.loteId,
        loteNombre: h.loteNombre || (lots.find((l) => String(l.id) === String(h.loteId))?.nombre) || bi('Lote', 'Lot'),
        titulo: `${bi('Cosecha', 'Harvest')} ${formatConcept(h.producto)}`,
        detalle: `${formatHarvestQty(h.toneladas, unitStr)}${h.observacion ? ` • ${h.observacion}` : ''}`,
        monto: 0,
        moneda: 'USD' as Currency,
        cantidad: h.toneladas,
        unidad: unitStr,
        observacion: h.observacion,
        icono:
          (itemsConfig.find((it) => it.nombre.trim().toLowerCase() === String(h.producto || '').trim().toLowerCase())?.icono) ||
          getIconDefinition(h.producto, 'ingreso').id ||
          'granos',
        cosechaRecord: h,
        creadoEn: h.creadoEn,
      };
    }),
  ].sort(compareChronologicalDesc);

  // Total records count (matches exact number of records shown in Historial -> Todos)
  const totalMovementsCount = allMovements.length;

  // Helpers for multi-lot proportional expense distribution
  const toggleMultiLot = (lot: Lot) => {
    setExpMultiLotHa((prev) => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, lot.id)) {
        delete next[lot.id];
      } else {
        const defaultHa = Number(lot.superficieHectareas || lot.superficie || 0);
        next[lot.id] = defaultHa > 0 ? defaultHa : '';
      }
      return next;
    });
  };

  const updateMultiLotHa = (lotId: string, val: number | '') => {
    setExpMultiLotHa((prev) => ({
      ...prev,
      [lotId]: val,
    }));
  };

  const selectedMultiLots = lots.filter((l) =>
    Object.prototype.hasOwnProperty.call(expMultiLotHa, l.id)
  );
  const totalMultiLotHa = selectedMultiLots.reduce((sum, l) => {
    const ha = Number(expMultiLotHa[l.id]) || 0;
    return sum + (ha > 0 ? ha : 0);
  }, 0);

  const expCalculatedTotalPreview =
    (Number(expCantidad) || 0) * (Number(expPrecio) || 0);

  const multiLotBreakdown = (() => {
    if (selectedMultiLots.length === 0 || totalMultiLotHa <= 0) return [];
    const totalRounded = Number(expCalculatedTotalPreview.toFixed(2));
    const totalQty = Number(expCantidad) || 1;
    const precioUnit = Number(expPrecio) || 0;
    let accAmount = 0;
    let accQty = 0;

    return selectedMultiLots.map((lot, idx) => {
      const ha = Number(expMultiLotHa[lot.id]) || 0;
      const ratio = totalMultiLotHa > 0 ? ha / totalMultiLotHa : 0;
      const isLast = idx === selectedMultiLots.length - 1;
      const lotAmount = isLast
        ? Number((totalRounded - accAmount).toFixed(2))
        : Number((totalRounded * ratio).toFixed(2));
      accAmount = Number((accAmount + lotAmount).toFixed(2));

      let lotQty: number;
      let lotUnitPrice: number;
      if (Math.abs(totalQty - 1) < 0.0001) {
        lotQty = 1;
        lotUnitPrice = lotAmount;
      } else {
        lotQty = isLast
          ? Number(Math.max(0.001, totalQty - accQty).toFixed(3))
          : Number((totalQty * ratio).toFixed(3));
        accQty = Number((accQty + lotQty).toFixed(3));
        lotUnitPrice = precioUnit;
      }

      return {
        lot,
        ha,
        pct: ratio * 100,
        amount: lotAmount,
        qty: lotQty,
        unitPrice: lotUnitPrice,
      };
    });
  })();

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!activeCampaign) {
      setErrorMsg(bi('Debes seleccionar o activar una campaña activa.', 'You must select or activate an active campaign.'));
      return;
    }

    if (!expItem.trim()) {
      setErrorMsg(bi('Selecciona un insumo o concepto de gasto.', 'Select an input or expense concept.'));
      return;
    }

    if (!expPrecio || Number(expPrecio) <= 0) {
      setErrorMsg(bi('Ingresa un precio unitario válido.', 'Enter a valid unit price.'));
      return;
    }

    const cantNum = Number(expCantidad) || 1;
    if (cantNum <= 0) {
      setErrorMsg(bi('La cantidad debe ser mayor a 0.', 'Quantity must be greater than 0.'));
      return;
    }

    const tcNum = parseDecimalNumber(expTc);
    if (tcNum <= 0) {
      setErrorMsg(bi('Ingresa un tipo de cambio válido mayor a 0.', 'Enter a valid exchange rate greater than 0.'));
      return;
    }

    const selectedItemObj = propertyExpenseItems.find(
      (it) => it.nombre.toLowerCase() === expItem.toLowerCase()
    );
    const totalExp = Number((cantNum * Number(expPrecio)).toFixed(2));

    // MODE A: Single lot (preserves exact existing behavior)
    if (expLotMode === 'single') {
      if (!expLotId) {
        setErrorMsg(bi('Selecciona un lote obligatorio para el gasto agrícola.', 'Select a required lot for the agricultural expense.'));
        return;
      }

      const lotObj = lots.find((l) => l.id === expLotId);
      setSaving(true);
      try {
        await createExpense({
          fecha: expFecha,
          campanaId: activeCampaign.id,
          modulo: 'propiedad',
          loteId: expLotId,
          loteNombre: lotObj?.nombre,
          itemGasto: expItem,
          icono: selectedItemObj?.icono,
          cantidad: cantNum,
          unidad: expUnidad,
          precio: Number(expPrecio),
          moneda: expMoneda,
          tipoCambio: tcNum,
          total: totalExp,
          observacion: expObs.trim(),
        });

        setSuccessMsg(bi('Gasto agrícola registrado en el lote seleccionado.', 'Agricultural expense recorded for the selected lot.'));
        setExpLotId('');
        setExpItem('');
        setExpCantidad(1);
        setExpUnidad('');
        setExpPrecio('');
        setExpObs('');
        setExpTc(
          exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
            ? String(exchangeRate.tasaBobPerUsd)
            : ''
        );
        setCurrentScreen('main');
        onRefreshData('movements');
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error
            ? translateError(err.message)
            : bi('Error al registrar el gasto agrícola', 'Error recording the agricultural expense')
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    // MODE B: Multiple lots (2+) — EXCLUSIVELY via single backend call expense.allocate
    if (selectedMultiLots.length < 2) {
      setErrorMsg(
        bi(
          'Selecciona al menos 2 lotes para distribuir el gasto. Para registrar en un solo lote, utiliza la opción «Un lote».',
          'Select at least 2 lots to distribute the expense. To record on a single lot, use the "One lot" option.'
        )
      );
      return;
    }

    const invalidLot = selectedMultiLots.find((l) => {
      const ha = Number(expMultiLotHa[l.id]);
      return isNaN(ha) || ha <= 0;
    });
    if (invalidLot) {
      setErrorMsg(
        bi(
          `Ingresa las hectáreas trabajadas (mayores a 0) para ${invalidLot.nombre}.`,
          `Enter worked hectares (greater than 0) for ${invalidLot.nombre}.`
        )
      );
      return;
    }

    if (totalMultiLotHa <= 0 || multiLotBreakdown.length < 2) {
      setErrorMsg(
        bi(
          'El total de hectáreas trabajadas debe ser mayor a 0 en al menos dos lotes.',
          'Total worked hectares must be greater than 0 across at least two lots.'
        )
      );
      return;
    }

    if (saving) return;
    setSaving(true);
    setSavingProgress(
      bi(
        `Distribuyendo gasto entre ${multiLotBreakdown.length} lotes...`,
        `Distributing expense across ${multiLotBreakdown.length} lots...`
      )
    );
    try {
      await allocateExpense({
        fecha: expFecha,
        campanaId: activeCampaign.id,
        descripcion: expItem.trim(),
        importe: totalExp,
        moneda: expMoneda,
        tc: tcNum,
        lotes: multiLotBreakdown.map((entry) => ({
          loteId: entry.lot.id,
          hectareas: entry.ha,
        })),
        itemId: selectedItemObj?.id || '',
        observacion: expObs.trim(),
      });

      const formattedAmt = `${expMoneda === 'USD' ? 'USD' : 'Bs'} ${totalExp.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      setSuccessMsg(
        bi(
          `Gasto distribuido proporcionalmente en ${multiLotBreakdown.length} lotes (${formattedAmt}).`,
          `Expense proportionally distributed across ${multiLotBreakdown.length} lots (${formattedAmt}).`
        )
      );
      setExpLotId('');
      setExpItem('');
      setExpCantidad(1);
      setExpUnidad('');
      setExpPrecio('');
      setExpObs('');
      setExpMultiLotHa({});
      setExpLotMode('single');
      setExpTc(
        exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
          ? String(exchangeRate.tasaBobPerUsd)
          : ''
      );
      setCurrentScreen('main');
      invalidateQueries(['expense.allocations']);
      onRefreshData('movements');
      loadExpenseAllocations();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi(
              'Error al registrar el gasto distribuido en el backend (expense.allocate).',
              'Error recording distributed expense on the server (expense.allocate).'
            )
      );
    } finally {
      setSavingProgress(null);
      setSaving(false);
    }
  };

  // Submit Cosecha (production only — increases warehouse stock, creates NO financial income)
  const handleCreateHarvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetCampId = harvCampanaId || activeCampaign?.id || '';
    if (!targetCampId) {
      setErrorMsg(bi('Selecciona una campaña para registrar la cosecha.', 'Select a campaign to record the harvest.'));
      return;
    }
    if (!harvLotId) {
      setErrorMsg(bi('Selecciona el lote donde se realizó la cosecha.', 'Select the lot where the harvest took place.'));
      return;
    }
    if (!harvProducto.trim()) {
      setErrorMsg(bi('Ingresa el producto o concepto cosechado.', 'Enter the harvested product or concept.'));
      return;
    }
    const qtyNum = parseDecimalNumber(harvToneladas);
    if (qtyNum <= 0) {
      setErrorMsg(bi('Ingresa una cantidad válida mayor a 0.', 'Enter a valid quantity greater than 0.'));
      return;
    }

    const unitToSave = (harvUnidad || 'toneladas').trim() || 'toneladas';

    setSaving(true);
    try {
      const createdHarvest = await createHarvest({
        fecha: harvFecha,
        campanaId: targetCampId,
        loteId: harvLotId,
        producto: harvProducto.trim(),
        toneladas: qtyNum,
        unidad: unitToSave,
        observacion: harvObs.trim(),
        idempotencyKey: harvIdempotencyRef.current,
      });

      if (createdHarvest?.id) {
        patchHarvestAcrossCaches(createdHarvest);
      }
      const qtyStr = (createdHarvest?.toneladas || qtyNum).toLocaleString('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const displayUnit = createdHarvest?.unidad || 't';
      setSuccessMsg(
        bi(
          `Cosecha registrada en almacén (${qtyStr} ${displayUnit} de ${harvProducto.trim()}).`,
          `Harvest added to warehouse (${qtyStr} ${displayUnit} of ${harvProducto.trim()}).`
        )
      );
      resetNewHarvestForm();
      setCurrentScreen('main');
      invalidateQueries(['harvest.', 'harvestSale.', 'report.']);
      await loadPendingHarvests();
      if (allHarvestsQuery.hasLoaded) {
        loadAllHarvests().catch(() => {});
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi(
              'Error al registrar cosecha (harvest.create).',
              'Error recording harvest (harvest.create).'
            )
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAssignPrice = (harvest: HarvestRecord) => {
    priceCurrencyAnchorRef.current = null;
    setSelectedHarvestForPrice(harvest);
    setPriceFecha(getBoliviaTodayIso());
    setPriceCampanaId(activeCampaign?.id || harvest.campanaId || '');
    setPriceToneladas(harvest.pendiente > 0 ? String(Number(harvest.pendiente.toFixed(4))) : '');
    setPriceUsdTon('');
    setPriceMoneda('USD');
    setPriceTc(
      exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
        ? String(exchangeRate.tasaBobPerUsd)
        : ''
    );
    setPriceModalError(null);
  };

  // Submit price assignment to pending harvest (harvest.price — backend creates income automatically)
  const handleAssignHarvestPriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHarvestForPrice || savingHarvestPrice) return;
    setPriceModalError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    const tonsNum = parseDecimalNumber(priceToneladas);
    const precioInputNum = parseDecimalNumber(priceUsdTon);
    const tcNum = parseDecimalNumber(priceTc);
    const targetCampId = priceCampanaId || activeCampaign?.id || selectedHarvestForPrice.campanaId || '';

    if (!targetCampId) {
      setPriceModalError(bi('Selecciona la campaña para registrar el ingreso.', 'Select the campaign to record the income.'));
      return;
    }
    if (tonsNum <= 0) {
      setPriceModalError(bi('Ingresa una cantidad de toneladas mayor a 0.', 'Enter a quantity of tons greater than 0.'));
      return;
    }
    if (tonsNum > selectedHarvestForPrice.pendiente + 0.0001) {
      const pendStr = selectedHarvestForPrice.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
      setPriceModalError(
        bi(
          `No puedes asignar más de ${pendStr} t pendientes.`,
          `You cannot assign more than ${pendStr} pending t.`
        )
      );
      return;
    }
    if (precioInputNum <= 0) {
      const currStr = priceMoneda === 'USD' ? 'USD' : 'Bs';
      setPriceModalError(
        bi(
          `Ingresa un precio ${currStr}/tonelada mayor a 0.`,
          `Enter a ${currStr}/ton price greater than 0.`
        )
      );
      return;
    }
    if (tcNum <= 0) {
      setPriceModalError(bi('Ingresa un tipo de cambio válido mayor a 0.', 'Enter a valid exchange rate greater than 0.'));
      return;
    }

    // GAS harvest.price expects precioUsdTon; if user entered in Bs, convert accurately using TC (or exact USD anchor)
    const anchor = priceCurrencyAnchorRef.current;
    const canUseExactUsdAnchor =
      priceMoneda === 'BOB' &&
      anchor !== null &&
      anchor.baseCurrency === 'USD' &&
      anchor.lastCurrency === 'BOB' &&
      Math.abs(anchor.lastDisplayedValue - precioInputNum) < 0.005 &&
      Math.abs(anchor.lastTc - tcNum) < 0.0001;
    const precioUsdTonToSend =
      priceMoneda === 'USD'
        ? precioInputNum
        : canUseExactUsdAnchor
        ? Number(anchor!.baseAmount.toFixed(4))
        : Number((precioInputNum / tcNum).toFixed(4));

    setSavingHarvestPrice(true);
    try {
      const priceRes = await assignHarvestPrice({
        cosechaId: selectedHarvestForPrice.id,
        fecha: priceFecha,
        campanaId: targetCampId,
        toneladas: tonsNum,
        precioUsdTon: precioUsdTonToSend,
        tc: tcNum,
      });

      if (priceRes?.cosecha) {
        patchHarvestAcrossCaches(priceRes.cosecha);
      }
      const totalUsd = tonsNum * precioUsdTonToSend;
      const tonsStr = tonsNum.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const priceStr = precioUsdTonToSend.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const totalStr = totalUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      setSuccessMsg(
        bi(
          `Precio asignado: ${tonsStr} t a USD ${priceStr}/t (USD ${totalStr}). El ingreso fue generado por el servidor.`,
          `Price assigned: ${tonsStr} t at USD ${priceStr}/t (USD ${totalStr}). Income was generated by the server.`
        )
      );
      priceCurrencyAnchorRef.current = null;
      setSelectedHarvestForPrice(null);
      setPriceToneladas('');
      setPriceUsdTon('');
      setPriceMoneda('USD');

      // Selective invalidation & refresh: harvests + movements (backend created the Property income)
      invalidateQueries(['harvest.']);
      await loadPendingHarvests();
      if (pendientesMode === 'todas' || allHarvestsQuery.hasLoaded) {
        loadAllHarvests().catch(() => {});
      }
      onRefreshData('movements');
    } catch (err: unknown) {
      setPriceModalError(
        err instanceof Error
          ? translateError(err.message)
          : bi(
              'Error al asignar precio a la cosecha (harvest.price).',
              'Error assigning price to harvest (harvest.price).'
            )
      );
    } finally {
      setSavingHarvestPrice(false);
    }
  };

  const handleOpenEditHarvest = (harvest: HarvestRecord) => {
    if (!effectiveIsAdmin) {
      setErrorMsg(bi('Solo el Administrador puede editar cosechas registradas.', 'Only the Administrator can edit recorded harvests.'));
      return;
    }
    setEditingHarvest(harvest);
    setEditHarvFecha(toBoliviaIsoDate(harvest.fecha, true));
    setEditHarvCampanaId(harvest.campanaId || activeCampaign?.id || '');
    setEditHarvLotId(harvest.loteId || '');
    setEditHarvProducto(harvest.producto || '');
    setEditHarvToneladas(harvest.toneladas > 0 ? String(Number(harvest.toneladas.toFixed(4))) : '');
    setEditHarvUnidad(harvest.unidad || 't');
    setEditHarvObs(harvest.observacion || '');
    setEditHarvestError(null);
  };

  const handleSaveEditHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHarvest || savingEditHarvest) return;
    if (!effectiveIsAdmin) {
      setEditHarvestError(bi('Solo el Administrador puede editar cosechas registradas.', 'Only the Administrator can edit recorded harvests.'));
      return;
    }
    setEditHarvestError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    const hasAsignaciones =
      (editingHarvest.asignadas || 0) > 0.0001 ||
      (Array.isArray(editingHarvest.asignaciones) && editingHarvest.asignaciones.length > 0);
    const tonsNum = parseDecimalNumber(editHarvToneladas);
    const unitLabel = translateUnit(editHarvUnidad || editingHarvest.unidad || 't');

    if (!editHarvFecha) {
      setEditHarvestError(bi('La fecha de cosecha es obligatoria.', 'Harvest date is required.'));
      return;
    }
    if (!editHarvCampanaId) {
      setEditHarvestError(bi('Selecciona la campaña.', 'Select the campaign.'));
      return;
    }
    if (!editHarvLotId) {
      setEditHarvestError(bi('Selecciona el lote.', 'Select the lot.'));
      return;
    }
    if (!editHarvProducto.trim()) {
      setEditHarvestError(bi('Indica el producto cosechado.', 'Enter the harvested product.'));
      return;
    }
    if (tonsNum <= 0) {
      setEditHarvestError(bi('La cantidad debe ser mayor a 0.', 'Quantity must be greater than 0.'));
      return;
    }
    if (hasAsignaciones && tonsNum + 0.0001 < editingHarvest.asignadas) {
      const assignedStr = editingHarvest.asignadas.toLocaleString(lang === 'es' ? 'es-BO' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
      });
      setEditHarvestError(
        bi(
          `No puedes reducir la cantidad por debajo de las cantidades ya comprometidas en ventas (${assignedStr} ${unitLabel}).`,
          `You cannot reduce the quantity below the amount already committed in sales (${assignedStr} ${unitLabel}).`
        )
      );
      return;
    }

    setSavingEditHarvest(true);
    try {
      const updatedHarvest = await updateHarvest(editingHarvest.id, {
        fecha: editHarvFecha,
        campanaId: hasAsignaciones ? editingHarvest.campanaId : editHarvCampanaId,
        loteId: hasAsignaciones ? editingHarvest.loteId : editHarvLotId,
        producto: hasAsignaciones ? editingHarvest.producto : editHarvProducto.trim(),
        unidad: hasAsignaciones ? (editingHarvest.unidad || 't') : (editHarvUnidad || 't'),
        toneladas: tonsNum,
        observacion: editHarvObs.trim(),
      });

      if (updatedHarvest?.id) {
        patchHarvestAcrossCaches(updatedHarvest);
      }
      setEditingHarvest(null);
      setSuccessMsg(
        bi(
          'Cosecha actualizada correctamente en Google Sheets.',
          'Harvest updated successfully in Google Sheets.'
        )
      );
      invalidateQueries(['harvest.', 'harvestSale.', 'report.']);
      await Promise.allSettled([loadPendingHarvests(), loadAllHarvests()]);
    } catch (err: unknown) {
      setEditHarvestError(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al actualizar la cosecha (harvest.update).', 'Error updating harvest (harvest.update).')
      );
    } finally {
      setSavingEditHarvest(false);
    }
  };

  const handlePromptDeleteHarvest = (harvest: HarvestRecord) => {
    if (!effectiveIsAdmin) {
      setErrorMsg(
        bi(
          'Solo el Administrador puede eliminar cosechas guardadas.',
          'Only the Administrator can delete saved harvests.'
        )
      );
      return;
    }
    setDeleteHarvestError(null);
    setHarvestToDelete(harvest);
  };

  const handleConfirmDeleteHarvest = async () => {
    if (!harvestToDelete || deletingHarvest) return;
    if (!effectiveIsAdmin) {
      setDeleteHarvestError(
        bi(
          'Solo el Administrador puede eliminar cosechas guardadas.',
          'Only the Administrator can delete saved harvests.'
        )
      );
      return;
    }
    setDeletingHarvest(true);
    setDeleteHarvestError(null);
    setErrorMsg(null);
    try {
      await deleteHarvest(harvestToDelete.id);
      removeHarvestFromCaches(harvestToDelete.id);
      setHarvestToDelete(null);
      setExpandedMovementId(null);
      setSuccessMsg(
        bi(
          'Cosecha eliminada correctamente y descontada del almacén.',
          'Harvest deleted successfully and deducted from warehouse.'
        )
      );
      invalidateQueries(['harvest.', 'harvestSale.', 'report.']);
      await Promise.allSettled([loadPendingHarvests(), loadAllHarvests()]);
    } catch (err: unknown) {
      setDeleteHarvestError(
        err instanceof Error
          ? translateError(err.message)
          : bi('No se pudo eliminar la cosecha.', 'Could not delete the harvest.')
      );
    } finally {
      setDeletingHarvest(false);
    }
  };

  // Open Edit Modal for a manual expense or income (Admin only)
  const handleOpenEditMovement = (m: MovementItem) => {
    if (!effectiveIsAdmin) {
      setErrorMsg(bi('Solo el Administrador puede editar movimientos guardados.', 'Only the Administrator can edit saved records.'));
      return;
    }
    editMovCurrencyAnchorRef.current = null;
    setEditingMovement(m);
    setEditFecha(toBoliviaIsoDate(m.fecha, true));
    setEditLotId(m.loteId || '');
    setEditConcepto(m.titulo || '');
    setEditCantidad(typeof m.cantidad === 'number' && !isNaN(m.cantidad) ? m.cantidad : 1);
    setEditUnidad(m.unidad || (m.tipo === 'ingreso' ? 'toneladas' : 'unidades'));
    setEditPrecio(
      typeof m.precioUnitario === 'number' && !isNaN(m.precioUnitario)
        ? m.precioUnitario
        : m.monto && m.cantidad
        ? m.monto / m.cantidad
        : ''
    );
    setEditMoneda(m.moneda || 'BOB');
    setEditTc(m.tipoCambio || exchangeRate?.tasaBobPerUsd || 6.96);
    setEditObs(m.observacion || '');
  };

  const handleSaveEditMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovement) return;
    if (!effectiveIsAdmin) {
      setErrorMsg(bi('Solo el Administrador puede modificar movimientos guardados.', 'Only the Administrator can modify saved records.'));
      setEditingMovement(null);
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    const cantNum = Number(editCantidad);
    const precioNum = Number(editPrecio);
    if (isNaN(cantNum) || cantNum <= 0) {
      setErrorMsg(bi('La cantidad debe ser mayor a 0.', 'Quantity must be greater than 0.'));
      return;
    }
    if (isNaN(precioNum) || precioNum < 0) {
      setErrorMsg(bi('El precio unitario no puede ser negativo.', 'Unit price cannot be negative.'));
      return;
    }
    const totalCalc = cantNum * precioNum;
    const tcNum = Number(editTc) > 0 ? Number(editTc) : (exchangeRate?.tasaBobPerUsd || 6.96);
    const lotObj = lots.find((l) => l.id === editLotId);

    setSavingEdit(true);
    try {
      if (editingMovement.tipo === 'gasto_directo') {
        await updateExpense(editingMovement.id, {
          fecha: editFecha,
          loteId: editLotId || undefined,
          loteNombre: lotObj?.nombre || undefined,
          itemGasto: editConcepto.trim(),
          cantidad: cantNum,
          unidad: editUnidad.trim(),
          precio: precioNum,
          moneda: editMoneda,
          tipoCambio: tcNum,
          total: totalCalc,
          observacion: editObs.trim(),
        });
        setSuccessMsg(bi('Gasto agrícola actualizado en Google Sheets.', 'Agricultural expense updated in Google Sheets.'));
      } else if (editingMovement.tipo === 'ingreso') {
        await updateIncome(editingMovement.id, {
          fecha: editFecha,
          loteId: editLotId || undefined,
          loteNombre: lotObj?.nombre || undefined,
          concepto: editConcepto.trim(),
          cantidad: cantNum,
          unidad: editUnidad.trim(),
          precio: precioNum,
          moneda: editMoneda,
          tipoCambio: tcNum,
          total: totalCalc,
          observacion: editObs.trim(),
        });
        setSuccessMsg(bi('Ingreso de cosecha actualizado en Google Sheets.', 'Harvest income updated in Google Sheets.'));
      }

      setEditingMovement(null);
      onRefreshData('movements');
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al actualizar el registro', 'Error updating the record')
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePromptDeleteExp = (id: string, titulo: string) => {
    if (!effectiveIsAdmin) {
      setErrorMsg(bi('Solo el Administrador puede eliminar gastos guardados.', 'Only the Administrator can delete saved expenses.'));
      return;
    }
    setItemToDelete({ id, tipo: 'gasto', titulo });
  };

  const handlePromptDeleteInc = (id: string, titulo: string) => {
    if (!effectiveIsAdmin) {
      setErrorMsg(bi('Solo el Administrador puede eliminar ingresos guardados.', 'Only the Administrator can delete saved income.'));
      return;
    }
    setItemToDelete({ id, tipo: 'ingreso', titulo });
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;
    if (!effectiveIsAdmin) {
      setErrorMsg(bi('Solo el Administrador puede eliminar registros guardados.', 'Only the Administrator can delete saved records.'));
      setItemToDelete(null);
      return;
    }
    setDeletingItem(true);
    setErrorMsg(null);
    try {
      if (itemToDelete.tipo === 'gasto') {
        await deleteExpense(itemToDelete.id);
        setSuccessMsg(bi('Gasto agrícola eliminado de Google Sheets.', 'Agricultural expense deleted from Google Sheets.'));
      } else {
        await deleteIncome(itemToDelete.id);
        setSuccessMsg(bi('Ingreso de cosecha eliminado de Google Sheets.', 'Harvest income deleted from Google Sheets.'));
      }
      setItemToDelete(null);
      onRefreshData('movements');
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al eliminar', 'Error deleting record')
      );
    } finally {
      setDeletingItem(false);
    }
  };

  const expCalculatedTotal =
    typeof expCantidad === 'number' && typeof expPrecio === 'number'
      ? expCantidad * expPrecio
      : 0;

  const filteredMovements = allMovements.filter((m) => {
    if (historialFilter === 'ingresos' && m.tipo !== 'ingreso') return false;
    if (historialFilter === 'gastos' && m.tipo !== 'gasto_directo') return false;
    if (historialFilter === 'maquinaria' && m.tipo !== 'maquinaria_recibida') return false;
    if (!historialSearch) return true;
    const term = historialSearch.toLowerCase();
    return (
      m.loteNombre.toLowerCase().includes(term) ||
      m.titulo.toLowerCase().includes(term) ||
      m.detalle.toLowerCase().includes(term) ||
      m.fecha.includes(term)
    );
  });

  const activeLotForScreen = useMemo(
    () => (activeLotScreenId ? lots.find((l) => String(l.id) === String(activeLotScreenId)) || null : null),
    [lots, activeLotScreenId]
  );

  const isLotSubScreen =
    currentScreen === 'lote_trabajos' ||
    currentScreen === 'lote_cosechas' ||
    currentScreen === 'lote_gastos';

  const openLotDetailScreen = (lotId: string, screen: 'lote_trabajos' | 'lote_cosechas' | 'lote_gastos') => {
    setActiveLotScreenId(lotId);
    setExpandedLotId(lotId);
    setLotDetailSearch('');
    setExpandedLotDetailItemId(null);
    setCurrentScreen(screen);
  };

  return (
    <div className="w-full max-w-full space-y-4">
      {currentScreen !== 'main' && currentScreen !== 'pendientes_precio' && (
        <div className="flex items-center gap-3 my-1">
          <button
            type="button"
            onClick={() => {
              if (isLotSubScreen) {
                setCurrentScreen('lotes');
              } else {
                setCurrentScreen('main');
              }
            }}
            aria-label={
              isLotSubScreen
                ? bi('Volver a Mis lotes', 'Back to My lots')
                : bi('Volver a Propiedad', 'Back to Property')
            }
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white border border-slate-200 flex items-center justify-center gap-1.5 text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-800 shrink-0" />
            <span className="text-sm font-semibold text-slate-800">{t('common.back')}</span>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {currentScreen === 'ingreso' && bi('Registrar cosecha', 'Record harvest')}
              {currentScreen === 'gasto' && bi('Registrar gasto', 'Record expense')}
              {currentScreen === 'lotes' && bi('Mis lotes', 'My lots')}
              {currentScreen === 'maquinaria_recibida' && bi('Trabajos de maquinaria', 'Machinery jobs')}
              {currentScreen === 'historial' && bi('Historial', 'History')}
              {currentScreen === 'lote_trabajos' && bi('Trabajos de maquinaria', 'Machinery jobs')}
              {currentScreen === 'lote_cosechas' && bi('Cosechas e ingresos', 'Harvests & income')}
              {currentScreen === 'lote_gastos' && bi('Gastos directos', 'Direct expenses')}
            </h2>
            {isLotSubScreen && activeLotForScreen && (
              <p className="text-xs font-semibold text-[#24875B] truncate">
                {activeLotForScreen.nombre}
                {activeLotForScreen.superficieHectareas ? ` · ${activeLotForScreen.superficieHectareas} ha` : ''}
                {activeLotForScreen.cultivoActual ? ` · ${activeLotForScreen.cultivoActual}` : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Global Notifications */}
      {errorMsg && (
        <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start justify-between gap-2 shadow-xs">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span className="break-words font-medium">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 hover:text-red-700 p-1 shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="break-words font-medium">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1 shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* VISTA PRINCIPAL (MAIN): ETAPA 1 — REGISTRAR Y CONSULTAR      */}
      {/* ============================================================ */}
      {currentScreen === 'main' && (
        <div className="space-y-6">
          {/* SECCIÓN A: REGISTRAR */}
          <section className="space-y-2.5" aria-label={bi('Registrar movimiento agrícola', 'Record agricultural entry')}>
            <h2 className="text-sm font-bold text-slate-600 px-0.5">
              {bi('Registrar', 'Record')}
            </h2>

            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Botón REGISTRAR COSECHA (Solo producción agrícola) */}
              <button
                type="button"
                onClick={() => {
                  resetNewHarvestForm();
                  setCurrentScreen('ingreso');
                }}
                className="w-full px-3.5 py-3 rounded-2xl bg-[#2D7D2C] hover:bg-[#256624] active:bg-[#1D541C] text-white flex flex-col items-center justify-center gap-1 transition active:scale-[0.98] cursor-pointer select-none shadow-xs"
              >
                <div className="flex items-center justify-center gap-2">
                  <Wheat className="h-5 w-5 text-white shrink-0" strokeWidth={2.2} />
                  <span className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight text-center">
                    {bi('Registrar cosecha', 'Record harvest')}
                  </span>
                </div>
                <span className="text-[11px] text-white/90 font-medium text-center leading-tight">
                  {bi('Producción del lote', 'Lot production')}
                </span>
              </button>

              {/* Botón GASTO */}
              <button
                type="button"
                onClick={() => {
                  resetNewExpenseForm();
                  setCurrentScreen('gasto');
                }}
                className="w-full px-3.5 py-3 rounded-2xl bg-[#C5222B] hover:bg-[#A71D25] active:bg-[#8D181F] text-white flex flex-col items-center justify-center gap-1 transition active:scale-[0.98] cursor-pointer select-none shadow-xs"
              >
                <div className="flex items-center justify-center gap-2">
                  <CircleMinus className="h-5 w-5 text-white shrink-0" strokeWidth={2.2} />
                  <span className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight text-center">
                    {bi('Gasto', 'Expense')}
                  </span>
                </div>
                <span className="text-[11px] text-white/90 font-medium text-center leading-tight">
                  {bi('Insumos del lote', 'Lot inputs')}
                </span>
              </button>
            </div>
          </section>

          {/* SECCIÓN B: CONSULTAR */}
          <section className="space-y-2.5" aria-label={bi('Consultar registros de propiedad', 'View property records')}>
            <h2 className="text-sm font-bold text-slate-600 px-0.5">
              {bi('Consultar', 'Browse')}
            </h2>

            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
              {/* 1. Historial */}
              <button
                type="button"
                onClick={() => setCurrentScreen('historial')}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left min-h-[72px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 shrink-0">
                    <History className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {bi('Historial', 'History')}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {totalMovementsCount}{' '}
                      {totalMovementsCount === 1
                        ? bi('registro', 'record')
                        : bi('registros', 'records')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* 2. Historial maquinaria */}
              <button
                type="button"
                onClick={() => setCurrentScreen('maquinaria_recibida')}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left min-h-[72px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 border border-teal-200/80 text-teal-700 shrink-0">
                    <Tractor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {bi('Historial maquinaria', 'Machinery history')}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {linkedPropertyJobs.length}{' '}
                      {linkedPropertyJobs.length === 1
                        ? bi('labor recibida en lotes', 'job received on lots')
                        : bi('labores recibidas en lotes', 'jobs received on lots')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* 3. Mis lotes */}
              <button
                type="button"
                onClick={() => setCurrentScreen('lotes')}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left min-h-[72px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 shrink-0">
                    <LandPlot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {bi('Mis lotes', 'My lots')}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {lots.length}{' '}
                      {lots.length === 1
                        ? bi('lote registrado', 'registered lot')
                        : bi('lotes registrados', 'registered lots')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* 4. Ventas de cosecha (Solo Administrador — completamente oculto para usuarios normales) */}
              {effectiveIsAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentScreen('pendientes_precio')}
                  className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left min-h-[72px]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 shrink-0">
                      <Wheat className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {t('harvestSales.title')}
                        </h3>
                        <span className="text-sm font-bold text-slate-600 tabular-nums shrink-0">
                          {pendingHarvestsCount !== null ? pendingHarvestsCount : '—'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                        {pendingHarvestsCount !== null && pendingHarvestsCount > 0
                          ? `${pendingHarvestsCount} ${
                              pendingHarvestsCount === 1
                                ? bi('cosecha con toneladas disponibles', 'harvest with available tons')
                                : bi('cosechas con toneladas disponibles', 'harvests with available tons')
                            }`
                          : bi('Ventas parciales o totales, compradores y precios', 'Partial or full sales, buyers and prices')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-VISTA: VENTAS DE COSECHA (Solo Administrador)            */}
      {/* ============================================================ */}
      {currentScreen === 'pendientes_precio' && effectiveIsAdmin && (
        <HarvestSalesView
          customers={customers}
          campaigns={campaigns}
          lots={lots}
          itemsConfig={itemsConfig}
          exchangeRate={exchangeRate}
          paymentSettings={paymentSettings}
          activeCampaignId={activeCampaign?.id}
          isAdmin={effectiveIsAdmin}
          initialAvailableHarvests={pendingHarvestsQuery.hasLoaded ? pendingHarvests : undefined}
          onBack={() => setCurrentScreen('main')}
          onDataMutated={async () => {
            invalidateQueries(['harvest.', 'harvestSale.', 'ar.']);
            await pendingHarvestsQuery.refresh();
            onRefreshData('movements');
          }}
        />
      )}

      {/* ============================================================ */}
      {/* FORMULARIO: REGISTRAR COSECHA (PRODUCCIÓN)                   */}
      {/* ============================================================ */}
      {currentScreen === 'ingreso' && (() => {
        const productOptions = Array.from(
          new Set([
            'Soya',
            'Maíz',
            'Sorgo',
            'Trigo',
            'Girasol',
            ...propertyIncomeItems.map((it) => it.nombre),
          ])
        );
        const isProductInList = productOptions.some(
          (p) => p.toLowerCase() === harvProducto.trim().toLowerCase()
        );
        const standardHarvestUnits = [
          { val: 'toneladas', label: bi('Toneladas (t)', 'Tons (t)') },
          { val: 'quintales', label: bi('Quintales (qq)', 'Quintals (qq)') },
          { val: 'kg', label: bi('Kilogramos (kg)', 'Kilograms (kg)') },
          { val: 'bolsas', label: bi('Bolsas', 'Bags') },
          { val: 'unidades', label: bi('Unidades', 'Units') },
        ];
        const hasCustomHarvUnit =
          Boolean(harvUnidad) &&
          !standardHarvestUnits.some((u) => u.val.toLowerCase() === harvUnidad.toLowerCase());

        return (
          <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 shadow-xs">
            <form onSubmit={handleCreateHarvestSubmit} className="space-y-3">
              {/* Campaña */}
              <AppSelect
                label={bi('Campaña', 'Campaign')}
                required
                icon={<Calendar className="h-[17px] w-[17px]" />}
                value={harvCampanaId}
                onChange={(e) => setHarvCampanaId(e.target.value)}
              >
                <option value="">{bi('Seleccionar campaña', 'Select campaign')}</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.activa ? `(${bi('Activa', 'Active')})` : ''}
                  </option>
                ))}
              </AppSelect>

              {/* Lote */}
              <VisualLotPicker
                lots={lots}
                selectedLotId={harvLotId}
                onSelect={(id) => setHarvLotId(id)}
                label={bi('Lote', 'Lot')}
                required
              />

              {/* Producto o concepto */}
              {!harvUseCustomProduct ? (
                <AppSelect
                  label={bi('Producto o concepto', 'Product or concept')}
                  required
                  icon={<Wheat className="h-[17px] w-[17px]" />}
                  value={isProductInList ? harvProducto : ''}
                  onChange={(e) => {
                    if (e.target.value === '__otro__') {
                      setHarvUseCustomProduct(true);
                      setHarvProducto('');
                    } else {
                      setHarvProducto(e.target.value);
                    }
                  }}
                >
                  <option value="">{bi('Seleccionar producto', 'Select product')}</option>
                  {productOptions.map((prod) => (
                    <option key={prod} value={prod}>
                      {prod}
                    </option>
                  ))}
                  <option value="__otro__">{bi('Otro producto...', 'Other product...')}</option>
                </AppSelect>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-[13px] font-semibold text-[#26352D]">
                      {bi('Producto o concepto', 'Product or concept')} <span className="text-[#C44545]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setHarvUseCustomProduct(false);
                        setHarvProducto('');
                      }}
                      className="text-[11px] font-semibold text-[#24875B] hover:underline cursor-pointer"
                    >
                      {bi('Elegir de la lista', 'Choose from list')}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={harvProducto}
                    onChange={(e) => setHarvProducto(e.target.value)}
                    placeholder={bi('Escribir nombre del producto', 'Enter product name')}
                    className={`${FORM_INPUT_CLASS} font-semibold`}
                  />
                </div>
              )}

              {/* Fecha */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Fecha', 'Date')} <span className="text-[#C44545]">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-[#64746B] pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={harvFecha}
                    onChange={(e) => setHarvFecha(e.target.value)}
                    className={`${FORM_INPUT_CLASS} pl-9`}
                  />
                </div>
              </div>

              {/* Cantidad y Unidad (toneladas por defecto) */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div className="min-w-0">
                  <label className={`${FORM_LABEL_CLASS} whitespace-nowrap truncate`}>
                    {bi('Cantidad', 'Quantity')} <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={harvToneladas}
                    onChange={(e) => setHarvToneladas(e.target.value)}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <AppSelect
                  label={bi('Unidad', 'Unit')}
                  required
                  icon={<List className="h-[17px] w-[17px]" />}
                  value={harvUnidad}
                  onChange={(e) => setHarvUnidad(e.target.value)}
                >
                  {standardHarvestUnits.map((u) => (
                    <option key={u.val} value={u.val}>
                      {u.label}
                    </option>
                  ))}
                  {hasCustomHarvUnit && <option value={harvUnidad}>{translateUnit(harvUnidad)}</option>}
                </AppSelect>
              </div>

              {/* Observación con opción de dictado */}
              <ObservationField
                value={harvObs}
                onChange={setHarvObs}
                placeholder={bi('Silo de acopio, humedad, remisión...', 'Storage silo, moisture, delivery note...')}
              />

              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#24875B] h-[42px] text-sm font-bold text-white shadow-xs hover:bg-[#1D704B] transition disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>{saving ? t('common.saving') : bi('Guardar cosecha', 'Save harvest')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('main')}
                  className="px-4 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F5] text-[#26352D] text-sm font-semibold cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* FORMULARIO: REGISTRAR GASTO AGRÍCOLA                         */}
      {/* ============================================================ */}
      {currentScreen === 'gasto' && (() => {
        const standardExpUnits = [
          { val: 'ha', label: bi('Hectáreas (ha)', 'Hectares (ha)') },
          { val: 'kg', label: bi('Kilogramos (kg)', 'Kilograms (kg)') },
          { val: 'litros', label: bi('Litros (l)', 'Liters (l)') },
          { val: 'bolsas', label: bi('Bolsas', 'Bags') },
          { val: 'toneladas', label: bi('Toneladas (t)', 'Tons (t)') },
          { val: 'unidades', label: bi('Unidades', 'Units') },
        ];
        const hasCustomExpUnit =
          Boolean(expUnidad) &&
          !standardExpUnits.some((u) => u.val.toLowerCase() === expUnidad.toLowerCase());

        return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 shadow-xs">
            <form onSubmit={handleExpenseSubmit} className="space-y-3">
              {/* Modo de asignación: Un lote o Varios lotes */}
              <Switch<'single' | 'multi'>
                label={bi('Asignación', 'Assignment')}
                required
                value={expLotMode}
                onChange={(mode) => {
                  setExpLotMode(mode);
                  if (mode === 'single' && expLotId && isHectareUnit(expUnidad)) {
                    const ha = getLotSurfaceHa(lots, expLotId);
                    if (ha !== null) setExpCantidad(ha);
                  }
                }}
                leftOption={{ value: 'single', label: bi('Un lote', 'One lot') }}
                rightOption={{ value: 'multi', label: bi('Varios lotes', 'Multiple lots') }}
              />

              {/* Lote Destino (Simple o Múltiple con hectáreas trabajadas) */}
              {expLotMode === 'single' ? (
                <VisualLotPicker
                  lots={lots}
                  selectedLotId={expLotId}
                  onSelect={(id) => {
                    setExpLotId(id);
                    if (isHectareUnit(expUnidad)) {
                      const ha = getLotSurfaceHa(lots, id);
                      if (ha !== null) setExpCantidad(ha);
                    }
                  }}
                  label={bi('Lote', 'Lot')}
                  required
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[13px] font-semibold text-[#26352D]">
                      {bi('Lotes y hectáreas', 'Lots and hectares')} <span className="text-[#C44545]">*</span>
                    </label>
                    {lots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedMultiLots.length === lots.length) {
                            setExpMultiLotHa({});
                          } else {
                            const allMap: Record<string, number | ''> = {};
                            lots.forEach((l) => {
                              const ha = Number(l.superficieHectareas || l.superficie || 0);
                              allMap[l.id] = ha > 0 ? ha : '';
                            });
                            setExpMultiLotHa(allMap);
                          }
                        }}
                        className="text-[11px] font-semibold text-[#24875B] hover:underline cursor-pointer"
                      >
                        {selectedMultiLots.length === lots.length
                          ? bi('Limpiar', 'Clear')
                          : bi('Seleccionar todos', 'Select all')}
                      </button>
                    )}
                  </div>

                  {lots.length === 0 ? (
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                      {bi('No hay lotes registrados. Agrega lotes en Administración.', 'No lots registered. Add lots in Administration.')}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#DCE2DD] bg-[#FAFBF8] divide-y divide-[#E6EBE7] overflow-hidden">
                      {lots.map((lot) => {
                        const isChecked = Object.prototype.hasOwnProperty.call(expMultiLotHa, lot.id);
                        const haVal = expMultiLotHa[lot.id];
                        return (
                          <div
                            key={lot.id}
                            className={`px-3 py-2 flex items-center justify-between gap-3 transition ${
                              isChecked ? 'bg-white' : 'hover:bg-white/60'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleMultiLot(lot)}
                              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer min-h-[34px]"
                            >
                              {isChecked ? (
                                <CheckSquare className="h-[18px] w-[18px] text-[#24875B] shrink-0" />
                              ) : (
                                <Square className="h-[18px] w-[18px] text-[#9AA69F] shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#26352D] truncate">
                                  {lot.nombre}
                                </p>
                                <p className="text-[11px] text-[#7A8780]">
                                  {Number(lot.superficieHectareas || lot.superficie || 0)} ha
                                </p>
                              </div>
                            </button>

                            {isChecked && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  min="0.01"
                                  placeholder="ha"
                                  aria-label={bi(`Hectáreas trabajadas en ${lot.nombre}`, `Worked hectares on ${lot.nombre}`)}
                                  value={haVal ?? ''}
                                  onChange={(e) =>
                                    updateMultiLotHa(
                                      lot.id,
                                      e.target.value === '' ? '' : parseFloat(e.target.value)
                                    )
                                  }
                                  className="w-20 h-[36px] text-xs px-2.5 rounded-lg border border-[#24875B]/50 bg-white focus:border-[#24875B] focus:outline-none font-bold text-right tabular-nums"
                                />
                                <span className="text-[11px] font-semibold text-[#5E6D64]">ha</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Concepto de gasto */}
              <VisualExpenseItemPicker
                items={propertyExpenseItems}
                selectedItemName={expItem}
                onSelectItem={(item) => {
                  expCurrencyAnchorRef.current = null;
                  setExpItem(item.nombre);
                  if (item.unidad) {
                    setExpUnidad(item.unidad);
                    if (expLotMode === 'single' && expLotId && isHectareUnit(item.unidad)) {
                      const ha = getLotSurfaceHa(lots, expLotId);
                      if (ha !== null) setExpCantidad(ha);
                    }
                  }
                  if (item.precioPredeterminado || item.precio) {
                    setExpPrecio(item.precioPredeterminado || item.precio || '');
                  }
                  if (item.moneda) setExpMoneda(item.moneda);
                }}
                label={bi('Concepto de gasto', 'Expense concept')}
                defaultIcon="semillas"
                required
              />

              {/* Fecha */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Fecha', 'Date')} <span className="text-[#C44545]">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-[#64746B] pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={expFecha}
                    onChange={(e) => setExpFecha(e.target.value)}
                    className={`${FORM_INPUT_CLASS} pl-9`}
                  />
                </div>
              </div>

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Cantidad', 'Quantity')} <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0.01"
                    placeholder="1.0"
                    value={expCantidad}
                    onChange={(e) => setExpCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <AppSelect
                  label={bi('Unidad', 'Unit')}
                  icon={<List className="h-[17px] w-[17px]" />}
                  value={expUnidad}
                  onChange={(e) => {
                    const nextU = e.target.value;
                    setExpUnidad(nextU);
                    if (expLotMode === 'single' && expLotId && isHectareUnit(nextU)) {
                      const ha = getLotSurfaceHa(lots, expLotId);
                      if (ha !== null) setExpCantidad(ha);
                    }
                  }}
                >
                  <option value="">{bi('Seleccionar unidad', 'Select unit')}</option>
                  {standardExpUnits.map((u) => (
                    <option key={u.val} value={u.val}>
                      {u.label}
                    </option>
                  ))}
                  {hasCustomExpUnit && <option value={expUnidad}>{translateUnit(expUnidad)}</option>}
                </AppSelect>
              </div>

              {/* Precio y Moneda */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Precio unitario', 'Unit price')} <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0.01"
                    placeholder="0.00"
                    value={expPrecio}
                    onChange={(e) => {
                      expCurrencyAnchorRef.current = null;
                      setExpPrecio(e.target.value === '' ? '' : parseFloat(e.target.value));
                    }}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <CurrencySelect
                  label={bi('Moneda', 'Currency')}
                  required
                  value={expMoneda}
                  onChange={handleExpCurrencyChange}
                />
              </div>

              {/* Tipo de cambio editable */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Tipo de cambio (Bs/USD)', 'Exchange rate (Bs/USD)')} <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  required
                  min="0.01"
                  placeholder="6.96"
                  value={expTc}
                  onChange={(e) => setExpTc(e.target.value)}
                  className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                />
              </div>

              {/* Importe total */}
              <div className="px-3.5 py-2.5 rounded-xl bg-[#FCECEC] border border-[#F2C6C6] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#9F2D2D]">{bi('Importe total', 'Total amount')}</span>
                  <span className="text-base font-extrabold text-[#9F2D2D] tabular-nums">
                    {expMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                    {expCalculatedTotal.toLocaleString('es-BO', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {/* Desglose proporcional previo a guardar (cuando es varios lotes) */}
                {expLotMode === 'multi' && selectedMultiLots.length > 0 && (
                  <div className="pt-2 border-t border-[#F2C6C6] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#9F2D2D]">
                      <span>{bi('Desglose proporcional', 'Proportional breakdown')}</span>
                      <span className="tabular-nums">
                        {totalMultiLotHa.toLocaleString('es-BO', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {bi('ha totales', 'total ha')}
                      </span>
                    </div>
                    {multiLotBreakdown.length > 0 ? (
                      <div className="rounded-lg bg-white/90 border border-[#F2C6C6] divide-y divide-rose-100 text-xs">
                        {multiLotBreakdown.map((item) => (
                          <div
                            key={item.lot.id}
                            className="px-2.5 py-1.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-[#26352D]">{item.lot.nombre}</span>
                              <span className="text-[11px] text-[#5E6D64] ml-1.5 tabular-nums">
                                ({item.ha} ha · {item.pct.toFixed(1)}%)
                              </span>
                            </div>
                            <span className="tabular-nums font-bold text-[#C44545] shrink-0">
                              {expMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                              {item.amount.toLocaleString('es-BO', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#9F2D2D]">
                        {bi(
                          'Ingresa las hectáreas trabajadas de cada lote para ver el reparto proporcional.',
                          'Enter worked hectares for each lot to view the proportional split.'
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Observación */}
              <ObservationField
                value={expObs}
                onChange={setExpObs}
                placeholder={bi('Dosis aplicada, proveedor, factura o remisión...', 'Applied rate, supplier, invoice, or delivery note...')}
              />

              {/* Botones */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#C44545] h-[42px] text-sm font-bold text-white shadow-xs hover:bg-[#A93838] active:bg-[#8E2D2D] transition disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>
                    {saving
                      ? savingProgress || t('common.saving')
                      : expLotMode === 'multi' && multiLotBreakdown.length > 1
                      ? bi(`Guardar en ${multiLotBreakdown.length} lotes`, `Save across ${multiLotBreakdown.length} lots`)
                      : bi('Guardar gasto', 'Save expense')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('main')}
                  className="px-4 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F5] text-[#26352D] text-sm font-semibold cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>

          {/* Consulta real de grupos distribuidos vía expense.allocations */}
          <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAllocationsPanelInGasto((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between gap-2 bg-[#F8FAF8] hover:bg-[#F2F5F2] transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="h-4 w-4 text-[#C44545] shrink-0" />
                <span className="text-xs font-bold text-[#26352D] truncate">
                  {bi('Gastos distribuidos registrados', 'Recorded distributed expenses')} ({expenseAllocations.length})
                </span>
              </div>
              {showAllocationsPanelInGasto ? (
                <ChevronUp className="h-4 w-4 text-[#7A8780] shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#7A8780] shrink-0" />
              )}
            </button>

            {showAllocationsPanelInGasto && (
              <div className="border-t border-[#E2E7E3] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-[#5E6D64]">
                    {bi(
                      'Grupos consultados directamente desde el servidor',
                      'Groups loaded directly from the server'
                    )}{' '}
                    (<code>expense.allocations</code>).
                  </p>
                  <button
                    type="button"
                    onClick={() => loadExpenseAllocations()}
                    disabled={allocationsLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-[11px] font-semibold text-[#26352D] cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${allocationsLoading ? 'animate-spin' : ''}`} />
                    <span>{bi('Actualizar', 'Refresh')}</span>
                  </button>
                </div>

                {allocationsError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <span className="break-words">
                        {allocationsHasLoaded
                          ? bi(
                              `No se pudo actualizar (${translateError(allocationsError)}). Mostrando últimos datos.`,
                              `Could not refresh (${translateError(allocationsError)}). Showing latest data.`
                            )
                          : translateError(allocationsError)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadExpenseAllocations()}
                      disabled={allocationsLoading}
                      className="text-xs font-bold text-red-700 underline shrink-0 cursor-pointer"
                    >
                      {bi('Reintentar', 'Retry')}
                    </button>
                  </div>
                )}

                <CompactList
                  isEmpty={expenseAllocations.length === 0}
                  emptyMessage={
                    allocationsInitialLoading || (!allocationsHasLoaded && !allocationsError)
                      ? bi('Consultando gastos distribuidos...', 'Loading distributed expenses...')
                      : bi('No hay gastos distribuidos registrados en esta campaña.', 'No distributed expenses recorded in this campaign.')
                  }
                >
                  {expenseAllocations.map((g) => {
                    const isExp = expandedAllocationId === g.id;
                    const curLabel = g.moneda === 'USD' ? 'USD' : 'Bs';
                    return (
                      <CompactListRow
                        key={g.id}
                        icon={
                          <div className="w-8 h-8 rounded-lg bg-[#FCECEC] border border-[#F2C6C6]/70 flex items-center justify-center text-[#C44545]">
                            <Layers className="h-4 w-4" />
                          </div>
                        }
                        title={formatConcept(g.descripcion)}
                        subtitle={
                          <span>
                            {formatDateDDMMAAAA(g.fecha)} · {g.lotes.length} {bi('lotes', 'lots')}
                            {g.hectareasTotales ? ` · ${g.hectareasTotales.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ha` : ''}
                          </span>
                        }
                        rightPrimary={
                          <span className="tabular-nums text-[#C44545]">
                            {curLabel}{' '}
                            {g.importe.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        }
                        isExpanded={isExp}
                        onClick={() => setExpandedAllocationId(isExp ? null : g.id)}
                        expandedContent={
                          <div className="space-y-2 text-xs">
                            {g.observacion && (
                              <p className="text-[11px] italic text-[#5E6D64]">{bi('Obs.:', 'Note:')} {g.observacion}</p>
                            )}
                            <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF]">
                              {g.lotes.map((lt, idx) => {
                                const ltName =
                                  lt.loteNombre ||
                                  lots.find((x) => String(x.id) === String(lt.loteId))?.nombre ||
                                  lt.loteId;
                                return (
                                  <div key={`${g.id}_${lt.loteId}_${idx}`} className="px-3 py-2 flex items-center justify-between gap-2">
                                    <span className="font-semibold text-[#26352D]">
                                      {ltName}{' '}
                                      <span className="text-[11px] font-normal text-[#5E6D64]">
                                        ({lt.hectareas} ha{lt.porcentaje ? ` · ${lt.porcentaje.toFixed(1)}%` : ''})
                                      </span>
                                    </span>
                                    {lt.importe !== undefined && (
                                      <span className="tabular-nums font-bold text-[#C44545]">
                                        {curLabel}{' '}
                                        {lt.importe.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        }
                      />
                    );
                  })}
                </CompactList>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 3. MIS LOTES (INFO AGRONÓMICA + ACCESOS A PANTALLAS PROPIAS) */}
      {/* ============================================================ */}
      {currentScreen === 'lotes' && (() => {
        const q = lotsSearch.trim().toLowerCase();
        const filteredLots = lots.filter((lot) => {
          if (!q) return true;
          return `${lot.nombre} ${lot.cultivoActual || ''} ${lot.ubicacion || ''}`
            .toLowerCase()
            .includes(q);
        });
        const totalHa = filteredLots.reduce(
          (sum, l) => sum + (Number(l.superficieHectareas) || 0),
          0
        );

        return (
          <div className="space-y-3">
            <ListToolbar
              title={bi('Mis lotes', 'My lots')}
              countLabel={`${filteredLots.length} · ${totalHa.toFixed(1)} ha`}
              searchValue={lotsSearch}
              onSearchChange={setLotsSearch}
              searchPlaceholder={bi('Buscar lote, cultivo o ubicación...', 'Search lot, crop, or location...')}
            />

            <CompactList
              isEmpty={filteredLots.length === 0}
              emptyMessage={
                q
                  ? bi('No se encontraron lotes con esa búsqueda.', 'No lots matched that search.')
                  : bi('No hay lotes registrados aún.', 'No lots registered yet.')
              }
            >
              {filteredLots.map((lot) => {
                const isExpanded = expandedLotId === lot.id;
                const lotMachineryJobs = linkedPropertyJobs.filter((j) => String(j.loteId) === String(lot.id));
                const lotIncomes = propertyIncomeDirects.filter((i) => String(i.loteId) === String(lot.id));
                const lotHarvests = historyHarvestsSource.filter(
                  (h) => String(h.loteId) === String(lot.id)
                );
                const lotHarvestsAndIncomesCount = lotIncomes.length + lotHarvests.length;
                const lotExpensesDirect = propertyExpenseDirects.filter((e) => String(e.loteId) === String(lot.id));

                return (
                  <CompactListRow
                    key={lot.id}
                    icon={
                      <div className="w-8 h-8 rounded-lg bg-[#EAF5EE] border border-[#BFE0CD]/70 text-[#24875B] flex items-center justify-center">
                        <LandPlot className="w-4 h-4" />
                      </div>
                    }
                    title={lot.nombre}
                    subtitle={
                      <span>
                        <span className="font-semibold text-[#24875B]">
                          {lot.superficieHectareas} ha
                        </span>
                        {lot.cultivoActual ? ` · ${lot.cultivoActual}` : ''}
                        {lot.ubicacion ? ` · ${lot.ubicacion}` : ''}
                      </span>
                    }
                    isExpanded={isExpanded}
                    onClick={() => setExpandedLotId(isExpanded ? null : lot.id)}
                    expandedContent={
                      <div className="space-y-2.5 text-xs">
                        {/* 1. Información agronómica */}
                        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-[#E2E7E3]">
                          <div>
                            <span className="text-[10px] text-[#7A8780] block uppercase font-semibold">
                              {bi('Superficie', 'Area')}
                            </span>
                            <span className="font-bold text-[#26352D]">
                              {lot.superficieHectareas} ha
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#7A8780] block uppercase font-semibold">
                              {bi('Cultivo actual', 'Current crop')}
                            </span>
                            <span className="font-bold text-[#24875B]">
                              {lot.cultivoActual || bi('Sin cultivo', 'No crop')}
                            </span>
                          </div>
                          {lot.ubicacion && (
                            <div className="col-span-full pt-1.5 border-t border-[#EFF2EF]">
                              <span className="text-[10px] text-[#7A8780] block uppercase font-semibold">
                                {bi('Ubicación', 'Location')}
                              </span>
                              <span className="text-[#26352D]">{lot.ubicacion}</span>
                            </div>
                          )}
                        </div>

                        {/* 2. Accesos a pantallas independientes del lote */}
                        <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLotDetailScreen(lot.id, 'lote_trabajos');
                            }}
                            className="w-full px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[#F7F9F7] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[42px]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Tractor className="h-4 w-4 text-amber-600 shrink-0" />
                              <span className="text-xs font-semibold text-[#26352D] truncate">
                                {bi('Trabajos de maquinaria', 'Machinery jobs')} ({lotMachineryJobs.length})
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-[#8A968F] shrink-0" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLotDetailScreen(lot.id, 'lote_cosechas');
                            }}
                            className="w-full px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[#F7F9F7] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[42px]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Wheat className="h-4 w-4 text-[#24875B] shrink-0" />
                              <span className="text-xs font-semibold text-[#26352D] truncate">
                                {bi('Cosechas e ingresos', 'Harvests & income')} ({lotHarvestsAndIncomesCount})
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-[#8A968F] shrink-0" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLotDetailScreen(lot.id, 'lote_gastos');
                            }}
                            className="w-full px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[#F7F9F7] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[42px]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Receipt className="h-4 w-4 text-[#C44545] shrink-0" />
                              <span className="text-xs font-semibold text-[#26352D] truncate">
                                {bi('Gastos directos', 'Direct expenses')} ({lotExpensesDirect.length})
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-[#8A968F] shrink-0" />
                          </button>
                        </div>
                      </div>
                    }
                  />
                );
              })}
            </CompactList>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 3B. PANTALLA INDEPENDIENTE: TRABAJOS DE MAQUINARIA DEL LOTE  */}
      {/* ============================================================ */}
      {currentScreen === 'lote_trabajos' && (() => {
        const q = lotDetailSearch.trim().toLowerCase();
        const lotJobs = linkedPropertyJobs
          .filter((j) => String(j.loteId) === String(activeLotScreenId))
          .filter((j) => {
            if (!q) return true;
            return `${j.trabajoNombre || ''} ${j.maquinariaNombre || ''} ${j.observacion || ''} ${formatDateDDMMAAAA(j.fecha)}`
              .toLowerCase()
              .includes(q);
          })
          .sort(compareChronologicalDesc);

        return (
          <div className="space-y-3">
            <ListToolbar
              title={
                activeLotForScreen
                  ? `${activeLotForScreen.nombre} · ${bi('Maquinaria', 'Machinery')}`
                  : bi('Trabajos de maquinaria', 'Machinery jobs')
              }
              countLabel={`${lotJobs.length} ${bi('reg.', 'rec.')}`}
              searchValue={lotDetailSearch}
              onSearchChange={setLotDetailSearch}
              searchPlaceholder={bi('Buscar labor, máquina o fecha...', 'Search job, machine, or date...')}
            />

            <CompactList
              isEmpty={lotJobs.length === 0}
              emptyMessage={
                q
                  ? bi('No se encontraron trabajos con esa búsqueda.', 'No jobs matched that search.')
                  : bi('Sin labores de maquinaria registradas en este lote.', 'No machinery jobs recorded on this lot.')
              }
            >
              {lotJobs.map((j) => {
                const jobDisp = resolveJobDisplay(j, machines, machineJobTypes, lang);
                const unitLabel =
                  j.unidad === 'hectarea' || (j.unidad as string) === 'ha' ? 'ha' : 'h';
                return (
                  <CompactListRow
                    key={j.id}
                    icon={
                      <div className="w-8 h-8 rounded-lg bg-[#FCECEC] border border-[#F2C6C6]/70 flex items-center justify-center">
                        <VisualIcon name={jobDisp.icon} size="xs" />
                      </div>
                    }
                    title={jobDisp.title}
                    subtitle={
                      <span>
                        {formatDateDDMMAAAA(j.fecha)} · {jobDisp.machineName} · {j.cantidad}{' '}
                        {unitLabel}
                      </span>
                    }
                    rightPrimary={
                      <span className="text-[#C44545] tabular-nums">
                        - {j.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                        {(Number(j.total) || 0).toLocaleString('es-BO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    }
                    rightSecondary={`${j.moneda === 'USD' ? 'USD' : 'Bs'} ${j.tarifa}/${unitLabel}`}
                  />
                );
              })}
            </CompactList>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 3C. PANTALLA INDEPENDIENTE: COSECHAS E INGRESOS DEL LOTE     */}
      {/* ============================================================ */}
      {currentScreen === 'lote_cosechas' && (() => {
        const q = lotDetailSearch.trim().toLowerCase();
        const lotIncomeItems: MovementItem[] = [
          ...propertyIncomeDirects
            .filter((i) => String(i.loteId) === String(activeLotScreenId))
            .map((i) => ({
              id: i.id,
              tipo: 'ingreso' as const,
              fecha: i.fecha,
              loteId: i.loteId,
              loteNombre: i.loteNombre || activeLotForScreen?.nombre || bi('Lote', 'Lot'),
              titulo: formatConcept(i.concepto),
              detalle: `${i.cantidad} ${translateUnit(i.unidad || '')} ${i.precio ? `@ ${i.moneda === 'USD' ? 'USD' : 'Bs'} ${i.precio}` : ''} ${i.observacion ? `• ${i.observacion}` : ''}`.trim(),
              monto: i.total,
              moneda: (i.moneda === 'USD' ? 'USD' : 'BOB') as Currency,
              tipoCambio: i.tipoCambio || i.tc || exchangeRate?.tasaBobPerUsd,
              cantidad: i.cantidad,
              unidad: i.unidad,
              precioUnitario: i.precio,
              observacion: i.observacion,
              icono:
                i.icono ||
                itemsConfig.find(
                  (it) => (it.nombre || '').toLowerCase() === (i.concepto || '').toLowerCase()
                )?.icono ||
                getIconDefinition(i.concepto || '', 'ingreso').id,
              creadoEn: i.creadoEn,
            })),
          ...historyHarvestsSource
            .filter((h) => String(h.loteId) === String(activeLotScreenId))
            .map((h) => ({
              id: `harv_${h.id}`,
              tipo: 'cosecha' as const,
              fecha: h.fecha,
              loteId: h.loteId,
              loteNombre: h.loteNombre || activeLotForScreen?.nombre || bi('Lote', 'Lot'),
              titulo: `${bi('Cosecha', 'Harvest')} ${formatConcept(h.producto)}`,
              detalle: `${formatHarvestQty(h.toneladas, h.unidad)}${h.observacion ? ` • ${h.observacion}` : ''}`,
              monto: 0,
              moneda: 'USD' as Currency,
              cantidad: h.toneladas,
              unidad: h.unidad || 't',
              observacion: h.observacion,
              icono:
                (itemsConfig.find((it) => it.nombre.trim().toLowerCase() === String(h.producto || '').trim().toLowerCase())?.icono) ||
                getIconDefinition(h.producto, 'ingreso').id ||
                'granos',
              cosechaRecord: h,
              creadoEn: h.creadoEn,
            })),
        ]
          .filter((item) => {
            if (!q) return true;
            return `${item.titulo} ${item.detalle} ${item.observacion || ''} ${formatDateDDMMAAAA(item.fecha)}`
              .toLowerCase()
              .includes(q);
          })
          .sort(compareChronologicalDesc);

        return (
          <div className="space-y-3">
            <ListToolbar
              title={
                activeLotForScreen
                  ? `${activeLotForScreen.nombre} · ${bi('Cosechas e ingresos', 'Harvests & income')}`
                  : bi('Cosechas e ingresos', 'Harvests & income')
              }
              countLabel={`${lotIncomeItems.length} ${lotIncomeItems.length === 1 ? bi('registro', 'record') : bi('registros', 'records')}`}
              searchValue={lotDetailSearch}
              onSearchChange={setLotDetailSearch}
              searchPlaceholder={bi('Buscar producto, fecha u observación...', 'Search product, date, or note...')}
            />

            <CompactList
              isEmpty={lotIncomeItems.length === 0}
              emptyMessage={
                q
                  ? bi('No se encontraron cosechas o ingresos con esa búsqueda.', 'No harvests or income matched that search.')
                  : bi('Sin cosechas o ingresos registrados en este lote.', 'No harvests or income recorded on this lot.')
              }
            >
              {lotIncomeItems.map((m) => {
                const isExpanded = expandedLotDetailItemId === m.id;
                const isHarvest = m.tipo === 'cosecha';
                const campName = isHarvest && m.cosechaRecord
                  ? campaigns.find((c) => String(c.id) === String(m.cosechaRecord!.campanaId))?.nombre ||
                    activeCampaign?.nombre ||
                    '—'
                  : '';

                return (
                  <CompactListRow
                    key={`${m.tipo}-${m.id}`}
                    icon={
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center border bg-[#EAF5EE] border-[#BFE0CD]/70 text-[#24875B]">
                        <VisualIcon name={m.icono || 'granos'} category="ingreso" size="xs" />
                      </div>
                    }
                    title={m.titulo}
                    subtitle={
                      <span>
                        {formatDateDDMMAAAA(m.fecha)} ·{' '}
                        {isHarvest
                          ? (activeLotForScreen?.nombre || m.loteNombre)
                          : `${m.cantidad || 0} ${translateUnit(m.unidad || '')}`.trim()}
                      </span>
                    }
                    rightPrimary={
                      isHarvest && m.cosechaRecord ? (
                        <span className="tabular-nums font-bold text-[#24875B]">
                          {formatHarvestQty(m.cosechaRecord.toneladas, m.cosechaRecord.unidad)}
                        </span>
                      ) : (
                        <span className="tabular-nums text-[#24875B]">
                          + {m.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                          {(Number(m.monto) || 0).toLocaleString('es-BO', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )
                    }
                    isExpanded={isExpanded}
                    onClick={() => setExpandedLotDetailItemId(isExpanded ? null : m.id)}
                    expandedContent={
                      isHarvest && m.cosechaRecord ? (
                        <div className="space-y-2.5 text-xs">
                          <div className="divide-y divide-[#EFF2EF]">
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium">{bi('Producto', 'Product')}</span>
                              <span className="font-semibold text-[#26352D] text-right">{formatConcept(m.cosechaRecord.producto)}</span>
                            </div>
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium">{bi('Campaña', 'Campaign')}</span>
                              <span className="font-semibold text-[#26352D] text-right">{campName}</span>
                            </div>
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium">{bi('Fecha', 'Date')}</span>
                              <span className="font-semibold text-[#26352D] text-right">{formatDateDDMMAAAA(m.cosechaRecord.fecha)}</span>
                            </div>
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium">{bi('Cantidad cosechada', 'Harvested quantity')}</span>
                              <span className="tabular-nums font-semibold text-[#24875B] text-right">
                                {formatHarvestQty(m.cosechaRecord.toneladas, m.cosechaRecord.unidad)}
                              </span>
                            </div>
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium">{bi('Vendida o comprometida', 'Sold or committed')}</span>
                              <span className="tabular-nums font-semibold text-[#26352D] text-right">
                                {formatHarvestQty(m.cosechaRecord.asignadas || 0, m.cosechaRecord.unidad)}
                              </span>
                            </div>
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium">{bi('Cantidad disponible', 'Available quantity')}</span>
                              <span className="tabular-nums font-semibold text-[#26352D] text-right">
                                {formatHarvestQty(m.cosechaRecord.pendiente || 0, m.cosechaRecord.unidad)}
                              </span>
                            </div>
                            {m.cosechaRecord.observacion && (
                              <div className="py-1.5 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium shrink-0">{bi('Observación', 'Observation')}</span>
                                <span className="italic text-[#26352D] text-right">{m.cosechaRecord.observacion}</span>
                              </div>
                            )}
                          </div>
                          {effectiveIsAdmin && (
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6EBE7]">
                              <button
                                type="button"
                                onClick={() => handleOpenEditHarvest(m.cosechaRecord!)}
                                className="px-3 py-1.5 rounded-xl bg-white border border-[#D4DDD6] hover:bg-[#F2F5F3] text-[#26352D] font-semibold text-xs transition cursor-pointer min-h-[34px] inline-flex items-center gap-1"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>{t('common.edit')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePromptDeleteHarvest(m.cosechaRecord!)}
                                className="px-3 py-1.5 rounded-xl bg-white border border-[#F2C6C6] hover:bg-[#FCECEC] text-[#C44545] font-semibold text-xs transition cursor-pointer min-h-[34px] inline-flex items-center gap-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>{t('common.delete')}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <div className="divide-y divide-[#EFF2EF]">
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium">{bi('Cantidad', 'Quantity')}</span>
                              <span className="font-semibold text-[#26352D]">
                                {m.cantidad ? `${m.cantidad} ${translateUnit(m.unidad || '')}` : '—'}
                              </span>
                            </div>
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium">{bi('Equivalencia', 'Equivalent')}</span>
                              <span className="tabular-nums font-semibold text-[#26352D] text-right">
                                {m.tipoCambio && m.tipoCambio > 0
                                  ? m.moneda === 'USD'
                                    ? `Bs ${(m.monto * m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bi('TC', 'FX')}: ${formatTC(m.tipoCambio)})`
                                    : `USD ${(m.monto / m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bi('TC', 'FX')}: ${formatTC(m.tipoCambio)})`
                                  : '—'}
                              </span>
                            </div>
                            {m.observacion && (
                              <div className="py-1.5 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium shrink-0">{bi('Observación', 'Observation')}</span>
                                <span className="italic text-[#26352D] text-right">{m.observacion}</span>
                              </div>
                            )}
                          </div>
                          {effectiveIsAdmin && (
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6EBE7]">
                              <button
                                type="button"
                                onClick={() => handleOpenEditMovement(m)}
                                className="px-3.5 py-1.5 rounded-xl bg-white border border-[#D4DDD6] hover:bg-[#F2F5F3] text-[#26352D] font-semibold text-xs transition cursor-pointer min-h-[34px]"
                              >
                                {t('common.edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePromptDeleteInc(m.id, m.titulo)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#FCECEC] hover:bg-[#F7DCDC] text-[#C44545] font-semibold text-xs transition cursor-pointer border border-[#F2C6C6] min-h-[34px]"
                              >
                                {t('common.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    }
                  />
                );
              })}
            </CompactList>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 3D. PANTALLA INDEPENDIENTE: GASTOS DIRECTOS DEL LOTE         */}
      {/* ============================================================ */}
      {currentScreen === 'lote_gastos' && (() => {
        const q = lotDetailSearch.trim().toLowerCase();
        const lotExpenses = propertyExpenseDirects
          .filter((e) => String(e.loteId) === String(activeLotScreenId))
          .filter((e) => {
            if (!q) return true;
            return `${e.itemGasto || ''} ${e.observacion || ''} ${formatDateDDMMAAAA(e.fecha)}`
              .toLowerCase()
              .includes(q);
          })
          .sort(compareChronologicalDesc);

        return (
          <div className="space-y-3">
            <ListToolbar
              title={
                activeLotForScreen
                  ? `${activeLotForScreen.nombre} · ${bi('Gastos directos', 'Direct expenses')}`
                  : bi('Gastos directos', 'Direct expenses')
              }
              countLabel={`${lotExpenses.length} ${bi('reg.', 'rec.')}`}
              searchValue={lotDetailSearch}
              onSearchChange={setLotDetailSearch}
              searchPlaceholder={bi('Buscar insumo, fecha u observación...', 'Search input, date, or note...')}
            />

            <CompactList
              isEmpty={lotExpenses.length === 0}
              emptyMessage={
                q
                  ? bi('No se encontraron gastos con esa búsqueda.', 'No expenses matched that search.')
                  : bi('Sin gastos directos registrados en este lote.', 'No direct expenses recorded on this lot.')
              }
            >
              {lotExpenses.map((e) => {
                const isExpanded = expandedLotDetailItemId === e.id;
                const tcVal = e.tipoCambio || e.tc || exchangeRate?.tasaBobPerUsd;
                const expIcon =
                  e.icono ||
                  itemsConfig.find(
                    (it) => (it.nombre || '').toLowerCase() === (e.itemGasto || '').toLowerCase()
                  )?.icono ||
                  'semillas';
                const movItem: MovementItem = {
                  id: e.id,
                  tipo: 'gasto_directo',
                  fecha: e.fecha,
                  loteId: e.loteId,
                  loteNombre: e.loteNombre || activeLotForScreen?.nombre || bi('Lote', 'Lot'),
                  titulo: formatConcept(e.itemGasto),
                  detalle: `${e.cantidad} ${translateUnit(e.unidad || '')}`.trim(),
                  monto: e.total,
                  moneda: (e.moneda === 'USD' ? 'USD' : 'BOB') as Currency,
                  tipoCambio: tcVal,
                  cantidad: e.cantidad,
                  unidad: e.unidad,
                  precioUnitario: e.precio,
                  observacion: e.observacion,
                  icono: expIcon,
                  creadoEn: e.creadoEn,
                };

                return (
                  <CompactListRow
                    key={e.id}
                    icon={
                      <div className="w-8 h-8 rounded-lg bg-[#FCECEC] border border-[#F2C6C6]/70 flex items-center justify-center">
                        <VisualIcon name={expIcon} size="xs" />
                      </div>
                    }
                    title={formatConcept(e.itemGasto)}
                    subtitle={
                      <span>
                        {formatDateDDMMAAAA(e.fecha)} · {e.cantidad} {translateUnit(e.unidad || '')}
                      </span>
                    }
                    rightPrimary={
                      <span className="tabular-nums text-[#C44545]">
                        - {e.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                        {(Number(e.total) || 0).toLocaleString('es-BO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    }
                    isExpanded={isExpanded}
                    onClick={() => setExpandedLotDetailItemId(isExpanded ? null : e.id)}
                    expandedContent={
                      <div className="space-y-2 text-xs">
                        <div className="divide-y divide-[#EFF2EF]">
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Cantidad', 'Quantity')}</span>
                            <span className="font-semibold text-[#26352D]">
                              {e.cantidad} {translateUnit(e.unidad || '')}
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Equivalencia', 'Equivalent')}</span>
                            <span className="tabular-nums font-semibold text-[#26352D] text-right">
                              {tcVal && tcVal > 0
                                ? e.moneda === 'USD'
                                  ? `Bs ${(e.total * tcVal).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bi('TC', 'FX')}: ${formatTC(tcVal)})`
                                  : `USD ${(e.total / tcVal).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bi('TC', 'FX')}: ${formatTC(tcVal)})`
                                : '—'}
                            </span>
                          </div>
                          {e.observacion && (
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium shrink-0">{bi('Observación', 'Observation')}</span>
                              <span className="italic text-[#26352D] text-right">{e.observacion}</span>
                            </div>
                          )}
                        </div>
                        {effectiveIsAdmin && (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6EBE7]">
                            <button
                              type="button"
                              onClick={() => handleOpenEditMovement(movItem)}
                              className="px-3.5 py-1.5 rounded-xl bg-white border border-[#D4DDD6] hover:bg-[#F2F5F3] text-[#26352D] font-semibold text-xs transition cursor-pointer min-h-[34px]"
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePromptDeleteExp(e.id, formatConcept(e.itemGasto))}
                              className="px-3.5 py-1.5 rounded-xl bg-[#FCECEC] hover:bg-[#F7DCDC] text-[#C44545] font-semibold text-xs transition cursor-pointer border border-[#F2C6C6] min-h-[34px]"
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </CompactList>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 4. TRABAJOS DE MAQUINARIA RECIBIDOS EN PROPIEDAD             */}
      {/* ============================================================ */}
      {currentScreen === 'maquinaria_recibida' && (() => {
        const q = machineryJobsSearch.trim().toLowerCase();
        const filteredLinkedJobs = linkedPropertyJobs
          .filter((j) => {
            if (!q) return true;
            return `${j.trabajoNombre || ''} ${j.maquinariaNombre || ''} ${j.loteNombre || ''} ${j.fecha || ''}`
              .toLowerCase()
              .includes(q);
          })
          .sort(compareChronologicalDesc);

        return (
          <div className="space-y-3">
            <div className="bg-[#FCECEC]/75 border border-[#F2C6C6] px-3.5 py-2.5 rounded-xl text-xs text-[#8D2C2C] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#C44545] shrink-0" />
              <span className="font-medium">
                {bi(
                  'Trabajos vinculados automáticamente como gasto del lote. Se editan en Maquinarias.',
                  'Jobs automatically linked as lot expenses. Edit them in Machinery.'
                )}
              </span>
            </div>

            <ListToolbar
              title={bi('Trabajos recibidos', 'Received jobs')}
              countLabel={`${filteredLinkedJobs.length} ${bi('reg.', 'rec.')}`}
              searchValue={machineryJobsSearch}
              onSearchChange={setMachineryJobsSearch}
              searchPlaceholder={bi('Buscar labor, equipo o lote...', 'Search job, equipment, or lot...')}
            />

            <CompactList
              isEmpty={filteredLinkedJobs.length === 0}
              emptyMessage={
                q
                  ? bi('No se encontraron trabajos con esa búsqueda.', 'No jobs matched that search.')
                  : bi(
                      'No hay trabajos de maquinaria propia asignados a lotes en esta campaña.',
                      'No internal machinery jobs assigned to lots in this campaign.'
                    )
              }
            >
              {filteredLinkedJobs.map((j) => {
                const jobDisp = resolveJobDisplay(j, machines, machineJobTypes, lang);
                const unitLabel =
                  j.unidad === 'hectarea' || (j.unidad as string) === 'ha' ? 'ha' : 'h';
                const loteLabel = j.loteNombre
                  ? j.loteNombre.toLowerCase().startsWith('lote') || j.loteNombre.toLowerCase().startsWith('lot')
                    ? j.loteNombre
                    : `${bi('Lote', 'Lot')} ${j.loteNombre}`
                  : bi('Lote propio', 'Own lot');

                return (
                  <CompactListRow
                    key={j.id}
                    icon={
                      <div className="w-8 h-8 rounded-lg bg-[#FCECEC] border border-[#F2C6C6]/70 flex items-center justify-center">
                        <VisualIcon name={jobDisp.icon} size="xs" />
                      </div>
                    }
                    title={jobDisp.title}
                    subtitle={
                      <span>
                        {formatDateDDMMAAAA(j.fecha)} ·{' '}
                        <span className="font-semibold text-[#24875B]">{loteLabel}</span> ·{' '}
                        {jobDisp.machineName} · {j.cantidad} {unitLabel}
                      </span>
                    }
                    rightPrimary={
                      <span className="text-[#C44545] tabular-nums">
                        - {j.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                        {j.total.toLocaleString('es-BO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    }
                    rightSecondary={`${j.moneda === 'USD' ? 'USD' : 'Bs'} ${j.tarifa}/${unitLabel}`}
                  />
                );
              })}
            </CompactList>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 1. MOVIMIENTOS DE PROPIEDAD (HISTORIAL CON EDITAR Y ELIMINAR)*/}
      {/* ============================================================ */}
      {currentScreen === 'historial' && (
        <div className="space-y-3">
          <ListToolbar
            title={bi('Historial', 'History')}
            countLabel={
              historialFilter === 'distribuidos'
                ? `${expenseAllocations.length} ${expenseAllocations.length === 1 ? bi('grupo', 'group') : bi('grupos', 'groups')}`
                : `${filteredMovements.length} ${filteredMovements.length === 1 ? bi('registro', 'record') : bi('registros', 'records')}`
            }
            searchValue={historialSearch}
            onSearchChange={setHistorialSearch}
            searchPlaceholder={
              historialFilter === 'distribuidos'
                ? bi('Buscar gasto distribuido o lote...', 'Search distributed expense or lot...')
                : bi('Buscar por concepto, lote u observación...', 'Search by concept, lot, or note...')
            }
            filters={
              <CompactFilter
                value={historialFilter === 'maquinaria' ? 'gastos' : historialFilter}
                onChange={(val) =>
                  setHistorialFilter(val as 'todos' | 'ingresos' | 'gastos' | 'distribuidos')
                }
                accent={
                  historialFilter === 'ingresos'
                    ? 'green'
                    : historialFilter === 'gastos' || historialFilter === 'distribuidos'
                    ? 'red'
                    : 'neutral'
                }
                ariaLabel={bi('Filtrar movimientos por tipo', 'Filter records by type')}
                options={[
                  { value: 'todos', label: bi('Todos', 'All') },
                  { value: 'ingresos', label: bi('Ingresos', 'Income') },
                  { value: 'gastos', label: bi('Gastos', 'Expenses') },
                  { value: 'distribuidos', label: bi('Distribuidos', 'Distributed') },
                ]}
              />
            }
          />

          {historialFilter === 'distribuidos' ? (
            <div className="space-y-2.5">
              {allocationsRevalidating && (
                <div className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-[#5E6D64]">
                  <RefreshCw className="h-3 w-3 animate-spin text-[#24875B]" />
                  <span>{bi('Actualizando gastos distribuidos...', 'Refreshing distributed expenses...')}</span>
                </div>
              )}
              {allocationsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="break-words">
                      {allocationsHasLoaded
                        ? bi(
                            `No se pudo actualizar (${translateError(allocationsError)}). Mostrando últimos datos.`,
                            `Could not refresh (${translateError(allocationsError)}). Showing latest data.`
                          )
                        : translateError(allocationsError)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadExpenseAllocations()}
                    disabled={allocationsLoading}
                    className="text-xs font-bold text-red-700 underline shrink-0 cursor-pointer"
                  >
                    {bi('Reintentar', 'Retry')}
                  </button>
                </div>
              )}
              {allocationsInitialLoading || (!allocationsHasLoaded && !allocationsError) ? (
                <div className="rounded-2xl border border-[#E2E7E3] bg-white p-8 text-center text-xs text-[#5E6D64] flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#C44545]" />
                  <span>{bi('Consultando gastos distribuidos...', 'Loading distributed expenses...')}</span>
                </div>
              ) : (
                <CompactList
                  isEmpty={
                    expenseAllocations.filter((g) => {
                      if (!historialSearch.trim()) return true;
                      const q = historialSearch.trim().toLowerCase();
                      const lotesText = g.lotes
                        .map((lt) => lt.loteNombre || lots.find((x) => String(x.id) === String(lt.loteId))?.nombre || '')
                        .join(' ');
                      return `${g.descripcion} ${g.observacion || ''} ${lotesText} ${g.fecha}`
                        .toLowerCase()
                        .includes(q);
                    }).length === 0
                  }
                  emptyMessage={bi('No hay grupos de gastos distribuidos registrados.', 'No distributed expense groups recorded.')}
                >
                  {expenseAllocations
                    .filter((g) => {
                      if (!historialSearch.trim()) return true;
                      const q = historialSearch.trim().toLowerCase();
                      const lotesText = g.lotes
                        .map((lt) => lt.loteNombre || lots.find((x) => String(x.id) === String(lt.loteId))?.nombre || '')
                        .join(' ');
                      return `${g.descripcion} ${g.observacion || ''} ${lotesText} ${g.fecha}`
                        .toLowerCase()
                        .includes(q);
                    })
                    .map((g) => {
                      const isExp = expandedAllocationId === g.id;
                      const curLabel = g.moneda === 'USD' ? 'USD' : 'Bs';
                      return (
                        <CompactListRow
                          key={g.id}
                          icon={
                            <div className="w-8 h-8 rounded-lg bg-[#FCECEC] border border-[#F2C6C6]/70 flex items-center justify-center text-[#C44545]">
                              <Layers className="h-4 w-4" />
                            </div>
                          }
                          title={formatConcept(g.descripcion)}
                          subtitle={
                            <span>
                              {formatDateDDMMAAAA(g.fecha)} · {g.lotes.length} {bi('lotes', 'lots')}
                              {g.hectareasTotales ? ` · ${g.hectareasTotales.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ha` : ''}
                            </span>
                          }
                          rightPrimary={
                            <span className="tabular-nums text-[#C44545]">
                              - {curLabel}{' '}
                              {g.importe.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          }
                          isExpanded={isExp}
                          onClick={() => setExpandedAllocationId(isExp ? null : g.id)}
                          expandedContent={
                            <div className="space-y-2 text-xs">
                              {g.observacion && (
                                <p className="text-[11px] italic text-[#5E6D64]">{bi('Obs.:', 'Note:')} {g.observacion}</p>
                              )}
                              <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF]">
                                {g.lotes.map((lt, idx) => {
                                  const ltName =
                                    lt.loteNombre ||
                                    lots.find((x) => String(x.id) === String(lt.loteId))?.nombre ||
                                    lt.loteId;
                                  return (
                                    <div key={`${g.id}_${lt.loteId}_${idx}`} className="px-3 py-2 flex items-center justify-between gap-2">
                                      <span className="font-semibold text-[#26352D]">
                                        {ltName}{' '}
                                        <span className="text-[11px] font-normal text-[#5E6D64]">
                                          ({lt.hectareas} ha{lt.porcentaje ? ` · ${lt.porcentaje.toFixed(1)}%` : ''})
                                        </span>
                                      </span>
                                      {lt.importe !== undefined && (
                                        <span className="tabular-nums font-bold text-[#C44545]">
                                          {curLabel}{' '}
                                          {lt.importe.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          }
                        />
                      );
                    })}
                </CompactList>
              )}
            </div>
          ) : (
            <CompactList
              isEmpty={filteredMovements.length === 0}
              emptyMessage={bi('No hay movimientos registrados.', 'No records found.')}
            >
            {filteredMovements.map((m) => {
              const isExpanded = expandedMovementId === m.id;
              const isIncome = m.tipo === 'ingreso';
              const isHarvest = m.tipo === 'cosecha';
              const loteLabel = m.loteNombre
                ? m.loteNombre.toLowerCase().startsWith('lote') || m.loteNombre.toLowerCase().startsWith('lot')
                  ? m.loteNombre
                  : `${bi('Lote', 'Lot')} ${m.loteNombre}`
                : bi('Lote', 'Lot');
              const harvestCampaignName = isHarvest && m.cosechaRecord
                ? campaigns.find((c) => String(c.id) === String(m.cosechaRecord!.campanaId))?.nombre ||
                  activeCampaign?.nombre ||
                  '—'
                : '';

              return (
                <CompactListRow
                  key={`${m.tipo}-${m.id}`}
                  icon={
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                        isIncome || isHarvest
                          ? 'bg-[#EAF5EE] border-[#BFE0CD]/70 text-[#24875B]'
                          : m.tipo === 'gasto_directo'
                          ? 'bg-[#FCECEC] border-[#F2C6C6]/70'
                          : 'bg-amber-50 border-amber-200/80'
                      }`}
                    >
                      <VisualIcon
                        name={
                          m.icono ||
                          (isIncome || isHarvest
                            ? 'granos'
                            : m.tipo === 'gasto_directo'
                            ? 'semillas'
                            : 'tractor')
                        }
                        category={isIncome || isHarvest ? 'ingreso' : m.tipo === 'gasto_directo' ? 'gasto' : 'maquinaria'}
                        size="xs"
                      />
                    </div>
                  }
                  title={m.titulo}
                  subtitle={
                    isHarvest ? (
                      <span>
                        {formatDateDDMMAAAA(m.fecha)} ·{' '}
                        <span className="font-semibold text-[#24875B]">{loteLabel}</span>
                      </span>
                    ) : (
                      <span>
                        {formatDateDDMMAAAA(m.fecha)} ·{' '}
                        <span className="font-semibold text-[#24875B]">{loteLabel}</span> ·{' '}
                        {isIncome
                          ? bi('Ingreso directo', 'Direct income')
                          : m.tipo === 'gasto_directo'
                          ? bi('Gasto directo', 'Direct expense')
                          : bi('Maq. propia', 'Own mach.')}
                      </span>
                    )
                  }
                  rightPrimary={
                    isHarvest && m.cosechaRecord ? (
                      <span className="tabular-nums font-bold text-[#24875B]">
                        {formatHarvestQty(m.cosechaRecord.toneladas, m.cosechaRecord.unidad)}
                      </span>
                    ) : (
                      <span className={`tabular-nums ${isIncome ? 'text-[#24875B]' : 'text-[#C44545]'}`}>
                        {isIncome ? '+ ' : '- '}
                        {m.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                        {m.monto.toLocaleString('es-BO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )
                  }
                  isExpanded={isExpanded}
                  onClick={() => setExpandedMovementId(isExpanded ? null : m.id)}
                  expandedContent={
                    isHarvest && m.cosechaRecord ? (
                      <div className="space-y-3 text-xs">
                        <div className="divide-y divide-[#EFF2EF]">
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Producto', 'Product')}</span>
                            <span className="font-semibold text-[#26352D] text-right">
                              {formatConcept(m.cosechaRecord.producto)}
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Lote', 'Lot')}</span>
                            <span className="font-semibold text-[#24875B] text-right">{loteLabel}</span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Campaña', 'Campaign')}</span>
                            <span className="font-semibold text-[#26352D] text-right">{harvestCampaignName}</span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Fecha', 'Date')}</span>
                            <span className="font-semibold text-[#26352D] text-right">
                              {formatDateDDMMAAAA(m.cosechaRecord.fecha)}
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Cantidad cosechada', 'Harvested quantity')}</span>
                            <span className="tabular-nums font-semibold text-[#24875B] text-right">
                              {formatHarvestQty(m.cosechaRecord.toneladas, m.cosechaRecord.unidad)}
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Cantidad vendida o comprometida', 'Sold or committed quantity')}</span>
                            <span className="tabular-nums font-semibold text-[#26352D] text-right">
                              {formatHarvestQty(m.cosechaRecord.asignadas || 0, m.cosechaRecord.unidad)}
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Cantidad disponible', 'Available quantity')}</span>
                            <span className="tabular-nums font-semibold text-[#26352D] text-right">
                              {formatHarvestQty(m.cosechaRecord.pendiente || 0, m.cosechaRecord.unidad)}
                            </span>
                          </div>
                          {m.cosechaRecord.observacion && (
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium shrink-0">{bi('Observación', 'Observation')}</span>
                              <span className="font-normal text-[#26352D] text-right italic">
                                {m.cosechaRecord.observacion}
                              </span>
                            </div>
                          )}
                        </div>
                        {effectiveIsAdmin ? (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6EBE7]">
                            <button
                              type="button"
                              onClick={() => handleOpenEditHarvest(m.cosechaRecord!)}
                              className="px-3 py-1.5 rounded-xl bg-white border border-[#D4DDD6] hover:bg-[#F2F5F3] text-[#26352D] font-semibold text-xs transition cursor-pointer min-h-[34px] inline-flex items-center gap-1"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>{t('common.edit')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePromptDeleteHarvest(m.cosechaRecord!)}
                              className="px-3 py-1.5 rounded-xl bg-white border border-[#F2C6C6] hover:bg-[#FCECEC] text-[#C44545] font-semibold text-xs transition cursor-pointer min-h-[34px] inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{t('common.delete')}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-[#E6EBE7] text-[11px] text-[#7A8780]">
                            <Lock className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {bi(
                                'Solo el Administrador puede editar o eliminar cosechas guardadas.',
                                'Only the Administrator can edit or delete saved harvests.'
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <div className="divide-y divide-[#EFF2EF]">
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Lote', 'Lot')}</span>
                            <span className="font-semibold text-[#24875B] text-right">
                              {loteLabel}
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Cantidad', 'Quantity')}</span>
                            <span className="font-semibold text-[#26352D] text-right">
                              {m.cantidad ? `${m.cantidad} ${translateUnit(m.unidad || '')}` : '—'}
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Equivalencia', 'Equivalent')}</span>
                            <span className="tabular-nums font-semibold text-[#26352D] text-right">
                              {m.tipoCambio && m.tipoCambio > 0
                                ? m.moneda === 'USD'
                                  ? `Bs ${(m.monto * m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bi('TC', 'FX')}: ${formatTC(m.tipoCambio)})`
                                  : `USD ${(m.monto / m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bi('TC', 'FX')}: ${formatTC(m.tipoCambio)})`
                                : '—'}
                            </span>
                          </div>
                          {m.detalle && (
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium shrink-0">{bi('Observación', 'Observation')}</span>
                              <span className="font-normal text-[#26352D] text-right italic">
                                {m.detalle}
                              </span>
                            </div>
                          )}
                        </div>

                        {(m.tipo === 'gasto_directo' || m.tipo === 'ingreso') && (
                          effectiveIsAdmin ? (
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6EBE7]">
                              <button
                                type="button"
                                onClick={() => handleOpenEditMovement(m)}
                                className="px-3.5 py-1.5 rounded-xl bg-white border border-[#D4DDD6] hover:bg-[#F2F5F3] text-[#26352D] font-semibold text-xs transition cursor-pointer min-h-[34px]"
                              >
                                {t('common.edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  m.tipo === 'gasto_directo'
                                    ? handlePromptDeleteExp(m.id, m.titulo)
                                    : handlePromptDeleteInc(m.id, m.titulo)
                                }
                                className="px-3.5 py-1.5 rounded-xl bg-[#FCECEC] hover:bg-[#F7DCDC] text-[#C44545] font-semibold text-xs transition cursor-pointer border border-[#F2C6C6] min-h-[34px]"
                              >
                                {t('common.delete')}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 pt-2 border-t border-[#E6EBE7] text-[11px] text-[#7A8780]">
                              <Lock className="h-3.5 w-3.5 shrink-0" />
                              <span>{bi('Solo el Administrador puede editar o eliminar registros guardados.', 'Only the Administrator can edit or delete saved records.')}</span>
                            </div>
                          )
                        )}
                      </div>
                    )
                  }
                />
              );
            })}
            </CompactList>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL EDITAR MOVIMIENTO (INGRESO O GASTO MANUAL)             */}
      {/* ============================================================ */}
      {editingMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingMovement.tipo === 'gasto_directo'
                    ? bi('Editar Gasto Agrícola', 'Edit Agricultural Expense')
                    : bi('Editar Ingreso de Cosecha', 'Edit Harvest Income')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {bi('Actualiza los datos del registro en Google Sheets', 'Update the record details in Google Sheets')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMovement(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditMovement} className="space-y-3 overflow-y-auto flex-1 pr-1">
              {/* Fecha */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Fecha', 'Date')} <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={editFecha}
                  onChange={(e) => setEditFecha(e.target.value)}
                  className={FORM_INPUT_CLASS}
                />
              </div>

              {/* Lote */}
              <VisualLotPicker
                lots={lots}
                selectedLotId={editLotId}
                onSelect={(id) => {
                  setEditLotId(id);
                  if (editingMovement.tipo === 'gasto_directo' && isHectareUnit(editUnidad)) {
                    const ha = getLotSurfaceHa(lots, id);
                    if (ha !== null) setEditCantidad(ha);
                  }
                }}
                label={bi('Lote', 'Lot')}
                required
              />

              {/* Concepto / Descripción */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Concepto', 'Concept')} <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editConcepto}
                  onChange={(e) => setEditConcepto(e.target.value)}
                  placeholder={bi('Semillas, Venta Cosecha...', 'Seeds, Harvest Sale...')}
                  className={FORM_INPUT_CLASS}
                />
              </div>

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Cantidad', 'Quantity')} <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0.01"
                    value={editCantidad}
                    onChange={(e) => setEditCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <div>
                  <label className={FORM_LABEL_CLASS}>{bi('Unidad', 'Unit')}</label>
                  <input
                    type="text"
                    value={editUnidad}
                    onChange={(e) => {
                      const nextU = e.target.value;
                      setEditUnidad(nextU);
                      if (
                        editingMovement.tipo === 'gasto_directo' &&
                        editLotId &&
                        isHectareUnit(nextU)
                      ) {
                        const ha = getLotSurfaceHa(lots, editLotId);
                        if (ha !== null) setEditCantidad(ha);
                      }
                    }}
                    placeholder={bi('ha, kg, toneladas, bolsas', 'ha, kg, tons, bags')}
                    className={FORM_INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Precio Unitario y Moneda */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Precio unitario', 'Unit price')} <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0"
                    value={editPrecio}
                    onChange={(e) => {
                      editMovCurrencyAnchorRef.current = null;
                      setEditPrecio(e.target.value === '' ? '' : parseFloat(e.target.value));
                    }}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <CurrencySelect
                  label={bi('Moneda', 'Currency')}
                  required
                  value={editMoneda}
                  onChange={handleEditMovCurrencyChange}
                />
              </div>

              {/* Tipo de Cambio */}
              <div>
                <label className={FORM_LABEL_CLASS}>{bi('Tipo de cambio (Bs/USD)', 'Exchange rate (Bs/USD)')}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={editTc}
                  onChange={(e) => setEditTc(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="6.96"
                  className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                />
              </div>

              {/* Observaciones */}
              <ObservationField
                value={editObs}
                onChange={setEditObs}
                placeholder={bi('Notas adicionales...', 'Additional notes...')}
              />

              {/* Importe total */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F4F7F5] border border-[#DCE2DD]">
                <span className="text-[13px] font-bold text-[#26352D]">{bi('Importe total', 'Total amount')}</span>
                <span className="text-base font-extrabold text-[#1F2D25] tabular-nums">
                  {editMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                  {(Number(editCantidad || 0) * Number(editPrecio || 0)).toLocaleString('es-BO', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Botones Guardar / Cancelar */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingMovement(null)}
                  className="w-full h-[42px] px-4 rounded-xl border border-[#D4DDD6] bg-white text-[#26352D] font-bold text-sm hover:bg-[#F5F7F5] transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="w-full h-[42px] px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] active:bg-[#175B3D] text-white font-bold text-sm shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>{savingEdit ? t('common.saving') : t('common.saveChanges')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CUADRO DE CONFIRMACIÓN PROPIO DE REACT PARA ELIMINACIÓN       */}
      {/* ============================================================ */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{bi('¿Confirmar eliminación?', 'Confirm deletion?')}</h3>
              <p className="text-xs text-slate-600 mt-1">
                {itemToDelete.tipo === 'gasto'
                  ? bi(
                      'Se eliminará definitivamente el registro de gasto agrícola:',
                      'This agricultural expense record will be permanently deleted:'
                    )
                  : bi(
                      'Se eliminará definitivamente el registro de ingreso de cosecha:',
                      'This harvest income record will be permanently deleted:'
                    )}
              </p>
              <p className="text-sm font-bold text-slate-800 mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 break-words">
                {itemToDelete.titulo}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={deletingItem}
                onClick={() => setItemToDelete(null)}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer min-h-[46px]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={deletingItem}
                onClick={handleConfirmDeleteItem}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 min-h-[46px] flex items-center justify-center gap-1.5"
              >
                {deletingItem ? t('common.deleting') : bi('Confirmar', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ============================================================ */}
      {/* MODAL: ASIGNAR PRECIO A COSECHA PENDIENTE (harvest.price)    */}
      {/* ============================================================ */}
      {selectedHarvestForPrice && (() => {
        const lotName =
          selectedHarvestForPrice.loteNombre ||
          lots.find((l) => String(l.id) === String(selectedHarvestForPrice.loteId))?.nombre ||
          bi('Lote', 'Lot');
        const tonsPreview = parseDecimalNumber(priceToneladas);
        const pricePreview = parseDecimalNumber(priceUsdTon);
        const tcPreview = parseDecimalNumber(priceTc);
        const totalInSelectedCurr = tonsPreview > 0 && pricePreview > 0 ? tonsPreview * pricePreview : 0;
        const totalUsdPreview =
          priceMoneda === 'USD'
            ? totalInSelectedCurr
            : tcPreview > 0
            ? totalInSelectedCurr / tcPreview
            : 0;
        const totalBobPreview =
          priceMoneda === 'BOB'
            ? totalInSelectedCurr
            : tcPreview > 0
            ? totalInSelectedCurr * tcPreview
            : 0;

        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
            <div
              className="fixed inset-0"
              onClick={() => !savingHarvestPrice && setSelectedHarvestForPrice(null)}
            />
            <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden z-10 max-h-[92vh] flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {bi('Asignar precio a cosecha', 'Assign price to harvest')}
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {formatConcept(selectedHarvestForPrice.producto)} · {lotName} ·{' '}
                    {formatDateDDMMAAAA(selectedHarvestForPrice.fecha)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingHarvestPrice}
                  onClick={() => setSelectedHarvestForPrice(null)}
                  className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAssignHarvestPriceSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-3">
                {priceModalError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="break-words">{priceModalError}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 divide-x divide-[#E6EBE7] rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] py-2 text-center">
                  <div className="px-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#7A8780] block">{bi('Total', 'Total')}</span>
                    <span className="text-xs font-bold text-[#26352D] tabular-nums">
                      {selectedHarvestForPrice.toneladas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                    </span>
                  </div>
                  <div className="px-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#7A8780] block">{bi('Asignadas', 'Priced')}</span>
                    <span className="text-xs font-bold text-[#24875B] tabular-nums">
                      {selectedHarvestForPrice.asignadas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                    </span>
                  </div>
                  <div className="px-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#7A8780] block">{bi('Pendientes', 'Pending')}</span>
                    <span className="text-xs font-black text-amber-700 tabular-nums">
                      {selectedHarvestForPrice.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                    </span>
                  </div>
                </div>

                {/* Campaña */}
                <AppSelect
                  label={bi('Campaña del ingreso', 'Income campaign')}
                  required
                  icon={<Calendar className="h-[17px] w-[17px]" />}
                  value={priceCampanaId}
                  onChange={(e) => setPriceCampanaId(e.target.value)}
                >
                  <option value="">{bi('Seleccionar campaña', 'Select campaign')}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.activa ? `(${bi('Activa', 'Active')})` : ''}
                    </option>
                  ))}
                </AppSelect>

                {/* Toneladas a asignar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[13px] font-semibold text-[#26352D]">
                      {bi('Toneladas a fijar precio', 'Tons to price')} <span className="text-[#C44545]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPriceToneladas(String(Number(selectedHarvestForPrice.pendiente.toFixed(4))))
                      }
                      className="text-[11px] font-semibold text-[#24875B] hover:underline cursor-pointer"
                    >
                      {bi('Usar todo', 'Use all')} ({selectedHarvestForPrice.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t)
                    </button>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0.01"
                    max={selectedHarvestForPrice.pendiente}
                    required
                    placeholder="0.00"
                    value={priceToneladas}
                    onChange={(e) => setPriceToneladas(e.target.value)}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>

                {/* Precio por tonelada y Moneda (conversión automática USD <-> Bs) */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      {bi('Precio', 'Price')} ({priceMoneda === 'USD' ? 'USD' : 'Bs'}/t){' '}
                      <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={priceUsdTon}
                      onChange={(e) => {
                        priceCurrencyAnchorRef.current = null;
                        setPriceUsdTon(e.target.value);
                      }}
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                    />
                  </div>
                  <CurrencySelect
                    label={bi('Moneda', 'Currency')}
                    required
                    value={priceMoneda}
                    onChange={handlePriceCurrencyChange}
                  />
                </div>

                {/* Tipo de cambio y Fecha */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      {bi('Tipo de cambio', 'Exchange rate')} <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0.01"
                      required
                      placeholder="6.96"
                      value={priceTc}
                      onChange={(e) => setPriceTc(e.target.value)}
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      {bi('Fecha de fijación', 'Pricing date')} <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={priceFecha}
                      onChange={(e) => setPriceFecha(e.target.value)}
                      className={FORM_INPUT_CLASS}
                    />
                  </div>
                </div>

                {/* Importe total */}
                <div className="rounded-xl bg-[#EAF5EE] border border-[#BFE0CD] px-3.5 py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#175B3D]">{bi('Importe total', 'Total amount')}</span>
                    <span className="text-base font-extrabold text-[#175B3D] tabular-nums">
                      {priceMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                      {totalInSelectedCurr.toLocaleString('es-BO', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {priceMoneda === 'USD' && totalBobPreview > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-[#1D5C3F]">
                      <span>{bi('Equivalente en Bs', 'Equivalent in Bs')}</span>
                      <span className="tabular-nums font-semibold">
                        Bs{' '}
                        {totalBobPreview.toLocaleString('es-BO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {priceMoneda === 'BOB' && totalUsdPreview > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-[#1D5C3F]">
                      <span>{bi('Equivalente en USD', 'Equivalent in USD')}</span>
                      <span className="tabular-nums font-semibold">
                        USD{' '}
                        {totalUsdPreview.toLocaleString('es-BO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={savingHarvestPrice}
                    onClick={() => setSelectedHarvestForPrice(null)}
                    className="flex-1 h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer disabled:opacity-50"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={savingHarvestPrice}
                    className="flex-1 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    <span>{savingHarvestPrice ? t('common.saving') : bi('Confirmar precio', 'Confirm price')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* MODAL: CONFIRMACIÓN / BLOQUEO DE ELIMINACIÓN DE COSECHA      */}
      {/* ============================================================ */}
      {harvestToDelete && (() => {
        const committed = Number(harvestToDelete.asignadas || 0);
        const hasLinkedSales =
          committed > 0.0001 ||
          (Array.isArray(harvestToDelete.asignaciones) && harvestToDelete.asignaciones.length > 0);
        const lotName =
          harvestToDelete.loteNombre ||
          lots.find((l) => String(l.id) === String(harvestToDelete.loteId))?.nombre ||
          bi('Lote', 'Lot');

        return (
          <ConfirmationModal
            isOpen={true}
            onClose={() => {
              if (!deletingHarvest) {
                setHarvestToDelete(null);
                setDeleteHarvestError(null);
              }
            }}
            type={hasLinkedSales ? 'warning' : 'danger'}
            title={
              hasLinkedSales
                ? bi('No se puede eliminar', 'Cannot delete')
                : bi('Eliminar cosecha', 'Delete harvest')
            }
            itemTitle={`${bi('Cosecha', 'Harvest')} ${formatConcept(harvestToDelete.producto)}`}
            itemSubtitle={`${formatDateDDMMAAAA(harvestToDelete.fecha)} · ${lotName}`}
            metrics={[
              {
                label: bi('Cantidad cosechada', 'Harvested quantity'),
                value: formatHarvestQty(harvestToDelete.toneladas, harvestToDelete.unidad),
              },
              {
                label: bi('Comprometida en ventas', 'Committed in sales'),
                value: formatHarvestQty(committed, harvestToDelete.unidad),
              },
              ...(hasLinkedSales
                ? [
                    {
                      label: bi('Disponible', 'Available'),
                      value: formatHarvestQty(harvestToDelete.pendiente || 0, harvestToDelete.unidad),
                    },
                  ]
                : []),
            ]}
            message={
              hasLinkedSales
                ? bi(
                    `Esta cosecha tiene ${formatHarvestQty(committed, harvestToDelete.unidad)} comprometidas en ventas activas. Para eliminarla, primero debe anular las ventas vinculadas.`,
                    `This harvest has ${formatHarvestQty(committed, harvestToDelete.unidad)} committed to active sales. To delete it, you must first cancel the linked sales.`
                  )
                : bi(
                    'Se eliminará definitivamente esta cosecha y se descontará del almacén general.',
                    'This harvest will be permanently deleted and deducted from the general warehouse.'
                  )
            }
            errorMsg={deleteHarvestError}
            singleButton={hasLinkedSales}
            confirmText={
              hasLinkedSales
                ? bi('Entendido', 'Understood')
                : deletingHarvest
                ? t('common.deleting')
                : t('common.delete')
            }
            confirmTone={hasLinkedSales ? 'success' : 'danger'}
            isConfirming={deletingHarvest}
            onConfirm={hasLinkedSales ? () => setHarvestToDelete(null) : handleConfirmDeleteHarvest}
          />
        );
      })()}

      {/* ============================================================ */}
      {/* MODAL: EDITAR COSECHA REGISTRADA (harvest.update — Admin)    */}
      {/* ============================================================ */}
      {editingHarvest && (() => {
        const hasAsignaciones =
          (editingHarvest.asignadas || 0) > 0.0001 ||
          (Array.isArray(editingHarvest.asignaciones) && editingHarvest.asignaciones.length > 0);
        const tonsInput = parseDecimalNumber(editHarvToneladas);
        const newPendiente = Math.max(0, Number((tonsInput - (editingHarvest.asignadas || 0)).toFixed(4)));
        const violatesMinTons = hasAsignaciones && tonsInput > 0 && tonsInput + 0.0001 < editingHarvest.asignadas;

        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
            <div
              className="fixed inset-0"
              onClick={() => !savingEditHarvest && setEditingHarvest(null)}
            />
            <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden z-10 max-h-[92vh] flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {bi('Editar cosecha', 'Edit harvest')}
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {formatConcept(editingHarvest.producto)} ·{' '}
                    {editingHarvest.loteNombre || lots.find((l) => String(l.id) === String(editingHarvest.loteId))?.nombre || bi('Lote', 'Lot')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingEditHarvest}
                  onClick={() => setEditingHarvest(null)}
                  className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditHarvest} className="p-4 sm:p-5 overflow-y-auto space-y-3">
                {editHarvestError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="break-words">{editHarvestError}</span>
                  </div>
                )}

                {hasAsignaciones && (
                  <div className="rounded-xl border border-[#BFE0CD] bg-[#F5FAF7] p-3 space-y-2">
                    <div className="grid grid-cols-3 divide-x divide-[#D4E6DC] bg-white rounded-lg border border-[#D4E6DC] py-2 text-center">
                      <div className="px-1">
                        <span className="text-[10px] font-bold uppercase text-[#7A8780] block">{bi('Cosechada', 'Harvested')}</span>
                        <span className="text-xs font-bold text-[#26352D] tabular-nums">
                          {tonsInput > 0 ? formatHarvestQty(tonsInput, editHarvUnidad) : '—'}
                        </span>
                      </div>
                      <div className="px-1">
                        <span className="text-[10px] font-bold uppercase text-[#7A8780] block">{bi('Comprometida', 'Committed')}</span>
                        <span className="text-xs font-bold text-[#24875B] tabular-nums">
                          {formatHarvestQty(editingHarvest.asignadas, editHarvUnidad)}
                        </span>
                      </div>
                      <div className="px-1">
                        <span className="text-[10px] font-bold uppercase text-[#7A8780] block">{bi('Disponible', 'Available')}</span>
                        <span className={`text-xs font-black tabular-nums ${violatesMinTons ? 'text-red-600' : 'text-[#26352D]'}`}>
                          {formatHarvestQty(newPendiente, editHarvUnidad)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#1D5C3F]">
                      {bi(
                        'Con ventas o cantidades comprometidas no se puede cambiar campaña, lote, producto ni unidad, ni reducir por debajo de',
                        'With linked sales or committed quantities, you cannot change campaign, lot, product, or unit, nor reduce below'
                      )}{' '}
                      <strong>{formatHarvestQty(editingHarvest.asignadas, editHarvUnidad)}</strong>.
                    </p>
                  </div>
                )}

                {/* Fecha de cosecha */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Fecha de cosecha', 'Harvest date')} <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editHarvFecha}
                    onChange={(e) => setEditHarvFecha(e.target.value)}
                    className={FORM_INPUT_CLASS}
                  />
                </div>

                {/* Campaña */}
                <AppSelect
                  label={bi('Campaña', 'Campaign')}
                  required
                  disabled={hasAsignaciones}
                  icon={<Calendar className="h-[17px] w-[17px]" />}
                  value={editHarvCampanaId}
                  onChange={(e) => setEditHarvCampanaId(e.target.value)}
                >
                  <option value="">{bi('Seleccionar campaña', 'Select campaign')}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.activa ? `(${bi('Activa', 'Active')})` : ''}
                    </option>
                  ))}
                </AppSelect>

                {/* Lote */}
                <AppSelect
                  label={bi('Lote', 'Lot')}
                  required
                  disabled={hasAsignaciones}
                  icon={<LandPlot className="h-[17px] w-[17px]" />}
                  value={editHarvLotId}
                  onChange={(e) => setEditHarvLotId(e.target.value)}
                >
                  <option value="">{bi('Seleccionar lote', 'Select lot')}</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </AppSelect>

                {/* Producto */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Producto', 'Product')} <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={hasAsignaciones}
                    value={editHarvProducto}
                    onChange={(e) => setEditHarvProducto(e.target.value)}
                    placeholder={bi('Soya, Maíz...', 'Soy, Corn...')}
                    className={`${FORM_INPUT_CLASS} font-semibold`}
                  />
                </div>

                {/* Cantidad y Unidad */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      {bi('Cantidad', 'Quantity')} <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={hasAsignaciones ? editingHarvest.asignadas : 0.01}
                      required
                      placeholder="0.00"
                      value={editHarvToneladas}
                      onChange={(e) => setEditHarvToneladas(e.target.value)}
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums ${
                        violatesMinTons ? 'border-red-400 focus:border-red-500 text-red-700' : ''
                      }`}
                    />
                  </div>
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      {bi('Unidad', 'Unit')} <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={hasAsignaciones}
                      value={editHarvUnidad}
                      onChange={(e) => setEditHarvUnidad(e.target.value)}
                      placeholder={bi('t, kg, qq...', 't, kg, qq...')}
                      className={FORM_INPUT_CLASS}
                    />
                  </div>
                </div>

                {/* Observación */}
                <ObservationField
                  value={editHarvObs}
                  onChange={setEditHarvObs}
                  placeholder={bi('Silo de acopio, humedad, notas...', 'Storage silo, moisture, notes...')}
                />

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={savingEditHarvest}
                    onClick={() => setEditingHarvest(null)}
                    className="flex-1 h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer disabled:opacity-50"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditHarvest || violatesMinTons}
                    className="flex-1 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    <span>{savingEditHarvest ? t('common.saving') : t('common.saveChanges')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
