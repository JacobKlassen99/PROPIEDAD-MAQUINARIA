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
  Languages,
  Wallet,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';
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
  Customer,
  PaymentSettings,
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
import { CustomersView } from './CustomersView';
import { PaymentSettingsView } from './PaymentSettingsView';
import { AccountsReceivableView } from './AccountsReceivableView';
import { LanguageFlag } from '../components/FlagIcons';
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
} from '../components/AppSelect';
import { ObservationField } from '../components/ObservationField';
import { Switch } from '../components/Switch';
import { useI18n } from '../services/i18n';
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
  customers?: Customer[];
  paymentSettings?: PaymentSettings | null;
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
  | 'activos'
  | 'clientes'
  | 'cuentas_cobrar'
  | 'config_cobros'
  | 'language';

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
  customers = [],
  paymentSettings = null,
  exchangeRate,
  onExchangeRateUpdated,
  currency,
  isSyncingGlobal,
  onRefreshData,
  onRevokeAuthorization,
  onFinanzasModeChange,
}) => {
  const { lang, setLang, bi, t, translateError, translateIcon, translateStatus } = useI18n();
  const translateMachineTypeLabel = (rawTipo: string): string => {
    if (lang === 'es') return rawTipo;
    const norm = rawTipo.trim().toLowerCase();
    const map: Record<string, string> = {
      tractor: 'Tractor',
      cosechadora: 'Harvester',
      fumigadora: 'Sprayer',
      camión: 'Truck',
      camion: 'Truck',
      vehículo: 'Vehicle',
      vehiculo: 'Vehicle',
      otro: 'Other',
    };
    return map[norm] || rawTipo;
  };

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
      setAuthError(bi('Por favor ingresa la contraseña de administrador.', 'Please enter the administrator password.'));
      return;
    }
    setAuthorizing(true);
    setAuthError(null);
    try {
      await authorizeAdminDevice(adminPasswordInput.trim());
      setIsAuthorized(true);
      setAdminPasswordInput('');
      setSuccessMsg(bi('Dispositivo autorizado como Administrador.', 'Device authorized as Administrator.'));
      onRefreshData();
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al autorizar dispositivo', 'Error authorizing device')
      );
    } finally {
      setAuthorizing(false);
    }
  };

  const handleReauthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reauthPassword.trim()) {
      setReauthError(bi('Por favor ingresa la contraseña de administrador.', 'Please enter the administrator password.'));
      return;
    }
    setReauthorizing(true);
    setReauthError(null);
    try {
      await authorizeAdminDevice(reauthPassword.trim());
      setIsAuthorized(true);
      setShowReauthModal(false);
      setReauthPassword('');
      setSuccessMsg(
        bi(
          'Dispositivo autorizado. Puedes guardar tus cambios ahora.',
          'Device authorized. You can save your changes now.'
        )
      );
    } catch (err: unknown) {
      setReauthError(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al autorizar dispositivo', 'Error authorizing device')
      );
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
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al revocar dispositivo', 'Error revoking device')
      );
    } finally {
      setRevoking(false);
    }
  };

  const [screen, setScreenState] = useState<AdminScreen>('main');
  const [prevScreen, setPrevScreen] = useState<AdminScreen>('settings');
  const [arInitialCustomerId, setArInitialCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthorized && screen !== 'main' && screen !== 'language') {
      setScreenState('main');
      setArInitialCustomerId(null);
    }
  }, [isAuthorized, screen]);

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
    if (target !== 'cuentas_cobrar') {
      setArInitialCustomerId(null);
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
    if (screen === 'cuentas_cobrar') {
      setArInitialCustomerId(null);
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


  // Machine & Implement Deletion Modal State
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMachineError, setDeleteMachineError] = useState<string | null>(null);
  const [deletingJobType, setDeletingJobType] = useState<MachineJobType | null>(null);
  const [isDeletingJobType, setIsDeletingJobType] = useState(false);
  const [deleteJobTypeError, setDeleteJobTypeError] = useState<string | null>(null);

  // Machine Job Types & Machines/Implements Management State
  const [selectedAdminMachine, setSelectedAdminMachine] = useState<Machine | null>(null);
  const [selectedAdminImplement, setSelectedAdminImplement] = useState<MachineJobType | null>(null);
  const [machineSearch, setMachineSearch] = useState('');
  const [machineShowInactive, setMachineShowInactive] = usePersistedMemoryState<boolean>('admin.machines.showInactive', false);
  const [implementShowInactive, setImplementShowInactive] = usePersistedMemoryState<boolean>('admin.implements.showInactive', false);
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
      setErrorMsg(bi('El nombre del implemento es obligatorio.', 'The implement name is required.'));
      return;
    }
    if (isVirtualMachineOnlyImplement(nombreLimpio)) {
      setErrorMsg(
        bi(
          'Ese nombre corresponde a la máquina sola y no debe registrarse como implemento.',
          'That name represents the machine alone and should not be registered as an implement.'
        )
      );
      return;
    }
    if (!jtCompatibleTipo.trim()) {
      setErrorMsg(bi('Selecciona el tipo de máquina compatible.', 'Select the compatible machine type.'));
      return;
    }
    if (!jtTarifa.trim()) {
      setErrorMsg(
        bi(
          'Ingresa y confirma la tarifa del implemento antes de guardar.',
          'Enter and confirm the implement rate before saving.'
        )
      );
      return;
    }
    const tarifaVal = parseDecimalNumber(jtTarifa);
    if (isNaN(tarifaVal) || tarifaVal <= 0) {
      setErrorMsg(bi('Ingresa una tarifa válida mayor a 0.', 'Enter a valid rate greater than 0.'));
      return;
    }

    if (!editingJobTypeId) {
      const normNew = nombreLimpio.toLowerCase();
      const dup = (machineJobTypes || []).find(
        (jt) => jt.nombre.trim().toLowerCase() === normNew
      );
      if (dup) {
        setErrorMsg(
          bi(
            `El implemento "${dup.nombre}" ya existe en el catálogo.`,
            `The implement "${dup.nombre}" already exists in the catalog.`
          )
        );
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
        bi(
          `Registra primero una máquina de tipo "${jtCompatibleTipo}" para vincular este implemento.`,
          `Register a "${translateMachineTypeLabel(jtCompatibleTipo)}" machine first to link this implement.`
        )
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
          ? bi('Implemento agrícola actualizado.', 'Agricultural implement updated.')
          : bi('Implemento agrícola registrado.', 'Agricultural implement registered.')
      );
      setShowJobTypeModal(false);
      setSelectedAdminImplement(null);
      onRefreshData('catalogs_and_assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al guardar el implemento', 'Error saving the implement')
      );
    } finally {
      setIsSavingJobType(false);
    }
  };

  const getMachineHistoryCounts = (machineOrId: Machine | string) => {
    const machineId = typeof machineOrId === 'string' ? machineOrId : machineOrId.id;
    const machineObj =
      typeof machineOrId === 'string'
        ? machines.find((m) => String(m.id) === String(machineId))
        : machineOrId;
    const jobsCount = jobs.filter((j) => String(j.maquinariaId) === String(machineId)).length;
    const expensesCount = expenses.filter((e) => String(e.maquinariaId) === String(machineId)).length;
    const mName = String(machineObj?.nombre || '').trim().toLowerCase();
    const mIdent = String(machineObj?.identificacion || '').trim().toLowerCase();
    const assetsCount = (assets || []).filter((a) => {
      if (a.activo === false) return false;
      const tipo = String(a.tipo || '').toUpperCase();
      if (tipo === 'IMPLEMENTO' || tipo === 'LOTE') return false;
      const hasPatrimonialData =
        (Number(a.valorInicial) || 0) > 0 || (Array.isArray(a.mejoras) && a.mejoras.length > 0);
      if (!hasPatrimonialData) return false;
      const refId = String(a.referenciaId || '').trim();
      const ident = String(a.identificador || '').trim();
      const aName = String(a.nombre || '').trim().toLowerCase();
      return (
        refId === String(machineId) ||
        ident === String(machineId) ||
        (mIdent.length > 0 && (refId.toLowerCase() === mIdent || ident.toLowerCase() === mIdent)) ||
        (mName.length > 0 && aName === mName)
      );
    }).length;
    return { jobsCount, expensesCount, assetsCount, total: jobsCount + expensesCount + assetsCount };
  };

  const getJobTypeHistoryCounts = (jt: MachineJobType) => {
    const targetId = String(jt.id || '').trim();
    const targetName = String(jt.nombre || '').trim().toLowerCase();
    const jobsCount = jobs.filter(
      (j) =>
        (j.trabajoTipoId && targetId.length > 0 && String(j.trabajoTipoId) === targetId) ||
        (String(j.maquinariaId) === String(jt.maquinaId) &&
          targetName.length > 0 &&
          String(j.trabajoNombre || '').trim().toLowerCase() === targetName)
    ).length;
    const assetsCount = (assets || []).filter((a) => {
      if (a.activo === false) return false;
      if (String(a.tipo || '').toUpperCase() !== 'IMPLEMENTO') return false;
      const hasPatrimonialData =
        (Number(a.valorInicial) || 0) > 0 || (Array.isArray(a.mejoras) && a.mejoras.length > 0);
      if (!hasPatrimonialData) return false;
      const refId = String(a.referenciaId || '').trim();
      const ident = String(a.identificador || '').trim();
      const aName = String(a.nombre || '').trim().toLowerCase();
      return (
        (targetId.length > 0 && (refId === targetId || ident === targetId || String(a.id) === targetId)) ||
        (targetName.length > 0 && aName === targetName)
      );
    }).length;
    return { jobsCount, assetsCount, total: jobsCount + assetsCount };
  };

  const hasJobTypeHistory = (jt: MachineJobType): boolean => {
    return getJobTypeHistoryCounts(jt).total > 0;
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
          ? bi(
              `"${m.nombre}" desactivada. No aparecerá en nuevos servicios pero conserva su historial.`,
              `"${m.nombre}" deactivated. It will not appear in new services while preserving its history.`
            )
          : bi(
              `"${m.nombre}" reactivada y disponible para nuevos servicios.`,
              `"${m.nombre}" reactivated and available for new services.`
            )
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al actualizar estado de la máquina', 'Error updating machine status')
      );
    } finally {
      setTogglingMachineId(null);
    }
  };

  const handleToggleJobTypeActive = async (jt: MachineJobType) => {
    const isCurrentlyActive = jt.activo !== false;
    const parentMachine = machines.find((m) => String(m.id) === String(jt.maquinaId));
    setTogglingJobTypeId(jt.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await saveMachineJobType({
        id: jt.id,
        maquinaId: jt.maquinaId,
        tipoMaquina: jt.tipoMaquina || parentMachine?.tipo || 'Tractor',
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
          ? bi(`Implemento "${jt.nombre}" desactivado.`, `Implement "${jt.nombre}" deactivated.`)
          : bi(`Implemento "${jt.nombre}" reactivado.`, `Implement "${jt.nombre}" reactivated.`)
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al actualizar estado del implemento', 'Error updating implement status')
      );
    } finally {
      setTogglingJobTypeId(null);
    }
  };

  const handleDeleteJobTypeClick = (jt: MachineJobType) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setDeleteJobTypeError(null);
    setSelectedAdminImplement(null);
    setDeletingJobType(jt);
  };

  const handleExecuteDeleteJobType = async () => {
    if (!deletingJobType || isDeletingJobType) return;
    const target = deletingJobType;
    setIsDeletingJobType(true);
    setDeleteJobTypeError(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteMachineJobType(target.id);
      await onRefreshData('catalogs_and_assets');
      setDeletingJobType(null);
      setSelectedAdminImplement(null);
      setSuccessMsg(
        bi(
          `Implemento "${target.nombre}" eliminado definitivamente.`,
          `Implement "${target.nombre}" permanently deleted.`
        )
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      const msg =
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al eliminar implemento agrícola', 'Error deleting agricultural implement');
      setDeleteJobTypeError(msg);
      setErrorMsg(msg);
    } finally {
      setIsDeletingJobType(false);
    }
  };

  // Submit Campaign
  const handleCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!cNombre.trim()) {
      setErrorMsg(bi('El nombre de la campaña es obligatorio.', 'Campaign name is required.'));
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

      setSuccessMsg(
        bi(
          `Campaña "${cNombre.trim()}" creada exitosamente.`,
          `Campaign "${cNombre.trim()}" created successfully.`
        )
      );
      setCNombre('');
      setShowCampaignForm(false);
      onRefreshData('catalogs');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al guardar campaña', 'Error saving campaign')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleActivateCampaign = async (campaignId: string) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await setActiveCampaign(campaignId);
      setSuccessMsg(bi('Campaña activa actualizada exitosamente.', 'Active campaign updated successfully.'));
      onRefreshData('catalogs');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al cambiar campaña activa', 'Error changing active campaign')
      );
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
      setErrorMsg(bi('El nombre del lote es obligatorio.', 'Lot name is required.'));
      return;
    }

    const rawStr = String(lotSuperficie).trim();
    const parsedSup = parseDecimalNumber(rawStr);
    if (!rawStr || isNaN(parsedSup) || parsedSup <= 0) {
      setErrorMsg(
        bi(
          'Ingresa una superficie en hectáreas válida (ejemplo: 50 o 50,5).',
          'Enter a valid area in hectares (example: 50 or 50.5).'
        )
      );
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
          ? bi(
              `Lote "${savedLot.nombre}" guardado y sincronizado exitosamente.`,
              `Lot "${savedLot.nombre}" saved and synced successfully.`
            )
          : bi(
              `Lote "${savedLot.nombre}" creado exitosamente.`,
              `Lot "${savedLot.nombre}" created successfully.`
            )
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al guardar el lote', 'Error saving the lot')
      );
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
    if (!window.confirm(bi('¿Confirmas eliminar este lote?', 'Confirm deleting this lot?'))) return;
    try {
      await deleteLot(id);
      setSuccessMsg(bi('Lote eliminado correctamente.', 'Lot deleted successfully.'));
      onRefreshData('catalogs_and_assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al eliminar el lote', 'Error deleting the lot')
      );
    }
  };

  // Submit Machine
  const handleMachineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!mNombre.trim()) {
      setErrorMsg(bi('El nombre de la maquinaria es obligatorio.', 'Machine name is required.'));
      return;
    }
    if (!mTipo.trim()) {
      setErrorMsg(bi('Selecciona el tipo de máquina.', 'Select the machine type.'));
      return;
    }

    const tarifaParsed = parseDecimalNumber(mTarifa);
    if (!mTarifa || isNaN(tarifaParsed) || tarifaParsed <= 0) {
      setErrorMsg(bi('Ingresa una tarifa válida (ejemplo: 250).', 'Enter a valid rate (example: 250).'));
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
          ? bi(
              `Maquinaria "${savedMachine.nombre}" guardada y sincronizada exitosamente.`,
              `Machine "${savedMachine.nombre}" saved and synced successfully.`
            )
          : bi(
              `Maquinaria "${savedMachine.nombre}" registrada exitosamente.`,
              `Machine "${savedMachine.nombre}" registered successfully.`
            )
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al guardar maquinaria', 'Error saving machine')
      );
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
    setDeleteMachineError(null);
    setSelectedAdminMachine(null);
    setDeletingMachine(m);
  };

  const handleExecuteDeleteMachine = async () => {
    if (!deletingMachine || isDeleting) return;
    const target = deletingMachine;
    setIsDeleting(true);
    setDeleteMachineError(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteMachine(target.id);
      await onRefreshData('catalogs_and_assets');
      setDeletingMachine(null);
      setSelectedAdminMachine(null);
      setSuccessMsg(
        bi(
          `Maquinaria "${target.nombre}" eliminada definitivamente.`,
          `Machine "${target.nombre}" permanently deleted.`
        )
      );
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      const msg =
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al eliminar la maquinaria', 'Error deleting machine');
      setDeleteMachineError(msg);
      setErrorMsg(msg);
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
          bi(
            `Ajuste manual conservado. Cotización oficial BCB: Bs ${formatExchangeRateNumber(res.bcbPreviewRate)}.`,
            `Manual override kept. Official BCB rate: Bs ${formatExchangeRateNumber(res.bcbPreviewRate)}.`
          )
        );
      } else {
        setBcbPreview(null);
        setShowManualRateForm(false);
        const vigLabel = res.config.fechaCotizacion
          ? bi(
              ` (vigencia ${formatExchangeRateDate(res.config.fechaCotizacion)})`,
              ` (effective ${formatExchangeRateDate(res.config.fechaCotizacion)})`
            )
          : '';
        if (switchToOfficial) {
          setSuccessMsg(
            bi(
              `Tipo de cambio oficial BCB restablecido: 1 USD = Bs ${formatExchangeRateNumber(res.config.tasaBobPerUsd)}${vigLabel}.`,
              `Official BCB exchange rate restored: 1 USD = Bs ${formatExchangeRateNumber(res.config.tasaBobPerUsd)}${vigLabel}.`
            )
          );
        } else if (res.updated) {
          setSuccessMsg(
            bi(
              `Cotización oficial BCB actualizada: 1 USD = Bs ${formatExchangeRateNumber(res.config.tasaBobPerUsd)}${vigLabel}.`,
              `Official BCB rate updated: 1 USD = Bs ${formatExchangeRateNumber(res.config.tasaBobPerUsd)}${vigLabel}.`
            )
          );
        } else {
          setSuccessMsg(
            bi(
              `Cotización oficial BCB al día: 1 USD = Bs ${formatExchangeRateNumber(res.config.tasaBobPerUsd)}${vigLabel}.`,
              `Official BCB rate is up to date: 1 USD = Bs ${formatExchangeRateNumber(res.config.tasaBobPerUsd)}${vigLabel}.`
            )
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
        err instanceof Error
          ? translateError(err.message)
          : bi(
              'No se pudo consultar la cotización oficial del BCB.',
              'Could not fetch the official BCB exchange rate.'
            )
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
      setErrorMsg(
        bi(
          'Ingresa un tipo de cambio válido mayor a 0 (ejemplo: 11,75).',
          'Enter a valid exchange rate greater than 0 (example: 11.75).'
        )
      );
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
        bi(
          `Ajuste manual guardado: 1 USD = Bs ${formatExchangeRateNumber(res?.tasaBobPerUsd || parsedTasa)}.`,
          `Manual override saved: 1 USD = Bs ${formatExchangeRateNumber(res?.tasaBobPerUsd || parsedTasa)}.`
        )
      );
      onRefreshData('fx');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al guardar el tipo de cambio', 'Error saving exchange rate')
      );
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
      setSuccessMsg(bi('Activo patrimonial registrado.', 'Asset registered.'));
      setANombre('');
      setShowAssetForm(false);
      onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al guardar activo', 'Error saving asset')
      );
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
      setErrorMsg(bi('El nombre del implemento es obligatorio.', 'The implement name is required.'));
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
        setSuccessMsg(
          bi(
            `Implemento "${impFormNombre.trim()}" actualizado.`,
            `Implement "${impFormNombre.trim()}" updated.`
          )
        );
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
        setSuccessMsg(
          bi(
            `Implemento "${impFormNombre.trim()}" registrado exitosamente.`,
            `Implement "${impFormNombre.trim()}" registered successfully.`
          )
        );
      }

      setShowImplementForm(false);
      setEditingImplement(null);
      await onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al guardar el implemento agrícola', 'Error saving agricultural implement')
      );
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
      setErrorMsg(
        bi('Ingresa un costo válido en USD para la mejora.', 'Enter a valid cost in USD for the improvement.')
      );
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

      setSuccessMsg(bi('Mejora registrada exitosamente.', 'Improvement registered successfully.'));
      setImpDesc('');
      setImpCosto('');
      setShowAddImprovementModal(false);
      await onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al registrar la mejora', 'Error registering improvement')
      );
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
      setErrorMsg(bi('Ingresa un costo válido en USD.', 'Enter a valid cost in USD.'));
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

      setSuccessMsg(bi('Mejora actualizada exitosamente.', 'Improvement updated successfully.'));
      setEditingImprovement(null);
      onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al actualizar la mejora', 'Error updating improvement')
      );
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
      setSuccessMsg(bi('Mejora eliminada exitosamente.', 'Improvement deleted successfully.'));
      setDeletingImprovement(null);
      onRefreshData('assets');
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al eliminar la mejora', 'Error deleting improvement')
      );
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
      setErrorMsg(bi('El nombre del concepto es obligatorio.', 'Concept name is required.'));
      return;
    }
    if (itemModulo !== 'MAQUINARIAS' && itemModulo !== 'PROPIEDAD') {
      setErrorMsg(bi('Selecciona el módulo al que pertenece este concepto.', 'Select the module this concept belongs to.'));
      return;
    }
    if (
      editingItemId &&
      editingItemHasHistory &&
      editingItemOriginalModulo &&
      itemModulo !== editingItemOriginalModulo
    ) {
      setErrorMsg(
        bi(
          'No se puede cambiar el módulo de un concepto con movimientos registrados. Crea un nuevo concepto para el otro módulo.',
          'You cannot change the module of a concept with existing records. Create a new concept for the other module.'
        )
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
          ? bi(`Concepto "${itemName.trim()}" actualizado.`, `Concept "${itemName.trim()}" updated.`)
          : bi(`Concepto "${itemName.trim()}" creado.`, `Concept "${itemName.trim()}" created.`)
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
      setErrorMsg(
        err instanceof Error
          ? translateError(err.message)
          : bi('Error al guardar el concepto', 'Error saving the concept')
      );
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
              {bi('Autorización Requerida', 'Authorization Required')}
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              {bi(
                'Ingresa la contraseña de administrador (CONTRASENA_ADMIN) para completar esta operación sin perder los datos editados.',
                'Enter the administrator password (CONTRASENA_ADMIN) to complete this action without losing your edits.'
              )}
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
                {bi('Contraseña de Administrador', 'Administrator Password')}
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
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={reauthorizing || !reauthPassword.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#367C2B] hover:bg-emerald-800 text-xs font-semibold text-white transition cursor-pointer shadow-xs min-h-[40px] disabled:opacity-50"
              >
                {reauthorizing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>{bi('Autorizando...', 'Authorizing...')}</span>
                  </>
                ) : (
                  <span>{bi('Autorizar', 'Authorize')}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // LANGUAGE SCREEN — Accessible to both administrators and regular users without unlocking restricted admin features
  if (screen === 'language') {
    const languageOptions: Array<{
      code: 'es' | 'en';
      label: string;
    }> = [
      { code: 'es', label: 'Español' },
      { code: 'en', label: 'English' },
    ];

    return (
      <div className="space-y-4 max-w-2xl mx-auto w-full animate-fadeIn">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#E2E7E3]">
          <button
            type="button"
            onClick={() => setScreenState('main')}
            aria-label={t('common.back')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-bold text-[#26352D] tracking-tight leading-tight">
            {t('admin.languageTitle')}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
          {languageOptions.map((opt) => {
            const isSelected = lang === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => setLang(opt.code)}
                aria-pressed={isSelected}
                className={`w-full flex items-center justify-between px-4 py-4 transition cursor-pointer text-left min-h-[64px] ${
                  isSelected
                    ? 'bg-[#EAF5EE]/80'
                    : 'bg-white hover:bg-[#F5F7F4] active:bg-[#EDF1EC]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <LanguageFlag lang={opt.code} className="h-5 w-7 rounded-[3px] shadow-2xs shrink-0" />
                  <span
                    className={`text-base font-bold leading-snug ${
                      isSelected ? 'text-[#1D5C3F]' : 'text-[#26352D]'
                    }`}
                  >
                    {opt.label}
                  </span>
                </div>
                {isSelected && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#24875B] text-white">
                    <Check className="h-4 w-4 stroke-[2.5]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // AUTHORIZATION GATE: If device is not authorized and not in mid-edit reauthorization
  if (!isAuthorized && !showReauthModal) {
    return (
      <div className="space-y-5 max-w-md mx-auto w-full px-2 py-4 animate-fadeIn">
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
            <span>{bi('Volver a Inicio', 'Back to Home')}</span>
          </button>
        </div>

        {/* Authorization Card */}
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
              {bi('Acceso de administrador', 'Administrator access')}
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
                {bi('Contraseña', 'Password')}
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder={bi('Ingrese contraseña', 'Enter password')}
                  autoComplete="current-password"
                  autoFocus
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  title={showAdminPassword ? bi('Ocultar', 'Hide') : bi('Mostrar', 'Show')}
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
                  <span>{bi('Ingresando...', 'Signing in...')}</span>
                </>
              ) : (
                <span>{bi('Ingresar', 'Sign in')}</span>
              )}
            </button>
          </form>
        </div>

        {/* Standalone Language access for non-admin users (does not unlock admin options) */}
        <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setScreenState('language')}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[64px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700">
                <Languages className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#26352D] leading-snug">
                  {t('admin.languageTitle')}
                </h3>
                <p className="text-xs text-[#5E6D64] truncate mt-0.5 flex items-center gap-1.5">
                  <LanguageFlag lang={lang} className="h-3.5 w-5 rounded-[2px] shrink-0" />
                  <span>{lang === 'es' ? 'Español' : 'English'}</span>
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
          </button>
        </div>
      </div>
    );
  }

  // RENDER LEVEL 3: Finanzas (Consolidado / Maquinarias / Propiedad)
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
          onRootBackLabel={bi('Volver a Administración', 'Back to Administration')}
          onBack={handleGoBack}
        />
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 2: Clientes
  if (screen === 'clientes') {
    return (
      <div className="space-y-4 w-full">
        <CustomersView
          customers={customers}
          onRefresh={() => onRefreshData('customers')}
          onBack={handleGoBack}
          isRefreshing={isSyncingGlobal}
          onOpenCustomerAccount={(clienteId) => {
            setArInitialCustomerId(clienteId);
            setScreenState('cuentas_cobrar');
          }}
        />
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 2: Configuración de cobros
  if (screen === 'config_cobros') {
    return (
      <div className="space-y-4 w-full">
        <PaymentSettingsView
          paymentSettings={paymentSettings}
          onRefresh={() => onRefreshData('paymentSettings')}
          onBack={handleGoBack}
        />
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 2: Cuentas por cobrar
  if (screen === 'cuentas_cobrar') {
    return (
      <div className="space-y-4 w-full">
        <AccountsReceivableView
          customers={customers}
          exchangeRate={exchangeRate}
          initialCustomerId={arInitialCustomerId}
          onBack={handleGoBack}
          onDataMutated={() => onRefreshData('all')}
        />
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 1: Main Administration Screen (12 opciones en orden oficial con separación financiera)
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
              ? bi('Ajuste manual', 'Manual override')
              : isFxBcbVerified
              ? bi('Cotización BCB verificada', 'Verified BCB rate')
              : exchangeRate.estado === 'sin_conexion'
              ? bi('Consulta fallida (valor guardado)', 'Lookup failed (saved value)')
              : bi('Valor guardado', 'Saved value')
          }`
        : bi('Consulta pendiente', 'Pending lookup');

    const activeMachinesCount = machines.filter(
      (m) => m.estado !== 'inactivo' && m.activo !== false
    ).length;

    const implementsCount = (machineJobTypes || []).filter(
      (jt) => !isVirtualMachineOnlyImplement(jt.nombre)
    ).length;

    const activeCustomersCount = customers.filter((c) => c.activo !== false).length;

    const paymentSettingsSummary = paymentSettings?.configurado
      ? [
          paymentSettings.plazoDiasPredeterminado !== null && paymentSettings.plazoDiasPredeterminado !== undefined
            ? bi(`Plazo: ${paymentSettings.plazoDiasPredeterminado} días`, `Term: ${paymentSettings.plazoDiasPredeterminado} days`)
            : null,
          paymentSettings.aplicarInteresPorDefecto && paymentSettings.porcentajeInteresMensual
            ? bi(`Mora: ${paymentSettings.porcentajeInteresMensual}% mensual`, `Interest: ${paymentSettings.porcentajeInteresMensual}%/mo`)
            : bi('Sin interés por defecto', 'No default interest'),
        ]
          .filter(Boolean)
          .join(' · ')
      : bi('Plazo de pago e interés por mora', 'Payment term and late-payment interest');

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

        {/* Bloque Financiero (1–3) */}
        <section className="space-y-2.5" aria-label={bi('Gestión financiera', 'Financial management')}>
          <h2 className="text-sm font-bold text-[#526058] px-0.5">
            {t('nav.admin')}
          </h2>

          <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
            {/* 1. Finanzas */}
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
                    {t('reports.title')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {bi(
                      'Consolidado, Maquinarias y Propiedad por campaña',
                      'Consolidated, Machinery and Property by campaign'
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 2. Patrimonio */}
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
                    {bi('Patrimonio', 'Assets')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {bi(
                      'Valoración y mejoras de máquinas y lotes',
                      'Valuation and improvements of machines and lots'
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 3. Cuentas por cobrar */}
            <button
              type="button"
              onClick={() => navigateTo('cuentas_cobrar')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    {t('ar.title')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {bi(
                      'Saldos por cliente, intereses, cobros y documentos',
                      'Customer balances, interest, payments and documents'
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>
          </div>
        </section>

        {/* Bloque Operativo y Configuración (4–12) */}
        <section className="space-y-2.5" aria-label={bi('Catálogos y configuración', 'Catalogs and configuration')}>
          <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EFF2EF] overflow-hidden">
            {/* 4. Máquinas e implementos */}
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
                    {bi('Máquinas e implementos', 'Machines & implements')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {bi(
                      `${activeMachinesCount} de ${machines.length} activas · ${implementsCount} implementos`,
                      `${activeMachinesCount} of ${machines.length} active · ${implementsCount} implements`
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 5. Lotes */}
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
                    {bi('Lotes', 'Lots')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {lots.length}{' '}
                    {lots.length === 1
                      ? bi('lote en propiedad', 'property lot')
                      : bi('lotes en propiedad', 'property lots')}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 6. Clientes */}
            <button
              type="button"
              onClick={() => navigateTo('clientes')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 border border-sky-200/80 text-sky-700">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    {t('customers.title')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {activeCustomersCount}{' '}
                    {activeCustomersCount === 1
                      ? bi('cliente activo', 'active customer')
                      : bi('clientes activos', 'active customers')}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 7. Conceptos */}
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
                    {bi('Conceptos', 'Concepts')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {bi(
                      `${itemsConfig.length} rubros de gastos e ingresos`,
                      `${itemsConfig.length} expense and income categories`
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 8. Tipo de cambio */}
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
                    {bi('Tipo de cambio', 'Exchange rate')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5 tabular-nums">
                    {fxStatusSummary}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 9. Campañas */}
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
                    {bi('Campañas', 'Campaigns')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {activeCampaignObj
                      ? bi(`Activa: ${activeCampaignObj.nombre}`, `Active: ${activeCampaignObj.nombre}`)
                      : bi(`${campaigns.length} campañas`, `${campaigns.length} campaigns`)}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 10. Configuración de cobros */}
            <button
              type="button"
              onClick={() => navigateTo('config_cobros')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 border border-stone-200/80 text-stone-700">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    {t('paymentSettings.title')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {paymentSettingsSummary}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 11. Usuarios */}
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
                    {bi('Usuarios', 'Users')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                    {bi(
                      'Cuentas de acceso y cambio de contraseña',
                      'Access accounts and password changes'
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#8A968F] shrink-0 ml-2" />
            </button>

            {/* 12. Idioma */}
            <button
              type="button"
              onClick={() => navigateTo('language')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#F5F7F4] active:bg-[#EDF1EC] transition cursor-pointer text-left min-h-[70px]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700">
                  <Languages className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#26352D] leading-snug">
                    {t('admin.languageTitle')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5 flex items-center gap-1.5">
                    <LanguageFlag lang={lang} className="h-3.5 w-5 rounded-[2px] shrink-0" />
                    <span>{lang === 'es' ? 'Español' : 'English'}</span>
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
        name: bi('Administrador', 'Administrator'),
        description: bi('Acceso completo', 'Full access'),
        status: bi('Activo', 'Active'),
      },
      {
        role: 'usuario',
        name: bi('Usuario', 'User'),
        description: bi('Registro y consulta', 'Record and view'),
        status: bi('Activo', 'Active'),
      },
    ];

    const hasAdditionalUsers = systemAccounts.length > 2;
    const qUser = hasAdditionalUsers ? userSearch.trim().toLowerCase() : '';
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
        setPwdErrorMsg(bi('Ingresa la contraseña actual de Administrador.', 'Enter the current Administrator password.'));
        return;
      }

      if (!pwdNew.trim()) {
        setPwdErrorMsg(bi('Ingresa la nueva contraseña.', 'Enter the new password.'));
        return;
      }

      if (pwdNew.trim().length < 8) {
        setPwdErrorMsg(bi('La nueva contraseña debe tener al menos 8 caracteres.', 'The new password must be at least 8 characters long.'));
        return;
      }

      if (pwdNew !== pwdConfirm) {
        setPwdErrorMsg(bi('Las contraseñas nuevas no coinciden.', 'The new passwords do not match.'));
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
            bi('Contraseña de Administrador actualizada. Redirigiendo...', 'Administrator password updated. Redirecting...')
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
          setPwdSuccessMsg(bi('Contraseña de Usuario actualizada.', 'User password updated.'));
          setPwdCurrentAdmin('');
          setPwdNew('');
          setPwdConfirm('');
        }
      } catch (err: unknown) {
        setPwdErrorMsg(
          err instanceof Error
            ? translateError(err.message)
            : bi('Error al cambiar la contraseña', 'Error changing password')
        );
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
            aria-label={bi('Volver a Administración', 'Back to Administration')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-bold text-[#26352D] tracking-tight leading-tight">
            {bi('Usuarios', 'Users')}
          </h2>
        </div>

        {hasAdditionalUsers && (
          <ListToolbar
            countLabel={`${filteredAccounts.length}`}
            searchValue={userSearch}
            onSearchChange={setUserSearch}
            searchPlaceholder={bi('Buscar cuenta o rol...', 'Search account or role...')}
            filters={
              <CompactFilter
                value={userStatusFilter}
                onChange={(val) => setUserStatusFilter(val as 'activos' | 'todos')}
                ariaLabel={bi('Filtrar estado de usuarios', 'Filter user status')}
                options={[
                  { value: 'activos', label: bi('Activos', 'Active') },
                  { value: 'todos', label: bi('Todos', 'All') },
                ]}
              />
            }
          />
        )}

        <CompactList
          isEmpty={filteredAccounts.length === 0}
          emptyMessage={bi('No se encontraron cuentas.', 'No accounts found.')}
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

        {/* Modal Ficha de Cuenta + Cambio de Contraseña */}
        <IOSModal
          isOpen={selectedAccount !== null}
          onClose={() => {
            setSelectedUserRole(null);
            setPwdErrorMsg(null);
            setPwdSuccessMsg(null);
          }}
          title={selectedAccount ? selectedAccount.name : bi('Cuenta', 'Account')}
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
                <h3 className="text-xs font-bold text-[#26352D]">
                  {bi('Cambiar contraseña', 'Change password')}
                </h3>
              </div>

              <form onSubmit={handleInitiatePasswordChange} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#26352D]">
                    {bi('Contraseña actual de Administrador', 'Current Administrator password')}
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
                      title={showPwdCurrent ? bi('Ocultar', 'Hide') : bi('Ver', 'Show')}
                    >
                      {showPwdCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#26352D]">
                    {bi('Nueva contraseña', 'New password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPwdNew ? 'text' : 'password'}
                      value={pwdNew}
                      onChange={(e) => setPwdNew(e.target.value)}
                      placeholder={bi('Mínimo 8 caracteres', 'Minimum 8 characters')}
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] px-3.5 py-2.5 pr-10 text-xs text-[#26352D] focus:bg-white focus:border-[#24875B] focus:outline-none transition min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdNew(!showPwdNew)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6C7A72] hover:text-[#26352D] transition cursor-pointer"
                      title={showPwdNew ? bi('Ocultar', 'Hide') : bi('Ver', 'Show')}
                    >
                      {showPwdNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#26352D]">
                    {bi('Confirmar nueva contraseña', 'Confirm new password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPwdConfirm ? 'text' : 'password'}
                      value={pwdConfirm}
                      onChange={(e) => setPwdConfirm(e.target.value)}
                      placeholder={bi('Repite la nueva contraseña', 'Repeat the new password')}
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] px-3.5 py-2.5 pr-10 text-xs text-[#26352D] focus:bg-white focus:border-[#24875B] focus:outline-none transition min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdConfirm(!showPwdConfirm)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6C7A72] hover:text-[#26352D] transition cursor-pointer"
                      title={showPwdConfirm ? bi('Ocultar', 'Hide') : bi('Ver', 'Show')}
                    >
                      {showPwdConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[#5E6D64]">
                  {bi(
                    'Al cambiar la contraseña se cerrarán las sesiones activas de este rol.',
                    'Changing the password will sign out active sessions for this role.'
                  )}
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
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPwd}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white font-bold py-3 text-xs shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    {isSavingPwd ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{t('common.saving')}</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        <span>{bi('Guardar contraseña', 'Save password')}</span>
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
                <h3 className="text-sm font-bold text-[#26352D]">
                  {bi('¿Cambiar contraseña?', 'Change password?')}
                </h3>
                <p className="text-xs text-[#526058] mt-1.5 leading-relaxed">
                  {pwdTargetRole === 'usuario'
                    ? bi(
                        'Se cerrarán las sesiones de Usuario en todos los dispositivos. ¿Continuar?',
                        'User sessions will be signed out on all devices. Continue?'
                      )
                    : bi(
                        'Se cerrarán todas las sesiones de Administrador, incluida esta. ¿Continuar?',
                        'All Administrator sessions, including this one, will be signed out. Continue?'
                      )}
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmPwdModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D4DDD6] bg-white text-xs font-semibold text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer min-h-[40px]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleExecutePasswordChange}
                  className="flex-1 py-2.5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-xs font-semibold text-white transition cursor-pointer shadow-xs min-h-[40px]"
                >
                  {t('common.confirm')}
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
            <span>{bi('Volver a Administración', 'Back to Administration')}</span>
          </button>
        </div>

        <div>
          <h1 className="text-lg font-bold text-stone-900 tracking-tight">
            {bi('Configuración', 'Settings')}
          </h1>
          <p className="text-xs text-stone-500">
            {bi('Administra los parámetros maestros del sistema', 'Manage master system parameters')}
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
                    {bi('Campañas', 'Campaigns')}
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {campaigns.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  {bi('Gestionar campañas agrícolas', 'Manage agricultural campaigns')}
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
                    {bi('Lotes', 'Lots')}
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {lots.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  {bi('Superficies y lotes de la propiedad', 'Property areas and lots')}
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
                    {bi('Máquinas e implementos', 'Machines & implements')}
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {machines.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  {bi('Máquinas, implementos agrícolas y tarifas base', 'Machines, agricultural implements and base rates')}
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
                    {bi('Ítems de ingresos y gastos', 'Income & expense items')}
                  </h3>
                  <span className="text-[10px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-full">
                    {itemsConfig.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  {bi('Rubros y conceptos contables', 'Accounting categories and concepts')}
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
                  {bi('Tipo de cambio', 'Exchange rate')}
                </h3>
                <p className="text-[11px] text-stone-500 truncate tabular-nums">
                  {exchangeRate.tasaBobPerUsd > 0
                    ? `1 USD = Bs ${formatExchangeRateNumber(exchangeRate.tasaBobPerUsd)} · ${
                        exchangeRate.fuente === 'manual'
                          ? bi('Ajuste manual', 'Manual override')
                          : exchangeRate.fuenteDetalle === 'BCB (Oficial)' &&
                            (exchangeRate.estado === 'actualizado' ||
                              Boolean(exchangeRate.ultimaConsulta || exchangeRate.ultimaConsultaDia))
                          ? bi('BCB (Oficial)', 'BCB (Official)')
                          : bi('Valor guardado', 'Saved value')
                      }`
                    : bi('Consultando cotización...', 'Fetching exchange rate...')}
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
                  {bi('Revocar acceso administrativo', 'Revoke administrator access')}
                </h3>
                <p className="text-[11px] text-red-800/80 truncate">
                  {bi('Eliminar credencial de este dispositivo', 'Remove credential from this device')}
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
                <h3 className="text-sm font-bold text-stone-900">
                  {bi('¿Revocar acceso administrativo?', 'Revoke administrator access?')}
                </h3>
                <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                  {bi(
                    'Se eliminará la credencial administrativa persistente de este dispositivo. Deberá ingresar nuevamente la contraseña de administrador para realizar cambios de configuración.',
                    'The stored administrator credential on this device will be removed. You will need to enter the administrator password again to change settings.'
                  )}
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={revoking}
                  onClick={() => setShowRevokeAdminModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 bg-stone-100 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition cursor-pointer min-h-[40px]"
                >
                  {t('common.cancel')}
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
                    <span>{bi('Revocar', 'Revoke')}</span>
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
              aria-label={t('common.back')}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-[#DCE2DD] text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-[#26352D]" />
            </button>
            <h2 className="text-base font-bold text-[#26352D] truncate">
              {screen === 'campanas'
                ? bi('Campañas', 'Campaigns')
                : screen === 'lotes'
                ? bi('Lotes', 'Lots')
                : screen === 'maquinarias'
                ? bi('Máquinas e implementos', 'Machines & implements')
                : screen === 'items'
                ? itemsSubView === 'INGRESO'
                  ? bi('Ingresos', 'Income')
                  : itemsSubView === 'GASTO'
                  ? bi('Gastos', 'Expenses')
                  : bi('Conceptos', 'Concepts')
                : screen === 'passwords'
                ? bi('Usuarios', 'Users')
                : bi('Configuración', 'Settings')}
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
              <span>{bi('Nueva', 'New')}</span>
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
              <span>{bi('Nuevo lote', 'New lot')}</span>
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
              <span>{bi('Nueva', 'New')}</span>
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
              <span>{bi('Nuevo', 'New')}</span>
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
            title={bi('Campañas', 'Campaigns')}
            countLabel={`${campaigns.length}`}
          />

          <CompactList
            isEmpty={campaigns.length === 0}
            emptyMessage={bi('No hay campañas registradas.', 'No campaigns registered.')}
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
                subtitle={`${bi('Inicio', 'Start')}: ${c.fechaInicio || '—'} · ${translateStatus(c.estado)}`}
                rightActions={
                  c.activa ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1D734C] bg-[#EAF5EE] px-2.5 py-1 rounded-lg border border-[#BFE0CD]">
                      <Check className="h-3 w-3" />
                      {bi('Activa', 'Active')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleActivateCampaign(c.id)}
                      className="text-xs font-semibold text-[#26352D] hover:text-[#24875B] border border-[#D4DDD6] hover:border-[#24875B] bg-white px-2.5 py-1 rounded-lg transition cursor-pointer min-h-[32px]"
                    >
                      {bi('Activar', 'Activate')}
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
            title={bi('Crear Nueva Campaña', 'Create New Campaign')}
            subtitle={bi('Registra una nueva campaña agrícola para el sistema', 'Register a new agricultural campaign')}
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleCampaignSubmit} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Nombre de campaña', 'Campaign name')} <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  value={cNombre}
                  onChange={(e) => setCNombre(e.target.value)}
                  placeholder={bi('Verano 2026/2027', 'Summer 2026/2027')}
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
                  {bi('Establecer como campaña activa', 'Set as active campaign')}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{bi('Guardar campaña', 'Save campaign')}</span>
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
            countLabel={`${filteredAdminLots.length} ${bi('lotes', 'lots')} · ${totalHa.toFixed(1)} ha`}
            searchValue={lotSearch}
            onSearchChange={setLotSearch}
            searchPlaceholder={bi('Buscar lote, cultivo o ubicación...', 'Search lot, crop, or location...')}
          />

          <CompactList
            isEmpty={filteredAdminLots.length === 0}
            emptyMessage={
              q
                ? bi('No se encontraron lotes con esa búsqueda.', 'No lots match that search.')
                : bi('No hay lotes registrados aún.', 'No lots registered yet.')
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
                      title={bi('Editar lote', 'Edit lot')}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLotConfirm(lot.id)}
                      className="p-1.5 text-[#7A8780] hover:text-[#C44545] hover:bg-[#FCECEC] rounded-lg transition cursor-pointer"
                      title={bi('Eliminar lote', 'Delete lot')}
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
            title={editingLotId ? bi('Editar Lote', 'Edit Lot') : bi('Crear Nuevo Lote', 'Create New Lot')}
            subtitle={bi(
              'Configura el nombre, superficie e información del lote',
              'Set the lot name, area, and details'
            )}
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleLotSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Nombre del lote', 'Lot name')} <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="text"
                    value={lotNombre}
                    onChange={(e) => setLotNombre(e.target.value)}
                    placeholder={bi('Lote 5 - El Palmar', 'Lot 5 - North Field')}
                    required
                    className={`${FORM_INPUT_CLASS} font-semibold`}
                  />
                </div>

                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Superficie (ha)', 'Area (ha)')} <span className="text-[#C44545]">*</span>
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
                  <label className={FORM_LABEL_CLASS}>{bi('Cultivo actual', 'Current crop')}</label>
                  <input
                    type="text"
                    value={lotCultivo}
                    onChange={(e) => setLotCultivo(e.target.value)}
                    placeholder={bi('Soya / Maíz / Sorgo', 'Soy / Corn / Sorghum')}
                    className={FORM_INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className={FORM_LABEL_CLASS}>{bi('Ubicación', 'Location')}</label>
                  <input
                    type="text"
                    value={lotUbicacion}
                    onChange={(e) => setLotUbicacion(e.target.value)}
                    placeholder={bi('Sector Norte', 'North Sector')}
                    className={FORM_INPUT_CLASS}
                  />
                </div>
              </div>

              <ObservationField
                value={lotObs}
                onChange={setLotObs}
                rows={2}
                placeholder={bi('Calidad de suelo, canal de riego...', 'Soil quality, irrigation canal...')}
              />

              {/* Valor Patrimonial del Terreno */}
              <div className="pt-2 border-t border-[#EFF2EF]">
                <label className={FORM_LABEL_CLASS}>
                  {bi('Valor del terreno (USD)', 'Land value (USD)')}{' '}
                  <span className="text-[12px] font-normal text-[#7A8780]">({t('common.optional')})</span>
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
                    className={`${FORM_INPUT_CLASS} pl-11 font-semibold tabular-nums`}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{editingLotId ? t('common.saveChanges') : bi('Guardar lote', 'Save lot')}</span>
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
          if (!machineShowInactive && !isActive) return false;
          if (!searchNorm) return true;
          const idLabel = m.identificacion && !isTechnicalId(m.identificacion) ? m.identificacion : '';
          return `${m.nombre} ${m.tipo} ${translateMachineTypeLabel(m.tipo || '')} ${idLabel} ${m.estado}`
            .toLowerCase()
            .includes(searchNorm);
        }).sort((a, b) => {
          const aActive = a.estado !== 'inactivo' && a.activo !== false;
          const bActive = b.estado !== 'inactivo' && b.activo !== false;
          if (aActive !== bActive) return aActive ? -1 : 1;
          return a.nombre.localeCompare(b.nombre, lang === 'en' ? 'en' : 'es', { numeric: true, sensitivity: 'base' });
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
          a.nombre.localeCompare(b.nombre, lang === 'en' ? 'en' : 'es', { numeric: true, sensitivity: 'base' })
        );

        const filteredEquipments = allEquipments.filter((jt) => {
          const isActive = jt.activo !== false;
          if (!implementShowInactive && !isActive) return false;
          if (!searchNorm) return true;
          const parentMachine = machineById.get(String(jt.maquinaId));
          return `${jt.nombre} ${jt.tipoMaquina || ''} ${parentMachine?.nombre || ''} ${parentMachine?.tipo || ''}`
            .toLowerCase()
            .includes(searchNorm);
        }).sort((a, b) => {
          const aActive = a.activo !== false;
          const bActive = b.activo !== false;
          if (aActive !== bActive) return aActive ? -1 : 1;
          return a.nombre.localeCompare(b.nombre, lang === 'en' ? 'en' : 'es', { numeric: true, sensitivity: 'base' });
        });

        const showEquipmentsExpanded = equipmentsGroupOpen || Boolean(searchNorm && filteredEquipments.length > 0);

        const deletingHistory = deletingMachine ? getMachineHistoryCounts(deletingMachine) : null;
        const deletingJobTypeHistory = deletingJobType ? getJobTypeHistoryCounts(deletingJobType) : null;

        return (
          <div className="space-y-3">
            {/* Toolbar de una sola línea: Título | Cantidad | Lupa */}
            <ListToolbar
              title={bi('Máquinas e implementos', 'Machines & implements')}
              countLabel={`${filteredMachines.length} · ${filteredEquipments.length}`}
              searchValue={machineSearch}
              onSearchChange={setMachineSearch}
              searchPlaceholder={bi('Buscar máquina, tipo o implemento...', 'Search machine, type, or implement...')}
            />

            {/* GRUPO 1: MÁQUINAS */}
            <section className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
              <div className="w-full flex items-center justify-between px-4 py-3 bg-[#F8FAF8] border-b border-[#E2E7E3]">
                <button
                  type="button"
                  onClick={() => setMachinesGroupOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                >
                  <Tractor className="h-4.5 w-4.5 text-[#26352D] shrink-0" />
                  <span className="text-sm font-bold text-[#26352D]">
                    {bi('Máquinas', 'Machines')} ({filteredMachines.length})
                  </span>
                  {machinesGroupOpen ? (
                    <ChevronUp className="h-4.5 w-4.5 text-[#5E6D64] shrink-0 ml-1" />
                  ) : (
                    <ChevronDown className="h-4.5 w-4.5 text-[#5E6D64] shrink-0 ml-1" />
                  )}
                </button>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#5E6D64] font-medium hidden sm:inline">{bi('Mostrar inactivos', 'Show inactive')}</span>
                  <Switch<boolean>
                    value={machineShowInactive}
                    onChange={setMachineShowInactive}
                    mode="boolean"
                    inline={true}
                    ariaLabel={bi('Mostrar máquinas inactivas', 'Show inactive machines')}
                  />
                </div>
              </div>

              {machinesGroupOpen && (
                <div className="border-t border-[#E2E7E3]">
                  <CompactList
                    isEmpty={filteredMachines.length === 0}
                    emptyMessage={
                      searchNorm
                        ? bi('No se encontraron máquinas que coincidan con la búsqueda.', 'No machines match your search.')
                        : bi('No hay máquinas registradas.', 'No machines registered.')
                    }
                    className="border-0 rounded-none"
                  >
                    {filteredMachines.map((m) => {
                      const isActive = m.estado !== 'inactivo' && m.activo !== false;
                      const isMaintenance = m.estado === 'mantenimiento';
                      const unitLabel = m.unidad === 'ha' || m.unidad === 'hectarea' ? 'ha' : 'h';
                      const estadoText = !isActive
                        ? bi('Inactivo', 'Inactive')
                        : isMaintenance
                        ? bi('Mantenimiento', 'Maintenance')
                        : bi('Activo', 'Active');

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
                              {m.tipo ? translateMachineTypeLabel(m.tipo) : bi('Sin tipo', 'No type')} ·{' '}
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
                            <span className="tabular-nums text-xs text-[#26352D]">
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

            {/* GRUPO 2: IMPLEMENTOS AGRÍCOLAS */}
            <section className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden">
              <div className="w-full flex items-center justify-between px-4 py-3 bg-[#F8FAF8] border-b border-[#E2E7E3]">
                <button
                  type="button"
                  onClick={() => setEquipmentsGroupOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                >
                  <Wrench className="h-4.5 w-4.5 text-[#26352D] shrink-0" />
                  <span className="text-sm font-bold text-[#26352D]">
                    {bi('Implementos agrícolas', 'Agricultural implements')} ({filteredEquipments.length})
                  </span>
                  {showEquipmentsExpanded ? (
                    <ChevronUp className="h-4.5 w-4.5 text-[#5E6D64] shrink-0 ml-1" />
                  ) : (
                    <ChevronDown className="h-4.5 w-4.5 text-[#5E6D64] shrink-0 ml-1" />
                  )}
                </button>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#5E6D64] font-medium hidden sm:inline">{bi('Mostrar inactivos', 'Show inactive')}</span>
                  <Switch<boolean>
                    value={implementShowInactive}
                    onChange={setImplementShowInactive}
                    mode="boolean"
                    inline={true}
                    ariaLabel={bi('Mostrar implementos inactivos', 'Show inactive implements')}
                  />
                </div>
              </div>

              {showEquipmentsExpanded && (
                <div className="border-t border-[#E2E7E3]">
                  {/* Barra interna de acciones de implementos */}
                  <div className="px-4 py-2.5 bg-[#FAFBF8] border-b border-[#EFF2EF] flex flex-wrap items-center justify-end gap-2">
                    {machines.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddJobType()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold transition cursor-pointer min-h-[34px]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{bi('Agregar implemento', 'Add implement')}</span>
                      </button>
                    )}
                  </div>

                  <CompactList
                    isEmpty={filteredEquipments.length === 0}
                    emptyMessage={
                      searchNorm
                        ? bi(
                            'No se encontraron implementos agrícolas que coincidan con la búsqueda.',
                            'No agricultural implements match your search.'
                          )
                        : bi(
                            'No hay implementos agrícolas configurados todavía.',
                            'No agricultural implements configured yet.'
                          )
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
                      const compatibleTipo = translateMachineTypeLabel(
                        jt.tipoMaquina || parentMachine?.tipo || 'Tractor'
                      );

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
                              {bi('Compatible', 'Compatible')}: {compatibleTipo} ·{' '}
                              <span
                                className={
                                  isActive
                                    ? 'text-[#24875B] font-semibold'
                                    : 'text-[#7A8780]'
                                }
                              >
                                {isActive ? bi('Activo', 'Active') : bi('Inactivo', 'Inactive')}
                              </span>
                            </span>
                          }
                          rightPrimary={
                            <span className="tabular-nums text-xs text-[#26352D]">
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
              const history = getMachineHistoryCounts(m);
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
                          {m.tipo ? translateMachineTypeLabel(m.tipo) : bi('Sin tipo', 'No type')} ·{' '}
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
                              ? bi('Mantenimiento', 'Maintenance')
                              : bi('Activo', 'Active')}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-[#EFF2EF] rounded-xl border border-[#E2E7E3] bg-white px-3.5 text-xs">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">{bi('Tarifa base', 'Base rate')}</span>
                        <span className="tabular-nums font-bold text-[#26352D]">
                          {m.moneda === 'USD' ? 'USD' : 'Bs'} {m.tarifa}/{unitLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">{bi('Valor patrimonial', 'Asset value')}</span>
                        <span className="tabular-nums font-semibold text-[#26352D]">
                          {baseVal > 0 ? `USD ${baseVal.toLocaleString()}` : bi('Sin valor asignado', 'No value assigned')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">{bi('Registros vinculados', 'Linked records')}</span>
                        <span className="font-semibold text-[#26352D]">
                          {bi(
                            `${history.jobsCount} servicios · ${history.expensesCount} gastos${history.assetsCount > 0 ? ` · ${history.assetsCount} pat.` : ''}`,
                            `${history.jobsCount} services · ${history.expensesCount} expenses${history.assetsCount > 0 ? ` · ${history.assetsCount} asset` : ''}`
                          )}
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
                          <span>{t('common.edit')}</span>
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
                          <span>{isActive ? bi('Desactivar', 'Deactivate') : bi('Reactivar', 'Reactivate')}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isToggling || isDeleting}
                        onClick={() => handleDeleteMachineClick(m)}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#C44545] hover:bg-[#A93838] text-xs font-bold text-white transition cursor-pointer min-h-[40px] disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{bi('Eliminar máquina', 'Delete machine')}</span>
                      </button>
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
              const jtHistory = getJobTypeHistoryCounts(jt);
              const unitLabel =
                String(jt.unidad || '').toLowerCase().includes('hora') || jt.unidad === 'h'
                  ? bi('Hora', 'Hour')
                  : bi('Hectárea (ha)', 'Hectare (ha)');
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
                          {bi('Implemento agrícola', 'Agricultural implement')} ·{' '}
                          <span className={isActive ? 'text-[#24875B] font-semibold' : 'text-[#7A8780]'}>
                            {isActive ? bi('Activo', 'Active') : bi('Inactivo', 'Inactive')}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-[#EFF2EF] rounded-xl border border-[#E2E7E3] bg-white px-3.5 text-xs">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">{bi('Tipo de máquina compatible', 'Compatible machine type')}</span>
                        <span className="font-semibold text-[#26352D]">
                          {translateMachineTypeLabel(jt.tipoMaquina || parentMachine?.tipo || 'Tractor')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">{bi('Tarifa propia', 'Own rate')}</span>
                        <span className="tabular-nums font-bold text-[#26352D]">
                          {jt.moneda === 'USD' ? 'USD' : 'Bs'} {jt.tarifa}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">{bi('Unidad de cobro', 'Billing unit')}</span>
                        <span className="font-semibold text-[#26352D]">{unitLabel}</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">{bi('Valor patrimonial', 'Asset value')}</span>
                        <span className="tabular-nums font-semibold text-[#26352D]">
                          {baseVal > 0 ? `USD ${baseVal.toLocaleString()}` : bi('Sin valor asignado', 'No value assigned')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[#5E6D64]">{bi('Registros vinculados', 'Linked records')}</span>
                        <span className="font-semibold text-[#26352D]">
                          {bi(
                            `${jtHistory.jobsCount} trabajos${jtHistory.assetsCount > 0 ? ` · ${jtHistory.assetsCount} patrimonial` : ''}`,
                            `${jtHistory.jobsCount} jobs${jtHistory.assetsCount > 0 ? ` · ${jtHistory.assetsCount} asset` : ''}`
                          )}
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
                          <span>{t('common.edit')}</span>
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
                          <span>{isActive ? bi('Desactivar', 'Deactivate') : bi('Reactivar', 'Reactivate')}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isToggling || isDeletingJobType}
                        onClick={() => handleDeleteJobTypeClick(jt)}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#C44545] hover:bg-[#A93838] text-xs font-bold text-white transition cursor-pointer min-h-[40px] disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{bi('Eliminar implemento', 'Delete implement')}</span>
                      </button>
                    </div>
                  </div>
                </IOSModal>
              );
            })()}

            {/* Machine Deletion Confirmation / Historical Protection Modal */}
            {deletingMachine && deletingHistory && (
              <ConfirmationModal
                isOpen={true}
                onClose={() => {
                  setDeleteMachineError(null);
                  setDeletingMachine(null);
                }}
                title={
                  deletingHistory.total > 0
                    ? bi('No se puede eliminar', 'Cannot delete')
                    : bi('Confirmar eliminación', 'Confirm deletion')
                }
                type={deletingHistory.total > 0 ? 'warning' : 'danger'}
                itemTitle={deletingMachine.nombre}
                itemSubtitle={`${translateMachineTypeLabel(deletingMachine.tipo || '')} · ${deletingMachine.moneda} ${deletingMachine.tarifa}/${deletingMachine.unidad}`}
                metrics={
                  deletingHistory.total > 0
                    ? [
                        { label: bi('Servicios', 'Services'), value: deletingHistory.jobsCount },
                        { label: bi('Gastos', 'Expenses'), value: deletingHistory.expensesCount },
                        { label: bi('Registros patrimoniales', 'Asset records'), value: deletingHistory.assetsCount },
                      ]
                    : []
                }
                message={
                  deletingHistory.total > 0
                    ? bi('Esta máquina tiene registros vinculados. Puedes mantenerla inactiva.', 'This machine has linked records. You can keep it inactive.')
                    : bi('Esta máquina no tiene trabajos, movimientos ni registros patrimoniales vinculados. ¿Deseas eliminarla definitivamente?', 'This machine has no linked jobs, transactions, or asset records. Permanently delete it?')
                }
                errorMsg={deleteMachineError}
                confirmText={deletingHistory.total > 0 ? bi('Aceptar', 'Accept') : bi('Eliminar', 'Delete')}
                cancelText={t('common.cancel')}
                confirmTone={deletingHistory.total > 0 ? 'success' : 'danger'}
                singleButton={deletingHistory.total > 0}
                isConfirming={isDeleting}
                onConfirm={
                  deletingHistory.total > 0
                    ? () => {
                        setDeleteMachineError(null);
                        setDeletingMachine(null);
                      }
                    : handleExecuteDeleteMachine
                }
                customActions={
                  deletingHistory.total > 0 ? (
                    <div className="space-y-2 pt-1">
                      {deletingMachine.estado !== 'inactivo' && deletingMachine.activo !== false && (
                        <button
                          type="button"
                          disabled={togglingMachineId === deletingMachine.id}
                          onClick={async () => {
                            const target = deletingMachine;
                            setDeleteMachineError(null);
                            setDeletingMachine(null);
                            await handleToggleMachineActive(target);
                          }}
                          className="w-full h-[40px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          <Power className="h-3.5 w-3.5" />
                          <span>{bi('Desactivar máquina', 'Deactivate machine')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteMachineError(null);
                          setDeletingMachine(null);
                        }}
                        className="w-full h-[40px] px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <span>{bi('Aceptar', 'Accept')}</span>
                      </button>
                    </div>
                  ) : undefined
                }
              />
            )}

            {/* Implement Deletion Confirmation / Historical Protection Modal */}
            {deletingJobType && deletingJobTypeHistory && (() => {
              const parentMachine = machineById.get(String(deletingJobType.maquinaId));
              const isJtActive = deletingJobType.activo !== false;
              const jtBlocked = Boolean(deletingJobTypeHistory.total > 0);
              const unitText =
                String(deletingJobType.unidad || '').toLowerCase().includes('hora') || deletingJobType.unidad === 'h'
                  ? 'h'
                  : 'ha';

              return (
                <ConfirmationModal
                  isOpen={true}
                  onClose={() => {
                    setDeleteJobTypeError(null);
                    setDeletingJobType(null);
                  }}
                  title={
                    jtBlocked
                      ? bi('No se puede eliminar', 'Cannot delete')
                      : bi('Confirmar eliminación', 'Confirm deletion')
                  }
                  type={jtBlocked ? 'warning' : 'danger'}
                  itemTitle={deletingJobType.nombre}
                  itemSubtitle={`${bi('Compatible', 'Compatible')}: ${translateMachineTypeLabel(deletingJobType.tipoMaquina || parentMachine?.tipo || 'Tractor')} · ${deletingJobType.moneda === 'USD' ? 'USD' : 'Bs'} ${deletingJobType.tarifa}/${unitText}`}
                  metrics={
                    jtBlocked
                      ? [
                          { label: bi('Trabajos vinculados', 'Linked jobs'), value: deletingJobTypeHistory.jobsCount },
                          { label: bi('Registros patrimoniales', 'Asset records'), value: deletingJobTypeHistory.assetsCount },
                        ]
                      : []
                  }
                  message={
                    jtBlocked
                      ? bi('Este implemento tiene registros vinculados. Puedes mantenerlo inactivo.', 'This implement has linked records. You can keep it inactive.')
                      : bi('Este implemento no tiene trabajos ni registros patrimoniales vinculados. ¿Deseas eliminarlo definitivamente?', 'This implement has no linked jobs or asset records. Permanently delete it?')
                  }
                  errorMsg={deleteJobTypeError}
                  confirmText={jtBlocked ? bi('Aceptar', 'Accept') : bi('Eliminar', 'Delete')}
                  cancelText={t('common.cancel')}
                  confirmTone={jtBlocked ? 'success' : 'danger'}
                  singleButton={jtBlocked}
                  isConfirming={isDeletingJobType}
                  onConfirm={
                    jtBlocked
                      ? () => {
                          setDeleteJobTypeError(null);
                          setDeletingJobType(null);
                        }
                      : handleExecuteDeleteJobType
                  }
                  customActions={
                    jtBlocked ? (
                      <div className="space-y-2 pt-1">
                        {isJtActive && (
                          <button
                            type="button"
                            disabled={togglingJobTypeId === deletingJobType.id}
                            onClick={async () => {
                              const target = deletingJobType;
                              setDeleteJobTypeError(null);
                              setDeletingJobType(null);
                              await handleToggleJobTypeActive(target);
                            }}
                            className="w-full h-[40px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
                          >
                            <Power className="h-3.5 w-3.5" />
                            <span>{bi('Desactivar implemento', 'Deactivate implement')}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteJobTypeError(null);
                            setDeletingJobType(null);
                          }}
                          className="w-full h-[40px] px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          <span>{bi('Aceptar', 'Accept')}</span>
                        </button>
                      </div>
                    ) : undefined
                  }
                />
              );
            })()}

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
            title={editingMachineId ? bi('Editar máquina', 'Edit machine') : bi('Nueva máquina', 'New machine')}
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleMachineSubmit} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Nombre / Modelo', 'Name / Model')} <span className="text-[#C44545]">*</span>
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
                label={bi('Tipo de máquina', 'Machine type')}
                required
                icon={<Tractor className="h-[17px] w-[17px]" />}
                value={mTipo}
                onChange={(e) => setMTipo(e.target.value)}
              >
                <option value="">{bi('Seleccionar tipo', 'Select type')}</option>
                {machineTypesList.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {translateMachineTypeLabel(tipo)}
                  </option>
                ))}
              </AppSelect>

              <div>
                <label className={FORM_LABEL_CLASS}>{bi('Icono', 'Icon')}</label>
                <button
                  type="button"
                  onClick={() => setShowMachineIconSheet(true)}
                  className="w-full h-[40px] flex items-center justify-between px-3 rounded-xl border border-[#CFD8D2] bg-white hover:border-[#24875B] transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <VisualIcon name={mIcono || 'tractor'} size="xs" />
                    <span className="text-sm font-semibold text-[#1F2D25] truncate">
                      {translateIcon(mIcono || 'tractor', getIconDefinition(mIcono || 'tractor').label)}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#24875B] shrink-0">{bi('Elegir', 'Choose')}</span>
                </button>
              </div>

              {mMoneda === 'BOB' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-[11px] text-amber-900 leading-snug">
                    {lang === 'es' ? (
                      <>Esta máquina conserva una tarifa histórica guardada en <strong>Bs</strong>.</>
                    ) : (
                      <>This machine keeps a historical rate saved in <strong>Bs</strong>.</>
                    )}
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
                        {bi('Convertir a USD', 'Convert to USD')} ({bi('TC', 'FX')} {formatExchangeRateNumber(exchangeRate.tasaBobPerUsd)})
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Tarifa', 'Rate')} ({mMoneda === 'BOB' ? 'Bs' : 'USD'}){' '}
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

                <Switch<'h' | 'ha'>
                  label={bi('Unidad', 'Unit')}
                  value={mUnidad}
                  onChange={(val) => setMUnidad(val)}
                  leftOption={{ value: 'ha', label: bi('Hectárea', 'Hectare') }}
                  rightOption={{ value: 'h', label: bi('Hora', 'Hour') }}
                />
              </div>

              <div>
                <label className={FORM_LABEL_CLASS}>{bi('Estado', 'Status')}</label>
                <SegmentedControl
                  options={[
                    { value: 'operativo', label: bi('Operativo', 'Operational') },
                    { value: 'mantenimiento', label: bi('Mantenim.', 'Maint.') },
                    { value: 'inactivo', label: bi('Inactivo', 'Inactive') },
                  ]}
                  value={mEstado}
                  onChange={(val) => setMEstado(val as any)}
                />
              </div>

              {/* Valor Patrimonial de la Máquina */}
              <div className="pt-2 border-t border-[#EFF2EF]">
                <label className={FORM_LABEL_CLASS}>
                  {bi('Valor patrimonial (USD)', 'Asset value (USD)')}{' '}
                  <span className="text-[12px] font-normal text-[#7A8780]">({t('common.optional')})</span>
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
                    className={`${FORM_INPUT_CLASS} pl-11 font-semibold tabular-nums`}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{editingMachineId ? t('common.saveChanges') : bi('Guardar máquina', 'Save machine')}</span>
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
            title={editingJobTypeId ? bi('Editar implemento', 'Edit implement') : bi('Nuevo implemento', 'New implement')}
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleSaveJobType} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Nombre del implemento', 'Implement name')} <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={jtNombre}
                  onChange={(e) => setJtNombre(e.target.value)}
                  placeholder={bi('Sembradora, Romplow, Fumigadora...', 'Planter, Disc plow, Sprayer...')}
                  className={`${FORM_INPUT_CLASS} font-semibold`}
                />
              </div>

              <AppSelect
                label={bi('Tipo de máquina compatible', 'Compatible machine type')}
                required
                icon={<Tractor className="h-[17px] w-[17px]" />}
                value={jtCompatibleTipo}
                onChange={(e) => setJtCompatibleTipo(e.target.value)}
              >
                <option value="">{bi('Seleccionar tipo', 'Select type')}</option>
                {machineTypesList.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {translateMachineTypeLabel(tipo)}
                  </option>
                ))}
              </AppSelect>

              <div>
                <label className={FORM_LABEL_CLASS}>{bi('Icono', 'Icon')}</label>
                <button
                  type="button"
                  onClick={() => setShowJtIconSheet(true)}
                  className="w-full h-[40px] flex items-center justify-between px-3 rounded-xl border border-[#CFD8D2] bg-white hover:border-[#24875B] transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <VisualIcon name={jtIcono || 'implemento'} size="xs" />
                    <span className="text-sm font-semibold text-[#1F2D25] truncate">
                      {translateIcon(jtIcono || 'implemento', getIconDefinition(jtIcono || 'implemento').label)}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#24875B] shrink-0">{bi('Elegir', 'Choose')}</span>
                </button>
              </div>

              {jtMoneda === 'BOB' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-[11px] text-amber-900 leading-snug">
                    {lang === 'es' ? (
                      <>Este implemento conserva una tarifa histórica guardada en <strong>Bs</strong>.</>
                    ) : (
                      <>This implement keeps a historical rate saved in <strong>Bs</strong>.</>
                    )}
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
                        {bi('Convertir a USD', 'Convert to USD')} ({bi('TC', 'FX')} {formatExchangeRateNumber(exchangeRate.tasaBobPerUsd)})
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Tarifa', 'Rate')} ({jtMoneda === 'BOB' ? 'Bs' : 'USD'}){' '}
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

                <Switch<'ha' | 'hora'>
                  label={bi('Unidad', 'Unit')}
                  required
                  value={jtUnidad}
                  onChange={(val) => setJtUnidad(val)}
                  leftOption={{ value: 'ha', label: bi('Hectárea', 'Hectare') }}
                  rightOption={{ value: 'hora', label: bi('Hora', 'Hour') }}
                />
              </div>

              <div className="pt-1 border-t border-[#EFF2EF]">
                <label className={FORM_LABEL_CLASS}>
                  {bi('Valor patrimonial (USD)', 'Asset value (USD)')}{' '}
                  <span className="text-[12px] font-normal text-[#7A8780]">({t('common.optional')})</span>
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
                    className={`${FORM_INPUT_CLASS} pl-11 font-semibold tabular-nums`}
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
                  {bi('Activo', 'Active')}
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingJobType}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingJobType ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{editingJobTypeId ? t('common.saveChanges') : bi('Guardar implemento', 'Save implement')}</span>
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
            title={bi('Elegir icono de maquinaria', 'Choose machinery icon')}
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
            title={bi('Elegir icono de implemento agrícola', 'Choose agricultural implement icon')}
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
                      {bi('Ingresos', 'Income')}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                      {incomeConceptsCount}{' '}
                      {incomeConceptsCount === 1
                        ? bi('concepto configurado', 'configured concept')
                        : bi('conceptos configurados', 'configured concepts')}
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
                      {bi('Gastos', 'Expenses')}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5E6D64] truncate mt-0.5">
                      {expenseConceptsCount}{' '}
                      {expenseConceptsCount === 1
                        ? bi('concepto configurado', 'configured concept')
                        : bi('conceptos configurados', 'configured concepts')}
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
                isGastoSub
                  ? bi('Buscar concepto de gasto...', 'Search expense concept...')
                  : bi('Buscar concepto de ingreso...', 'Search income concept...')
              }
              filters={
                <div className="flex items-center gap-1.5 min-w-0">
                  <CompactFilter
                    value={filterModulo}
                    onChange={(val) =>
                      setFilterModulo(val as 'TODOS' | 'MAQUINARIAS' | 'PROPIEDAD')
                    }
                    ariaLabel={bi('Filtrar módulo', 'Filter module')}
                    options={[
                      { value: 'TODOS', label: bi('Todos', 'All') },
                      { value: 'MAQUINARIAS', label: t('nav.machinery') },
                      { value: 'PROPIEDAD', label: t('nav.property') },
                    ]}
                  />

                  <CompactFilter
                    value={itemStatusFilter}
                    onChange={(val) =>
                      setItemStatusFilter(val as 'activos' | 'desactivados' | 'todos')
                    }
                    ariaLabel={bi('Filtrar estado', 'Filter status')}
                    options={[
                      { value: 'activos', label: bi('Activos', 'Active') },
                      { value: 'desactivados', label: bi('Desactivados', 'Inactive') },
                      { value: 'todos', label: bi('Todos', 'All') },
                    ]}
                  />
                </div>
              }
            />

            {/* Lista continua compacta de Conceptos */}
            <CompactList
              isEmpty={filteredItems.length === 0}
              emptyMessage={
                isGastoSub
                  ? bi(
                      'No se encontraron conceptos de gastos con los filtros seleccionados.',
                      'No expense concepts match the selected filters.'
                    )
                  : bi(
                      'No se encontraron conceptos de ingresos con los filtros seleccionados.',
                      'No income concepts match the selected filters.'
                    )
              }
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
                        {itemMod === 'MAQUINARIAS' ? t('nav.machinery') : t('nav.property')}
                        {!isGastoSub && item.unidad ? ` · ${item.unidad}` : ''}
                        {!isActivo ? bi(' · Desactivado', ' · Inactive') : ''}
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
                  ? bi('Editar concepto', 'Edit concept')
                  : itemClase === 'INGRESO'
                  ? bi('Nuevo concepto de ingreso', 'New income concept')
                  : bi('Nuevo concepto de gasto', 'New expense concept')
              }
              errorMsg={errorMsg}
              onErrorDismiss={() => setErrorMsg(null)}
            >
              <form onSubmit={handleItemSubmit} className="space-y-3">
                {/* Nombre */}
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Nombre del concepto', 'Concept name')} <span className="text-[#C44545]">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder={
                      itemClase === 'INGRESO'
                        ? bi('Venta cosecha soya, Venta de maíz...', 'Soy harvest sale, Corn sale...')
                        : bi('Semillas de soya, Repuestos, Diésel...', 'Soy seeds, Spare parts, Diesel...')
                    }
                    required
                    className={`${FORM_INPUT_CLASS} font-semibold`}
                  />
                </div>

                {/* Módulo obligatorio */}
                <div>
                  <AppSelect
                    label={bi('Módulo', 'Module')}
                    required
                    icon={<Tag className="h-[17px] w-[17px]" />}
                    value={itemModulo}
                    disabled={Boolean(editingItemId && editingItemHasHistory)}
                    onChange={(e) =>
                      setItemModulo(e.target.value as '' | 'MAQUINARIAS' | 'PROPIEDAD')
                    }
                  >
                    <option value="">{bi('Seleccionar módulo', 'Select module')}</option>
                    <option value="MAQUINARIAS">{t('nav.machinery')}</option>
                    <option value="PROPIEDAD">{t('nav.property')}</option>
                  </AppSelect>
                  {editingItemId && editingItemHasHistory && (
                    <p className="text-[11px] text-[#5E6D64] mt-1">
                      {bi(
                        'Tiene movimientos registrados; el módulo está bloqueado para proteger el historial.',
                        'It has recorded transactions; the module is locked to protect history.'
                      )}
                    </p>
                  )}
                </div>

                {/* Icono visual */}
                <div>
                  <label className={FORM_LABEL_CLASS}>{bi('Icono', 'Icon')}</label>
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
                        {translateIcon(
                          itemIcono || (itemClase === 'INGRESO' ? 'soya' : 'diesel'),
                          getIconDefinition(
                            itemIcono || (itemClase === 'INGRESO' ? 'soya' : 'diesel'),
                            itemClase === 'INGRESO' ? 'ingreso' : 'gasto'
                          ).label
                        )}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#24875B] shrink-0">{bi('Elegir', 'Choose')}</span>
                  </button>
                </div>

                {/* Unidad de medida (solo cuando aplica a ingresos) */}
                {itemClase === 'INGRESO' && (
                  <div>
                    <label className={FORM_LABEL_CLASS}>{bi('Unidad de medida', 'Unit of measure')}</label>
                    <input
                      type="text"
                      value={itemUnidad}
                      onChange={(e) => setItemUnidad(e.target.value)}
                      placeholder={bi('toneladas, quintales, kg', 'tons, quintals, kg')}
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
                    {bi('Concepto activo', 'Active concept')}
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
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{t('common.saving')}</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        <span>{editingItemId ? t('common.saveChanges') : t('common.save')}</span>
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
                  ? bi('Elegir icono de ingreso agrícola', 'Choose agricultural income icon')
                  : bi('Elegir icono de gasto', 'Choose expense icon')
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
          ? bi('Ajuste manual', 'Manual override')
          : isBcbConfirmed
          ? bi('Banco Central de Bolivia (BCB)', 'Central Bank of Bolivia (BCB)')
          : bi('Valor guardado en sistema', 'Saved system value');

        const cardTitle = isManual
          ? bi('Cotización activa (manual)', 'Active rate (manual)')
          : isBcbConfirmed
          ? bi('Cotización BCB verificada', 'Verified BCB rate')
          : statusKey === 'sin_conexion'
          ? bi('Valor guardado (sin conexión al BCB)', 'Saved value (no BCB connection)')
          : bi('Valor guardado (consulta pendiente)', 'Saved value (lookup pending)');

        const statusConfig: Record<
          string,
          { label: string; className: string; dotClass: string }
        > = {
          actualizado: {
            label: bi('Cotización BCB verificada', 'Verified BCB rate'),
            className: 'bg-[#EAF5EE] text-[#1D5C3F] border-[#24875B]/30',
            dotClass: 'bg-[#24875B]',
          },
          guardado: {
            label: bi('Valor guardado', 'Saved value'),
            className: 'bg-[#F5F7F4] text-[#526058] border-[#D4DDD6]',
            dotClass: 'bg-[#7A8780]',
          },
          pendiente: {
            label: bi('Consulta pendiente', 'Pending lookup'),
            className: 'bg-amber-50 text-amber-800 border-amber-200/80',
            dotClass: 'bg-amber-500',
          },
          sin_conexion: {
            label: bi('Consulta fallida', 'Lookup failed'),
            className: 'bg-[#FCECEC] text-[#962D2D] border-[#C44545]/30',
            dotClass: 'bg-[#C44545]',
          },
          manual: {
            label: bi('Ajuste manual', 'Manual override'),
            className: 'bg-sky-50 text-sky-900 border-sky-200/80',
            dotClass: 'bg-sky-600',
          },
        };
        const badge = statusConfig[statusKey] || statusConfig.pendiente;

        const vigenciaLabel = isBcbConfirmed
          ? bi('Vigencia BCB', 'BCB effective date')
          : bi('Fecha guardada', 'Saved date');
        const vigenciaValue =
          formatExchangeRateDate(
            isBcbConfirmed
              ? exchangeRate.fechaCotizacion || exchangeRate.fechaActualizacion
              : exchangeRate.fechaActualizacion
          ) || '—';

        const ultimaConsultaValue = exchangeRate.ultimaConsulta
          ? formatExchangeRateDate(exchangeRate.ultimaConsulta)
          : bi('Pendiente', 'Pending');

        return (
          <div className="space-y-3">
            {/* Compact Header: [←] Tipo de cambio */}
            <div className="flex items-center gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={handleGoBack}
                aria-label={bi('Volver a Administración', 'Back to Administration')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] shadow-2xs hover:bg-[#F5F7F4] active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
              <h2 className="text-base font-bold text-[#26352D] tracking-tight leading-tight">
                {bi('Tipo de cambio', 'Exchange rate')}
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
                  <span className="text-[#5E6D64]">{bi('Fuente', 'Source')}</span>
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
                  <span className="text-[#5E6D64]">{bi('Última consulta', 'Last lookup')}</span>
                  <span className="font-medium text-[#26352D] tabular-nums text-right">
                    {ultimaConsultaValue}
                  </span>
                </div>
                {isManual && exchangeRate.nota && (
                  <div className="flex items-center justify-between gap-3 py-2">
                    <span className="text-[#5E6D64] shrink-0">{bi('Nota', 'Note')}</span>
                    <span className="font-medium text-[#26352D] text-right truncate">
                      {exchangeRate.nota}
                    </span>
                  </div>
                )}
              </div>

              {/* Preview of live BCB quote when queried during manual override */}
              {isManual && bcbPreview && (
                <div className="rounded-xl border border-[#E2E7E3] bg-[#F5F7F4] px-3 py-2 text-[11px] text-[#526058] flex items-center justify-between gap-2">
                  <span>{bi('Cotización oficial BCB', 'Official BCB rate')}</span>
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
                  <span>
                    {refreshingBcb
                      ? bi('Consultando BCB...', 'Querying BCB...')
                      : bi('Consultar cotización BCB', 'Fetch official BCB rate')}
                  </span>
                </button>

                {isManual && (
                  <button
                    type="button"
                    onClick={() => handleRefreshBcb(true)}
                    disabled={refreshingBcb || saving}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] py-2.5 px-4 text-xs font-bold text-[#26352D] hover:bg-[#F2F5F2] transition active:scale-[0.99] disabled:opacity-50 cursor-pointer min-h-[40px]"
                  >
                    <Landmark className="h-3.5 w-3.5" />
                    <span>{bi('Volver al TC oficial BCB', 'Return to official BCB rate')}</span>
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
                  <span className="text-xs font-bold text-[#26352D]">{bi('Ajuste manual', 'Manual override')}</span>
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
                      {bi('Tipo de cambio (Bs por 1 USD)', 'Exchange rate (Bs per 1 USD)')}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tasaInput}
                      onChange={(e) => setTasaInput(e.target.value)}
                      placeholder={bi('Ej. 11,75', 'e.g. 11.75')}
                      required
                      className="w-full text-sm font-bold tabular-nums px-3 py-2.5 rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] focus:bg-white focus:border-[#26352D] focus:outline-none min-h-[42px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#26352D] mb-1">
                      {t('common.observation')} <span className="font-normal text-[#7A8780]">({t('common.optional')})</span>
                    </label>
                    <input
                      type="text"
                      value={tasaNota}
                      onChange={(e) => setTasaNota(e.target.value)}
                      placeholder={bi('Ej. Cotización acordada para operación', 'e.g. Agreed rate for transaction')}
                      className="w-full text-xs px-3 py-2.5 rounded-xl border border-[#D4DDD6] bg-[#FAFBF8] focus:bg-white focus:border-[#26352D] focus:outline-none min-h-[40px]"
                    />
                  </div>

                  <p className="text-[11px] text-[#5E6D64] leading-snug">
                    {bi(
                      'El ajuste manual pausa la sincronización automática diaria y no modifica movimientos anteriores.',
                      'Manual override pauses daily auto-sync and does not modify past transactions.'
                    )}
                  </p>

                  <button
                    type="submit"
                    disabled={saving || refreshingBcb}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#24875B] py-2.5 px-4 text-xs font-bold text-white shadow-2xs hover:bg-[#1D704B] transition active:scale-[0.99] disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{t('common.saving')}</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        <span>{bi('Guardar ajuste manual', 'Save manual override')}</span>
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
              aria-label={t('common.back')}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-[#DCE2DD] text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-[#26352D]" />
            </button>
            <h2 className="text-base font-bold text-[#26352D] truncate">{bi('Patrimonio', 'Assets')}</h2>
          </div>

          {/* 3. Segmented control selector taking full available width */}
          <div>
            <SegmentedControl
              options={[
                { value: 'maquinarias', label: `${t('nav.machinery')} (${uniqueMachines.length + implementsList.length})` },
                { value: 'propiedad', label: `${t('nav.property')} (${lots.length})` },
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
                        {bi('Base', 'Base')}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-stone-700 tabular-nums mt-0.5 block truncate">
                        {totalBase > 0 ? `USD ${totalBase.toLocaleString()}` : bi('Sin valor', 'No value')}
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        {bi('Mejoras', 'Improvements')}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-700 tabular-nums mt-0.5 block truncate">
                        USD {totalMejoras.toLocaleString()}
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        {bi('Total', 'Total')}
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-900 tabular-nums mt-0.5 block truncate">
                        {totalPat > 0 ? `USD ${totalPat.toLocaleString()}` : bi('Sin valor', 'No value')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-filter and Action Bar in one clean line */}
                <div className="space-y-2">
                  <ListToolbar
                    title={bi('Bienes', 'Assets')}
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
                    searchPlaceholder={bi('Buscar máquina o implemento...', 'Search machine or implement...')}
                    filters={
                      <div className="flex items-center gap-1.5">
                        <CompactFilter
                          value={activosMaqSubFilter}
                          onChange={(val) => setActivosMaqSubFilter(val as any)}
                          ariaLabel={bi('Filtrar tipo de bien', 'Filter asset type')}
                          options={[
                            { value: 'TODOS', label: bi('Todos', 'All') },
                            { value: 'MAQUINAS', label: bi('Máquinas', 'Machines') },
                            { value: 'IMPLEMENTOS', label: bi('Implementos', 'Implements') },
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
                          <span>{bi('Implemento', 'Implement')}</span>
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
                          ? bi('No se encontraron bienes con esa búsqueda.', 'No assets match that search.')
                          : showImplements && !showMachines
                          ? bi('No hay implementos agrícolas registrados.', 'No agricultural implements registered.')
                          : bi('No hay máquinas ni implementos registrados.', 'No machines or implements registered.')
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
                                {bi('Máquina', 'Machine')} · {baseVal > 0 ? `${bi('Base', 'Base')} USD ${baseVal.toLocaleString()}` : bi('Sin valor', 'No value')}
                                {sumImps > 0 ? (
                                  <span className="text-[#24875B] font-semibold">
                                    {' '}
                                    · {bi('Mejoras', 'Improvements')} USD {sumImps.toLocaleString()}
                                  </span>
                                ) : null}
                              </span>
                            }
                            rightPrimary={
                              totVal > 0 ? (
                                <span className="tabular-nums text-[#26352D]">
                                  USD {totVal.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-[#8A968F] font-normal text-xs">{bi('Sin valor', 'No value')}</span>
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
                                {bi('Implemento', 'Implement')} · {baseVal > 0 ? `${bi('Base', 'Base')} USD ${baseVal.toLocaleString()}` : bi('Sin valor', 'No value')}
                                {sumImps > 0 ? (
                                  <span className="text-[#24875B] font-semibold">
                                    {' '}
                                    · {bi('Mejoras', 'Improvements')} USD {sumImps.toLocaleString()}
                                  </span>
                                ) : null}
                              </span>
                            }
                            rightPrimary={
                              totVal > 0 ? (
                                <span className="tabular-nums text-[#26352D]">
                                  USD {totVal.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-[#8A968F] font-normal text-xs">{bi('Sin valor', 'No value')}</span>
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
                        {bi('Base', 'Base')}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#26352D] tabular-nums mt-0.5 block truncate">
                        {totalBase > 0 ? `USD ${totalBase.toLocaleString()}` : bi('Sin valor', 'No value')}
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8780] block">
                        {bi('Mejoras', 'Improvements')}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#24875B] tabular-nums mt-0.5 block truncate">
                        USD {totalMejoras.toLocaleString()}
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8780] block">
                        {bi('Total', 'Total')}
                      </span>
                      <span className="text-xs sm:text-sm font-black text-[#26352D] tabular-nums mt-0.5 block truncate">
                        {totalPat > 0 ? `USD ${totalPat.toLocaleString()}` : bi('Sin valor', 'No value')}
                      </span>
                    </div>
                  </div>
                </div>

                <ListToolbar
                  title={bi('Lotes', 'Lots')}
                  countLabel={`${filteredPatLots.length}`}
                  searchValue={activosSearch}
                  onSearchChange={setActivosSearch}
                  searchPlaceholder={bi('Buscar lote...', 'Search lot...')}
                />

                <CompactList
                  isEmpty={filteredPatLots.length === 0}
                  emptyMessage={
                    q
                      ? bi('No se encontraron lotes con esa búsqueda.', 'No lots match that search.')
                      : bi('No hay lotes registrados en la propiedad.', 'No lots registered for this property.')
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
                            {baseVal > 0 ? `${bi('Base', 'Base')} USD ${baseVal.toLocaleString()}` : bi('Sin valor', 'No value')}
                            {sumImps > 0 ? (
                              <span className="text-[#24875B] font-semibold">
                                {' '}
                                · {bi('Mejoras', 'Improvements')} USD {sumImps.toLocaleString()}
                              </span>
                            ) : null}
                          </span>
                        }
                        rightPrimary={
                          totVal > 0 ? (
                            <span className="tabular-nums text-[#26352D]">
                              USD {totVal.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[#8A968F] font-normal text-xs">{bi('Sin valor', 'No value')}</span>
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
                    ? bi('Ficha Patrimonial — Maquinaria', 'Asset Record — Machinery')
                    : isImplement
                    ? bi('Ficha Patrimonial — Implemento Agrícola', 'Asset Record — Agricultural Implement')
                    : bi('Ficha Patrimonial — Terreno / Lote', 'Asset Record — Land / Lot')
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
                          {bi('Valor patrimonial', 'Asset value')} · {entity.nombre}
                        </span>
                        <span className="text-xl sm:text-2xl font-black tabular-nums text-[#24875B] block mt-0.5">
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
                        <span>{bi('Editar valor inicial', 'Edit initial value')}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] p-2.5">
                        <span className="text-[10px] text-[#7A8780] block font-semibold uppercase">
                          {bi('Valor inicial', 'Initial value')}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-[#26352D] block mt-0.5">
                          USD {baseVal.toLocaleString()}
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#E2E7E3] bg-[#F8FAF8] p-2.5">
                        <span className="text-[10px] text-[#7A8780] block font-semibold uppercase">
                          {bi('Mejoras acumuladas', 'Total improvements')}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-[#24875B] block mt-0.5">
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
                        <span>{bi('Historial de Mejoras', 'Improvement History')} ({imps.length})</span>
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
                        <span>{bi('Añadir mejora', 'Add improvement')}</span>
                      </button>
                    </div>

                    {/* List of Improvements */}
                    <div>
                      <CompactList
                        isEmpty={imps.length === 0}
                        emptyMessage={bi(
                          'No se han registrado mejoras posteriores para este activo.',
                          'No subsequent improvements have been recorded for this asset.'
                        )}
                      >
                        {imps.map((imp) => (
                          <CompactListRow
                            key={imp.id}
                            title={imp.descripcion}
                            subtitle={`${t('common.date')}: ${imp.fecha}`}
                            rightPrimary={
                              <span className="tabular-nums text-[#24875B]">
                                +USD {Number(imp.costo || 0).toLocaleString()}
                              </span>
                            }
                            rightActions={
                              <div className="flex items-center gap-0.5 pl-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditImprovementClick(imp)}
                                  className="p-1 text-[#7A8780] hover:text-[#26352D] hover:bg-[#EFF2EF] rounded transition cursor-pointer"
                                  title={bi('Editar mejora', 'Edit improvement')}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteImprovementClick(imp)}
                                  className="p-1 text-[#7A8780] hover:text-[#C44545] hover:bg-[#FCECEC] rounded transition cursor-pointer"
                                  title={bi('Eliminar mejora', 'Delete improvement')}
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
            title={bi('Añadir Mejora al Activo', 'Add Asset Improvement')}
            subtitle={bi('Registra inversiones o equipamiento posterior', 'Record investments or added equipment')}
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleAddImprovementSubmit} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Descripción de la mejora', 'Improvement description')} <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  value={impDesc}
                  onChange={(e) => setImpDesc(e.target.value)}
                  placeholder={bi('Piloto automático, canal de riego, overhaul...', 'Autopilot, irrigation canal, overhaul...')}
                  required
                  className={`${FORM_INPUT_CLASS} font-semibold`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Costo (USD)', 'Cost (USD)')} <span className="text-[#C44545]">*</span>
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
                    {t('common.date')} <span className="text-[#C44545]">*</span>
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{bi('Guardar mejora', 'Save improvement')}</span>
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
              title={bi('Editar mejora', 'Edit improvement')}
              errorMsg={errorMsg}
              onErrorDismiss={() => setErrorMsg(null)}
            >
              <form onSubmit={handleUpdateImprovementSubmit} className="space-y-3">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Descripción', 'Description')} <span className="text-[#C44545]">*</span>
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
                      {bi('Costo (USD)', 'Cost (USD)')} <span className="text-[#C44545]">*</span>
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
                      {t('common.date')} <span className="text-[#C44545]">*</span>
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
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{t('common.saving')}</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 shrink-0" />
                        <span>{t('common.saveChanges')}</span>
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
                    <h3 className="text-sm font-bold text-stone-900">
                      {bi('Confirmar eliminación de mejora', 'Confirm improvement deletion')}
                    </h3>
                    <p className="text-xs text-stone-500">
                      {bi(
                        'Se recalculará automáticamente el valor total acumulado.',
                        'The total accumulated value will be recalculated automatically.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-stone-50 p-3 border border-stone-200 space-y-1">
                  <p className="text-xs font-bold text-stone-900">{deletingImprovement.descripcion}</p>
                  <p className="text-xs tabular-nums font-bold text-red-800">
                    {bi('Importe', 'Amount')}: USD {deletingImprovement.costo.toLocaleString()} &bull; {t('common.date')}: {deletingImprovement.fecha}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isDeletingImprovement}
                    onClick={() => setDeletingImprovement(null)}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[38px] disabled:opacity-50"
                  >
                    {t('common.cancel')}
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
                        <span>{t('common.deleting')}</span>
                      </>
                    ) : (
                      <span>{bi('Eliminar Mejora', 'Delete Improvement')}</span>
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
            title={
              editingImplement
                ? bi('Editar Implemento Agrícola', 'Edit Agricultural Implement')
                : bi('Registrar Implemento Agrícola', 'Register Agricultural Implement')
            }
            subtitle={bi(
              'Configura el nombre, icono y valor patrimonial en USD',
              'Set the name, icon, and asset value in USD'
            )}
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleSaveImplement} className="space-y-3">
              <div>
                <label className={FORM_LABEL_CLASS}>
                  {bi('Nombre del implemento', 'Implement name')} <span className="text-[#C44545]">*</span>
                </label>
                <input
                  type="text"
                  value={impFormNombre}
                  onChange={(e) => setImpFormNombre(e.target.value)}
                  placeholder={bi('Romplow 18 discos, Sembradora John Deere...', '18-disc plow, John Deere planter...')}
                  required
                  className={`${FORM_INPUT_CLASS} font-semibold`}
                />
              </div>

              <div>
                <label className={FORM_LABEL_CLASS}>{bi('Icono', 'Icon')}</label>
                <button
                  type="button"
                  onClick={() => setShowImpFormIconSheet(true)}
                  className="w-full h-[40px] flex items-center justify-between px-3 rounded-xl border border-[#CFD8D2] bg-white hover:border-[#24875B] transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <VisualIcon name={impFormIcono || 'implemento'} size="xs" />
                    <span className="text-sm font-semibold text-[#1F2D25] truncate">
                      {translateIcon(impFormIcono || 'implemento', getIconDefinition(impFormIcono || 'implemento').label)}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#24875B] shrink-0">{bi('Elegir', 'Choose')}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className={FORM_LABEL_CLASS}>
                    {bi('Valor inicial (USD)', 'Initial value (USD)')}{' '}
                    <span className="text-[12px] font-normal text-[#7A8780]">({t('common.optional')})</span>
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
                      className={`${FORM_INPUT_CLASS} pl-11 font-semibold tabular-nums`}
                    />
                  </div>
                </div>

                <div>
                  <label className={FORM_LABEL_CLASS}>{bi('Fecha de adquisición', 'Acquisition date')}</label>
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
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingImplement}
                  className="flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingImplement ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 shrink-0" />
                      <span>{editingImplement ? t('common.saveChanges') : bi('Guardar implemento', 'Save implement')}</span>
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
            title={bi('Elegir icono de implemento agrícola', 'Choose agricultural implement icon')}
          />
        </div>
      )}
      {renderReauthModal()}
    </div>
  );
};
