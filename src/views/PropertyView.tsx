import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  BarChart3,
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
  VisualIncomeItemPicker,
  VisualLotPicker,
} from '../components/VisualEntityPicker';
import {
  AppSelect,
  CurrencySelect,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_TEXTAREA_CLASS,
} from '../components/AppSelect';
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
} from '../types';
import {
  createExpense,
  updateExpense,
  deleteExpense,
  createIncome,
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
  assignHarvestPrice,
  allocateExpense,
  getExpenseAllocations,
  compareChronologicalDesc,
  getMachineIcon,
} from '../services/backend';
import { ReportsView } from './ReportsView';
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
  | 'maquinaria_recibida'
  | 'historial'
  | 'resultados'
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
  currency,
  exchangeRate,
  isAdmin,
  onRefreshData,
}) => {
  const effectiveIsAdmin = isAdmin ?? hasAdminAuthorization();
  const [currentScreen, setCurrentScreen] = useState<PropertyScreen>('main');
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filters for Movimientos (persisted in memory across navigation)
  const [historialSearch, setHistorialSearch] = usePersistedMemoryState<string>('property.historial.search', '');
  const [historialFilter, setHistorialFilter] = usePersistedMemoryState<'todos' | 'ingresos' | 'gastos' | 'maquinaria' | 'distribuidos'>('property.historial.filter', 'todos');
  const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);

  // Accordion & search state for Mis lotes and Trabajos de maquinaria (persisted in memory)
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);
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
  const [expFecha, setExpFecha] = useState(new Date().toISOString().slice(0, 10));
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

  // Form State for Agricultural Income (Direct sale with price — sin preselección de catálogo)
  const [ingresoMode, setIngresoMode] = useState<'venta_directa' | 'sin_precio' | 'asignar_precio'>('venta_directa');
  const [incFecha, setIncFecha] = useState(new Date().toISOString().slice(0, 10));
  const [incLotId, setIncLotId] = useState('');
  const [incConcepto, setIncConcepto] = useState('');
  const [incCantidad, setIncCantidad] = useState<number | ''>('');
  const [incUnidad, setIncUnidad] = useState('');
  const [incPrecio, setIncPrecio] = useState<number | ''>('');
  const [incMoneda, setIncMoneda] = useState<Currency>('BOB');
  const [incTc, setIncTc] = useState(
    exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? String(exchangeRate.tasaBobPerUsd) : ''
  );
  const [incObs, setIncObs] = useState('');

  // Form State for Cosecha sin precio (harvest.create — sin preselección de producto ni lote)
  const [harvFecha, setHarvFecha] = useState(new Date().toISOString().slice(0, 10));
  const [harvCampanaId, setHarvCampanaId] = useState(activeCampaign?.id || '');
  const [harvLotId, setHarvLotId] = useState('');
  const [harvProducto, setHarvProducto] = useState('');
  const [harvUseCustomProduct, setHarvUseCustomProduct] = useState(false);
  const [harvToneladas, setHarvToneladas] = useState('');
  const [harvObs, setHarvObs] = useState('');

  // Filters for Pending / Listed Harvests (persisted in memory; data managed via shared SWR cache below)
  const [pendientesMode, setPendientesMode] = usePersistedMemoryState<'pendientes' | 'todas'>('property.pendientes.mode', 'pendientes');
  const [pendientesSearch, setPendientesSearch] = usePersistedMemoryState<string>('property.pendientes.search', '');
  const [pendientesCampaignId, setPendientesCampaignId] = usePersistedMemoryState<string>('property.pendientes.campaignId', 'all');
  const [expandedHarvestId, setExpandedHarvestId] = useState<string | null>(null);

  // State for Assigning Price to Harvest (harvest.price)
  const [selectedHarvestForPrice, setSelectedHarvestForPrice] = useState<HarvestRecord | null>(null);
  const [priceFecha, setPriceFecha] = useState(new Date().toISOString().slice(0, 10));
  const [priceCampanaId, setPriceCampanaId] = useState(activeCampaign?.id || '');
  const [priceToneladas, setPriceToneladas] = useState('');
  const [priceUsdTon, setPriceUsdTon] = useState('');
  const [priceTc, setPriceTc] = useState(
    exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? String(exchangeRate.tasaBobPerUsd) : ''
  );
  const [savingHarvestPrice, setSavingHarvestPrice] = useState(false);
  const [priceModalError, setPriceModalError] = useState<string | null>(null);

  // State for Editing Harvest (harvest.update — Admin only)
  const [editingHarvest, setEditingHarvest] = useState<HarvestRecord | null>(null);
  const [editHarvFecha, setEditHarvFecha] = useState('');
  const [editHarvCampanaId, setEditHarvCampanaId] = useState('');
  const [editHarvLotId, setEditHarvLotId] = useState('');
  const [editHarvProducto, setEditHarvProducto] = useState('');
  const [editHarvToneladas, setEditHarvToneladas] = useState('');
  const [editHarvObs, setEditHarvObs] = useState('');
  const [savingEditHarvest, setSavingEditHarvest] = useState(false);
  const [editHarvestError, setEditHarvestError] = useState<string | null>(null);

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
      setIncTc((prev) => (prev ? prev : rateStr));
      setExpTc((prev) => (prev ? prev : rateStr));
    }
  }, [exchangeRate?.tasaBobPerUsd]);

  const resetNewIncomeForm = () => {
    setIncFecha(new Date().toISOString().slice(0, 10));
    setIncLotId('');
    setIncConcepto('');
    setIncCantidad('');
    setIncUnidad('');
    setIncPrecio('');
    setIncMoneda('BOB');
    setIncTc(
      exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
        ? String(exchangeRate.tasaBobPerUsd)
        : ''
    );
    setIncObs('');
    setErrorMsg(null);
  };

  const resetNewHarvestForm = () => {
    setHarvFecha(new Date().toISOString().slice(0, 10));
    setHarvCampanaId(activeCampaign?.id || '');
    setHarvLotId('');
    setHarvProducto('');
    setHarvUseCustomProduct(false);
    setHarvToneladas('');
    setHarvObs('');
    setErrorMsg(null);
  };

  const resetNewExpenseForm = () => {
    setExpFecha(new Date().toISOString().slice(0, 10));
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

  // Shared SWR query: pending harvests (reused by Main badge, Pendientes de precio, and Asignar precio)
  const pendingHarvestsQuery = useSwrQuery<HarvestRecord[]>(
    cacheKeys.harvestPending(),
    () => getPendingHarvests(false),
    { enabled: true, minIntervalMs: 3000 }
  );

  // Shared SWR query: all harvests list (used by Pendientes de precio "Todas" and Historial)
  const allHarvestsTargetCamp =
    currentScreen === 'historial'
      ? activeCampaign?.id || 'all'
      : pendientesCampaignId;
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
        (currentScreen === 'pendientes_precio' && pendientesMode === 'todas') ||
        currentScreen === 'historial',
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
    return (pendingHarvestsQuery.data || []).filter((h) => h.pendiente > 0.0001).length;
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
  const propertyIncomeDirects = propertyIncomes.filter((i) => !i.trabajoId);

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

  // Build combined chronological movements for the Historial (incomes, direct expenses, and unpriced/partially priced harvests)
  const allMovements: MovementItem[] = [
    ...propertyIncomeDirects.map((i) => ({
      id: i.id,
      tipo: 'ingreso' as const,
      fecha: i.fecha,
      loteId: i.loteId,
      loteNombre: i.loteNombre || (lots.find((l) => l.id === i.loteId)?.nombre) || 'Lote',
      titulo: formatConcept(i.concepto),
      detalle: `${i.cantidad} ${i.unidad || ''} ${i.precio ? `@ ${i.moneda === 'USD' ? 'USD' : 'Bs'} ${i.precio}` : ''} ${i.observacion ? `• ${i.observacion}` : ''}`.trim(),
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
      loteNombre: e.loteNombre || (lots.find((l) => l.id === e.loteId)?.nombre) || 'Lote',
      titulo: formatConcept(e.itemGasto),
      detalle: `${e.cantidad} ${e.unidad || ''} ${e.precio ? `@ ${e.moneda === 'USD' ? 'USD' : 'Bs'} ${e.precio}` : ''} ${e.observacion ? `• ${e.observacion}` : ''}`.trim(),
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
    ...allHarvestsList
      .filter((h) => h.pendiente > 0.0001)
      .map((h) => ({
        id: `harv_${h.id}`,
        tipo: 'cosecha' as const,
        fecha: h.fecha,
        loteId: h.loteId,
        loteNombre: h.loteNombre || (lots.find((l) => String(l.id) === String(h.loteId))?.nombre) || 'Lote',
        titulo: `Cosecha ${formatConcept(h.producto)}`,
        detalle: h.asignadas > 0
          ? `${h.toneladas} t totales · ${h.asignadas} t asignadas · ${h.pendiente} t pendientes${h.observacion ? ` • ${h.observacion}` : ''}`
          : `${h.toneladas} t · Sin precio${h.observacion ? ` • ${h.observacion}` : ''}`,
        monto: 0,
        moneda: 'USD' as Currency,
        cantidad: h.toneladas,
        unidad: 't',
        observacion: h.observacion,
        icono: 'granos',
        cosechaRecord: h,
        creadoEn: h.creadoEn,
      })),
  ].sort(compareChronologicalDesc);

  // Total movements count
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
      setErrorMsg('Debes seleccionar o activar una campaña activa.');
      return;
    }

    if (!expItem.trim()) {
      setErrorMsg('Selecciona un insumo o concepto de gasto.');
      return;
    }

    if (!expPrecio || Number(expPrecio) <= 0) {
      setErrorMsg('Ingresa un precio unitario válido.');
      return;
    }

    const cantNum = Number(expCantidad) || 1;
    if (cantNum <= 0) {
      setErrorMsg('La cantidad debe ser mayor a 0.');
      return;
    }

    const tcNum = parseDecimalNumber(expTc);
    if (tcNum <= 0) {
      setErrorMsg('Ingresa un tipo de cambio válido mayor a 0.');
      return;
    }

    const selectedItemObj = propertyExpenseItems.find(
      (it) => it.nombre.toLowerCase() === expItem.toLowerCase()
    );
    const totalExp = Number((cantNum * Number(expPrecio)).toFixed(2));

    // MODE A: Single lot (preserves exact existing behavior)
    if (expLotMode === 'single') {
      if (!expLotId) {
        setErrorMsg('Selecciona un lote obligatorio para el gasto agrícola.');
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

        setSuccessMsg('Gasto agrícola registrado en el lote seleccionado.');
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
        setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el gasto agrícola');
      } finally {
        setSaving(false);
      }
      return;
    }

    // MODE B: Multiple lots (2+) — EXCLUSIVELY via single backend call expense.allocate
    if (selectedMultiLots.length < 2) {
      setErrorMsg(
        'Selecciona al menos 2 lotes para distribuir el gasto. Para registrar en un solo lote, utiliza la opción «Un lote».'
      );
      return;
    }

    const invalidLot = selectedMultiLots.find((l) => {
      const ha = Number(expMultiLotHa[l.id]);
      return isNaN(ha) || ha <= 0;
    });
    if (invalidLot) {
      setErrorMsg(`Ingresa las hectáreas trabajadas (mayores a 0) para ${invalidLot.nombre}.`);
      return;
    }

    if (totalMultiLotHa <= 0 || multiLotBreakdown.length < 2) {
      setErrorMsg('El total de hectáreas trabajadas debe ser mayor a 0 en al menos dos lotes.');
      return;
    }

    if (saving) return;
    setSaving(true);
    setSavingProgress(`Distribuyendo gasto entre ${multiLotBreakdown.length} lotes...`);
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

      setSuccessMsg(
        `Gasto distribuido proporcionalmente en ${multiLotBreakdown.length} lotes (${expMoneda === 'USD' ? 'USD' : 'Bs'} ${totalExp.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
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
          ? err.message
          : 'Error al registrar el gasto distribuido en el backend (expense.allocate).'
      );
    } finally {
      setSavingProgress(null);
      setSaving(false);
    }
  };

  // Submit Cosecha sin precio (harvest.create — does NOT create financial income)
  const handleCreateHarvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetCampId = harvCampanaId || activeCampaign?.id || '';
    if (!targetCampId) {
      setErrorMsg('Selecciona una campaña para registrar la cosecha.');
      return;
    }
    if (!harvLotId) {
      setErrorMsg('Selecciona el lote donde se realizó la cosecha.');
      return;
    }
    if (!harvProducto.trim()) {
      setErrorMsg('Ingresa el producto cosechado.');
      return;
    }
    const tonsNum = parseDecimalNumber(harvToneladas);
    if (tonsNum <= 0) {
      setErrorMsg('Ingresa una cantidad válida de toneladas mayores a 0.');
      return;
    }

    setSaving(true);
    try {
      const createdHarvest = await createHarvest({
        fecha: harvFecha,
        campanaId: targetCampId,
        loteId: harvLotId,
        producto: harvProducto.trim(),
        toneladas: tonsNum,
        observacion: harvObs.trim(),
      });

      if (createdHarvest?.id) {
        patchHarvestAcrossCaches(createdHarvest);
      }
      setSuccessMsg(
        `Cosecha sin precio registrada (${tonsNum.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t de ${harvProducto.trim()}). No se creó ingreso financiero todavía.`
      );
      setHarvLotId('');
      setHarvProducto('');
      setHarvUseCustomProduct(false);
      setHarvToneladas('');
      setHarvObs('');
      invalidateQueries(['harvest.']);
      await loadPendingHarvests();
      if (allHarvestsQuery.hasLoaded) {
        loadAllHarvests().catch(() => {});
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al registrar cosecha sin precio (harvest.create).'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAssignPrice = (harvest: HarvestRecord) => {
    setSelectedHarvestForPrice(harvest);
    setPriceFecha(new Date().toISOString().slice(0, 10));
    setPriceCampanaId(activeCampaign?.id || harvest.campanaId || '');
    setPriceToneladas(harvest.pendiente > 0 ? String(Number(harvest.pendiente.toFixed(4))) : '');
    setPriceUsdTon('');
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
    const precioNum = parseDecimalNumber(priceUsdTon);
    const tcNum = parseDecimalNumber(priceTc);
    const targetCampId = priceCampanaId || activeCampaign?.id || selectedHarvestForPrice.campanaId || '';

    if (!targetCampId) {
      setPriceModalError('Selecciona la campaña para registrar el ingreso.');
      return;
    }
    if (tonsNum <= 0) {
      setPriceModalError('Ingresa una cantidad de toneladas mayor a 0.');
      return;
    }
    if (tonsNum > selectedHarvestForPrice.pendiente + 0.0001) {
      setPriceModalError(
        `No puedes asignar más de ${selectedHarvestForPrice.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} t pendientes.`
      );
      return;
    }
    if (precioNum <= 0) {
      setPriceModalError('Ingresa un precio USD/tonelada mayor a 0.');
      return;
    }
    if (tcNum <= 0) {
      setPriceModalError('Ingresa un tipo de cambio válido mayor a 0.');
      return;
    }

    setSavingHarvestPrice(true);
    try {
      const priceRes = await assignHarvestPrice({
        cosechaId: selectedHarvestForPrice.id,
        fecha: priceFecha,
        campanaId: targetCampId,
        toneladas: tonsNum,
        precioUsdTon: precioNum,
        tc: tcNum,
      });

      if (priceRes?.cosecha) {
        patchHarvestAcrossCaches(priceRes.cosecha);
      }
      const totalUsd = tonsNum * precioNum;
      setSuccessMsg(
        `Precio asignado: ${tonsNum.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t a USD ${precioNum.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/t (USD ${totalUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). El ingreso fue generado por el servidor.`
      );
      setSelectedHarvestForPrice(null);
      setPriceToneladas('');
      setPriceUsdTon('');

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
          ? err.message
          : 'Error al asignar precio a la cosecha (harvest.price).'
      );
    } finally {
      setSavingHarvestPrice(false);
    }
  };

  const handleOpenEditHarvest = (harvest: HarvestRecord) => {
    if (!effectiveIsAdmin) {
      setErrorMsg('Solo el Administrador puede editar cosechas registradas.');
      return;
    }
    setEditingHarvest(harvest);
    setEditHarvFecha((harvest.fecha || '').slice(0, 10) || new Date().toISOString().slice(0, 10));
    setEditHarvCampanaId(harvest.campanaId || activeCampaign?.id || '');
    setEditHarvLotId(harvest.loteId || '');
    setEditHarvProducto(harvest.producto || '');
    setEditHarvToneladas(harvest.toneladas > 0 ? String(Number(harvest.toneladas.toFixed(4))) : '');
    setEditHarvObs(harvest.observacion || '');
    setEditHarvestError(null);
  };

  const handleSaveEditHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHarvest || savingEditHarvest) return;
    if (!effectiveIsAdmin) {
      setEditHarvestError('Solo el Administrador puede editar cosechas registradas.');
      return;
    }
    setEditHarvestError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    const hasAsignaciones = (editingHarvest.asignadas || 0) > 0.0001;
    const tonsNum = parseDecimalNumber(editHarvToneladas);

    if (!editHarvFecha) {
      setEditHarvestError('La fecha de cosecha es obligatoria.');
      return;
    }
    if (!editHarvCampanaId) {
      setEditHarvestError('Selecciona la campaña.');
      return;
    }
    if (!editHarvLotId) {
      setEditHarvestError('Selecciona el lote.');
      return;
    }
    if (!editHarvProducto.trim()) {
      setEditHarvestError('Indica el producto cosechado.');
      return;
    }
    if (tonsNum <= 0) {
      setEditHarvestError('Las toneladas deben ser mayores a 0.');
      return;
    }
    if (hasAsignaciones && tonsNum + 0.0001 < editingHarvest.asignadas) {
      setEditHarvestError(
        `No puedes reducir las toneladas por debajo de las ya asignadas con precio (${editingHarvest.asignadas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} t).`
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
        toneladas: tonsNum,
        observacion: editHarvObs.trim(),
      });

      if (updatedHarvest?.id) {
        patchHarvestAcrossCaches(updatedHarvest);
      }
      setEditingHarvest(null);
      setSuccessMsg('Cosecha actualizada correctamente. Las asignaciones históricas de precio se conservaron intactas.');
      invalidateQueries(['harvest.']);
      await loadPendingHarvests();
      if (pendientesMode === 'todas' || allHarvestsQuery.hasLoaded) {
        loadAllHarvests().catch(() => {});
      }
    } catch (err: unknown) {
      setEditHarvestError(
        err instanceof Error ? err.message : 'Error al actualizar la cosecha (harvest.update).'
      );
    } finally {
      setSavingEditHarvest(false);
    }
  };

  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!activeCampaign) {
      setErrorMsg('Debes seleccionar o activar una campaña activa.');
      return;
    }

    if (!incLotId) {
      setErrorMsg('Selecciona el lote de donde proviene la cosecha.');
      return;
    }

    if (!incConcepto.trim()) {
      setErrorMsg('Selecciona un producto o concepto de venta.');
      return;
    }

    if (!incCantidad || Number(incCantidad) <= 0) {
      setErrorMsg('Ingresa una cantidad válida mayor a 0.');
      return;
    }

    if (!incPrecio || Number(incPrecio) <= 0) {
      setErrorMsg('Ingresa el precio unitario de venta.');
      return;
    }

    const tcNum = parseDecimalNumber(incTc);
    if (tcNum <= 0) {
      setErrorMsg('Ingresa un tipo de cambio válido mayor a 0.');
      return;
    }

    const lotObj = lots.find((l) => l.id === incLotId);
    const selectedItemObj = propertyIncomeItems.find(
      (it) => it.nombre.toLowerCase() === incConcepto.toLowerCase()
    );
    const resolvedIcon =
      selectedItemObj?.icono || getIconDefinition(incConcepto, 'ingreso').id;
    const totalInc = (Number(incCantidad) || 0) * Number(incPrecio);

    setSaving(true);
    try {
      await createIncome({
        fecha: incFecha,
        campanaId: activeCampaign.id,
        modulo: 'propiedad',
        loteId: incLotId,
        loteNombre: lotObj?.nombre,
        concepto: incConcepto,
        icono: resolvedIcon,
        cantidad: Number(incCantidad) || 0,
        unidad: incUnidad,
        precio: Number(incPrecio),
        moneda: incMoneda,
        tipoCambio: tcNum,
        total: totalInc,
        observacion: incObs.trim(),
      });

      setSuccessMsg('Ingreso de cosecha registrado exitosamente.');
      setIncLotId('');
      setIncConcepto('');
      setIncCantidad('');
      setIncUnidad('');
      setIncPrecio('');
      setIncObs('');
      setIncTc(
        exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
          ? String(exchangeRate.tasaBobPerUsd)
          : ''
      );
      setCurrentScreen('main');
      onRefreshData('movements');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el ingreso');
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Modal for a manual expense or income (Admin only)
  const handleOpenEditMovement = (m: MovementItem) => {
    if (!effectiveIsAdmin) {
      setErrorMsg('Solo el Administrador puede editar movimientos guardados.');
      return;
    }
    setEditingMovement(m);
    setEditFecha(m.fecha || new Date().toISOString().slice(0, 10));
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
      setErrorMsg('Solo el Administrador puede modificar movimientos guardados.');
      setEditingMovement(null);
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    const cantNum = Number(editCantidad);
    const precioNum = Number(editPrecio);
    if (isNaN(cantNum) || cantNum <= 0) {
      setErrorMsg('La cantidad debe ser mayor a 0.');
      return;
    }
    if (isNaN(precioNum) || precioNum < 0) {
      setErrorMsg('El precio unitario no puede ser negativo.');
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
        setSuccessMsg('Gasto agrícola actualizado en Google Sheets.');
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
        setSuccessMsg('Ingreso de cosecha actualizado en Google Sheets.');
      }

      setEditingMovement(null);
      onRefreshData('movements');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar el registro');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePromptDeleteExp = (id: string, titulo: string) => {
    if (!effectiveIsAdmin) {
      setErrorMsg('Solo el Administrador puede eliminar gastos guardados.');
      return;
    }
    setItemToDelete({ id, tipo: 'gasto', titulo });
  };

  const handlePromptDeleteInc = (id: string, titulo: string) => {
    if (!effectiveIsAdmin) {
      setErrorMsg('Solo el Administrador puede eliminar ingresos guardados.');
      return;
    }
    setItemToDelete({ id, tipo: 'ingreso', titulo });
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;
    if (!effectiveIsAdmin) {
      setErrorMsg('Solo el Administrador puede eliminar registros guardados.');
      setItemToDelete(null);
      return;
    }
    setDeletingItem(true);
    setErrorMsg(null);
    try {
      if (itemToDelete.tipo === 'gasto') {
        await deleteExpense(itemToDelete.id);
        setSuccessMsg('Gasto agrícola eliminado de Google Sheets.');
      } else {
        await deleteIncome(itemToDelete.id);
        setSuccessMsg('Ingreso de cosecha eliminado de Google Sheets.');
      }
      setItemToDelete(null);
      onRefreshData('movements');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeletingItem(false);
    }
  };

  const incCalculatedTotal =
    typeof incCantidad === 'number' && typeof incPrecio === 'number'
      ? incCantidad * incPrecio
      : 0;

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

  return (
    <div className="w-full max-w-full space-y-4">
      {currentScreen !== 'main' && currentScreen !== 'resultados' && (
        <div className="flex items-center gap-3 my-1">
          <button
            type="button"
            onClick={() => setCurrentScreen('main')}
            aria-label="Volver a Propiedad"
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white border border-slate-200 flex items-center justify-center gap-1.5 text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-800 shrink-0" />
            <span className="text-sm font-semibold text-slate-800">Volver</span>
          </button>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
            {currentScreen === 'ingreso' && 'Venta / Cosecha'}
            {currentScreen === 'gasto' && 'Registrar gasto'}
            {currentScreen === 'lotes' && 'Mis lotes'}
            {currentScreen === 'pendientes_precio' && 'Pendientes de precio'}
            {currentScreen === 'maquinaria_recibida' && 'Trabajos de maquinaria'}
            {currentScreen === 'historial' && 'Historial'}
          </h2>
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
          <section className="space-y-2.5" aria-label="Registrar movimiento agrícola">
            <h2 className="text-sm font-bold text-slate-600 px-0.5">
              Registrar
            </h2>

            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Botón VENTA / COSECHA */}
              <button
                type="button"
                onClick={() => {
                  resetNewIncomeForm();
                  resetNewHarvestForm();
                  setIngresoMode('venta_directa');
                  setCurrentScreen('ingreso');
                }}
                className="w-full px-3.5 py-3 rounded-2xl bg-[#2D7D2C] hover:bg-[#256624] active:bg-[#1D541C] text-white flex flex-col items-center justify-center gap-1 transition active:scale-[0.98] cursor-pointer select-none shadow-xs"
              >
                <div className="flex items-center justify-center gap-2">
                  <Wheat className="h-5 w-5 text-white shrink-0" strokeWidth={2.2} />
                  <span className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight text-center">
                    Venta / Cosecha
                  </span>
                </div>
                <span className="text-[11px] text-white/90 font-medium text-center leading-tight">
                  Ingreso del lote
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
                    Gasto
                  </span>
                </div>
                <span className="text-[11px] text-white/90 font-medium text-center leading-tight">
                  Insumos del lote
                </span>
              </button>
            </div>
          </section>

          {/* SECCIÓN B: CONSULTAR */}
          <section className="space-y-2.5" aria-label="Consultar registros de propiedad">
            <h2 className="text-sm font-bold text-slate-600 px-0.5">
              Consultar
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
                      Historial
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {totalMovementsCount}{' '}
                      {totalMovementsCount === 1 ? 'movimiento' : 'movimientos'}
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
                      Historial maquinaria
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {linkedPropertyJobs.length}{' '}
                      {linkedPropertyJobs.length === 1
                        ? 'labor recibida en lotes'
                        : 'labores recibidas en lotes'}
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
                      Mis lotes
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {lots.length}{' '}
                      {lots.length === 1 ? 'lote registrado' : 'lotes registrados'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* 4. Pendientes de precio */}
              <button
                type="button"
                onClick={() => setCurrentScreen('pendientes_precio')}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left min-h-[72px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 shrink-0">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        Pendientes de precio
                      </h3>
                      <span className="text-sm font-bold text-slate-600 tabular-nums shrink-0">
                        {pendingHarvestsCount !== null ? pendingHarvestsCount : '—'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {pendingHarvestsCount !== null && pendingHarvestsCount > 0
                        ? `${pendingHarvestsCount} ${pendingHarvestsCount === 1 ? 'cosecha con toneladas por fijar' : 'cosechas con toneladas por fijar'}`
                        : 'Cosechas con toneladas sin precio asignado'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* 5. Resultados */}
              <button
                type="button"
                onClick={() => setCurrentScreen('resultados')}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left min-h-[72px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 border border-purple-200/80 text-purple-700 shrink-0">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      Resultados
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      Ingresos, gastos y balance por lote
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-VISTA: RESULTADOS DE PROPIEDAD                           */}
      {/* ============================================================ */}
      {currentScreen === 'resultados' && (
        <ReportsView
          campaigns={campaigns}
          activeCampaign={activeCampaign}
          machines={[]}
          lots={lots}
          jobs={jobs}
          expenses={expenses}
          incomes={incomes}
          currency={currency}
          exchangeRate={exchangeRate}
          initialScreen="propiedad"
          onRootBackLabel="Volver a Propiedad"
          onBack={() => setCurrentScreen('main')}
        />
      )}

      {/* ============================================================ */}
      {/* SUB-VISTA: PENDIENTES DE PRECIO (harvest.pending / list / price) */}
      {/* ============================================================ */}
      {currentScreen === 'pendientes_precio' && (() => {
        const sourceList = pendientesMode === 'pendientes' ? pendingHarvests : allHarvestsList;
        const qHarv = pendientesSearch.trim().toLowerCase();
        const filteredHarvests = sourceList
          .filter((h) => {
            if (pendientesCampaignId !== 'all' && h.campanaId && String(h.campanaId) !== String(pendientesCampaignId)) {
              return false;
            }
            if (!qHarv) return true;
            const lotName = h.loteNombre || lots.find((l) => String(l.id) === String(h.loteId))?.nombre || '';
            const campName = h.campanaNombre || campaigns.find((c) => String(c.id) === String(h.campanaId))?.nombre || '';
            return `${h.producto} ${lotName} ${campName} ${formatDateDDMMAAAA(h.fecha)} ${h.observacion || ''}`
              .toLowerCase()
              .includes(qHarv);
          })
          .sort(compareChronologicalDesc);

        const totalPendingTons = filteredHarvests.reduce((sum, h) => sum + (Number(h.pendiente) || 0), 0);
        const totalHarvestedTons = filteredHarvests.reduce((sum, h) => sum + (Number(h.toneladas) || 0), 0);
        const totalAssignedTons = filteredHarvests.reduce((sum, h) => sum + (Number(h.asignadas) || 0), 0);

        return (
          <div className="space-y-3.5">
            {/* Resumen de cosechas pendientes */}
            <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-[#5E6D64]">
                      Toneladas pendientes
                    </p>
                    {harvestsRevalidating && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#24875B]">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Actualizando...</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-[#24875B] tabular-nums mt-0.5">
                    {totalPendingTons.toLocaleString('es-BO', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-sm font-bold text-[#5E6D64]">t</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      pendientesMode === 'pendientes'
                        ? loadPendingHarvests()
                        : loadAllHarvests()
                    }
                    disabled={harvestsLoading}
                    title="Actualizar cosechas"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF5EE] text-[#24875B] hover:bg-[#DCEFE4] transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${harvestsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {harvestsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-900 space-y-0.5 min-w-0 flex-1">
                    <p className="font-bold">
                      {harvestsHasLoaded
                        ? 'No se pudo actualizar. Mostrando los últimos datos cargados.'
                        : 'Error al consultar cosechas en Google Apps Script'}
                    </p>
                    <p className="break-words text-red-800/90">{harvestsError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    pendientesMode === 'pendientes'
                      ? loadPendingHarvests()
                      : loadAllHarvests()
                  }
                  disabled={harvestsLoading}
                  className="text-xs font-bold text-red-700 hover:text-red-900 underline shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Reintentar
                </button>
              </div>
            )}

            <ListToolbar
              title="Cosechas"
              countLabel={`${filteredHarvests.length} reg.`}
              searchValue={pendientesSearch}
              onSearchChange={setPendientesSearch}
              searchPlaceholder="Buscar producto, lote o campaña..."
              filters={
                <div className="flex items-center gap-1.5">
                  <CompactFilter
                    value={pendientesMode}
                    onChange={(val) => setPendientesMode(val as 'pendientes' | 'todas')}
                    ariaLabel="Filtrar cosechas"
                    options={[
                      { value: 'pendientes', label: 'Pendientes' },
                      { value: 'todas', label: 'Todas' },
                    ]}
                  />
                  {campaigns.length > 0 && (
                    <CompactFilter
                      value={pendientesCampaignId}
                      onChange={(val) => setPendientesCampaignId(val)}
                      ariaLabel="Filtrar por campaña"
                      options={[
                        { value: 'all', label: 'Todas' },
                        ...campaigns.map((c) => ({
                          value: String(c.id),
                          label: c.activa ? `${c.nombre} (Activa)` : c.nombre,
                        })),
                      ]}
                    />
                  )}
                </div>
              }
            />

            {harvestsInitialLoading || (!harvestsHasLoaded && !harvestsError) ? (
              <div className="rounded-2xl border border-[#E2E7E3] bg-white p-8 text-center text-xs text-[#5E6D64] flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-[#24875B]" />
                <span>Consultando cosechas...</span>
              </div>
            ) : (
              <CompactList
                isEmpty={filteredHarvests.length === 0}
                emptyMessage={
                  !harvestsHasLoaded && harvestsError
                    ? 'No se pudieron cargar las cosechas.'
                    : qHarv
                    ? 'No se encontraron cosechas con esa búsqueda.'
                    : pendientesMode === 'pendientes'
                    ? 'No hay cosechas pendientes de precio.'
                    : 'No hay cosechas registradas para este filtro.'
                }
              >
                {filteredHarvests.map((h) => {
                  const isExpanded = expandedHarvestId === h.id;
                  const lotName =
                    h.loteNombre || lots.find((l) => String(l.id) === String(h.loteId))?.nombre || 'Lote';
                  const campName =
                    h.campanaNombre ||
                    campaigns.find((c) => String(c.id) === String(h.campanaId))?.nombre ||
                    'Sin campaña';
                  const hasPending = h.pendiente > 0.0001;

                  return (
                    <CompactListRow
                      key={h.id}
                      icon={
                        <div className="w-8 h-8 rounded-lg bg-[#EAF5EE] border border-[#BFE0CD]/70 flex items-center justify-center">
                          <VisualIcon name={getIconDefinition(h.producto, 'ingreso').id || 'granos'} size="xs" />
                        </div>
                      }
                      title={
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span>{formatConcept(h.producto)}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              hasPending
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-[#EAF5EE] text-[#1D5C3F] border border-[#BFE0CD]'
                            }`}
                          >
                            {hasPending ? 'Sin precio' : 'Completa'}
                          </span>
                        </span>
                      }
                      subtitle={
                        <span>
                          {formatDateDDMMAAAA(h.fecha)} ·{' '}
                          <span className="font-semibold text-[#24875B]">{lotName}</span> · {campName}
                        </span>
                      }
                      rightPrimary={
                        <span className={`font-mono ${hasPending ? 'text-amber-700' : 'text-[#24875B]'}`}>
                          {h.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                        </span>
                      }
                      rightSecondary={`de ${h.toneladas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`}
                      isExpanded={isExpanded}
                      onClick={() => setExpandedHarvestId(isExpanded ? null : h.id)}
                      expandedContent={
                        <div className="space-y-3 text-xs">
                          <div className="grid grid-cols-3 divide-x divide-[#E6EBE7] rounded-xl border border-[#E2E7E3] bg-white py-2 text-center">
                            <div className="px-1.5">
                              <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Total</span>
                              <span className="text-xs font-bold text-[#26352D] font-mono">
                                {h.toneladas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                              </span>
                            </div>
                            <div className="px-1.5">
                              <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Asignadas</span>
                              <span className="text-xs font-bold text-[#24875B] font-mono">
                                {h.asignadas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                              </span>
                            </div>
                            <div className="px-1.5">
                              <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Pendientes</span>
                              <span className={`text-xs font-black font-mono ${hasPending ? 'text-amber-700' : 'text-[#24875B]'}`}>
                                {h.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                              </span>
                            </div>
                          </div>

                          {h.observacion && (
                            <p className="text-[11px] text-[#5E6D64] italic px-1">
                              Obs.: {h.observacion}
                            </p>
                          )}

                          <div className={`flex items-center gap-2 ${hasPending && effectiveIsAdmin ? 'flex-wrap sm:flex-nowrap' : ''}`}>
                            {hasPending && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAssignPrice(h);
                                }}
                                className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                              >
                                <DollarSign className="h-4 w-4 shrink-0" />
                                <span>Asignar precio ({h.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t disp.)</span>
                              </button>
                            )}
                            {effectiveIsAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditHarvest(h);
                                }}
                                className={`${hasPending ? 'px-3.5' : 'w-full px-4'} min-h-[42px] py-2.5 rounded-xl bg-white hover:bg-[#F2F5F3] text-[#26352D] border border-[#D4DDD6] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer`}
                              >
                                <Edit3 className="h-3.5 w-3.5 shrink-0" />
                                <span>Editar</span>
                              </button>
                            )}
                          </div>

                          {/* Historial de asignaciones de precio (Solo cuando existan asignaciones) */}
                          {h.asignaciones && h.asignaciones.length > 0 && (
                            <div className="rounded-xl border border-[#E2E7E3] bg-white overflow-hidden">
                              <div className="px-3 py-2 bg-[#F8FAF8] border-b border-[#EFF2EF]">
                                <span className="text-[11px] font-bold text-[#26352D]">
                                  Asignaciones de precio ({h.asignaciones.length})
                                </span>
                              </div>
                              <div className="divide-y divide-[#EFF2EF]">
                                {h.asignaciones.map((asig) => (
                                  <div
                                    key={asig.id}
                                    className="px-3 py-2 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-[#26352D]">
                                        {formatDateDDMMAAAA(asig.fecha)} ·{' '}
                                        {asig.toneladas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t × USD{' '}
                                        {asig.precioUsdTon.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/t
                                      </p>
                                      {asig.tc > 0 && (
                                        <p className="text-[11px] text-[#7A8780]">
                                          TC: {formatTC(asig.tc)}
                                        </p>
                                      )}
                                    </div>
                                    <span className="font-mono font-bold text-[#24875B] shrink-0">
                                      USD{' '}
                                      {Number(asig.totalUsd ?? asig.toneladas * asig.precioUsdTon).toLocaleString('es-BO', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </CompactList>
            )}
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* FORMULARIO: VENTA / COSECHA (DIRECTA | SIN PRECIO | ASIGNAR) */}
      {/* ============================================================ */}
      {currentScreen === 'ingreso' && (
        <div className="space-y-3">
          {/* Selector de operación dentro de Venta / Cosecha */}
          <div className="flex p-1 bg-[#F2F5F3] rounded-xl gap-1 border border-[#E2E7E3]">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIngresoMode('venta_directa');
              }}
              className={`flex-1 h-[36px] px-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                ingresoMode === 'venta_directa'
                  ? 'bg-white text-[#24875B] shadow-xs border border-[#BFE0CD]'
                  : 'text-[#5E6D64] hover:text-[#26352D]'
              }`}
            >
              Venta directa
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIngresoMode('sin_precio');
              }}
              className={`flex-1 h-[36px] px-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                ingresoMode === 'sin_precio'
                  ? 'bg-white text-[#24875B] shadow-xs border border-[#BFE0CD]'
                  : 'text-[#5E6D64] hover:text-[#26352D]'
              }`}
            >
              Sin precio
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIngresoMode('asignar_precio');
              }}
              className={`flex-1 h-[36px] px-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                ingresoMode === 'asignar_precio'
                  ? 'bg-white text-[#24875B] shadow-xs border border-[#BFE0CD]'
                  : 'text-[#5E6D64] hover:text-[#26352D]'
              }`}
            >
              Asignar precio{pendingHarvestsCount ? ` (${pendingHarvestsCount})` : ''}
            </button>
          </div>

          {/* MODO 1: VENTA DIRECTA CON PRECIO */}
          {ingresoMode === 'venta_directa' && (() => {
            const standardSaleUnits = [
              { val: 'toneladas', label: 'Toneladas (t)' },
              { val: 'quintales', label: 'Quintales (qq)' },
              { val: 'kg', label: 'Kilos (kg)' },
              { val: 'bolsas', label: 'Bolsas' },
            ];
            const hasCustomSaleUnit =
              Boolean(incUnidad) &&
              !standardSaleUnits.some((u) => u.val.toLowerCase() === incUnidad.toLowerCase());

            return (
              <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 shadow-xs">
                <form onSubmit={handleIncomeSubmit} className="space-y-3">
                  {/* Lote */}
                  <VisualLotPicker
                    lots={lots}
                    selectedLotId={incLotId}
                    onSelect={(id) => setIncLotId(id)}
                    label="Lote"
                    required
                  />

                  {/* Concepto / Producto */}
                  <VisualIncomeItemPicker
                    items={propertyIncomeItems}
                    selectedItemName={incConcepto}
                    onSelectItem={(item) => {
                      setIncConcepto(item.nombre);
                      if (item.unidad) setIncUnidad(item.unidad);
                      if (item.precioPredeterminado || item.precio) {
                        setIncPrecio(item.precioPredeterminado || item.precio);
                      }
                      if (item.moneda) {
                        setIncMoneda(item.moneda);
                      }
                    }}
                    label="Producto / Concepto"
                    required
                  />

                  {/* Fecha */}
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Fecha <span className="text-[#C44545]">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-[#64746B] pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={incFecha}
                        onChange={(e) => setIncFecha(e.target.value)}
                        className={`${FORM_INPUT_CLASS} pl-9`}
                      />
                    </div>
                  </div>

                  {/* Cantidad y Unidad */}
                  <div className="grid grid-cols-2 gap-2.5 items-end">
                    <div>
                      <label className={FORM_LABEL_CLASS}>
                        Cantidad <span className="text-[#C44545]">*</span>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        required
                        min="0.01"
                        placeholder="0.0"
                        value={incCantidad}
                        onChange={(e) => setIncCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                      />
                    </div>
                    <AppSelect
                      label="Unidad"
                      icon={<List className="h-[17px] w-[17px]" />}
                      value={incUnidad}
                      onChange={(e) => setIncUnidad(e.target.value)}
                    >
                      <option value="">Seleccionar unidad</option>
                      {standardSaleUnits.map((u) => (
                        <option key={u.val} value={u.val}>
                          {u.label}
                        </option>
                      ))}
                      {hasCustomSaleUnit && <option value={incUnidad}>{incUnidad}</option>}
                    </AppSelect>
                  </div>

                  {/* Precio y Moneda */}
                  <div className="grid grid-cols-2 gap-2.5 items-end">
                    <div>
                      <label className={FORM_LABEL_CLASS}>
                        Precio unitario <span className="text-[#C44545]">*</span>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        required
                        min="0.01"
                        placeholder="0.00"
                        value={incPrecio}
                        onChange={(e) => setIncPrecio(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                      />
                    </div>
                    <CurrencySelect
                      label="Moneda"
                      required
                      value={incMoneda}
                      onChange={(curr) => setIncMoneda(curr)}
                    />
                  </div>

                  {/* Tipo de cambio editable */}
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Tipo de cambio (Bs/USD) <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required
                      min="0.01"
                      placeholder="6.96"
                      value={incTc}
                      onChange={(e) => setIncTc(e.target.value)}
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                    />
                  </div>

                  {/* Importe total */}
                  <div className="bg-[#EAF5EE] px-3.5 py-2.5 rounded-xl border border-[#BFE0CD] flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#175B3D]">Importe total</span>
                    <span className="text-base font-extrabold text-[#175B3D] font-mono tabular-nums">
                      {incMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                      {incCalculatedTotal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Observación */}
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Observación <span className="text-[#7A8780] font-normal">(opcional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Comprador, silo, remisión..."
                      value={incObs}
                      onChange={(e) => setIncObs(e.target.value)}
                      className={FORM_TEXTAREA_CLASS}
                    />
                  </div>

                  {/* Botones */}
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#24875B] h-[42px] text-sm font-bold text-white shadow-xs hover:bg-[#1D704B] active:bg-[#175B3D] transition disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{saving ? 'Guardando...' : 'Guardar ingreso'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentScreen('main')}
                      className="px-4 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F5] text-[#26352D] text-sm font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            );
          })()}

          {/* MODO 2: REGISTRAR COSECHA SIN PRECIO (harvest.create) */}
          {ingresoMode === 'sin_precio' && (() => {
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

            return (
              <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 shadow-xs">
                <form onSubmit={handleCreateHarvestSubmit} className="space-y-3">
                  {/* Campaña */}
                  <AppSelect
                    label="Campaña"
                    required
                    icon={<Calendar className="h-[17px] w-[17px]" />}
                    value={harvCampanaId}
                    onChange={(e) => setHarvCampanaId(e.target.value)}
                  >
                    <option value="">Seleccionar campaña</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.activa ? '(Activa)' : ''}
                      </option>
                    ))}
                  </AppSelect>

                  {/* Lote */}
                  <VisualLotPicker
                    lots={lots}
                    selectedLotId={harvLotId}
                    onSelect={(id) => setHarvLotId(id)}
                    label="Lote"
                    required
                  />

                  {/* Producto (selector compacto sin preselección) */}
                  {!harvUseCustomProduct ? (
                    <AppSelect
                      label="Producto"
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
                      <option value="">Seleccionar producto</option>
                      {productOptions.map((prod) => (
                        <option key={prod} value={prod}>
                          {prod}
                        </option>
                      ))}
                      <option value="__otro__">Otro producto...</option>
                    </AppSelect>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="text-[13px] font-semibold text-[#26352D]">
                          Producto <span className="text-[#C44545]">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setHarvUseCustomProduct(false);
                            setHarvProducto('');
                          }}
                          className="text-[11px] font-semibold text-[#24875B] hover:underline cursor-pointer"
                        >
                          Elegir de la lista
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={harvProducto}
                        onChange={(e) => setHarvProducto(e.target.value)}
                        placeholder="Escribir nombre del producto"
                        className={`${FORM_INPUT_CLASS} font-semibold`}
                      />
                    </div>
                  )}

                  {/* Fecha y Toneladas */}
                  <div className="grid grid-cols-2 gap-2.5 items-end">
                    <div>
                      <label className={FORM_LABEL_CLASS}>
                        Fecha de cosecha <span className="text-[#C44545]">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={harvFecha}
                        onChange={(e) => setHarvFecha(e.target.value)}
                        className={FORM_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={FORM_LABEL_CLASS}>
                        Toneladas (t) <span className="text-[#C44545]">*</span>
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
                  </div>

                  {/* Observación */}
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Observación <span className="text-[#7A8780] font-normal">(opcional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Silo de acopio, humedad, remisión..."
                      value={harvObs}
                      onChange={(e) => setHarvObs(e.target.value)}
                      className={FORM_TEXTAREA_CLASS}
                    />
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#24875B] h-[42px] text-sm font-bold text-white shadow-xs hover:bg-[#1D704B] transition disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{saving ? 'Guardando...' : 'Guardar cosecha'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentScreen('main')}
                      className="px-4 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F5] text-[#26352D] text-sm font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            );
          })()}

          {/* MODO 3: ASIGNAR PRECIO A COSECHA PENDIENTE (harvest.pending + harvest.price) */}
          {ingresoMode === 'asignar_precio' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-stone-900">
                      Cosechas con toneladas pendientes ({pendingHarvests.filter((h) => h.pendiente > 0.0001).length})
                    </h2>
                    {pendingHarvestsRevalidating && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#24875B]">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Actualizando...</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Incluye cosechas de campañas anteriores. Selecciona una para fijar precio total o parcial.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadPendingHarvests()}
                  disabled={pendingHarvestsLoading}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF5EE] text-[#24875B] hover:bg-[#DCEFE4] transition cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${pendingHarvestsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {pendingHarvestsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-900 space-y-0.5 min-w-0 flex-1">
                      <p className="font-bold">
                        {pendingHarvestsHasLoaded
                          ? 'No se pudo actualizar. Mostrando los últimos datos cargados.'
                          : 'Error al consultar cosechas pendientes'}
                      </p>
                      <p className="break-words text-red-800/90">{pendingHarvestsError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadPendingHarvests()}
                    disabled={pendingHarvestsLoading}
                    className="text-xs font-bold text-red-700 hover:text-red-900 underline shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {pendingHarvestsInitialLoading || (!pendingHarvestsHasLoaded && !pendingHarvestsError) ? (
                <div className="rounded-2xl border border-[#E2E7E3] bg-white p-8 text-center text-xs text-[#5E6D64] flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#24875B]" />
                  <span>Consultando cosechas pendientes...</span>
                </div>
              ) : (
                <CompactList
                  isEmpty={pendingHarvests.filter((h) => h.pendiente > 0.0001).length === 0}
                  emptyMessage={
                    !pendingHarvestsHasLoaded && pendingHarvestsError
                      ? 'No se pudieron cargar las cosechas pendientes.'
                      : 'No hay cosechas con toneladas pendientes de precio.'
                  }
                >
                  {pendingHarvests
                    .filter((h) => h.pendiente > 0.0001)
                    .sort(compareChronologicalDesc)
                    .map((h) => {
                      const lotName =
                        h.loteNombre || lots.find((l) => String(l.id) === String(h.loteId))?.nombre || 'Lote';
                      const campName =
                        h.campanaNombre ||
                        campaigns.find((c) => String(c.id) === String(h.campanaId))?.nombre ||
                        'Sin campaña';
                      return (
                        <CompactListRow
                          key={h.id}
                          onClick={() => handleOpenAssignPrice(h)}
                          chevron="right"
                          icon={
                            <div className="w-8 h-8 rounded-lg bg-[#EAF5EE] border border-[#BFE0CD]/70 flex items-center justify-center">
                              <VisualIcon name={getIconDefinition(h.producto, 'ingreso').id || 'granos'} size="xs" />
                            </div>
                          }
                          title={formatConcept(h.producto)}
                          subtitle={
                            <span>
                              {formatDateDDMMAAAA(h.fecha)} ·{' '}
                              <span className="font-semibold text-[#24875B]">{lotName}</span> · {campName}
                            </span>
                          }
                          rightPrimary={
                            <span className="font-mono text-amber-700">
                              {h.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                            </span>
                          }
                          rightSecondary={`Asign.: ${h.asignadas.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} / ${h.toneladas.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} t`}
                        />
                      );
                    })}
                </CompactList>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* FORMULARIO: REGISTRAR GASTO AGRÍCOLA                         */}
      {/* ============================================================ */}
      {currentScreen === 'gasto' && (() => {
        const standardExpUnits = [
          { val: 'kg', label: 'Kilogramos (kg)' },
          { val: 'litros', label: 'Litros (l)' },
          { val: 'bolsas', label: 'Bolsas' },
          { val: 'toneladas', label: 'Toneladas (t)' },
          { val: 'unidades', label: 'Unidades' },
        ];
        const hasCustomExpUnit =
          Boolean(expUnidad) &&
          !standardExpUnits.some((u) => u.val.toLowerCase() === expUnidad.toLowerCase());

        return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 shadow-xs">
            <form onSubmit={handleExpenseSubmit} className="space-y-3">
              {/* Modo de asignación: Un lote o Varios lotes */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Asignación <span className="text-[#C44545]">*</span>
                </label>
                <div className="flex p-1 bg-[#F2F5F3] rounded-xl gap-1 border border-[#E2E7E3]">
                  <button
                    type="button"
                    onClick={() => setExpLotMode('single')}
                    className={`flex-1 h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer ${
                      expLotMode === 'single'
                        ? 'bg-white text-[#26352D] shadow-xs border border-[#D4DDD6]'
                        : 'text-[#5E6D64] hover:text-[#26352D]'
                    }`}
                  >
                    Un lote
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpLotMode('multi')}
                    className={`flex-1 h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer ${
                      expLotMode === 'multi'
                        ? 'bg-white text-[#C44545] shadow-xs border border-[#F2C6C6]'
                        : 'text-[#5E6D64] hover:text-[#26352D]'
                    }`}
                  >
                    Varios lotes (por ha)
                  </button>
                </div>
              </div>

              {/* Lote Destino (Simple o Múltiple con hectáreas trabajadas) */}
              {expLotMode === 'single' ? (
                <VisualLotPicker
                  lots={lots}
                  selectedLotId={expLotId}
                  onSelect={(id) => setExpLotId(id)}
                  label="Lote"
                  required
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[13px] font-semibold text-[#26352D]">
                      Lotes y hectáreas <span className="text-[#C44545]">*</span>
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
                        {selectedMultiLots.length === lots.length ? 'Limpiar' : 'Seleccionar todos'}
                      </button>
                    )}
                  </div>

                  {lots.length === 0 ? (
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                      No hay lotes registrados. Agrega lotes en Administración.
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
                                  aria-label={`Hectáreas trabajadas en ${lot.nombre}`}
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
                  setExpItem(item.nombre);
                  if (item.unidad) setExpUnidad(item.unidad);
                  if (item.precioDefecto) setExpPrecio(item.precioDefecto);
                  if (item.moneda) setExpMoneda(item.moneda);
                }}
                label="Concepto de gasto"
                defaultIcon="semillas"
                required
              />

              {/* Fecha */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Fecha <span className="text-[#C44545]">*</span>
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
                    Cantidad <span className="text-[#C44545]">*</span>
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
                  label="Unidad"
                  icon={<List className="h-[17px] w-[17px]" />}
                  value={expUnidad}
                  onChange={(e) => setExpUnidad(e.target.value)}
                >
                  <option value="">Seleccionar unidad</option>
                  {standardExpUnits.map((u) => (
                    <option key={u.val} value={u.val}>
                      {u.label}
                    </option>
                  ))}
                  {hasCustomExpUnit && <option value={expUnidad}>{expUnidad}</option>}
                </AppSelect>
              </div>

              {/* Precio y Moneda */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Precio unitario <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0.01"
                    placeholder="0.00"
                    value={expPrecio}
                    onChange={(e) => setExpPrecio(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <CurrencySelect
                  label="Moneda"
                  required
                  value={expMoneda}
                  onChange={(curr) => setExpMoneda(curr)}
                />
              </div>

              {/* Tipo de cambio editable */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Tipo de cambio (Bs/USD) <span className="text-[#C44545]">*</span>
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
                  <span className="text-[13px] font-bold text-[#9F2D2D]">Importe total</span>
                  <span className="text-base font-extrabold text-[#9F2D2D] font-mono tabular-nums">
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
                      <span>Desglose proporcional</span>
                      <span className="tabular-nums">
                        {totalMultiLotHa.toLocaleString('es-BO', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        })}{' '}
                        ha totales
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
                            <span className="font-mono font-bold text-[#C44545] shrink-0">
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
                        Ingresa las hectáreas trabajadas de cada lote para ver el reparto proporcional.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Observación */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Observación <span className="text-[#7A8780] font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Dosis aplicada, proveedor, factura o remisión..."
                  value={expObs}
                  onChange={(e) => setExpObs(e.target.value)}
                  className={FORM_TEXTAREA_CLASS}
                />
              </div>

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
                      ? savingProgress || 'Guardando...'
                      : expLotMode === 'multi' && multiLotBreakdown.length > 1
                      ? `Guardar en ${multiLotBreakdown.length} lotes`
                      : 'Guardar gasto'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('main')}
                  className="px-4 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F5] text-[#26352D] text-sm font-semibold cursor-pointer"
                >
                  Cancelar
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
                  Gastos distribuidos registrados ({expenseAllocations.length})
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
                    Grupos consultados directamente desde el servidor (<code>expense.allocations</code>).
                  </p>
                  <button
                    type="button"
                    onClick={() => loadExpenseAllocations()}
                    disabled={allocationsLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-[11px] font-semibold text-[#26352D] cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${allocationsLoading ? 'animate-spin' : ''}`} />
                    <span>Actualizar</span>
                  </button>
                </div>

                {allocationsError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <span className="break-words">
                        {allocationsHasLoaded
                          ? `No se pudo actualizar (${allocationsError}). Mostrando últimos datos.`
                          : allocationsError}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadExpenseAllocations()}
                      disabled={allocationsLoading}
                      className="text-xs font-bold text-red-700 underline shrink-0 cursor-pointer"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                <CompactList
                  isEmpty={expenseAllocations.length === 0}
                  emptyMessage={
                    allocationsInitialLoading || (!allocationsHasLoaded && !allocationsError)
                      ? 'Consultando gastos distribuidos...'
                      : 'No hay gastos distribuidos registrados en esta campaña.'
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
                            {formatDateDDMMAAAA(g.fecha)} · {g.lotes.length} lotes
                            {g.hectareasTotales ? ` · ${g.hectareasTotales.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ha` : ''}
                          </span>
                        }
                        rightPrimary={
                          <span className="font-mono text-[#C44545]">
                            {curLabel}{' '}
                            {g.importe.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        }
                        isExpanded={isExp}
                        onClick={() => setExpandedAllocationId(isExp ? null : g.id)}
                        expandedContent={
                          <div className="space-y-2 text-xs">
                            {g.observacion && (
                              <p className="text-[11px] italic text-[#5E6D64]">Obs.: {g.observacion}</p>
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
                                      <span className="font-mono font-bold text-[#C44545]">
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
      {/* 3. MIS LOTES (UNIFICADO CON EL RESUMEN POR LOTE - ACCORDION) */}
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
              title="Mis lotes"
              countLabel={`${filteredLots.length} · ${totalHa.toFixed(1)} ha`}
              searchValue={lotsSearch}
              onSearchChange={setLotsSearch}
              searchPlaceholder="Buscar lote, cultivo o ubicación..."
            />

            <CompactList
              isEmpty={filteredLots.length === 0}
              emptyMessage={
                q ? 'No se encontraron lotes con esa búsqueda.' : 'No hay lotes registrados aún.'
              }
            >
              {filteredLots.map((lot) => {
                const isExpanded = expandedLotId === lot.id;
                const lotMachineryJobs = linkedPropertyJobs.filter((j) => j.loteId === lot.id);
                const lotIncomes = propertyIncomeDirects.filter((i) => i.loteId === lot.id);
                const lotExpensesDirect = propertyExpenseDirects.filter((e) => e.loteId === lot.id);

                const tcDefault = exchangeRate?.tasaBobPerUsd || 6.96;
                const lotTotalIncomesUsd = lotIncomes.reduce((sum, i) => {
                  const tc = i.tipoCambio || i.tc || tcDefault;
                  return sum + (i.moneda === 'USD' ? i.total : i.total / tc);
                }, 0);

                const lotTotalDirectExpensesUsd = lotExpensesDirect.reduce((sum, e) => {
                  const tc = e.tipoCambio || e.tc || tcDefault;
                  return sum + (e.moneda === 'USD' ? e.total : e.total / tc);
                }, 0);

                const lotTotalMachineryJobsUsd = lotMachineryJobs.reduce((sum, j) => {
                  const tc = j.tipoCambio || j.tc || tcDefault;
                  return sum + (j.moneda === 'USD' ? j.total : j.total / tc);
                }, 0);

                const lotTotalExpensesUsd = lotTotalDirectExpensesUsd + lotTotalMachineryJobsUsd;
                const lotNetMarginUsd = lotTotalIncomesUsd - lotTotalExpensesUsd;

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
                    rightPrimary={
                      <span
                        className={`font-mono ${
                          lotNetMarginUsd >= 0 ? 'text-[#24875B]' : 'text-[#C44545]'
                        }`}
                      >
                        USD{' '}
                        {lotNetMarginUsd.toLocaleString('es-BO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    }
                    rightSecondary="Margen"
                    isExpanded={isExpanded}
                    onClick={() => setExpandedLotId(isExpanded ? null : lot.id)}
                    expandedContent={
                      <div className="space-y-3 text-xs">
                        {/* 1. Encabezado agronómico compacto */}
                        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-[#E2E7E3]">
                          <div>
                            <span className="text-[10px] text-[#7A8780] block uppercase font-semibold">
                              Superficie
                            </span>
                            <span className="font-bold text-[#26352D]">
                              {lot.superficieHectareas} ha
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#7A8780] block uppercase font-semibold">
                              Cultivo actual
                            </span>
                            <span className="font-bold text-[#24875B]">
                              {lot.cultivoActual || 'Sin cultivo'}
                            </span>
                          </div>
                          {lot.ubicacion && (
                            <div className="col-span-full pt-1.5 border-t border-[#EFF2EF]">
                              <span className="text-[10px] text-[#7A8780] block uppercase font-semibold">
                                Ubicación
                              </span>
                              <span className="text-[#26352D]">{lot.ubicacion}</span>
                            </div>
                          )}
                        </div>

                        {/* Resumen Balance Económico del Lote */}
                        <div className="grid grid-cols-3 divide-x divide-[#DCE7DF] bg-white py-2 px-1 rounded-xl border border-[#D4E6DA] text-center">
                          <div className="px-1">
                            <span className="text-[9px] text-[#5E6D64] font-bold block uppercase">
                              Ingresos
                            </span>
                            <span className="font-bold font-mono text-[#24875B] text-[11px] sm:text-xs">
                              USD{' '}
                              {lotTotalIncomesUsd.toLocaleString('es-BO', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="px-1">
                            <span className="text-[9px] text-[#5E6D64] font-bold block uppercase">
                              Gastos
                            </span>
                            <span className="font-bold font-mono text-[#C44545] text-[11px] sm:text-xs">
                              USD{' '}
                              {lotTotalExpensesUsd.toLocaleString('es-BO', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="px-1">
                            <span className="text-[9px] text-[#5E6D64] font-bold block uppercase">
                              Margen
                            </span>
                            <span
                              className={`font-bold font-mono text-[11px] sm:text-xs ${
                                lotNetMarginUsd >= 0 ? 'text-[#24875B]' : 'text-[#C44545]'
                              }`}
                            >
                              USD{' '}
                              {lotNetMarginUsd.toLocaleString('es-BO', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </div>

                        {/* 2. Trabajos de Maquinaria */}
                        <div className="rounded-xl border border-[#E2E7E3] bg-white overflow-hidden">
                          <div className="px-3 py-2 bg-[#F7F9F7] border-b border-[#EFF2EF] flex items-center gap-1.5 font-semibold text-[#26352D]">
                            <Tractor className="h-3.5 w-3.5 text-amber-600" />
                            <span>Trabajos de Maquinaria ({lotMachineryJobs.length})</span>
                          </div>
                          {lotMachineryJobs.length > 0 ? (
                            <div className="divide-y divide-[#EFF2EF]">
                              {lotMachineryJobs.map((j) => (
                                <div
                                  key={j.id}
                                  className="px-3 py-2 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[#26352D] truncate">
                                      {j.trabajoNombre ||
                                        (j.maquinariaNombre
                                          ? `Labor con ${j.maquinariaNombre}`
                                          : 'Trabajo de Maquinaria')}
                                    </p>
                                    <p className="text-[11px] text-[#7A8780]">
                                      {formatDateDDMMAAAA(j.fecha)} · {j.cantidad}{' '}
                                      {j.unidad === 'hectarea' || (j.unidad as string) === 'ha'
                                        ? 'ha'
                                        : 'h'}
                                    </p>
                                  </div>
                                  <span className="font-bold font-mono text-[#C44545] shrink-0">
                                    - {j.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                    {j.total.toLocaleString('es-BO', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-3 py-2.5 text-[11px] text-[#7A8780]">
                              Sin labores de maquinaria registradas en este lote.
                            </p>
                          )}
                        </div>

                        {/* 3. Cosechas e Ingresos */}
                        <div className="rounded-xl border border-[#E2E7E3] bg-white overflow-hidden">
                          <div className="px-3 py-2 bg-[#F7F9F7] border-b border-[#EFF2EF] flex items-center gap-1.5 font-semibold text-[#26352D]">
                            <Wheat className="h-3.5 w-3.5 text-[#24875B]" />
                            <span>Cosechas e Ingresos ({lotIncomes.length})</span>
                          </div>
                          {lotIncomes.length > 0 ? (
                            <div className="divide-y divide-[#EFF2EF]">
                              {lotIncomes.map((i) => (
                                <div
                                  key={i.id}
                                  className="px-3 py-2 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[#26352D] truncate">
                                      {i.concepto}
                                    </p>
                                    <p className="text-[11px] text-[#7A8780]">
                                      {formatDateDDMMAAAA(i.fecha)} · {i.cantidad} {i.unidad || ''}
                                    </p>
                                  </div>
                                  <span className="font-bold font-mono text-[#24875B] shrink-0">
                                    + {i.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                    {i.total.toLocaleString('es-BO', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-3 py-2.5 text-[11px] text-[#7A8780]">
                              Sin cosechas o ingresos registrados en este lote.
                            </p>
                          )}
                        </div>

                        {/* 4. Insumos y Gastos Directos */}
                        <div className="rounded-xl border border-[#E2E7E3] bg-white overflow-hidden">
                          <div className="px-3 py-2 bg-[#F7F9F7] border-b border-[#EFF2EF] flex items-center gap-1.5 font-semibold text-[#26352D]">
                            <Receipt className="h-3.5 w-3.5 text-[#C44545]" />
                            <span>Insumos y Gastos Directos ({lotExpensesDirect.length})</span>
                          </div>
                          {lotExpensesDirect.length > 0 ? (
                            <div className="divide-y divide-[#EFF2EF]">
                              {lotExpensesDirect.map((e) => (
                                <div
                                  key={e.id}
                                  className="px-3 py-2 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[#26352D] truncate">
                                      {e.itemGasto}
                                    </p>
                                    <p className="text-[11px] text-[#7A8780]">
                                      {formatDateDDMMAAAA(e.fecha)} · {e.cantidad} {e.unidad || ''}
                                    </p>
                                  </div>
                                  <span className="font-bold font-mono text-[#C44545] shrink-0">
                                    - {e.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                    {e.total.toLocaleString('es-BO', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-3 py-2.5 text-[11px] text-[#7A8780]">
                              Sin insumos directos registrados en este lote.
                            </p>
                          )}
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
                Trabajos vinculados automáticamente como gasto del lote. Se editan en Maquinarias.
              </span>
            </div>

            <ListToolbar
              title="Trabajos recibidos"
              countLabel={`${filteredLinkedJobs.length} reg.`}
              searchValue={machineryJobsSearch}
              onSearchChange={setMachineryJobsSearch}
              searchPlaceholder="Buscar labor, equipo o lote..."
            />

            <CompactList
              isEmpty={filteredLinkedJobs.length === 0}
              emptyMessage={
                q
                  ? 'No se encontraron trabajos con esa búsqueda.'
                  : 'No hay trabajos de maquinaria propia asignados a lotes en esta campaña.'
              }
            >
              {filteredLinkedJobs.map((j) => {
                const fullLabor =
                  j.trabajoNombre ||
                  (j.maquinariaNombre ? `Labor con ${j.maquinariaNombre}` : 'Trabajo de Maquinaria');
                const unitLabel =
                  j.unidad === 'hectarea' || (j.unidad as string) === 'ha' ? 'ha' : 'h';
                const loteLabel = j.loteNombre
                  ? j.loteNombre.toLowerCase().startsWith('lote')
                    ? j.loteNombre
                    : `Lote ${j.loteNombre}`
                  : 'Lote propio';

                return (
                  <CompactListRow
                    key={j.id}
                    icon={
                      <div className="w-8 h-8 rounded-lg bg-[#FCECEC] border border-[#F2C6C6]/70 flex items-center justify-center">
                        <VisualIcon name={getMachineIcon(j.maquinariaId, machines, j.icono)} size="xs" />
                      </div>
                    }
                    title={fullLabor}
                    subtitle={
                      <span>
                        {formatDateDDMMAAAA(j.fecha)} ·{' '}
                        <span className="font-semibold text-[#24875B]">{loteLabel}</span> ·{' '}
                        {j.maquinariaNombre} · {j.cantidad} {unitLabel}
                      </span>
                    }
                    rightPrimary={
                      <span className="text-[#C44545] font-mono">
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
            title="Historial"
            countLabel={
              historialFilter === 'distribuidos'
                ? `${expenseAllocations.length} grupos`
                : `${filteredMovements.length} reg.`
            }
            searchValue={historialSearch}
            onSearchChange={setHistorialSearch}
            searchPlaceholder={
              historialFilter === 'distribuidos'
                ? 'Buscar gasto distribuido o lote...'
                : 'Buscar por concepto, lote u observación...'
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
                ariaLabel="Filtrar movimientos por tipo"
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'ingresos', label: 'Ingresos' },
                  { value: 'gastos', label: 'Gastos' },
                  { value: 'distribuidos', label: 'Distribuidos' },
                ]}
              />
            }
          />

          {historialFilter === 'distribuidos' ? (
            <div className="space-y-2.5">
              {allocationsRevalidating && (
                <div className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-[#5E6D64]">
                  <RefreshCw className="h-3 w-3 animate-spin text-[#24875B]" />
                  <span>Actualizando gastos distribuidos...</span>
                </div>
              )}
              {allocationsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="break-words">
                      {allocationsHasLoaded
                        ? `No se pudo actualizar (${allocationsError}). Mostrando últimos datos.`
                        : allocationsError}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadExpenseAllocations()}
                    disabled={allocationsLoading}
                    className="text-xs font-bold text-red-700 underline shrink-0 cursor-pointer"
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {allocationsInitialLoading || (!allocationsHasLoaded && !allocationsError) ? (
                <div className="rounded-2xl border border-[#E2E7E3] bg-white p-8 text-center text-xs text-[#5E6D64] flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#C44545]" />
                  <span>Consultando gastos distribuidos...</span>
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
                  emptyMessage="No hay grupos de gastos distribuidos registrados."
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
                              {formatDateDDMMAAAA(g.fecha)} · {g.lotes.length} lotes
                              {g.hectareasTotales ? ` · ${g.hectareasTotales.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ha` : ''}
                            </span>
                          }
                          rightPrimary={
                            <span className="font-mono text-[#C44545]">
                              - {curLabel}{' '}
                              {g.importe.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          }
                          isExpanded={isExp}
                          onClick={() => setExpandedAllocationId(isExp ? null : g.id)}
                          expandedContent={
                            <div className="space-y-2 text-xs">
                              {g.observacion && (
                                <p className="text-[11px] italic text-[#5E6D64]">Obs.: {g.observacion}</p>
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
                                        <span className="font-mono font-bold text-[#C44545]">
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
              emptyMessage="No hay movimientos registrados."
            >
            {filteredMovements.map((m) => {
              const isExpanded = expandedMovementId === m.id;
              const isIncome = m.tipo === 'ingreso';
              const isHarvest = m.tipo === 'cosecha';
              const isUnpricedHarvest = isHarvest && m.cosechaRecord?.asignadas === 0;
              const loteLabel = m.loteNombre
                ? m.loteNombre.toLowerCase().startsWith('lote')
                  ? m.loteNombre
                  : `Lote ${m.loteNombre}`
                : 'Lote';

              return (
                <CompactListRow
                  key={`${m.tipo}-${m.id}`}
                  icon={
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                        isIncome
                          ? 'bg-[#EAF5EE] border-[#BFE0CD]/70 text-[#24875B]'
                          : isHarvest
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : m.tipo === 'gasto_directo'
                          ? 'bg-[#FCECEC] border-[#F2C6C6]/70'
                          : 'bg-amber-50 border-amber-200/80'
                      }`}
                    >
                      <VisualIcon
                        name={
                          m.icono ||
                          (isIncome
                            ? 'granos'
                            : isHarvest
                            ? 'granos'
                            : m.tipo === 'gasto_directo'
                            ? 'semillas'
                            : 'tractor')
                        }
                        size="xs"
                      />
                    </div>
                  }
                  title={m.titulo}
                  subtitle={
                    <span>
                      {formatDateDDMMAAAA(m.fecha)} ·{' '}
                      <span className="font-semibold text-[#24875B]">{loteLabel}</span> ·{' '}
                      {isIncome
                        ? 'Cosecha'
                        : isHarvest
                        ? (isUnpricedHarvest ? 'Sin precio' : 'Parcial')
                        : m.tipo === 'gasto_directo'
                        ? 'Gasto directo'
                        : 'Maq. propia'}
                    </span>
                  }
                  rightPrimary={
                    isHarvest ? (
                      isUnpricedHarvest ? (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200/80">
                          Sin importe
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-stone-700 font-semibold">
                          {m.cosechaRecord?.asignadas} t asig. · {m.cosechaRecord?.pendiente} t pend.
                        </span>
                      )
                    ) : (
                      <span className={`font-mono ${isIncome ? 'text-[#24875B]' : 'text-[#C44545]'}`}>
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
                    isHarvest ? (
                      <div className="space-y-3 text-xs">
                        <div className="divide-y divide-[#EFF2EF]">
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">Lote</span>
                            <span className="font-semibold text-[#24875B] text-right">{loteLabel}</span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">Toneladas totales</span>
                            <span className="font-semibold text-[#26352D] text-right">
                              {m.cosechaRecord?.toneladas} t
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">Asignadas / Pendientes</span>
                            <span className="font-mono font-semibold text-[#26352D] text-right">
                              {m.cosechaRecord?.asignadas || 0} t asig. · {m.cosechaRecord?.pendiente || 0} t pend.
                            </span>
                          </div>
                          {m.cosechaRecord?.observacion && (
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium shrink-0">Observación</span>
                              <span className="font-normal text-[#26352D] text-right italic">
                                {m.cosechaRecord.observacion}
                              </span>
                            </div>
                          )}
                        </div>
                        {m.cosechaRecord && (
                          effectiveIsAdmin ? (
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6EBE7]">
                              {m.cosechaRecord.pendiente > 0.0001 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssignPrice(m.cosechaRecord!)}
                                  className="px-3.5 py-1.5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white font-semibold text-xs transition cursor-pointer min-h-[34px]"
                                >
                                  Asignar precio
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditHarvest(m.cosechaRecord!)}
                                className="px-3.5 py-1.5 rounded-xl bg-white border border-[#D4DDD6] hover:bg-[#F2F5F3] text-[#26352D] font-semibold text-xs transition cursor-pointer min-h-[34px] inline-flex items-center gap-1"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>Editar</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 pt-2 border-t border-[#E6EBE7] text-[11px] text-[#7A8780]">
                              <Lock className="h-3.5 w-3.5 shrink-0" />
                              <span>Solo el Administrador puede editar cosechas guardadas.</span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <div className="divide-y divide-[#EFF2EF]">
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">Lote</span>
                            <span className="font-semibold text-[#24875B] text-right">
                              {loteLabel}
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">Cantidad</span>
                            <span className="font-semibold text-[#26352D] text-right">
                              {m.cantidad ? `${m.cantidad} ${m.unidad || ''}` : '—'}
                            </span>
                          </div>
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">Equivalencia</span>
                            <span className="font-mono font-semibold text-[#26352D] text-right">
                              {m.tipoCambio && m.tipoCambio > 0
                                ? m.moneda === 'USD'
                                  ? `Bs ${(m.monto * m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (TC: ${formatTC(m.tipoCambio)})`
                                  : `USD ${(m.monto / m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (TC: ${formatTC(m.tipoCambio)})`
                                : '—'}
                            </span>
                          </div>
                          {m.detalle && (
                            <div className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium shrink-0">Observación</span>
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
                                Editar
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
                                Eliminar
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 pt-2 border-t border-[#E6EBE7] text-[11px] text-[#7A8780]">
                              <Lock className="h-3.5 w-3.5 shrink-0" />
                              <span>Solo el Administrador puede editar o eliminar registros guardados.</span>
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
                  {editingMovement.tipo === 'gasto_directo' ? 'Editar Gasto Agrícola' : 'Editar Ingreso de Cosecha'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Actualiza los datos del registro en Google Sheets
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
                  Fecha <span className="text-[#C44545]">*</span>
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
                onSelect={(id) => setEditLotId(id)}
                label="Lote"
                required
              />

              {/* Concepto / Descripción */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Concepto <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editConcepto}
                  onChange={(e) => setEditConcepto(e.target.value)}
                  placeholder="Semillas, Venta Cosecha..."
                  className={FORM_INPUT_CLASS}
                />
              </div>

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Cantidad <span className="text-[#C44545]">*</span>
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
                  <label className={FORM_LABEL_CLASS}>Unidad</label>
                  <input
                    type="text"
                    value={editUnidad}
                    onChange={(e) => setEditUnidad(e.target.value)}
                    placeholder="kg, toneladas, bolsas"
                    className={FORM_INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Precio Unitario y Moneda */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Precio unitario <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0"
                    value={editPrecio}
                    onChange={(e) => setEditPrecio(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <CurrencySelect
                  label="Moneda"
                  required
                  value={editMoneda}
                  onChange={(curr) => setEditMoneda(curr)}
                />
              </div>

              {/* Tipo de Cambio */}
              <div>
                <label className={FORM_LABEL_CLASS}>Tipo de cambio (Bs/USD)</label>
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
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Observación <span className="text-[#7A8780] font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={editObs}
                  onChange={(e) => setEditObs(e.target.value)}
                  placeholder="Notas adicionales..."
                  className={FORM_TEXTAREA_CLASS}
                />
              </div>

              {/* Importe total */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F4F7F5] border border-[#DCE2DD]">
                <span className="text-[13px] font-bold text-[#26352D]">Importe total</span>
                <span className="text-base font-extrabold text-[#1F2D25] font-mono tabular-nums">
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
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="w-full h-[42px] px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] active:bg-[#175B3D] text-white font-bold text-sm shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>{savingEdit ? 'Guardando...' : 'Guardar cambios'}</span>
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
              <h3 className="text-lg font-bold text-slate-900">¿Confirmar eliminación?</h3>
              <p className="text-xs text-slate-600 mt-1">
                Se eliminará definitivamente el registro de {itemToDelete.tipo === 'gasto' ? 'gasto agrícola' : 'ingreso de cosecha'}:
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
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingItem}
                onClick={handleConfirmDeleteItem}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 min-h-[46px] flex items-center justify-center gap-1.5"
              >
                {deletingItem ? 'Eliminando...' : 'Confirmar'}
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
          'Lote';
        const tonsPreview = parseDecimalNumber(priceToneladas);
        const pricePreview = parseDecimalNumber(priceUsdTon);
        const tcPreview = parseDecimalNumber(priceTc);
        const totalUsdPreview = tonsPreview > 0 && pricePreview > 0 ? tonsPreview * pricePreview : 0;
        const totalBobPreview = totalUsdPreview > 0 && tcPreview > 0 ? totalUsdPreview * tcPreview : 0;

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
                    Asignar precio a cosecha
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
                    <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Total</span>
                    <span className="text-xs font-bold text-[#26352D] font-mono">
                      {selectedHarvestForPrice.toneladas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                    </span>
                  </div>
                  <div className="px-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Asignadas</span>
                    <span className="text-xs font-bold text-[#24875B] font-mono">
                      {selectedHarvestForPrice.asignadas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                    </span>
                  </div>
                  <div className="px-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Pendientes</span>
                    <span className="text-xs font-black text-amber-700 font-mono">
                      {selectedHarvestForPrice.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                    </span>
                  </div>
                </div>

                {/* Campaña */}
                <AppSelect
                  label="Campaña del ingreso"
                  required
                  icon={<Calendar className="h-[17px] w-[17px]" />}
                  value={priceCampanaId}
                  onChange={(e) => setPriceCampanaId(e.target.value)}
                >
                  <option value="">Seleccionar campaña</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.activa ? '(Activa)' : ''}
                    </option>
                  ))}
                </AppSelect>

                {/* Toneladas a asignar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[13px] font-semibold text-[#26352D]">
                      Toneladas a fijar precio <span className="text-[#C44545]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPriceToneladas(String(Number(selectedHarvestForPrice.pendiente.toFixed(4))))
                      }
                      className="text-[11px] font-semibold text-[#24875B] hover:underline cursor-pointer"
                    >
                      Usar todo ({selectedHarvestForPrice.pendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t)
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

                {/* Precio USD/t y TC */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Precio (USD/t) <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={priceUsdTon}
                      onChange={(e) => setPriceUsdTon(e.target.value)}
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                    />
                  </div>
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Tipo de cambio <span className="text-[#C44545]">*</span>
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
                </div>

                {/* Fecha */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Fecha de fijación <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={priceFecha}
                    onChange={(e) => setPriceFecha(e.target.value)}
                    className={FORM_INPUT_CLASS}
                  />
                </div>

                {/* Importe total */}
                <div className="rounded-xl bg-[#EAF5EE] border border-[#BFE0CD] px-3.5 py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#175B3D]">Importe total</span>
                    <span className="text-base font-extrabold text-[#175B3D] font-mono tabular-nums">
                      USD{' '}
                      {totalUsdPreview.toLocaleString('es-BO', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {totalBobPreview > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-[#1D5C3F]">
                      <span>Equivalente en Bs</span>
                      <span className="font-mono font-semibold tabular-nums">
                        Bs{' '}
                        {totalBobPreview.toLocaleString('es-BO', {
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
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingHarvestPrice}
                    className="flex-1 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    <span>{savingHarvestPrice ? 'Guardando...' : 'Confirmar precio'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* MODAL: EDITAR COSECHA REGISTRADA (harvest.update — Admin)    */}
      {/* ============================================================ */}
      {editingHarvest && (() => {
        const hasAsignaciones = (editingHarvest.asignadas || 0) > 0.0001;
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
                    Editar cosecha
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {formatConcept(editingHarvest.producto)} ·{' '}
                    {editingHarvest.loteNombre || lots.find((l) => String(l.id) === String(editingHarvest.loteId))?.nombre || 'Lote'}
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
                        <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Total</span>
                        <span className="text-xs font-bold text-[#26352D] font-mono tabular-nums">
                          {tonsInput > 0 ? tonsInput.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} t
                        </span>
                      </div>
                      <div className="px-1">
                        <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Asignadas</span>
                        <span className="text-xs font-bold text-[#24875B] font-mono tabular-nums">
                          {editingHarvest.asignadas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                        </span>
                      </div>
                      <div className="px-1">
                        <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Pendientes</span>
                        <span className={`text-xs font-black font-mono tabular-nums ${violatesMinTons ? 'text-red-600' : 'text-amber-700'}`}>
                          {newPendiente.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#1D5C3F]">
                      Con precios asignados no se puede cambiar campaña, lote ni producto ni reducir por debajo de{' '}
                      <strong>{editingHarvest.asignadas.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t</strong>.
                    </p>
                  </div>
                )}

                {/* Fecha de cosecha */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Fecha de cosecha <span className="text-[#C44545]">*</span>
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
                  label="Campaña"
                  required
                  disabled={hasAsignaciones}
                  icon={<Calendar className="h-[17px] w-[17px]" />}
                  value={editHarvCampanaId}
                  onChange={(e) => setEditHarvCampanaId(e.target.value)}
                >
                  <option value="">Seleccionar campaña</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.activa ? '(Activa)' : ''}
                    </option>
                  ))}
                </AppSelect>

                {/* Lote */}
                <AppSelect
                  label="Lote"
                  required
                  disabled={hasAsignaciones}
                  icon={<LandPlot className="h-[17px] w-[17px]" />}
                  value={editHarvLotId}
                  onChange={(e) => setEditHarvLotId(e.target.value)}
                >
                  <option value="">Seleccionar lote</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </AppSelect>

                {/* Producto y Toneladas */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Producto <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={hasAsignaciones}
                      value={editHarvProducto}
                      onChange={(e) => setEditHarvProducto(e.target.value)}
                      placeholder="Soya, Maíz..."
                      className={`${FORM_INPUT_CLASS} font-semibold`}
                    />
                  </div>
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Toneladas (t) <span className="text-[#C44545]">*</span>
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
                </div>

                {/* Observación */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Observación <span className="text-[#7A8780] font-normal">(opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={editHarvObs}
                    onChange={(e) => setEditHarvObs(e.target.value)}
                    placeholder="Silo de acopio, humedad, notas..."
                    className={FORM_TEXTAREA_CLASS}
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={savingEditHarvest}
                    onClick={() => setEditingHarvest(null)}
                    className="flex-1 h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditHarvest || violatesMinTons}
                    className="flex-1 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    <span>{savingEditHarvest ? 'Guardando...' : 'Guardar cambios'}</span>
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
