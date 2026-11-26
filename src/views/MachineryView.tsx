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
  Customer,
  PaymentSettings,
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
  getCobroEstado,
  compareChronologicalDesc,
  getMachineIcon,
} from '../services/backend';
import { addDaysToIso } from '../services/interestEngine';
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
import { CustomerPicker } from '../components/CustomerPicker';
import {
  AppSelect,
  CurrencySelect,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
} from '../components/AppSelect';
import { ObservationField } from '../components/ObservationField';
import { Switch } from '../components/Switch';
import { useI18n } from '../services/i18n';
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
  revalidateQuery,
} from '../services/dataCache';
import { usePersistedMemoryState } from '../hooks/useSwrQuery';
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
  customers?: Customer[];
  paymentSettings?: PaymentSettings | null;
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
  | 'resumen';

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
  customers = [],
  paymentSettings = null,
  currency,
  exchangeRate,
  isAdmin,
  onRefreshData,
}) => {
  const { lang, bi, t, translateStatus, translateUnit, translateError } = useI18n();
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

  // Currency conversion anchors (prevent cumulative rounding drift on repeated USD <-> Bs toggles)
  const jobCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);
  const expCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);
  const editJobCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);
  const editExpCurrencyAnchorRef = useRef<CurrencyConversionAnchor | null>(null);

  // Customer lookup helper (always resolves current catalog name by clienteId)
  const customersById = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) {
      if (c.id) map.set(String(c.id), c);
    }
    return map;
  }, [customers]);

  const resolveJobCustomerLabel = useCallback(
    (j: MachineryJob): string => {
      if (j.clienteId) {
        const found = customersById.get(String(j.clienteId));
        if (found) return found.nombre;
      }
      if (j.clientePendiente) return t('customers.pendingClient');
      if (j.cliente && j.cliente.trim()) return j.cliente.trim();
      return t('customers.pendingClient');
    },
    [customersById, t]
  );

  // Form State for Machinery Job (Unified Registrar servicio)
  const [serviceDestino, setServiceDestino] = useState<'propiedad' | 'tercero'>('propiedad');
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string>('');
  const [selectedJobNombre, setSelectedJobNombre] = useState<string>('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clientePendiente, setClientePendiente] = useState(false);
  const [cliente, setCliente] = useState('');
  const [jobPlazoDias, setJobPlazoDias] = useState('');
  const [jobFechaVencimiento, setJobFechaVencimiento] = useState('');
  const [jobAplicarInteres, setJobAplicarInteres] = useState(false);
  const [jobTasaInteres, setJobTasaInteres] = useState('');
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
    }
  }, [exchangeRate?.tasaBobPerUsd]);

  const preloadPaymentDefaultsForNewService = useCallback(
    (baseDate: string) => {
      if (paymentSettings?.configurado) {
        const plazo =
          paymentSettings.plazoDiasPredeterminado !== null &&
          paymentSettings.plazoDiasPredeterminado !== undefined
            ? paymentSettings.plazoDiasPredeterminado
            : null;
        setJobPlazoDias(plazo !== null ? String(plazo) : '');
        setJobFechaVencimiento(plazo !== null ? addDaysToIso(baseDate, plazo) : '');
        setJobAplicarInteres(Boolean(paymentSettings.aplicarInteresPorDefecto));
        setJobTasaInteres(
          paymentSettings.porcentajeInteresMensual !== null &&
            paymentSettings.porcentajeInteresMensual !== undefined
            ? String(paymentSettings.porcentajeInteresMensual)
            : ''
        );
      } else {
        setJobPlazoDias('');
        setJobFechaVencimiento('');
        setJobAplicarInteres(false);
        setJobTasaInteres('');
      }
    },
    [paymentSettings]
  );

  const resetNewServiceForm = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    jobCurrencyAnchorRef.current = null;
    setSelectedMachineId('');
    setSelectedJobTypeId('');
    setSelectedJobNombre('');
    setSelectedLotId('');
    setClienteId('');
    setClientePendiente(false);
    setCliente('');
    setCantidad('');
    setTarifa('');
    setUnidad('hora');
    setJobMoneda('USD');
    setFecha(todayStr);
    preloadPaymentDefaultsForNewService(todayStr);
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
  const [editClienteId, setEditClienteId] = useState('');
  const [editClientePendiente, setEditClientePendiente] = useState(false);
  const [editCliente, setEditCliente] = useState('');
  const [editPlazoDias, setEditPlazoDias] = useState('');
  const [editFechaVencimiento, setEditFechaVencimiento] = useState('');
  const [editAplicarInteres, setEditAplicarInteres] = useState(false);
  const [editTasaInteres, setEditTasaInteres] = useState('');
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
    if (!raw) return 'Tractor';
    if (lang === 'en') {
      const norm = raw.toLowerCase();
      if (norm === 'cosechadora') return 'Harvester';
      if (norm === 'fumigadora' || norm === 'pulverizadora') return 'Sprayer';
      if (norm === 'sembradora') return 'Planter';
      if (norm === 'camión' || norm === 'camion') return 'Truck';
      if (norm === 'otro') return 'Other';
    }
    return raw;
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
      setErrorMsg(
        bi(
          'Debes seleccionar o activar una campaña antes de registrar trabajos.',
          'You must select or activate a campaign before recording jobs.'
        )
      );
      return;
    }

    if (!selectedMachineId) {
      setErrorMsg(bi('Por favor selecciona una maquinaria.', 'Please select a machine.'));
      return;
    }

    if (tipoTrabajo === 'propiedad' && !selectedLotId) {
      setErrorMsg(
        bi('Para trabajos en propiedad, el Lote es obligatorio.', 'For farm jobs, the lot is required.')
      );
      return;
    }

    if (!cantidad || cantidad <= 0) {
      setErrorMsg(
        bi('La cantidad trabajada debe ser mayor a 0.', 'Quantity worked must be greater than 0.')
      );
      return;
    }

    if (tipoTrabajo === 'tercero' && !clienteId && !clientePendiente) {
      setErrorMsg(
        bi(
          'Selecciona un cliente del catálogo o marca «Cliente pendiente».',
          'Select a customer from the catalog or choose "Pending customer".'
        )
      );
      return;
    }

    const parsedPlazoDias =
      tipoTrabajo === 'tercero' && jobPlazoDias.trim() !== ''
        ? Math.max(0, Math.round(Number(jobPlazoDias)))
        : null;
    const parsedTasa =
      tipoTrabajo === 'tercero' && jobAplicarInteres && jobTasaInteres.trim() !== ''
        ? parseDecimalNumber(jobTasaInteres)
        : null;

    if (tipoTrabajo === 'tercero' && jobAplicarInteres && (!parsedTasa || parsedTasa <= 0)) {
      setErrorMsg(
        bi(
          'Ingresa un porcentaje de interés mensual mayor a 0 o desactiva el interés por mora.',
          'Enter a monthly interest percentage greater than 0 or disable late-payment interest.'
        )
      );
      return;
    }

    const tcNum = parseDecimalNumber(jobTc);
    if (tcNum <= 0) {
      setErrorMsg(
        bi('Ingresa un tipo de cambio válido mayor a 0.', 'Enter a valid exchange rate greater than 0.')
      );
      return;
    }

    const machineObj = machines.find((m) => m.id === selectedMachineId);
    const lotObj = lots.find((l) => l.id === selectedLotId);
    const customerObj = clienteId ? customersById.get(String(clienteId)) : null;
    const computedDueDate =
      tipoTrabajo === 'tercero'
        ? jobFechaVencimiento || (parsedPlazoDias !== null ? addDaysToIso(fecha, parsedPlazoDias) : '')
        : '';

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
        clienteId: tipoTrabajo === 'tercero' && customerObj ? customerObj.id : undefined,
        clientePendiente: tipoTrabajo === 'tercero' ? Boolean(!customerObj || clientePendiente) : false,
        cliente: tipoTrabajo === 'tercero' && customerObj ? customerObj.nombre : undefined,
        plazoDias: tipoTrabajo === 'tercero' ? (parsedPlazoDias ?? undefined) : undefined,
        fechaVencimiento: tipoTrabajo === 'tercero' && computedDueDate ? computedDueDate : undefined,
        aplicarInteres: tipoTrabajo === 'tercero' ? jobAplicarInteres : false,
        tasaInteresMensual: tipoTrabajo === 'tercero' && jobAplicarInteres ? (parsedTasa ?? undefined) : undefined,
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
          ? bi(
              'Servicio para otros guardado exitosamente (+ Ingreso Maquinarias).',
              'External service saved successfully (+ Machinery Income).'
            )
          : bi(
              'Trabajo en propiedad guardado (+ Ingreso Maquinarias y − Gasto en Lote).',
              'Farm job saved (+ Machinery Income and − Lot Expense).'
            )
      );

      resetNewServiceForm();
      setCurrentScreen('main');
      onRefreshData('jobs');
      if (tipoTrabajo === 'tercero') {
        invalidateQueries(['cobros.', 'ar.']);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? translateError(err.message) : bi('Error al guardar el trabajo', 'Error saving job')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!activeCampaign) {
      setErrorMsg(
        bi(
          'Debes activar una campaña antes de registrar gastos.',
          'You must activate a campaign before recording expenses.'
        )
      );
      return;
    }

    if (!expItemGasto.trim()) {
      setErrorMsg(bi('Por favor selecciona un concepto de gasto.', 'Please select an expense concept.'));
      return;
    }

    if (!expPrecio || expPrecio <= 0) {
      setErrorMsg(bi('Ingresa un precio unitario válido.', 'Enter a valid unit price.'));
      return;
    }

    const tcNum = parseDecimalNumber(expTc);
    if (tcNum <= 0) {
      setErrorMsg(
        bi('Ingresa un tipo de cambio válido mayor a 0.', 'Enter a valid exchange rate greater than 0.')
      );
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

      setSuccessMsg(
        bi('Gasto de maquinaria registrado exitosamente.', 'Machinery expense recorded successfully.')
      );
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
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al registrar el gasto', 'Error recording expense')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditJob = (j: MachineryJob, preloadedCuenta?: CobroCuenta | null) => {
    if (!effectiveIsAdmin) {
      setErrorMsg(
        bi(
          'Solo el Administrador puede editar servicios guardados.',
          'Only the Administrator can edit saved services.'
        )
      );
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
    const matchedCustById = j.clienteId ? customersById.get(String(j.clienteId)) : null;
    const matchedCustByName =
      !matchedCustById && j.cliente
        ? customers.find((c) => c.nombre.trim().toLowerCase() === j.cliente!.trim().toLowerCase())
        : null;
    const resolvedCust = matchedCustById || matchedCustByName || null;
    setEditClienteId(resolvedCust?.id || j.clienteId || '');
    setEditClientePendiente(
      dest === 'tercero' ? Boolean(j.clientePendiente || (!resolvedCust && !j.clienteId)) : false
    );
    setEditCliente(resolvedCust?.nombre || j.cliente || '');
    setEditPlazoDias(
      j.plazoDias !== null && j.plazoDias !== undefined ? String(j.plazoDias) : ''
    );
    setEditFechaVencimiento(j.fechaVencimiento ? toYYYYMMDD(j.fechaVencimiento) : '');
    setEditAplicarInteres(Boolean(j.aplicarInteres));
    setEditTasaInteres(
      j.tasaInteresMensual !== null && j.tasaInteresMensual !== undefined
        ? String(j.tasaInteresMensual)
        : ''
    );
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
    const cachedCuenta = cachedEstado || preloadedCuenta || null;
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

  const handleSaveEditJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;
    if (!effectiveIsAdmin) {
      setEditJobError(
        bi(
          'Solo el Administrador puede modificar servicios guardados.',
          'Only the Administrator can edit saved services.'
        )
      );
      return;
    }
    setEditJobError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetCampanaId = editCampanaId || editingJob.campanaId || activeCampaign?.id || '';
    if (!targetCampanaId) {
      setEditJobError(bi('Selecciona una campaña.', 'Select a campaign.'));
      return;
    }
    if (!editMachineId) {
      setEditJobError(bi('Selecciona una maquinaria.', 'Select a machine.'));
      return;
    }
    const hasRegisteredCobros =
      Boolean(editJobCobroCuenta) &&
      ((editJobCobroCuenta?.cobrado ?? 0) > 0.005 || (editJobCobroCuenta?.pagos?.length ?? 0) > 0);
    if (hasRegisteredCobros && editTipoTrabajo !== 'tercero') {
      setEditJobError(
        bi(
          'Este servicio ya tiene cobros registrados y no puede cambiarse a Propiedad propia.',
          'This service already has recorded payments and cannot be switched to Own farm.'
        )
      );
      return;
    }
    if (editTipoTrabajo === 'propiedad' && !editLotId) {
      setEditJobError(
        bi('Para trabajos en propiedad, el lote es obligatorio.', 'For farm jobs, the lot is required.')
      );
      return;
    }
    if (editTipoTrabajo === 'tercero' && !editClienteId && !editClientePendiente) {
      setEditJobError(
        bi(
          'Selecciona un cliente del catálogo o marca «Cliente pendiente».',
          'Select a customer from the catalog or choose "Pending customer".'
        )
      );
      return;
    }
    if (!editCantidad || Number(editCantidad) <= 0) {
      setEditJobError(
        bi('La cantidad trabajada debe ser mayor a 0.', 'Quantity worked must be greater than 0.')
      );
      return;
    }
    const tcNum = parseDecimalNumber(editTc);
    if (tcNum <= 0) {
      setEditJobError(
        bi('Ingresa un tipo de cambio válido mayor a 0.', 'Enter a valid exchange rate greater than 0.')
      );
      return;
    }

    const parsedEditPlazo =
      editTipoTrabajo === 'tercero' && editPlazoDias.trim() !== ''
        ? Math.max(0, Math.round(Number(editPlazoDias)))
        : null;
    const parsedEditTasa =
      editTipoTrabajo === 'tercero' && editAplicarInteres && editTasaInteres.trim() !== ''
        ? parseDecimalNumber(editTasaInteres)
        : null;

    if (editTipoTrabajo === 'tercero' && editAplicarInteres && (!parsedEditTasa || parsedEditTasa <= 0)) {
      setEditJobError(
        bi(
          'Ingresa un porcentaje de interés mensual mayor a 0 o desactiva el interés por mora.',
          'Enter a monthly interest percentage greater than 0 or disable late-payment interest.'
        )
      );
      return;
    }

    const machineObj = machines.find((m) => m.id === editMachineId);
    const lotObj = lots.find((l) => l.id === editLotId);
    const editCustomerObj = editClienteId ? customersById.get(String(editClienteId)) : null;
    const computedEditDue =
      editTipoTrabajo === 'tercero'
        ? editFechaVencimiento || (parsedEditPlazo !== null ? addDaysToIso(editFecha, parsedEditPlazo) : '')
        : '';
    const cantNum = Number(editCantidad);
    const tarifaNum = Number(editTarifa) || 0;
    const totalNum = Number((cantNum * tarifaNum).toFixed(2));
    const totalUsdNum =
      editMoneda === 'USD' ? totalNum : Number((totalNum / tcNum).toFixed(2));

    if (hasRegisteredCobros && editJobCobroCuenta && totalUsdNum + 0.005 < editJobCobroCuenta.cobrado) {
      setEditJobError(
        bi(
          `El nuevo importe total (USD ${totalUsdNum.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) no puede ser menor al monto ya cobrado (USD ${editJobCobroCuenta.cobrado.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`,
          `The new total amount (USD ${totalUsdNum.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) cannot be less than the amount already collected (USD ${editJobCobroCuenta.cobrado.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
        )
      );
      return;
    }

    setSaving(true);
    try {
      await updateMachineryJob(editingJob.id, {
        campanaId: targetCampanaId,
        fecha: editFecha,
        maquinariaId: editMachineId,
        maquinariaNombre: machineObj?.nombre || editingJob.maquinariaNombre,
        trabajoTipoId: editJobTypeId,
        trabajoNombre: editJobNombre,
        tipoTrabajo: editTipoTrabajo,
        clienteId: editTipoTrabajo === 'tercero' && editCustomerObj ? editCustomerObj.id : '',
        clientePendiente: editTipoTrabajo === 'tercero' ? Boolean(!editCustomerObj || editClientePendiente) : false,
        cliente: editTipoTrabajo === 'tercero' && editCustomerObj ? editCustomerObj.nombre : '',
        plazoDias: editTipoTrabajo === 'tercero' ? (parsedEditPlazo ?? undefined) : undefined,
        fechaVencimiento: editTipoTrabajo === 'tercero' ? computedEditDue : '',
        aplicarInteres: editTipoTrabajo === 'tercero' ? editAplicarInteres : false,
        tasaInteresMensual: editTipoTrabajo === 'tercero' && editAplicarInteres ? (parsedEditTasa ?? undefined) : undefined,
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
      setSuccessMsg(
        bi('Servicio de maquinaria actualizado exitosamente.', 'Machinery service updated successfully.')
      );
      setEditingJob(null);
      setEditJobCobroCuenta(null);
      onRefreshData('jobs');
      if (editTipoTrabajo === 'tercero' || editingJob.tipoTrabajo === 'tercero') {
        invalidateQueries(['cobros.', 'ar.']);
      }
    } catch (err: unknown) {
      setEditJobError(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al actualizar el servicio', 'Error updating service')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) return;
    if (!effectiveIsAdmin) {
      setErrorMsg(
        bi(
          'Solo el Administrador puede eliminar servicios guardados.',
          'Only the Administrator can delete saved services.'
        )
      );
      setJobToDelete(null);
      return;
    }
    const wasExternal = jobToDelete.tipoTrabajo === 'tercero';
    setDeletingJob(true);
    setErrorMsg(null);
    try {
      await deleteMachineryJob(jobToDelete.id);
      setSuccessMsg(bi('Trabajo eliminado exitosamente.', 'Job deleted successfully.'));
      setJobToDelete(null);
      onRefreshData('jobs');
      if (wasExternal) {
        invalidateQueries(['cobros.', 'ar.']);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al eliminar el trabajo', 'Error deleting job')
      );
    } finally {
      setDeletingJob(false);
    }
  };

  const handleRequestDeleteExpense = (exp: Expense) => {
    if (!effectiveIsAdmin) {
      setErrorMsg(
        bi(
          'Solo el Administrador puede eliminar gastos guardados.',
          'Only the Administrator can delete saved expenses.'
        )
      );
      return;
    }
    setExpenseToDelete(exp);
  };

  const handleOpenEditExpense = (exp: Expense) => {
    if (!effectiveIsAdmin) {
      setErrorMsg(
        bi(
          'Solo el Administrador puede editar gastos guardados.',
          'Only the Administrator can edit saved expenses.'
        )
      );
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
      setEditExpError(
        bi(
          'Solo el Administrador puede modificar gastos guardados.',
          'Only the Administrator can edit saved expenses.'
        )
      );
      return;
    }
    setEditExpError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!editExpPrecio || Number(editExpPrecio) <= 0) {
      setEditExpError(bi('Ingresa un precio unitario válido.', 'Enter a valid unit price.'));
      return;
    }
    const tcNum = parseDecimalNumber(editExpTc);
    if (tcNum <= 0) {
      setEditExpError(
        bi('Ingresa un tipo de cambio válido mayor a 0.', 'Enter a valid exchange rate greater than 0.')
      );
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
      setSuccessMsg(
        bi('Gasto de maquinaria actualizado exitosamente.', 'Machinery expense updated successfully.')
      );
      setEditingExpense(null);
      onRefreshData('movements');
    } catch (err: unknown) {
      setEditExpError(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al actualizar el gasto', 'Error updating expense')
      );
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
      const resolvedMachineName = j.maquinariaNombre || machineObj?.nombre || bi('Maquinaria', 'Machinery');

      const lotObj = j.loteId ? lots.find((l) => l.id === j.loteId || (l.nombre && j.loteId && l.nombre.toLowerCase() === j.loteId.toLowerCase())) : null;
      const rawLot = j.loteNombre || lotObj?.nombre || (j.loteId ? `${bi('Lote', 'Lot')} ${j.loteId}` : null);
      const formattedLot = rawLot
        ? (String(rawLot).toLowerCase().startsWith('lote') || String(rawLot).toLowerCase().startsWith('lot ')
            ? String(rawLot)
            : `${bi('Lote', 'Lot')} ${rawLot}`)
        : bi('Lote propio', 'Own lot');

      return {
        id: j.id,
        kind: 'servicio' as const,
        tipoTrabajo: j.tipoTrabajo,
        fecha: j.fecha,
        titulo: formatConcept(j.trabajoNombre || bi('Labor de maquinaria', 'Machinery job')),
        maquinariaNombre: resolvedMachineName,
        destinoOCliente:
          j.tipoTrabajo === 'propiedad'
            ? formattedLot
            : `${bi('Cliente', 'Client')}: ${resolveJobCustomerLabel(j)}`,
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
      const resolvedMachineName = e.maquinariaNombre || machineObj?.nombre || bi('General', 'General');
      return {
        id: e.id,
        kind: 'gasto' as const,
        fecha: e.fecha,
        titulo: formatConcept(e.itemGasto || bi('Gasto', 'Expense')),
        maquinariaNombre: resolvedMachineName,
        destinoOCliente: resolvedMachineName,
        cantidadTexto: e.cantidad ? `${e.cantidad} ${translateUnit(e.unidad) || ''}`.trim() : undefined,
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
            aria-label={bi('Volver a Maquinarias', 'Back to Machinery')}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white border border-slate-200 flex items-center justify-center gap-1.5 text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-800 shrink-0" />
            <span className="text-sm font-semibold text-slate-800">{t('common.back')}</span>
          </button>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
            {currentScreen === 'historial' && bi('Historial', 'History')}
            {currentScreen === 'resumen' && bi('Mis máquinas', 'My machinery')}
            {currentScreen === 'gasto' && bi('Registrar gasto', 'Record expense')}
            {(currentScreen === 'servicio' ||
              currentScreen === 'ingreso_opciones' ||
              currentScreen === 'servicio_otros' ||
              currentScreen === 'trabajo_propiedad') &&
              bi('Registrar servicio', 'Record service')}
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
          <section className="space-y-2.5" aria-label={bi('Registrar movimiento de maquinarias', 'Record machinery movement')}>
            <h2 className="text-sm font-bold text-slate-600 px-0.5">
              {bi('Registrar', 'Record')}
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
                    {bi('Servicio', 'Service')}
                  </span>
                </div>
                <span className="text-[11px] text-white/90 font-medium text-center leading-tight">
                  {bi('Servicio o labor', 'Service or job')}
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
                    {bi('Gasto', 'Expense')}
                  </span>
                </div>
                <span className="text-[11px] text-white/90 font-medium text-center leading-tight">
                  {bi('Combustible y repuestos', 'Fuel and spare parts')}
                </span>
              </button>
            </div>
          </section>

          {/* SECCIÓN B: CONSULTAR */}
          <section className="space-y-2.5" aria-label={bi('Consultar registros de maquinarias', 'View machinery records')}>
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
                      {allMachineryMovements.length}{' '}
                      {allMachineryMovements.length === 1
                        ? bi('movimiento', 'movement')
                        : bi('movimientos', 'movements')}
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
                      {bi('Mis máquinas', 'My machinery')}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
                      {machines.length}{' '}
                      {machines.length === 1 ? bi('máquina', 'machine') : bi('máquinas', 'machines')}
                      {machineJobTypes.filter((j) => !isVirtualMachineOnlyImplement(j.nombre)).length > 0 && (
                        <>
                          {' · '}
                          {machineJobTypes.filter((j) => !isVirtualMachineOnlyImplement(j.nombre)).length}{' '}
                          {machineJobTypes.filter((j) => !isVirtualMachineOnlyImplement(j.nombre)).length === 1
                            ? bi('implemento', 'implement')
                            : bi('implementos', 'implements')}
                        </>
                      )}
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
                    {bi('Fecha', 'Date')} <span className="text-[#C44545]">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-[#64746B] pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => {
                        const nextDate = e.target.value;
                        setFecha(nextDate);
                        if (jobPlazoDias.trim() !== '' && !isNaN(Number(jobPlazoDias))) {
                          setJobFechaVencimiento(addDaysToIso(nextDate, Number(jobPlazoDias)));
                        }
                      }}
                      className={`${FORM_INPUT_CLASS} pl-9`}
                    />
                  </div>
                </div>

                {/* 2. Máquina (obligatoria) */}
                <VisualMachinePicker
                  label={bi('Máquina', 'Machine')}
                  machines={activeMachines}
                  selectedMachineId={selectedMachineId}
                  onSelectMachine={(m) => handleMachineChange(m.id)}
                  required
                />

                {/* 3. Implemento agrícola (opcional, filtrado por tipo de máquina) */}
                {selectedMachineId && (
                  <VisualJobTypePicker
                    label={bi('Implemento agrícola', 'Agricultural implement')}
                    optionalText={t('common.optional')}
                    jobTypes={compatibleImplements}
                    selectedJobTypeId={selectedJobTypeId}
                    onSelectJobType={(j) => handleImplementSelect(j)}
                    allowNone
                    noneLabel={
                      selectedMachineObj
                        ? bi(
                            `Sin implemento (tarifa de ${selectedMachineObj.nombre})`,
                            `No implement (${selectedMachineObj.nombre} rate)`
                          )
                        : bi('Sin implemento', 'No implement')
                    }
                  />
                )}

                {/* 4. Destino (Propiedad propia / Cliente externo) */}
                <Switch<'propiedad' | 'tercero'>
                  label={bi('Destino', 'Destination')}
                  required
                  value={serviceDestino}
                  onChange={(nextDest) => {
                    setServiceDestino(nextDest);
                    if (nextDest === 'propiedad') {
                      if (selectedLotId && isHectareUnit(unidad)) {
                        const ha = getLotSurfaceHa(lots, selectedLotId);
                        if (ha !== null) setCantidad(ha);
                      }
                    } else {
                      if (!jobPlazoDias && !jobFechaVencimiento && !jobAplicarInteres && !jobTasaInteres) {
                        preloadPaymentDefaultsForNewService(fecha);
                      }
                    }
                  }}
                  leftOption={{ value: 'propiedad', label: bi('Propiedad propia', 'Own farm') }}
                  rightOption={{ value: 'tercero', label: bi('Cliente externo', 'External client') }}
                />

                {/* 5. Lote (si Propiedad) o Cliente del catálogo (si Externo) */}
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
                    label={bi('Lote', 'Lot')}
                    required
                  />
                ) : (
                  <div className="space-y-3">
                    <CustomerPicker
                      label={bi('Cliente', 'Customer')}
                      customers={customers}
                      selectedCustomerId={clienteId}
                      isPending={clientePendiente}
                      allowPending
                      pendingLabel={t('customers.pendingClient')}
                      required
                      onSelectCustomer={(c) => {
                        setClienteId(c.id);
                        setCliente(c.nombre);
                        setClientePendiente(false);
                      }}
                      onSelectPending={() => {
                        setClienteId('');
                        setCliente('');
                        setClientePendiente(true);
                      }}
                    />

                    {/* Condiciones de cobro (precargadas de Configuración de cobros, editables individualmente) */}
                    <div className="rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] p-3 space-y-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#5E6D64]">
                        {bi('Condiciones de cobro', 'Payment terms')}
                      </p>
                      <div className="grid grid-cols-2 gap-2.5 items-end">
                        <div>
                          <label className={FORM_LABEL_CLASS}>
                            {bi('Plazo (días)', 'Term (days)')}
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            placeholder="0"
                            value={jobPlazoDias}
                            onChange={(e) => {
                              const val = e.target.value;
                              setJobPlazoDias(val);
                              if (val.trim() !== '' && !isNaN(Number(val))) {
                                setJobFechaVencimiento(addDaysToIso(fecha, Number(val)));
                              } else {
                                setJobFechaVencimiento('');
                              }
                            }}
                            className={`${FORM_INPUT_CLASS} tabular-nums`}
                          />
                        </div>
                        <div>
                          <label className={FORM_LABEL_CLASS}>
                            {bi('Vencimiento', 'Due date')}
                          </label>
                          <input
                            type="date"
                            value={jobFechaVencimiento}
                            onChange={(e) => setJobFechaVencimiento(e.target.value)}
                            className={FORM_INPUT_CLASS}
                          />
                        </div>
                      </div>
                      <div className="pt-1 border-t border-[#E2E7E3] space-y-2.5">
                        <Switch<boolean>
                          inline
                          label={bi('Aplicar interés por mora', 'Apply late interest')}
                          value={jobAplicarInteres}
                          onChange={setJobAplicarInteres}
                        />
                        {jobAplicarInteres && (
                          <div>
                            <label className={`${FORM_LABEL_CLASS} whitespace-nowrap truncate`}>
                              {bi('Interés mensual (%)', 'Monthly interest (%)')}
                              <span className="text-[#C44545] ml-0.5">*</span>
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0.01"
                              placeholder="0.00"
                              value={jobTasaInteres}
                              onChange={(e) => setJobTasaInteres(e.target.value)}
                              className={`${FORM_INPUT_CLASS} tabular-nums`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Cantidad y Unidad */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div className="min-w-0">
                    <label className={`${FORM_LABEL_CLASS} whitespace-nowrap truncate`}>
                      {bi('Cantidad', 'Quantity')}
                      <span className="text-[#C44545] ml-0.5">*</span>
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
                    label={bi('Unidad', 'Unit')}
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
                    <option value="hora">{bi('Horas', 'Hours')}</option>
                    <option value="hectarea">{bi('Hectáreas', 'Hectares')}</option>
                  </AppSelect>
                </div>

                {/* 7. Tarifa y Moneda */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div className="min-w-0">
                    <label className={`${FORM_LABEL_CLASS} whitespace-nowrap truncate`}>
                      {unidad === 'hectarea'
                        ? bi('Tarifa / ha', 'Rate / ha')
                        : bi('Tarifa / hora', 'Rate / hour')}
                      <span className="text-[#C44545] ml-0.5">*</span>
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
                    label={bi('Moneda', 'Currency')}
                    required
                    value={jobMoneda}
                    onChange={handleJobCurrencyChange}
                  />
                </div>

                {/* Tipo de cambio editable */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Tipo de cambio (Bs/USD)', 'Exchange rate (Bs/USD)')}{' '}
                    <span className="text-[#C44545]">*</span>
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
                  <span className="text-[13px] font-bold text-[#175B3D]">
                    {bi('Importe total', 'Total amount')}
                  </span>
                  <span className="text-base font-extrabold text-[#175B3D] tabular-nums">
                    {jobMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                    {calculatedTotal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 9. Observación (opcional) con dictado por voz */}
                <ObservationField
                  value={observacion}
                  onChange={setObservacion}
                  optional
                  placeholder={bi('Notas del servicio...', 'Service notes...')}
                />

                {/* Botón Guardar */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#24875B] hover:bg-[#1D704B] active:bg-[#175B3D] text-white font-bold h-[42px] text-sm shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>{saving ? t('common.saving') : bi('Guardar servicio', 'Save service')}</span>
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
                label={bi('Máquina', 'Machine')}
                optionalText={t('common.optional')}
                machines={machines}
                selectedMachineId={expMachineId}
                onSelectMachine={(m) => setExpMachineId(m.id)}
                allowNone
                noneLabel={bi('Gasto general (sin máquina)', 'General expense (no machine)')}
              />

              {/* Concepto de Gasto */}
              <VisualExpenseItemPicker
                label={bi('Concepto de gasto', 'Expense concept')}
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
                    min="0.1"
                    placeholder="1"
                    value={expCantidad}
                    onChange={(e) => setExpCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
                <div>
                  <label className={FORM_LABEL_CLASS}>{bi('Unidad', 'Unit')}</label>
                  <input
                    type="text"
                    value={expUnidad}
                    onChange={(e) => setExpUnidad(e.target.value)}
                    placeholder={bi('litros, piezas, horas', 'liters, parts, hours')}
                    className={FORM_INPUT_CLASS}
                  />
                </div>
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
                  {bi('Tipo de cambio (Bs/USD)', 'Exchange rate (Bs/USD)')}{' '}
                  <span className="text-[#C44545]">*</span>
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
                <span className="text-[13px] font-bold text-[#9F2D2D]">
                  {bi('Importe total', 'Total amount')}
                </span>
                <span className="text-base font-extrabold text-[#9F2D2D] tabular-nums">
                  {expMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                  {expCalculatedTotal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Observación con dictado por voz */}
              <ObservationField
                value={expObservacion}
                onChange={setExpObservacion}
                optional
                placeholder={bi('Factura, proveedor, detalle...', 'Invoice, supplier, details...')}
              />

              {/* Botón Guardar */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#C44545] hover:bg-[#A93838] active:bg-[#8E2D2D] text-white font-bold h-[42px] text-sm shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-4 w-4 shrink-0" />
                <span>{saving ? t('common.saving') : bi('Guardar gasto', 'Save expense')}</span>
              </button>
            </form>
          </div>

          {/* Lista de gastos recientes */}
          <div className="space-y-2.5">
            <ListToolbar
              title={bi('Gastos de Maquinarias', 'Machinery Expenses')}
              countLabel={`${machineryExpenses.length} ${bi('reg.', 'rec.')}`}
            />

            <CompactList
              isEmpty={machineryExpenses.length === 0}
              emptyMessage={bi(
                'No hay gastos de maquinaria registrados en esta campaña.',
                'No machinery expenses recorded in this campaign.'
              )}
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
                      {formatDateDDMMAAAA(exp.fecha)} · {exp.maquinariaNombre || bi('Gasto general', 'General expense')} · {exp.cantidad} {translateUnit(exp.unidad)}
                      {exp.observacion ? ` · ${exp.observacion}` : ''}
                    </span>
                  }
                  rightPrimary={
                    <span className="text-[#C44545] tabular-nums">
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
                          title={bi('Editar gasto', 'Edit expense')}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestDeleteExpense(exp)}
                          className="p-1.5 text-[#7A8780] hover:text-[#C44545] hover:bg-[#FCECEC] rounded-lg transition cursor-pointer"
                          title={bi('Eliminar gasto', 'Delete expense')}
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
            title={bi('Historial', 'History')}
            countLabel={`${filteredMachineryMovements.length} ${bi('reg.', 'rec.')}`}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={bi('Buscar por labor, cliente, lote o máquina...', 'Search by job, client, lot, or machine...')}
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
                ariaLabel={bi('Filtrar movimientos por tipo', 'Filter movements by type')}
                options={[
                  { value: 'todos', label: bi('Todos', 'All') },
                  { value: 'ingresos', label: bi('Ingresos', 'Income') },
                  { value: 'gastos', label: bi('Gastos', 'Expenses') },
                ]}
              />
            }
          />

          <CompactList
            isEmpty={filteredMachineryMovements.length === 0}
            emptyMessage={bi('No hay movimientos registrados.', 'No movements recorded.')}
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
                          {isService ? ` · ${bi('Terceros', 'External')}` : ''}
                        </span>
                      )}
                    </span>
                  }
                  rightPrimary={
                    <span className={`tabular-nums ${isService ? 'text-[#24875B]' : 'text-[#C44545]'}`}>
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
                          <span className="text-[#5E6D64] font-medium">{bi('Maquinaria', 'Machinery')}</span>
                          <span className="font-semibold text-[#26352D] text-right">
                            {m.maquinariaNombre || '—'}
                          </span>
                        </div>
                        {m.tipoTrabajo === 'propiedad' ? (
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">{bi('Lote', 'Lot')}</span>
                            <span className="font-semibold text-[#24875B] text-right">
                              {m.destinoOCliente || '—'}
                            </span>
                          </div>
                        ) : (
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium">
                              {bi('Destino / Cliente', 'Destination / Client')}
                            </span>
                            <span className="font-semibold text-[#26352D] text-right">
                              {m.destinoOCliente || '—'}
                            </span>
                          </div>
                        )}
                        <div className="py-1.5 flex items-center justify-between gap-2">
                          <span className="text-[#5E6D64] font-medium">
                            {isService ? bi('Tarifa', 'Rate') : bi('Precio', 'Price')}
                          </span>
                          <span className="font-semibold text-[#26352D] tabular-nums text-right">
                            {m.tarifaOPrecio !== undefined && m.tarifaOPrecio !== null
                              ? `${m.moneda === 'USD' ? 'USD' : 'Bs'} ${m.tarifaOPrecio.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${translateUnit(m.unidad) || bi('unidad', 'unit')}`
                              : '—'}
                          </span>
                        </div>
                        <div className="py-1.5 flex items-center justify-between gap-2">
                          <span className="text-[#5E6D64] font-medium">{bi('Equivalencia', 'Equivalent')}</span>
                          <span className="tabular-nums font-semibold text-[#26352D] text-right">
                            {m.tipoCambio && m.tipoCambio > 0
                              ? m.moneda === 'USD'
                                ? `Bs ${(m.total * m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bi('TC', 'FX')}: ${formatTC(m.tipoCambio)})`
                                : `USD ${(m.total / m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bi('TC', 'FX')}: ${formatTC(m.tipoCambio)})`
                              : '—'}
                          </span>
                        </div>
                        {getCleanObservation(m.observacion, m.titulo) && (
                          <div className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[#5E6D64] font-medium shrink-0">
                              {bi('Observación', 'Observation')}
                            </span>
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
                                {t('common.edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setJobToDelete(m.rawJob!)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#FCECEC] hover:bg-[#F7DCDC] text-[#C44545] font-semibold text-xs transition cursor-pointer border border-[#F2C6C6] min-h-[34px]"
                              >
                                {t('common.delete')}
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
                                {t('common.edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteExpense(m.rawExpense!)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#FCECEC] hover:bg-[#F7DCDC] text-[#C44545] font-semibold text-xs transition cursor-pointer border border-[#F2C6C6] min-h-[34px]"
                              >
                                {t('common.delete')}
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 pt-2 border-t border-[#E6EBE7] text-[11px] text-[#7A8780]">
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {bi(
                              'Solo el Administrador puede editar o eliminar registros guardados.',
                              'Only the Administrator can edit or delete saved records.'
                            )}
                          </span>
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
              title={bi('Mis máquinas', 'My machinery')}
              countLabel={`${filteredSummaryMachines.length + filteredImplements.length}`}
              searchValue={machinesSearch}
              onSearchChange={setMachinesSearch}
              searchPlaceholder={bi('Buscar máquina o implemento...', 'Search machine or implement...')}
              filters={
                <CompactFilter
                  value={machinesStatusFilter}
                  onChange={(val) =>
                    setMachinesStatusFilter(val as 'activos' | 'desactivados' | 'todos')
                  }
                  ariaLabel={bi('Filtrar estado', 'Filter status')}
                  options={[
                    { value: 'activos', label: bi('Activos', 'Active') },
                    { value: 'desactivados', label: bi('Desactivados', 'Inactive') },
                    { value: 'todos', label: bi('Todos', 'All') },
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
                    {bi('Máquinas', 'Machines')} ({filteredSummaryMachines.length})
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
                      ? bi('No se encontraron máquinas con esa búsqueda.', 'No machines found for that search.')
                      : machinesStatusFilter === 'desactivados'
                      ? bi('No hay máquinas desactivadas.', 'No inactive machines.')
                      : bi('No hay máquinas registradas.', 'No machines registered.')
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
                          <span className="text-[#26352D] tabular-nums">
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
                            {!isActive
                              ? bi('Inactivo', 'Inactive')
                              : isMaintenance
                              ? bi('Mantenim.', 'Maint.')
                              : bi('Operativo', 'Operational')}
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
                                  {bi('Horas', 'Hours')}
                                </span>
                                <span className="text-xs font-bold text-[#26352D] tabular-nums">
                                  {hrs.toFixed(1)} h
                                </span>
                              </div>
                              <div className="px-1">
                                <span className="text-[10px] text-[#7A8780] font-semibold block uppercase">
                                  {bi('Hectáreas', 'Hectares')}
                                </span>
                                <span className="text-xs font-bold text-[#26352D] tabular-nums">
                                  {ha.toFixed(1)} ha
                                </span>
                              </div>
                              <div className="px-1">
                                <span className="text-[10px] text-[#7A8780] font-semibold block uppercase">
                                  {bi('Servicios', 'Services')}
                                </span>
                                <span className="text-xs font-bold text-[#26352D] tabular-nums">
                                  {machineJobs.length}
                                </span>
                              </div>
                            </div>

                            {/* Ficha de máquina */}
                            <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF]">
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">
                                  {bi('Tarifa propia', 'Own rate')}
                                </span>
                                <span className="tabular-nums font-semibold text-[#26352D]">
                                  {m.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                  {Number(m.tarifa || 0).toLocaleString('es-BO', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  / {unitLabel}
                                </span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">
                                  {bi('Valor patrimonial', 'Asset value')}
                                </span>
                                <span className="tabular-nums font-semibold text-[#26352D]">
                                  {assetInfo
                                    ? `${assetInfo.moneda === 'USD' ? 'USD' : 'Bs'} ${assetInfo.valor.toLocaleString('es-BO', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                    : bi('No registrado', 'Not registered')}
                                </span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">{bi('Estado', 'Status')}</span>
                                <span className="font-semibold text-[#26352D]">
                                  {!isActive
                                    ? bi('Inactivo', 'Inactive')
                                    : isMaintenance
                                    ? bi('En mantenimiento', 'In maintenance')
                                    : bi('Operativo', 'Operational')}
                                </span>
                              </div>
                            </div>

                            {/* Historial de trabajos realizados */}
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-semibold text-[#5E6D64]">
                                {bi('Historial de trabajos realizados', 'Completed jobs history')} ({machineJobs.length})
                              </p>
                              {machineJobs.length > 0 ? (
                                <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
                                  {machineJobs.slice(0, 10).map((j) => {
                                    const lotObj = j.loteId
                                      ? lots.find((l) => l.id === j.loteId)
                                      : null;
                                    const destLabel =
                                      j.tipoTrabajo === 'propiedad'
                                        ? j.loteNombre || lotObj?.nombre || bi('Lote propio', 'Own lot')
                                        : j.cliente || bi('Cliente externo', 'External client');
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
                                        <span className="text-xs font-bold text-[#24875B] tabular-nums shrink-0">
                                          {formatMoney(j.total, (j.moneda as Currency) || 'BOB')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="px-3 py-2.5 text-xs text-[#7A8780] bg-white rounded-xl border border-[#E2E7E3]">
                                  {bi(
                                    'Sin trabajos registrados en esta campaña.',
                                    'No jobs recorded in this campaign.'
                                  )}
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
                    {bi('Implementos agrícolas', 'Agricultural implements')} ({filteredImplements.length})
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
                      ? bi('No se encontraron implementos con esa búsqueda.', 'No implements found for that search.')
                      : machinesStatusFilter === 'desactivados'
                      ? bi('No hay implementos desactivados.', 'No inactive implements.')
                      : bi('No hay implementos agrícolas registrados.', 'No agricultural implements registered.')
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
                        subtitle={<span>{bi('Compatible', 'Compatible')}: {compatType}</span>}
                        rightPrimary={
                          <span className="text-[#24875B] tabular-nums">
                            {jt.moneda === 'USD' ? 'USD' : 'Bs'} {jt.tarifa}/{uLabel}
                          </span>
                        }
                        rightSecondary={
                          <span className={isActive ? 'text-[#24875B] font-semibold' : 'text-[#7A8780]'}>
                            {isActive ? bi('Activo', 'Active') : bi('Inactivo', 'Inactive')}
                          </span>
                        }
                        isExpanded={isExpanded}
                        onClick={() => setExpandedImplementId(isExpanded ? null : jt.id)}
                        expandedContent={
                          <div className="space-y-3 text-xs">
                            <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF]">
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">
                                  {bi('Tipo de máquina compatible', 'Compatible machine type')}
                                </span>
                                <span className="font-semibold text-[#26352D]">{compatType}</span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">
                                  {bi('Tarifa propia', 'Own rate')}
                                </span>
                                <span className="tabular-nums font-semibold text-[#24875B]">
                                  {jt.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                  {Number(jt.tarifa || 0).toLocaleString('es-BO', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{' '}
                                  / {uLabel}
                                </span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">
                                  {bi('Unidad de cobro', 'Billing unit')}
                                </span>
                                <span className="font-semibold text-[#26352D]">
                                  {uLabel === 'ha' ? bi('Hectárea (ha)', 'Hectare (ha)') : bi('Hora (h)', 'Hour (h)')}
                                </span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-[#5E6D64] font-medium">
                                  {bi('Valor patrimonial', 'Asset value')}
                                </span>
                                <span className="tabular-nums font-semibold text-[#26352D]">
                                  {assetInfo
                                    ? `${assetInfo.moneda === 'USD' ? 'USD' : 'Bs'} ${assetInfo.valor.toLocaleString('es-BO', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                    : bi('No registrado', 'Not registered')}
                                </span>
                              </div>
                            </div>

                            {/* Historial de trabajos realizados con este implemento */}
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-semibold text-[#5E6D64]">
                                {bi('Historial con este implemento', 'History with this implement')} ({implementJobs.length})
                              </p>
                              {implementJobs.length > 0 ? (
                                <div className="rounded-xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
                                  {implementJobs.slice(0, 10).map((j) => {
                                    const lotObj = j.loteId
                                      ? lots.find((l) => l.id === j.loteId)
                                      : null;
                                    const destLabel =
                                      j.tipoTrabajo === 'propiedad'
                                        ? j.loteNombre || lotObj?.nombre || bi('Lote propio', 'Own lot')
                                        : j.cliente || bi('Cliente externo', 'External client');
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
                                            {j.maquinariaNombre || bi('Máquina', 'Machine')} · {destLabel}
                                          </p>
                                          <p className="text-[11px] text-[#7A8780] truncate">
                                            {formatDateDDMMAAAA(j.fecha)} · {j.cantidad} {uStr}
                                          </p>
                                        </div>
                                        <span className="text-xs font-bold text-[#24875B] tabular-nums shrink-0">
                                          {formatMoney(j.total, (j.moneda as Currency) || 'BOB')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="px-3 py-2.5 text-xs text-[#7A8780] bg-white rounded-xl border border-[#E2E7E3]">
                                  {bi(
                                    'Sin trabajos registrados con este implemento en esta campaña.',
                                    'No jobs recorded with this implement in this campaign.'
                                  )}
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
                    {bi('Editar servicio', 'Edit service')}
                  </h3>
                  {hasRegisteredCobros && (
                    <p className="text-[11px] text-[#24875B] font-semibold mt-0.5">
                      {bi(
                        `Conserva ${editJobCobroCuenta?.pagos?.length || 1} cobro(s) registrado(s)`,
                        `Keeps ${editJobCobroCuenta?.pagos?.length || 1} recorded payment(s)`
                      )}
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
                        {bi('Estado de cobro (USD)', 'Payment status (USD)')}
                      </span>
                      {loadingEditJobCobro && (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#24875B]" />
                      )}
                    </div>
                    {editJobCobroCuenta && (
                      <div className="grid grid-cols-3 divide-x divide-[#D4E6DC] text-center bg-white rounded-lg border border-[#D4E6DC] py-2">
                        <div className="px-1">
                          <span className="text-[10px] font-bold uppercase text-[#7A8780] block">
                            {bi('Total', 'Total')}
                          </span>
                          <span className="text-xs font-bold text-[#26352D] tabular-nums">
                            USD {editTotalUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="px-1">
                          <span className="text-[10px] font-bold uppercase text-[#7A8780] block">
                            {bi('Cobrado', 'Collected')}
                          </span>
                          <span className="text-xs font-bold text-[#24875B] tabular-nums">
                            USD {cobradoUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="px-1">
                          <span className="text-[10px] font-bold uppercase text-[#7A8780] block">
                            {bi('Saldo', 'Balance')}
                          </span>
                          <span className={`text-xs font-black tabular-nums ${exceedsCobradoViolation ? 'text-red-600' : 'text-amber-700'}`}>
                            USD {saldoProyectadoUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}
                    {exceedsCobradoViolation && (
                      <p className="text-[11px] font-semibold text-red-700">
                        {bi(
                          `El total del servicio no puede ser menor al monto ya cobrado (USD ${cobradoUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`,
                          `Service total cannot be less than the amount already collected (USD ${cobradoUsd.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
                        )}
                      </p>
                    )}
                  </div>
                )}

                {/* 1. Fecha y Campaña */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
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
                  <AppSelect
                    label={bi('Campaña', 'Campaign')}
                    required
                    icon={<Calendar className="h-[17px] w-[17px]" />}
                    value={editCampanaId}
                    onChange={(e) => setEditCampanaId(e.target.value)}
                  >
                    <option value="">{bi('Seleccionar campaña', 'Select campaign')}</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.activa ? `(${bi('Activa', 'Active')})` : ''}
                      </option>
                    ))}
                  </AppSelect>
                </div>

                {/* 2. Máquina */}
                <VisualMachinePicker
                  label={bi('Máquina', 'Machine')}
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
                  label={bi('Implemento agrícola', 'Agricultural implement')}
                  optionalText={t('common.optional')}
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
                      ? bi(
                          `Sin implemento (tarifa de ${editMachineObj.nombre})`,
                          `No implement (${editMachineObj.nombre} rate)`
                        )
                      : bi('Sin implemento', 'No implement')
                  }
                />

                {/* 4. Destino */}
                <div>
                  <Switch<'propiedad' | 'tercero'>
                    label={bi('Destino', 'Destination')}
                    value={editTipoTrabajo}
                    onChange={(val) => setEditTipoTrabajo(val)}
                    leftOption={{
                      value: 'propiedad',
                      label: bi('Propiedad propia', 'Own farm'),
                      disabled: hasRegisteredCobros,
                    }}
                    rightOption={{
                      value: 'tercero',
                      label: bi('Cliente externo', 'External client'),
                    }}
                  />
                  {hasRegisteredCobros && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      {bi(
                        'Bloqueado en Cliente externo porque ya existen cobros registrados.',
                        'Locked to External client because payments are already recorded.'
                      )}
                    </p>
                  )}
                </div>

                {/* 5. Lote o Cliente del catálogo */}
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
                    label={bi('Lote', 'Lot')}
                    required
                  />
                ) : (
                  <div className="space-y-3">
                    <CustomerPicker
                      label={bi('Cliente', 'Customer')}
                      customers={customers}
                      selectedCustomerId={editClienteId}
                      isPending={editClientePendiente}
                      allowPending
                      pendingLabel={t('customers.pendingClient')}
                      required
                      onSelectCustomer={(c) => {
                        setEditClienteId(c.id);
                        setEditCliente(c.nombre);
                        setEditClientePendiente(false);
                      }}
                      onSelectPending={() => {
                        setEditClienteId('');
                        setEditCliente('');
                        setEditClientePendiente(true);
                      }}
                    />

                    {/* Condiciones de cobro individuales */}
                    <div className="rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] p-3 space-y-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#5E6D64]">
                        {bi('Condiciones de cobro', 'Payment terms')}
                      </p>
                      <div className="grid grid-cols-2 gap-2.5 items-end">
                        <div>
                          <label className={FORM_LABEL_CLASS}>
                            {bi('Plazo (días)', 'Term (days)')}
                          </label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            placeholder="0"
                            value={editPlazoDias}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditPlazoDias(val);
                              if (val.trim() !== '' && !isNaN(Number(val)) && editFecha) {
                                setEditFechaVencimiento(addDaysToIso(editFecha, Number(val)));
                              } else {
                                setEditFechaVencimiento('');
                              }
                            }}
                            className={`${FORM_INPUT_CLASS} tabular-nums`}
                          />
                        </div>
                        <div>
                          <label className={FORM_LABEL_CLASS}>
                            {bi('Vencimiento', 'Due date')}
                          </label>
                          <input
                            type="date"
                            value={editFechaVencimiento}
                            onChange={(e) => setEditFechaVencimiento(e.target.value)}
                            className={FORM_INPUT_CLASS}
                          />
                        </div>
                      </div>
                      <div className="pt-1 border-t border-[#E2E7E3] space-y-2.5">
                        <Switch<boolean>
                          inline
                          label={bi('Aplicar interés por mora', 'Apply late interest')}
                          value={editAplicarInteres}
                          onChange={setEditAplicarInteres}
                        />
                        {editAplicarInteres && (
                          <div>
                            <label className={`${FORM_LABEL_CLASS} whitespace-nowrap truncate`}>
                              {bi('Interés mensual (%)', 'Monthly interest (%)')}
                              <span className="text-[#C44545] ml-0.5">*</span>
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0.01"
                              placeholder="0.00"
                              value={editTasaInteres}
                              onChange={(e) => setEditTasaInteres(e.target.value)}
                              className={`${FORM_INPUT_CLASS} tabular-nums`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Cantidad y Unidad */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div className="min-w-0">
                    <label className={`${FORM_LABEL_CLASS} whitespace-nowrap truncate`}>
                      {bi('Cantidad', 'Quantity')}
                      <span className="text-[#C44545] ml-0.5">*</span>
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
                    label={bi('Unidad', 'Unit')}
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
                    <option value="hora">{bi('Horas', 'Hours')}</option>
                    <option value="hectarea">{bi('Hectáreas', 'Hectares')}</option>
                  </AppSelect>
                </div>

                {/* 7. Tarifa y Moneda */}
                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div className="min-w-0">
                    <label className={`${FORM_LABEL_CLASS} whitespace-nowrap truncate`}>
                      {editUnidad === 'hectarea'
                        ? bi('Tarifa / ha', 'Rate / ha')
                        : bi('Tarifa / hora', 'Rate / hour')}
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
                    label={bi('Moneda', 'Currency')}
                    required
                    value={editMoneda}
                    onChange={handleEditJobCurrencyChange}
                  />
                </div>

                {/* Tipo de cambio editable */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Tipo de cambio (Bs/USD)', 'Exchange rate (Bs/USD)')}{' '}
                    <span className="text-[#C44545]">*</span>
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
                  <span className="text-[13px] font-bold text-[#175B3D]">
                    {bi('Importe total', 'Total amount')}
                  </span>
                  <span className="text-base font-extrabold text-[#175B3D] tabular-nums">
                    {editMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                    {editTotalOrig.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 9. Observación con dictado por voz */}
                <ObservationField
                  value={editObservacion}
                  onChange={setEditObservacion}
                  optional={false}
                />

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
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || exceedsCobradoViolation}
                    className="flex-1 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] active:bg-[#175B3D] text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    <span>{saving ? t('common.saving') : t('common.saveChanges')}</span>
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
                  {bi('¿Eliminar este trabajo?', 'Delete this job?')}
                </h3>
                <p className="text-xs text-slate-500">
                  {bi('Esta acción es definitiva en Google Sheets', 'This action is permanent in Google Sheets')}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm space-y-1.5">
              <p>
                <strong className="text-slate-700">{bi('Equipo:', 'Equipment:')}</strong> {jobToDelete.maquinariaNombre}
              </p>
              <p>
                <strong className="text-slate-700">{bi('Fecha:', 'Date:')}</strong> {formatDateDDMMAAAA(jobToDelete.fecha)}
              </p>
              <p>
                <strong className="text-slate-700">{bi('Destino:', 'Destination:')}</strong>{' '}
                {jobToDelete.tipoTrabajo === 'propiedad'
                  ? `${bi('Lote', 'Lot')} ${jobToDelete.loteNombre || bi('Propiedad', 'Farm')}`
                  : `${bi('Cliente', 'Client')} ${jobToDelete.cliente || bi('Externo', 'External')}`}
              </p>
              <p>
                <strong className="text-slate-700">{bi('Trabajado:', 'Worked:')}</strong> {jobToDelete.cantidad}{' '}
                {translateUnit(jobToDelete.unidad)}
              </p>
            </div>

            <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200/70">
              {bi(
                'Nota: También se anulará su ingreso contable en Maquinarias y su gasto vinculado en Propiedad si correspondía.',
                'Note: Its accounting income in Machinery and linked expense in Property (if applicable) will also be voided.'
              )}
            </p>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={deletingJob}
                onClick={() => setJobToDelete(null)}
                className="flex-1 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={deletingJob}
                onClick={handleConfirmDeleteJob}
                className="flex-1 min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer"
              >
                {deletingJob ? t('common.deleting') : bi('Confirmar Eliminación', 'Confirm Delete')}
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
                  {bi('¿Eliminar este gasto?', 'Delete this expense?')}
                </h3>
                <p className="text-xs text-slate-500">
                  {bi('Esta acción es definitiva en Google Sheets', 'This action is permanent in Google Sheets')}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm space-y-1.5">
              <p>
                <strong className="text-slate-700">{bi('Concepto:', 'Concept:')}</strong> {expenseToDelete.itemGasto}
              </p>
              <p>
                <strong className="text-slate-700">{bi('Fecha:', 'Date:')}</strong> {formatDateDDMMAAAA(expenseToDelete.fecha)}
              </p>
              {expenseToDelete.maquinariaNombre && (
                <p>
                  <strong className="text-slate-700">{bi('Equipo:', 'Equipment:')}</strong> {expenseToDelete.maquinariaNombre}
                </p>
              )}
              <p>
                <strong className="text-slate-700">{bi('Monto:', 'Amount:')}</strong> {expenseToDelete.moneda}{' '}
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
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={deletingExpense}
                onClick={async () => {
                  if (!effectiveIsAdmin) {
                    setErrorMsg(
                      bi(
                        'Solo el Administrador puede eliminar gastos guardados.',
                        'Only the Administrator can delete saved expenses.'
                      )
                    );
                    setExpenseToDelete(null);
                    return;
                  }
                  setDeletingExpense(true);
                  try {
                    await deleteExpense(expenseToDelete.id);
                    setSuccessMsg(
                      bi('Gasto de maquinaria eliminado exitosamente.', 'Machinery expense deleted successfully.')
                    );
                    setExpenseToDelete(null);
                    onRefreshData('movements');
                  } catch (err: unknown) {
                    setErrorMsg(
                      err instanceof Error
                        ? translateError(err.message)
                        : bi('Error al eliminar', 'Error deleting')
                    );
                  } finally {
                    setDeletingExpense(false);
                  }
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer"
              >
                {deletingExpense ? t('common.deleting') : bi('Eliminar Gasto', 'Delete Expense')}
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
                {bi('Editar gasto', 'Edit expense')}
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
                <label className={FORM_LABEL_CLASS}>{bi('Fecha', 'Date')}</label>
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
                label={bi('Máquina', 'Machine')}
                optionalText={t('common.optional')}
                machines={machines}
                selectedMachineId={editExpMachineId}
                onSelectMachine={(m) => setEditExpMachineId(m.id)}
                allowNone
                noneLabel={bi('Gasto general (sin máquina)', 'General expense (no machine)')}
              />

              {/* Concepto de gasto */}
              <VisualExpenseItemPicker
                label={bi('Concepto de gasto', 'Expense concept')}
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
                  <label className={FORM_LABEL_CLASS}>{bi('Cantidad', 'Quantity')}</label>
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
                  <label className={FORM_LABEL_CLASS}>{bi('Unidad', 'Unit')}</label>
                  <input
                    type="text"
                    value={editExpUnidad}
                    onChange={(e) => setEditExpUnidad(e.target.value)}
                    placeholder={bi('litros, repuestos', 'liters, spare parts')}
                    className={FORM_INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Precio y Moneda */}
              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>{bi('Precio unitario', 'Unit price')}</label>
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
                  label={bi('Moneda', 'Currency')}
                  required
                  value={editExpMoneda}
                  onChange={handleEditExpCurrencyChange}
                />
              </div>

              {/* Tipo de cambio editable */}
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Tipo de cambio (Bs/USD)', 'Exchange rate (Bs/USD)')}{' '}
                  <span className="text-[#C44545]">*</span>
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
                <span className="text-[13px] font-bold text-[#9F2D2D]">
                  {bi('Importe total', 'Total amount')}
                </span>
                <span className="text-base font-extrabold text-[#9F2D2D] tabular-nums">
                  {editExpMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                  {(
                    (typeof editExpCantidad === 'number' ? editExpCantidad : 1) *
                    (typeof editExpPrecio === 'number' ? editExpPrecio : 0)
                  ).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Observación con dictado por voz */}
              <ObservationField
                value={editExpObservacion}
                onChange={setEditExpObservacion}
                optional={false}
              />

              {/* Botones */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] active:bg-[#175B3D] text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="h-4 w-4 shrink-0" />
                  <span>{saving ? t('common.saving') : t('common.saveChanges')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
