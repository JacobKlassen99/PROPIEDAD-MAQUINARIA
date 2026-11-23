import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Calendar,
  Tractor,
  DollarSign,
  ShieldCheck,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  AlertCircle,
  LandPlot,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Wrench,
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Tag,
  Lock,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  LogOut,
  KeyRound,
  ShieldOff,
  ExternalLink,
  Coins,
  Landmark,
  FileCode,
  Users,
  Info,
  Power,
  RotateCcw,
  Save,
  TrendingDown,
} from 'lucide-react';
import {
  Campaign,
  Machine,
  MachineJobType,
  Lot,
  ItemConfig,
  Asset,
  AssetImprovement,
  ImplementItem,
  ExchangeRateConfig,
  Currency,
  UserSession,
  MachineryJob,
  Expense,
  Income,
} from '../types';
import {
  parseDecimalNumber,
  isTechnicalId,
  createCampaign,
  setActiveCampaign,
  createLot,
  updateLot,
  deleteLot,
  createMachine,
  updateMachine,
  deleteMachine,
  saveMachineJobType,
  deleteMachineJobType,
  getMachineTypes,
  isVirtualMachineOnlyImplement,
  saveExchangeRateConfig,
  refreshExchangeRateFromBcb,
  formatExchangeRateNumber,
  formatExchangeRateDate,
  getBoliviaDateString,
  getLocalDateString,
  createAsset,
  updateAsset,
  addAssetImprovement,
  updateAssetImprovement,
  deleteAssetImprovement,
  saveItemConfig,
  upsertAssetForImplement,
  revokeAdminAuthorization,
  getAdminToken,
  hasAdminAuthorization,
  authorizeAdminDevice,
  verifyAdminAuthorization,
  isAdminAuthorizationVerifiedInSession,
  changeSystemPassword,
} from '../services/backend';
import { AppsScriptModal } from '../components/AppsScriptModal';
import { ReportsView } from './ReportsView';
import { VisualIcon } from '../components/VisualIcon';
import { IconBottomSheet } from '../components/IconBottomSheet';
import { getIconDefinition } from '../services/iconCatalog';
import {
  CompactList,
  CompactListRow,
  CompactFilter,
  ListToolbar,
} from '../components/CompactListUI';
import {
  AppSelect,
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  FORM_TEXTAREA_CLASS,
} from '../components/AppSelect';
import { cacheKeys } from '../services/dataCache';
import { usePersistedMemoryState, useSwrQuery } from '../hooks/useSwrQuery';
import type { RefreshScope } from '../App';

interface Props {
  session: UserSession | null;
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  machines: Machine[];
  machineJobTypes?: MachineJobType[];
  lots: Lot[];
  jobs: MachineryJob[];
  expenses: Expense[];
  incomes: Income[];
  itemsConfig: ItemConfig[];
  assets: Asset[];
  exchangeRate: ExchangeRateConfig;
  onExchangeRateUpdated?: (rate: ExchangeRateConfig) => void;
  currency: Currency;
  isSyncingGlobal?: boolean;
  hasLoadedGlobal?: boolean;
  onRefreshData: (scope?: RefreshScope) => void | Promise<void>;
  onRevokeAuthorization?: () => void;
  onFinanzasModeChange?: (inFinanzas: boolean) => void;
}

type AdminScreen =
  | 'main'
  | 'reports'
  | 'settings'
  | 'passwords'
  | 'campanas'
  | 'lotes'
  | 'maquinarias'
  | 'items'
  | 'monedas'
  | 'activos';

// ==========================================
// HELPER COMPONENTS FOR iOS STYLING
// ==========================================

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string; activeClassName?: string }[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  variant?: 'default' | 'green' | 'red' | 'neutral';
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  variant = 'default',
}: SegmentedControlProps<T>) {
  return (
    <div className={`bg-[#F2F5F3] p-1 rounded-xl flex text-xs border border-[#E2E7E3] gap-1 h-[40px] items-center ${className}`}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const defaultActiveClass =
          variant === 'green'
            ? 'bg-white border border-[#BFE0CD] text-[#1D5C3F] font-semibold shadow-2xs'
            : variant === 'red'
            ? 'bg-white border border-[#F2C6C6] text-[#962D2D] font-semibold shadow-2xs'
            : variant === 'neutral'
            ? 'bg-white border border-[#CFD8D2] text-[#1F2D25] font-semibold shadow-2xs'
            : 'bg-white text-[#1F2D25] font-semibold shadow-2xs border border-[#DCE2DD]';
        const activeClass = opt.activeClassName || defaultActiveClass;
        const inactiveClass =
          'bg-transparent hover:bg-white/70 text-[#526058] font-medium border border-transparent';

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 h-[30px] px-2 rounded-lg text-center transition cursor-pointer select-none truncate ${
              isSelected ? activeClass : inactiveClass
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface IOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  errorMsg?: string | null;
  onErrorDismiss?: () => void;
  children: React.ReactNode;
}

const IOSModal: React.FC<IOSModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  errorMsg,
  onErrorDismiss,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-stone-900/40 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Sheet */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-stone-200/80 flex flex-col max-h-[90vh] overflow-hidden animate-slideUp z-10">
        {/* Mobile Drag Handle */}
        <div className="pt-3 pb-1 cursor-grab sm:hidden" onClick={onClose}>
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-stone-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-stone-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Error Alert if present */}
        {errorMsg && (
          <div className="mx-5 mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="break-words font-medium">{errorMsg}</span>
            </div>
            {onErrorDismiss && (
              <button
                type="button"
                onClick={onErrorDismiss}
                className="text-red-500 hover:text-red-700 p-1 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Form Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 pb-20 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
};

export const AdminView: React.FC<Props> = ({
  session,
  campaigns = [],
  activeCampaign,
  machines = [],
  machineJobTypes = [],
  lots = [],
  jobs = [],
  expenses = [],
  incomes = [],
  itemsConfig = [],
  assets = [],
  exchangeRate,
  onExchangeRateUpdated,
  currency,
  onRefreshData,
  onRevokeAuthorization,
  onFinanzasModeChange,
}) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => hasAdminAuthorization());
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeAdminModal, setShowRevokeAdminModal] = useState(false);

  // In-place reauthorization state (preserves open modal and form data on auth failure)
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [reauthorizing, setReauthorizing] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);

  const isAuthError = (err: unknown): boolean => {
    const msg = String(err instanceof Error ? err.message : err || '').toLowerCase();
    return (
      msg.includes('autorización administrativa') ||
      msg.includes('autorizacion administrativa') ||
      msg.includes('autorización de administrador') ||
      msg.includes('autorizacion de administrador') ||
      msg.includes('contrasena_admin') ||
      msg.includes('contraseña de administrador') ||
      msg.includes('contrasena de administrador') ||
      msg.includes('unauthorized_admin') ||
      msg.includes('token administrativo') ||
      msg.includes('credencial administrativa')
    );
  };

  useEffect(() => {
    if (hasAdminAuthorization()) {
      verifyAdminAuthorization()
        .then((valid) => {
          setIsAuthorized(valid);
        })
        .catch(() => {
          setIsAuthorized(hasAdminAuthorization());
        });
    } else {
      setIsAuthorized(false);
    }
  }, []);

  const handleAuthorizeDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput.trim()) {
      setAuthError('Por favor ingresa la contraseña de administrador.');
      return;
    }
    setAuthorizing(true);
    setAuthError(null);
    try {
      await authorizeAdminDevice(adminPasswordInput.trim());
      setIsAuthorized(true);
      setAdminPasswordInput('');
      setSuccessMsg('Dispositivo autorizado como Administrador.');
      onRefreshData();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Error al autorizar dispositivo');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleReauthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reauthPassword.trim()) {
      setReauthError('Por favor ingresa la contraseña de administrador.');
      return;
    }
    setReauthorizing(true);
    setReauthError(null);
    try {
      await authorizeAdminDevice(reauthPassword.trim());
      setIsAuthorized(true);
      setShowReauthModal(false);
      setReauthPassword('');
      setSuccessMsg('Dispositivo autorizado. Puedes guardar tus cambios ahora.');
    } catch (err: unknown) {
      setReauthError(err instanceof Error ? err.message : 'Error al autorizar dispositivo');
    } finally {
      setReauthorizing(false);
    }
  };

  const handleRevokeDevice = async () => {
    setRevoking(true);
    try {
      await revokeAdminAuthorization();
      setIsAuthorized(false);
      if (onRevokeAuthorization) {
        onRevokeAuthorization();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al revocar dispositivo');
    } finally {
      setRevoking(false);
    }
  };

  const [screen, setScreenState] = useState<AdminScreen>('main');
  const [prevScreen, setPrevScreen] = useState<AdminScreen>('settings');

  useEffect(() => {
    if (onFinanzasModeChange) {
      onFinanzasModeChange(screen === 'reports');
    }
    return () => {
      if (onFinanzasModeChange) {
        onFinanzasModeChange(false);
      }
    };
  }, [screen, onFinanzasModeChange]);

  const navigateTo = (target: AdminScreen) => {
    setPrevScreen(screen);
    if (target === 'items') {
      setItemsSubView(null);
      setFilterModulo('TODOS');
      setItemSearch('');
    }
    setScreenState(target);
  };

  const handleGoBack = () => {
    if (screen === 'items' && itemsSubView !== null) {
      setItemsSubView(null);
      setItemSearch('');
      setFilterModulo('TODOS');
      return;
    }
    setScreenState('main');
  };

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showScriptModal, setShowScriptModal] = useState(false);

  // Form Visibility Toggles for Modals
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showLotForm, setShowLotForm] = useState(false);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);

  // Campaign Form State
  const [cNombre, setCNombre] = useState('');
  const [cActiva, setCActiva] = useState(true);

  // Lot Form State
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [lotNombre, setLotNombre] = useState('');
  const [lotSuperficie, setLotSuperficie] = useState<string>('50');
  const [lotCultivo, setLotCultivo] = useState('');
  const [lotUbicacion, setLotUbicacion] = useState('');
  const [lotObs, setLotObs] = useState('');
  const [lotValorPatrimonial, setLotValorPatrimonial] = useState('');

  // Machine Form State
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [mNombre, setMNombre] = useState('');
  const [mIdentificacion, setMIdentificacion] = useState('');
  const [mTipo, setMTipo] = useState('');
  const [mIcono, setMIcono] = useState<string>('tractor');
  const [showMachineIconSheet, setShowMachineIconSheet] = useState(false);
  const [mTarifa, setMTarifa] = useState<string>('250');
  const [mUnidad, setMUnidad] = useState<'h' | 'ha'>('ha');
  const [mMoneda, setMMoneda] = useState<Currency>('BOB');
  const [mEstado, setMEstado] = useState<'operativo' | 'mantenimiento' | 'inactivo'>('operativo');
  const [mObs, setMObs] = useState('');
  const [mValorPatrimonial, setMValorPatrimonial] = useState('');

  // Exchange Rate Form & Official BCB State
  const [tasaInput, setTasaInput] = useState<string>(
    exchangeRate?.tasaBobPerUsd > 0 ? formatExchangeRateNumber(exchangeRate.tasaBobPerUsd) : ''
  );
  const [tasaNota, setTasaNota] = useState('');
  const [showManualRateForm, setShowManualRateForm] = useState(false);
  const [refreshingBcb, setRefreshingBcb] = useState(false);
  const [bcbPreview, setBcbPreview] = useState<{ rate: number; fecha?: string } | null>(null);

  React.useEffect(() => {
    if (exchangeRate?.tasaBobPerUsd && exchangeRate.tasaBobPerUsd > 0) {
      setTasaInput(formatExchangeRateNumber(exchangeRate.tasaBobPerUsd));
    }
  }, [exchangeRate?.tasaBobPerUsd]);

  React.useEffect(() => {
    if (screen === 'monedas') {
      setShowManualRateForm(false);
      setBcbPreview(null);
    }
  }, [screen]);

  // Asset Form State
  const [aTipo, setATipo] = useState<'MAQUINARIA' | 'LOTE' | 'OTRO'>('MAQUINARIA');
  const [aNombre, setANombre] = useState('');
  const [aIdentificador, setAIdentificador] = useState('');
  const [aValorInicial, setAValorInicial] = useState<number | ''>(85000);
  const [aMoneda, setAMoneda] = useState<Currency>('USD');
  const [aFecha, setAFecha] = useState(new Date().toISOString().slice(0, 10));

  // Item Form State
  const [itemsSubView, setItemsSubView] = useState<null | 'INGRESO' | 'GASTO'>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemOriginalModulo, setEditingItemOriginalModulo] = useState<'MAQUINARIAS' | 'PROPIEDAD' | null>(null);
  const [editingItemHasHistory, setEditingItemHasHistory] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemModulo, setItemModulo] = useState<'' | 'MAQUINARIAS' | 'PROPIEDAD'>('');
  const [itemClase, setItemClase] = useState<'GASTO' | 'INGRESO'>('GASTO');
  const [itemIcono, setItemIcono] = useState<string>('diesel');
  const [showItemIconSheet, setShowItemIconSheet] = useState(false);
  const [itemUnidad, setItemUnidad] = useState('unidades');
  const [itemPrecio, setItemPrecio] = useState<number | ''>('');
  const [itemMoneda, setItemMoneda] = useState<Currency>('USD');
  const [itemActivo, setItemActivo] = useState(true);

  // Item Filters State (persisted in memory across navigation)
  const [itemClassTab, setItemClassTab] = usePersistedMemoryState<'GASTO' | 'INGRESO'>('admin.items.classTab', 'GASTO');
  const [filterModulo, setFilterModulo] = usePersistedMemoryState<'TODOS' | 'MAQUINARIAS' | 'PROPIEDAD'>('admin.items.modulo', 'TODOS');
  const [itemSearch, setItemSearch] = useState('');
  const [itemStatusFilter, setItemStatusFilter] = usePersistedMemoryState<'activos' | 'desactivados' | 'todos'>('admin.items.status', 'activos');

  // Lotes & Activos Patrimoniales Navigation and Details State
  const [lotSearch, setLotSearch] = useState('');
  const [activosTab, setActivosTab] = usePersistedMemoryState<'maquinarias' | 'propiedad'>('admin.activos.tab', 'maquinarias');
  const [activosMaqSubFilter, setActivosMaqSubFilter] = usePersistedMemoryState<'TODOS' | 'MAQUINAS' | 'IMPLEMENTOS'>('admin.activos.maqSub', 'TODOS');
  const [activosSearch, setActivosSearch] = useState('');
  const [selectedEntityForDetail, setSelectedEntityForDetail] = useState<{
    type: 'maquinaria' | 'lote' | 'implemento';
    entity: Machine | Lot | ImplementItem;
  } | null>(null);

  // Implement Creation/Edit Modal State
  const [showImplementForm, setShowImplementForm] = useState(false);
  const [editingImplement, setEditingImplement] = useState<ImplementItem | null>(null);
  const [impFormNombre, setImpFormNombre] = useState('');
  const [impFormIcono, setImpFormIcono] = useState('implemento');
  const [impFormValorInicial, setImpFormValorInicial] = useState('');
  const [impFormFecha, setImpFormFecha] = useState(getLocalDateString());
  const [showImpFormIconSheet, setShowImpFormIconSheet] = useState(false);
  const [isSavingImplement, setIsSavingImplement] = useState(false);

  // Asset Improvement Creation Form State
  const [showAddImprovementModal, setShowAddImprovementModal] = useState(false);
  const [impFecha, setImpFecha] = useState(new Date().toISOString().slice(0, 10));
  const [impDesc, setImpDesc] = useState('');
  const [impCosto, setImpCosto] = useState<string>('');

  // Asset Improvement Edit State
  const [editingImprovement, setEditingImprovement] = useState<AssetImprovement | null>(null);
  const [editImpFecha, setEditImpFecha] = useState('');
  const [editImpDesc, setEditImpDesc] = useState('');
  const [editImpCosto, setEditImpCosto] = useState('');

  // Asset Improvement Delete State
  const [deletingImprovement, setDeletingImprovement] = useState<AssetImprovement | null>(null);
  const [isDeletingImprovement, setIsDeletingImprovement] = useState(false);

  const findAssetForMachine = (m: Machine, allAssets: Asset[]): Asset | undefined => {
    if (!m) return undefined;
    const byRef = allAssets.find(
      (a) =>
        (a.referenciaId && (a.referenciaId === m.id || (m.identificacion && a.referenciaId.toLowerCase() === m.identificacion.toLowerCase()))) ||
        (a.identificador && (a.identificador === m.id || (m.identificacion && a.identificador.toLowerCase() === m.identificacion.toLowerCase())))
    );
    if (byRef) return byRef;

    const mName = m.nombre.trim().toLowerCase();
    const byName = allAssets.find((a) => a.nombre.trim().toLowerCase() === mName);
    if (byName) return byName;

    const bySub = allAssets.find((a) => {
      const aName = a.nombre.trim().toLowerCase();
      return aName.includes(mName) || mName.includes(aName);
    });
    return bySub;
  };

  const findAssetForLot = (l: Lot, allAssets: Asset[]): Asset | undefined => {
    if (!l) return undefined;
    const byRef = allAssets.find(
      (a) =>
        (a.referenciaId && a.referenciaId === l.id) ||
        (a.identificador && a.identificador === l.id)
    );
    if (byRef) return byRef;

    const lName = l.nombre.trim().toLowerCase();
    const byName = allAssets.find((a) => a.nombre.trim().toLowerCase() === lName);
    if (byName) return byName;

    const bySub = allAssets.find((a) => {
      const aName = a.nombre.trim().toLowerCase();
      return aName.includes(lName) || lName.includes(aName);
    });
    return bySub;
  };

  const findAssetForImplement = (imp: ImplementItem, allAssets: Asset[]): Asset | undefined => {
    if (!imp) return undefined;
    if (imp.asset) {
      const direct = allAssets.find((a) => a.id === imp.asset?.id);
      if (direct) return direct;
    }
    const byRef = allAssets.find(
      (a) =>
        String(a.tipo || '').toUpperCase() === 'IMPLEMENTO' &&
        ((a.referenciaId && (a.referenciaId === imp.referenciaId || a.referenciaId === imp.id)) ||
          (a.identificador && (a.identificador === imp.referenciaId || a.identificador === imp.id)) ||
          a.id === imp.id)
    );
    if (byRef) return byRef;

    const impName = imp.nombre.trim().toLowerCase();
    const byName = allAssets.find(
      (a) =>
        String(a.tipo || '').toUpperCase() === 'IMPLEMENTO' &&
        a.nombre.trim().toLowerCase() === impName
    );
    return byName;
  };

  const getBaseValueForMachine = (m: Machine, allAssets: Asset[]): number => {
    if (m.valorPatrimonial && m.valorPatrimonial > 0) {
      return m.valorPatrimonial;
    }
    const linked = findAssetForMachine(m, allAssets);
    if (linked?.valorInicial && linked.valorInicial > 0) {
      return linked.valorInicial;
    }
    return 0;
  };

  const getBaseValueForLot = (l: Lot, allAssets: Asset[]): number => {
    if (l.valorPatrimonial && l.valorPatrimonial > 0) {
      return l.valorPatrimonial;
    }
    const linked = findAssetForLot(l, allAssets);
    if (linked?.valorInicial && linked.valorInicial > 0) {
      return linked.valorInicial;
    }
    return 0;
  };

  const getBaseValueForImplement = (imp: ImplementItem, allAssets: Asset[]): number => {
    const linked = findAssetForImplement(imp, allAssets);
    if (linked?.valorInicial && linked.valorInicial > 0) {
      return linked.valorInicial;
    }
    if (imp.baseVal && imp.baseVal > 0) {
      return imp.baseVal;
    }
    return 0;
  };

  const uniqueMachines = useMemo(() => {
    const seen = new Set<string>();
    return (machines || []).filter((m) => {
      const key = (m.id || m.nombre).trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [machines]);

  const isHistoricalCombination = (name: string | undefined): boolean => {
    const n = String(name || '').trim().toLowerCase();
    return (
      n.startsWith('tractor con') ||
      n.startsWith('maquina con') ||
      n === 'tractor solo' ||
      n === 'máquina sola' ||
      n === 'maquina sola' ||
      n === 'tractor' ||
      n === 'maquina'
    );
  };

  // Reusable collection of Agricultural Implements (existing in Activos + machine job types without duplicates, excluding historical combinations)
  const implementsList: ImplementItem[] = useMemo(() => {
    const result: ImplementItem[] = [];
    const registeredNames = new Set<string>();

    // 1. Assets of type IMPLEMENTO from the Activos sheet
    const implementAssets = (assets || []).filter(
      (a) => String(a.tipo || '').toUpperCase() === 'IMPLEMENTO' || String(a.tipo || '').toLowerCase() === 'implemento'
    );

    for (const a of implementAssets) {
      const normName = a.nombre.trim().toLowerCase();
      registeredNames.add(normName);
      if (a.referenciaId) {
        registeredNames.add(a.referenciaId.trim().toLowerCase());
      }

      const baseVal = a.valorInicial || 0;
      const imps = a.mejoras || [];
      const sumM = imps.reduce((acc, m) => acc + (m.costo || 0), 0);
      const totVal = baseVal > 0 ? baseVal + sumM : sumM;
      const resolvedIcon = a.icono || getIconDefinition(a.nombre, 'implemento').id || 'implemento';

      result.push({
        id: a.id,
        nombre: a.nombre,
        icono: resolvedIcon,
        referenciaId: a.referenciaId || a.id,
        asset: a,
        baseVal,
        mejoras: imps,
        sumMejoras: sumM,
        totVal,
        origen: 'activo',
      });
    }

    // 2. Discover real implements from Google Sheets TrabajosMaquinaria (no hardcoded fallback)
    const jobSources: Array<{ id?: string; nombre: string; icono?: string }> = [
      ...(machineJobTypes || []),
    ];

    for (const j of jobSources) {
      const rawName = j.nombre.trim();
      if (!rawName) continue;
      if (isHistoricalCombination(rawName) || isVirtualMachineOnlyImplement(rawName)) continue;
      const norm = rawName.toLowerCase();

      // Check if already registered
      if (registeredNames.has(norm)) continue;
      if (j.id && registeredNames.has(j.id.toLowerCase())) continue;

      registeredNames.add(norm);
      if (j.id) registeredNames.add(j.id.toLowerCase());

      const resolvedIcon = j.icono || getIconDefinition(rawName, 'implemento').id || 'implemento';

      result.push({
        id: j.id || `imp_job_${norm.replace(/[^a-z0-9]/g, '_')}`,
        nombre: rawName,
        icono: resolvedIcon,
        referenciaId: j.id || `imp_job_${norm.replace(/[^a-z0-9]/g, '_')}`,
        asset: undefined,
        baseVal: 0,
        mejoras: [],
        sumMejoras: 0,
        totVal: 0,
        origen: 'labor',
      });
    }

    return result;
  }, [assets, machineJobTypes]);


  // Machine Deletion Modal State
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Machine Job Types & Machines/Implements Management State
  const [selectedAdminMachine, setSelectedAdminMachine] = useState<Machine | null>(null);
  const [selectedAdminImplement, setSelectedAdminImplement] = useState<MachineJobType | null>(null);
  const [machineSearch, setMachineSearch] = useState('');
  const [machineStatusFilter, setMachineStatusFilter] = usePersistedMemoryState<'activos' | 'desactivados' | 'todos'>('admin.machines.status', 'activos');
  const [machinesGroupOpen, setMachinesGroupOpen] = useState(true);
  const [equipmentsGroupOpen, setEquipmentsGroupOpen] = useState(false);
  const [togglingMachineId, setTogglingMachineId] = useState<string | null>(null);
  const [togglingJobTypeId, setTogglingJobTypeId] = useState<string | null>(null);
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [editingJobTypeId, setEditingJobTypeId] = useState<string | null>(null);
  const [jtMaquinaId, setJtMaquinaId] = useState('');
  const [jtCompatibleTipo, setJtCompatibleTipo] = useState('Tractor');
  const [jtNombre, setJtNombre] = useState('');
  const [jtIcono, setJtIcono] = useState<string>('implemento');
  const [showJtIconSheet, setShowJtIconSheet] = useState(false);
  const [jtTarifa, setJtTarifa] = useState('');
  const [jtUnidad, setJtUnidad] = useState<'ha' | 'hora'>('ha');
  const [jtMoneda, setJtMoneda] = useState<Currency>('USD');
  const [jtValorPatrimonial, setJtValorPatrimonial] = useState('');
  const [jtActivo, setJtActivo] = useState(true);
  const [isSavingJobType, setIsSavingJobType] = useState(false);

  // Shared SWR query for machine types (avoids redundant fetches on every Admin mount)
  const machineTypesQuery = useSwrQuery<string[]>(
    cacheKeys.machineTypes(),
    () => getMachineTypes(true),
    { enabled: true, minIntervalMs: 60_000 }
  );
  const remoteMachineTypes = machineTypesQuery.data ?? [];

  // Password & Users Management State
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'activos' | 'todos'>('activos');
  const [selectedUserRole, setSelectedUserRole] = useState<'admin' | 'usuario' | null>(null);
  const [pwdTargetRole, setPwdTargetRole] = useState<'admin' | 'usuario'>('admin');
  const [pwdCurrentAdmin, setPwdCurrentAdmin] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [showConfirmPwdModal, setShowConfirmPwdModal] = useState(false);
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState<string | null>(null);
  const [pwdErrorMsg, setPwdErrorMsg] = useState<string | null>(null);

  const machineTypesList = useMemo(() => {
    const base = ['Tractor', 'Cosechadora', 'Fumigadora', 'Camión', 'Vehículo', 'Otro'];
    const set = new Set<string>(base);
    remoteMachineTypes.forEach((t) => {
      if (t && t.trim()) set.add(t.trim());
    });
    machines.forEach((m) => {
      if (m.tipo && m.tipo.trim()) set.add(m.tipo.trim());
    });
    return Array.from(set);
  }, [machines, remoteMachineTypes]);

  const getBaseValueForJobType = (jt: MachineJobType): number => {
    const matched = (assets || []).find(
      (a) =>
        a.activo !== false &&
        String(a.tipo || '').toUpperCase() === 'IMPLEMENTO' &&
        (a.referenciaId === jt.id ||
          a.nombre.trim().toLowerCase() === jt.nombre.trim().toLowerCase())
    );
    return matched?.valorInicial && matched.valorInicial > 0 ? matched.valorInicial : 0;
  };

  const handleOpenAddJobType = (
    preset?: string | { nombre?: string; tipoMaquina?: string; icono?: string; unidad?: 'ha' | 'hora' }
  ) => {
    const opts = typeof preset === 'string' ? { tipoMaquina: preset } : preset || {};
    const tipoInit = opts.tipoMaquina || '';
    const matchedMachine = tipoInit
      ? machines.find(
          (m) =>
            (m.tipo || '').trim().toLowerCase() === tipoInit.trim().toLowerCase() &&
            m.estado !== 'inactivo' &&
            m.activo !== false
        )
      : undefined;
    setJtMaquinaId(matchedMachine?.id || '');
    setJtCompatibleTipo(tipoInit);
    setEditingJobTypeId(null);
    setJtNombre(opts.nombre || '');
    setJtIcono(opts.icono || 'implemento');
    setJtTarifa('');
    setJtUnidad(opts.unidad || 'ha');
    setJtMoneda('USD');
    setJtValorPatrimonial('');
    setJtActivo(true);
    setErrorMsg(null);
    setShowJobTypeModal(true);
  };

  const handleOpenEditJobType = (jt: MachineJobType) => {
    const linked = machines.find((m) => String(m.id) === String(jt.maquinaId));
    setJtMaquinaId(jt.maquinaId);
    setJtCompatibleTipo(jt.tipoMaquina || linked?.tipo || 'Tractor');
    setEditingJobTypeId(jt.id);
    setJtNombre(jt.nombre);
    setJtIcono(jt.icono || 'implemento');
    setJtTarifa(String(jt.tarifa));
    const rawU = String(jt.unidad || 'ha').toLowerCase();
    setJtUnidad(rawU.includes('hora') || rawU === 'h' ? 'hora' : 'ha');
    setJtMoneda((jt.moneda as Currency) || 'USD');
    const baseVal = getBaseValueForJobType(jt);
    setJtValorPatrimonial(baseVal > 0 ? String(baseVal) : '');
    setJtActivo(jt.activo !== false);
    setErrorMsg(null);
    setShowJobTypeModal(true);
  };

  const handleSaveJobType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingJobType) return;
    const nombreLimpio = jtNombre.trim();
    if (!nombreLimpio) {
      setErrorMsg('El nombre del implemento es obligatorio.');
      return;
    }
    if (isVirtualMachineOnlyImplement(nombreLimpio)) {
      setErrorMsg('Ese nombre corresponde a la máquina sola y no debe registrarse como implemento.');
      return;
    }
    if (!jtCompatibleTipo.trim()) {
      setErrorMsg('Selecciona el tipo de máquina compatible.');
      return;
    }
    if (!jtTarifa.trim()) {
      setErrorMsg('Ingresa y confirma la tarifa del implemento antes de guardar.');
      return;
    }
    const tarifaVal = parseDecimalNumber(jtTarifa);
    if (isNaN(tarifaVal) || tarifaVal <= 0) {
      setErrorMsg('Ingresa una tarifa válida mayor a 0.');
      return;
    }

    if (!editingJobTypeId) {
      const normNew = nombreLimpio.toLowerCase();
      const dup = (machineJobTypes || []).find(
        (jt) => jt.nombre.trim().toLowerCase() === normNew
      );
      if (dup) {
        setErrorMsg(`El implemento "${dup.nombre}" ya existe en el catálogo.`);
        return;
      }
    }

    // Bridge to GAS TrabajosMaquinaria schema (links maquinaId + tipoMaquina):
    // preserve existing maquinaId if its machine still matches the selected tipo; otherwise pick first machine of that tipo.
    const normTargetTipo = jtCompatibleTipo.trim().toLowerCase();
    const currentLinked = machines.find((m) => String(m.id) === String(jtMaquinaId));
    let resolvedMachineId = '';
    if (
      editingJobTypeId &&
      currentLinked &&
      (currentLinked.tipo || '').trim().toLowerCase() === normTargetTipo
    ) {
      resolvedMachineId = currentLinked.id;
    } else {
      const activeMatch = machines.find(
        (m) =>
          (m.tipo || '').trim().toLowerCase() === normTargetTipo &&
          m.estado !== 'inactivo' &&
          m.activo !== false
      );
      const anyMatch = machines.find(
        (m) => (m.tipo || '').trim().toLowerCase() === normTargetTipo
      );
      resolvedMachineId = activeMatch?.id || anyMatch?.id || '';
    }

    if (!resolvedMachineId) {
      setErrorMsg(
        `Registra primero una máquina de tipo "${jtCompatibleTipo}" para vincular este implemento.`
      );
      return;
    }

    setIsSavingJobType(true);
    setErrorMsg(null);
    try {
      const savedJt = await saveMachineJobType({
        ...(editingJobTypeId ? { id: editingJobTypeId } : {}),
        maquinaId: resolvedMachineId,
        tipoMaquina: jtCompatibleTipo.trim(),
        nombre: nombreLimpio,
        icono: jtIcono,
        tarifa: tarifaVal,
        unidad: jtUnidad,
        moneda: jtMoneda,
        activo: jtActivo,
      });

      const valPatNum = parseDecimalNumber(jtValorPatrimonial);
      if (valPatNum > 0) {
        try {
          await upsertAssetForImplement(
            savedJt?.id || editingJobTypeId || jtNombre.trim(),
            jtNombre.trim(),
            valPatNum,
            jtIcono
          );
        } catch {
          // Non-blocking: implement was already saved in TrabajosMaquinaria
        }
      }

      setSuccessMsg(
        editingJobTypeId
          ? 'Implemento agrícola actualizado.'
          : 'Implemento agrícola registrado.'
      );
      setShowJobTypeModal(false);
      setSelectedAdminImplement(null);
      onRefreshData('catalogs_and_assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el implemento');
    } finally {
      setIsSavingJobType(false);
    }
  };

  const getMachineHistoryCounts = (machineId: string) => {
    const jobsCount = jobs.filter((j) => String(j.maquinariaId) === String(machineId)).length;
    const expensesCount = expenses.filter((e) => String(e.maquinariaId) === String(machineId)).length;
    return { jobsCount, expensesCount, total: jobsCount + expensesCount };
  };

  const hasJobTypeHistory = (jt: MachineJobType): boolean => {
    const targetName = String(jt.nombre || '').trim().toLowerCase();
    return jobs.some(
      (j) =>
        (j.trabajoTipoId && String(j.trabajoTipoId) === String(jt.id)) ||
        (String(j.maquinariaId) === String(jt.maquinaId) &&
          targetName.length > 0 &&
          String(j.trabajoNombre || '').trim().toLowerCase() === targetName)
    );
  };

  const handleToggleMachineActive = async (m: Machine) => {
    const isCurrentlyActive = m.estado !== 'inactivo' && m.activo !== false;
    const nextEstado = isCurrentlyActive ? 'inactivo' : 'operativo';
    setTogglingMachineId(m.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateMachine(m.id, {
        nombre: m.nombre,
        identificacion: m.identificacion,
        tipo: m.tipo,
        icono: m.icono,
        tarifa: m.tarifa,
        unidad: m.unidad,
        moneda: m.moneda,
        estado: nextEstado,
        activo: !isCurrentlyActive,
        observaciones: m.observaciones,
      });
      await onRefreshData('catalogs_and_assets');
      setSelectedAdminMachine(null);
      setSuccessMsg(
        isCurrentlyActive
          ? `"${m.nombre}" desactivada. No aparecerá en nuevos servicios pero conserva su historial.`
          : `"${m.nombre}" reactivada y disponible para nuevos servicios.`
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar estado de la máquina');
    } finally {
      setTogglingMachineId(null);
    }
  };

  const handleToggleJobTypeActive = async (jt: MachineJobType) => {
    const isCurrentlyActive = jt.activo !== false;
    setTogglingJobTypeId(jt.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await saveMachineJobType({
        id: jt.id,
        maquinaId: jt.maquinaId,
        tipoMaquina: jt.tipoMaquina,
        nombre: jt.nombre,
        icono: jt.icono,
        tarifa: jt.tarifa,
        unidad: jt.unidad,
        moneda: jt.moneda,
        activo: !isCurrentlyActive,
      });
      await onRefreshData('catalogs_and_assets');
      setSelectedAdminImplement(null);
      setSuccessMsg(
        isCurrentlyActive
          ? `Implemento "${jt.nombre}" desactivado.`
          : `Implemento "${jt.nombre}" reactivado.`
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar estado del implemento');
    } finally {
      setTogglingJobTypeId(null);
    }
  };

  const handleDeleteJobTypeConfirm = async (jt: MachineJobType) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (hasJobTypeHistory(jt)) {
      setErrorMsg(
        `No se puede eliminar "${jt.nombre}" porque tiene servicios históricos registrados. Puedes desactivarlo para ocultarlo sin perder el historial.`
      );
      return;
    }
    const confirmed = window.confirm(
      `¿Desea eliminar definitivamente "${jt.nombre}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    try {
      await deleteMachineJobType(jt.id);
      setSelectedAdminImplement(null);
      setSuccessMsg('Implemento agrícola eliminado correctamente.');
      onRefreshData('catalogs_and_assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar implemento agrícola');
    }
  };

  // Submit Campaign
  const handleCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!cNombre.trim()) {
      setErrorMsg('El nombre de la campaña es obligatorio.');
      return;
    }

    setSaving(true);
    try {
      const res = await createCampaign({
        nombre: cNombre.trim(),
        activa: cActiva,
        fechaInicio: new Date().toISOString().split('T')[0],
        estado: cActiva ? 'activa' : 'cerrada',
      });

      setSuccessMsg(`Campaña "${cNombre.trim()}" creada exitosamente.`);
      setCNombre('');
      setShowCampaignForm(false);
      onRefreshData('catalogs');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar campaña');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateCampaign = async (campaignId: string) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await setActiveCampaign(campaignId);
      setSuccessMsg('Campaña activa actualizada exitosamente.');
      onRefreshData('catalogs');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al cambiar campaña activa');
    } finally {
      setSaving(false);
    }
  };

  // Submit Lot
  const handleLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!lotNombre.trim()) {
      setErrorMsg('El nombre del lote es obligatorio.');
      return;
    }

    const rawStr = String(lotSuperficie).trim();
    const parsedSup = parseDecimalNumber(rawStr);
    if (!rawStr || isNaN(parsedSup) || parsedSup <= 0) {
      setErrorMsg('Ingresa una superficie en hectáreas válida (ejemplo: 50 o 50,5).');
      return;
    }

    setSaving(true);
    try {
      const valPatNum = parseDecimalNumber(lotValorPatrimonial);
      let savedLot: Lot;
      if (editingLotId) {
        savedLot = await updateLot(editingLotId, {
          nombre: lotNombre.trim(),
          superficieHectareas: parsedSup,
          superficie: parsedSup,
          cultivoActual: lotCultivo.trim(),
          ubicacion: lotUbicacion.trim(),
          observaciones: lotObs.trim(),
          valorPatrimonial: valPatNum > 0 ? valPatNum : undefined,
        });
      } else {
        savedLot = await createLot({
          nombre: lotNombre.trim(),
          superficieHectareas: parsedSup,
          superficie: parsedSup,
          cultivoActual: lotCultivo.trim(),
          ubicacion: lotUbicacion.trim(),
          observaciones: lotObs.trim(),
          valorPatrimonial: valPatNum > 0 ? valPatNum : undefined,
        });
      }

      setLotNombre('');
      setLotSuperficie('50');
      setLotCultivo('');
      setLotUbicacion('');
      setLotObs('');
      setLotValorPatrimonial('');
      setEditingLotId(null);
      setShowLotForm(false);

      // Sincronizar inmediatamente desde Google Sheets
      await onRefreshData('catalogs_and_assets');

      setSuccessMsg(
        editingLotId
          ? `Lote "${savedLot.nombre}" guardado y sincronizado exitosamente.`
          : `Lote "${savedLot.nombre}" creado exitosamente.`
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el lote');
    } finally {
      setSaving(false);
    }
  };

  const handleEditLot = (lot: Lot) => {
    setEditingLotId(lot.id);
    setLotNombre(lot.nombre);
    setLotSuperficie(String(lot.superficieHectareas ?? lot.superficie ?? ''));
    setLotCultivo(lot.cultivoActual || '');
    setLotUbicacion(lot.ubicacion || '');
    setLotObs(lot.observaciones || '');
    const baseVal = getBaseValueForLot(lot, assets);
    setLotValorPatrimonial(baseVal > 0 ? String(baseVal) : '');
    setShowLotForm(true);
  };

  const handleDeleteLotConfirm = async (id: string) => {
    if (!window.confirm('¿Confirmas eliminar este lote?')) return;
    try {
      await deleteLot(id);
      setSuccessMsg('Lote eliminado correctamente.');
      onRefreshData('catalogs_and_assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar el lote');
    }
  };

  // Submit Machine
  const handleMachineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!mNombre.trim()) {
      setErrorMsg('El nombre de la maquinaria es obligatorio.');
      return;
    }
    if (!mTipo.trim()) {
      setErrorMsg('Selecciona el tipo de máquina.');
      return;
    }

    const tarifaParsed = parseDecimalNumber(mTarifa);
    if (!mTarifa || isNaN(tarifaParsed) || tarifaParsed <= 0) {
      setErrorMsg('Ingresa una tarifa válida (ejemplo: 250).');
      return;
    }

    const codeUnidad: 'h' | 'ha' = mUnidad === 'ha' ? 'ha' : 'h';
    const valPatNum = parseDecimalNumber(mValorPatrimonial);

    setSaving(true);
    try {
      let savedMachine: Machine;
      if (editingMachineId) {
        savedMachine = await updateMachine(editingMachineId, {
          nombre: mNombre.trim(),
          identificacion: mIdentificacion.trim(),
          tipo: mTipo,
          icono: mIcono,
          tarifa: tarifaParsed,
          unidad: codeUnidad,
          moneda: mMoneda,
          estado: mEstado,
          observaciones: mObs.trim(),
          valorPatrimonial: valPatNum > 0 ? valPatNum : undefined,
        });
      } else {
        savedMachine = await createMachine({
          nombre: mNombre.trim(),
          identificacion: mIdentificacion.trim() || 'TR-01',
          tipo: mTipo,
          icono: mIcono,
          tarifa: tarifaParsed,
          unidad: codeUnidad,
          moneda: mMoneda,
          estado: mEstado,
          observaciones: mObs.trim(),
          valorPatrimonial: valPatNum > 0 ? valPatNum : undefined,
        });
      }

      setEditingMachineId(null);
      setMNombre('');
      setMIdentificacion('');
      setMIcono('tractor');
      setMValorPatrimonial('');
      setShowMachineForm(false);

      // Sincronizar inmediatamente desde Google Sheets
      await onRefreshData('catalogs_and_assets');

      setSuccessMsg(
        editingMachineId
          ? `Maquinaria "${savedMachine.nombre}" guardada y sincronizada exitosamente.`
          : `Maquinaria "${savedMachine.nombre}" registrada exitosamente.`
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar maquinaria');
    } finally {
      setSaving(false);
    }
  };

  const handleEditMachine = (m: Machine) => {
    setEditingMachineId(m.id);
    setMNombre(m.nombre);
    setMIdentificacion(m.identificacion);
    setMTipo(m.tipo);
    setMIcono(m.icono || 'tractor');
    setMTarifa(String(m.tarifa || ''));
    setMUnidad(m.unidad === 'ha' || m.unidad === 'hectarea' ? 'ha' : 'h');
    setMMoneda(m.moneda);
    setMEstado(m.estado as any);
    setMObs(m.observaciones || '');
    const baseVal = getBaseValueForMachine(m, assets);
    setMValorPatrimonial(baseVal > 0 ? String(baseVal) : '');
    setShowMachineForm(true);
  };

  const handleDeleteMachineClick = (m: Machine) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setDeletingMachine(m);
  };

  const handleExecuteDeleteMachine = async () => {
    if (!deletingMachine) return;
    setIsDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteMachine(deletingMachine.id);
      setSuccessMsg(`Maquinaria "${deletingMachine.nombre}" eliminada exitosamente.`);
      setDeletingMachine(null);
      onRefreshData('catalogs_and_assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar la maquinaria');
    } finally {
      setIsDeleting(false);
    }
  };

  // Query official BCB exchange rate via Google Apps Script
  const handleRefreshBcb = async (switchToOfficial = false) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setRefreshingBcb(true);
    try {
      const res = await refreshExchangeRateFromBcb({ switchToOfficial });
      onExchangeRateUpdated?.(res.config);

      if (res.manualPreserved && res.bcbPreviewRate) {
        setBcbPreview({ rate: res.bcbPreviewRate, fecha: res.bcbPreviewFecha });
        setSuccessMsg(
          `Ajuste manual conservado. Cotización oficial BCB: Bs ${formatExchangeRateNumber(res.bcbPreviewRate)}.`
        );
      } else {
        setBcbPreview(null);
        setShowManualRateForm(false);
        const vigLabel = res.config.fechaCotizacion
          ? ` (vigencia ${formatExchangeRateDate(res.config.fechaCotizacion)})`
          : '';
        if (switchToOfficial) {
          setSuccessMsg(
            `Tipo de cambio oficial BCB restablecido: 1 USD = Bs ${formatExchangeRateNumber(res.config.tasaBobPerUsd)}${vigLabel}.`
          );
        } else if (res.updated) {
          setSuccessMsg(
            `Cotización oficial BCB actualizada: 1 USD = Bs ${formatExchangeRateNumber(res.config.tasaBobPerUsd)}${vigLabel}.`
          );
        } else {
          setSuccessMsg(
            `Cotización oficial BCB al día: 1 USD = Bs ${formatExchangeRateNumber(res.config.tasaBobPerUsd)}${vigLabel}.`
          );
        }
      }
      onRefreshData('fx');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo consultar la cotización oficial del BCB.'
      );
    } finally {
      setRefreshingBcb(false);
    }
  };

  // Submit Manual Exchange Rate Override
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedTasa = parseDecimalNumber(tasaInput);
    if (!tasaInput || isNaN(parsedTasa) || parsedTasa <= 0) {
      setErrorMsg('Ingresa un tipo de cambio válido mayor a 0 (ejemplo: 11,75).');
      return;
    }

    setSaving(true);
    try {
      const res = await saveExchangeRateConfig({
        tasaBobPerUsd: parsedTasa,
        nota: tasaNota.trim() || 'Ajuste manual',
        fecha: getBoliviaDateString(),
      });
      onExchangeRateUpdated?.(res);
      setBcbPreview(null);
      setShowManualRateForm(false);
      setTasaNota('');
      if (res?.tasaBobPerUsd) {
        setTasaInput(formatExchangeRateNumber(res.tasaBobPerUsd));
      }
      setSuccessMsg(
        `Ajuste manual guardado: 1 USD = Bs ${formatExchangeRateNumber(res?.tasaBobPerUsd || parsedTasa)}.`
      );
      onRefreshData('fx');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el tipo de cambio');
    } finally {
      setSaving(false);
    }
  };

  // Submit Patrimonial Asset
  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aNombre.trim() || !aValorInicial) return;
    setSaving(true);
    try {
      await createAsset({
        tipo: aTipo,
        nombre: aNombre.trim(),
        identificador: aIdentificador.trim(),
        valorInicial: Number(aValorInicial),
        moneda: aMoneda,
        fechaAdquisicion: aFecha,
      });
      setSuccessMsg('Activo patrimonial registrado.');
      setANombre('');
      setShowAssetForm(false);
      onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar activo');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditImplement = (imp: ImplementItem) => {
    setEditingImplement(imp);
    setImpFormNombre(imp.nombre);
    setImpFormIcono(imp.icono || 'implemento');
    const baseVal = getBaseValueForImplement(imp, assets);
    setImpFormValorInicial(baseVal > 0 ? String(baseVal) : '');
    const linked = findAssetForImplement(imp, assets);
    setImpFormFecha(linked?.fechaAdquisicion || getLocalDateString());
    setShowImplementForm(true);
  };

  const handleSaveImplement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!impFormNombre.trim()) {
      setErrorMsg('El nombre del implemento es obligatorio.');
      return;
    }
    const valNum = parseDecimalNumber(impFormValorInicial);

    setSaving(true);
    setIsSavingImplement(true);
    try {
      const existing = editingImplement
        ? findAssetForImplement(editingImplement, assets)
        : assets.find(
            (a) =>
              String(a.tipo || '').toUpperCase() === 'IMPLEMENTO' &&
              a.nombre.trim().toLowerCase() === impFormNombre.trim().toLowerCase()
          );

      if (existing) {
        await updateAsset(existing.id, {
          nombre: impFormNombre.trim(),
          tipo: 'IMPLEMENTO',
          referenciaId: editingImplement?.referenciaId || existing.referenciaId || `imp_${Date.now()}`,
          valorInicial: valNum,
          moneda: 'USD',
          fechaAdquisicion: impFormFecha,
        });
        setSuccessMsg(`Implemento "${impFormNombre.trim()}" actualizado.`);
      } else {
        await createAsset({
          tipo: 'IMPLEMENTO',
          nombre: impFormNombre.trim(),
          identificador: editingImplement?.referenciaId || `imp_${Date.now()}`,
          referenciaId: editingImplement?.referenciaId || `imp_${Date.now()}`,
          icono: impFormIcono,
          valorInicial: valNum,
          moneda: 'USD',
          fechaAdquisicion: impFormFecha,
        });
        setSuccessMsg(`Implemento "${impFormNombre.trim()}" registrado exitosamente.`);
      }

      setShowImplementForm(false);
      setEditingImplement(null);
      await onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el implemento agrícola');
    } finally {
      setSaving(false);
      setIsSavingImplement(false);
    }
  };

  // Submit Improvement to Asset
  const handleAddImprovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntityForDetail || !impDesc.trim()) return;

    const parsedCosto = parseDecimalNumber(impCosto);
    if (isNaN(parsedCosto) || parsedCosto <= 0) {
      setErrorMsg('Ingresa un costo válido en USD para la mejora.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const isMachine = selectedEntityForDetail.type === 'maquinaria';
      const isImplement = selectedEntityForDetail.type === 'implemento';
      const entity = selectedEntityForDetail.entity;
      let targetAsset = isMachine
        ? findAssetForMachine(entity as Machine, assets)
        : isImplement
        ? findAssetForImplement(entity as ImplementItem, assets)
        : findAssetForLot(entity as Lot, assets);

      if (!targetAsset) {
        const baseVal = isMachine
          ? (entity as Machine).valorPatrimonial || 0
          : isImplement
          ? (entity as ImplementItem).baseVal || 0
          : (entity as Lot).valorPatrimonial || 0;

        targetAsset = await createAsset({
          tipo: isMachine ? 'MAQUINARIA' : (isImplement ? 'IMPLEMENTO' : 'LOTE'),
          nombre: entity.nombre.trim(),
          identificador: entity.id,
          referenciaId: (entity as any).referenciaId || entity.id,
          icono: (entity as any).icono || undefined,
          valorInicial: baseVal,
          moneda: 'USD',
          fechaAdquisicion: getLocalDateString(),
        });
      }

      await addAssetImprovement(targetAsset.id, {
        fecha: impFecha,
        descripcion: impDesc.trim(),
        costo: parsedCosto,
        moneda: 'USD',
      });

      setSuccessMsg('Mejora registrada exitosamente.');
      setImpDesc('');
      setImpCosto('');
      setShowAddImprovementModal(false);
      await onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar la mejora');
    } finally {
      setSaving(false);
    }
  };

  const handleEditImprovementClick = (m: AssetImprovement) => {
    setEditingImprovement(m);
    setEditImpFecha(m.fecha || getLocalDateString());
    setEditImpDesc(m.descripcion || '');
    setEditImpCosto(String(m.costo || ''));
  };

  const handleUpdateImprovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImprovement || !editImpDesc.trim()) return;

    const parsedCosto = parseDecimalNumber(editImpCosto);
    if (isNaN(parsedCosto) || parsedCosto <= 0) {
      setErrorMsg('Ingresa un costo válido en USD.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await updateAssetImprovement(editingImprovement.id, {
        fecha: editImpFecha,
        descripcion: editImpDesc.trim(),
        costo: parsedCosto,
        moneda: 'USD',
        assetId: editingImprovement.activoId,
      });

      setSuccessMsg('Mejora actualizada exitosamente.');
      setEditingImprovement(null);
      onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar la mejora');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImprovementClick = (m: AssetImprovement) => {
    setDeletingImprovement(m);
  };

  const handleExecuteDeleteImprovement = async () => {
    if (!deletingImprovement) return;
    setIsDeletingImprovement(true);
    setErrorMsg(null);
    try {
      await deleteAssetImprovement(deletingImprovement.id, deletingImprovement.activoId);
      setSuccessMsg('Mejora eliminada exitosamente.');
      setDeletingImprovement(null);
      onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar la mejora');
    } finally {
      setIsDeletingImprovement(false);
    }
  };

  // Submit Item Config
  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!itemName.trim()) {
      setErrorMsg('El nombre del concepto es obligatorio.');
      return;
    }
    if (itemModulo !== 'MAQUINARIAS' && itemModulo !== 'PROPIEDAD') {
      setErrorMsg('Selecciona el módulo al que pertenece este concepto.');
      return;
    }
    if (
      editingItemId &&
      editingItemHasHistory &&
      editingItemOriginalModulo &&
      itemModulo !== editingItemOriginalModulo
    ) {
      setErrorMsg(
        'No se puede cambiar el módulo de un concepto con movimientos registrados. Crea un nuevo concepto para el otro módulo.'
      );
      return;
    }

    setSaving(true);
    try {
      await saveItemConfig({
        id: editingItemId || undefined,
        nombre: itemName.trim(),
        modulo: itemModulo,
        clase: itemClase,
        icono: itemIcono,
        unidad: itemUnidad.trim() || 'unidades',
        precio: typeof itemPrecio === 'number' ? itemPrecio : 0,
        moneda: itemMoneda,
        activo: itemActivo,
      });
      setSuccessMsg(
        editingItemId
          ? `Concepto "${itemName.trim()}" actualizado.`
          : `Concepto "${itemName.trim()}" creado.`
      );
      setShowItemForm(false);
      setEditingItemId(null);
      setEditingItemOriginalModulo(null);
      setEditingItemHasHistory(false);
      setItemName('');
      setItemModulo('');
      setItemIcono((itemsSubView || itemClassTab) === 'INGRESO' ? 'soya' : 'diesel');
      setItemPrecio('');
      onRefreshData('catalogs');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el concepto');
    } finally {
      setSaving(false);
    }
  };

  const hasItemMovementHistory = (item: ItemConfig): boolean => {
    const normName = item.nombre.trim().toLowerCase();
    if (!normName) return false;
    const rawCls = String(
      item.clase || (item.tipo && item.tipo.includes('ingreso') ? 'INGRESO' : 'GASTO')
    ).toUpperCase();
    const isIng = rawCls.includes('ING');
    const rawMod = String(
      item.modulo || (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD')
    ).toUpperCase();
    const isMaq = rawMod.includes('MAQ');

    if (isIng) {
      if (!isMaq) {
        return incomes.some((inc) => (inc.concepto || '').trim().toLowerCase() === normName);
      }
      return jobs.some((j) => (j.trabajoNombre || '').trim().toLowerCase() === normName);
    }
    return expenses.some(
      (exp) =>
        (exp.modulo === 'maquinarias') === isMaq &&
        (exp.itemGasto || '').trim().toLowerCase() === normName
    );
  };

  const handleOpenAddItem = (forcedClass?: 'INGRESO' | 'GASTO') => {
    const cls = forcedClass || itemsSubView || itemClassTab;
    setEditingItemId(null);
    setEditingItemOriginalModulo(null);
    setEditingItemHasHistory(false);
    setItemName('');
    setItemClase(cls);
    // Mandatory explicit module selection on creation
    setItemModulo('');
    if (cls === 'INGRESO') {
      setItemIcono('soya');
      setItemUnidad('toneladas');
    } else {
      setItemIcono('diesel');
      setItemUnidad('litros');
    }
    setItemPrecio('');
    setItemMoneda('USD');
    setItemActivo(true);
    setErrorMsg(null);
    setShowItemForm(true);
  };

  const handleEditItem = (item: ItemConfig) => {
    setEditingItemId(item.id);
    setItemName(item.nombre);
    const rawCls = String(item.clase || (item.tipo && item.tipo.includes('ingreso') ? 'INGRESO' : 'GASTO')).toUpperCase();
    const normCls: 'GASTO' | 'INGRESO' = rawCls.includes('ING') ? 'INGRESO' : 'GASTO';
    setItemClase(normCls);

    setItemIcono(item.icono || (normCls === 'INGRESO' ? 'soya' : 'diesel'));

    const rawMod = String(item.modulo || (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD')).toUpperCase();
    const normMod: 'MAQUINARIAS' | 'PROPIEDAD' = rawMod.includes('MAQ') ? 'MAQUINARIAS' : 'PROPIEDAD';
    setItemModulo(normMod);
    setEditingItemOriginalModulo(normMod);
    setEditingItemHasHistory(hasItemMovementHistory(item));

    setItemUnidad(item.unidad || 'unidades');
    setItemPrecio(item.precioPredeterminado ?? item.precio ?? '');
    setItemMoneda((item.moneda as Currency) || 'USD');
    setItemActivo(item.activo !== false);
    setErrorMsg(null);
    setShowItemForm(true);
  };

  // Filter Items
  const filteredItems = useMemo(() => {
    const activeCls = itemsSubView || itemClassTab;
    return itemsConfig.filter((item) => {
      // 1. Filter by Class (GASTO vs INGRESO)
      const itemCls = item.clase || (item.tipo && item.tipo.includes('ingreso') ? 'INGRESO' : 'GASTO');
      if (itemCls !== activeCls) return false;

      // 2. Filter by Module (both Ingresos and Gastos support Maquinarias & Propiedad)
      const itemMod = item.modulo || (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD');
      if (filterModulo !== 'TODOS' && itemMod !== filterModulo) return false;

      // 3. Filter by Active state (Activos / Desactivados / Todos)
      const isActivo = item.activo !== false;
      if (itemStatusFilter === 'activos' && !isActivo) return false;
      if (itemStatusFilter === 'desactivados' && isActivo) return false;

      // 4. Search
      if (itemSearch.trim()) {
        const search = itemSearch.toLowerCase();
        return (
          item.nombre.toLowerCase().includes(search) ||
          (item.unidad && item.unidad.toLowerCase().includes(search))
        );
      }
      return true;
    });
  }, [itemsConfig, itemsSubView, itemClassTab, filterModulo, itemStatusFilter, itemSearch]);

  // In-place reauthorization modal: preserves active screen, modals and input fields
  const renderReauthModal = () => {
    if (!showReauthModal) return null;
    return (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 animate-fadeIn">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200/90 text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 mx-auto border border-amber-200">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-stone-900">
              Autorización Requerida
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Ingresa la contraseña de administrador (CONTRASENA_ADMIN) para completar esta operación sin perder los datos editados.
            </p>
          </div>

          {reauthError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 text-left flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span className="flex-1">{reauthError}</span>
            </div>
          )}

          <form onSubmit={handleReauthorize} className="space-y-3.5 text-left">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-700">
                Contraseña de Administrador
              </label>
              <div className="relative">
                <input
                  type={showReauthPassword ? 'text' : 'password'}
                  value={reauthPassword}
                  onChange={(e) => {
                    setReauthPassword(e.target.value);
                    if (reauthError) setReauthError(null);
                  }}
                  placeholder="CONTRASENA_ADMIN"
                  autoFocus
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition min-h-[42px]"
                />
                <button
                  type="button"
                  onClick={() => setShowReauthPassword(!showReauthPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                >
                  {showReauthPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={reauthorizing}
                onClick={() => {
                  setShowReauthModal(false);
                  setReauthPassword('');
                  setReauthError(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 bg-stone-100 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition cursor-pointer min-h-[40px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={reauthorizing || !reauthPassword.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#367C2B] hover:bg-emerald-800 text-xs font-semibold text-white transition cursor-pointer shadow-xs min-h-[40px] disabled:opacity-50"
              >
                {reauthorizing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Autorizando...</span>
                  </>
                ) : (
                  <span>Autorizar</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // AUTHORIZATION GATE: If device is not authorized and not in mid-edit reauthorization
  if (!isAuthorized && !showReauthModal) {
    return (
      <div className="space-y-6 max-w-md mx-auto w-full px-2 py-4 animate-fadeIn">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <button
            type="button"
            onClick={() => {
              if (onRevokeAuthorization) {
                onRevokeAuthorization();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer shrink-0 min-h-[38px]"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-700" />
            <span>Volver a Inicio</span>
          </button>
        </div>

        {/* Authorization Card */}
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
              Acceso de administrador
            </h2>
          </div>

          {authError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span className="flex-1 leading-snug">{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthorizeDevice} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Ingrese contraseña"
                  autoComplete="current-password"
                  autoFocus
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  title={showAdminPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authorizing || !adminPasswordInput.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-sm shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              {authorizing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Ingresando...</span>
                </>
              ) : (
                <span>Ingresar</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // RENDER LEVEL 3: Reporte general (Consolidado / Maquinarias / Propiedad)
  if (screen === 'reports') {
    return (
      <div className="space-y-4 w-full">
        <ReportsView
          campaigns={campaigns}
          activeCampaign={activeCampaign}
          machines={machines}
          machineJobTypes={machineJobTypes}
          lots={lots}
          jobs={jobs}
          expenses={expenses}
          incomes={incomes}
          currency={currency}
          exchangeRate={exchangeRate}
          initialScreen="general"
          onRootBackLabel="Volver a Administración"
          onBack={handleGoBack}
        />
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 1: Main Administration Screen (Lista única ordenada de 8 opciones)
  if (screen === 'main') {
    const activeCampaignObj = campaigns.find((c) => c.activa) || campaigns[0] || null;
    const isFxManual = exchangeRate.fuente === 'manual';
    const isFxBcbVerified =
      !isFxManual &&
      exchangeRate.fuenteDetalle === 'BCB (Oficial)' &&
      exchangeRate.estado === 'actualizado';
    const fxStatusSummary =
      exchangeRate.tasaBobPerUsd > 0
        ? `1 USD = Bs ${formatExchangeRateNumber(exchangeRate.tasaBobPerUsd)} · ${
            isFxManual
              ? 'Ajuste manual'
              : isFxBcbVerified
              ? 'Cotización BCB verificada'
              : exchangeRate.estado === 'sin_conexion'
              ? 'Consulta fallida (valor guardado)'
              : 'Valor guardado'
          }`
        : 'Consulta pendiente';

    const activeMachinesCount = machines.filter(
      (m) => m.estado !== 'inactivo' && m.activo !== false
    ).length;

    return (
      <div className="space-y-5 max-w-2xl mx-auto w-full">
        {/* Global Messages */}
        {errorMsg && (
          <div className="rounded-xl border border-[#C44545]/30 bg-[#FCECEC] p-3.5 text-sm text-[#962D2D] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 text-[#C44545] shrink-0" />
              <span className="break-words font-medium">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-[#C44545] hover:text-[#962D2D] shrink-0 p-1 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-[#24875B]/30 bg-[#EAF5EE] p-3.5 text-sm text-[#1D5C3F] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="h-4 w-4 text-[#24875B] shrink-0" />
              <span className="break-words font-medium">{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-[#24875B] hover:text-[#1D5C3F] shrink-0 p-1 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Lista directa — 8 opciones en orden oficial */}
        <section className="space-y-2.5" aria-label="Opciones de administración">
          <h2 className="text-sm font-bold text-[#526058] px-0.5">
            Administración
          </h2>

          <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
            {/* 1. Máquinas e implementos */}
            <button
              type="button"
              onClick={() => navigateTo('maquinarias')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700">
                  <Tractor className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    Máquinas e implementos
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {activeMachinesCount} de {machines.length} activas ·{' '}
                    {(machineJobTypes || []).filter((jt) => !isVirtualMachineOnlyImplement(jt.nombre)).length} implementos
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 2. Lotes */}
            <button
              type="button"
              onClick={() => navigateTo('lotes')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600">
                  <LandPlot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    Lotes
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {lots.length}{' '}
                    {lots.length === 1 ? 'lote en propiedad' : 'lotes en propiedad'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 3. Campañas */}
            <button
              type="button"
              onClick={() => navigateTo('campanas')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 border border-purple-200/80 text-purple-700">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    Campañas
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {activeCampaignObj ? `Activa: ${activeCampaignObj.nombre}` : `${campaigns.length} campañas`}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 4. Conceptos */}
            <button
              type="button"
              onClick={() => navigateTo('items')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700">
                  <Tag className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    Conceptos
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {itemsConfig.length} rubros de gastos e ingresos
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 5. Tipo de cambio */}
            <button
              type="button"
              onClick={() => navigateTo('monedas')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-200/80 text-teal-700">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    Tipo de cambio
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5 tabular-nums">
                    {fxStatusSummary}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 6. Patrimonio */}
            <button
              type="button"
              onClick={() => navigateTo('activos')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 border border-orange-200/80 text-orange-800">
                  <Landmark className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    Patrimonio
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    Valoración y mejoras de máquinas y lotes
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 7. Usuarios */}
            <button
              type="button"
              onClick={() => {
                setPwdErrorMsg(null);
                setPwdSuccessMsg(null);
                setPwdCurrentAdmin('');
                setPwdNew('');
                setPwdConfirm('');
                navigateTo('passwords');
              }}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-700">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    Usuarios
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    Cuentas de acceso y cambio de contraseña
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 8. Reporte general */}
            <button
              type="button"
              onClick={() => navigateTo('reports')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 border border-cyan-200/80 text-cyan-700">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    Reporte general
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    Consolidado, Maquinarias y Propiedad por campaña
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>
          </div>
        </section>

        <AppsScriptModal isOpen={showScriptModal} onClose={() => setShowScriptModal(false)} />
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 2: Usuarios y Contraseñas Screen
  if (screen === 'passwords') {
    const systemAccounts: Array<{
      role: 'admin' | 'usuario';
      name: string;
      description: string;
      status: string;
    }> = [
      {
        role: 'admin',
        name: 'Administrador',
        description: 'Control total: configuración, edición y eliminación de registros',
        status: 'Activo',
      },
      {
        role: 'usuario',
        name: 'Usuario',
        description: 'Registro y consulta de movimientos (sin editar ni eliminar)',
        status: 'Activo',
      },
    ];

    const qUser = userSearch.trim().toLowerCase();
    const filteredAccounts = systemAccounts.filter((acc) => {
      if (!qUser) return true;
      return `${acc.name} ${acc.description}`.toLowerCase().includes(qUser);
    });

    const handleOpenAccountModal = (role: 'admin' | 'usuario') => {
      setSelectedUserRole(role);
      setPwdTargetRole(role);
      setPwdCurrentAdmin('');
      setPwdNew('');
      setPwdConfirm('');
      setPwdErrorMsg(null);
      setPwdSuccessMsg(null);
    };

    const handleInitiatePasswordChange = (e: React.FormEvent) => {
      e.preventDefault();
      setPwdErrorMsg(null);
      setPwdSuccessMsg(null);

      if (!pwdCurrentAdmin.trim()) {
        setPwdErrorMsg('Ingresa la contraseña actual de Administrador.');
        return;
      }

      if (!pwdNew.trim()) {
        setPwdErrorMsg('Ingresa la nueva contraseña.');
        return;
      }

      if (pwdNew.trim().length < 8) {
        setPwdErrorMsg('La nueva contraseña debe tener al menos 8 caracteres.');
        return;
      }

      if (pwdNew !== pwdConfirm) {
        setPwdErrorMsg('Las contraseñas nuevas no coinciden.');
        return;
      }

      setShowConfirmPwdModal(true);
    };

    const handleExecutePasswordChange = async () => {
      setShowConfirmPwdModal(false);
      setIsSavingPwd(true);
      setPwdErrorMsg(null);
      setPwdSuccessMsg(null);

      try {
        await changeSystemPassword(pwdTargetRole, pwdCurrentAdmin, pwdNew);
        if (pwdTargetRole === 'admin') {
          setPwdSuccessMsg(
            'Contraseña de Administrador actualizada. Redirigiendo...'
          );
          setPwdCurrentAdmin('');
          setPwdNew('');
          setPwdConfirm('');
          setTimeout(() => {
            if (onRevokeAuthorization) {
              onRevokeAuthorization();
            } else {
              window.location.reload();
            }
          }, 1800);
        } else {
          setPwdSuccessMsg(
            'Contraseña de Usuario actualizada.'
          );
          setPwdCurrentAdmin('');
          setPwdNew('');
          setPwdConfirm('');
        }
      } catch (err: unknown) {
        setPwdErrorMsg(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
      } finally {
        setIsSavingPwd(false);
      }
    };

    const selectedAccount = systemAccounts.find((a) => a.role === selectedUserRole) || null;

    return (
      <div className="space-y-3 max-w-2xl mx-auto w-full">
        {/* Compact Header: [←] Usuarios */}
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#E2E7E3]">
          <button
            type="button"
            onClick={handleGoBack}
            aria-label="Volver a Administración"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-bold text-[#26352D] tracking-tight leading-tight">
            Usuarios
          </h2>
        </div>

        <ListToolbar
          countLabel={`${filteredAccounts.length}`}
          searchValue={userSearch}
          onSearchChange={setUserSearch}
          searchPlaceholder="Buscar cuenta o rol..."
          filters={
            <CompactFilter
              value={userStatusFilter}
              onChange={(val) => setUserStatusFilter(val as 'activos' | 'todos')}
              ariaLabel="Filtrar estado de usuarios"
              options={[
                { value: 'activos', label: 'Activos' },
                { value: 'todos', label: 'Todos' },
              ]}
            />
          }
        />

        <CompactList
          isEmpty={filteredAccounts.length === 0}
          emptyMessage="No se encontraron cuentas con esa búsqueda."
        >
          {filteredAccounts.map((acc) => (
            <CompactListRow
              key={acc.role}
              onClick={() => handleOpenAccountModal(acc.role)}
              chevron="right"
              icon={
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F5F2] border border-[#E2E7E3] text-[#26352D]">
                  {acc.role === 'admin' ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </div>
              }
              title={acc.name}
              subtitle={acc.description}
              rightPrimary={
                <span className="text-xs font-semibold text-[#24875B]">{acc.status}</span>
              }
            />
          ))}
        </CompactList>

        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">Permisos activos:</span> los usuarios normales solo pueden registrar y consultar movimientos; únicamente el Administrador puede editar o eliminar registros guardados. La creación y desactivación de usuarios individuales requiere agregar la tabla <strong>Usuarios</strong> y las acciones <code className="font-mono">user.*</code> en Google Apps Script.
          </p>
        </div>

        {/* Modal Ficha de Cuenta + Cambio de Contraseña */}
        <IOSModal
          isOpen={selectedAccount !== null}
          onClose={() => {
            setSelectedUserRole(null);
            setPwdErrorMsg(null);
            setPwdSuccessMsg(null);
          }}
          title={selectedAccount ? selectedAccount.name : 'Cuenta'}
          errorMsg={pwdErrorMsg}
          onErrorDismiss={() => setPwdErrorMsg(null)}
        >
          {selectedAccount && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#26352D]">{selectedAccount.name}</p>
                  <p className="text-[11px] text-[#5E6D64] mt-0.5">{selectedAccount.description}</p>
                </div>
                <span className="text-[11px] font-semibold text-[#24875B] shrink-0">
                  {selectedAccount.status}
                </span>
              </div>

              {pwdSuccessMsg && (
                <div className="rounded-xl border border-[#24875B]/30 bg-[#EAF5EE] p-3 text-xs text-[#1D5C3F] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Check className="h-4 w-4 text-[#24875B] shrink-0" />
                    <span className="font-semibold break-words">{pwdSuccessMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPwdSuccessMsg(null)}
                    className="text-[#24875B] hover:text-[#1D5C3F] p-1 shrink-0 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <KeyRound className="h-4 w-4 text-[#26352D]" />
                <h3 className="text-xs font-bold text-[#26352D]">Cambiar contraseña</h3>
              </div>

              <form onSubmit={handleInitiatePasswordChange} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#26352D]">
                    Contraseña actual de Administrador
                  </label>
                  <div className="relative">
                    <input
                      type={showPwdCurrent ? 'text' : 'password'}
                      value={pwdCurrentAdmin}
                      onChange={(e) => setPwdCurrentAdmin(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] px-3.5 py-2.5 pr-10 text-xs text-[#26352D] focus:bg-white focus:border-[#24875B] focus:outline-none transition min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdCurrent(!showPwdCurrent)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6C7A72] hover:text-[#26352D] transition cursor-pointer"
                      title={showPwdCurrent ? 'Ocultar' : 'Ver'}
                    >
                      {showPwdCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#26352D]">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPwdNew ? 'text' : 'password'}
                      value={pwdNew}
                      onChange={(e) => setPwdNew(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] px-3.5 py-2.5 pr-10 text-xs text-[#26352D] focus:bg-white focus:border-[#24875B] focus:outline-none transition min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdNew(!showPwdNew)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6C7A72] hover:text-[#26352D] transition cursor-pointer"
                      title={showPwdNew ? 'Ocultar' : 'Ver'}
                    >
                      {showPwdNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#26352D]">
                    Confirmar nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPwdConfirm ? 'text' : 'password'}
                      value={pwdConfirm}
                      onChange={(e) => setPwdConfirm(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] px-3.5 py-2.5 pr-10 text-xs text-[#26352D] focus:bg-white focus:border-[#24875B] focus:outline-none transition min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdConfirm(!showPwdConfirm)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6C7A72] hover:text-[#26352D] transition cursor-pointer"
                      title={showPwdConfirm ? 'Ocultar' : 'Ver'}
                    >
                      {showPwdConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[#5E6D64]">
                  Al cambiar la contraseña se cerrarán las sesiones activas de este rol.
                </p>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserRole(null);
                      setPwdErrorMsg(null);
                      setPwdSuccessMsg(null);
                    }}
                    className="flex-1 py-3 rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-xs font-bold text-[#26352D] transition cursor-pointer min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPwd}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white font-bold py-3 text-xs shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    {isSavingPwd ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        <span>Guardar contraseña</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </IOSModal>

        {/* Confirmation Modal */}
        {showConfirmPwdModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#26352D]/40 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl border border-[#E2E7E3] text-center space-y-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF5EE] text-[#24875B] mx-auto">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#26352D]">¿Cambiar contraseña?</h3>
                <p className="text-xs text-[#526058] mt-1.5 leading-relaxed">
                  {pwdTargetRole === 'usuario'
                    ? 'Se cerrarán las sesiones de Usuario en todos los dispositivos. ¿Continuar?'
                    : 'Se cerrarán todas las sesiones de Administrador, incluida esta. ¿Continuar?'}
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmPwdModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D4DDD6] bg-white text-xs font-semibold text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer min-h-[40px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecutePasswordChange}
                  className="flex-1 py-2.5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-xs font-semibold text-white transition cursor-pointer shadow-xs min-h-[40px]"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 2: Configuración Menu Screen (iPhone Settings Style)
  if (screen === 'settings') {
    return (
      <div className="space-y-5 max-w-2xl mx-auto w-full">
        {/* Navigation Bar */}
        <div className="flex items-center gap-3 pb-3 border-b border-stone-200">
          <button
            type="button"
            onClick={handleGoBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 transition cursor-pointer shrink-0 min-h-[38px]"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-700" />
            <span>Volver a Administración</span>
          </button>
        </div>

        <div>
          <h1 className="text-lg font-bold text-stone-900 tracking-tight">
            Configuración
          </h1>
          <p className="text-xs text-stone-500">
            Administra los parámetros maestros del sistema
          </p>
        </div>

        {/* Vertical Phone-Style Settings List */}
        <div className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100 shadow-xs overflow-hidden">
          {/* 1. Campañas */}
          <button
            type="button"
            onClick={() => navigateTo('campanas')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                    Campañas
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {campaigns.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  Gestionar campañas agrícolas
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* 2. Lotes */}
          <button
            type="button"
            onClick={() => navigateTo('lotes')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition">
                <LandPlot className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                    Lotes
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {lots.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  Superficies y lotes de la propiedad
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* 3. Máquinas e implementos */}
          <button
            type="button"
            onClick={() => navigateTo('maquinarias')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition">
                <Tractor className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                    Máquinas e implementos
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {machines.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  Máquinas, implementos agrícolas y tarifas base
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* 4. Ítems de ingresos y gastos */}
          <button
            type="button"
            onClick={() => navigateTo('items')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition">
                <Tag className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                    Ítems de ingresos y gastos
                  </h3>
                  <span className="text-[10px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-full">
                    {itemsConfig.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  Rubros y conceptos contables
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* 5. Tipo de cambio */}
          <button
            type="button"
            onClick={() => navigateTo('monedas')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                  Tipo de cambio
                </h3>
                <p className="text-[11px] text-stone-500 truncate tabular-nums">
                  {exchangeRate.tasaBobPerUsd > 0
                    ? `1 USD = Bs ${formatExchangeRateNumber(exchangeRate.tasaBobPerUsd)} · ${
                        exchangeRate.fuente === 'manual'
                          ? 'Ajuste manual'
                          : exchangeRate.fuenteDetalle === 'BCB (Oficial)' &&
                            (exchangeRate.estado === 'actualizado' ||
                              Boolean(exchangeRate.ultimaConsulta || exchangeRate.ultimaConsultaDia))
                          ? 'BCB (Oficial)'
                          : 'Valor guardado'
                      }`
                    : 'Consultando cotización...'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>
        </div>

        {/* Discrete Revoke Access Option */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowRevokeAdminModal(true)}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-red-200/80 bg-red-50/40 hover:bg-red-50 text-left transition cursor-pointer group min-h-[50px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
                <ShieldOff className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-red-950">
                  Revocar acceso administrativo
                </h3>
                <p className="text-[11px] text-red-800/80 truncate">
                  Eliminar credencial de este dispositivo
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-red-400 group-hover:text-red-700 transition shrink-0 ml-2" />
          </button>
        </div>

        {/* Revoke Confirmation Modal */}
        {showRevokeAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl border border-stone-200/80 text-center space-y-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-700 mx-auto">
                <LogOut className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">¿Revocar acceso administrativo?</h3>
                <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                  Se eliminará la credencial administrativa persistente de este dispositivo. Deberá ingresar nuevamente la contraseña de administrador para realizar cambios de configuración.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={revoking}
                  onClick={() => setShowRevokeAdminModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 bg-stone-100 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition cursor-pointer min-h-[40px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={revoking}
                  onClick={async () => {
                    setShowRevokeAdminModal(false);
                    await handleRevokeDevice();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-xs font-semibold text-white transition cursor-pointer shadow-xs min-h-[40px] flex items-center justify-center gap-1"
                >
                  {revoking ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span>Revocar</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        <AppsScriptModal isOpen={showScriptModal} onClose={() => setShowScriptModal(false)} />
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 3: Detail Option Screens
  return (
    <div
      className={
        screen === 'monedas'
          ? 'space-y-3 w-full max-w-lg mx-auto'
          : 'space-y-5 w-full max-w-4xl mx-auto'
      }
    >
      {/* Top Header with Back Button (For Configuración sub-screens) */}
      {screen !== 'activos' && screen !== 'monedas' && (
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E2E7E3]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleGoBack}
              aria-label="Volver"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-[#DCE2DD] text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-[#26352D]" />
            </button>
            <h2 className="text-base font-bold text-[#26352D] truncate">
              {screen === 'campanas'
                ? 'Campañas'
                : screen === 'lotes'
                ? 'Lotes'
                : screen === 'maquinarias'
                ? 'Máquinas e implementos'
                : screen === 'items'
                ? itemsSubView === 'INGRESO'
                  ? 'Ingresos'
                  : itemsSubView === 'GASTO'
                  ? 'Gastos'
                  : 'Conceptos'
                : screen === 'passwords'
                ? 'Usuarios'
                : 'Configuración'}
            </h2>
          </div>

          {/* Action button to open Modals */}
          {screen === 'campanas' && (
            <button
              type="button"
              onClick={() => {
                setCNombre('');
                setCActiva(true);
                setErrorMsg(null);
                setShowCampaignForm(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold transition cursor-pointer min-h-[36px] shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva</span>
            </button>
          )}

          {screen === 'lotes' && (
            <button
              type="button"
              onClick={() => {
                setEditingLotId(null);
                setLotNombre('');
                setLotSuperficie('50');
                setLotCultivo('');
                setLotUbicacion('');
                setLotObs('');
                setLotValorPatrimonial('');
                setErrorMsg(null);
                setShowLotForm(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold transition cursor-pointer min-h-[36px] shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo lote</span>
            </button>
          )}

          {screen === 'maquinarias' && (
            <button
              type="button"
              onClick={() => {
                setEditingMachineId(null);
                setMNombre('');
                setMIdentificacion('');
                setMTipo('');
                setMIcono('tractor');
                setMTarifa('');
                setMUnidad('ha');
                setMMoneda('USD');
                setMEstado('operativo');
                setMObs('');
                setMValorPatrimonial('');
                setErrorMsg(null);
                setShowMachineForm(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold transition cursor-pointer min-h-[36px] shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Nueva</span>
            </button>
          )}

          {screen === 'items' && itemsSubView !== null && (
            <button
              type="button"
              onClick={() => handleOpenAddItem(itemsSubView)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold transition cursor-pointer min-h-[36px] shrink-0 ${
                itemsSubView === 'GASTO'
                  ? 'bg-[#C44545] hover:bg-[#A93838]'
                  : 'bg-[#24875B] hover:bg-[#1D704B]'
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo</span>
            </button>
          )}
        </div>
      )}

      {/* Global Success Banner */}
      {successMsg && screen !== 'monedas' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="break-words">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* DETAIL 1: CAMPAÑAS */}
      {screen === 'campanas' && (
        <div className="space-y-3">
          <ListToolbar
            title="Campañas"
            countLabel={`${campaigns.length}`}
          />

          <CompactList
            isEmpty={campaigns.length === 0}
            emptyMessage="No hay campañas registradas."
          >
            {campaigns.map((c) => (
              <CompactListRow
                key={c.id}
                icon={
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      c.activa
                        ? 'bg-[#EAF5EE] text-[#24875B] border border-[#BFE0CD]'
                        : 'bg-[#F4F7F5] text-[#5E6D64] border border-[#E2E7E3]'
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                  </div>
                }
                title={c.nombre}
                subtitle={`Inicio: ${c.fechaInicio || '—'} · ${c.estado}`}
                rightActions={
                  c.activa ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1D734C] bg-[#EAF5EE] px-2.5 py-1 rounded-lg border border-[#BFE0CD]">
                      <Check className="h-3 w-3" />
                      Activa
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleActivateCampaign(c.id)}
                      className="text-xs font-semibold text-[#26352D] hover:text-[#24875B] border border-[#D4DDD6] hover:border-[#24875B] bg-white px-2.5 py-1 rounded-lg transition cursor-pointer min-h-[32px]"
                    >
                      Activar
                    </button>
                  )
                }
              />
            ))}
          </CompactList>

          {/* Modal Campaña */}
          <IOSModal
            isOpen={showCampaignForm}
            onClose={() => {
              setShowCampaignForm(false);
              setErrorMsg(null);
            }}
            title="Crear Nueva Campaña"
            subtitle="Registra una nueva campaña agrícola para el sistema"
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleCampaignSubmit} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Nombre de campaña <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  value={cNombre}
                  onChange={(e) => setCNombre(e.target.value)}
                  placeholder="Verano 2026/2027"
                  required
                  className={`${FORM_INPUT_CLASS} font-semibold`}
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="cActivaModal"
                  checked={cActiva}
                  onChange={(e) => setCActiva(e.target.checked)}
                  className="rounded text-[#24875B] focus:ring-[#24875B] h-4 w-4"
                />
                <label htmlFor="cActivaModal" className="text-xs font-medium text-[#26352D] cursor-pointer">
                  Establecer como campaña activa
                </label>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCampaignForm(false);
                    setErrorMsg(null);
                  }}
                  className="flex-1 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-sm font-bold text-[#26352D] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>Guardar campaña</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </IOSModal>
        </div>
      )}

      {/* DETAIL 2: LOTES */}
      {screen === 'lotes' && (() => {
        const q = lotSearch.trim().toLowerCase();
        const filteredAdminLots = lots.filter((l) => {
          if (!q) return true;
          return `${l.nombre} ${l.cultivoActual || ''} ${l.ubicacion || ''}`
            .toLowerCase()
            .includes(q);
        });
        const totalHa = filteredAdminLots.reduce(
          (acc, l) => acc + (Number(l.superficieHectareas) || 0),
          0
        );

        return (
        <div className="space-y-3">
          <ListToolbar
            countLabel={`${filteredAdminLots.length} lotes · ${totalHa.toFixed(1)} ha`}
            searchValue={lotSearch}
            onSearchChange={setLotSearch}
            searchPlaceholder="Buscar lote, cultivo o ubicación..."
          />

          <CompactList
            isEmpty={filteredAdminLots.length === 0}
            emptyMessage={
              q ? 'No se encontraron lotes con esa búsqueda.' : 'No hay lotes registrados aún.'
            }
          >
            {filteredAdminLots.map((lot) => (
              <CompactListRow
                key={lot.id}
                icon={
                  <div className="w-8 h-8 rounded-lg bg-[#EAF5EE] border border-[#BFE0CD]/70 text-[#24875B] flex items-center justify-center">
                    <LandPlot className="h-4 w-4" />
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
                rightActions={
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleEditLot(lot)}
                      className="p-1.5 text-[#5E6D64] hover:text-[#26352D] hover:bg-[#EFF2EF] rounded-lg transition cursor-pointer"
                      title="Editar lote"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLotConfirm(lot.id)}
                      className="p-1.5 text-[#7A8780] hover:text-[#C44545] hover:bg-[#FCECEC] rounded-lg transition cursor-pointer"
                      title="Eliminar lote"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                }
              />
            ))}
          </CompactList>

          {/* Modal Lote */}
          <IOSModal
            isOpen={showLotForm}
            onClose={() => {
              setShowLotForm(false);
              setEditingLotId(null);
              setLotNombre('');
              setLotSuperficie('50');
              setLotCultivo('');
              setLotUbicacion('');
              setLotObs('');
              setErrorMsg(null);
            }}
            title={editingLotId ? 'Editar Lote' : 'Crear Nuevo Lote'}
            subtitle="Configura el nombre, superficie e información del lote"
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleLotSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Nombre del lote <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="text"
                    value={lotNombre}
                    onChange={(e) => setLotNombre(e.target.value)}
                    placeholder="Lote 5 - El Palmar"
                    required
                    className={`${FORM_INPUT_CLASS} font-semibold`}
                  />
                </div>

                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Superficie (ha) <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={lotSuperficie}
                    onChange={(e) => setLotSuperficie(e.target.value)}
                    placeholder="50"
                    required
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className={FORM_LABEL_CLASS}>Cultivo actual</label>
                  <input
                    type="text"
                    value={lotCultivo}
                    onChange={(e) => setLotCultivo(e.target.value)}
                    placeholder="Soya / Maíz / Sorgo"
                    className={FORM_INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={FORM_LABEL_CLASS}>Ubicación</label>
                  <input
                    type="text"
                    value={lotUbicacion}
                    onChange={(e) => setLotUbicacion(e.target.value)}
                    placeholder="Sector Norte"
                    className={FORM_INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className={FORM_LABEL_CLASS}>
                  Observación <span className="text-[#7A8780] font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={lotObs}
                  onChange={(e) => setLotObs(e.target.value)}
                  placeholder="Calidad de suelo, canal de riego..."
                  className={FORM_TEXTAREA_CLASS}
                />
              </div>

              {/* Valor Patrimonial del Terreno */}
              <div className="pt-2 border-t border-[#EFF2EF]">
                <label className={FORM_LABEL_CLASS}>
                  Valor del terreno (USD){' '}
                  <span className="text-[12px] font-normal text-[#7A8780]">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A8780]">
                    USD
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={lotValorPatrimonial}
                    onChange={(e) => setLotValorPatrimonial(e.target.value)}
                    placeholder="120000"
                    className={`${FORM_INPUT_CLASS} pl-11 font-semibold font-mono tabular-nums`}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLotForm(false);
                    setEditingLotId(null);
                    setLotNombre('');
                    setLotSuperficie('50');
                    setLotCultivo('');
                    setLotUbicacion('');
                    setLotObs('');
                    setLotValorPatrimonial('');
                    setErrorMsg(null);
                  }}
                  className="flex-1 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-sm font-bold text-[#26352D] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{editingLotId ? 'Guardar cambios' : 'Guardar lote'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </IOSModal>
        </div>
        );
      })()}

      {/* DETAIL 3: MÁQUINAS E IMPLEMENTOS */}
      {screen === 'maquinarias' && (() => {
        const searchNorm = machineSearch.trim().toLowerCase();
        const machineById = new Map(machines.map((m) => [String(m.id), m]));

        const filteredMachines = machines.filter((m) => {
          const isActive = m.estado !== 'inactivo' && m.activo !== false;
          if (machineStatusFilter === 'activos' && !isActive) return false;
          if (machineStatusFilter === 'desactivados' && isActive) return false;
          if (!searchNorm) return true;
          const idLabel = m.identificacion && !isTechnicalId(m.identificacion) ? m.identificacion : '';
          return `${m.nombre} ${m.tipo} ${idLabel} ${m.estado}`.toLowerCase().includes(searchNorm);
        });

        // Consolidate real agricultural implements from Google Sheets TrabajosMaquinaria
        // Exclude virtual "Tractor solo" / machine-only entries without altering historical jobs
        const equipmentMap = new Map<string, MachineJobType>();
        (machineJobTypes || []).forEach((jt) => {
          if (jt && jt.id && !isVirtualMachineOnlyImplement(jt.nombre)) {
            equipmentMap.set(String(jt.id), jt);
          }
        });
        machines.forEach((m) => {
          (m.trabajos || []).forEach((jt) => {
            if (
              jt &&
              jt.id &&
              !isVirtualMachineOnlyImplement(jt.nombre) &&
              !equipmentMap.has(String(jt.id))
            ) {
              equipmentMap.set(String(jt.id), { ...jt, maquinaId: jt.maquinaId || m.id });
            }
          });
        });

        const allEquipments = Array.from(equipmentMap.values()).sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' })
        );

        const filteredEquipments = allEquipments.filter((jt) => {
          const isActive = jt.activo !== false;
          if (machineStatusFilter === 'activos' && !isActive) return false;
          if (machineStatusFilter === 'desactivados' && isActive) return false;
          if (!searchNorm) return true;
          const parentMachine = machineById.get(String(jt.maquinaId));
          return `${jt.nombre} ${jt.tipoMaquina || ''} ${parentMachine?.nombre || ''} ${parentMachine?.tipo || ''}`
            .toLowerCase()
            .includes(searchNorm);
        });

        const showEquipmentsExpanded = equipmentsGroupOpen || Boolean(searchNorm && filteredEquipments.length > 0);

        const tractorMachine = machines.find(
          (m) =>
            (m.tipo || '').trim().toLowerCase().includes('tractor') ||
            m.nombre.toLowerCase().includes('tractor')
        );
        const hasFumigacionImplement = allEquipments.some((jt) => {
          const n = jt.nombre.trim().toLowerCase();
          return n.includes('fumigaci') || n.includes('fumigador');
        });

        const deletingHistory = deletingMachine ? getMachineHistoryCounts(deletingMachine.id) : null;

        return (
          <div className="space-y-3">
            {/* Toolbar de una sola línea: Título | Cantidad | Lupa | Estado */}
            <ListToolbar
              title="Máquinas e implementos"
              countLabel={`${filteredMachines.length} · ${filteredEquipments.length}`}
              searchValue={machineSearch}
              onSearchChange={setMachineSearch}
              searchPlaceholder="Buscar máquina, tipo o implemento..."
              filters={
                <CompactFilter
                  value={machineStatusFilter}
                  onChange={(val) =>
                    setMachineStatusFilter(val as 'activos' | 'desactivados' | 'todos')
                  }
                  ariaLabel="Filtrar por estado"
                  options={[
                    { value: 'activos', label: 'Activos' },
                    { value: 'desactivados', label: 'Desactivados' },
                    { value: 'todos', label: 'Todos' },
                  ]}
                />
              }
            />

            {/* GRUPO 1: MÁQUINAS (Abierto inicialmente) */}
            <section className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setMachinesGroupOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-[#F8FAF8] hover:bg-[#F2F5F2] transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Tractor className="h-4.5 w-4.5 text-[#26352D] shrink-0" />
                  <span className="text-sm font-bold text-[#26352D]">
                    Máquinas ({filteredMachines.length})
                  </span>
                </div>
                {machinesGroupOpen ? (
                  <ChevronUp className="h-4.5 w-4.5 text-[#5E6D64] shrink-0" />
                ) : (
                  <ChevronDown className="h-4.5 w-4.5 text-[#5E6D64] shrink-0" />
                )}
              </button>

              {machinesGroupOpen && (
                <div className="border-t border-[#E2E7E3]">
                  <CompactList
                    isEmpty={filteredMachines.length === 0}
                    emptyMessage={
                      searchNorm
                        ? 'No se encontraron máquinas que coincidan con la búsqueda.'
                        : 'No hay máquinas registradas.'
                    }
                    className="border-0 rounded-none"
                  >
                    {filteredMachines.map((m) => {
                      const isActive = m.estado !== 'inactivo' && m.activo !== false;
                      const isMaintenance = m.estado === 'mantenimiento';
                      const unitLabel = m.unidad === 'ha' || m.unidad === 'hectarea' ? 'ha' : 'h';
                      const estadoText = !isActive
                        ? 'Inactivo'
                        : isMaintenance
                        ? 'Mantenimiento'
                        : 'Activo';

                      return (
                        <CompactListRow
                          key={m.id}
                          muted={!isActive}
                          onClick={() => {
                            setErrorMsg(null);
                            setSelectedAdminMachine(m);
                          }}
                          chevron="right"
                          icon={
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F7F4] border border-[#E2E7E3]">
                              <VisualIcon name={m.icono || 'tractor'} size="xs" />
                            </div>
                          }
                          title={m.nombre}
                          subtitle={
                            <span>
                              {m.tipo || 'Sin tipo'} ·{' '}
                              <span
                                className={
                                  !isActive
                                    ? 'text-[#7A8780]'
                                    : isMaintenance
                                    ? 'text-amber-700 font-semibold'
                                    : 'text-[#24875B] font-semibold'
                                }
                              >
                                {estadoText}
                              </span>
                            </span>
                          }
                          rightPrimary={
                            <span className="font-mono text-xs text-[#26352D]">
                              {m.moneda === 'USD' ? 'USD' : 'Bs'} {m.tarifa}/{unitLabel}
                            </span>
                          }
                        />
                      );
                    })}
                  </CompactList>
                </div>
              )}
            </section>

            {/* GRUPO 2: IMPLEMENTOS AGRÍCOLAS (Colapsable) */}
            <section className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setEquipmentsGroupOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-[#F8FAF8] hover:bg-[#F2F5F2] transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Wrench className="h-4.5 w-4.5 text-[#26352D] shrink-0" />
                  <span className="text-sm font-bold text-[#26352D]">
                    Implementos agrícolas ({filteredEquipments.length})
                  </span>
                </div>
                {showEquipmentsExpanded ? (
                  <ChevronUp className="h-4.5 w-4.5 text-[#5E6D64] shrink-0" />
                ) : (
                  <ChevronDown className="h-4.5 w-4.5 text-[#5E6D64] shrink-0" />
                )}
              </button>

              {showEquipmentsExpanded && (
                <div className="border-t border-[#E2E7E3]">
                  {/* Barra interna de acciones de implementos */}
                  <div className="px-4 py-2.5 bg-[#FAFBF8] border-b border-[#EFF2EF] flex flex-wrap items-center justify-end gap-2">
                    {tractorMachine && !hasFumigacionImplement && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenAddJobType({
                            nombre: 'Fumigación',
                            tipoMaquina: tractorMachine.tipo || 'Tractor',
                            icono: 'fumigadora',
                            unidad: 'ha',
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-[#26352D] text-xs font-semibold transition cursor-pointer min-h-[34px]"
                      >
                        <Plus className="h-3.5 w-3.5 text-[#24875B]" />
                        <span>Agregar Fumigación</span>
                      </button>
                    )}
                    {machines.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddJobType()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold transition cursor-pointer min-h-[34px]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Agregar implemento</span>
                      </button>
                    )}
                  </div>

                  <CompactList
                    isEmpty={filteredEquipments.length === 0}
                    emptyMessage={
                      searchNorm
                        ? 'No se encontraron implementos agrícolas que coincidan con la búsqueda.'
                        : 'No hay implementos agrícolas configurados todavía.'
                    }
                    className="border-0 rounded-none"
                  >
                    {filteredEquipments.map((jt) => {
                      const parentMachine = machineById.get(String(jt.maquinaId));
                      const isActive = jt.activo !== false;
                      const unitLabel =
                        String(jt.unidad || '').toLowerCase().includes('hora') || jt.unidad === 'h'
                          ? 'h'
                          : 'ha';
                      const compatibleTipo = jt.tipoMaquina || parentMachine?.tipo || 'Tractor';

                      return (
                        <CompactListRow
                          key={jt.id}
                          muted={!isActive}
                          onClick={() => {
                            setErrorMsg(null);
                            setSelectedAdminImplement(jt);
                          }}
                          chevron="right"
                          icon={
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F7F4] border border-[#E2E7E3]">
                              <VisualIcon name={jt.icono || 'implemento'} size="xs" />
                            </div>
                          }
                          title={jt.nombre}
                          subtitle={
                            <span>
                              Compatible: {compatibleTipo} ·{' '}
                              <span
                                className={
                                  isActive
                                    ? 'text-[#24875B] font-semibold'
                                    : 'text-[#7A8780]'
                                }
                              >
                                {isActive ? 'Activo' : 'Inactivo'}
                              </span>
                            </span>
                          }
                          rightPrimary={
                            <span className="font-mono text-xs text-[#26352D]">
                              {jt.moneda === 'USD' ? 'USD' : 'Bs'} {jt.tarifa}/{unitLabel}
                            </span>
                          }
                        />
                      );
                    })}
                  </CompactList>
                </div>
              )}
            </section>

            {/* Ficha Modal: Máquina */}
            {selectedAdminMachine && (() => {
              const m = selectedAdminMachine;
              const isActive = m.estado !== 'inactivo' && m.activo !== false;
              const isMaintenance = m.estado === 'mantenimiento';
              const isToggling = togglingMachineId === m.id;
              const history = getMachineHistoryCounts(m.id);
              const unitLabel = m.unidad === 'ha' || m.unidad === 'hectarea' ? 'ha' : 'h';
              const baseVal = getBaseValueForMachine(m, assets);

              return (
                <IOSModal
                  isOpen={true}
                  onClose={() => setSelectedAdminMachine(null)}
                  title={m.nombre}
                  errorMsg={errorMsg}
                  onErrorDismiss={() => setErrorMsg(null)}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] p-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-[#E2E7E3]">
                        <VisualIcon name={m.icono || 'tractor'} size="sm" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#26352D] truncate">{m.nombre}</p>
                        <p className="text-xs text-[#5E6D64] mt-0.5">
                          {m.tipo || 'Sin tipo'} ·{' '}
                          <span
                            className={
                              !isActive
                                ? 'text-[#7A8780]'
                                : isMaintenance
                                ? 'text-amber-700 font-semibold'
                                : 'text-[#24875B] font-semibold'
                            }
                          >
                            {!isActive ? 'Inactivo' : isMaintenance ? 'Mantenimiento' : 'Activo'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-[#EFF2EF] rounded-xl border border-[#E2E7E3] bg-white px-3.5 text-xs">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">Tarifa base</span>
                        <span className="font-mono font-bold text-[#26352D]">
                          {m.moneda === 'USD' ? 'USD' : 'Bs'} {m.tarifa}/{unitLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">Valor patrimonial</span>
                        <span className="font-mono font-semibold text-[#26352D]">
                          {baseVal > 0 ? `USD ${baseVal.toLocaleString()}` : 'Sin valor asignado'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">Movimientos registrados</span>
                        <span className="font-semibold text-[#26352D]">
                          {history.jobsCount} servicios · {history.expensesCount} gastos
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAdminMachine(null);
                            handleEditMachine(m);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-xs font-bold text-white transition cursor-pointer min-h-[42px]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleMachineActive(m)}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer min-h-[42px] disabled:opacity-50 ${
                            isActive
                              ? 'border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-[#26352D]'
                              : 'border-[#24875B]/40 bg-[#EAF5EE] hover:bg-[#DCEFE3] text-[#1D5C3F]'
                          }`}
                        >
                          {isToggling ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : isActive ? (
                            <Power className="h-3.5 w-3.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          <span>{isActive ? 'Desactivar' : 'Reactivar'}</span>
                        </button>
                      </div>

                      {history.total === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAdminMachine(null);
                            handleDeleteMachineClick(m);
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#C44545] hover:bg-[#A93838] text-xs font-bold text-white transition cursor-pointer min-h-[40px]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Eliminar máquina</span>
                        </button>
                      )}
                    </div>
                  </div>
                </IOSModal>
              );
            })()}

            {/* Ficha Modal: Implemento agrícola */}
            {selectedAdminImplement && (() => {
              const jt = selectedAdminImplement;
              const parentMachine = machineById.get(String(jt.maquinaId));
              const isActive = jt.activo !== false;
              const isToggling = togglingJobTypeId === jt.id;
              const hasHistory = hasJobTypeHistory(jt);
              const unitLabel =
                String(jt.unidad || '').toLowerCase().includes('hora') || jt.unidad === 'h'
                  ? 'Hora'
                  : 'Hectárea (ha)';
              const baseVal = getBaseValueForJobType(jt);

              return (
                <IOSModal
                  isOpen={true}
                  onClose={() => setSelectedAdminImplement(null)}
                  title={jt.nombre}
                  errorMsg={errorMsg}
                  onErrorDismiss={() => setErrorMsg(null)}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] p-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-[#E2E7E3]">
                        <VisualIcon name={jt.icono || 'implemento'} size="sm" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#26352D] truncate">{jt.nombre}</p>
                        <p className="text-xs text-[#5E6D64] mt-0.5">
                          Implemento agrícola ·{' '}
                          <span className={isActive ? 'text-[#24875B] font-semibold' : 'text-[#7A8780]'}>
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-[#EFF2EF] rounded-xl border border-[#E2E7E3] bg-white px-3.5 text-xs">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">Tipo de máquina compatible</span>
                        <span className="font-semibold text-[#26352D]">
                          {jt.tipoMaquina || parentMachine?.tipo || 'Tractor'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">Tarifa propia</span>
                        <span className="font-mono font-bold text-[#26352D]">
                          {jt.moneda === 'USD' ? 'USD' : 'Bs'} {jt.tarifa}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">Unidad de cobro</span>
                        <span className="font-semibold text-[#26352D]">{unitLabel}</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">Valor patrimonial</span>
                        <span className="font-mono font-semibold text-[#26352D]">
                          {baseVal > 0 ? `USD ${baseVal.toLocaleString()}` : 'Sin valor asignado'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAdminImplement(null);
                            handleOpenEditJobType(jt);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-xs font-bold text-white transition cursor-pointer min-h-[42px]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleJobTypeActive(jt)}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer min-h-[42px] disabled:opacity-50 ${
                            isActive
                              ? 'border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-[#26352D]'
                              : 'border-[#24875B]/40 bg-[#EAF5EE] hover:bg-[#DCEFE3] text-[#1D5C3F]'
                          }`}
                        >
                          {isToggling ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : isActive ? (
                            <Power className="h-3.5 w-3.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          <span>{isActive ? 'Desactivar' : 'Reactivar'}</span>
                        </button>
                      </div>

                      {!hasHistory && (
                        <button
                          type="button"
                          onClick={() => handleDeleteJobTypeConfirm(jt)}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#C44545] hover:bg-[#A93838] text-xs font-bold text-white transition cursor-pointer min-h-[40px]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Eliminar implemento</span>
                        </button>
                      )}
                    </div>
                  </div>
                </IOSModal>
              );
            })()}

            {/* Deletion Confirmation / Historical Protection Modal */}
            {deletingMachine && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26352D]/45 p-4 backdrop-blur-xs animate-fade-in">
                <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-[#E2E7E3] space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        deletingHistory && deletingHistory.total > 0
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-[#FCECEC] text-[#C44545]'
                      }`}
                    >
                      {deletingHistory && deletingHistory.total > 0 ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#26352D]">
                        {deletingHistory && deletingHistory.total > 0
                          ? 'No se puede eliminar definitivamente'
                          : 'Confirmar eliminación de máquina'}
                      </h3>
                      <p className="text-xs text-[#5E6D64]">
                        {deletingHistory && deletingHistory.total > 0
                          ? 'Esta máquina tiene movimientos históricos vinculados.'
                          : 'Esta acción no se puede deshacer.'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#FAFBF8] p-3 border border-[#E2E7E3] space-y-1">
                    <p className="text-xs font-bold text-[#26352D]">{deletingMachine.nombre}</p>
                    <p className="text-[11px] text-[#5E6D64]">
                      Tipo: {deletingMachine.tipo} · Tarifa: {deletingMachine.moneda} {deletingMachine.tarifa}/{deletingMachine.unidad}
                    </p>
                    {deletingHistory && deletingHistory.total > 0 && (
                      <p className="text-[11px] font-semibold text-amber-800 pt-1">
                        Historial detectado: {deletingHistory.jobsCount} servicios y {deletingHistory.expensesCount} gastos registrados.
                      </p>
                    )}
                  </div>

                  {deletingHistory && deletingHistory.total > 0 ? (
                    <>
                      <p className="text-xs text-[#526058] leading-relaxed">
                        Para conservar la integridad de reportes y balances históricos, desactiva la máquina en lugar de eliminarla. Así dejará de aparecer en nuevos servicios.
                      </p>
                      <div className="flex items-center justify-end gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setDeletingMachine(null)}
                          className="px-4 py-2.5 rounded-xl border border-[#D4DDD6] bg-white text-xs font-semibold text-[#26352D] hover:bg-[#F5F7F4] cursor-pointer min-h-[38px]"
                        >
                          Cerrar
                        </button>
                        {deletingMachine.estado !== 'inactivo' && deletingMachine.activo !== false && (
                          <button
                            type="button"
                            disabled={togglingMachineId === deletingMachine.id}
                            onClick={async () => {
                              const target = deletingMachine;
                              setDeletingMachine(null);
                              await handleToggleMachineActive(target);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white transition cursor-pointer min-h-[38px] disabled:opacity-50"
                          >
                            <Power className="h-3.5 w-3.5" />
                            <span>Desactivar máquina</span>
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-[#526058]">
                        Esta máquina no tiene servicios ni gastos registrados en el sistema. ¿Deseas eliminarla definitivamente?
                      </p>
                      <div className="flex items-center justify-end gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => setDeletingMachine(null)}
                          className="px-4 py-2.5 rounded-xl border border-[#D4DDD6] bg-white text-xs font-semibold text-[#26352D] hover:bg-[#F5F7F4] cursor-pointer min-h-[38px] disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={handleExecuteDeleteMachine}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#C44545] hover:bg-[#A93838] text-xs font-bold text-white transition cursor-pointer min-h-[38px] disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Eliminando...</span>
                            </>
                          ) : (
                            <span>Confirmar eliminación</span>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

          {/* Modal Máquina */}
          <IOSModal
            isOpen={showMachineForm}
            onClose={() => {
              setShowMachineForm(false);
              setEditingMachineId(null);
              setMNombre('');
              setMIdentificacion('');
              setMValorPatrimonial('');
              setErrorMsg(null);
            }}
            title={editingMachineId ? 'Editar máquina' : 'Nueva máquina'}
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleMachineSubmit} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Nombre / Modelo <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  value={mNombre}
                  onChange={(e) => setMNombre(e.target.value)}
                  placeholder="Tractor John Deere 6110M"
                  required
                  className={`${FORM_INPUT_CLASS} font-semibold`}
                />
              </div>

              <AppSelect
                label="Tipo de máquina"
                required
                icon={<Tractor className="h-[17px] w-[17px]" />}
                value={mTipo}
                onChange={(e) => setMTipo(e.target.value)}
              >
                <option value="">Seleccionar tipo</option>
                {machineTypesList.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </AppSelect>

              <div>
                <label className={FORM_LABEL_CLASS}>Icono</label>
                <button
                  type="button"
                  onClick={() => setShowMachineIconSheet(true)}
                  className="w-full h-[40px] flex items-center justify-between px-3 rounded-xl border border-[#CFD8D2] bg-white hover:border-[#24875B] transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <VisualIcon name={mIcono || 'tractor'} size="xs" />
                    <span className="text-sm font-semibold text-[#1F2D25] truncate">
                      {getIconDefinition(mIcono || 'tractor').label}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#24875B] shrink-0">Elegir</span>
                </button>
              </div>

              {mMoneda === 'BOB' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-[11px] text-amber-900 leading-snug">
                    Esta máquina conserva una tarifa histórica guardada en <strong>Bs</strong>.
                  </p>
                  {exchangeRate.tasaBobPerUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentVal = parseDecimalNumber(mTarifa);
                        if (!isNaN(currentVal) && currentVal > 0) {
                          const usdVal = Math.round((currentVal / exchangeRate.tasaBobPerUsd) * 100) / 100;
                          setMTarifa(String(usdVal));
                        }
                        setMMoneda('USD');
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100/60 text-[11px] font-bold text-amber-900 transition cursor-pointer"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>
                        Convertir a USD (TC {formatExchangeRateNumber(exchangeRate.tasaBobPerUsd)})
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Tarifa ({mMoneda === 'BOB' ? 'Bs' : 'USD'}){' '}
                    <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={mTarifa}
                    onChange={(e) => setMTarifa(e.target.value)}
                    placeholder="35"
                    required
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>

                <div>
                  <label className={FORM_LABEL_CLASS}>Unidad</label>
                  <SegmentedControl
                    options={[
                      { value: 'ha', label: 'Hectárea' },
                      { value: 'h', label: 'Hora' },
                    ]}
                    value={mUnidad}
                    onChange={(val) => setMUnidad(val as 'h' | 'ha')}
                  />
                </div>
              </div>

              <div>
                <label className={FORM_LABEL_CLASS}>Estado</label>
                <SegmentedControl
                  options={[
                    { value: 'operativo', label: 'Operativo' },
                    { value: 'mantenimiento', label: 'Mantenim.' },
                    { value: 'inactivo', label: 'Inactivo' },
                  ]}
                  value={mEstado}
                  onChange={(val) => setMEstado(val as any)}
                />
              </div>

              {/* Valor Patrimonial de la Máquina */}
              <div className="pt-2 border-t border-[#EFF2EF]">
                <label className={FORM_LABEL_CLASS}>
                  Valor patrimonial (USD){' '}
                  <span className="text-[12px] font-normal text-[#7A8780]">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A8780]">
                    USD
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={mValorPatrimonial}
                    onChange={(e) => setMValorPatrimonial(e.target.value)}
                    placeholder="65000"
                    className={`${FORM_INPUT_CLASS} pl-11 font-semibold font-mono tabular-nums`}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMachineForm(false);
                    setEditingMachineId(null);
                    setMNombre('');
                    setMIdentificacion('');
                    setMValorPatrimonial('');
                    setErrorMsg(null);
                  }}
                  className="flex-1 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-sm font-bold text-[#26352D] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{editingMachineId ? 'Guardar cambios' : 'Guardar máquina'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </IOSModal>

          {/* Modal Implemento agrícola */}
          <IOSModal
            isOpen={showJobTypeModal}
            onClose={() => {
              setShowJobTypeModal(false);
              setErrorMsg(null);
            }}
            title={editingJobTypeId ? 'Editar implemento' : 'Nuevo implemento'}
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleSaveJobType} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Nombre del implemento <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={jtNombre}
                  onChange={(e) => setJtNombre(e.target.value)}
                  placeholder="Sembradora, Romplow, Fumigadora..."
                  className={`${FORM_INPUT_CLASS} font-semibold`}
                />
              </div>

              <AppSelect
                label="Tipo de máquina compatible"
                required
                icon={<Tractor className="h-[17px] w-[17px]" />}
                value={jtCompatibleTipo}
                onChange={(e) => setJtCompatibleTipo(e.target.value)}
              >
                <option value="">Seleccionar tipo</option>
                {machineTypesList.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </AppSelect>

              <div>
                <label className={FORM_LABEL_CLASS}>Icono</label>
                <button
                  type="button"
                  onClick={() => setShowJtIconSheet(true)}
                  className="w-full h-[40px] flex items-center justify-between px-3 rounded-xl border border-[#CFD8D2] bg-white hover:border-[#24875B] transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <VisualIcon name={jtIcono || 'implemento'} size="xs" />
                    <span className="text-sm font-semibold text-[#1F2D25] truncate">
                      {getIconDefinition(jtIcono || 'implemento').label}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#24875B] shrink-0">Elegir</span>
                </button>
              </div>

              {jtMoneda === 'BOB' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-[11px] text-amber-900 leading-snug">
                    Este implemento conserva una tarifa histórica guardada en <strong>Bs</strong>.
                  </p>
                  {exchangeRate.tasaBobPerUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentVal = parseDecimalNumber(jtTarifa);
                        if (!isNaN(currentVal) && currentVal > 0) {
                          const usdVal = Math.round((currentVal / exchangeRate.tasaBobPerUsd) * 100) / 100;
                          setJtTarifa(String(usdVal));
                        }
                        setJtMoneda('USD');
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100/60 text-[11px] font-bold text-amber-900 transition cursor-pointer"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>
                        Convertir a USD (TC {formatExchangeRateNumber(exchangeRate.tasaBobPerUsd)})
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Tarifa ({jtMoneda === 'BOB' ? 'Bs' : 'USD'}){' '}
                    <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={jtTarifa}
                    onChange={(e) => setJtTarifa(e.target.value)}
                    placeholder="30"
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>

                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Unidad <span className="text-[#C44545]">*</span>
                  </label>
                  <SegmentedControl
                    options={[
                      { value: 'ha', label: 'Hectárea' },
                      { value: 'hora', label: 'Hora' },
                    ]}
                    value={jtUnidad}
                    onChange={(val) => setJtUnidad(val as 'ha' | 'hora')}
                    variant="neutral"
                  />
                </div>
              </div>

              <div className="pt-1 border-t border-[#EFF2EF]">
                <label className={FORM_LABEL_CLASS}>
                  Valor patrimonial (USD){' '}
                  <span className="text-[12px] font-normal text-[#7A8780]">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A8780]">
                    USD
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={jtValorPatrimonial}
                    onChange={(e) => setJtValorPatrimonial(e.target.value)}
                    placeholder="18000"
                    className={`${FORM_INPUT_CLASS} pl-11 font-semibold font-mono tabular-nums`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="jtActivoCheck"
                  checked={jtActivo}
                  onChange={(e) => setJtActivo(e.target.checked)}
                  className="h-4 w-4 rounded text-[#24875B] focus:ring-[#24875B]"
                />
                <label htmlFor="jtActivoCheck" className="text-xs font-semibold text-[#26352D] cursor-pointer">
                  Activo
                </label>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowJobTypeModal(false);
                    setErrorMsg(null);
                  }}
                  className="flex-1 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-sm font-bold text-[#26352D] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingJobType}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingJobType ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{editingJobTypeId ? 'Guardar cambios' : 'Guardar implemento'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </IOSModal>

          <IconBottomSheet
            isOpen={showMachineIconSheet}
            onClose={() => setShowMachineIconSheet(false)}
            category="maquinaria"
            selectedIconId={mIcono}
            onSelectIcon={(icon) => {
              setMIcono(icon.id);
              setShowMachineIconSheet(false);
            }}
            title="Elegir icono de maquinaria"
          />

          <IconBottomSheet
            isOpen={showJtIconSheet}
            onClose={() => setShowJtIconSheet(false)}
            category="implemento"
            selectedIconId={jtIcono}
            onSelectIcon={(icon) => {
              setJtIcono(icon.id);
              setShowJtIconSheet(false);
            }}
            title="Elegir icono de implemento agrícola"
          />
          </div>
        );
      })()}

      {/* DETAIL 4: CONCEPTOS DE INGRESOS Y GASTOS */}
      {screen === 'items' && (() => {
        const incomeConceptsCount = itemsConfig.filter((it) => {
          const cls = String(
            it.clase || (it.tipo && it.tipo.includes('ingreso') ? 'INGRESO' : 'GASTO')
          ).toUpperCase();
          return cls.includes('ING');
        }).length;
        const expenseConceptsCount = itemsConfig.length - incomeConceptsCount;

        if (itemsSubView === null) {
          return (
            <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setItemsSubView('INGRESO');
                  setItemClassTab('INGRESO');
                  setFilterModulo('TODOS');
                  setItemSearch('');
                }}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF5EE] text-[#24875B]">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-[#26352D] leading-snug">
                      Ingresos
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                      {incomeConceptsCount}{' '}
                      {incomeConceptsCount === 1 ? 'concepto configurado' : 'conceptos configurados'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setItemsSubView('GASTO');
                  setItemClassTab('GASTO');
                  setFilterModulo('TODOS');
                  setItemSearch('');
                }}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FCECEC] text-[#C44545]">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-[#26352D] leading-snug">
                      Gastos
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                      {expenseConceptsCount}{' '}
                      {expenseConceptsCount === 1 ? 'concepto configurado' : 'conceptos configurados'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
              </button>
            </div>
          );
        }

        const isGastoSub = itemsSubView === 'GASTO';

        return (
          <div className="space-y-3">
            {/* Una sola línea compacta: Cantidad | Lupa | Módulo | Estado */}
            <ListToolbar
              countLabel={`${filteredItems.length}`}
              searchValue={itemSearch}
              onSearchChange={setItemSearch}
              searchPlaceholder={
                isGastoSub ? 'Buscar concepto de gasto...' : 'Buscar concepto de ingreso...'
              }
              filters={
                <div className="flex items-center gap-1.5 min-w-0">
                  <CompactFilter
                    value={filterModulo}
                    onChange={(val) =>
                      setFilterModulo(val as 'TODOS' | 'MAQUINARIAS' | 'PROPIEDAD')
                    }
                    ariaLabel="Filtrar módulo"
                    options={[
                      { value: 'TODOS', label: 'Todos' },
                      { value: 'MAQUINARIAS', label: 'Maquinarias' },
                      { value: 'PROPIEDAD', label: 'Propiedad' },
                    ]}
                  />

                  <CompactFilter
                    value={itemStatusFilter}
                    onChange={(val) =>
                      setItemStatusFilter(val as 'activos' | 'desactivados' | 'todos')
                    }
                    ariaLabel="Filtrar estado"
                    options={[
                      { value: 'activos', label: 'Activos' },
                      { value: 'desactivados', label: 'Desactivados' },
                      { value: 'todos', label: 'Todos' },
                    ]}
                  />
                </div>
              }
            />

            {/* Lista continua compacta de Conceptos */}
            <CompactList
              isEmpty={filteredItems.length === 0}
              emptyMessage={`No se encontraron conceptos de ${
                isGastoSub ? 'gastos' : 'ingresos'
              } con los filtros seleccionados.`}
            >
              {filteredItems.map((item) => {
                const isActivo = item.activo !== false;
                const itemMod =
                  item.modulo ||
                  (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD');

                return (
                  <CompactListRow
                    key={item.id}
                    muted={!isActivo}
                    onClick={() => handleEditItem(item)}
                    chevron="right"
                    icon={
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                          isGastoSub
                            ? 'bg-[#FCECEC] border-[#F2C6C6]/70'
                            : 'bg-[#EAF5EE] border-[#BFE0CD]/70'
                        }`}
                      >
                        <VisualIcon
                          iconId={item.icono}
                          nameHint={item.nombre}
                          category={isGastoSub ? 'gasto' : 'ingreso'}
                          size="xs"
                        />
                      </div>
                    }
                    title={item.nombre}
                    subtitle={
                      <span>
                        {itemMod === 'MAQUINARIAS' ? 'Maquinarias' : 'Propiedad'}
                        {!isGastoSub && item.unidad ? ` · ${item.unidad}` : ''}
                        {!isActivo ? ' · Desactivado' : ''}
                      </span>
                    }
                  />
                );
              })}
            </CompactList>

            {/* Modal Concepto */}
            <IOSModal
              isOpen={showItemForm}
              onClose={() => {
                setShowItemForm(false);
                setEditingItemId(null);
                setEditingItemOriginalModulo(null);
                setEditingItemHasHistory(false);
                setItemName('');
                setItemModulo('');
                setItemPrecio('');
                setErrorMsg(null);
              }}
              title={
                editingItemId
                  ? 'Editar concepto'
                  : itemClase === 'INGRESO'
                  ? 'Nuevo concepto de ingreso'
                  : 'Nuevo concepto de gasto'
              }
              errorMsg={errorMsg}
              onErrorDismiss={() => setErrorMsg(null)}
            >
              <form onSubmit={handleItemSubmit} className="space-y-3">
                {/* Nombre */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Nombre del concepto <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder={
                      itemClase === 'INGRESO'
                        ? 'Venta cosecha soya, Venta de maíz...'
                        : 'Semillas de soya, Repuestos, Diésel...'
                    }
                    required
                    className={`${FORM_INPUT_CLASS} font-semibold`}
                  />
                </div>

                {/* Módulo obligatorio */}
                <div>
                  <AppSelect
                    label="Módulo"
                    required
                    icon={<Tag className="h-[17px] w-[17px]" />}
                    value={itemModulo}
                    disabled={Boolean(editingItemId && editingItemHasHistory)}
                    onChange={(e) =>
                      setItemModulo(e.target.value as '' | 'MAQUINARIAS' | 'PROPIEDAD')
                    }
                  >
                    <option value="">Seleccionar módulo</option>
                    <option value="MAQUINARIAS">Maquinarias</option>
                    <option value="PROPIEDAD">Propiedad</option>
                  </AppSelect>
                  {editingItemId && editingItemHasHistory && (
                    <p className="text-[11px] text-[#5E6D64] mt-1">
                      Tiene movimientos registrados; el módulo está bloqueado para proteger el historial.
                    </p>
                  )}
                </div>

                {/* Icono visual */}
                <div>
                  <label className={FORM_LABEL_CLASS}>Icono</label>
                  <button
                    type="button"
                    onClick={() => setShowItemIconSheet(true)}
                    className="w-full h-[40px] flex items-center justify-between px-3 rounded-xl border border-[#CFD8D2] bg-white hover:border-[#24875B] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <VisualIcon
                        iconId={itemIcono}
                        nameHint={itemName || (itemClase === 'INGRESO' ? 'soya' : 'diesel')}
                        category={itemClase === 'INGRESO' ? 'ingreso' : 'gasto'}
                        size="xs"
                      />
                      <span className="text-sm font-semibold text-[#1F2D25] truncate">
                        {
                          getIconDefinition(
                            itemIcono || (itemClase === 'INGRESO' ? 'soya' : 'diesel'),
                            itemClase === 'INGRESO' ? 'ingreso' : 'gasto'
                          ).label
                        }
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#24875B] shrink-0">Elegir</span>
                  </button>
                </div>

                {/* Unidad de medida (solo cuando aplica a ingresos) */}
                {itemClase === 'INGRESO' && (
                  <div>
                    <label className={FORM_LABEL_CLASS}>Unidad de medida</label>
                    <input
                      type="text"
                      value={itemUnidad}
                      onChange={(e) => setItemUnidad(e.target.value)}
                      placeholder="toneladas, quintales, kg"
                      className={FORM_INPUT_CLASS}
                    />
                  </div>
                )}

                {/* Estado Activo Checkbox */}
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="itemActivoCheckModal"
                    checked={itemActivo}
                    onChange={(e) => setItemActivo(e.target.checked)}
                    className="rounded text-[#24875B] focus:ring-[#24875B] h-4 w-4"
                  />
                  <label
                    htmlFor="itemActivoCheckModal"
                    className="text-xs font-semibold text-[#26352D] cursor-pointer"
                  >
                    Concepto activo
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowItemForm(false);
                      setEditingItemId(null);
                      setEditingItemOriginalModulo(null);
                      setEditingItemHasHistory(false);
                      setItemName('');
                      setItemModulo('');
                      setItemPrecio('');
                      setErrorMsg(null);
                    }}
                    className="flex-1 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-sm font-bold text-[#26352D] transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        <span>{editingItemId ? 'Guardar cambios' : 'Guardar'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </IOSModal>

            <IconBottomSheet
              isOpen={showItemIconSheet}
              onClose={() => setShowItemIconSheet(false)}
              category={itemClase === 'INGRESO' ? 'ingreso' : 'gasto'}
              selectedIconId={itemIcono}
              onSelectIcon={(icon) => {
                setItemIcono(icon.id);
                setShowItemIconSheet(false);
              }}
              title={
                itemClase === 'INGRESO'
                  ? 'Elegir icono de ingreso agrícola'
                  : 'Elegir icono de gasto'
              }
            />
          </div>
        );
      })()}

      {/* DETAIL 5: TIPO DE CAMBIO */}
      {screen === 'monedas' && (() => {
        const isManual = exchangeRate.fuente === 'manual';
        const isBcbConfirmed =
          !isManual &&
          exchangeRate.fuenteDetalle === 'BCB (Oficial)' &&
          exchangeRate.estado === 'actualizado';
        const hasRate = Number(exchangeRate.tasaBobPerUsd) > 0;
        const formattedRate = hasRate ? formatExchangeRateNumber(exchangeRate.tasaBobPerUsd) : '—';
        const statusKey = isManual
          ? 'manual'
          : isBcbConfirmed
          ? 'actualizado'
          : exchangeRate.estado === 'sin_conexion'
          ? 'sin_conexion'
          : hasRate
          ? 'guardado'
          : 'pendiente';

        const sourceLabel = isManual
          ? 'Ajuste manual'
          : isBcbConfirmed
          ? 'Banco Central de Bolivia (BCB)'
          : 'Valor guardado en sistema';

        const cardTitle = isManual
          ? 'Cotización activa (manual)'
          : isBcbConfirmed
          ? 'Cotización BCB verificada'
          : statusKey === 'sin_conexion'
          ? 'Valor guardado (sin conexión al BCB)'
          : 'Valor guardado (consulta pendiente)';

        const statusConfig: Record<
          string,
          { label: string; className: string; dotClass: string }
        > = {
          actualizado: {
            label: 'Cotización BCB verificada',
            className: 'bg-[#EAF5EE] text-[#1D5C3F] border-[#24875B]/30',
            dotClass: 'bg-[#24875B]',
          },
          guardado: {
            label: 'Valor guardado',
            className: 'bg-[#F5F7F4] text-[#526058] border-[#D4DDD6]',
            dotClass: 'bg-[#7A8780]',
          },
          pendiente: {
            label: 'Consulta pendiente',
            className: 'bg-amber-50 text-amber-800 border-amber-200/80',
            dotClass: 'bg-amber-500',
          },
          sin_conexion: {
            label: 'Consulta fallida',
            className: 'bg-[#FCECEC] text-[#962D2D] border-[#C44545]/30',
            dotClass: 'bg-[#C44545]',
          },
          manual: {
            label: 'Ajuste manual',
            className: 'bg-sky-50 text-sky-900 border-sky-200/80',
            dotClass: 'bg-sky-600',
          },
        };
        const badge = statusConfig[statusKey] || statusConfig.pendiente;

        const vigenciaLabel = isBcbConfirmed ? 'Vigencia BCB' : 'Fecha guardada';
        const vigenciaValue =
          formatExchangeRateDate(
            isBcbConfirmed
              ? exchangeRate.fechaCotizacion || exchangeRate.fechaActualizacion
              : exchangeRate.fechaActualizacion
          ) || '—';

        const ultimaConsultaValue = exchangeRate.ultimaConsulta
          ? formatExchangeRateDate(exchangeRate.ultimaConsulta)
          : 'Pendiente';

        return (
          <div className="space-y-3">
            {/* Compact Header: [←] Tipo de cambio */}
            <div className="flex items-center gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={handleGoBack}
                aria-label="Volver a Administración"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] shadow-2xs hover:bg-[#F5F7F4] active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
              <h2 className="text-base font-bold text-[#26352D] tracking-tight leading-tight">
                Tipo de cambio
              </h2>
            </div>

            {/* Compact Feedback Alerts */}
            {errorMsg && (
              <div className="rounded-xl border border-[#C44545]/30 bg-[#FCECEC] px-3 py-2.5 text-xs text-[#962D2D] flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <AlertCircle className="h-4 w-4 text-[#C44545] shrink-0 mt-0.5" />
                  <span className="break-words leading-snug">{errorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-[#C44545] hover:text-[#962D2D] shrink-0 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl border border-[#24875B]/30 bg-[#EAF5EE] px-3 py-2.5 text-xs text-[#1D5C3F] flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <Check className="h-4 w-4 text-[#24875B] shrink-0 mt-0.5" />
                  <span className="break-words leading-snug">{successMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessMsg(null)}
                  className="text-[#24875B] hover:text-[#1D5C3F] shrink-0 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Main Compact Exchange Rate Card */}
            <div className="rounded-2xl border border-[#E2E7E3] bg-white p-4 shadow-2xs space-y-3.5">
              {/* Top Label + Discreet Status */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#5E6D64]">
                  {cardTitle}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClass}`} />
                  {badge.label}
                </span>
              </div>

              {/* Primary Exchange Rate Display */}
              <div className="flex items-baseline gap-2 py-0.5">
                <span className="text-sm font-semibold text-[#5E6D64]">1 USD =</span>
                <span className="text-[26px] font-bold tracking-tight text-[#26352D] tabular-nums leading-none">
                  Bs {formattedRate}
                </span>
              </div>

              {/* Thin Compact Metadata Rows */}
              <div className="divide-y divide-[#EFF2EF] border-t border-[#EFF2EF] text-xs">
                <div className="flex items-center justify-between gap-3 py-2">
                  <span className="text-[#5E6D64]">Fuente</span>
                  <span className="font-semibold text-[#26352D] text-right">
                    {sourceLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span className="text-[#5E6D64]">{vigenciaLabel}</span>
                  <span className="font-medium text-[#26352D] tabular-nums text-right">
                    {vigenciaValue}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span className="text-[#5E6D64]">Última consulta</span>
                  <span className="font-medium text-[#26352D] tabular-nums text-right">
                    {ultimaConsultaValue}
                  </span>
                </div>
                {isManual && exchangeRate.nota && (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <span className="text-[#5E6D64] shrink-0">Nota</span>
                    <span className="font-medium text-[#26352D] text-right truncate">
                      {exchangeRate.nota}
                    </span>
                  </div>
                )}
              </div>

              {/* Preview of live BCB quote when queried during manual override */}
              {isManual && bcbPreview && (
                <div className="rounded-xl border border-[#E2E7E3] bg-[#F5F7F4] px-3 py-2 text-[11px] text-[#526058] flex items-center justify-between gap-2">
                  <span>Cotización oficial BCB</span>
                  <span className="font-bold text-[#26352D] tabular-nums">
                    Bs {formatExchangeRateNumber(bcbPreview.rate)}
                    {bcbPreview.fecha ? ` · ${formatExchangeRateDate(bcbPreview.fecha)}` : ''}
                  </span>
                </div>
              )}

              {/* Primary Action Buttons */}
              <div className="space-y-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleRefreshBcb(false)}
                  disabled={refreshingBcb || saving}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#24875B] py-2.5 px-4 text-xs font-bold text-white shadow-2xs hover:bg-[#1D704B] transition active:scale-[0.99] disabled:opacity-50 cursor-pointer min-h-[42px]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingBcb ? 'animate-spin' : ''}`} />
                  <span>{refreshingBcb ? 'Consultando BCB...' : 'Consultar cotización BCB'}</span>
                </button>

                {isManual && (
                  <button
                    type="button"
                    onClick={() => handleRefreshBcb(true)}
                    disabled={refreshingBcb || saving}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] py-2.5 px-4 text-xs font-bold text-[#26352D] hover:bg-[#F2F5F2] transition active:scale-[0.99] disabled:opacity-50 cursor-pointer min-h-[40px]"
                  >
                    <Landmark className="h-3.5 w-3.5" />
                    <span>Volver al TC oficial BCB</span>
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Manual Override Section (Closed by Default) */}
            <div className="rounded-2xl border border-[#E2E7E3] bg-white shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setShowManualRateForm((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#F5F7F4] transition cursor-pointer min-h-[46px]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Edit3 className="h-4 w-4 text-[#526058] shrink-0" />
                  <span className="text-xs font-bold text-[#26352D]">Ajuste manual</span>
                </div>
                {showManualRateForm ? (
                  <ChevronUp className="h-4 w-4 text-[#7A8780] shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#7A8780] shrink-0" />
                )}
              </button>

              {showManualRateForm && (
                <form
                  onSubmit={handleSaveRate}
                  className="px-4 pb-4 pt-3 border-t border-[#EFF2EF] space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-[#26352D] mb-1">
                      Tipo de cambio (Bs por 1 USD)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tasaInput}
                      onChange={(e) => setTasaInput(e.target.value)}
                      placeholder="Ej. 11,75"
                      required
                      className="w-full text-sm font-bold tabular-nums px-3 py-2.5 rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] focus:bg-white focus:border-[#26352D] focus:outline-none min-h-[42px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#26352D] mb-1">
                      Observación <span className="font-normal text-[#7A8780]">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={tasaNota}
                      onChange={(e) => setTasaNota(e.target.value)}
                      placeholder="Ej. Cotización acordada para operación"
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] focus:bg-white focus:border-[#26352D] focus:outline-none min-h-[40px]"
                    />
                  </div>

                  <p className="text-[11px] text-[#5E6D64] leading-snug">
                    El ajuste manual pausa la sincronización automática diaria y no modifica movimientos anteriores.
                  </p>

                  <button
                    type="submit"
                    disabled={saving || refreshingBcb}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#24875B] py-2.5 px-4 text-xs font-bold text-white shadow-2xs hover:bg-[#1D704B] transition active:scale-[0.99] disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        <span>Guardar ajuste manual</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* DETAIL 6: ACTIVOS PATRIMONIALES Y MEJORAS */}
      {screen === 'activos' && (
        <div className="space-y-3 max-w-2xl mx-auto w-full">
          {/* Encabezado compacto con botón de regreso */}
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#E2E7E3]">
            <button
              type="button"
              onClick={handleGoBack}
              aria-label="Volver"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-[#DCE2DD] text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-[#26352D]" />
            </button>
            <h2 className="text-base font-bold text-[#26352D] truncate">Patrimonio</h2>
          </div>

          {/* 3. Segmented control selector taking full available width */}
          <div>
            <SegmentedControl
              options={[
                { value: 'maquinarias', label: `Maquinarias (${uniqueMachines.length + implementsList.length})` },
                { value: 'propiedad', label: `Propiedad (${lots.length})` },
              ]}
              value={activosTab}
              onChange={(val) => setActivosTab(val)}
              variant="green"
              className="w-full text-xs sm:text-sm"
            />
          </div>

          {/* TAB 1: MAQUINARIAS E IMPLEMENTOS AGRÍCOLAS */}
          {activosTab === 'maquinarias' && (() => {
            const mBase = uniqueMachines.reduce((acc, m) => acc + getBaseValueForMachine(m, assets), 0);
            const mMejoras = uniqueMachines.reduce((acc, m) => {
              const linked = findAssetForMachine(m, assets);
              return acc + (linked?.mejoras || []).reduce((a, b) => a + (b.costo || 0), 0);
            }, 0);

            const iBase = implementsList.reduce((acc, imp) => acc + getBaseValueForImplement(imp, assets), 0);
            const iMejoras = implementsList.reduce((acc, imp) => {
              const linked = findAssetForImplement(imp, assets);
              const imps = linked?.mejoras || imp.mejoras || [];
              return acc + imps.reduce((a, b) => a + (b.costo || 0), 0);
            }, 0);

            let totalBase = mBase + iBase;
            let totalMejoras = mMejoras + iMejoras;

            if (activosMaqSubFilter === 'MAQUINAS') {
              totalBase = mBase;
              totalMejoras = mMejoras;
            } else if (activosMaqSubFilter === 'IMPLEMENTOS') {
              totalBase = iBase;
              totalMejoras = iMejoras;
            }

            const totalPat = totalBase + totalMejoras;

            const showMachines = activosMaqSubFilter === 'TODOS' || activosMaqSubFilter === 'MAQUINAS';
            const showImplements = activosMaqSubFilter === 'TODOS' || activosMaqSubFilter === 'IMPLEMENTOS';

            return (
              <div className="space-y-3">
                {/* 3-Column Compact Horizontal Summary Block */}
                <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-2xs">
                  <div className="grid grid-cols-3 divide-x divide-stone-100 text-center">
                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        Base
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-stone-700 font-mono mt-0.5 block truncate">
                        {totalBase > 0 ? `USD ${totalBase.toLocaleString()}` : 'Sin valor'}
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        Mejoras
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-700 font-mono mt-0.5 block truncate">
                        USD {totalMejoras.toLocaleString()}
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        Total
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-900 font-mono mt-0.5 block truncate">
                        {totalPat > 0 ? `USD ${totalPat.toLocaleString()}` : 'Sin valor'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-filter and Action Bar in one clean line */}
                <div className="space-y-2">
                  <ListToolbar
                    title="Bienes"
                    countLabel={`${
                      (showMachines
                        ? uniqueMachines.filter((m) =>
                            !activosSearch.trim()
                              ? true
                              : `${m.nombre} ${m.tipo || ''}`
                                  .toLowerCase()
                                  .includes(activosSearch.trim().toLowerCase())
                          ).length
                        : 0) +
                      (showImplements
                        ? implementsList.filter((imp) =>
                            !activosSearch.trim()
                              ? true
                              : imp.nombre
                                  .toLowerCase()
                                  .includes(activosSearch.trim().toLowerCase())
                          ).length
                        : 0)
                    }`}
                    searchValue={activosSearch}
                    onSearchChange={setActivosSearch}
                    searchPlaceholder="Buscar máquina o implemento..."
                    filters={
                      <div className="flex items-center gap-1.5">
                        <CompactFilter
                          value={activosMaqSubFilter}
                          onChange={(val) => setActivosMaqSubFilter(val as any)}
                          ariaLabel="Filtrar tipo de bien"
                          options={[
                            { value: 'TODOS', label: 'Todos' },
                            { value: 'MAQUINAS', label: 'Máquinas' },
                            { value: 'IMPLEMENTOS', label: 'Implementos' },
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingImplement(null);
                            setImpFormNombre('');
                            setImpFormIcono('implemento');
                            setImpFormValorInicial('');
                            setImpFormFecha(getLocalDateString());
                            setShowImplementForm(true);
                          }}
                          className="inline-flex items-center justify-center gap-1 px-2.5 h-[34px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-[11.5px] font-semibold transition cursor-pointer shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Implemento</span>
                        </button>
                      </div>
                    }
                  />
                </div>

                {/* Lista continua compacta de Máquinas e Implementos */}
                {(() => {
                  const q = activosSearch.trim().toLowerCase();
                  const filteredPatMachines = showMachines
                    ? uniqueMachines.filter((m) =>
                        !q ? true : `${m.nombre} ${m.tipo || ''}`.toLowerCase().includes(q)
                      )
                    : [];
                  const filteredPatImplements = showImplements
                    ? implementsList.filter((imp) =>
                        !q ? true : imp.nombre.toLowerCase().includes(q)
                      )
                    : [];
                  const isEmptyList =
                    filteredPatMachines.length === 0 && filteredPatImplements.length === 0;

                  return (
                    <CompactList
                      isEmpty={isEmptyList}
                      emptyMessage={
                        q
                          ? 'No se encontraron bienes con esa búsqueda.'
                          : showImplements && !showMachines
                          ? 'No hay implementos agrícolas registrados.'
                          : 'No hay máquinas ni implementos registrados.'
                      }
                    >
                      {filteredPatMachines.map((m) => {
                        const linked = findAssetForMachine(m, assets);
                        const baseVal = getBaseValueForMachine(m, assets);
                        const imps = linked?.mejoras || [];
                        const sumImps = imps.reduce((a, b) => a + (b.costo || 0), 0);
                        const totVal = baseVal > 0 ? baseVal + sumImps : sumImps > 0 ? sumImps : 0;

                        return (
                          <CompactListRow
                            key={`m_${m.id}`}
                            onClick={() =>
                              setSelectedEntityForDetail({ type: 'maquinaria', entity: m })
                            }
                            chevron="right"
                            icon={
                              <div className="w-8 h-8 rounded-lg bg-[#F4F7F5] border border-[#E2E7E3] flex items-center justify-center">
                                <VisualIcon name={m.icono || 'tractor'} size="xs" />
                              </div>
                            }
                            title={m.nombre}
                            subtitle={
                              <span>
                                Máquina · {baseVal > 0 ? `Base USD ${baseVal.toLocaleString()}` : 'Sin valor'}
                                {sumImps > 0 ? (
                                  <span className="text-[#24875B] font-semibold">
                                    {' '}
                                    · Mejoras USD {sumImps.toLocaleString()}
                                  </span>
                                ) : null}
                              </span>
                            }
                            rightPrimary={
                              totVal > 0 ? (
                                <span className="font-mono text-[#26352D]">
                                  USD {totVal.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-[#8A968F] font-normal text-xs">Sin valor</span>
                              )
                            }
                          />
                        );
                      })}

                      {filteredPatImplements.map((imp) => {
                        const linked = findAssetForImplement(imp, assets);
                        const baseVal = getBaseValueForImplement(imp, assets);
                        const imps = linked?.mejoras || imp.mejoras || [];
                        const sumImps = imps.reduce((a, b) => a + (b.costo || 0), 0);
                        const totVal = baseVal > 0 ? baseVal + sumImps : sumImps > 0 ? sumImps : 0;

                        return (
                          <CompactListRow
                            key={`imp_${imp.id}`}
                            onClick={() =>
                              setSelectedEntityForDetail({ type: 'implemento', entity: imp })
                            }
                            chevron="right"
                            icon={
                              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center">
                                <VisualIcon name={imp.icono || 'implemento'} size="xs" />
                              </div>
                            }
                            title={imp.nombre}
                            subtitle={
                              <span>
                                Implemento · {baseVal > 0 ? `Base USD ${baseVal.toLocaleString()}` : 'Sin valor'}
                                {sumImps > 0 ? (
                                  <span className="text-[#24875B] font-semibold">
                                    {' '}
                                    · Mejoras USD {sumImps.toLocaleString()}
                                  </span>
                                ) : null}
                              </span>
                            }
                            rightPrimary={
                              totVal > 0 ? (
                                <span className="font-mono text-[#26352D]">
                                  USD {totVal.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-[#8A968F] font-normal text-xs">Sin valor</span>
                              )
                            }
                          />
                        );
                      })}
                    </CompactList>
                  );
                })()}
              </div>
            );
          })()}

          {/* TAB 2: PROPIEDAD */}
          {activosTab === 'propiedad' && (() => {
            const totalBase = lots.reduce((acc, l) => {
              const bVal = getBaseValueForLot(l, assets);
              return acc + bVal;
            }, 0);

            const totalMejoras = lots.reduce((acc, l) => {
              const linked = findAssetForLot(l, assets);
              const sumM = (linked?.mejoras || []).reduce((a, b) => a + (b.costo || 0), 0);
              return acc + sumM;
            }, 0);

            const totalPat = totalBase + totalMejoras;
            const q = activosSearch.trim().toLowerCase();
            const filteredPatLots = lots.filter((l) =>
              !q ? true : `${l.nombre} ${l.cultivoActual || ''}`.toLowerCase().includes(q)
            );

            return (
              <div className="space-y-3">
                {/* 3-Column Compact Horizontal Summary Block */}
                <div className="rounded-2xl border border-[#E2E7E3] bg-white p-3">
                  <div className="grid grid-cols-3 divide-x divide-[#EFF2EF] text-center">
                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8780] block">
                        Base
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#26352D] font-mono mt-0.5 block truncate">
                        {totalBase > 0 ? `USD ${totalBase.toLocaleString()}` : 'Sin valor'}
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8780] block">
                        Mejoras
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#24875B] font-mono mt-0.5 block truncate">
                        USD {totalMejoras.toLocaleString()}
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8780] block">
                        Total
                      </span>
                      <span className="text-xs sm:text-sm font-black text-[#26352D] font-mono mt-0.5 block truncate">
                        {totalPat > 0 ? `USD ${totalPat.toLocaleString()}` : 'Sin valor'}
                      </span>
                    </div>
                  </div>
                </div>

                <ListToolbar
                  title="Lotes"
                  countLabel={`${filteredPatLots.length}`}
                  searchValue={activosSearch}
                  onSearchChange={setActivosSearch}
                  searchPlaceholder="Buscar lote..."
                />

                <CompactList
                  isEmpty={filteredPatLots.length === 0}
                  emptyMessage={
                    q ? 'No se encontraron lotes con esa búsqueda.' : 'No hay lotes registrados en la propiedad.'
                  }
                >
                  {filteredPatLots.map((l) => {
                    const linked = findAssetForLot(l, assets);
                    const baseVal = getBaseValueForLot(l, assets);
                    const imps = linked?.mejoras || [];
                    const sumImps = imps.reduce((a, b) => a + (b.costo || 0), 0);
                    const totVal = baseVal > 0 ? baseVal + sumImps : sumImps > 0 ? sumImps : 0;

                    return (
                      <CompactListRow
                        key={l.id}
                        onClick={() => setSelectedEntityForDetail({ type: 'lote', entity: l })}
                        chevron="right"
                        icon={
                          <div className="w-8 h-8 rounded-lg bg-[#EAF5EE] border border-[#BFE0CD]/70 text-[#24875B] flex items-center justify-center">
                            <LandPlot className="h-4 w-4" />
                          </div>
                        }
                        title={l.nombre}
                        subtitle={
                          <span>
                            {baseVal > 0 ? `Base USD ${baseVal.toLocaleString()}` : 'Sin valor'}
                            {sumImps > 0 ? (
                              <span className="text-[#24875B] font-semibold">
                                {' '}
                                · Mejoras USD {sumImps.toLocaleString()}
                              </span>
                            ) : null}
                          </span>
                        }
                        rightPrimary={
                          totVal > 0 ? (
                            <span className="font-mono text-[#26352D]">
                              USD {totVal.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[#8A968F] font-normal text-xs">Sin valor</span>
                          )
                        }
                      />
                    );
                  })}
                </CompactList>
              </div>
            );
          })()}

          {/* DETAIL MODAL / BOTTOM SHEET FOR ENTITY */}
          {selectedEntityForDetail && (() => {
            const isMachine = selectedEntityForDetail.type === 'maquinaria';
            const isImplement = selectedEntityForDetail.type === 'implemento';
            const entity = selectedEntityForDetail.entity;
            const linkedAsset = isMachine
              ? findAssetForMachine(entity as Machine, assets)
              : isImplement
              ? findAssetForImplement(entity as ImplementItem, assets)
              : findAssetForLot(entity as Lot, assets);

            const baseVal = isMachine
              ? getBaseValueForMachine(entity as Machine, assets)
              : isImplement
              ? getBaseValueForImplement(entity as ImplementItem, assets)
              : getBaseValueForLot(entity as Lot, assets);

            const imps = linkedAsset?.mejoras || (isImplement ? (entity as ImplementItem).mejoras : []) || [];
            const sumImps = imps.reduce((a, b) => a + (b.costo || 0), 0);
            const totVal = baseVal > 0 ? baseVal + sumImps : sumImps;

            return (
              <IOSModal
                isOpen={Boolean(selectedEntityForDetail)}
                onClose={() => setSelectedEntityForDetail(null)}
                title={entity.nombre}
                subtitle={
                  isMachine
                    ? 'Ficha Patrimonial — Maquinaria'
                    : isImplement
                    ? 'Ficha Patrimonial — Implemento Agrícola'
                    : 'Ficha Patrimonial — Terreno / Lote'
                }
                errorMsg={errorMsg}
                onErrorDismiss={() => setErrorMsg(null)}
              >
                <div className="space-y-4">
                  {/* Patrimonial Breakdown Box */}
                  <div className="rounded-2xl border border-[#DCE2DD] bg-white p-4 space-y-3.5 shadow-xs">
                    <div className="flex items-start justify-between gap-3 border-b border-[#E6EBE7] pb-3">
                      <div>
                        <span className="text-[11px] font-bold text-[#5E6D64] uppercase tracking-wide block">
                          Valor patrimonial · {entity.nombre}
                        </span>
                        <span className="text-xl sm:text-2xl font-black font-mono text-[#24875B] block mt-0.5">
                          {totVal > 0 ? `USD ${totVal.toLocaleString()}` : 'USD 0'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const targetEnt = selectedEntityForDetail;
                          setSelectedEntityForDetail(null);
                          if (targetEnt.type === 'maquinaria') {
                            handleEditMachine(targetEnt.entity as Machine);
                          } else if (targetEnt.type === 'implemento') {
                            handleOpenEditImplement(targetEnt.entity as ImplementItem);
                          } else {
                            handleEditLot(targetEnt.entity as Lot);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EAF5EE] hover:bg-[#DCEFE4] text-[#24875B] text-xs font-bold transition cursor-pointer shrink-0 min-h-[36px]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Editar valor inicial</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] p-2.5">
                        <span className="text-[10px] text-[#7A8780] block font-semibold uppercase">Valor inicial</span>
                        <span className="text-sm font-bold font-mono text-[#26352D] block mt-0.5">
                          USD {baseVal.toLocaleString()}
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] p-2.5">
                        <span className="text-[10px] text-[#7A8780] block font-semibold uppercase">Mejoras acumuladas</span>
                        <span className="text-sm font-bold font-mono text-[#24875B] block mt-0.5">
                          USD {sumImps.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Improvements Section */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                        <Coins className="h-4 w-4 text-emerald-700" />
                        <span>Historial de Mejoras ({imps.length})</span>
                      </h4>

                      <button
                        type="button"
                        onClick={() => {
                          setImpFecha(getLocalDateString());
                          setImpDesc('');
                          setImpCosto('');
                          setShowAddImprovementModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold transition shadow-2xs cursor-pointer min-h-[34px]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Añadir mejora</span>
                      </button>
                    </div>

                    {/* List of Improvements */}
                    <div>
                      <CompactList
                        isEmpty={imps.length === 0}
                        emptyMessage="No se han registrado mejoras posteriores para este activo."
                      >
                        {imps.map((imp) => (
                          <CompactListRow
                            key={imp.id}
                            title={imp.descripcion}
                            subtitle={`Fecha: ${imp.fecha}`}
                            rightPrimary={
                              <span className="font-mono text-[#24875B]">
                                +USD {Number(imp.costo || 0).toLocaleString()}
                              </span>
                            }
                            rightActions={
                              <div className="flex items-center gap-0.5 pl-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditImprovementClick(imp)}
                                  className="p-1 text-[#7A8780] hover:text-[#26352D] hover:bg-[#EFF2EF] rounded transition cursor-pointer"
                                  title="Editar mejora"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteImprovementClick(imp)}
                                  className="p-1 text-[#7A8780] hover:text-[#C44545] hover:bg-[#FCECEC] rounded transition cursor-pointer"
                                  title="Eliminar mejora"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            }
                          />
                        ))}
                      </CompactList>
                    </div>
                  </div>
                </div>
              </IOSModal>
            );
          })()}

          {/* ADD IMPROVEMENT MODAL */}
          <IOSModal
            isOpen={showAddImprovementModal}
            onClose={() => {
              setShowAddImprovementModal(false);
              setImpDesc('');
              setImpCosto('');
            }}
            title="Añadir Mejora al Activo"
            subtitle="Registra inversiones o equipamiento posterior"
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleAddImprovementSubmit} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Descripción de la mejora <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  value={impDesc}
                  onChange={(e) => setImpDesc(e.target.value)}
                  placeholder="Piloto automático, canal de riego, overhaul..."
                  required
                  className={`${FORM_INPUT_CLASS} font-semibold`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Costo (USD) <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={impCosto}
                    onChange={(e) => setImpCosto(e.target.value)}
                    placeholder="6000"
                    required
                    className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                  />
                </div>

                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Fecha <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="date"
                    value={impFecha}
                    onChange={(e) => setImpFecha(e.target.value)}
                    required
                    className={FORM_INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddImprovementModal(false);
                    setImpDesc('');
                    setImpCosto('');
                  }}
                  className="flex-1 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-sm font-bold text-[#26352D] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>Guardar mejora</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </IOSModal>

          {/* EDIT IMPROVEMENT MODAL */}
          {editingImprovement && (
            <IOSModal
              isOpen={Boolean(editingImprovement)}
              onClose={() => setEditingImprovement(null)}
              title="Editar mejora"
              errorMsg={errorMsg}
              onErrorDismiss={() => setErrorMsg(null)}
            >
              <form onSubmit={handleUpdateImprovementSubmit} className="space-y-3">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Descripción <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editImpDesc}
                    onChange={(e) => setEditImpDesc(e.target.value)}
                    required
                    className={`${FORM_INPUT_CLASS} font-semibold`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 items-end">
                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Costo (USD) <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={editImpCosto}
                      onChange={(e) => setEditImpCosto(e.target.value)}
                      required
                      className={`${FORM_INPUT_CLASS} font-semibold tabular-nums`}
                    />
                  </div>

                  <div>
                    <label className={FORM_LABEL_CLASS}>
                      Fecha <span className="text-[#C44545]">*</span>
                    </label>
                    <input
                      type="date"
                      value={editImpFecha}
                      onChange={(e) => setEditImpFecha(e.target.value)}
                      required
                      className={FORM_INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingImprovement(null)}
                    className="flex-1 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-sm font-bold text-[#26352D] transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        <span>Guardar cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </IOSModal>
          )}

          {/* DELETE IMPROVEMENT MODAL */}
          {deletingImprovement && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn">
              <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-stone-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Confirmar eliminación de mejora</h3>
                    <p className="text-xs text-stone-500">Se recalculará automáticamente el valor total acumulado.</p>
                  </div>
                </div>

                <div className="rounded-xl bg-stone-50 p-3 border border-stone-200 space-y-1">
                  <p className="text-xs font-bold text-stone-900">{deletingImprovement.descripcion}</p>
                  <p className="text-xs font-mono font-bold text-red-800">
                    Importe: USD {deletingImprovement.costo.toLocaleString()} &bull; Fecha: {deletingImprovement.fecha}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isDeletingImprovement}
                    onClick={() => setDeletingImprovement(null)}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[38px] disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingImprovement}
                    onClick={handleExecuteDeleteImprovement}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 transition cursor-pointer min-h-[38px] disabled:opacity-50"
                  >
                    {isDeletingImprovement ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      <span>Eliminar Mejora</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* IMPLEMENT FORM MODAL */}
          <IOSModal
            isOpen={showImplementForm}
            onClose={() => {
              setShowImplementForm(false);
              setEditingImplement(null);
              setImpFormNombre('');
              setImpFormValorInicial('');
              setErrorMsg(null);
            }}
            title={editingImplement ? 'Editar Implemento Agrícola' : 'Registrar Implemento Agrícola'}
            subtitle="Configura el nombre, icono y valor patrimonial en USD"
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleSaveImplement} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  Nombre del implemento <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  value={impFormNombre}
                  onChange={(e) => setImpFormNombre(e.target.value)}
                  placeholder="Romplow 18 discos, Sembradora John Deere..."
                  required
                  className={`${FORM_INPUT_CLASS} font-semibold`}
                />
              </div>

              <div>
                <label className={FORM_LABEL_CLASS}>Icono</label>
                <button
                  type="button"
                  onClick={() => setShowImpFormIconSheet(true)}
                  className="w-full h-[40px] flex items-center justify-between px-3 rounded-xl border border-[#CFD8D2] bg-white hover:border-[#24875B] transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <VisualIcon name={impFormIcono || 'implemento'} size="xs" />
                    <span className="text-sm font-semibold text-[#1F2D25] truncate">
                      {getIconDefinition(impFormIcono || 'implemento').label}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#24875B] shrink-0">Elegir</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    Valor inicial (USD){' '}
                    <span className="text-[12px] font-normal text-[#7A8780]">(opcional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7A8780]">
                      USD
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={impFormValorInicial}
                      onChange={(e) => setImpFormValorInicial(e.target.value)}
                      placeholder="18000"
                      className={`${FORM_INPUT_CLASS} pl-11 font-semibold font-mono tabular-nums`}
                    />
                  </div>
                </div>

                <div>
                  <label className={FORM_LABEL_CLASS}>Fecha de adquisición</label>
                  <input
                    type="date"
                    value={impFormFecha}
                    onChange={(e) => setImpFormFecha(e.target.value)}
                    className={FORM_INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowImplementForm(false);
                    setEditingImplement(null);
                    setImpFormNombre('');
                    setImpFormValorInicial('');
                  }}
                  className="flex-1 h-[42px] rounded-xl border border-[#D4DDD6] bg-white hover:bg-[#F5F7F4] text-sm font-bold text-[#26352D] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingImplement}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingImplement ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{editingImplement ? 'Guardar cambios' : 'Guardar implemento'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </IOSModal>

          <IconBottomSheet
            isOpen={showImpFormIconSheet}
            onClose={() => setShowImpFormIconSheet(false)}
            category="implemento"
            selectedIconId={impFormIcono}
            onSelectIcon={(icon) => {
              setImpFormIcono(icon.id);
              setShowImpFormIconSheet(false);
            }}
            title="Elegir icono de implemento agrícola"
          />
        </div>
      )}
      {renderReauthModal()}
    </div>
  );
};
