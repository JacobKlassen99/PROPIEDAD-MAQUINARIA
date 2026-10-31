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
  Sparkles,
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
  seedNewHollandJobs,
  NEW_HOLLAND_DEFAULT_JOBS,
  saveExchangeRateConfig,
  getLocalDateString,
  createAsset,
  updateAsset,
  addAssetImprovement,
  updateAssetImprovement,
  deleteAssetImprovement,
  saveItemConfig,
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
  currency: Currency;
  onRefreshData: () => void | Promise<void>;
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
  options: { value: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  variant?: 'default' | 'green';
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  variant = 'default',
}: SegmentedControlProps<T>) {
  return (
    <div className={`bg-stone-100 p-1 rounded-2xl flex text-xs border border-stone-200/80 gap-1 ${className}`}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const activeClass =
          variant === 'green'
            ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-900 font-extrabold shadow-xs'
            : 'bg-white text-emerald-950 font-bold shadow-2xs border-2 border-transparent';
        const inactiveClass =
          'bg-stone-100/60 hover:bg-stone-200/70 text-stone-600 font-medium border-2 border-transparent';

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2 px-2.5 rounded-xl text-center transition cursor-pointer select-none ${
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
    setScreenState(target);
  };

  const handleGoBack = () => {
    if (screen === 'settings' || screen === 'reports' || screen === 'passwords' || screen === 'activos') {
      setScreenState('main');
    } else {
      setScreenState(prevScreen === screen ? 'settings' : prevScreen);
    }
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
  const [mTipo, setMTipo] = useState('Tractor');
  const [mIcono, setMIcono] = useState<string>('tractor');
  const [showMachineIconSheet, setShowMachineIconSheet] = useState(false);
  const [mTarifa, setMTarifa] = useState<string>('250');
  const [mUnidad, setMUnidad] = useState<'h' | 'ha'>('ha');
  const [mMoneda, setMMoneda] = useState<Currency>('BOB');
  const [mEstado, setMEstado] = useState<'operativo' | 'mantenimiento' | 'inactivo'>('operativo');
  const [mObs, setMObs] = useState('');
  const [mValorPatrimonial, setMValorPatrimonial] = useState('');

  // Exchange Rate Form State
  const [tasaInput, setTasaInput] = useState<string>(
    String(exchangeRate?.tasaBobPerUsd ?? '')
  );
  const [tasaNota, setTasaNota] = useState('');

  React.useEffect(() => {
    if (exchangeRate?.tasaBobPerUsd) {
      setTasaInput(String(exchangeRate.tasaBobPerUsd));
    }
  }, [exchangeRate?.tasaBobPerUsd]);

  // Asset Form State
  const [aTipo, setATipo] = useState<'MAQUINARIA' | 'LOTE' | 'OTRO'>('MAQUINARIA');
  const [aNombre, setANombre] = useState('');
  const [aIdentificador, setAIdentificador] = useState('');
  const [aValorInicial, setAValorInicial] = useState<number | ''>(85000);
  const [aMoneda, setAMoneda] = useState<Currency>('USD');
  const [aFecha, setAFecha] = useState(new Date().toISOString().slice(0, 10));

  // Item Form State
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemModulo, setItemModulo] = useState<'MAQUINARIAS' | 'PROPIEDAD'>('MAQUINARIAS');
  const [itemClase, setItemClase] = useState<'GASTO' | 'INGRESO'>('GASTO');
  const [itemIcono, setItemIcono] = useState<string>('diesel');
  const [showItemIconSheet, setShowItemIconSheet] = useState(false);
  const [itemUnidad, setItemUnidad] = useState('unidades');
  const [itemPrecio, setItemPrecio] = useState<number | ''>('');
  const [itemMoneda, setItemMoneda] = useState<Currency>('BOB');
  const [itemActivo, setItemActivo] = useState(true);

  // Item Filters State
  const [itemClassTab, setItemClassTab] = useState<'GASTO' | 'INGRESO'>('GASTO');
  const [filterModulo, setFilterModulo] = useState<'TODOS' | 'MAQUINARIAS' | 'PROPIEDAD'>('TODOS');
  const [itemSearch, setItemSearch] = useState('');
  const [showInactiveItems, setShowInactiveItems] = useState(false);

  // Activos Patrimoniales Navigation and Details State
  const [activosTab, setActivosTab] = useState<'maquinarias' | 'propiedad'>('maquinarias');
  const [activosMaqSubFilter, setActivosMaqSubFilter] = useState<'TODOS' | 'MAQUINAS' | 'IMPLEMENTOS'>('TODOS');
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

  // Reusable collection of Agricultural Implements (existing in Activos + machine job types without duplicates)
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

    // 2. Discover implements from machineJobTypes and default catalog
    const jobSources: Array<{ id?: string; nombre: string; icono?: string }> = [
      ...(machineJobTypes || []),
      ...NEW_HOLLAND_DEFAULT_JOBS,
    ];

    for (const j of jobSources) {
      const rawName = j.nombre.trim();
      if (!rawName) continue;
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

  // Machine Job Types Management State
  const [expandedAdminMachineId, setExpandedAdminMachineId] = useState<string | null>(null);
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [editingJobTypeId, setEditingJobTypeId] = useState<string | null>(null);
  const [jtMaquinaId, setJtMaquinaId] = useState('');
  const [jtNombre, setJtNombre] = useState('');
  const [jtIcono, setJtIcono] = useState<string>('implemento');
  const [showJtIconSheet, setShowJtIconSheet] = useState(false);
  const [jtTarifa, setJtTarifa] = useState('30');
  const [jtUnidad, setJtUnidad] = useState<'ha' | 'hora'>('ha');
  const [jtMoneda, setJtMoneda] = useState<Currency>('USD');
  const [jtActivo, setJtActivo] = useState(true);
  const [isSavingJobType, setIsSavingJobType] = useState(false);
  const [seedingMachineId, setSeedingMachineId] = useState<string | null>(null);

  // Password Management State
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

  const getJobsForMachine = (mId: string): MachineJobType[] => {
    if (!mId) return [];
    const m = machines.find((item) => item.id === mId);
    let list = (machineJobTypes || []).filter((j) => String(j.maquinaId) === String(mId));
    if (list.length === 0 && m?.trabajos && m.trabajos.length > 0) {
      list = m.trabajos;
    }
    if (
      list.length === 0 &&
      m &&
      (m.nombre.toLowerCase().includes('new holland') ||
        m.nombre.toLowerCase().includes('ts115') ||
        m.nombre.toLowerCase().includes('ts 115'))
    ) {
      list = NEW_HOLLAND_DEFAULT_JOBS.map((j, idx) => ({
        ...j,
        id: `nh_default_${idx + 1}`,
        maquinaId: m.id,
        activo: true,
      }));
    }
    return list;
  };

  const handleOpenAddJobType = (mId: string) => {
    setJtMaquinaId(mId);
    setEditingJobTypeId(null);
    setJtNombre('');
    setJtIcono('implemento');
    setJtTarifa('30');
    setJtUnidad('ha');
    setJtMoneda('USD');
    setJtActivo(true);
    setShowJobTypeModal(true);
  };

  const handleOpenEditJobType = (jt: MachineJobType) => {
    setJtMaquinaId(jt.maquinaId);
    setEditingJobTypeId(jt.id);
    setJtNombre(jt.nombre);
    setJtIcono(jt.icono || 'implemento');
    setJtTarifa(String(jt.tarifa));
    const rawU = String(jt.unidad || 'ha').toLowerCase();
    setJtUnidad(rawU.includes('hora') || rawU === 'h' ? 'hora' : 'ha');
    setJtMoneda(jt.moneda);
    setJtActivo(jt.activo !== false);
    setShowJobTypeModal(true);
  };

  const handleSaveJobType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jtNombre.trim()) {
      setErrorMsg('El nombre del trabajo es obligatorio.');
      return;
    }
    setIsSavingJobType(true);
    setErrorMsg(null);
    try {
      await saveMachineJobType({
        ...(editingJobTypeId ? { id: editingJobTypeId } : {}),
        maquinaId: jtMaquinaId,
        nombre: jtNombre.trim(),
        icono: jtIcono,
        tarifa: parseDecimalNumber(jtTarifa),
        unidad: jtUnidad,
        moneda: jtMoneda,
        activo: jtActivo,
      });
      setSuccessMsg(
        editingJobTypeId
          ? 'Trabajo y tarifa actualizados.'
          : 'Nuevo trabajo registrado exitosamente.'
      );
      setShowJobTypeModal(false);
      onRefreshData();
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el trabajo');
    } finally {
      setIsSavingJobType(false);
    }
  };

  const handleDeleteJobTypeConfirm = async (jt: MachineJobType) => {
    const confirmed = window.confirm(
      `¿Desea eliminar la labor "${jt.nombre}" de esta máquina?`
    );
    if (!confirmed) return;
    try {
      await deleteMachineJobType(jt.id);
      setSuccessMsg('Labor eliminada de la máquina.');
      onRefreshData();
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar labor');
    }
  };

  const handleSeedJobs = async (mId: string) => {
    setSeedingMachineId(mId);
    setErrorMsg(null);
    try {
      await seedNewHollandJobs(mId);
      setSuccessMsg('Se cargaron exitosamente las 10 labores oficiales New Holland TS115.');
      onRefreshData();
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar labores oficiales');
    } finally {
      setSeedingMachineId(null);
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
      onRefreshData();
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
      onRefreshData();
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
      await onRefreshData();

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
      onRefreshData();
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
      await onRefreshData();

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
      onRefreshData();
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

  // Submit Exchange Rate
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedTasa = parseDecimalNumber(tasaInput);
    if (!tasaInput || isNaN(parsedTasa) || parsedTasa <= 0) {
      setErrorMsg('Ingresa una tasa de cambio válida mayor a 0 (ejemplo: 6.96 o 6,96).');
      return;
    }

    setSaving(true);
    try {
      const res = await saveExchangeRateConfig({
        tasaBobPerUsd: parsedTasa,
        nota: tasaNota.trim() || 'Configurado manualmente por el administrador',
        fecha: getLocalDateString(),
      });
      setSuccessMsg(`Tipo de cambio guardado a ${parsedTasa} Bs/$.`);
      if (res?.tasaBobPerUsd) {
        setTasaInput(String(res.tasaBobPerUsd));
      }
      onRefreshData();
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
      onRefreshData();
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
      await onRefreshData();
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
      await onRefreshData();
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
      onRefreshData();
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
      onRefreshData();
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
      setErrorMsg('El nombre del ítem es obligatorio.');
      return;
    }
    // Ingresos can only belong to Propiedad
    const assignedModulo = itemClase === 'INGRESO' ? 'PROPIEDAD' : itemModulo;

    setSaving(true);
    try {
      await saveItemConfig({
        id: editingItemId || undefined,
        nombre: itemName.trim(),
        modulo: assignedModulo,
        clase: itemClase,
        icono: itemIcono,
        unidad: itemUnidad.trim() || 'unidades',
        precio: typeof itemPrecio === 'number' ? itemPrecio : 0,
        moneda: itemMoneda,
        activo: itemActivo,
      });
      setSuccessMsg(
        editingItemId
          ? `Ítem "${itemName.trim()}" actualizado correctamente.`
          : `Ítem "${itemName.trim()}" creado exitosamente.`
      );
      setShowItemForm(false);
      setEditingItemId(null);
      setItemName('');
      setItemIcono(itemClassTab === 'INGRESO' ? 'soya' : 'diesel');
      setItemPrecio('');
      onRefreshData();
    } catch (err: unknown) {
      if (isAuthError(err)) {
        setIsAuthorized(false);
        setShowReauthModal(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el ítem');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddItem = () => {
    setEditingItemId(null);
    setItemName('');
    const cls = itemClassTab;
    setItemClase(cls);
    if (cls === 'INGRESO') {
      setItemModulo('PROPIEDAD');
      setItemIcono('soya');
      setItemUnidad('toneladas');
    } else {
      setItemModulo(filterModulo !== 'TODOS' ? filterModulo : 'PROPIEDAD');
      setItemIcono('diesel');
      setItemUnidad('litros');
    }
    setItemPrecio('');
    setItemMoneda('BOB');
    setItemActivo(true);
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
    setItemModulo(normCls === 'INGRESO' ? 'PROPIEDAD' : normMod);

    setItemUnidad(item.unidad || 'unidades');
    setItemPrecio(item.precioPredeterminado ?? item.precio ?? '');
    setItemMoneda((item.moneda as Currency) || 'BOB');
    setItemActivo(item.activo !== false);
    setShowItemForm(true);
  };

  // Filter Items
  const filteredItems = useMemo(() => {
    return itemsConfig.filter((item) => {
      // 1. Filter by Class (GASTO vs INGRESO)
      const itemCls = item.clase || (item.tipo && item.tipo.includes('ingreso') ? 'INGRESO' : 'GASTO');
      if (itemCls !== itemClassTab) return false;

      // 2. Filter by Module:
      // If INGRESO, strictly show only items for Propiedad
      const itemMod = item.modulo || (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD');
      if (itemClassTab === 'INGRESO') {
        if (itemMod !== 'PROPIEDAD') return false;
      } else {
        if (filterModulo !== 'TODOS' && itemMod !== filterModulo) return false;
      }

      // 3. Filter by Active state
      const isActivo = item.activo !== false;
      if (!showInactiveItems && !isActivo) return false;

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
  }, [itemsConfig, itemClassTab, filterModulo, showInactiveItems, itemSearch]);

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
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5">
          <div className="text-center space-y-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 mx-auto border border-emerald-100">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
              Autorización Administrativa
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
              Ingresa la contraseña de administrador (CONTRASENA_ADMIN) para autorizar este dispositivo y acceder a las opciones de administración.
            </p>
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
                Contraseña de Administrador
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Ingresa CONTRASENA_ADMIN"
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
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#367C2B] hover:bg-emerald-800 text-white font-semibold py-3 text-xs sm:text-sm shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              {authorizing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Autorizando dispositivo...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Autorizar Dispositivo</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-stone-400 text-center leading-relaxed">
            Una vez autorizado, este dispositivo conservará la sesión administrativa de forma persistente.
          </p>
        </div>
      </div>
    );
  }

  // RENDER LEVEL 3: Financial Reports Screen (FINANZAS)
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
          onBack={handleGoBack}
        />
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 1: Main Administration Screen
  if (screen === 'main') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto w-full">
        {/* Header Title */}
        <div className="border-b border-stone-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-900 tracking-tight">
                ADMINISTRACIÓN DEL SISTEMA
              </h1>
              <p className="text-xs text-stone-500">
                Selecciona una opción para ver reportes o gestionar la configuración
              </p>
            </div>
          </div>
        </div>

        {/* Global Messages */}
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="break-words">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMsg && (
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

        {/* Main Menu List */}
        <div className="rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100 shadow-xs overflow-hidden">
          {/* Option 1: Configuración */}
          <button
            type="button"
            onClick={() => navigateTo('settings')}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[64px]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition">
                <Settings className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                  Configuración
                </h3>
                <p className="text-xs text-stone-500 truncate">
                  Administrar datos, reportes y parámetros
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* Option 2: FINANZAS */}
          <button
            type="button"
            onClick={() => navigateTo('reports')}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[64px]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                  FINANZAS
                </h3>
                <p className="text-xs text-stone-500 truncate">
                  Balances y resultados económicos
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* Option 3: Activos Patrimoniales */}
          <button
            type="button"
            onClick={() => navigateTo('activos')}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[64px]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white transition">
                <Landmark className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                    Activos Patrimoniales
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {machines.length + lots.length}
                  </span>
                </div>
                <p className="text-xs text-stone-500 truncate">
                  Valoración e historial de mejoras de máquinas y lotes
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* Option 4: Cambiar contraseñas */}
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
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[64px]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 group-hover:bg-amber-600 group-hover:text-white transition">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                  Cambiar contraseñas
                </h3>
                <p className="text-xs text-stone-500 truncate">
                  Administrador y Usuario
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>
        </div>

        <AppsScriptModal isOpen={showScriptModal} onClose={() => setShowScriptModal(false)} />
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 2: Cambiar Contraseñas Screen
  if (screen === 'passwords') {
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
            'Contraseña de Administrador actualizada exitosamente. Redirigiendo...'
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
            'Contraseña de Usuario actualizada exitosamente.'
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

    return (
      <div className="space-y-4 max-w-md mx-auto w-full">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-stone-200/80">
          <button
            type="button"
            onClick={handleGoBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer shrink-0 min-h-[38px]"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-700" />
            <span>Volver a Administración</span>
          </button>
        </div>

        {/* Screen Header */}
        <div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
            Cambiar contraseña
          </h2>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
          {/* iOS Segmented Control */}
          <SegmentedControl
            options={[
              { value: 'usuario', label: 'Usuario' },
              { value: 'admin', label: 'Admin' },
            ]}
            value={pwdTargetRole}
            onChange={(val) => {
              setPwdTargetRole(val as any);
              setPwdErrorMsg(null);
              setPwdSuccessMsg(null);
            }}
          />

          {/* Alert Messages */}
          {pwdErrorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span className="font-semibold break-words">{pwdErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setPwdErrorMsg(null)}
                className="text-red-500 hover:text-red-700 p-1 shrink-0 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {pwdSuccessMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-semibold break-words">{pwdSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setPwdSuccessMsg(null)}
                className="text-emerald-600 hover:text-emerald-800 p-1 shrink-0 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleInitiatePasswordChange} className="space-y-3.5">
            {/* Field 1: Contraseña actual de Admin */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-700">
                Contraseña actual de Admin
              </label>
              <div className="relative">
                <input
                  type={showPwdCurrent ? 'text' : 'password'}
                  value={pwdCurrentAdmin}
                  onChange={(e) => setPwdCurrentAdmin(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 pr-10 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition min-h-[42px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPwdCurrent(!showPwdCurrent)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  title={showPwdCurrent ? 'Ocultar' : 'Ver'}
                >
                  {showPwdCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Field 2: Nueva contraseña */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-700">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPwdNew ? 'text' : 'password'}
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 pr-10 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition min-h-[42px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPwdNew(!showPwdNew)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  title={showPwdNew ? 'Ocultar' : 'Ver'}
                >
                  {showPwdNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Field 3: Confirmar contraseña */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-stone-700">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  type={showPwdConfirm ? 'text' : 'password'}
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 pr-10 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition min-h-[42px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPwdConfirm(!showPwdConfirm)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  title={showPwdConfirm ? 'Ocultar' : 'Ver'}
                >
                  {showPwdConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Primary Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingPwd}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 text-xs sm:text-sm shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                {isSavingPwd ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Guardar contraseña</span>
                )}
              </button>

              <p className="text-xs text-stone-500 text-center mt-2.5">
                Se cerrarán las sesiones correspondientes.
              </p>
            </div>
          </form>
        </div>

        {/* Confirmation Modal */}
        {showConfirmPwdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl border border-stone-200/80 text-center space-y-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 mx-auto">
                <Lock className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">¿Cambiar contraseña?</h3>
                <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                  {pwdTargetRole === 'usuario'
                    ? 'Se cerrarán las sesiones de Usuario en todos los dispositivos. ¿Continuar?'
                    : 'Se cerrarán todas las sesiones de Administrador, incluida esta. ¿Continuar?'}
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmPwdModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 bg-stone-100 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition cursor-pointer min-h-[40px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecutePasswordChange}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition cursor-pointer shadow-xs min-h-[40px]"
                >
                  Cambiar contraseña
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

          {/* 3. Maquinarias */}
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
                    Maquinarias
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {machines.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  Flota de equipos y tarifas base
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
                <p className="text-[11px] text-stone-500 truncate">
                  Tasa: {exchangeRate.tasaBobPerUsd || 6.96} Bs/$
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
        {renderReauthModal()}
      </div>
    );
  }

  // RENDER LEVEL 3: Detail Option Screens
  return (
    <div className="space-y-5 w-full max-w-4xl mx-auto">
      {/* Top Header with Back Button (For Configuración sub-screens) */}
      {screen !== 'activos' && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200">
          <button
            type="button"
            onClick={handleGoBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 transition cursor-pointer shrink-0 min-h-[38px]"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-700" />
            <span>Volver a Configuración</span>
          </button>

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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition cursor-pointer min-h-[38px]"
            >
              <Plus className="h-4 w-4" />
              <span>Añadir Campaña</span>
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
                setErrorMsg(null);
                setShowLotForm(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition cursor-pointer min-h-[38px]"
            >
              <Plus className="h-4 w-4" />
              <span>Crear Nuevo Lote</span>
            </button>
          )}

          {screen === 'maquinarias' && (
            <button
              type="button"
              onClick={() => {
                setEditingMachineId(null);
                setMNombre('');
                setMIdentificacion('');
                setMTipo('Tractor');
                setMIcono('tractor');
                setMTarifa('250');
                setMUnidad('ha');
                setMMoneda('BOB');
                setMEstado('operativo');
                setMObs('');
                setErrorMsg(null);
                setShowMachineForm(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition cursor-pointer min-h-[38px]"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Maquinaria</span>
            </button>
          )}

          {screen === 'items' && (
            <button
              type="button"
              onClick={() => {
                setEditingItemId(null);
                setItemName('');
                setItemIcono(itemClassTab === 'INGRESO' ? 'granos' : 'diesel');
                setItemModulo('MAQUINARIAS');
                setItemClase(itemClassTab);
                setItemUnidad('unidades');
                setItemPrecio('');
                setItemMoneda('BOB');
                setItemActivo(true);
                setErrorMsg(null);
                setShowItemForm(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition cursor-pointer min-h-[38px]"
            >
              <Plus className="h-4 w-4" />
              <span>Crear Nuevo Ítem</span>
            </button>
          )}

          {/* No standalone button needed for activos screen */}
        </div>
      )}

      {/* Global Success Banner */}
      {successMsg && (
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
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-700" />
                Campañas Agrícolas ({campaigns.length})
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Histórico de campañas y selección de la campaña activa
              </p>
            </div>
          </div>

          {/* Records List FIRST */}
          <div className="space-y-2.5">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition gap-3 bg-white ${
                  c.activa ? 'border-emerald-400 bg-emerald-50/30 shadow-xs' : 'border-stone-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      c.activa ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    <Calendar className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 truncate">{c.nombre}</p>
                    <p className="text-[11px] text-stone-500 truncate">
                      Iniciada: {c.fechaInicio || '-'} &bull; Estado: {c.estado}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {c.activa ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-full border border-emerald-300">
                      <Check className="h-3.5 w-3.5" />
                      Campaña Activa
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleActivateCampaign(c.id)}
                      className="text-xs font-semibold text-stone-700 hover:text-emerald-800 border border-stone-300 hover:border-emerald-600 px-3.5 py-1.5 rounded-lg transition cursor-pointer min-h-[36px]"
                    >
                      Activar esta
                    </button>
                  )}
                </div>
              </div>
            ))}

            {campaigns.length === 0 && (
              <div className="p-10 text-center text-xs text-stone-400 bg-white rounded-xl border border-stone-200">
                No hay campañas registradas.
              </div>
            )}
          </div>

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
            <form onSubmit={handleCampaignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nombre de Campaña *
                </label>
                <input
                  type="text"
                  value={cNombre}
                  onChange={(e) => setCNombre(e.target.value)}
                  placeholder="Verano 2026/2027"
                  required
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="cActivaModal"
                  checked={cActiva}
                  onChange={(e) => setCActiva(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="cActivaModal" className="text-xs font-medium text-stone-800 cursor-pointer">
                  Establecer como la única campaña activa
                </label>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCampaignForm(false);
                    setErrorMsg(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Campaña</span>
                  )}
                </button>
              </div>
            </form>
          </IOSModal>
        </div>
      )}

      {/* DETAIL 2: LOTES */}
      {screen === 'lotes' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <LandPlot className="h-5 w-5 text-emerald-700" />
                Lotes de la Propiedad ({lots.length})
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Superficie Total:{' '}
                <span className="font-bold text-emerald-800">
                  {lots.reduce((acc, l) => acc + (Number(l.superficieHectareas) || 0), 0).toFixed(1)} ha
                </span>
              </p>
            </div>
          </div>

          {/* Records List FIRST */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            {/* MOBILE VIEW: Vertical Cards */}
            <div className="block md:hidden space-y-2.5">
              {lots.map((lot) => (
                <div
                  key={lot.id}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between border-b border-stone-200/60 pb-2">
                    <div className="min-w-0 pr-2">
                      <h4 className="text-xs font-bold text-stone-900 truncate">{lot.nombre}</h4>
                      <p className="text-[11px] font-semibold text-emerald-800 font-mono">
                        {lot.superficieHectareas} ha
                      </p>
                    </div>
                    {lot.cultivoActual && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium shrink-0">
                        {lot.cultivoActual}
                      </span>
                    )}
                  </div>

                  {lot.ubicacion && (
                    <p className="text-[11px] text-stone-600">
                      <span className="text-stone-400">Ubicación:</span> {lot.ubicacion}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200/60">
                    <button
                      type="button"
                      onClick={() => handleEditLot(lot)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[36px]"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-stone-500" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLotConfirm(lot.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer min-h-[36px]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}

              {lots.length === 0 && (
                <div className="py-10 text-center text-xs text-stone-400">
                  No hay lotes registrados aún.
                </div>
              )}
            </div>

            {/* DESKTOP VIEW: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-3 font-semibold">Nombre del Lote</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Superficie</th>
                    <th className="py-2.5 px-3 font-semibold">Cultivo Actual</th>
                    <th className="py-2.5 px-3 font-semibold">Ubicación</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {lots.map((lot) => (
                    <tr key={lot.id} className="hover:bg-stone-50">
                      <td className="py-2 px-3 font-bold text-stone-900">{lot.nombre}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-800 font-mono">
                        {lot.superficieHectareas} ha
                      </td>
                      <td className="py-2 px-3 text-stone-700">{lot.cultivoActual || '-'}</td>
                      <td className="py-2 px-3 text-stone-500">{lot.ubicacion || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditLot(lot)}
                            className="p-1 text-stone-400 hover:text-emerald-700 hover:bg-stone-100 rounded transition cursor-pointer"
                            title="Editar Lote"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLotConfirm(lot.id)}
                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded transition cursor-pointer"
                            title="Eliminar Lote"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {lots.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-xs text-stone-400">
                        No hay lotes registrados aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

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
            <form onSubmit={handleLotSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nombre del Lote *
                  </label>
                  <input
                    type="text"
                    value={lotNombre}
                    onChange={(e) => setLotNombre(e.target.value)}
                    placeholder="Lote 5 - El Palmar"
                    required
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Superficie (Hectáreas) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={lotSuperficie}
                    onChange={(e) => setLotSuperficie(e.target.value)}
                    placeholder="50"
                    required
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Cultivo Actual
                  </label>
                  <input
                    type="text"
                    value={lotCultivo}
                    onChange={(e) => setLotCultivo(e.target.value)}
                    placeholder="Soya / Maíz / Sorgo / Barbecho"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={lotUbicacion}
                    onChange={(e) => setLotUbicacion(e.target.value)}
                    placeholder="Sector Norte, potrero principal"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white min-h-[42px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={lotObs}
                  onChange={(e) => setLotObs(e.target.value)}
                  placeholder="Calidad de suelo, canal de riego..."
                  className="w-full text-xs p-3 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white"
                />
              </div>

              {/* Valor Patrimonial del Terreno */}
              <div className="pt-2 border-t border-stone-200/80">
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Valor total del terreno (USD)
                  <span className="text-[11px] font-normal text-stone-500 ml-1">
                    (Opcional · Valor patrimonial global)
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    USD
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={lotValorPatrimonial}
                    onChange={(e) => setLotValorPatrimonial(e.target.value)}
                    placeholder="Ej. 120000"
                    className="w-full text-xs pl-12 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold text-emerald-950 font-mono min-h-[42px]"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Define el valor patrimonial total del lote o terreno en USD para Activos Patrimoniales.
                </p>
              </div>

              <div className="flex gap-2.5 pt-3">
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
                  className="flex-1 py-3 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingLotId ? 'Guardar Cambios' : 'Crear Lote'}</span>
                  )}
                </button>
              </div>
            </form>
          </IOSModal>
        </div>
      )}

      {/* DETAIL 3: MAQUINARIAS */}
      {screen === 'maquinarias' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Tractor className="h-5 w-5 text-emerald-700" />
                Flota de Maquinarias ({machines.length})
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Configuración de equipos, identificadores y tarifas base
              </p>
            </div>
          </div>

          {/* Records List FIRST */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            {/* MOBILE VIEW: Compact Cards */}
            <div className="block md:hidden space-y-3">
              {machines.map((m) => {
                const mJobs = getJobsForMachine(m.id);
                const isExpanded = expandedAdminMachineId === m.id;
                const isNewHolland =
                  m.nombre.toLowerCase().includes('new holland') ||
                  m.nombre.toLowerCase().includes('ts115') ||
                  m.nombre.toLowerCase().includes('ts 115');

                return (
                  <div key={m.id} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0 flex items-center justify-center p-1 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
                          <VisualIcon name={m.icono || 'tractor'} size="sm" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-stone-900 truncate">{m.nombre}</h4>
                          <span className="text-[10px] text-stone-500">{m.identificacion} &bull; {m.tipo}</span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          m.estado === 'operativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {m.estado}
                      </span>
                    </div>

                    <div className="text-xs text-stone-700 flex justify-between">
                      <span className="text-stone-500">Tarifa Base:</span>
                      <span className="font-bold font-mono text-emerald-800">
                        {m.moneda} {m.tarifa}/{m.unidad}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedAdminMachineId(isExpanded ? null : m.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-stone-300 text-stone-800 text-xs font-bold transition hover:bg-stone-50 cursor-pointer min-h-[38px]"
                    >
                      <span className="flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 text-emerald-700" />
                        <span>Trabajos y Tarifas ({mJobs.length})</span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-stone-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-stone-500" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="p-2.5 rounded-lg bg-white border border-stone-200 space-y-2.5">
                        {isNewHolland && (
                          <button
                            type="button"
                            disabled={seedingMachineId === m.id}
                            onClick={() => handleSeedJobs(m.id)}
                            className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[38px]"
                          >
                            {seedingMachineId === m.id ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Cargando 10 trabajos oficiales...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                                <span>Cargar 10 trabajos oficiales New Holland TS115</span>
                              </>
                            )}
                          </button>
                        )}

                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {mJobs.map((jt) => (
                            <div
                              key={jt.id}
                              className="p-2 rounded-lg bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-2">
                                <div className="shrink-0 flex items-center justify-center p-1 rounded-lg bg-white border border-stone-200 shadow-2xs">
                                  <VisualIcon name={jt.icono || 'implemento'} size="xs" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-bold text-stone-900 block truncate">
                                    {jt.nombre}
                                  </span>
                                  <span className="text-[11px] font-semibold text-emerald-800 font-mono">
                                    {jt.moneda === 'USD' ? 'USD' : 'Bs'} {jt.tarifa} / {jt.unidad}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditJobType(jt)}
                                  className="p-1 text-stone-500 hover:text-emerald-700 hover:bg-stone-200 rounded cursor-pointer"
                                  title="Editar labor"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteJobTypeConfirm(jt)}
                                  className="p-1 text-stone-400 hover:text-red-600 hover:bg-stone-200 rounded cursor-pointer"
                                  title="Eliminar labor"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenAddJobType(m.id)}
                          className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-stone-300 hover:border-emerald-600 text-xs font-semibold text-stone-700 hover:text-emerald-800 hover:bg-emerald-50/50 transition cursor-pointer min-h-[36px]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Agregar Labor / Trabajo</span>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200/60">
                      <button
                        type="button"
                        onClick={() => handleEditMachine(m)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[36px]"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-stone-500" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMachineClick(m)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer min-h-[36px]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {machines.length === 0 && (
                <div className="py-10 text-center text-xs text-stone-400">
                  No hay maquinarias registradas.
                </div>
              )}
            </div>

            {/* DESKTOP VIEW: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-3 font-semibold">Identificación / Nombre</th>
                    <th className="py-2.5 px-3 font-semibold">Tipo</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tarifa Base</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Trabajos Configurados</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Estado</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {machines.map((m) => {
                    const mJobs = getJobsForMachine(m.id);
                    const isExpanded = expandedAdminMachineId === m.id;
                    const isNewHolland =
                      m.nombre.toLowerCase().includes('new holland') ||
                      m.nombre.toLowerCase().includes('ts115') ||
                      m.nombre.toLowerCase().includes('ts 115');

                    return (
                      <React.Fragment key={m.id}>
                        <tr className="hover:bg-stone-50">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="shrink-0 flex items-center justify-center p-1 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
                                <VisualIcon name={m.icono || 'tractor'} size="sm" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-stone-900 block truncate">{m.nombre}</span>
                                <span className="block text-[10px] text-stone-400">{m.identificacion}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-stone-600">{m.tipo}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-800 font-mono">
                            {m.moneda} {m.tarifa}/{m.unidad}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setExpandedAdminMachineId(isExpanded ? null : m.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-stone-300 hover:border-emerald-600 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 transition cursor-pointer min-h-[32px]"
                            >
                              <Wrench className="h-3.5 w-3.5 text-emerald-700" />
                              <span>{mJobs.length} labores</span>
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-stone-400" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                                m.estado === 'operativo'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {m.estado}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditMachine(m)}
                                className="p-1.5 text-stone-400 hover:text-emerald-700 hover:bg-stone-100 rounded transition cursor-pointer"
                                title="Editar Maquinaria"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMachineClick(m)}
                                className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded transition cursor-pointer"
                                title="Eliminar Maquinaria"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-stone-50/80">
                            <td colSpan={6} className="p-4 border-t border-b border-stone-200">
                              <div className="max-w-3xl mx-auto space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h5 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                    <Wrench className="h-4 w-4 text-emerald-700" />
                                    <span>Labores y Tarifas para {m.nombre}</span>
                                  </h5>

                                  <div className="flex items-center gap-2">
                                    {isNewHolland && (
                                      <button
                                        type="button"
                                        disabled={seedingMachineId === m.id}
                                        onClick={() => handleSeedJobs(m.id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition cursor-pointer min-h-[34px] disabled:opacity-50"
                                      >
                                        {seedingMachineId === m.id ? (
                                          <>
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            <span>Cargando...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                                            <span>Cargar 10 trabajos oficiales</span>
                                          </>
                                        )}
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleOpenAddJobType(m.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-600 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold transition cursor-pointer min-h-[34px]"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      <span>Agregar Labor</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {mJobs.map((jt) => (
                                    <div
                                      key={jt.id}
                                      className="p-2.5 rounded-lg bg-white border border-stone-200 flex items-center justify-between gap-2 shadow-2xs"
                                    >
                                      <div className="min-w-0 flex-1 flex items-center gap-2">
                                        <div className="shrink-0 flex items-center justify-center p-1 rounded-lg bg-stone-50 border border-stone-200 shadow-2xs">
                                          <VisualIcon name={jt.icono || 'implemento'} size="xs" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <span className="text-xs font-bold text-stone-900 block truncate">
                                            {jt.nombre}
                                          </span>
                                          <span className="text-[11px] font-semibold text-emerald-800 font-mono">
                                            {jt.moneda === 'USD' ? 'USD' : 'Bs'} {jt.tarifa} / {jt.unidad}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditJobType(jt)}
                                          className="p-1 text-stone-500 hover:text-emerald-700 hover:bg-stone-100 rounded cursor-pointer"
                                          title="Editar labor"
                                        >
                                          <Edit3 className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteJobTypeConfirm(jt)}
                                          className="p-1 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded cursor-pointer"
                                          title="Eliminar labor"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                  {mJobs.length === 0 && (
                                    <div className="col-span-full py-4 text-center text-xs text-stone-500 bg-white rounded-lg border border-stone-200">
                                      No hay labores individuales configuradas. Usa el botón superior para agregar labores.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {machines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-stone-400">
                        No hay maquinarias registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deletion Confirmation Modal */}
          {deletingMachine && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-stone-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Confirmar eliminación de maquinaria</h3>
                    <p className="text-xs text-stone-500">Esta acción no se puede deshacer.</p>
                  </div>
                </div>

                <div className="rounded-xl bg-stone-50 p-3 border border-stone-200 space-y-1">
                  <p className="text-xs font-semibold text-stone-900">{deletingMachine.nombre}</p>
                  {deletingMachine.identificacion && (
                    <p className="text-[11px] text-stone-500 font-mono">Código: {deletingMachine.identificacion}</p>
                  )}
                  <p className="text-[11px] text-stone-600">Tipo: {deletingMachine.tipo} &bull; Tarifa: {deletingMachine.moneda} {deletingMachine.tarifa}/{deletingMachine.unidad}</p>
                </div>

                <p className="text-xs text-stone-600">
                  ¿Estás seguro de que deseas eliminar esta maquinaria? Se eliminará de la flota pero se conservarán sus registros históricos vinculados.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeletingMachine(null)}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[38px] disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleExecuteDeleteMachine}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 transition cursor-pointer min-h-[38px] disabled:opacity-50"
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
              </div>
            </div>
          )}

          {/* Modal Maquinaria */}
          <IOSModal
            isOpen={showMachineForm}
            onClose={() => {
              setShowMachineForm(false);
              setEditingMachineId(null);
              setMNombre('');
              setMIdentificacion('');
              setErrorMsg(null);
            }}
            title={editingMachineId ? 'Editar Maquinaria' : 'Registrar Maquinaria'}
            subtitle="Configura el equipo, identificador, tipo, tarifa e icono"
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleMachineSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nombre / Modelo *
                  </label>
                  <input
                    type="text"
                    value={mNombre}
                    onChange={(e) => setMNombre(e.target.value)}
                    placeholder="Tractor John Deere 6110M"
                    required
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white font-semibold min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Identificación / Código
                  </label>
                  <input
                    type="text"
                    value={mIdentificacion}
                    onChange={(e) => setMIdentificacion(e.target.value)}
                    placeholder="TR-01"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white min-h-[42px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tipo de Equipo <span className="text-red-500">*</span>
                </label>
                <select
                  value={mTipo}
                  onChange={(e) => setMTipo(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px] text-stone-800"
                >
                  <option value="Tractor">Tractor</option>
                  <option value="Cosechadora">Cosechadora</option>
                  <option value="Fumigadora">Fumigadora</option>
                  <option value="Camión">Camión</option>
                  <option value="Vehículo">Vehículo</option>
                  <option value="Otro">Otro</option>
                  {mTipo &&
                    !['Tractor', 'Cosechadora', 'Fumigadora', 'Camión', 'Vehículo', 'Otro'].includes(mTipo) && (
                      <option value={mTipo}>{mTipo} (Histórico)</option>
                    )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Icono realista
                </label>
                <button
                  type="button"
                  onClick={() => setShowMachineIconSheet(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-stone-300 bg-stone-50/50 hover:bg-white transition min-h-[44px] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <VisualIcon name={mIcono || 'tractor'} size="sm" />
                    <span className="text-xs font-semibold text-stone-800 truncate">
                      {getIconDefinition(mIcono || 'tractor').label}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 shrink-0">Elegir icono</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Tarifa *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={mTarifa}
                    onChange={(e) => setMTarifa(e.target.value)}
                    placeholder="250"
                    required
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white font-semibold min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Unidad</label>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda</label>
                  <SegmentedControl
                    options={[
                      { value: 'BOB', label: 'BOB (Bs)' },
                      { value: 'USD', label: 'USD ($)' },
                    ]}
                    value={mMoneda}
                    onChange={(val) => setMMoneda(val as Currency)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Estado</label>
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
              </div>

              {/* Valor Patrimonial de la Maquinaria */}
              <div className="pt-2 border-t border-stone-200/80">
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Valor total del bien (USD)
                  <span className="text-[11px] font-normal text-stone-500 ml-1">
                    (Opcional · Valor patrimonial base)
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    USD
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={mValorPatrimonial}
                    onChange={(e) => setMValorPatrimonial(e.target.value)}
                    placeholder="Ej. 65000"
                    className="w-full text-xs pl-12 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold text-emerald-950 font-mono min-h-[42px]"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Define el valor patrimonial inicial de la maquinaria en USD para Activos Patrimoniales.
                </p>
              </div>

              <div className="flex gap-2.5 pt-3">
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
                  className="flex-1 py-3 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingMachineId ? 'Guardar Cambios' : 'Registrar Máquina'}</span>
                  )}
                </button>
              </div>
            </form>
          </IOSModal>

          {/* Modal Trabajo de Maquinaria */}
          <IOSModal
            isOpen={showJobTypeModal}
            onClose={() => {
              setShowJobTypeModal(false);
              setErrorMsg(null);
            }}
            title={editingJobTypeId ? 'Editar Labor de Máquina' : 'Nueva Labor para Máquina'}
            subtitle="Configure la labor, tarifa, unidad de cobro e icono"
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleSaveJobType} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nombre de la Labor / Trabajo *
                </label>
                <input
                  type="text"
                  required
                  value={jtNombre}
                  onChange={(e) => setJtNombre(e.target.value)}
                  placeholder="Ej. Siembra directa de soya"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white font-semibold min-h-[42px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Icono del implemento / labor
                </label>
                <button
                  type="button"
                  onClick={() => setShowJtIconSheet(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-stone-300 bg-stone-50/50 hover:bg-white transition min-h-[44px] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0 flex items-center justify-center p-1 rounded-lg bg-white border border-stone-200">
                      <VisualIcon name={jtIcono || 'implemento'} size="sm" />
                    </div>
                    <span className="text-xs font-semibold text-stone-800 truncate">
                      {getIconDefinition(jtIcono || 'implemento').label}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 shrink-0">Elegir icono</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Tarifa *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={jtTarifa}
                    onChange={(e) => setJtTarifa(e.target.value)}
                    placeholder="30"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white font-semibold min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Unidad de Cobro *</label>
                  <SegmentedControl
                    options={[
                      { value: 'ha', label: 'Hectárea (ha)' },
                      { value: 'hora', label: 'Hora' },
                    ]}
                    value={jtUnidad}
                    onChange={(val) => setJtUnidad(val as 'ha' | 'hora')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda *</label>
                  <SegmentedControl
                    options={[
                      { value: 'USD', label: 'USD ($)' },
                      { value: 'BOB', label: 'BOB (Bs)' },
                    ]}
                    value={jtMoneda}
                    onChange={(val) => setJtMoneda(val as Currency)}
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="jtActivoCheck"
                    checked={jtActivo}
                    onChange={(e) => setJtActivo(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="jtActivoCheck" className="text-xs font-semibold text-stone-800 cursor-pointer">
                    Labor Activa
                  </label>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowJobTypeModal(false);
                    setErrorMsg(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingJobType}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  {isSavingJobType ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingJobTypeId ? 'Guardar Cambios' : 'Registrar Labor'}</span>
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
            title="Elegir icono de implemento"
          />
        </div>
      )}

      {/* DETAIL 4: ÍTEMS DE INGRESOS Y GASTOS */}
      {screen === 'items' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Tag className="h-5 w-5 text-emerald-700" />
                <span>Ítems de {itemClassTab === 'GASTO' ? 'Gastos' : 'Ingresos'} ({filteredItems.length})</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {itemClassTab === 'GASTO'
                  ? 'Rubros e insumos para labores de maquinaria y lotes'
                  : 'Conceptos de venta y cosecha agrícola para Propiedad'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddItem}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold shadow-xs transition cursor-pointer min-h-[40px] self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>{itemClassTab === 'GASTO' ? 'Nuevo Ítem de Gasto' : 'Nuevo Ingreso Agrícola'}</span>
            </button>
          </div>

          {/* 3.1 Class Segment Selector [ Gastos | Ingresos ] */}
          <div>
            <SegmentedControl
              options={[
                { value: 'GASTO', label: 'Gastos' },
                { value: 'INGRESO', label: 'Ingresos' },
              ]}
              value={itemClassTab}
              onChange={(val) => setItemClassTab(val)}
              variant="green"
              className="w-full text-sm"
            />
          </div>

          {/* 3.2 Module Segment Selector [ Todos | Maquinarias | Propiedad ] - ONLY for GASTOS */}
          {itemClassTab === 'GASTO' && (
            <div>
              <SegmentedControl
                options={[
                  { value: 'TODOS', label: 'Todos los Módulos' },
                  { value: 'MAQUINARIAS', label: 'Maquinarias' },
                  { value: 'PROPIEDAD', label: 'Propiedad' },
                ]}
                value={filterModulo}
                onChange={(val) => setFilterModulo(val)}
                variant="green"
                className="w-full text-xs"
              />
            </div>
          )}

          {/* 3.3 Search & 3.4 Inactive Items Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder={itemClassTab === 'GASTO' ? 'Buscar insumo o gasto...' : 'Buscar producto o cosecha...'}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none min-h-[38px]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowInactiveItems(!showInactiveItems)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer min-h-[38px] shrink-0 ${
                showInactiveItems
                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                  : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {showInactiveItems ? 'Ocultar inactivos' : 'Ver desactivados'}
            </button>
          </div>

          {/* 3.5 Compact List of Items */}
          <div className="space-y-2 pt-1">
            {filteredItems.map((item) => {
              const isActivo = item.activo !== false;
              const itemMod = item.modulo || (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD');

              return (
                <div
                  key={item.id}
                  onClick={() => handleEditItem(item)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer group ${
                    isActivo
                      ? 'border-stone-200/80 bg-white hover:bg-stone-50 hover:border-emerald-500/50 shadow-2xs'
                      : 'border-stone-200/60 bg-stone-100/80 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 flex items-center justify-center p-1 rounded-xl bg-stone-50 border border-stone-200/80 shadow-2xs">
                      <VisualIcon
                        iconId={item.icono}
                        nameHint={item.nombre}
                        category={itemClassTab === 'INGRESO' ? 'ingreso' : 'gasto'}
                        size="sm"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-stone-900 truncate">{item.nombre}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            itemMod === 'MAQUINARIAS'
                              ? 'bg-amber-100/90 text-amber-900'
                              : 'bg-emerald-100/90 text-emerald-900'
                          }`}
                        >
                          {itemMod === 'MAQUINARIAS' ? 'Maquinarias' : 'Propiedad'}
                        </span>
                        {!isActivo && (
                          <span className="text-[10px] font-semibold text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full">
                            Inactivo
                          </span>
                        )}
                      </div>
                      {item.unidad && (
                        <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                          Unidad: {item.unidad}
                          {(item.precioPredeterminado || item.precio) ? (
                            <span> &bull; Ref: {item.moneda || 'BOB'} {item.precioPredeterminado || item.precio}</span>
                          ) : null}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="py-10 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-stone-200">
                No se encontraron ítems para {itemClassTab === 'GASTO' ? 'gastos' : 'ingresos'} con los filtros seleccionados.
              </div>
            )}
          </div>

          {/* Modal Item */}
          <IOSModal
            isOpen={showItemForm}
            onClose={() => {
              setShowItemForm(false);
              setEditingItemId(null);
              setItemName('');
              setItemPrecio('');
              setErrorMsg(null);
            }}
            title={editingItemId ? 'Editar Ítem' : (itemClase === 'INGRESO' ? 'Registrar Ingreso Agrícola' : 'Crear Ítem de Gasto')}
            subtitle={itemClase === 'INGRESO' ? 'Configura el concepto de cosecha, unidad e icono de ingreso' : 'Configura el rubro, módulo, unidad e icono del gasto'}
            errorMsg={errorMsg}
            onErrorDismiss={() => setErrorMsg(null)}
          >
            <form onSubmit={handleItemSubmit} className="space-y-4">
              {/* Clase Gasto / Ingreso */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Clase de Transacción *
                </label>
                <SegmentedControl
                  options={[
                    { value: 'GASTO', label: 'Gasto' },
                    { value: 'INGRESO', label: 'Ingreso' },
                  ]}
                  value={itemClase}
                  onChange={(val) => {
                    setItemClase(val);
                    if (val === 'INGRESO') {
                      setItemModulo('PROPIEDAD');
                      if (!editingItemId) {
                        setItemIcono('soya');
                        setItemUnidad('toneladas');
                      }
                    } else if (!editingItemId) {
                      setItemIcono('diesel');
                      setItemUnidad('litros');
                    }
                  }}
                  variant="green"
                />
              </div>

              {/* Módulo Maquinarias / Propiedad */}
              {itemClase === 'GASTO' ? (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Módulo Asignado *
                  </label>
                  <SegmentedControl
                    options={[
                      { value: 'MAQUINARIAS', label: 'Maquinarias' },
                      { value: 'PROPIEDAD', label: 'Propiedad' },
                    ]}
                    value={itemModulo}
                    onChange={(val) => setItemModulo(val)}
                    variant="green"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-950">Módulo Asignado: Propiedad</p>
                    <p className="text-[11px] text-emerald-700">
                      Los ingresos de maquinarias se generan exclusivamente a través de los trabajos registrados
                    </p>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full shrink-0 ml-2">
                    Automático
                  </span>
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nombre del Ítem *
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder={itemClase === 'INGRESO' ? 'Ej. Venta Cosecha Soya, Venta de Maíz...' : 'Ej. Semillas de Soya, Repuestos, Diésel...'}
                  required
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
                />
              </div>

              {/* Icono visual button */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Icono realista
                </label>
                <button
                  type="button"
                  onClick={() => setShowItemIconSheet(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-stone-300 bg-stone-50/50 hover:bg-white transition min-h-[44px] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0 flex items-center justify-center p-1 rounded-lg bg-white border border-stone-200">
                      <VisualIcon
                        iconId={itemIcono}
                        nameHint={itemName || (itemClase === 'INGRESO' ? 'soya' : 'diesel')}
                        category={itemClase === 'INGRESO' ? 'ingreso' : 'gasto'}
                        size="sm"
                      />
                    </div>
                    <span className="text-xs font-semibold text-stone-800 truncate">
                      {getIconDefinition(itemIcono || (itemClase === 'INGRESO' ? 'soya' : 'diesel'), itemClase === 'INGRESO' ? 'ingreso' : 'gasto').label}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 shrink-0">Elegir icono</span>
                </button>
              </div>

              {/* Unidad de medida & Precio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Unidad de Medida
                  </label>
                  <input
                    type="text"
                    value={itemUnidad}
                    onChange={(e) => setItemUnidad(e.target.value)}
                    placeholder={itemClase === 'INGRESO' ? 'toneladas, quintales, kg...' : 'litros, kg, unidades...'}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Precio Ref. (Opcional)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={itemPrecio}
                    onChange={(e) =>
                      setItemPrecio(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0.00"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[42px]"
                  />
                </div>
              </div>

              {/* Moneda */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda</label>
                <SegmentedControl
                  options={[
                    { value: 'USD', label: 'USD ($)' },
                    { value: 'BOB', label: 'BOB (Bs)' },
                  ]}
                  value={itemMoneda}
                  onChange={(val) => setItemMoneda(val as Currency)}
                  variant="green"
                />
              </div>

              {/* Estado Activo Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="itemActivoCheckModal"
                  checked={itemActivo}
                  onChange={(e) => setItemActivo(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="itemActivoCheckModal" className="text-xs font-semibold text-stone-800 cursor-pointer">
                  Ítem activo (Disponible en formularios)
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowItemForm(false);
                    setEditingItemId(null);
                    setItemName('');
                    setItemPrecio('');
                    setErrorMsg(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingItemId ? 'Guardar Cambios' : 'Registrar Ítem'}</span>
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
            title={itemClase === 'INGRESO' ? 'Elegir icono de ingreso agrícola' : 'Elegir icono de gasto'}
          />
        </div>
      )}

      {/* DETAIL 5: TIPO DE CAMBIO */}
      {screen === 'monedas' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-700" />
              Tipo de Cambio (BOB / USD)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Establece la tasa oficial de conversión utilizada en informes
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-4">
            <form onSubmit={handleSaveRate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Tasa de Cambio Oficial (BOB por 1 USD) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={tasaInput}
                  onChange={(e) => setTasaInput(e.target.value)}
                  placeholder="Ej. 6.96 o 6,96"
                  required
                  className="w-full text-base font-bold font-mono px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nota Explicativa
                </label>
                <input
                  type="text"
                  value={tasaNota}
                  onChange={(e) => setTasaNota(e.target.value)}
                  placeholder="Configuración manual para la campaña activa"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[42px]"
                />
              </div>

              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 space-y-1">
                <p className="font-semibold">Información del Registro:</p>
                <p className="text-[11px] text-emerald-800">
                  Última actualización: {exchangeRate.fechaActualizacion || 'Hoy'}
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[42px]"
              >
                <span>Guardar Tipo de Cambio</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL 6: ACTIVOS PATRIMONIALES Y MEJORAS */}
      {screen === 'activos' && (
        <div className="space-y-4 max-w-2xl mx-auto w-full">
          {/* 1. Single row with "Volver a Administración" button */}
          <div className="pb-3 border-b border-stone-200">
            <button
              type="button"
              onClick={handleGoBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 transition cursor-pointer shrink-0 min-h-[38px]"
            >
              <ArrowLeft className="h-4 w-4 text-emerald-700" />
              <span>Volver a Administración</span>
            </button>
          </div>

          {/* 2. Title and small description */}
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-emerald-700" />
              <span>Activos Patrimoniales</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Valoración del patrimonio e historial de mejoras incorporadas
            </p>
          </div>

          {/* 3. Segmented control selector taking full available width */}
          <div>
            <SegmentedControl
              options={[
                { value: 'maquinarias', label: `Maquinarias (${machines.length + implementsList.length})` },
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
            const mBase = machines.reduce((acc, m) => acc + getBaseValueForMachine(m, assets), 0);
            const mMejoras = machines.reduce((acc, m) => {
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

                {/* Sub-filter and Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1">
                    <SegmentedControl
                      options={[
                        { value: 'TODOS', label: `Todos (${machines.length + implementsList.length})` },
                        { value: 'MAQUINAS', label: `Máquinas (${machines.length})` },
                        { value: 'IMPLEMENTOS', label: `Implementos (${implementsList.length})` },
                      ]}
                      value={activosMaqSubFilter}
                      onChange={(val) => setActivosMaqSubFilter(val as any)}
                      variant="green"
                      className="w-full text-xs"
                    />
                  </div>

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
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-2xs cursor-pointer min-h-[38px] shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Registrar Implemento</span>
                  </button>
                </div>

                {/* Cards List */}
                <div className="space-y-2">
                  {/* Machines */}
                  {showMachines &&
                    machines.map((m) => {
                      const linked = findAssetForMachine(m, assets);
                      const baseVal = getBaseValueForMachine(m, assets);
                      const imps = linked?.mejoras || [];
                      const sumImps = imps.reduce((a, b) => a + (b.costo || 0), 0);
                      const totVal = baseVal > 0 ? baseVal + sumImps : (sumImps > 0 ? sumImps : 0);

                      return (
                        <div
                          key={`m_${m.id}`}
                          onClick={() => setSelectedEntityForDetail({ type: 'maquinaria', entity: m })}
                          className="rounded-2xl border border-stone-200/80 bg-white p-3 hover:border-emerald-500/50 hover:bg-stone-50/80 transition cursor-pointer shadow-2xs flex items-center justify-between gap-2.5 group min-h-[52px]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="shrink-0 flex items-center justify-center p-1.5 rounded-xl bg-stone-50 border border-stone-200/80">
                              <VisualIcon name={m.icono || 'tractor'} size="sm" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition truncate">
                                  {m.nombre}
                                </h4>
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Máquina
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 truncate mt-0.5">
                                {baseVal > 0 ? `Base: USD ${baseVal.toLocaleString()}` : 'Sin valor'}
                                {sumImps > 0 ? <span className="text-emerald-700 font-semibold"> &bull; Mejoras: USD {sumImps.toLocaleString()}</span> : null}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs sm:text-sm font-black font-mono text-emerald-950">
                              {totVal > 0 ? `USD ${totVal.toLocaleString()}` : <span className="text-stone-400 font-normal text-xs">Sin valor</span>}
                            </span>
                            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0" />
                          </div>
                        </div>
                      );
                    })}

                  {/* Agricultural Implements */}
                  {showImplements &&
                    implementsList.map((imp) => {
                      const linked = findAssetForImplement(imp, assets);
                      const baseVal = getBaseValueForImplement(imp, assets);
                      const imps = linked?.mejoras || imp.mejoras || [];
                      const sumImps = imps.reduce((a, b) => a + (b.costo || 0), 0);
                      const totVal = baseVal > 0 ? baseVal + sumImps : (sumImps > 0 ? sumImps : 0);

                      return (
                        <div
                          key={`imp_${imp.id}`}
                          onClick={() => setSelectedEntityForDetail({ type: 'implemento', entity: imp })}
                          className="rounded-2xl border border-stone-200/80 bg-white p-3 hover:border-emerald-500/50 hover:bg-stone-50/80 transition cursor-pointer shadow-2xs flex items-center justify-between gap-2.5 group min-h-[52px]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="shrink-0 flex items-center justify-center p-1.5 rounded-xl bg-amber-50/80 border border-amber-200/60">
                              <VisualIcon name={imp.icono || 'implemento'} size="sm" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition truncate">
                                  {imp.nombre}
                                </h4>
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-900 border border-amber-200/70">
                                  Implemento
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 truncate mt-0.5">
                                {baseVal > 0 ? `Base: USD ${baseVal.toLocaleString()}` : 'Sin valor'}
                                {sumImps > 0 ? <span className="text-emerald-700 font-semibold"> &bull; Mejoras: USD {sumImps.toLocaleString()}</span> : null}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs sm:text-sm font-black font-mono text-emerald-950">
                              {totVal > 0 ? `USD ${totVal.toLocaleString()}` : <span className="text-stone-400 font-normal text-xs">Sin valor</span>}
                            </span>
                            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0" />
                          </div>
                        </div>
                      );
                    })}

                  {showMachines && machines.length === 0 && !showImplements && (
                    <div className="py-10 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-stone-200">
                      No hay máquinas registradas en la flota.
                    </div>
                  )}

                  {showImplements && implementsList.length === 0 && !showMachines && (
                    <div className="py-10 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-stone-200">
                      No hay implementos agrícolas registrados. Presiona «Registrar Implemento» para agregar uno.
                    </div>
                  )}

                  {machines.length === 0 && implementsList.length === 0 && (
                    <div className="py-10 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-stone-200">
                      No hay máquinas ni implementos registrados.
                    </div>
                  )}
                </div>
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

                {/* Lot Asset Cards - iOS Thin Rows */}
                <div className="space-y-2">
                  {lots.map((l) => {
                    const linked = findAssetForLot(l, assets);
                    const baseVal = getBaseValueForLot(l, assets);
                    const imps = linked?.mejoras || [];
                    const sumImps = imps.reduce((a, b) => a + (b.costo || 0), 0);
                    const totVal = baseVal > 0 ? baseVal + sumImps : (sumImps > 0 ? sumImps : 0);

                    return (
                      <div
                        key={l.id}
                        onClick={() => setSelectedEntityForDetail({ type: 'lote', entity: l })}
                        className="rounded-2xl border border-stone-200/80 bg-white p-3 hover:border-emerald-500/50 hover:bg-stone-50/80 transition cursor-pointer shadow-2xs flex items-center justify-between gap-2.5 group min-h-[52px]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                            <LandPlot className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition truncate">
                              {l.nombre}
                            </h4>
                            <p className="text-[11px] text-stone-500 truncate mt-0.5">
                              {baseVal > 0 ? `Base: USD ${baseVal.toLocaleString()}` : 'Sin valor'}
                              {sumImps > 0 ? <span className="text-emerald-700 font-semibold"> &bull; Mejoras: USD {sumImps.toLocaleString()}</span> : null}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs sm:text-sm font-black font-mono text-emerald-950">
                            {totVal > 0 ? `USD ${totVal.toLocaleString()}` : <span className="text-stone-400 font-normal text-xs">Sin valor</span>}
                          </span>
                          <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0" />
                        </div>
                      </div>
                    );
                  })}

                  {lots.length === 0 && (
                    <div className="py-10 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-stone-200">
                      No hay lotes registrados en la propiedad.
                    </div>
                  )}
                </div>
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
                  <div className="rounded-2xl bg-stone-900 text-white p-4 space-y-3 shadow-md">
                    <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block">
                          Valor Total Patrimonial
                        </span>
                        <span className="text-xl font-black font-mono text-emerald-400 block mt-0.5">
                          {totVal > 0 ? `USD ${totVal.toLocaleString()}` : 'Sin valor'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-stone-400 block">Categoría</span>
                        <span className="text-xs font-semibold text-stone-200">
                          {isMachine
                            ? (entity as Machine).tipo || 'Equipo'
                            : isImplement
                            ? 'Implemento Agrícola'
                            : `${(entity as Lot).superficieHectareas} ha`}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                      <div className="bg-stone-800/80 p-2.5 rounded-xl border border-stone-700/60">
                        <span className="text-[10px] text-stone-400 block font-semibold">Valor Base Inicial</span>
                        <span className="text-sm font-bold font-mono text-stone-100 block mt-0.5">
                          {baseVal > 0 ? `USD ${baseVal.toLocaleString()}` : <span className="text-stone-500 font-normal">Sin valor</span>}
                        </span>
                      </div>

                      <div className="bg-stone-800/80 p-2.5 rounded-xl border border-stone-700/60">
                        <span className="text-[10px] text-stone-400 block font-semibold">Mejoras Acumuladas</span>
                        <span className="text-sm font-bold font-mono text-emerald-400 block mt-0.5">
                          USD {sumImps.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Edit Base Shortcut Link */}
                    <div className="pt-1 text-right">
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
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>{baseVal > 0 ? 'Configurar valor base inicial' : 'Asignar valor inicial'}</span>
                      </button>
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-2xs cursor-pointer min-h-[34px]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Añadir mejora</span>
                      </button>
                    </div>

                    {/* List of Improvements */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {imps.map((imp) => (
                        <div
                          key={imp.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-white transition"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="text-xs font-bold text-stone-900 block truncate">
                              {imp.descripcion}
                            </span>
                            <span className="text-[10px] text-stone-500 block truncate">
                              Fecha: {imp.fecha}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-emerald-800 font-mono">
                              +USD {imp.costo.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditImprovementClick(imp)}
                              className="p-1 text-stone-400 hover:text-emerald-700 rounded transition cursor-pointer"
                              title="Editar mejora"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteImprovementClick(imp)}
                              className="p-1 text-stone-400 hover:text-red-600 rounded transition cursor-pointer"
                              title="Eliminar mejora"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {imps.length === 0 && (
                        <div className="py-6 text-center text-xs text-stone-400 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                          No se han registrado mejoras posteriores para este activo.
                        </div>
                      )}
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
            <form onSubmit={handleAddImprovementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Descripción de la Mejora *
                </label>
                <input
                  type="text"
                  value={impDesc}
                  onChange={(e) => setImpDesc(e.target.value)}
                  placeholder="Ej: Instalación de piloto automático, canal de riego, overhaul..."
                  required
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Costo (USD) *
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={impCosto}
                    onChange={(e) => setImpCosto(e.target.value)}
                    placeholder="Ej. 6000"
                    required
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={impFecha}
                    onChange={(e) => setImpFecha(e.target.value)}
                    required
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white min-h-[42px]"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddImprovementModal(false);
                    setImpDesc('');
                    setImpCosto('');
                  }}
                  className="flex-1 py-3 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Registrar Mejora</span>
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
              title="Editar Mejora"
              subtitle="Modifica la descripción, costo o fecha de la mejora"
              errorMsg={errorMsg}
              onErrorDismiss={() => setErrorMsg(null)}
            >
              <form onSubmit={handleUpdateImprovementSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Descripción *
                  </label>
                  <input
                    type="text"
                    value={editImpDesc}
                    onChange={(e) => setEditImpDesc(e.target.value)}
                    required
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white font-semibold min-h-[42px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Costo (USD) *
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={editImpCosto}
                      onChange={(e) => setEditImpCosto(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white font-bold min-h-[42px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Fecha *
                    </label>
                    <input
                      type="date"
                      value={editImpFecha}
                      onChange={(e) => setEditImpFecha(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingImprovement(null)}
                    className="flex-1 py-3 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition cursor-pointer min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Cambios</span>
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
            <form onSubmit={handleSaveImplement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nombre del Implemento *
                </label>
                <input
                  type="text"
                  value={impFormNombre}
                  onChange={(e) => setImpFormNombre(e.target.value)}
                  placeholder="Ej: Romplow 18 discos, Sembradora John Deere, Rastra tándem..."
                  required
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Icono del Implemento
                </label>
                <button
                  type="button"
                  onClick={() => setShowImpFormIconSheet(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-stone-300 bg-stone-50/50 hover:bg-white transition min-h-[44px] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0 flex items-center justify-center p-1 rounded-lg bg-white border border-stone-200">
                      <VisualIcon name={impFormIcono || 'implemento'} size="sm" />
                    </div>
                    <span className="text-xs font-semibold text-stone-800 truncate">
                      {getIconDefinition(impFormIcono || 'implemento').label}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 shrink-0">Elegir icono</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Valor Patrimonial Inicial (USD)
                    <span className="text-[10px] font-normal text-stone-500 ml-1">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                      USD
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={impFormValorInicial}
                      onChange={(e) => setImpFormValorInicial(e.target.value)}
                      placeholder="Ej. 18000"
                      className="w-full text-xs pl-12 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold text-emerald-950 font-mono min-h-[42px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Fecha de Adquisición
                  </label>
                  <input
                    type="date"
                    value={impFormFecha}
                    onChange={(e) => setImpFormFecha(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white min-h-[42px]"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowImplementForm(false);
                    setEditingImplement(null);
                    setImpFormNombre('');
                    setImpFormValorInicial('');
                  }}
                  className="flex-1 py-3 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition cursor-pointer min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingImplement}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
                >
                  {isSavingImplement ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingImplement ? 'Guardar Cambios' : 'Registrar Implemento'}</span>
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
