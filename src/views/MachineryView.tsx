import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Tractor,
  CirclePlus,
  CircleMinus,
  TrendingDown,
  HandCoins,
  LandPlot,
  Receipt,
  ClipboardList,
  ChartNoAxesColumn,
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
  Clock,
  User,
  Filter,
  Edit3,
  Wrench,
  History,
  Wallet,
  Info,
  Save,
  Lock,
  RefreshCw,
  Coins,
} from 'lucide-react';
import {
  Campaign,
  Machine,
  MachineJobType,
  Lot,
  MachineryJob,
  Expense,
  Currency,
  ExchangeRateConfig,
  ItemConfig,
  Asset,
  CobroCuenta,
} from '../types';
import {
  createMachineryJob,
  updateMachineryJob,
  deleteMachineryJob,
  createExpense,
  updateExpense,
  deleteExpense,
  formatDateDDMMAAAA,
  hasAdminAuthorization,
  isTechnicalId,
  isVirtualMachineOnlyImplement,
  parseDecimalNumber,
  getCobros,
  getCobroEstado,
  registrarCobro,
  compareChronologicalDesc,
  getMachineIcon,
} from '../services/backend';
import {
  convertHistoricalAmount,
  formatCurrencyAmount,
  matchesCampaignRecord,
} from '../services/financialSummary';
import { VisualIcon } from '../components/VisualIcon';
import {
  VisualMachinePicker,
  VisualJobTypePicker,
  VisualExpenseItemPicker,
  VisualLotPicker,
} from '../components/VisualEntityPicker';
import {
  AppSelect,
  CurrencySelect,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_TEXTAREA_CLASS,
} from '../components/AppSelect';
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
  getQuerySnapshot,
  invalidateQueries,
  patchQueriesByPrefix,
  revalidateQuery,
  setQueryData,
} from '../services/dataCache';
import { usePersistedMemoryState, useSwrQuery } from '../hooks/useSwrQuery';
import type { RefreshScope } from '../App';

interface Props {
  campaigns?: Campaign[];
  activeCampaign: Campaign | null;
  machines: Machine[];
  machineJobTypes?: MachineJobType[];
  lots: Lot[];
  jobs: MachineryJob[];
  expenses: Expense[];
  itemsConfig: ItemConfig[];
  assets?: Asset[];
  currency: Currency;
  exchangeRate: ExchangeRateConfig;
  isAdmin?: boolean;
  isSyncingGlobal?: boolean;
  hasLoadedGlobal?: boolean;
  onRefreshData: (scope?: RefreshScope) => void;
}

type MachineryScreen =
  | 'main'
  | 'servicio'
  | 'ingreso_opciones'
  | 'servicio_otros'
  | 'trabajo_propiedad'
  | 'gasto'
  | 'historial'
  | 'resumen'
  | 'por_cobrar';

const toYYYYMMDD = (dStr: string | undefined): string => {
  if (!dStr) return new Date().toISOString().slice(0, 10);
  const clean = String(dStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.slice(0, 10);
  }
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean.slice(0, 10);
};

export const MachineryView: React.FC<Props> = ({
  campaigns = [],
  activeCampaign,
  machines,
  machineJobTypes = [],
  lots,
  jobs,
  expenses,
  itemsConfig = [],
  assets = [],
  currency,
  exchangeRate,
  isAdmin,
  onRefreshData,
}) => {
  const effectiveIsAdmin = isAdmin ?? hasAdminAuthorization();
  const [currentScreen, setCurrentScreen] = useState<MachineryScreen>('main');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Exclude inactive machines from new service creation while preserving historical records
  const activeMachines = useMemo(
    () => machines.filter((m) => m.estado !== 'inactivo' && m.activo !== false),
    [machines]
  );

  // Search & type filter for Movimientos (persisted in memory across navigation)
  const [searchTerm, setSearchTerm] = usePersistedMemoryState<string>('machinery.historial.search', '');
  const [historialFilter, setHistorialFilter] = usePersistedMemoryState<'todos' | 'ingresos' | 'gastos'>('machinery.historial.filter', 'todos');
  const [serviciosSubFilter, setServiciosSubFilter] = usePersistedMemoryState<'todos' | 'terceros' | 'propiedad'>('machinery.historial.serviciosSub', 'todos');
  const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  // State for Por cobrar (shared SWR memory cache: cobros.list, cobros.estado, cobros.registrar)
  const [porCobrarSearch, setPorCobrarSearch] = usePersistedMemoryState<string>('machinery.porCobrar.search', '');
  const [porCobrarCampaignId, setPorCobrarCampaignId] = usePersistedMemoryState<string>('machinery.porCobrar.campaignId', 'all');
  const [porCobrarEstadoFilter, setPorCobrarEstadoFilter] = usePersistedMemoryState<'pendientes' | 'todos' | 'PAGADO'>('machinery.porCobrar.estado', 'pendientes');
  const [expandedPorCobrarId, setExpandedPorCobrarId] = useState<string | null>(null);
  const [loadingCobroEstadoId, setLoadingCobroEstadoId] = useState<string | null>(null);
  const [cobroEstadoErrors, setCobroEstadoErrors] = useState<Record<string, string>>({});

  // Modal state for registering partial/full payment via cobros.registrar (USD or BOB with editable TC)
  const [cobroModalCuenta, setCobroModalCuenta] = useState<CobroCuenta | null>(null);
  const [cobroFecha, setCobroFecha] = useState(new Date().toISOString().slice(0, 10));
  const [cobroMoneda, setCobroMoneda] = useState<Currency>('USD');
  const [cobroImporte, setCobroImporte] = useState('');
  const [cobroTc, setCobroTc] = useState(
    exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? String(exchangeRate.tasaBobPerUsd) : ''
  );
  const [cobroObs, setCobroObs] = useState('');
  const [savingCobro, setSavingCobro] = useState(false);
  const [cobroModalError, setCobroModalError] = useState<string | null>(null);

  // Shared SWR query for global pending cobros badge (shares exact key with default Por cobrar view!)
  const pendingCobrosKey = cacheKeys.cobrosList(undefined, true);
  const pendingCobrosQuery = useSwrQuery<CobroCuenta[]>(
    pendingCobrosKey,
    () => getCobros({ soloPendientes: true }, false),
    { enabled: true, minIntervalMs: 3000 }
  );

  // Shared SWR query for active Por cobrar filter combination
  const activeCobrosTargetCamp = porCobrarCampaignId === 'all' ? undefined : porCobrarCampaignId;
  const activeCobrosSoloPend = porCobrarEstadoFilter === 'pendientes';
  const activeCobrosKey = cacheKeys.cobrosList(activeCobrosTargetCamp, activeCobrosSoloPend);

  const activeCobrosQuery = useSwrQuery<CobroCuenta[]>(
    activeCobrosKey,
    () =>
      getCobros(
        {
          ...(activeCobrosTargetCamp ? { campanaId: activeCobrosTargetCamp } : {}),
          soloPendientes: activeCobrosSoloPend,
        },
        false
      ),
    { enabled: currentScreen === 'por_cobrar', minIntervalMs: 2500 }
  );

  const cobros = activeCobrosQuery.data ?? [];
  const cobrosHasLoaded = activeCobrosQuery.hasLoaded;
  const cobrosLoading = activeCobrosQuery.isFetching;
  const cobrosInitialLoading = activeCobrosQuery.isInitialLoading;
  const cobrosRevalidating = activeCobrosQuery.isRevalidating;
  const cobrosError = activeCobrosQuery.error;

  const pendingCobrosCount = useMemo(() => {
    if (!pendingCobrosQuery.hasLoaded) return null;
    return (pendingCobrosQuery.data || []).filter((c) => c.estado !== 'PAGADO' && c.saldo > 0.005).length;
  }, [pendingCobrosQuery.hasLoaded, pendingCobrosQuery.data]);

  const loadCobros = useCallback(async () => {
    await activeCobrosQuery.refresh();
    if (activeCobrosKey !== pendingCobrosKey) {
      pendingCobrosQuery.refresh().catch(() => {});
    }
  }, [activeCobrosQuery, pendingCobrosQuery, activeCobrosKey, pendingCobrosKey]);

  const mergeDetailedCuenta = useCallback((item: CobroCuenta, detailed: CobroCuenta): CobroCuenta => ({
    ...item,
    ...detailed,
    cliente:
      detailed.cliente && detailed.cliente !== 'Cliente externo'
        ? detailed.cliente
        : item.cliente,
    fecha: detailed.fecha || item.fecha,
    campanaId: detailed.campanaId || item.campanaId,
    campanaNombre: detailed.campanaNombre || item.campanaNombre,
    maquinariaId: detailed.maquinariaId || item.maquinariaId,
    maquinariaNombre: detailed.maquinariaNombre || item.maquinariaNombre,
    trabajoNombre: detailed.trabajoNombre || item.trabajoNombre,
  }), []);

  const patchCuentaAcrossCaches = useCallback(
    (trabajoId: string, updated: CobroCuenta) => {
      const estadoKey = cacheKeys.cobroEstado(trabajoId);
      setQueryData<CobroCuenta>(estadoKey, (prev) =>
        prev ? mergeDetailedCuenta(prev, updated) : updated
      );
      patchQueriesByPrefix<CobroCuenta[]>('cobros.list:', (list) =>
        list.map((item) =>
          String(item.trabajoId) === String(trabajoId) ? mergeDetailedCuenta(item, updated) : item
        )
      );
    },
    [mergeDetailedCuenta]
  );

  const handleToggleCobroRow = async (cuenta: CobroCuenta) => {
    const key = cuenta.trabajoId || cuenta.id || '';
    if (!key) return;
    if (expandedPorCobrarId === key) {
      setExpandedPorCobrarId(null);
      return;
    }
    setExpandedPorCobrarId(key);
    setCobroEstadoErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

    const estadoKey = cacheKeys.cobroEstado(cuenta.trabajoId);
    const cachedDetail = getQuerySnapshot<CobroCuenta>(estadoKey);
    if (cachedDetail.hasLoaded && cachedDetail.data) {
      // Immediately ensure row displays cached payments without waiting for network
      patchCuentaAcrossCaches(cuenta.trabajoId, cachedDetail.data);
    }

    setLoadingCobroEstadoId(key);
    try {
      const detailed = await revalidateQuery<CobroCuenta>(
        estadoKey,
        () => getCobroEstado(cuenta.trabajoId, false),
        { minIntervalMs: 3000 }
      );
      patchCuentaAcrossCaches(cuenta.trabajoId, detailed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo consultar el detalle de pagos (cobros.estado).';
      setCobroEstadoErrors((prev) => ({ ...prev, [key]: msg }));
    } finally {
      setLoadingCobroEstadoId((curr) => (curr === key ? null : curr));
    }
  };

  // Currency conversion anchors (prevent cumulative rounding drift on repeated USD <-> Bs toggles)
  const cobroCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);
  const jobCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);
  const expCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);
  const editJobCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);
  const editExpCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);

  const handleOpenCobroModal = (cuenta: CobroCuenta) => {
    cobroCurrencyAnchorRef.current = null;
    setCobroModalCuenta(cuenta);
    setCobroFecha(new Date().toISOString().slice(0, 10));
    setCobroMoneda('USD');
    const defaultTc =
      exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
        ? String(exchangeRate.tasaBobPerUsd)
        : '';
    setCobroTc(defaultTc);
    setCobroImporte(cuenta.saldo > 0 ? String(Number(cuenta.saldo.toFixed(2))) : '');
    setCobroObs('');
    setCobroModalError(null);
  };

  const handleSubmitCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cobroModalCuenta || savingCobro) return;
    setCobroModalError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    const importeOriginalNum = parseDecimalNumber(cobroImporte);
    const tcNum = parseDecimalNumber(cobroTc);
    if (importeOriginalNum <= 0) {
      setCobroModalError('Ingresa un importe válido mayor a 0.');
      return;
    }
    if (tcNum <= 0) {
      setCobroModalError('Ingresa un tipo de cambio válido mayor a 0.');
      return;
    }

    const importeUsdCalc =
      cobroMoneda === 'BOB'
        ? Number((importeOriginalNum / tcNum).toFixed(2))
        : Number(importeOriginalNum.toFixed(2));

    if (importeUsdCalc <= 0) {
      setCobroModalError('El equivalente en USD del cobro debe ser mayor a 0.');
      return;
    }
    if (importeUsdCalc > cobroModalCuenta.saldo + 0.005) {
      const maxEnMoneda =
        cobroMoneda === 'BOB'
          ? `Bs ${Number((cobroModalCuenta.saldo * tcNum).toFixed(2)).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (USD ${cobroModalCuenta.saldo.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          : `USD ${cobroModalCuenta.saldo.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      setCobroModalError(`El importe ingresado supera el saldo pendiente (${maxEnMoneda}).`);
      return;
    }
    if (!cobroFecha) {
      setCobroModalError('Selecciona la fecha del cobro.');
      return;
    }

    setSavingCobro(true);
    try {
      const res = await registrarCobro({
        trabajoId: cobroModalCuenta.trabajoId,
        importeOriginal: importeOriginalNum,
        monedaCobro: cobroMoneda,
        tc: tcNum,
        fecha: cobroFecha,
        observacion: cobroObs.trim(),
      });

      const updatedCuenta = res.cuenta;
      if (updatedCuenta) {
        patchCuentaAcrossCaches(cobroModalCuenta.trabajoId, updatedCuenta);
      }

      setCobroModalCuenta(null);
      setCobroObs('');
      setCobroImporte('');
      const pagoLabel =
        cobroMoneda === 'BOB'
          ? `Bs ${importeOriginalNum.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (USD ${importeUsdCalc.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · TC ${tcNum})`
          : `USD ${importeOriginalNum.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const saldoText = updatedCuenta
        ? ` Saldo restante: USD ${updatedCuenta.saldo.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${updatedCuenta.estado}).`
        : '';
      setSuccessMsg(`Cobro registrado: ${pagoLabel}.${saldoText}`);

      // Selective invalidation & background refresh of cobros (no duplicate income created)
      invalidateQueries(['cobros.']);
      await loadCobros();
    } catch (err: unknown) {
      setCobroModalError(err instanceof Error ? err.message : 'Error al registrar el cobro en el backend.');
    } finally {
      setSavingCobro(false);
    }
  };

  // Form State for Machinery Job (Unified Registrar servicio)
  const [serviceDestino, setServiceDestino] = useState<'propiedad' | 'tercero'>('propiedad');
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string>('');
  const [selectedJobNombre, setSelectedJobNombre] = useState<string>('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [cliente, setCliente] = useState('');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tarifa, setTarifa] = useState<number | ''>('');
  const [unidad, setUnidad] = useState<'hora' | 'hectarea'>('hora');
  const [jobMoneda, setJobMoneda] = useState<Currency>('USD');
  const [jobTc, setJobTc] = useState(
    exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? String(exchangeRate.tasaBobPerUsd) : ''
  );
  const [observacion, setObservacion] = useState('');

  // Accordion & filter state for Mis máquinas (persisted in memory across navigation)
  const [expandedMachineId, setExpandedMachineId] = useState<string | null>(null);
  const [expandedImplementId, setExpandedImplementId] = useState<string | null>(null);
  const [machinesGroupOpen, setMachinesGroupOpen] = useState(true);
  const [implementsGroupOpen, setImplementsGroupOpen] = useState(false);
  const [machinesSearch, setMachinesSearch] = usePersistedMemoryState<string>('machinery.machines.search', '');
  const [machinesStatusFilter, setMachinesStatusFilter] = usePersistedMemoryState<'activos' | 'desactivados' | 'todos'>('machinery.machines.status', 'activos');

  // Form State for Machinery Expense (sin valores preseleccionados de catálogo)
  const [expMachineId, setExpMachineId] = useState('');
  const [expItemGasto, setExpItemGasto] = useState('');
  const [expCantidad, setExpCantidad] = useState<number | ''>(1);
  const [expUnidad, setExpUnidad] = useState('');
  const [expPrecio, setExpPrecio] = useState<number | ''>('');
  const [expFecha, setExpFecha] = useState(new Date().toISOString().slice(0, 10));
  const [expMoneda, setExpMoneda] = useState<Currency>('BOB');
  const [expTc, setExpTc] = useState(
    exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? String(exchangeRate.tasaBobPerUsd) : ''
  );
  const [expObservacion, setExpObservacion] = useState('');

  // Preload configured exchange rate into operation forms when available (never overwrites user edits)
  useEffect(() => {
    if (exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0) {
      const rateStr = String(exchangeRate.tasaBobPerUsd);
      setJobTc((prev) => (prev ? prev : rateStr));
      setExpTc((prev) => (prev ? prev : rateStr));
      setCobroTc((prev) => (prev ? prev : rateStr));
    }
  }, [exchangeRate?.tasaBobPerUsd]);

  const resetNewServiceForm = () => {
    jobCurrencyAnchorRef.current = null;
    setSelectedMachineId('');
    setSelectedJobTypeId('');
    setSelectedJobNombre('');
    setSelectedLotId('');
    setCliente('');
    setCantidad('');
    setTarifa('');
    setUnidad('hora');
    setJobMoneda('USD');
    setFecha(new Date().toISOString().slice(0, 10));
    setJobTc(
      exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
        ? String(exchangeRate.tasaBobPerUsd)
        : ''
    );
    setObservacion('');
    setErrorMsg(null);
  };

  const resetNewExpenseForm = () => {
    expCurrencyAnchorRef.current = null;
    setExpMachineId('');
    setExpItemGasto('');
    setExpCantidad(1);
    setExpUnidad('');
    setExpPrecio('');
    setExpFecha(new Date().toISOString().slice(0, 10));
    setExpMoneda('BOB');
    setExpTc(
      exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
        ? String(exchangeRate.tasaBobPerUsd)
        : ''
    );
    setExpObservacion('');
    setErrorMsg(null);
  };

  // Editing Job State (iOS Modal)
  const [editingJob, setEditingJob] = useState<MachineryJob | null>(null);
  const [editCampanaId, setEditCampanaId] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editMachineId, setEditMachineId] = useState('');
  const [editJobTypeId, setEditJobTypeId] = useState<string>('');
  const [editJobNombre, setEditJobNombre] = useState<string>('');
  const [editTipoTrabajo, setEditTipoTrabajo] = useState<'tercero' | 'propiedad'>('tercero');
  const [editCliente, setEditCliente] = useState('');
  const [editLotId, setEditLotId] = useState('');
  const [editCantidad, setEditCantidad] = useState<number | ''>('');
  const [editUnidad, setEditUnidad] = useState<'hora' | 'hectarea'>('hora');
  const [editTarifa, setEditTarifa] = useState<number | ''>('');
  const [editMoneda, setEditMoneda] = useState<Currency>('BOB');
  const [editTc, setEditTc] = useState('');
  const [editObservacion, setEditObservacion] = useState('');
  const [editJobError, setEditJobError] = useState<string | null>(null);
  const [editJobCobroCuenta, setEditJobCobroCuenta] = useState<CobroCuenta | null>(null);
  const [loadingEditJobCobro, setLoadingEditJobCobro] = useState(false);

  // Deleting Job State (iOS Confirmation Modal)
  const [jobToDelete, setJobToDelete] = useState<MachineryJob | null>(null);
  const [deletingJob, setDeletingJob] = useState(false);

  // Editing Expense State (iOS Modal)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editExpFecha, setEditExpFecha] = useState('');
  const [editExpMachineId, setEditExpMachineId] = useState('');
  const [editExpItemGasto, setEditExpItemGasto] = useState('');
  const [editExpCantidad, setEditExpCantidad] = useState<number | ''>('');
  const [editExpUnidad, setEditExpUnidad] = useState('');
  const [editExpPrecio, setEditExpPrecio] = useState<number | ''>('');
  const [editExpMoneda, setEditExpMoneda] = useState<Currency>('BOB');
  const [editExpTc, setEditExpTc] = useState('');
  const [editExpObservacion, setEditExpObservacion] = useState('');
  const [editExpError, setEditExpError] = useState<string | null>(null);



  const getMachineTypeLabel = (m: Machine | undefined): string => {
    const raw = (m?.tipo || '').trim();
    return raw || 'Tractor';
  };

  const getImplementCompatibleType = (jt: MachineJobType): string => {
    const linked = machines.find((m) => String(m.id) === String(jt.maquinaId));
    return getMachineTypeLabel(linked);
  };

  const findMachineAssetValue = (m: Machine): { valor: number; moneda: Currency } | null => {
    const matched = (assets || []).find(
      (a) =>
        a.activo !== false &&
        a.tipo === 'MAQUINARIA' &&
        (a.referenciaId === m.id ||
          a.nombre.trim().toLowerCase() === m.nombre.trim().toLowerCase())
    );
    if (matched && Number(matched.valorInicial) > 0) {
      return { valor: Number(matched.valorInicial), moneda: (matched.moneda as Currency) || 'USD' };
    }
    if (m.valorPatrimonial && Number(m.valorPatrimonial) > 0) {
      return { valor: Number(m.valorPatrimonial), moneda: (m.moneda as Currency) || 'USD' };
    }
    return null;
  };

  const findImplementAssetValue = (jt: MachineJobType): { valor: number; moneda: Currency } | null => {
    const matched = (assets || []).find(
      (a) =>
        a.activo !== false &&
        a.tipo === 'IMPLEMENTO' &&
        (a.referenciaId === jt.id ||
          a.nombre.trim().toLowerCase() === jt.nombre.trim().toLowerCase())
    );
    if (matched && Number(matched.valorInicial) > 0) {
      return { valor: Number(matched.valorInicial), moneda: (matched.moneda as Currency) || 'USD' };
    }
    return null;
  };

  // Returns active agricultural implements compatible with the selected machine's TYPE (tipo)
  const getCompatibleImplementsForMachine = (mId: string): MachineJobType[] => {
    if (!mId) return [];
    const m = machines.find((item) => item.id === mId);
    const targetType = (m?.tipo || '').trim().toLowerCase();
    const sameTypeMachineIds = new Set(
      machines
        .filter((x) => {
          if (String(x.id) === String(mId)) return true;
          if (!targetType) return false;
          return (x.tipo || '').trim().toLowerCase() === targetType;
        })
        .map((x) => String(x.id))
    );

    let candidates = (machineJobTypes || []).filter(
      (j) =>
        j.activo !== false &&
        !isVirtualMachineOnlyImplement(j.nombre) &&
        sameTypeMachineIds.has(String(j.maquinaId))
    );

    if (candidates.length === 0 && m?.trabajos && m.trabajos.length > 0) {
      candidates = m.trabajos.filter(
        (j) => j.activo !== false && !isVirtualMachineOnlyImplement(j.nombre)
      );
    }

    // Deduplicate by normalized implement name, preferring direct machine match
    const byName = new Map<string, MachineJobType>();
    for (const item of candidates) {
      const key = item.nombre.trim().toLowerCase();
      const existing = byName.get(key);
      if (!existing || String(item.maquinaId) === String(mId)) {
        byName.set(key, item);
      }
    }
    return Array.from(byName.values());
  };

  const formatMoney = (val: number | undefined | null, origMoneda: Currency = 'BOB') => {
    const symbol = currency === 'BOB' ? 'Bs' : 'USD';
    let num = typeof val === 'number' && !isNaN(val) ? val : 0;
    const tasa = exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? exchangeRate.tasaBobPerUsd : 6.96;
    if (origMoneda === 'BOB' && currency === 'USD') {
      num = num / tasa;
    } else if (origMoneda === 'USD' && currency === 'BOB') {
      num = num * tasa;
    }
    return `${symbol} ${num.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const applyMachineBaseTariff = (m: Machine | undefined) => {
    if (!m) return;
    jobCurrencyAnchorRef.current = null;
    const nextUnit: 'hora' | 'hectarea' = isHectareUnit(m.unidad) ? 'hectarea' : 'hora';
    setTarifa(m.tarifa || 0);
    setUnidad(nextUnit);
    setJobMoneda((m.moneda as Currency) || 'USD');
    if (nextUnit === 'hectarea' && serviceDestino === 'propiedad' && selectedLotId) {
      const ha = getLotSurfaceHa(lots, selectedLotId);
      if (ha !== null) setCantidad(ha);
    }
  };

  // Tariff rule: selecting a machine without implement applies ONLY the machine's own tariff
  const handleMachineChange = (mId: string) => {
    setSelectedMachineId(mId);
    setSelectedJobTypeId('');
    setSelectedJobNombre('');
    const m = machines.find((item) => item.id === mId);
    applyMachineBaseTariff(m);
  };

  // Tariff rule: selecting an implement applies ONLY the implement's tariff; clearing reverts to machine tariff
  const handleImplementSelect = (jobDef: MachineJobType | null) => {
    if (!jobDef) {
      setSelectedJobTypeId('');
      setSelectedJobNombre('');
      const m = machines.find((item) => item.id === selectedMachineId);
      applyMachineBaseTariff(m);
      return;
    }
    jobCurrencyAnchorRef.current = null;
    const nextUnit: 'hora' | 'hectarea' = isHectareUnit(jobDef.unidad) ? 'hectarea' : 'hora';
    setSelectedJobTypeId(jobDef.id);
    setSelectedJobNombre(jobDef.nombre);
    setTarifa(jobDef.tarifa);
    setUnidad(nextUnit);
    setJobMoneda((jobDef.moneda as Currency) || 'USD');
    if (nextUnit === 'hectarea' && serviceDestino === 'propiedad' && selectedLotId) {
      const ha = getLotSurfaceHa(lots, selectedLotId);
      if (ha !== null) setCantidad(ha);
    }
  };

  // Automatic USD <-> Bs conversion handlers across all machinery forms
  const handleJobCurrencyChange = (nextCurr: Currency) => {
    const res = convertFormCurrencyValue({
      currentValue: tarifa,
      fromCurrency: jobMoneda,
      toCurrency: nextCurr,
      tc: jobTc,
      anchor: jobCurrencyAnchorRef.current,
    });
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    if (!res.converted) return;
    jobCurrencyAnchorRef.current = res.nextAnchor;
    setJobMoneda(res.currency);
    setTarifa(res.valueNum);
    setErrorMsg(null);
  };

  const handleExpCurrencyChange = (nextCurr: Currency) => {
    const res = convertFormCurrencyValue({
      currentValue: expPrecio,
      fromCurrency: expMoneda,
      toCurrency: nextCurr,
      tc: expTc,
      anchor: expCurrencyAnchorRef.current,
    });
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    if (!res.converted) return;
    expCurrencyAnchorRef.current = res.nextAnchor;
    setExpMoneda(res.currency);
    setExpPrecio(res.valueNum);
    setErrorMsg(null);
  };

  const handleEditJobCurrencyChange = (nextCurr: Currency) => {
    const res = convertFormCurrencyValue({
      currentValue: editTarifa,
      fromCurrency: editMoneda,
      toCurrency: nextCurr,
      tc: editTc,
      anchor: editJobCurrencyAnchorRef.current,
    });
    if (res.error) {
      setEditJobError(res.error);
      return;
    }
    if (!res.converted) return;
    editJobCurrencyAnchorRef.current = res.nextAnchor;
    setEditMoneda(res.currency);
    setEditTarifa(res.valueNum);
    setEditJobError(null);
  };

  const handleEditExpCurrencyChange = (nextCurr: Currency) => {
    const res = convertFormCurrencyValue({
      currentValue: editExpPrecio,
      fromCurrency: editExpMoneda,
      toCurrency: nextCurr,
      tc: editExpTc,
      anchor: editExpCurrencyAnchorRef.current,
    });
    if (res.error) {
      setEditExpError(res.error);
      return;
    }
    if (!res.converted) return;
    editExpCurrencyAnchorRef.current = res.nextAnchor;
    setEditExpMoneda(res.currency);
    setEditExpPrecio(res.valueNum);
    setEditExpError(null);
  };

  const handleCobroCurrencyChange = (nextCurr: Currency) => {
    const res = convertFormCurrencyValue({
      currentValue: cobroImporte,
      fromCurrency: cobroMoneda,
      toCurrency: nextCurr,
      tc: cobroTc,
      anchor: cobroCurrencyAnchorRef.current,
    });
    if (res.error) {
      setCobroModalError(res.error);
      return;
    }
    if (!res.converted) return;
    cobroCurrencyAnchorRef.current = res.nextAnchor;
    setCobroMoneda(res.currency);
    setCobroImporte(res.valueStr);
    setCobroModalError(null);
  };

  const calculatedTotal =
    typeof cantidad === 'number' && typeof tarifa === 'number' ? cantidad * tarifa : 0;

  const expCalculatedTotal =
    typeof expCantidad === 'number' && typeof expPrecio === 'number'
      ? expCantidad * expPrecio
      : 0;

  const handleJobSubmit = async (e: React.FormEvent, tipoTrabajo: 'tercero' | 'propiedad') => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!activeCampaign) {
      setErrorMsg('Debes seleccionar o activar una campaña antes de registrar trabajos.');
      return;
    }

    if (!selectedMachineId) {
      setErrorMsg('Por favor selecciona una maquinaria.');
      return;
    }

    if (tipoTrabajo === 'propiedad' && !selectedLotId) {
      setErrorMsg('Para trabajos en propiedad, el Lote es obligatorio.');
      return;
    }

    if (!cantidad || cantidad <= 0) {
      setErrorMsg('La cantidad trabajada debe ser mayor a 0.');
      return;
    }

    const tcNum = parseDecimalNumber(jobTc);
    if (tcNum <= 0) {
      setErrorMsg('Ingresa un tipo de cambio válido mayor a 0.');
      return;
    }

    const machineObj = machines.find((m) => m.id === selectedMachineId);
    const lotObj = lots.find((l) => l.id === selectedLotId);

    setSaving(true);
    try {
      await createMachineryJob({
        tipoTrabajo,
        fecha,
        campanaId: activeCampaign.id,
        campanaNombre: activeCampaign.nombre,
        maquinariaId: selectedMachineId,
        maquinariaNombre: machineObj?.nombre || '',
        trabajoTipoId: selectedJobTypeId || undefined,
        trabajoNombre: selectedJobNombre || undefined,
        cliente: tipoTrabajo === 'tercero' ? cliente.trim() : undefined,
        loteId: tipoTrabajo === 'propiedad' ? selectedLotId : undefined,
        loteNombre: tipoTrabajo === 'propiedad' ? lotObj?.nombre : undefined,
        cantidad: Number(cantidad),
        unidad,
        tarifa: Number(tarifa) || 0,
        moneda: jobMoneda,
        tipoCambio: tcNum,
        total: calculatedTotal,
        observacion: observacion.trim(),
      });

      setSuccessMsg(
        tipoTrabajo === 'tercero'
          ? 'Servicio para otros guardado exitosamente (+ Ingreso Maquinarias).'
          : 'Trabajo en propiedad guardado (+ Ingreso Maquinarias y − Gasto en Lote).'
      );

      setSelectedMachineId('');
      setSelectedJobTypeId('');
      setSelectedJobNombre('');
      setSelectedLotId('');
      setCantidad('');
      setTarifa('');
      setCliente('');
      setObservacion('');
      setJobTc(
        exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
          ? String(exchangeRate.tasaBobPerUsd)
          : ''
      );
      setCurrentScreen('main');
      onRefreshData('jobs');
      if (tipoTrabajo === 'tercero') {
        invalidateQueries(['cobros.']);
        pendingCobrosQuery.refresh().catch(() => {});
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el trabajo');
    } finally {
      setSaving(false);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!activeCampaign) {
      setErrorMsg('Debes activar una campaña antes de registrar gastos.');
      return;
    }

    if (!expItemGasto.trim()) {
      setErrorMsg('Por favor selecciona un concepto de gasto.');
      return;
    }

    if (!expPrecio || expPrecio <= 0) {
      setErrorMsg('Ingresa un precio unitario válido.');
      return;
    }

    const tcNum = parseDecimalNumber(expTc);
    if (tcNum <= 0) {
      setErrorMsg('Ingresa un tipo de cambio válido mayor a 0.');
      return;
    }

    const machineObj = machines.find((m) => m.id === expMachineId);

    setSaving(true);
    try {
      await createExpense({
        fecha: expFecha,
        campanaId: activeCampaign.id,
        modulo: 'maquinarias',
        maquinariaId: expMachineId || undefined,
        maquinariaNombre: machineObj?.nombre || undefined,
        itemGasto: expItemGasto,
        cantidad: Number(expCantidad) || 1,
        unidad: expUnidad,
        precio: Number(expPrecio),
        moneda: expMoneda,
        tipoCambio: tcNum,
        total: expCalculatedTotal,
        observacion: expObservacion.trim(),
      });

      setSuccessMsg('Gasto de maquinaria registrado exitosamente.');
      setExpMachineId('');
      setExpItemGasto('');
      setExpCantidad(1);
      setExpUnidad('');
      setExpPrecio('');
      setExpObservacion('');
      setExpTc(
        exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0
          ? String(exchangeRate.tasaBobPerUsd)
          : ''
      );
      setCurrentScreen('main');
      onRefreshData('movements');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el gasto');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditJob = (j: MachineryJob, preloadedCuenta?: CobroCuenta | null) => {
    if (!effectiveIsAdmin) {
      setErrorMsg('Solo el Administrador puede editar servicios guardados.');
      return;
    }
    editJobCurrencyAnchorRef.current = null;
    setEditingJob(j);
    setEditJobError(null);
    setEditCampanaId(j.campanaId || activeCampaign?.id || '');
    setEditFecha(toYYYYMMDD(j.fecha));

    const mId = j.maquinariaId || (j as any).maquinaId || (j as any).id_maquina || '';
    setEditMachineId(mId);

    const jobName = j.trabajoNombre || (j as any).trabajo || (j as any).labor || '';
    const cleanedJobName = isVirtualMachineOnlyImplement(jobName) ? '' : jobName;
    setEditJobNombre(cleanedJobName);

    const availableJobs = getCompatibleImplementsForMachine(mId);
    let matchedTypeId = j.trabajoTipoId || '';
    if (matchedTypeId && !availableJobs.some((x) => x.id === matchedTypeId)) {
      matchedTypeId = '';
    }
    if (!matchedTypeId && cleanedJobName) {
      const match = availableJobs.find(
        (x) => x.nombre.toLowerCase().trim() === cleanedJobName.toLowerCase().trim()
      );
      if (match) matchedTypeId = match.id;
    }
    setEditJobTypeId(matchedTypeId);

    const dest = j.tipoTrabajo || (j.loteId ? 'propiedad' : 'tercero');
    setEditTipoTrabajo(dest);
    setEditCliente(j.cliente || '');
    setEditLotId(j.loteId || '');

    const cantVal = typeof j.cantidad === 'number' ? j.cantidad : parseFloat(String(j.cantidad || 0));
    setEditCantidad(isNaN(cantVal) || cantVal <= 0 ? '' : cantVal);

    const rawU = String(j.unidad || 'hora').toLowerCase();
    setEditUnidad(rawU.includes('ha') || rawU.includes('hect') ? 'hectarea' : 'hora');

    const tarifaVal = typeof j.tarifa === 'number' ? j.tarifa : parseFloat(String(j.tarifa || 0));
    setEditTarifa(isNaN(tarifaVal) ? '' : tarifaVal);

    setEditMoneda((j.moneda as Currency) || 'USD');
    const histTc =
      (j.tipoCambio && j.tipoCambio > 0 ? j.tipoCambio : 0) ||
      (j.tc && j.tc > 0 ? j.tc : 0) ||
      (preloadedCuenta?.tcServicio && preloadedCuenta.tcServicio > 0 ? preloadedCuenta.tcServicio : 0) ||
      (exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? exchangeRate.tasaBobPerUsd : 0);
    setEditTc(histTc > 0 ? String(histTc) : '');
    setEditObservacion(j.observacion || '');

    // Load linked cobro account if external service (instant from SWR cache, then revalidate in background)
    const cachedEstado = j.id ? getQuerySnapshot<CobroCuenta>(cacheKeys.cobroEstado(j.id)).data : undefined;
    const cachedCuenta =
      cachedEstado || preloadedCuenta || cobros.find((c) => String(c.trabajoId) === String(j.id)) || null;
    setEditJobCobroCuenta(dest === 'tercero' ? cachedCuenta : null);
    if (dest === 'tercero' && j.id) {
      setLoadingEditJobCobro(!cachedCuenta);
      revalidateQuery<CobroCuenta>(
        cacheKeys.cobroEstado(j.id),
        () => getCobroEstado(j.id, false),
        { minIntervalMs: 3000 }
      )
        .then((fresh) => {
          setEditJobCobroCuenta(fresh);
          patchCuentaAcrossCaches(j.id, fresh);
        })
        .catch(() => {
          // Keep cachedCuenta if cobros.estado fails
        })
        .finally(() => {
          setLoadingEditJobCobro(false);
        });
    } else {
      setLoadingEditJobCobro(false);
    }
  };

  const handleOpenEditJobFromCobro = (c: CobroCuenta) => {
    const existingJob = jobs.find((j) => String(j.id) === String(c.trabajoId));
    if (existingJob) {
      handleOpenEditJob(existingJob, c);
      return;
    }
    const rawU = String(c.unidad || 'hora').toLowerCase();
    const synthJob: MachineryJob = {
      id: c.trabajoId,
      fecha: c.fecha,
      campanaId: c.campanaId || activeCampaign?.id || '',
      campanaNombre: c.campanaNombre,
      maquinariaId: c.maquinariaId || '',
      maquinariaNombre: c.maquinariaNombre || '',
      trabajoTipoId: c.implementoId || '',
      trabajoNombre: c.trabajoNombre || '',
      tipoTrabajo: 'tercero',
      cliente: c.cliente,
      cantidad: c.cantidad ?? 1,
      unidad: rawU.includes('ha') || rawU.includes('hect') ? 'hectarea' : 'hora',
      tarifa: c.precioUnitario ?? c.tarifa ?? 0,
      moneda: c.monedaOriginalServicio || c.moneda || 'USD',
      tipoCambio: c.tcServicio || c.tipoCambio || exchangeRate?.tasaBobPerUsd,
      total: c.importeOriginalServicio ?? c.importe ?? 0,
      observacion: c.observacion || '',
    };
    handleOpenEditJob(synthJob, c);
  };

  const handleSaveEditJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;
    if (!effectiveIsAdmin) {
      setEditJobError('Solo el Administrador puede modificar servicios guardados.');
      return;
    }
    setEditJobError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetCampanaId = editCampanaId || editingJob.campanaId || activeCampaign?.id || '';
    if (!targetCampanaId) {
      setEditJobError('Selecciona una campaña.');
      return;
    }
    if (!editMachineId) {
      setEditJobError('Selecciona una maquinaria.');
      return;
    }
    const hasRegisteredCobros =
      Boolean(editJobCobroCuenta) &&
      ((editJobCobroCuenta?.cobrado ?? 0) > 0.005 || (editJobCobroCuenta?.pagos?.length ?? 0) > 0);
    if (hasRegisteredCobros && editTipoTrabajo !== 'tercero') {
      setEditJobError(
        'Este servicio ya tiene cobros registrados y no puede cambiarse a Propiedad propia.'
      );
      return;
    }
    if (editTipoTrabajo === 'propiedad' && !editLotId) {
      setEditJobError('Para trabajos en propiedad, el lote es obligatorio.');
      return;
    }
    if (!editCantidad || Number(editCantidad) <= 0) {
      setEditJobError('La cantidad trabajada debe ser mayor a 0.');
      return;
    }
    const tcNum = parseDecimalNumber(editTc);
    if (tcNum <= 0) {
      setEditJobError('Ingresa un tipo de cambio válido mayor a 0.');
      return;
    }

    const machineObj = machines.find((m) => m.id === editMachineId);
    const lotObj = lots.find((l) => l.id === editLotId);
    const cantNum = Number(editCantidad);
    const tarifaNum = Number(editTarifa) || 0;
    const totalNum = Number((cantNum * tarifaNum).toFixed(2));
    const totalUsdNum =
      editMoneda === 'USD' ? totalNum : Number((totalNum / tcNum).toFixed(2));

    if (hasRegisteredCobros && editJobCobroCuenta && totalUsdNum + 0.005 < editJobCobroCuenta.cobrado) {
      setEditJobError(
        `El nuevo importe total (USD ${totalUsdNum.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) no puede ser menor al monto ya cobrado (USD ${editJobCobroCuenta.cobrado.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
      );
      return;
    }

    setSaving(true);
    try {
      const updatedRes = await updateMachineryJob(editingJob.id, {
        campanaId: targetCampanaId,
        fecha: editFecha,
        maquinariaId: editMachineId,
        maquinariaNombre: machineObj?.nombre || editingJob.maquinariaNombre,
        trabajoTipoId: editJobTypeId,
        trabajoNombre: editJobNombre,
        tipoTrabajo: editTipoTrabajo,
        cliente: editTipoTrabajo === 'tercero' ? editCliente.trim() : '',
        loteId: editTipoTrabajo === 'propiedad' ? editLotId : '',
        loteNombre: editTipoTrabajo === 'propiedad' ? lotObj?.nombre : '',
        cantidad: cantNum,
        unidad: editUnidad,
        tarifa: tarifaNum,
        moneda: editMoneda,
        tipoCambio: tcNum,
        total: totalNum,
        observacion: editObservacion.trim(),
      });
      if (updatedRes.cuenta) {
        patchCuentaAcrossCaches(editingJob.id, updatedRes.cuenta);
      }
      setSuccessMsg('Servicio de maquinaria actualizado exitosamente.');
      setEditingJob(null);
      setEditJobCobroCuenta(null);
      onRefreshData('jobs');
      if (currentScreen === 'por_cobrar' || editTipoTrabajo === 'tercero' || editingJob.tipoTrabajo === 'tercero') {
        invalidateQueries(['cobros.']);
        await loadCobros();
      }
    } catch (err: unknown) {
      setEditJobError(err instanceof Error ? err.message : 'Error al actualizar el servicio');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) return;
    if (!effectiveIsAdmin) {
      setErrorMsg('Solo el Administrador puede eliminar servicios guardados.');
      setJobToDelete(null);
      return;
    }
    const wasExternal = jobToDelete.tipoTrabajo === 'tercero';
    setDeletingJob(true);
    setErrorMsg(null);
    try {
      await deleteMachineryJob(jobToDelete.id);
      setSuccessMsg('Trabajo eliminado exitosamente.');
      setJobToDelete(null);
      onRefreshData('jobs');
      if (wasExternal) {
        invalidateQueries(['cobros.']);
        pendingCobrosQuery.refresh().catch(() => {});
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar el trabajo');
    } finally {
      setDeletingJob(false);
    }
  };

  const handleRequestDeleteExpense = (exp: Expense) => {
    if (!effectiveIsAdmin) {
      setErrorMsg('Solo el Administrador puede eliminar gastos guardados.');
      return;
    }
    setExpenseToDelete(exp);
  };

  const handleOpenEditExpense = (exp: Expense) => {
    if (!effectiveIsAdmin) {
      setErrorMsg('Solo el Administrador puede editar gastos guardados.');
      return;
    }
    editExpCurrencyAnchorRef.current = null;
    setEditingExpense(exp);
    setEditExpError(null);
    setEditExpFecha(exp.fecha ? exp.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditExpMachineId(exp.maquinariaId || '');
    setEditExpItemGasto(exp.itemGasto || 'Combustible');
    setEditExpCantidad(exp.cantidad ?? 1);
    setEditExpUnidad(exp.unidad || 'litros');
    setEditExpPrecio(exp.precio ?? '');
    setEditExpMoneda((exp.moneda as Currency) || 'BOB');
    const histTc =
      (exp.tipoCambio && exp.tipoCambio > 0 ? exp.tipoCambio : 0) ||
      (exp.tc && exp.tc > 0 ? exp.tc : 0) ||
      (exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0 ? exchangeRate.tasaBobPerUsd : 0);
    setEditExpTc(histTc > 0 ? String(histTc) : '');
    setEditExpObservacion(exp.observacion || '');
  };

  const handleSaveEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (!effectiveIsAdmin) {
      setEditExpError('Solo el Administrador puede modificar gastos guardados.');
      return;
    }
    setEditExpError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!editExpPrecio || Number(editExpPrecio) <= 0) {
      setEditExpError('Ingresa un precio unitario válido.');
      return;
    }
    const tcNum = parseDecimalNumber(editExpTc);
    if (tcNum <= 0) {
      setEditExpError('Ingresa un tipo de cambio válido mayor a 0.');
      return;
    }

    const machineObj = machines.find((m) => m.id === editExpMachineId);
    const cantNum = Number(editExpCantidad) || 1;
    const precioNum = Number(editExpPrecio);
    const totalNum = cantNum * precioNum;

    setSaving(true);
    try {
      await updateExpense(editingExpense.id, {
        fecha: editExpFecha,
        modulo: 'maquinarias',
        maquinariaId: editExpMachineId || undefined,
        maquinariaNombre: machineObj?.nombre || undefined,
        itemGasto: editExpItemGasto,
        cantidad: cantNum,
        unidad: editExpUnidad,
        precio: precioNum,
        moneda: editExpMoneda,
        tipoCambio: tcNum,
        total: totalNum,
        observacion: editExpObservacion.trim(),
      });
      setSuccessMsg('Gasto de maquinaria actualizado exitosamente.');
      setEditingExpense(null);
      onRefreshData('movements');
    } catch (err: unknown) {
      setEditExpError(err instanceof Error ? err.message : 'Error al actualizar el gasto');
    } finally {
      setSaving(false);
    }
  };

  const externalJobs = jobs.filter((j) => j.tipoTrabajo === 'tercero');
  const propertyJobs = jobs.filter((j) => j.tipoTrabajo === 'propiedad');
  const machineryExpenses = expenses.filter((e) => e.modulo === 'maquinarias');

  const machineryExpenseItems = (itemsConfig || []).filter(
    (item) =>
      item.activo !== false &&
      item.clase !== 'INGRESO' &&
      ((item.modulo === 'MAQUINARIAS' && item.clase === 'GASTO') ||
        item.tipo === 'gasto_maquinaria')
  );

  interface MachineryMovementItem {
    id: string;
    kind: 'servicio' | 'gasto';
    tipoTrabajo?: 'tercero' | 'propiedad';
    fecha: string;
    titulo: string;
    maquinariaNombre?: string;
    destinoOCliente?: string;
    cantidadTexto?: string;
    total: number;
    moneda: Currency;
    tipoCambio?: number;
    tarifaOPrecio?: number;
    unidad?: string;
    observacion?: string;
    icono?: string;
    creadoEn?: string;
    rawJob?: MachineryJob;
    rawExpense?: Expense;
  }

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

  const getCleanObservation = (obs: string | undefined, title: string) => {
    if (!obs) return null;
    const trimmed = obs.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('[trabajo:') || lower.startsWith('[gasto:') || lower.includes(title.toLowerCase())) {
      return null;
    }
    return trimmed;
  };

  // All machinery movements: Includes ALL jobs (propiedad + tercero) and machinery expenses
  const allMachineryMovements: MachineryMovementItem[] = [
    ...jobs.map((j) => {
      const machineObj = j.maquinariaId ? machines.find((m) => m.id === j.maquinariaId || m.nombre.toLowerCase() === j.maquinariaId.toLowerCase()) : null;
      const resolvedMachineName = j.maquinariaNombre || machineObj?.nombre || 'Maquinaria';

      const lotObj = j.loteId ? lots.find((l) => l.id === j.loteId || (l.nombre && j.loteId && l.nombre.toLowerCase() === j.loteId.toLowerCase())) : null;
      const rawLot = j.loteNombre || lotObj?.nombre || (j.loteId ? `Lote ${j.loteId}` : null);
      const formattedLot = rawLot
        ? (String(rawLot).toLowerCase().startsWith('lote') ? String(rawLot) : `Lote ${rawLot}`)
        : 'Lote propio';

      return {
        id: j.id,
        kind: 'servicio' as const,
        tipoTrabajo: j.tipoTrabajo,
        fecha: j.fecha,
        titulo: formatConcept(j.trabajoNombre || 'Labor de maquinaria'),
        maquinariaNombre: resolvedMachineName,
        destinoOCliente:
          j.tipoTrabajo === 'propiedad'
            ? formattedLot
            : (j.cliente ? `Cliente: ${j.cliente}` : 'Cliente externo'),
        cantidadTexto: `${j.cantidad} ${j.unidad === 'hectarea' || (j.unidad as string) === 'ha' ? 'ha' : 'h'}`,
        total: j.total,
        moneda: (j.moneda || 'BOB') as Currency,
        tipoCambio: j.tipoCambio,
        tarifaOPrecio: j.tarifa,
        unidad: j.unidad === 'hectarea' || (j.unidad as string) === 'ha' ? 'ha' : 'hora',
        observacion: j.observacion,
        icono: getMachineIcon(j.maquinariaId, machines, j.icono),
        creadoEn: j.creadoEn,
        rawJob: j,
      };
    }),
    ...machineryExpenses.map((e) => {
      const machineObj = e.maquinariaId ? machines.find((m) => m.id === e.maquinariaId) : null;
      const resolvedMachineName = e.maquinariaNombre || machineObj?.nombre || 'General';
      return {
        id: e.id,
        kind: 'gasto' as const,
        fecha: e.fecha,
        titulo: formatConcept(e.itemGasto || 'Gasto'),
        maquinariaNombre: resolvedMachineName,
        destinoOCliente: resolvedMachineName,
        cantidadTexto: e.cantidad ? `${e.cantidad} ${e.unidad || ''}`.trim() : undefined,
        total: e.total,
        moneda: ((e.moneda as Currency) || 'BOB') as Currency,
        tipoCambio: e.tipoCambio,
        tarifaOPrecio: e.precio,
        unidad: e.unidad,
        observacion: e.observacion,
        icono: getMachineIcon(e.maquinariaId, machines, e.icono || e.itemGasto || 'repuestos'),
        creadoEn: e.creadoEn,
        rawExpense: e,
      };
    }),
  ].sort(compareChronologicalDesc);

  const filteredMachineryMovements = allMachineryMovements.filter((m) => {
    // 1. Primary Filter: Todos | Ingresos | Gastos
    if (historialFilter === 'ingresos' || (historialFilter as string) === 'servicios') {
      if (m.kind !== 'servicio') return false;
      // 2. Sub-filter for Ingresos (Servicios)
      if (serviciosSubFilter === 'terceros' && m.tipoTrabajo !== 'tercero') return false;
      if (serviciosSubFilter === 'propiedad' && m.tipoTrabajo !== 'propiedad') return false;
    } else if (historialFilter === 'gastos') {
      if (m.kind !== 'gasto') return false;
    }

    // 3. Search Term
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const formattedDate = formatDateDDMMAAAA(m.fecha).toLowerCase();
    return (
      m.titulo.toLowerCase().includes(term) ||
      (m.maquinariaNombre && m.maquinariaNombre.toLowerCase().includes(term)) ||
      (m.destinoOCliente && m.destinoOCliente.toLowerCase().includes(term)) ||
      (m.observacion && m.observacion.toLowerCase().includes(term)) ||
      formattedDate.includes(term) ||
      (m.fecha && m.fecha.includes(term))
    );
  });

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      {currentScreen !== 'main' && (
        <div className="flex items-center gap-3 my-1">
          <button
            type="button"
            onClick={() => setCurrentScreen('main')}
            aria-label="Volver a Maquinarias"
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white border border-slate-200 flex items-center justify-center gap-1.5 text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-800 shrink-0" />
            <span className="text-sm font-semibold text-slate-800">Volver</span>
          </button>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
            {currentScreen === 'historial' && 'Historial'}
            {currentScreen === 'resumen' && 'Mis máquinas'}
            {currentScreen === 'por_cobrar' && 'Por cobrar'}
            {currentScreen === 'gasto' && 'Registrar gasto'}
            {(currentScreen === 'servicio' ||
              currentScreen === 'ingreso_opciones' ||
              currentScreen === 'servicio_otros' ||
              currentScreen === 'trabajo_propiedad') &&
              'Registrar servicio'}
          </h2>
        </div>
      )}

      {/* Global Notifications */}
      {errorMsg && (
        <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <span className="break-words font-medium">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 hover:text-red-700 p-1 shrink-0 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Check className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="break-words font-medium">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1 shrink-0 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* VISTA PRINCIPAL (MAIN): ETAPA 1 — REGISTRAR Y CONSULTAR      */}
      {/* ============================================================ */}
      {currentScreen === 'main' && (
        <div className="space-y-6">
          {/* SECCIÓN A: REGISTRAR */}
          <section className="space-y-2.5" aria-label="Registrar movimiento de maquinarias">
            <h2 className="text-sm font-bold text-slate-600 px-0.5">
              Registrar
            </h2>

            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Botón SERVICIO */}
              <button
                type="button"
                onClick={() => {
                  resetNewServiceForm();
                  setServiceDestino('propiedad');
                  setCurrentScreen('servicio');
                }}
                className="w-full px-3.5 py-3 rounded-2xl bg-[#2D7D2C] hover:bg-[#256624] active:bg-[#1D541C] text-white flex flex-col items-center justify-center gap-1 transition active:scale-[0.98] cursor-pointer select-none shadow-xs"
              >
                <div className="flex items-center justify-center gap-2">
                  <Tractor className="h-5 w-5 text-white shrink-0" strokeWidth={2.2} />
                  <span className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                    Servicio
                  </span>
                </div>
                <span className="text-[11px] text-white/90 font-medium text-center leading-tight">
                  Servicio o labor
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
                  <span className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                    Gasto
                  </span>
                </div>
                <span className="text-[11px] text-white/90 font-medium text-center leading-tight">
                  Combustible y repuestos
                </span>
              </button>
            </div>
          </section>

          {/* SECCIÓN B: CONSULTAR */}
          <section className="space-y-2.5" aria-label="Consultar registros de maquinarias">
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
                      {allMachineryMovements.length}{' '}
                      {allMachineryMovements.length === 1 ? 'movimiento' : 'movimientos'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* 2. Mis máquinas */}
              <button
                type="button"
                onClick={() => setCurrentScreen('resumen')}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left min-h-[72px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 shrink-0">
                    <Tractor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      Mis máquinas
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {machines.length} {machines.length === 1 ? 'máquina' : 'máquinas'}
                      {machineJobTypes.filter((j) => !isVirtualMachineOnlyImplement(j.nombre)).length > 0 && (
                        <>
                          {' · '}
                          {machineJobTypes.filter((j) => !isVirtualMachineOnlyImplement(j.nombre)).length}{' '}
                          {machineJobTypes.filter((j) => !isVirtualMachineOnlyImplement(j.nombre)).length === 1
                            ? 'implemento'
                            : 'implementos'}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* 3. Por cobrar */}
              <button
                type="button"
                onClick={() => setCurrentScreen('por_cobrar')}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer text-left min-h-[72px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 shrink-0">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        Por cobrar
                      </h3>
                      <span className="text-sm font-bold text-slate-600 tabular-nums shrink-0">
                        {pendingCobrosCount !== null ? pendingCobrosCount : '—'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {pendingCobrosCount !== null
                        ? `${pendingCobrosCount} ${pendingCobrosCount === 1 ? 'cuenta pendiente de cobro' : 'cuentas pendientes de cobro'}`
                        : 'Cuentas por cobrar de servicios externos'}
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
      {/* SUB-VISTA: POR COBRAR (COBROS REALES: cobros.list/estado/registrar) */}
      {/* ============================================================ */}
      {currentScreen === 'por_cobrar' && (() => {
        const selectedCamp =
          porCobrarCampaignId === 'all'
            ? null
            : campaigns.find((c) => String(c.id) === String(porCobrarCampaignId)) || null;

        const jobById = new Map(jobs.map((j) => [String(j.id), j]));
        const qCobro = porCobrarSearch.trim().toLowerCase();

        const enrichedCobros = cobros.map((c) => {
          const linkedJob = jobById.get(String(c.trabajoId));
          const campId = c.campanaId || linkedJob?.campanaId || '';
          const campName =
            c.campanaNombre ||
            linkedJob?.campanaNombre ||
            campaigns.find((cp) => String(cp.id) === String(campId))?.nombre ||
            'Sin campaña';
          const machName =
            c.maquinariaNombre ||
            linkedJob?.maquinariaNombre ||
            machines.find((m) => String(m.id) === String(c.maquinariaId || linkedJob?.maquinariaId))?.nombre ||
            'Maquinaria';
          const workName = c.trabajoNombre || linkedJob?.trabajoNombre || machName;
          const clientName =
            c.cliente && c.cliente !== 'Cliente externo'
              ? c.cliente
              : linkedJob?.cliente || c.cliente || 'Cliente externo';
          const fechaVal = c.fecha || linkedJob?.fecha || '';
          const tcVal = c.tipoCambio || linkedJob?.tipoCambio || linkedJob?.tc;

          return {
            ...c,
            cliente: clientName,
            fecha: fechaVal,
            campanaId: campId,
            campanaNombre: campName,
            maquinariaNombre: machName,
            trabajoNombre: workName,
            cantidad: c.cantidad ?? linkedJob?.cantidad,
            unidad: c.unidad ?? linkedJob?.unidad,
            tarifa: c.tarifa ?? linkedJob?.tarifa,
            tipoCambio: tcVal,
            icono: linkedJob?.icono || 'tractor',
          };
        });

        const filteredCobros = enrichedCobros
          .filter((c) => {
            if (porCobrarEstadoFilter === 'pendientes' && (c.estado === 'PAGADO' || c.saldo <= 0.005)) {
              return false;
            }
            if (porCobrarEstadoFilter === 'PAGADO' && c.estado !== 'PAGADO') {
              return false;
            }
            if (selectedCamp && c.campanaId && String(c.campanaId) !== String(selectedCamp.id)) {
              return false;
            }
            if (!qCobro) return true;
            return `${c.cliente} ${c.trabajoNombre || ''} ${c.maquinariaNombre || ''} ${c.campanaNombre || ''} ${c.estado} ${formatDateDDMMAAAA(c.fecha)}`
              .toLowerCase()
              .includes(qCobro);
          })
          .sort(compareChronologicalDesc);

        const totalSaldoPendienteView = filteredCobros.reduce(
          (sum, c) =>
            sum +
            convertHistoricalAmount(
              Number(c.saldo) || 0,
              c.moneda || 'BOB',
              currency,
              c.tipoCambio,
              exchangeRate
            ),
          0
        );

        const totalCobradoView = filteredCobros.reduce(
          (sum, c) =>
            sum +
            convertHistoricalAmount(
              Number(c.cobrado) || 0,
              c.moneda || 'BOB',
              currency,
              c.tipoCambio,
              exchangeRate
            ),
          0
        );

        const estadoBadgeClass = (estado: string) => {
          if (estado === 'PAGADO') {
            return 'bg-[#EAF5EE] text-[#1D5C3F] border border-[#BFE0CD]';
          }
          if (estado === 'PARCIAL') {
            return 'bg-sky-50 text-sky-800 border border-sky-200';
          }
          return 'bg-amber-50 text-amber-800 border border-amber-200';
        };

        return (
          <div className="space-y-3.5">
            {/* Resumen simplificado de cuentas por cobrar */}
            <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-[#5E6D64]">
                      Total pendiente · {filteredCobros.length} cuentas
                    </p>
                    {cobrosRevalidating && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#24875B]">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Actualizando...</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold text-[#24875B] tabular-nums mt-0.5">
                    {formatCurrencyAmount(totalSaldoPendienteView, currency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadCobros()}
                  disabled={cobrosLoading}
                  title="Actualizar cuentas por cobrar"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF5EE] text-[#24875B] hover:bg-[#DCEFE4] transition cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${cobrosLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Aviso discreto de error sin ocultar los datos previos cargados */}
            {cobrosError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-900 space-y-0.5 min-w-0 flex-1">
                    <p className="font-bold">
                      {cobrosHasLoaded
                        ? 'No se pudo actualizar. Mostrando los últimos datos cargados.'
                        : 'Error al consultar cobros en Google Apps Script'}
                    </p>
                    <p className="break-words text-red-800/90">{cobrosError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => loadCobros()}
                  disabled={cobrosLoading}
                  className="text-xs font-bold text-red-700 hover:text-red-900 underline shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Reintentar
                </button>
              </div>
            )}

            <ListToolbar
              title="Cuentas"
              countLabel={`${filteredCobros.length} reg.`}
              searchValue={porCobrarSearch}
              onSearchChange={setPorCobrarSearch}
              searchPlaceholder="Buscar cliente, servicio o fecha..."
              filters={
                <div className="flex items-center gap-1.5">
                  <CompactFilter
                    value={porCobrarEstadoFilter}
                    onChange={(val) =>
                      setPorCobrarEstadoFilter(val as 'pendientes' | 'todos' | 'PAGADO')
                    }
                    ariaLabel="Filtrar estado de cobro"
                    options={[
                      { value: 'pendientes', label: 'Pendientes' },
                      { value: 'todos', label: 'Todos' },
                      { value: 'PAGADO', label: 'Pagados' },
                    ]}
                  />
                  {campaigns.length > 0 && (
                    <CompactFilter
                      value={porCobrarCampaignId}
                      onChange={(val) => setPorCobrarCampaignId(val)}
                      ariaLabel="Filtrar por campaña"
                      options={[
                        { value: 'all', label: 'Todas las campañas' },
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

            {cobrosInitialLoading || (!cobrosHasLoaded && !cobrosError) ? (
              <div className="rounded-2xl border border-[#E2E7E3] bg-white p-8 text-center text-xs text-[#5E6D64] flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-[#24875B]" />
                <span>Consultando cuentas por cobrar...</span>
              </div>
            ) : (
              <CompactList
                isEmpty={filteredCobros.length === 0}
                emptyMessage={
                  !cobrosHasLoaded && cobrosError
                    ? 'No se pudieron cargar las cuentas por cobrar.'
                    : qCobro
                    ? 'No se encontraron cuentas con esa búsqueda.'
                    : porCobrarEstadoFilter === 'pendientes'
                    ? 'No hay cuentas pendientes de cobro.'
                    : 'No hay cuentas registradas para este filtro.'
                }
              >
                {filteredCobros.map((c) => {
                  const rowKey = c.trabajoId || c.id || '';
                  const isExpanded = expandedPorCobrarId === rowKey;
                  const isLoadingDetail = loadingCobroEstadoId === rowKey;
                  const detailErr = cobroEstadoErrors[rowKey];
                  const curLabel = c.moneda === 'USD' ? 'USD' : 'Bs';
                  const unitShort =
                    c.unidad === 'hectarea' || (c.unidad as string) === 'ha' ? 'ha' : 'h';
                  const canRegisterPayment = c.estado !== 'PAGADO' && c.saldo > 0.005;

                  return (
                    <CompactListRow
                      key={rowKey}
                      icon={
                        <div className="w-8 h-8 rounded-lg bg-[#EAF5EE] border border-[#BFE0CD]/70 flex items-center justify-center">
                          <VisualIcon name={getMachineIcon(c.maquinariaId, machines, c.icono)} size="xs" />
                        </div>
                      }
                      title={
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{c.cliente}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${estadoBadgeClass(
                              c.estado
                            )}`}
                          >
                            {c.estado}
                          </span>
                        </span>
                      }
                      subtitle={
                        <span>
                          {formatDateDDMMAAAA(c.fecha)} · {formatConcept(c.trabajoNombre || c.maquinariaNombre)} · {c.campanaNombre}
                        </span>
                      }
                      rightPrimary={
                        <span
                          className={`font-mono ${
                            c.saldo > 0.005 ? 'text-[#26352D]' : 'text-[#24875B]'
                          }`}
                        >
                          {curLabel}{' '}
                          {Number(c.saldo > 0.005 ? c.saldo : c.importe).toLocaleString('es-BO', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      }
                      rightSecondary={
                        c.saldo > 0.005
                          ? `Saldo · Orig. ${curLabel} ${Number(c.importe || 0).toLocaleString('es-BO', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : 'Pagado'
                      }
                      isExpanded={isExpanded}
                      onClick={() => handleToggleCobroRow(c)}
                      expandedContent={
                        <div className="space-y-3 text-xs">
                          {/* 3 filas compactas: Total del servicio, Cobrado, Saldo pendiente (destacado en USD) */}
                          <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
                            <div className="px-3 py-2 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-[#5E6D64] font-medium block">Total del servicio</span>
                                {c.monedaOriginalServicio === 'BOB' && c.importeOriginalServicio ? (
                                  <span className="text-[10px] text-[#7A8780] font-mono">
                                    Orig.: Bs {c.importeOriginalServicio.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    {c.tcServicio ? ` · TC ${c.tcServicio}` : ''}
                                  </span>
                                ) : null}
                              </div>
                              <span className="font-mono font-semibold text-[#26352D] shrink-0">
                                {curLabel} {Number(c.importe || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="px-3 py-2 flex items-center justify-between gap-2">
                              <span className="text-[#5E6D64] font-medium">Cobrado</span>
                              <span className="font-mono font-semibold text-[#24875B]">
                                {curLabel} {Number(c.cobrado || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-[#FAFBF8]">
                              <span className="font-bold text-[#26352D]">Saldo pendiente</span>
                              <span className={`font-mono font-black text-sm ${c.saldo > 0.005 ? 'text-amber-700' : 'text-[#24875B]'}`}>
                                {curLabel} {Number(c.saldo || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Error puntual al consultar cobros.estado */}
                          {detailErr && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800 flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                              <span className="break-words">{detailErr}</span>
                            </div>
                          )}

                          {/* Acciones: Registrar cobro + Editar servicio (solo admin) */}
                          <div className={`flex items-center gap-2 ${canRegisterPayment && effectiveIsAdmin ? 'flex-wrap sm:flex-nowrap' : ''}`}>
                            {canRegisterPayment && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCobroModal(c);
                                }}
                                className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                              >
                                <HandCoins className="h-4 w-4 shrink-0" />
                                <span>Registrar cobro</span>
                              </button>
                            )}
                            {effectiveIsAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditJobFromCobro(c);
                                }}
                                className={`${canRegisterPayment ? 'px-3.5' : 'w-full px-4'} min-h-[42px] py-2.5 rounded-xl bg-white hover:bg-[#F2F5F3] text-[#26352D] border border-[#D4DDD6] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer`}
                              >
                                <Edit3 className="h-3.5 w-3.5 shrink-0" />
                                <span>Editar servicio</span>
                              </button>
                            )}
                          </div>

                          {/* Historial de pagos: muestra moneda original, TC y equivalente USD */}
                          {c.pagos && c.pagos.length > 0 && (
                            <div className="rounded-xl border border-[#E2E7E3] bg-white overflow-hidden">
                              <div className="px-3 py-2 bg-[#F8FAF8] border-b border-[#EFF2EF] flex items-center justify-between">
                                <span className="text-[11px] font-bold text-[#26352D]">
                                  Historial de pagos ({c.pagos.length})
                                </span>
                                {isLoadingDetail && (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#24875B]" />
                                )}
                              </div>
                              <div className="divide-y divide-[#EFF2EF]">
                                {c.pagos.map((p) => {
                                  const isBobPay = p.monedaCobro === 'BOB';
                                  const usdAmt = Number(p.importeUsd ?? p.importe ?? 0);
                                  const origAmt = Number(p.importeOriginal ?? usdAmt);
                                  return (
                                    <div
                                      key={p.id}
                                      className="px-3 py-2.5 flex items-start justify-between gap-2"
                                    >
                                      <div className="min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-xs font-semibold text-[#26352D]">
                                            {formatDateDDMMAAAA(p.fecha)}
                                          </span>
                                          <span
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                              isBobPay
                                                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                                : 'bg-[#EAF5EE] text-[#1D5C3F] border border-[#BFE0CD]'
                                            }`}
                                          >
                                            {isBobPay ? 'Bs' : 'USD'}
                                          </span>
                                        </div>
                                        {isBobPay ? (
                                          <p className="text-[11px] text-[#5E6D64] font-mono tabular-nums">
                                            Bs {origAmt.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            {p.tc && p.tc > 0 ? ` · TC ${p.tc}` : ''}
                                          </p>
                                        ) : p.tc && p.tc > 0 ? (
                                          <p className="text-[11px] text-[#7A8780] font-mono tabular-nums">
                                            TC ref.: {p.tc}
                                          </p>
                                        ) : null}
                                        {p.observacion && (
                                          <p className="text-[11px] text-[#5E6D64] italic break-words">
                                            {p.observacion}
                                          </p>
                                        )}
                                      </div>
                                      <span className="font-mono font-bold text-[#24875B] shrink-0 tabular-nums">
                                        +USD{' '}
                                        {usdAmt.toLocaleString('es-BO', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Sección colapsable "Más detalles" */}
                          <details className="group rounded-xl border border-[#E2E7E3] bg-white overflow-hidden">
                            <summary className="px-3 py-2.5 bg-[#F8FAF8] text-xs font-bold text-[#26352D] cursor-pointer flex items-center justify-between select-none">
                              <span>Más detalles</span>
                              <ChevronDown className="h-3.5 w-3.5 text-[#7A8780] group-open:rotate-180 transition" />
                            </summary>
                            <div className="p-3 space-y-1.5 divide-y divide-[#EFF2EF] text-xs">
                              <div className="pt-1.5 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64]">Máquina / Labor</span>
                                <span className="font-semibold text-[#26352D] text-right">
                                  {c.maquinariaNombre}
                                  {c.trabajoNombre && c.trabajoNombre !== c.maquinariaNombre
                                    ? ` · ${formatConcept(c.trabajoNombre)}`
                                    : ''}
                                </span>
                              </div>
                              <div className="pt-1.5 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64]">Campaña</span>
                                <span className="font-semibold text-[#26352D]">{c.campanaNombre}</span>
                              </div>
                              {c.cantidad && (c.precioUnitario || c.tarifa) ? (
                                <div className="pt-1.5 flex items-center justify-between gap-2">
                                  <span className="text-[#5E6D64]">Trabajo / Tarifa</span>
                                  <span className="font-semibold text-[#26352D] tabular-nums">
                                    {c.cantidad} {unitShort} ×{' '}
                                    {(c.monedaOriginalServicio || c.moneda) === 'USD' ? 'USD' : 'Bs'}{' '}
                                    {Number(c.precioUnitario ?? c.tarifa ?? 0).toLocaleString('es-BO', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ) : null}
                              {getCleanObservation(c.observacion, c.trabajoNombre || '') && (
                                <div className="pt-1.5 flex items-center justify-between gap-2">
                                  <span className="text-[#5E6D64]">Observación</span>
                                  <span className="italic text-[#26352D] text-right">
                                    {getCleanObservation(c.observacion, c.trabajoNombre || '')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </details>
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
      {/* FORMULARIO UNIFICADO: REGISTRAR SERVICIO                     */}
      {/* ============================================================ */}
      {(currentScreen === 'servicio' ||
        currentScreen === 'ingreso_opciones' ||
        currentScreen === 'servicio_otros' ||
        currentScreen === 'trabajo_propiedad') && (() => {
        const compatibleImplements = getCompatibleImplementsForMachine(selectedMachineId);
        const selectedMachineObj = machines.find((m) => m.id === selectedMachineId);
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 shadow-xs">
              <form
                onSubmit={(e) => handleJobSubmit(e, serviceDestino)}
                className="space-y-3"
              >
                {/* 1. Fecha */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Fecha <span className="text-[#C44545]">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-[#64746B] pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className={`${FORM_INPUT_CLASS} pl-9`}
                    />
                  </div>
                </div>

                {/* 2. Máquina (obligatoria) */}
                <VisualMachinePicker
                  label="Máquina"
                  machines={activeMachines}
                  selectedMachineId={selectedMachineId}
                  onSelectMachine={(m) => handleMachineChange(m.id)}
                  required
                />

                {/* 3. Implemento agrícola (opcional, filtrado por tipo de máquina) */}
                {selectedMachineId && (
                  <VisualJobTypePicker
                    label="Implemento agrícola"
                    optionalText="(opcional)"
                    jobTypes={compatibleImplements}
                    selectedJobTypeId={selectedJobTypeId}
                    onSelectJobType={(j) => handleImplementSelect(j)}
                    allowNone
                    noneLabel={
                      selectedMachineObj
                        ? `Sin implemento (tarifa de ${selectedMachineObj.nombre})`
                        : 'Sin implemento'
                    }
                  />
                )}

                {/* 4. Destino (Propiedad propia / Cliente externo) */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Destino <span className="text-[#C44545]">*</span>
                  </label>
                  <div className="flex p-1 bg-[#F2F5F3] rounded-xl gap-1 border border-[#E2E7E3]">
                    <button
                      type="button"
                      onClick={() => {
                        setServiceDestino('propiedad');
                        if (selectedLotId && isHectareUnit(unidad)) {
                          const ha = getLotSurfaceHa(lots, selectedLotId);
                          if (ha !== null) setCantidad(ha);
                        }
                      }}
                      className={`flex-1 h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer ${
                        serviceDestino === 'propiedad'
                          ? 'bg-white text-[#24875B] shadow-xs border border-[#BFE0CD]'
                          : 'text-[#5E6D64] hover:text-[#26352D]'
                      }`}
                    >
                      Propiedad propia
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceDestino('tercero')}
                      className={`flex-1 h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer ${
                        serviceDestino === 'tercero'
                          ? 'bg-white text-[#26352D] shadow-xs border border-[#D4DDD6]'
                          : 'text-[#5E6D64] hover:text-[#26352D]'
                      }`}
                    >
                      Cliente externo
                    </button>
                  </div>
                </div>

                {/* 5. Lote (si Propiedad) o Cliente (si Externo) */}
                {serviceDestino === 'propiedad' ? (
                  <VisualLotPicker
                    lots={lots}
                    selectedLotId={selectedLotId}
                    onSelect={(id) => {
                      setSelectedLotId(id);
                      if (isHectareUnit(unidad)) {
                        const ha = getLotSurfaceHa(lots, id);
                        if (ha !== null) setCantidad(ha);
                      }
                    }}
                    label="Lote"
                    required
                  />
                ) : (
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Cliente <span className="text-[#7A8780] font-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-[#64746B] pointer-events-none" />
                      <input
                        type="text"
                        value={cliente}
                        onChange={(e) => setCliente(e.target.value)}
                        placeholder="Nombre del cliente"
                        className={`${FORM_INPUT_CLASS} pl-9`}
                      />
                    </div>
                  </div>
                )}

                {/* 6. Cantidad y Unidad */}
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
                      min="0.1"
                      placeholder="0.0"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                    />
                  </div>
                  <AppSelect
                    label="Unidad"
                    required
                    icon={<Wrench className="h-[17px] w-[17px]" />}
                    value={unidad}
                    onChange={(e) => {
                      const nextU = e.target.value as 'hora' | 'hectarea';
                      setUnidad(nextU);
                      if (isHectareUnit(nextU) && serviceDestino === 'propiedad' && selectedLotId) {
                        const ha = getLotSurfaceHa(lots, selectedLotId);
                        if (ha !== null) setCantidad(ha);
                      }
                    }}
                  >
                    <option value="hora">Horas</option>
                    <option value="hectarea">Hectáreas</option>
                  </AppSelect>
                </div>

                {/* 7. Tarifa y Moneda */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Tarifa por {unidad === 'hectarea' ? 'ha' : 'hora'}{' '}
                      <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      required
                      min="0"
                      placeholder="0.00"
                      value={tarifa}
                      onChange={(e) => {
                        jobCurrencyAnchorRef.current = null;
                        setTarifa(e.target.value === '' ? '' : parseFloat(e.target.value));
                      }}
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                    />
                  </div>
                  <CurrencySelect
                    label="Moneda"
                    required
                    value={jobMoneda}
                    onChange={handleJobCurrencyChange}
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
                    value={jobTc}
                    onChange={(e) => setJobTc(e.target.value)}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>

                {/* 8. Importe total */}
                <div className="bg-[#EAF5EE] px-3.5 py-2.5 rounded-xl border border-[#BFE0CD] flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#175B3D]">Importe total</span>
                  <span className="text-base font-extrabold text-[#175B3D] font-mono tabular-nums">
                    {jobMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                    {calculatedTotal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 9. Observación (opcional) */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Observación <span className="text-[#7A8780] font-normal">(opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    placeholder="Notas del servicio..."
                    className={FORM_TEXTAREA_CLASS}
                  />
                </div>

                {/* Botón Guardar */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#24875B] hover:bg-[#1D704B] active:bg-[#175B3D] text-white font-bold h-[42px] text-sm shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>{saving ? 'Guardando...' : 'Guardar servicio'}</span>
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* FORMULARIO: GASTO DE MAQUINARIA                              */}
      {/* ============================================================ */}
      {currentScreen === 'gasto' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 shadow-xs">
            <form onSubmit={handleExpenseSubmit} className="space-y-3">
              {/* Maquinaria Asignada */}
              <VisualMachinePicker
                label="Máquina"
                optionalText="(opcional)"
                machines={machines}
                selectedMachineId={expMachineId}
                onSelectMachine={(m) => setExpMachineId(m.id)}
                allowNone
                noneLabel="Gasto general (sin máquina)"
              />

              {/* Concepto de Gasto */}
              <VisualExpenseItemPicker
                label="Concepto de gasto"
                items={machineryExpenseItems}
                selectedItemName={expItemGasto}
                onSelectItem={(item) => {
                  expCurrencyAnchorRef.current = null;
                  setExpItemGasto(item.nombre);
                  if (item.unidad) setExpUnidad(item.unidad);
                  if (item.precioPredeterminado && !expPrecio) setExpPrecio(item.precioPredeterminado);
                  if (item.moneda) setExpMoneda(item.moneda);
                }}
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
                    min="0.1"
                    placeholder="1"
                    value={expCantidad}
                    onChange={(e) => setExpCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <div>
                  <label className={FORM_LABEL_CLASS}>Unidad</label>
                  <input
                    type="text"
                    value={expUnidad}
                    onChange={(e) => setExpUnidad(e.target.value)}
                    placeholder="litros, piezas, horas"
                    className={FORM_INPUT_CLASS}
                  />
                </div>
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
                    onChange={(e) => {
                      expCurrencyAnchorRef.current = null;
                      setExpPrecio(e.target.value === '' ? '' : parseFloat(e.target.value));
                    }}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <CurrencySelect
                  label="Moneda"
                  required
                  value={expMoneda}
                  onChange={handleExpCurrencyChange}
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
              <div className="bg-[#FCECEC] px-3.5 py-2.5 rounded-xl border border-[#F2C6C6] flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#9F2D2D]">Importe total</span>
                <span className="text-base font-extrabold text-[#9F2D2D] font-mono tabular-nums">
                  {expMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                  {expCalculatedTotal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Observación */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Observación <span className="text-[#7A8780] font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={expObservacion}
                  onChange={(e) => setExpObservacion(e.target.value)}
                  placeholder="Factura, proveedor, detalle..."
                  className={FORM_TEXTAREA_CLASS}
                />
              </div>

              {/* Botón Guardar */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#C44545] hover:bg-[#A93838] active:bg-[#8E2D2D] text-white font-bold h-[42px] text-sm shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-4 w-4 shrink-0" />
                <span>{saving ? 'Guardando...' : 'Guardar gasto'}</span>
              </button>
            </form>
          </div>

          {/* Lista de gastos recientes */}
          <div className="space-y-2.5">
            <ListToolbar
              title="Gastos de Maquinarias"
              countLabel={`${machineryExpenses.length} reg.`}
            />

            <CompactList
              isEmpty={machineryExpenses.length === 0}
              emptyMessage="No hay gastos de maquinaria registrados en esta campaña."
            >
              {machineryExpenses.map((exp) => (
                <CompactListRow
                  key={exp.id}
                  icon={
                    <div className="w-8 h-8 rounded-lg bg-[#FCECEC] border border-[#F2C6C6]/60 flex items-center justify-center">
                      <VisualIcon name={exp.icono || exp.itemGasto || 'repuestos'} size="xs" />
                    </div>
                  }
                  title={exp.itemGasto}
                  subtitle={
                    <span>
                      {formatDateDDMMAAAA(exp.fecha)} · {exp.maquinariaNombre || 'Gasto general'} · {exp.cantidad} {exp.unidad}
                      {exp.observacion ? ` · ${exp.observacion}` : ''}
                    </span>
                  }
                  rightPrimary={
                    <span className="text-[#C44545] font-mono">
                      - {formatMoney(exp.total, exp.moneda)}
                    </span>
                  }
                  rightActions={
                    effectiveIsAdmin ? (
                      <div className="flex items-center gap-0.5 pl-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditExpense(exp)}
                          className="p-1.5 text-[#7A8780] hover:text-[#26352D] hover:bg-[#EFF2EF] rounded-lg transition cursor-pointer"
                          title="Editar gasto"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestDeleteExpense(exp)}
                          className="p-1.5 text-[#7A8780] hover:text-[#C44545] hover:bg-[#FCECEC] rounded-lg transition cursor-pointer"
                          title="Eliminar gasto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </CompactList>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONSULTA: MOVIMIENTOS (SERVICIOS Y GASTOS)                   */}
      {/* ============================================================ */}
      {currentScreen === 'historial' && (
        <div className="space-y-3">
          <ListToolbar
            title="Historial"
            countLabel={`${filteredMachineryMovements.length} reg.`}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por labor, cliente, lote o máquina..."
            filters={
              <CompactFilter
                value={historialFilter}
                onChange={(val) => {
                  setHistorialFilter(val as 'todos' | 'ingresos' | 'gastos');
                  setServiciosSubFilter('todos');
                }}
                accent={
                  historialFilter === 'ingresos'
                    ? 'green'
                    : historialFilter === 'gastos'
                    ? 'red'
                    : 'neutral'
                }
                ariaLabel="Filtrar movimientos por tipo"
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'ingresos', label: 'Ingresos' },
                  { value: 'gastos', label: 'Gastos' },
                ]}
              />
            }
          />

          <CompactList
            isEmpty={filteredMachineryMovements.length === 0}
            emptyMessage="No hay movimientos registrados."
          >
            {filteredMachineryMovements.map((m) => {
              const isExpanded = expandedMovementId === m.id;
              const isService = m.kind === 'servicio';

              return (
                <CompactListRow
                  key={`${m.kind}-${m.id}`}
                  icon={
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                        isService
                          ? m.tipoTrabajo === 'propiedad'
                            ? 'bg-[#EAF5EE] border-[#BFE0CD]/70'
                            : 'bg-[#EEF4FA] border-[#C9DCF0]/80'
                          : 'bg-[#FCECEC] border-[#F2C6C6]/70'
                      }`}
                    >
                      <VisualIcon
                        name={m.icono || (isService ? 'tractor' : 'repuestos')}
                        size="xs"
                      />
                    </div>
                  }
                  title={m.titulo}
                  subtitle={
                    <span className="inline-flex items-center gap-1.5 max-w-full truncate">
                      <span>{formatDateDDMMAAAA(m.fecha)}</span>
                      <span>·</span>
                      {m.tipoTrabajo === 'propiedad' ? (
                        <span className="font-semibold text-[#24875B] truncate">
                          {m.destinoOCliente}
                        </span>
                      ) : (
                        <span className="truncate">
                          {m.destinoOCliente || m.maquinariaNombre}
                          {isService ? ' · Terceros' : ''}
                        </span>
                      )}
                    </span>
                  }
                  rightPrimary={
                    <span className={`font-mono ${isService ? 'text-[#24875B]' : 'text-[#C44545]'}`}>
                      {isService ? '+ ' : '- '}
                      {m.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                      {m.total.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  }
                  isExpanded={isExpanded}
                  onClick={() => setExpandedMovementId(isExpanded ? null : m.id)}
                  expandedContent={
                    <div className="space-y-2 text-xs">
                      <div className="divide-y divide-[#EFF2EF]">
                        <div className="py-1.5 flex items-center justify-between gap-2">
                          <span className="text-[#5E6D64] font-medium">Maquinaria</span>
                          <span className="font-semibold text-[#26352D] text-right">
                            {m.maquinariaNombre || '—'}
                          </span>
                        </div>
                        {m.tipoTrabajo === 'propiedad' ? (
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">Lote</span>
                            <span className="font-semibold text-[#24875B] text-right">
                              {m.destinoOCliente || '—'}
                            </span>
                          </div>
                        ) : (
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">Destino / Cliente</span>
                            <span className="font-semibold text-[#26352D] text-right">
                              {m.destinoOCliente || '—'}
                            </span>
                          </div>
                        )}
                        <div className="py-1.5 flex items-center justify-between gap-2">
                          <span className="text-[#5E6D64] font-medium">
                            {isService ? 'Tarifa' : 'Precio'}
                          </span>
                          <span className="font-semibold text-[#26352D] tabular-nums text-right">
                            {m.tarifaOPrecio !== undefined && m.tarifaOPrecio !== null
                              ? `${m.moneda === 'USD' ? 'USD' : 'Bs'} ${m.tarifaOPrecio.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${m.unidad || 'unidad'}`
                              : '—'}
                          </span>
                        </div>
                        <div className="py-1.5 flex items-center justify-between gap-2">
                          <span className="text-[#5E6D64] font-medium">Equivalencia</span>
                          <span className="font-mono font-semibold text-[#26352D] text-right">
                            {m.tipoCambio && m.tipoCambio > 0
                              ? m.moneda === 'USD'
                                ? `Bs ${(m.total * m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (TC: ${formatTC(m.tipoCambio)})`
                                : `USD ${(m.total / m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (TC: ${formatTC(m.tipoCambio)})`
                              : '—'}
                          </span>
                        </div>
                        {getCleanObservation(m.observacion, m.titulo) && (
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium shrink-0">Observación</span>
                            <span className="font-normal text-[#26352D] text-right italic">
                              {getCleanObservation(m.observacion, m.titulo)}
                            </span>
                          </div>
                        )}
                      </div>

                      {effectiveIsAdmin ? (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6EBE7]">
                          {isService && m.rawJob && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditJob(m.rawJob!)}
                                className="px-3.5 py-1.5 rounded-xl bg-white border border-[#D4DDD6] hover:bg-[#F2F5F3] text-[#26352D] font-semibold text-xs transition cursor-pointer min-h-[34px]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setJobToDelete(m.rawJob!)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#FCECEC] hover:bg-[#F7DCDC] text-[#C44545] font-semibold text-xs transition cursor-pointer border border-[#F2C6C6] min-h-[34px]"
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                          {m.kind === 'gasto' && m.rawExpense && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditExpense(m.rawExpense!)}
                                className="px-3.5 py-1.5 rounded-xl bg-white border border-[#D4DDD6] hover:bg-[#F2F5F3] text-[#26352D] font-semibold text-xs transition cursor-pointer min-h-[34px]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteExpense(m.rawExpense!)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#FCECEC] hover:bg-[#F7DCDC] text-[#C44545] font-semibold text-xs transition cursor-pointer border border-[#F2C6C6] min-h-[34px]"
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 pt-2 border-t border-[#E6EBE7] text-[11px] text-[#7A8780]">
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          <span>Solo el Administrador puede editar o eliminar registros guardados.</span>
                        </div>
                      )}
                    </div>
                  }
                />
              );
            })}
          </CompactList>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONSULTA: MIS MÁQUINAS (MÁQUINAS + IMPLEMENTOS AGRÍCOLAS)    */}
      {/* ============================================================ */}
      {currentScreen === 'resumen' && (() => {
        const searchNorm = machinesSearch.trim().toLowerCase();

        const filteredSummaryMachines = machines.filter((m) => {
          const isActive = m.estado !== 'inactivo' && m.activo !== false;
          if (machinesStatusFilter === 'activos' && !isActive) return false;
          if (machinesStatusFilter === 'desactivados' && isActive) return false;
          if (!searchNorm) return true;
          return `${m.nombre} ${m.tipo || ''} ${m.estado || ''}`.toLowerCase().includes(searchNorm);
        });

        const allImplements = (machineJobTypes || []).filter(
          (jt) => !isVirtualMachineOnlyImplement(jt.nombre)
        );
        const filteredImplements = allImplements.filter((jt) => {
          const isActive = jt.activo !== false;
          if (machinesStatusFilter === 'activos' && !isActive) return false;
          if (machinesStatusFilter === 'desactivados' && isActive) return false;
          if (!searchNorm) return true;
          const compatType = getImplementCompatibleType(jt);
          return `${jt.nombre} ${compatType}`.toLowerCase().includes(searchNorm);
        });

        const showMachinesOpen = Boolean(searchNorm) || machinesGroupOpen;
        const showImplementsOpen = Boolean(searchNorm) || implementsGroupOpen;

        return (
          <div className="space-y-3">
            <ListToolbar
              title="Mis máquinas"
              countLabel={`${filteredSummaryMachines.length + filteredImplements.length}`}
              searchValue={machinesSearch}
              onSearchChange={setMachinesSearch}
              searchPlaceholder="Buscar máquina o implemento..."
              filters={
                <CompactFilter
                  value={machinesStatusFilter}
                  onChange={(val) =>
                    setMachinesStatusFilter(val as 'activos' | 'desactivados' | 'todos')
                  }
                  ariaLabel="Filtrar estado"
                  options={[
                    { value: 'activos', label: 'Activos' },
                    { value: 'desactivados', label: 'Desactivados' },
                    { value: 'todos', label: 'Todos' },
                  ]}
                />
              }
            />

            {/* GRUPO 1: MÁQUINAS (abierto inicialmente) */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setMachinesGroupOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-[#E2E7E3] hover:bg-[#F8FAF8] transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Tractor className="h-4 w-4 text-[#24875B] shrink-0" />
                  <span className="text-sm font-bold text-[#26352D] truncate">
                    Máquinas ({filteredSummaryMachines.length})
                  </span>
                </div>
                {showMachinesOpen ? (
                  <ChevronUp className="h-4 w-4 text-[#7A8780] shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#7A8780] shrink-0" />
                )}
              </button>

              {showMachinesOpen && (
                <CompactList
                  isEmpty={filteredSummaryMachines.length === 0}
                  emptyMessage={
                    searchNorm
                      ? 'No se encontraron máquinas con esa búsqueda.'
                      : machinesStatusFilter === 'desactivados'
                      ? 'No hay máquinas desactivadas.'
                      : 'No hay máquinas registradas.'
                  }
                >
                  {filteredSummaryMachines.map((m) => {
                    const machineJobs = jobs
                      .filter((j) => j.maquinariaId === m.id)
                      .sort(compareChronologicalDesc);
                    const hrs = machineJobs
                      .filter((j) => j.unidad === 'hora' || (j.unidad as string) === 'h')
                      .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);
                    const ha = machineJobs
                      .filter((j) => j.unidad === 'hectarea' || (j.unidad as string) === 'ha')
                      .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

                    const assetInfo = findMachineAssetValue(m);
                    const isExpanded = expandedMachineId === m.id;
                    const isActive = m.estado !== 'inactivo' && m.activo !== false;
                    const isMaintenance = m.estado === 'mantenimiento';
                    const unitLabel = m.unidad === 'hectarea' || (m.unidad as string) === 'ha' ? 'ha' : 'h';

                    return (
                      <CompactListRow
                        key={m.id}
                        muted={!isActive}
                        icon={
                          <div className="w-8 h-8 rounded-lg bg-[#F4F7F5] border border-[#E2E7E3] flex items-center justify-center">
                            <VisualIcon name={m.icono || m.tipo || 'tractor'} size="xs" />
                          </div>
                        }
                        title={m.nombre}
                        subtitle={
                          <span>
                            {getMachineTypeLabel(m)} · {hrs.toFixed(1)} h · {ha.toFixed(1)} ha
                          </span>
                        }
                        rightPrimary={
                          <span className="text-[#26352D] font-mono">
                            {m.moneda === 'USD' ? 'USD' : 'Bs'} {m.tarifa}/{unitLabel}
                          </span>
                        }
                        rightSecondary={
                          <span
                            className={
                              !isActive
                                ? 'text-[#7A8780]'
                                : isMaintenance
                                ? 'text-amber-700 font-semibold'
                                : 'text-[#24875B] font-semibold'
                            }
                          >
                            {!isActive ? 'Inactivo' : isMaintenance ? 'Mantenim.' : 'Operativo'}
                          </span>
                        }
                        isExpanded={isExpanded}
                        onClick={() => setExpandedMachineId(isExpanded ? null : m.id)}
                        expandedContent={
                          <div className="space-y-3 text-xs">
                            {/* Resumen numérico compacto */}
                            <div className="grid grid-cols-3 divide-x divide-[#E6EBE7] bg-white py-2 rounded-xl border border-[#E2E7E3] text-center">
                              <div className="px-1">
                                <span className="text-[10px] text-[#7A8780] font-semibold block uppercase">
                                  Horas
                                </span>
                                <span className="text-xs font-bold text-[#26352D] font-mono">
                                  {hrs.toFixed(1)} h
                                </span>
                              </div>
                              <div className="px-1">
                                <span className="text-[10px] text-[#7A8780] font-semibold block uppercase">
                                  Hectáreas
                                </span>
                                <span className="text-xs font-bold text-[#26352D] font-mono">
                                  {ha.toFixed(1)} ha
                                </span>
                              </div>
                              <div className="px-1">
                                <span className="text-[10px] text-[#7A8780] font-semibold block uppercase">
                                  Servicios
                                </span>
                                <span className="text-xs font-bold text-[#26352D] font-mono">
                                  {machineJobs.length}
                                </span>
                              </div>
                            </div>

                            {/* Ficha de máquina */}
                            <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF]">
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">Tarifa propia</span>
                                <span className="font-mono font-semibold text-[#26352D]">
                                  {m.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                  {Number(m.tarifa || 0).toLocaleString('es-BO', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  / {unitLabel}
                                </span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">Valor patrimonial</span>
                                <span className="font-mono font-semibold text-[#26352D]">
                                  {assetInfo
                                    ? `${assetInfo.moneda === 'USD' ? 'USD' : 'Bs'} ${assetInfo.valor.toLocaleString('es-BO', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                    : 'No registrado'}
                                </span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">Estado</span>
                                <span className="font-semibold text-[#26352D]">
                                  {!isActive ? 'Inactivo' : isMaintenance ? 'En mantenimiento' : 'Operativo'}
                                </span>
                              </div>
                            </div>

                            {/* Historial de trabajos realizados */}
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-semibold text-[#5E6D64]">
                                Historial de trabajos realizados ({machineJobs.length})
                              </p>
                              {machineJobs.length > 0 ? (
                                <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
                                  {machineJobs.slice(0, 10).map((j) => {
                                    const lotObj = j.loteId
                                      ? lots.find((l) => l.id === j.loteId)
                                      : null;
                                    const destLabel =
                                      j.tipoTrabajo === 'propiedad'
                                        ? j.loteNombre || lotObj?.nombre || 'Lote propio'
                                        : j.cliente || 'Cliente externo';
                                    const uStr =
                                      j.unidad === 'hectarea' || (j.unidad as string) === 'ha'
                                        ? 'ha'
                                        : 'h';
                                    return (
                                      <div
                                        key={j.id}
                                        className="px-3 py-2 flex items-center justify-between gap-2"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-[#26352D] truncate">
                                            {formatConcept(j.trabajoNombre || m.nombre)}
                                          </p>
                                          <p className="text-[11px] text-[#7A8780] truncate">
                                            {formatDateDDMMAAAA(j.fecha)} · {destLabel} · {j.cantidad} {uStr}
                                          </p>
                                        </div>
                                        <span className="text-xs font-bold text-[#24875B] font-mono shrink-0">
                                          {formatMoney(j.total, (j.moneda as Currency) || 'BOB')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="px-3 py-2.5 text-xs text-[#7A8780] bg-white rounded-xl border border-[#E2E7E3]">
                                  Sin trabajos registrados en esta campaña.
                                </div>
                              )}
                            </div>
                          </div>
                        }
                      />
                    );
                  })}
                </CompactList>
              )}
            </div>

            {/* GRUPO 2: IMPLEMENTOS AGRÍCOLAS (colapsado inicialmente) */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setImplementsGroupOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-[#E2E7E3] hover:bg-[#F8FAF8] transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Wrench className="h-4 w-4 text-[#24875B] shrink-0" />
                  <span className="text-sm font-bold text-[#26352D] truncate">
                    Implementos agrícolas ({filteredImplements.length})
                  </span>
                </div>
                {showImplementsOpen ? (
                  <ChevronUp className="h-4 w-4 text-[#7A8780] shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#7A8780] shrink-0" />
                )}
              </button>

              {showImplementsOpen && (
                <CompactList
                  isEmpty={filteredImplements.length === 0}
                  emptyMessage={
                    searchNorm
                      ? 'No se encontraron implementos con esa búsqueda.'
                      : machinesStatusFilter === 'desactivados'
                      ? 'No hay implementos desactivados.'
                      : 'No hay implementos agrícolas registrados.'
                  }
                >
                  {filteredImplements.map((jt) => {
                    const compatType = getImplementCompatibleType(jt);
                    const assetInfo = findImplementAssetValue(jt);
                    const isExpanded = expandedImplementId === jt.id;
                    const isActive = jt.activo !== false;
                    const uLabel = jt.unidad === 'hectarea' || (jt.unidad as string) === 'ha' ? 'ha' : 'h';

                    const normName = jt.nombre.trim().toLowerCase();
                    const implementJobs = jobs
                      .filter((j) => {
                        if (j.trabajoTipoId && j.trabajoTipoId === jt.id) return true;
                        const jName = (j.trabajoNombre || '').trim().toLowerCase();
                        return jName !== '' && jName === normName;
                      })
                      .sort(compareChronologicalDesc);

                    return (
                      <CompactListRow
                        key={jt.id}
                        muted={!isActive}
                        icon={
                          <div className="w-8 h-8 rounded-lg bg-[#F4F7F5] border border-[#E2E7E3] flex items-center justify-center">
                            <VisualIcon name={jt.icono || jt.nombre} size="xs" />
                          </div>
                        }
                        title={jt.nombre}
                        subtitle={<span>Compatible: {compatType}</span>}
                        rightPrimary={
                          <span className="text-[#24875B] font-mono">
                            {jt.moneda === 'USD' ? 'USD' : 'Bs'} {jt.tarifa}/{uLabel}
                          </span>
                        }
                        rightSecondary={
                          <span className={isActive ? 'text-[#24875B] font-semibold' : 'text-[#7A8780]'}>
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        }
                        isExpanded={isExpanded}
                        onClick={() => setExpandedImplementId(isExpanded ? null : jt.id)}
                        expandedContent={
                          <div className="space-y-3 text-xs">
                            <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF]">
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">Tipo de máquina compatible</span>
                                <span className="font-semibold text-[#26352D]">{compatType}</span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">Tarifa propia</span>
                                <span className="font-mono font-semibold text-[#24875B]">
                                  {jt.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                  {Number(jt.tarifa || 0).toLocaleString('es-BO', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  / {uLabel}
                                </span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">Unidad de cobro</span>
                                <span className="font-semibold text-[#26352D]">
                                  {uLabel === 'ha' ? 'Hectárea (ha)' : 'Hora (h)'}
                                </span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">Valor patrimonial</span>
                                <span className="font-mono font-semibold text-[#26352D]">
                                  {assetInfo
                                    ? `${assetInfo.moneda === 'USD' ? 'USD' : 'Bs'} ${assetInfo.valor.toLocaleString('es-BO', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                    : 'No registrado'}
                                </span>
                              </div>
                            </div>

                            {/* Historial de trabajos realizados con este implemento */}
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-semibold text-[#5E6D64]">
                                Historial con este implemento ({implementJobs.length})
                              </p>
                              {implementJobs.length > 0 ? (
                                <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
                                  {implementJobs.slice(0, 10).map((j) => {
                                    const lotObj = j.loteId
                                      ? lots.find((l) => l.id === j.loteId)
                                      : null;
                                    const destLabel =
                                      j.tipoTrabajo === 'propiedad'
                                        ? j.loteNombre || lotObj?.nombre || 'Lote propio'
                                        : j.cliente || 'Cliente externo';
                                    const uStr =
                                      j.unidad === 'hectarea' || (j.unidad as string) === 'ha'
                                        ? 'ha'
                                        : 'h';
                                    return (
                                      <div
                                        key={j.id}
                                        className="px-3 py-2 flex items-center justify-between gap-2"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-[#26352D] truncate">
                                            {j.maquinariaNombre || 'Máquina'} · {destLabel}
                                          </p>
                                          <p className="text-[11px] text-[#7A8780] truncate">
                                            {formatDateDDMMAAAA(j.fecha)} · {j.cantidad} {uStr}
                                          </p>
                                        </div>
                                        <span className="text-xs font-bold text-[#24875B] font-mono shrink-0">
                                          {formatMoney(j.total, (j.moneda as Currency) || 'BOB')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="px-3 py-2.5 text-xs text-[#7A8780] bg-white rounded-xl border border-[#E2E7E3]">
                                  Sin trabajos registrados con este implemento en esta campaña.
                                </div>
                              )}
                            </div>
                          </div>
                        }
                      />
                    );
                  })}
                </CompactList>
              )}
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* MODAL: EDITAR SERVICIO                                       */}
      {/* ============================================================ */}
      {editingJob && (() => {
        const editCompatibleImplements = getCompatibleImplementsForMachine(editMachineId);
        const editMachineObj = machines.find((m) => m.id === editMachineId);
        const editTcNum = parseDecimalNumber(editTc);
        const editTotalOrig =
          (typeof editCantidad === 'number' ? editCantidad : 0) *
          (typeof editTarifa === 'number' ? editTarifa : 0);
        const editTotalUsd =
          editMoneda === 'USD'
            ? editTotalOrig
            : editTcNum > 0
            ? Number((editTotalOrig / editTcNum).toFixed(2))
            : 0;
        const hasRegisteredCobros =
          Boolean(editJobCobroCuenta) &&
          ((editJobCobroCuenta?.cobrado ?? 0) > 0.005 || (editJobCobroCuenta?.pagos?.length ?? 0) > 0);
        const cobradoUsd = editJobCobroCuenta?.cobrado ?? 0;
        const saldoProyectadoUsd = Math.max(0, Number((editTotalUsd - cobradoUsd).toFixed(2)));
        const exceedsCobradoViolation = hasRegisteredCobros && editTotalUsd + 0.005 < cobradoUsd;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    Editar servicio
                  </h3>
                  {hasRegisteredCobros && (
                    <p className="text-[11px] text-[#24875B] font-semibold mt-0.5">
                      Conserva {editJobCobroCuenta?.pagos?.length || 1} cobro(s) registrado(s)
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingJob(null);
                    setEditJobCobroCuenta(null);
                    setEditJobError(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditJob} className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
                {editJobError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="break-words">{editJobError}</span>
                  </div>
                )}

                {/* Resumen de cuenta por cobrar cuando tiene pagos registrados */}
                {(hasRegisteredCobros || loadingEditJobCobro) && (
                  <div className="rounded-xl border border-[#BFE0CD] bg-[#F5FAF7] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#1D5C3F] uppercase">
                        Estado de cobro (USD)
                      </span>
                      {loadingEditJobCobro && (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#24875B]" />
                      )}
                    </div>
                    {editJobCobroCuenta && (
                      <div className="grid grid-cols-3 divide-x divide-[#D4E6DC] text-center bg-white rounded-lg border border-[#D4E6DC] py-2">
                        <div className="px-1">
                          <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Total</span>
                          <span className="text-xs font-bold text-[#26352D] font-mono tabular-nums">
                            USD {editTotalUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="px-1">
                          <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Cobrado</span>
                          <span className="text-xs font-bold text-[#24875B] font-mono tabular-nums">
                            USD {cobradoUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="px-1">
                          <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Saldo</span>
                          <span className={`text-xs font-black font-mono tabular-nums ${exceedsCobradoViolation ? 'text-red-600' : 'text-amber-700'}`}>
                            USD {saldoProyectadoUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}
                    {exceedsCobradoViolation && (
                      <p className="text-[11px] font-semibold text-red-700">
                        El total del servicio no puede ser menor al monto ya cobrado (USD {cobradoUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).
                      </p>
                    )}
                  </div>
                )}

                {/* 1. Fecha y Campaña */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
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
                  <AppSelect
                    label="Campaña"
                    required
                    icon={<Calendar className="h-[17px] w-[17px]" />}
                    value={editCampanaId}
                    onChange={(e) => setEditCampanaId(e.target.value)}
                  >
                    <option value="">Seleccionar campaña</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.activa ? '(Activa)' : ''}
                      </option>
                    ))}
                  </AppSelect>
                </div>

                {/* 2. Máquina */}
                <VisualMachinePicker
                  label="Máquina"
                  machines={machines}
                  selectedMachineId={editMachineId}
                  onSelectMachine={(m) => {
                    setEditMachineId(m.id);
                    const nextCompat = getCompatibleImplementsForMachine(m.id);
                    const stillCompatible = editJobTypeId
                      ? nextCompat.some((x) => x.id === editJobTypeId)
                      : false;
                    if (!stillCompatible) {
                      editJobCurrencyAnchorRef.current = null;
                      const nextU: 'hora' | 'hectarea' = isHectareUnit(m.unidad) ? 'hectarea' : 'hora';
                      setEditJobTypeId('');
                      setEditJobNombre('');
                      setEditTarifa(m.tarifa || 0);
                      setEditUnidad(nextU);
                      setEditMoneda((m.moneda as Currency) || 'USD');
                      if (nextU === 'hectarea' && editTipoTrabajo === 'propiedad' && editLotId) {
                        const ha = getLotSurfaceHa(lots, editLotId);
                        if (ha !== null) setEditCantidad(ha);
                      }
                    }
                  }}
                  required
                />

                {/* 3. Implemento agrícola (opcional) */}
                <VisualJobTypePicker
                  label="Implemento agrícola"
                  optionalText="(opcional)"
                  jobTypes={editCompatibleImplements}
                  selectedJobTypeId={editJobTypeId}
                  onSelectJobType={(jDef) => {
                    editJobCurrencyAnchorRef.current = null;
                    if (!jDef) {
                      setEditJobTypeId('');
                      setEditJobNombre('');
                      if (editMachineObj) {
                        const nextU: 'hora' | 'hectarea' = isHectareUnit(editMachineObj.unidad)
                          ? 'hectarea'
                          : 'hora';
                        setEditTarifa(editMachineObj.tarifa || 0);
                        setEditUnidad(nextU);
                        setEditMoneda((editMachineObj.moneda as Currency) || 'USD');
                        if (nextU === 'hectarea' && editTipoTrabajo === 'propiedad' && editLotId) {
                          const ha = getLotSurfaceHa(lots, editLotId);
                          if (ha !== null) setEditCantidad(ha);
                        }
                      }
                      return;
                    }
                    const nextU: 'hora' | 'hectarea' = isHectareUnit(jDef.unidad)
                      ? 'hectarea'
                      : 'hora';
                    setEditJobTypeId(jDef.id);
                    setEditJobNombre(jDef.nombre);
                    setEditTarifa(jDef.tarifa);
                    setEditUnidad(nextU);
                    setEditMoneda((jDef.moneda as Currency) || 'USD');
                    if (nextU === 'hectarea' && editTipoTrabajo === 'propiedad' && editLotId) {
                      const ha = getLotSurfaceHa(lots, editLotId);
                      if (ha !== null) setEditCantidad(ha);
                    }
                  }}
                  allowNone
                  noneLabel={
                    editMachineObj
                      ? `Sin implemento (tarifa de ${editMachineObj.nombre})`
                      : 'Sin implemento'
                  }
                />

                {/* 4. Destino */}
                <div>
                  <label className={FORM_LABEL_CLASS}>Destino</label>
                  <div className="flex p-1 bg-[#F2F5F3] rounded-xl gap-1 border border-[#E2E7E3]">
                    <button
                      type="button"
                      disabled={hasRegisteredCobros}
                      onClick={() => setEditTipoTrabajo('propiedad')}
                      className={`flex-1 h-[36px] text-xs font-semibold rounded-lg transition ${
                        hasRegisteredCobros
                          ? 'opacity-45 cursor-not-allowed text-[#7A8780]'
                          : editTipoTrabajo === 'propiedad'
                          ? 'bg-white text-[#24875B] shadow-xs border border-[#BFE0CD] cursor-pointer'
                          : 'text-[#5E6D64] hover:text-[#26352D] cursor-pointer'
                      }`}
                    >
                      Propiedad propia
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTipoTrabajo('tercero')}
                      className={`flex-1 h-[36px] text-xs font-semibold rounded-lg transition cursor-pointer ${
                        editTipoTrabajo === 'tercero'
                          ? 'bg-white text-[#26352D] shadow-xs border border-[#D4DDD6]'
                          : 'text-[#5E6D64] hover:text-[#26352D]'
                      }`}
                    >
                      Cliente externo
                    </button>
                  </div>
                  {hasRegisteredCobros && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Bloqueado en Cliente externo porque ya existen cobros registrados.
                    </p>
                  )}
                </div>

                {/* 5. Lote o Cliente */}
                {editTipoTrabajo === 'propiedad' ? (
                  <VisualLotPicker
                    lots={lots}
                    selectedLotId={editLotId}
                    onSelect={(id) => {
                      setEditLotId(id);
                      if (isHectareUnit(editUnidad)) {
                        const ha = getLotSurfaceHa(lots, id);
                        if (ha !== null) setEditCantidad(ha);
                      }
                    }}
                    label="Lote"
                    required
                  />
                ) : (
                  <div>
                    <label className={FORM_LABEL_CLASS}>Cliente</label>
                    <input
                      type="text"
                      value={editCliente}
                      onChange={(e) => setEditCliente(e.target.value)}
                      placeholder="Nombre del cliente"
                      className={FORM_INPUT_CLASS}
                    />
                  </div>
                )}

                {/* 6. Cantidad y Unidad */}
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
                  <AppSelect
                    label="Unidad"
                    required
                    icon={<Wrench className="h-[17px] w-[17px]" />}
                    value={editUnidad}
                    onChange={(e) => {
                      const nextU = e.target.value as 'hora' | 'hectarea';
                      setEditUnidad(nextU);
                      if (isHectareUnit(nextU) && editTipoTrabajo === 'propiedad' && editLotId) {
                        const ha = getLotSurfaceHa(lots, editLotId);
                        if (ha !== null) setEditCantidad(ha);
                      }
                    }}
                  >
                    <option value="hora">Horas</option>
                    <option value="hectarea">Hectáreas</option>
                  </AppSelect>
                </div>

                {/* 7. Tarifa y Moneda */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Tarifa por {editUnidad === 'hectarea' ? 'ha' : 'hora'}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={editTarifa}
                      onChange={(e) => {
                        editJobCurrencyAnchorRef.current = null;
                        setEditTarifa(e.target.value === '' ? '' : parseFloat(e.target.value));
                      }}
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                    />
                  </div>
                  <CurrencySelect
                    label="Moneda"
                    required
                    value={editMoneda}
                    onChange={handleEditJobCurrencyChange}
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
                    value={editTc}
                    onChange={(e) => setEditTc(e.target.value)}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>

                {/* 8. Importe total */}
                <div className="bg-[#EAF5EE] px-3.5 py-2.5 rounded-xl border border-[#BFE0CD] flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#175B3D]">Importe total</span>
                  <span className="text-base font-extrabold text-[#175B3D] font-mono tabular-nums">
                    {editMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                    {editTotalOrig.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 9. Observación */}
                <div>
                  <label className={FORM_LABEL_CLASS}>Observación</label>
                  <textarea
                    rows={2}
                    value={editObservacion}
                    onChange={(e) => setEditObservacion(e.target.value)}
                    className={FORM_TEXTAREA_CLASS}
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setEditingJob(null);
                      setEditJobCobroCuenta(null);
                      setEditJobError(null);
                    }}
                    className="flex-1 h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || exceedsCobradoViolation}
                    className="flex-1 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] active:bg-[#175B3D] text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    <span>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* MODAL: CONFIRMAR ELIMINACIÓN DE TRABAJO                      */}
      {/* ============================================================ */}
      {jobToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 rounded-2xl bg-rose-100">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ¿Eliminar este trabajo?
                </h3>
                <p className="text-xs text-slate-500">
                  Esta acción es definitiva en Google Sheets
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm space-y-1.5">
              <p>
                <strong className="text-slate-700">Equipo:</strong> {jobToDelete.maquinariaNombre}
              </p>
              <p>
                <strong className="text-slate-700">Fecha:</strong> {formatDateDDMMAAAA(jobToDelete.fecha)}
              </p>
              <p>
                <strong className="text-slate-700">Destino:</strong>{' '}
                {jobToDelete.tipoTrabajo === 'propiedad'
                  ? `Lote ${jobToDelete.loteNombre || 'Propiedad'}`
                  : `Cliente ${jobToDelete.cliente || 'Externo'}`}
              </p>
              <p>
                <strong className="text-slate-700">Trabajado:</strong> {jobToDelete.cantidad} {jobToDelete.unidad}s
              </p>
            </div>

            <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200/70">
              Nota: También se anulará su ingreso contable en Maquinarias y su gasto vinculado en Propiedad si correspondía.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={deletingJob}
                onClick={() => setJobToDelete(null)}
                className="flex-1 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingJob}
                onClick={handleConfirmDeleteJob}
                className="flex-1 min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer"
              >
                {deletingJob ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CONFIRMAR ELIMINACIÓN DE GASTO DE MAQUINARIA          */}
      {/* ============================================================ */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 rounded-2xl bg-rose-100">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ¿Eliminar este gasto?
                </h3>
                <p className="text-xs text-slate-500">
                  Esta acción es definitiva en Google Sheets
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm space-y-1.5">
              <p>
                <strong className="text-slate-700">Concepto:</strong> {expenseToDelete.itemGasto}
              </p>
              <p>
                <strong className="text-slate-700">Fecha:</strong> {formatDateDDMMAAAA(expenseToDelete.fecha)}
              </p>
              {expenseToDelete.maquinariaNombre && (
                <p>
                  <strong className="text-slate-700">Equipo:</strong> {expenseToDelete.maquinariaNombre}
                </p>
              )}
              <p>
                <strong className="text-slate-700">Monto:</strong> {expenseToDelete.moneda}{' '}
                {expenseToDelete.total.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={deletingExpense}
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingExpense}
                onClick={async () => {
                  if (!effectiveIsAdmin) {
                    setErrorMsg('Solo el Administrador puede eliminar gastos guardados.');
                    setExpenseToDelete(null);
                    return;
                  }
                  setDeletingExpense(true);
                  try {
                    await deleteExpense(expenseToDelete.id);
                    setSuccessMsg('Gasto de maquinaria eliminado exitosamente.');
                    setExpenseToDelete(null);
                    onRefreshData('movements');
                  } catch (err: unknown) {
                    setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar');
                  } finally {
                    setDeletingExpense(false);
                  }
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer"
              >
                {deletingExpense ? 'Eliminando...' : 'Eliminar Gasto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDITAR GASTO DE MAQUINARIA                             */}
      {/* ============================================================ */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-200 p-5 sm:p-6 space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Editar gasto
              </h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditExpense} className="space-y-3">
              {editExpError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="break-words">{editExpError}</span>
                </div>
              )}

              {/* Fecha */}
              <div>
                <label className={FORM_LABEL_CLASS}>Fecha</label>
                <input
                  type="date"
                  required
                  value={editExpFecha}
                  onChange={(e) => setEditExpFecha(e.target.value)}
                  className={FORM_INPUT_CLASS}
                />
              </div>

              {/* Máquina */}
              <VisualMachinePicker
                label="Máquina"
                optionalText="(opcional)"
                machines={machines}
                selectedMachineId={editExpMachineId}
                onSelectMachine={(m) => setEditExpMachineId(m.id)}
                allowNone
                noneLabel="Gasto general (sin máquina)"
              />

              {/* Concepto de gasto */}
              <VisualExpenseItemPicker
                label="Concepto de gasto"
                items={machineryExpenseItems}
                selectedItemName={editExpItemGasto}
                onSelectItem={(item) => {
                  setEditExpItemGasto(item.nombre);
                  if (item.unidad) setEditExpUnidad(item.unidad);
                }}
                required
              />

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>Cantidad</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0.01"
                    value={editExpCantidad}
                    onChange={(e) => setEditExpCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <div>
                  <label className={FORM_LABEL_CLASS}>Unidad</label>
                  <input
                    type="text"
                    value={editExpUnidad}
                    onChange={(e) => setEditExpUnidad(e.target.value)}
                    placeholder="litros, repuestos"
                    className={FORM_INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Precio y Moneda */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>Precio unitario</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0.01"
                    value={editExpPrecio}
                    onChange={(e) => {
                      editExpCurrencyAnchorRef.current = null;
                      setEditExpPrecio(e.target.value === '' ? '' : parseFloat(e.target.value));
                    }}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <CurrencySelect
                  label="Moneda"
                  required
                  value={editExpMoneda}
                  onChange={handleEditExpCurrencyChange}
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
                  value={editExpTc}
                  onChange={(e) => setEditExpTc(e.target.value)}
                  className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                />
              </div>

              {/* Importe total */}
              <div className="bg-[#FCECEC] px-3.5 py-2.5 rounded-xl border border-[#F2C6C6] flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#9F2D2D]">Importe total</span>
                <span className="text-base font-extrabold text-[#9F2D2D] font-mono tabular-nums">
                  {editExpMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                  {(
                    (typeof editExpCantidad === 'number' ? editExpCantidad : 1) *
                    (typeof editExpPrecio === 'number' ? editExpPrecio : 0)
                  ).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Observación */}
              <div>
                <label className={FORM_LABEL_CLASS}>Observación</label>
                <textarea
                  rows={2}
                  value={editExpObservacion}
                  onChange={(e) => setEditExpObservacion(e.target.value)}
                  className={FORM_TEXTAREA_CLASS}
                />
              </div>

              {/* Botones */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] active:bg-[#175B3D] text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: REGISTRAR COBRO EN USD O BS (cobros.registrar)        */}
      {/* ============================================================ */}
      {cobroModalCuenta && (() => {
        const importeInputNum = parseDecimalNumber(cobroImporte);
        const tcInputNum = parseDecimalNumber(cobroTc);
        const equivUsdPreview =
          cobroMoneda === 'BOB'
            ? tcInputNum > 0 && importeInputNum > 0
              ? Number((importeInputNum / tcInputNum).toFixed(2))
              : 0
            : importeInputNum > 0
            ? Number(importeInputNum.toFixed(2))
            : 0;
        const maxEnMonedaSeleccionada =
          cobroMoneda === 'BOB' && tcInputNum > 0
            ? Number((cobroModalCuenta.saldo * tcInputNum).toFixed(2))
            : Number(cobroModalCuenta.saldo.toFixed(2));
        const nuevoSaldoEstimado = Math.max(
          0,
          Number((cobroModalCuenta.saldo - equivUsdPreview).toFixed(2))
        );
        const excedeSaldo = equivUsdPreview > cobroModalCuenta.saldo + 0.005;

        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
            <div className="fixed inset-0" onClick={() => !savingCobro && setCobroModalCuenta(null)} />
            <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden z-10 max-h-[92vh] flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">Registrar cobro</h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {cobroModalCuenta.cliente} · {formatDateDDMMAAAA(cobroModalCuenta.fecha)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingCobro}
                  onClick={() => setCobroModalCuenta(null)}
                  className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitCobro} className="p-4 sm:p-5 overflow-y-auto space-y-3">
                {cobroModalError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="break-words">{cobroModalError}</span>
                  </div>
                )}

                {/* Resumen de cuenta en USD */}
                <div className="rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] overflow-hidden">
                  <div className="grid grid-cols-3 divide-x divide-[#E6EBE7] py-2 text-center">
                    <div className="px-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Total</span>
                      <span className="text-xs font-bold text-[#26352D] font-mono tabular-nums">
                        USD {cobroModalCuenta.importe.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="px-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Cobrado</span>
                      <span className="text-xs font-bold text-[#24875B] font-mono tabular-nums">
                        USD {cobroModalCuenta.cobrado.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="px-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#7A8780] block">Saldo</span>
                      <span className="text-xs font-black text-amber-700 font-mono tabular-nums">
                        USD {cobroModalCuenta.saldo.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  {cobroModalCuenta.monedaOriginalServicio === 'BOB' && cobroModalCuenta.importeOriginalServicio ? (
                    <div className="px-3 py-1.5 border-t border-[#E6EBE7] text-[11px] text-[#5E6D64] text-center font-mono">
                      Servicio original: Bs {cobroModalCuenta.importeOriginalServicio.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {cobroModalCuenta.tcServicio ? ` · TC ${cobroModalCuenta.tcServicio}` : ''}
                    </div>
                  ) : null}
                </div>

                {/* Moneda del cobro: selector desplegable unificado con conversión automática */}
                <CurrencySelect
                  label="Moneda del cobro"
                  required
                  value={cobroMoneda}
                  onChange={handleCobroCurrencyChange}
                />

                {/* Fecha del cobro y Tipo de cambio */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Fecha de cobro <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={cobroFecha}
                      onChange={(e) => setCobroFecha(e.target.value)}
                      className={FORM_INPUT_CLASS}
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
                      value={cobroTc}
                      onChange={(e) => setCobroTc(e.target.value)}
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                    />
                  </div>
                </div>

                {/* Importe recibido en la moneda seleccionada */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-[13px] font-semibold text-[#26352D]">
                      Importe recibido ({cobroMoneda === 'USD' ? 'USD' : 'Bs'}){' '}
                      <span className="text-[#C44545]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const tcRef = tcInputNum > 0 ? tcInputNum : (exchangeRate?.tasaBobPerUsd || 6.96);
                        cobroCurrencyAnchorRef.current = {
                          baseAmount: Number(cobroModalCuenta.saldo.toFixed(2)),
                          baseCurrency: 'USD',
                          lastDisplayedValue: maxEnMonedaSeleccionada,
                          lastCurrency: cobroMoneda,
                          lastTc: tcRef,
                        };
                        setCobroImporte(maxEnMonedaSeleccionada.toFixed(2));
                      }}
                      className="text-[11px] font-semibold text-[#24875B] hover:underline cursor-pointer shrink-0"
                    >
                      Usar saldo ({cobroMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                      {maxEnMonedaSeleccionada.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </button>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={cobroImporte}
                    onChange={(e) => {
                      cobroCurrencyAnchorRef.current = null;
                      setCobroImporte(e.target.value);
                    }}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums ${
                      excedeSaldo ? 'border-red-400 focus:border-red-500 text-red-700' : ''
                    }`}
                  />
                </div>

                {/* Conversión automática y nuevo saldo estimado en USD */}
                <div
                  className={`rounded-xl px-3.5 py-2.5 border space-y-1 ${
                    excedeSaldo
                      ? 'bg-red-50 border-red-200'
                      : cobroMoneda === 'BOB'
                      ? 'bg-sky-50/80 border-sky-200'
                      : 'bg-[#EAF5EE] border-[#BFE0CD]'
                  }`}
                >
                  {cobroMoneda === 'BOB' && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-sky-950">Equivalente en USD</span>
                      <span className="text-sm font-extrabold text-sky-950 font-mono tabular-nums">
                        USD {equivUsdPreview.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-semibold ${excedeSaldo ? 'text-red-800' : 'text-[#26352D]'}`}>
                      Saldo pendiente
                    </span>
                    <span className={`font-mono font-bold tabular-nums ${excedeSaldo ? 'text-red-700' : 'text-[#175B3D]'}`}>
                      USD {nuevoSaldoEstimado.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {excedeSaldo && (
                    <p className="text-[11px] font-semibold text-red-700">
                      El monto supera el saldo pendiente de USD {cobroModalCuenta.saldo.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
                    </p>
                  )}
                </div>

                {/* Observación */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Observación <span className="text-[#7A8780] font-normal">(opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Transferencia, pago parcial en efectivo..."
                    value={cobroObs}
                    onChange={(e) => setCobroObs(e.target.value)}
                    className={FORM_TEXTAREA_CLASS}
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={savingCobro}
                    onClick={() => setCobroModalCuenta(null)}
                    className="flex-1 h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingCobro || excedeSaldo}
                    className="flex-1 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    <span>{savingCobro ? 'Guardando...' : 'Guardar cobro'}</span>
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
