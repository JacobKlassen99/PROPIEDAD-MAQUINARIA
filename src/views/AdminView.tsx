import React, { useState, useEffect } from 'react';
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
  ArrowLeft,
  BarChart3,
  Tag,
  Lock,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  LogOut,
  KeyRound,
} from 'lucide-react';
import {
  Campaign,
  Machine,
  Lot,
  ItemConfig,
  Asset,
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
  saveExchangeRateConfig,
  getLocalDateString,
  createAsset,
  addAssetImprovement,
  checkIsAdmin,
  saveItemConfig,
  getItemsConfig,
  authorizeAdminDevice,
  verifyAdminAuthorization,
  revokeAdminAuthorization,
  hasAdminAuthorization,
  getAdminToken,
  isAdminAuthorizationVerifiedInSession,
} from '../services/backend';
import { AppsScriptModal } from '../components/AppsScriptModal';
import { ReportsView } from './ReportsView';

interface Props {
  session: UserSession | null;
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  machines: Machine[];
  lots: Lot[];
  jobs: MachineryJob[];
  expenses: Expense[];
  incomes: Income[];
  itemsConfig: ItemConfig[];
  assets: Asset[];
  exchangeRate: ExchangeRateConfig;
  currency: Currency;
  onRefreshData: () => void;
  onRevokeAuthorization?: () => void;
}

type AdminScreen =
  | 'main'
  | 'reports'
  | 'settings'
  | 'campanas'
  | 'lotes'
  | 'maquinarias'
  | 'items'
  | 'monedas'
  | 'activos';

export const AdminView: React.FC<Props> = ({
  session,
  campaigns = [],
  activeCampaign,
  machines = [],
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
}) => {
  const alreadyVerified = isAdminAuthorizationVerifiedInSession();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(alreadyVerified);
  const [verifyingAuth, setVerifyingAuth] = useState<boolean>(() => !alreadyVerified && !!getAdminToken());
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Strict server verification on mount
  useEffect(() => {
    let isMounted = true;
    const token = getAdminToken();

    if (!token) {
      if (isMounted) {
        setIsAuthorized(false);
        setVerifyingAuth(false);
      }
      return;
    }

    if (isAdminAuthorizationVerifiedInSession()) {
      if (isMounted) {
        setIsAuthorized(true);
        setVerifyingAuth(false);
      }
      return;
    }

    setVerifyingAuth(true);
    verifyAdminAuthorization()
      .then((valid) => {
        if (isMounted) {
          setIsAuthorized(valid);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsAuthorized(false);
        }
      })
      .finally(() => {
        if (isMounted) {
          setVerifyingAuth(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthorizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!adminPasswordInput.trim()) {
      setAuthError('Por favor ingrese la contraseña de administrador.');
      return;
    }
    setAuthorizing(true);
    try {
      await authorizeAdminDevice(adminPasswordInput.trim());
      setIsAuthorized(true);
      setAdminPasswordInput('');
      setSuccessMsg('Dispositivo autorizado como Administrador.');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Error al autorizar administrador');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleRevokeDevice = async () => {
    const confirmed = window.confirm(
      '¿Está seguro de revocar la autorización administrativa de este dispositivo? Para volver a entrar a Administración deberá ingresar nuevamente la contraseña de administrador.'
    );
    if (!confirmed) return;

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

  const navigateTo = (target: AdminScreen) => {
    setPrevScreen(screen);
    setScreenState(target);
  };

  const handleGoBack = () => {
    if (screen === 'settings') {
      setScreenState('main');
    } else {
      setScreenState(prevScreen === screen ? 'settings' : prevScreen);
    }
  };

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showScriptModal, setShowScriptModal] = useState(false);

  // Form Visibility Toggles
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

  // Machine Form State
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [mNombre, setMNombre] = useState('');
  const [mIdentificacion, setMIdentificacion] = useState('');
  const [mTipo, setMTipo] = useState('Tractor');
  const [mTarifa, setMTarifa] = useState<string>('250');
  const [mUnidad, setMUnidad] = useState<'h' | 'ha'>('ha');
  const [mMoneda, setMMoneda] = useState<Currency>('BOB');
  const [mEstado, setMEstado] = useState<'operativo' | 'mantenimiento' | 'inactivo'>('operativo');
  const [mObs, setMObs] = useState('');

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
  const [itemUnidad, setItemUnidad] = useState('unidades');
  const [itemPrecio, setItemPrecio] = useState<number | ''>('');
  const [itemMoneda, setItemMoneda] = useState<Currency>('BOB');
  const [itemActivo, setItemActivo] = useState(true);

  // Item Filters
  const [itemSearch, setItemSearch] = useState('');
  const [filterModulo, setFilterModulo] = useState<'TODOS' | 'MAQUINARIAS' | 'PROPIEDAD'>('TODOS');
  const [filterClase, setFilterClase] = useState<'TODOS' | 'GASTO' | 'INGRESO'>('TODOS');
  const [filterActivo, setFilterActivo] = useState<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('TODOS');

  // Asset Improvement Form State
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [impFecha, setImpFecha] = useState(new Date().toISOString().slice(0, 10));
  const [impDesc, setImpDesc] = useState('');
  const [impCosto, setImpCosto] = useState<number | ''>(6000);
  const [impMoneda, setImpMoneda] = useState<Currency>('USD');

  // Machine Deletion Modal State (Top-level hooks)
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (verifyingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-stone-600 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-700" />
        <p className="text-xs font-semibold text-stone-700">
          Verificando autorización administrativa con Google Apps Script...
        </p>
      </div>
    );
  }

  // Security guard: If device is not authorized with tokenAdmin, show CONTRASENA_ADMIN prompt
  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 rounded-2xl border border-stone-200 bg-white shadow-lg space-y-4">
        <div className="flex flex-col items-center text-center space-y-2 pb-2 border-b border-stone-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
            <KeyRound className="h-7 w-7 text-emerald-700" />
          </div>
          <h2 className="text-base font-bold text-stone-900 tracking-tight">
            Acceso a Administración
          </h2>
          <p className="text-xs text-stone-500 leading-relaxed max-w-sm">
            Este módulo requiere autorización administrativa mediante <span className="font-semibold text-stone-700">CONTRASENA_ADMIN</span>.
            La credencial se almacenará en este equipo de forma persistente y revocable.
          </p>
        </div>

        {authError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">Acceso denegado:</p>
              <p className="mt-0.5 text-stone-800 text-[11px]">{authError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleAuthorizeSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Contraseña de Administrador (CONTRASENA_ADMIN)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showAdminPassword ? 'text' : 'password'}
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Ingrese CONTRASENA_ADMIN"
                required
                autoFocus
                className="block w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword(!showAdminPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
                title={showAdminPassword ? 'Ocultar' : 'Ver'}
              >
                {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              La contraseña se valida directamente contra la hoja <span className="font-mono">configuracion</span> de Google Sheets.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="submit"
              disabled={authorizing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              {authorizing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Validando con Google Apps Script...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Autorizar este dispositivo</span>
                </>
              )}
            </button>

            {onRevokeAuthorization && (
              <button
                type="button"
                onClick={onRevokeAuthorization}
                className="w-full py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-50 transition cursor-pointer min-h-[40px]"
              >
                Volver a Inicio / Maquinarias
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // Submit Campaign
  const handleCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!cNombre.trim()) {
      setErrorMsg('Ingresa un nombre para la campaña (Ej: Verano 2026/2027).');
      return;
    }
    setSaving(true);
    try {
      await createCampaign({
        nombre: cNombre.trim(),
        activa: cActiva,
        fechaInicio: new Date().toISOString().slice(0, 10),
        estado: 'activa',
      });
      setSuccessMsg('Campaña creada exitosamente en Google Sheets.');
      setCNombre('');
      setShowCampaignForm(false);
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al crear campaña');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateCampaign = async (id: string) => {
    try {
      await setActiveCampaign(id);
      setSuccessMsg('Campaña activa actualizada.');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al activar campaña');
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
      if (editingLotId) {
        await updateLot(editingLotId, {
          nombre: lotNombre.trim(),
          superficieHectareas: parsedSup,
          superficie: parsedSup,
          cultivoActual: lotCultivo.trim(),
          ubicacion: lotUbicacion.trim(),
          observaciones: lotObs.trim(),
        });
        setSuccessMsg('Lote actualizado exitosamente.');
      } else {
        await createLot({
          nombre: lotNombre.trim(),
          superficieHectareas: parsedSup,
          superficie: parsedSup,
          cultivoActual: lotCultivo.trim(),
          ubicacion: lotUbicacion.trim(),
          observaciones: lotObs.trim(),
        });
        setSuccessMsg('Lote creado exitosamente en Google Sheets.');
      }

      setLotNombre('');
      setLotSuperficie('50');
      setLotCultivo('');
      setLotUbicacion('');
      setLotObs('');
      setEditingLotId(null);
      setShowLotForm(false);
      onRefreshData();
    } catch (err: unknown) {
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
    setShowLotForm(true);
  };

  const handleDeleteLotConfirm = async (id: string) => {
    if (!window.confirm('¿Confirmas eliminar este lote?')) return;
    try {
      await deleteLot(id);
      setSuccessMsg('Lote eliminado correctamente.');
      onRefreshData();
    } catch (err: unknown) {
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

    setSaving(true);
    try {
      if (editingMachineId) {
        await updateMachine(editingMachineId, {
          nombre: mNombre.trim(),
          identificacion: mIdentificacion.trim(),
          tipo: mTipo,
          tarifa: tarifaParsed,
          unidad: codeUnidad,
          moneda: mMoneda,
          estado: mEstado,
          observaciones: mObs.trim(),
        });
        setSuccessMsg('Maquinaria actualizada.');
      } else {
        await createMachine({
          nombre: mNombre.trim(),
          identificacion: mIdentificacion.trim() || 'TR-01',
          tipo: mTipo,
          tarifa: tarifaParsed,
          unidad: codeUnidad,
          moneda: mMoneda,
          estado: mEstado,
          observaciones: mObs.trim(),
        });
        setSuccessMsg('Maquinaria creada exitosamente en Google Sheets.');
      }

      setEditingMachineId(null);
      setMNombre('');
      setMIdentificacion('');
      setShowMachineForm(false);
      onRefreshData();
    } catch (err: unknown) {
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
    setMTarifa(String(m.tarifa || ''));
    setMUnidad(m.unidad === 'ha' || m.unidad === 'hectarea' ? 'ha' : 'h');
    setMMoneda(m.moneda);
    setMEstado(m.estado as any);
    setMObs(m.observaciones || '');
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
      setSuccessMsg(`Tipo de cambio guardado exitosamente a ${parsedTasa} Bs/$ en Google Sheets.`);
      if (res?.tasaBobPerUsd) {
        setTasaInput(String(res.tasaBobPerUsd));
      }
      onRefreshData();
    } catch (err: unknown) {
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
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar activo');
    } finally {
      setSaving(false);
    }
  };

  // Submit Improvement to Asset
  const handleImprovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !impDesc.trim() || !impCosto) return;
    setSaving(true);
    try {
      await addAssetImprovement(selectedAssetId, {
        fecha: impFecha,
        descripcion: impDesc.trim(),
        costo: Number(impCosto),
        moneda: impMoneda,
      });
      setSuccessMsg('Mejora patrimonial agregada al activo.');
      setImpDesc('');
      setSelectedAssetId(null);
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al agregar mejora');
    } finally {
      setSaving(false);
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
    setSaving(true);
    try {
      await saveItemConfig({
        id: editingItemId || undefined,
        nombre: itemName.trim(),
        modulo: itemModulo,
        clase: itemClase,
        unidad: itemUnidad.trim() || 'unidades',
        precio: typeof itemPrecio === 'number' ? itemPrecio : 0,
        moneda: itemMoneda,
        activo: itemActivo,
      });
      setSuccessMsg(
        editingItemId
          ? `Ítem "${itemName.trim()}" actualizado correctamente.`
          : `Ítem "${itemName.trim()}" creado exitosamente en Google Sheets.`
      );
      setShowItemForm(false);
      setEditingItemId(null);
      setItemName('');
      setItemPrecio('');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar el ítem');
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = (item: ItemConfig) => {
    setEditingItemId(item.id);
    setItemName(item.nombre);
    const rawMod = String(item.modulo || (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD')).toUpperCase();
    const normMod: 'MAQUINARIAS' | 'PROPIEDAD' = rawMod.includes('MAQ') ? 'MAQUINARIAS' : 'PROPIEDAD';
    setItemModulo(normMod);

    const rawCls = String(item.clase || (item.tipo && item.tipo.includes('ingreso') ? 'INGRESO' : 'GASTO')).toUpperCase();
    const normCls: 'GASTO' | 'INGRESO' = rawCls.includes('ING') ? 'INGRESO' : 'GASTO';
    setItemClase(normCls);

    setItemUnidad(item.unidad || 'unidades');
    setItemPrecio(item.precioPredeterminado ?? item.precio ?? '');
    setItemMoneda((item.moneda as Currency) || 'BOB');
    setItemActivo(item.activo !== false);
    setShowItemForm(true);
  };

  const handleToggleItemStatus = async (item: ItemConfig) => {
    const isCurrentlyActive = item.activo !== false;
    const newStatus = !isCurrentlyActive;
    setSaving(true);
    try {
      await saveItemConfig({
        ...item,
        id: item.id,
        nombre: item.nombre,
        modulo:
          item.modulo ||
          (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD'),
        clase:
          item.clase ||
          (item.tipo && item.tipo.includes('ingreso') ? 'INGRESO' : 'GASTO'),
        activo: newStatus,
      });
      if (!newStatus) {
        setSuccessMsg(
          `Ítem "${item.nombre}" desactivado. No se elimina físicamente para proteger el historial contable y los registros existentes en Google Sheets.`
        );
      } else {
        setSuccessMsg(`Ítem "${item.nombre}" reactivado exitosamente.`);
      }
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cambiar estado del ítem');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = itemsConfig.filter((item) => {
    const itemMod =
      item.modulo ||
      (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD');
    const itemCls =
      item.clase ||
      (item.tipo && item.tipo.includes('ingreso') ? 'INGRESO' : 'GASTO');

    if (filterModulo !== 'TODOS' && itemMod !== filterModulo) return false;
    if (filterClase !== 'TODOS' && itemCls !== filterClase) return false;
    if (filterActivo === 'ACTIVOS' && item.activo === false) return false;
    if (filterActivo === 'INACTIVOS' && item.activo !== false) return false;

    if (itemSearch.trim()) {
      const search = itemSearch.toLowerCase();
      return (
        item.nombre.toLowerCase().includes(search) ||
        (item.unidad && item.unidad.toLowerCase().includes(search))
      );
    }
    return true;
  });

  // RENDER LEVEL 3: Financial Reports Screen
  if (screen === 'reports') {
    const backLabel =
      prevScreen === 'main' ? 'Volver a Administración' : 'Volver a Configuración';

    return (
      <div className="space-y-4 w-full">
        <div className="flex items-center gap-3 pb-3 border-b border-stone-200">
          <button
            type="button"
            onClick={handleGoBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 transition cursor-pointer shrink-0 min-h-[38px]"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-700" />
            <span>{backLabel}</span>
          </button>
        </div>

        <ReportsView
          campaigns={campaigns}
          activeCampaign={activeCampaign}
          machines={machines}
          lots={lots}
          jobs={jobs}
          expenses={expenses}
          incomes={incomes}
          currency={currency}
          exchangeRate={exchangeRate}
        />
      </div>
    );
  }

  // RENDER LEVEL 1: Main Administration Screen (Phone Settings Menu Style)
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

          {/* Option 2: Direct Reportes financieros shortcut */}
          <button
            type="button"
            onClick={() => navigateTo('reports')}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[64px]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-800 group-hover:bg-emerald-700 group-hover:text-white transition">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                  Reportes financieros
                </h3>
                <p className="text-xs text-stone-500 truncate">
                  Resultados, ingresos y gastos
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>
        </div>

        <AppsScriptModal isOpen={showScriptModal} onClose={() => setShowScriptModal(false)} />
      </div>
    );
  }

  // RENDER LEVEL 2: Configuración Menu Screen
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
            Administra los datos maestros, informes y parámetros del sistema
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition">
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
                  Crear y activar campañas agrícolas
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* 3. Lotes */}
          <button
            type="button"
            onClick={() => navigateTo('lotes')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition">
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
                  Administrar lotes y superficies
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* 4. Maquinarias */}
          <button
            type="button"
            onClick={() => navigateTo('maquinarias')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition">
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
                  Flota de maquinarias y tarifas base
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* 5. Ítems de ingresos y gastos */}
          <button
            type="button"
            onClick={() => navigateTo('items')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition">
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
                  Rubros y conceptos configurables
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* 6. Tipo de cambio */}
          <button
            type="button"
            onClick={() => navigateTo('monedas')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                  Tipo de cambio
                </h3>
                <p className="text-[11px] text-stone-500 truncate">
                  Tasa de cambio BOB / USD (Actual: {exchangeRate.tasaBobPerUsd || 6.96} Bs/$)
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>

          {/* 7. Activos y mejoras */}
          <button
            type="button"
            onClick={() => navigateTo('activos')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-stone-50 transition cursor-pointer text-left group min-h-[58px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-emerald-800 transition">
                    Activos y mejoras
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {assets.length}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  Valor patrimonial e inversiones
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-emerald-700 transition shrink-0 ml-2" />
          </button>
        </div>

        {/* Opción de Seguridad: Revocar Autorización Administrativa de este dispositivo */}
        <div className="pt-2">
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 sm:p-5 space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-800 mt-0.5">
                <LogOut className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-red-950">
                  Revocar autorización administrativa de este dispositivo
                </h4>
                <p className="text-[11px] text-red-800 mt-1 leading-relaxed">
                  Elimina la credencial administrativa persistente de este teléfono o computadora y la revoca en Google Apps Script. Para volver a ingresar a Administración, se solicitará nuevamente la contraseña administrativa (<code>CONTRASENA_ADMIN</code>). La sesión de usuario normal no se cerrará.
                </p>
                <button
                  type="button"
                  onClick={handleRevokeDevice}
                  disabled={revoking}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50 min-h-[40px]"
                >
                  {revoking ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Revocando en backend...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4" />
                      <span>Revocar autorización de este dispositivo</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER LEVEL 3: Detail Option Screens
  return (
    <div className="space-y-5 w-full max-w-4xl mx-auto">
      {/* Top Header with Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <button
          type="button"
          onClick={handleGoBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 transition cursor-pointer shrink-0 min-h-[38px]"
        >
          <ArrowLeft className="h-4 w-4 text-emerald-700" />
          <span>Volver a Configuración</span>
        </button>

        {/* Action button to toggle form where applicable */}
        {screen === 'campanas' && (
          <button
            type="button"
            onClick={() => setShowCampaignForm(!showCampaignForm)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition cursor-pointer min-h-[38px]"
          >
            <Plus className="h-4 w-4" />
            <span>{showCampaignForm ? 'Ocultar Formulario' : 'Añadir Campaña'}</span>
          </button>
        )}

        {screen === 'lotes' && (
          <button
            type="button"
            onClick={() => {
              if (showLotForm) {
                setShowLotForm(false);
                setEditingLotId(null);
                setLotNombre('');
                setLotSuperficie('50');
                setLotCultivo('');
                setLotUbicacion('');
                setLotObs('');
              } else {
                setShowLotForm(true);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition cursor-pointer min-h-[38px]"
          >
            <Plus className="h-4 w-4" />
            <span>{showLotForm ? 'Ocultar Formulario' : 'Crear Nuevo Lote'}</span>
          </button>
        )}

        {screen === 'maquinarias' && (
          <button
            type="button"
            onClick={() => {
              if (showMachineForm) {
                setShowMachineForm(false);
                setEditingMachineId(null);
                setMNombre('');
                setMIdentificacion('');
              } else {
                setShowMachineForm(true);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition cursor-pointer min-h-[38px]"
          >
            <Plus className="h-4 w-4" />
            <span>{showMachineForm ? 'Ocultar Formulario' : 'Registrar Maquinaria'}</span>
          </button>
        )}

        {screen === 'items' && (
          <button
            type="button"
            onClick={() => {
              if (showItemForm) {
                setShowItemForm(false);
                setEditingItemId(null);
                setItemName('');
                setItemPrecio('');
              } else {
                setShowItemForm(true);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition cursor-pointer min-h-[38px]"
          >
            <Plus className="h-4 w-4" />
            <span>{showItemForm ? 'Ocultar Formulario' : 'Crear Nuevo Ítem'}</span>
          </button>
        )}

        {screen === 'activos' && (
          <button
            type="button"
            onClick={() => setShowAssetForm(!showAssetForm)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition cursor-pointer min-h-[38px]"
          >
            <Plus className="h-4 w-4" />
            <span>{showAssetForm ? 'Ocultar Formulario' : 'Registrar Activo'}</span>
          </button>
        )}
      </div>

      {/* Messages */}
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

          {/* Form when open */}
          {showCampaignForm && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Crear Nueva Campaña
              </h3>
              <form onSubmit={handleCampaignSubmit} className="space-y-3">
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
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
                  />
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="cActiva"
                    checked={cActiva}
                    onChange={(e) => setCActiva(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <label htmlFor="cActiva" className="text-xs font-medium text-stone-800 cursor-pointer">
                    Establecer como la única campaña activa
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[42px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Guardar Campaña</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCampaignForm(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[42px]"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

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

          {/* Form when open */}
          {showLotForm && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                {editingLotId ? 'Editar Lote' : 'Crear Nuevo Lote'}
              </h3>
              <form onSubmit={handleLotSubmit} className="space-y-3">
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
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
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
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
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
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white min-h-[42px]"
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
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white min-h-[42px]"
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
                    className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[42px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{editingLotId ? 'Guardar Cambios' : 'Crear Lote'}</span>
                  </button>
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
                    }}
                    className="px-4 py-3 rounded-xl border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[42px]"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

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
                Configuración de equipos, identificadores y tarifas base por hora o hectárea
              </p>
            </div>
          </div>

          {/* Form when open */}
          {showMachineForm && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                {editingMachineId ? 'Editar Maquinaria' : 'Registrar Maquinaria'}
              </h3>
              <form onSubmit={handleMachineSubmit} className="space-y-3">
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
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
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
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white focus:border-emerald-600 focus:outline-none min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Tipo</label>
                    <select
                      value={mTipo}
                      onChange={(e) => setMTipo(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white min-h-[42px]"
                    >
                      <option value="Tractor">Tractor</option>
                      <option value="Cosechadora">Cosechadora</option>
                      <option value="Fumigadora">Fumigadora Autopropulsada</option>
                      <option value="Sembradora">Sembradora</option>
                      <option value="Camión">Camión de Carga</option>
                      <option value="Otro">Otro Implemento</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Tarifa *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={mTarifa}
                      onChange={(e) => setMTarifa(e.target.value)}
                      placeholder="250"
                      required
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Unidad</label>
                    <select
                      value={mUnidad}
                      onChange={(e) => setMUnidad(e.target.value as 'h' | 'ha')}
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white min-h-[42px]"
                    >
                      <option value="h">Hora</option>
                      <option value="ha">Hectárea</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda</label>
                    <select
                      value={mMoneda}
                      onChange={(e) => setMMoneda(e.target.value as Currency)}
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white font-semibold min-h-[42px]"
                    >
                      <option value="BOB">BOB (Bs)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Estado</label>
                    <select
                      value={mEstado}
                      onChange={(e) => setMEstado(e.target.value as any)}
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white min-h-[42px]"
                    >
                      <option value="operativo">Operativo</option>
                      <option value="mantenimiento">Mantenimiento</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[42px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{editingMachineId ? 'Guardar Cambios' : 'Registrar Máquina'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMachineForm(false);
                      setEditingMachineId(null);
                      setMNombre('');
                      setMIdentificacion('');
                    }}
                    className="px-4 py-3 rounded-xl border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[42px]"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Records List FIRST */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            {/* MOBILE VIEW: Compact Cards */}
            <div className="block md:hidden space-y-2.5">
              {machines.map((m) => (
                <div key={m.id} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{m.nombre}</h4>
                      <span className="text-[10px] text-stone-500">{m.identificacion} &bull; {m.tipo}</span>
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
              ))}

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
                    <th className="py-2.5 px-3 font-semibold text-center">Estado</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {machines.map((m) => (
                    <tr key={m.id} className="hover:bg-stone-50">
                      <td className="py-2 px-3">
                        <span className="font-bold text-stone-900">{m.nombre}</span>
                        <span className="block text-[10px] text-stone-400">{m.identificacion}</span>
                      </td>
                      <td className="py-2 px-3 text-stone-600">{m.tipo}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-800 font-mono">
                        {m.moneda} {m.tarifa}/{m.unidad}
                      </td>
                      <td className="py-2 px-3 text-center">
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
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditMachine(m)}
                            className="p-1 text-stone-400 hover:text-emerald-700 hover:bg-stone-100 rounded transition cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMachineClick(m)}
                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded transition cursor-pointer"
                            title="Eliminar Maquinaria"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {machines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-xs text-stone-400">
                        No hay maquinarias registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom React Confirmation Modal for Machine Deletion */}
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
        </div>
      )}

      {/* DETAIL 4: ÍTEMS DE INGRESOS Y GASTOS */}
      {screen === 'items' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Tag className="h-5 w-5 text-emerald-700" />
                <span>Ítems de Ingresos y Gastos ({itemsConfig.length})</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Gestión de rubros y conceptos para la clasificación contable en Maquinarias y Propiedad
              </p>
            </div>
          </div>

          {/* Formulario de Creación / Edición */}
          {showItemForm && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                {editingItemId ? 'Editar Ítem / Rubro' : 'Crear Nuevo Ítem / Rubro'}
              </h3>
              <form onSubmit={handleItemSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Nombre del Ítem *
                    </label>
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="Ej. Semillas de Soya, Repuestos, Diésel..."
                      required
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[42px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Módulo Asignado *
                    </label>
                    <select
                      value={itemModulo}
                      onChange={(e) => setItemModulo(e.target.value as 'MAQUINARIAS' | 'PROPIEDAD')}
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white font-semibold min-h-[42px]"
                    >
                      <option value="MAQUINARIAS">MAQUINARIAS</option>
                      <option value="PROPIEDAD">PROPIEDAD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Clase de Transacción *
                    </label>
                    <select
                      value={itemClase}
                      onChange={(e) => setItemClase(e.target.value as 'GASTO' | 'INGRESO')}
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white font-semibold min-h-[42px]"
                    >
                      <option value="GASTO">GASTO</option>
                      <option value="INGRESO">INGRESO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Unidad de Medida
                    </label>
                    <input
                      type="text"
                      value={itemUnidad}
                      onChange={(e) => setItemUnidad(e.target.value)}
                      placeholder="litros, kg, toneladas, horas..."
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white min-h-[42px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Precio Predeterminado <span className="text-stone-400 font-normal">(Opcional)</span>
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
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda</label>
                    <select
                      value={itemMoneda}
                      onChange={(e) => setItemMoneda(e.target.value as Currency)}
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white font-semibold min-h-[42px]"
                    >
                      <option value="BOB">BOB (Bs)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="itemActivoCheck"
                      checked={itemActivo}
                      onChange={(e) => setItemActivo(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <label htmlFor="itemActivoCheck" className="text-xs font-semibold text-stone-800 cursor-pointer">
                      Ítem Activo (Disponible en formularios)
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[42px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{editingItemId ? 'Guardar Cambios' : 'Registrar Ítem'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowItemForm(false);
                      setEditingItemId(null);
                      setItemName('');
                      setItemPrecio('');
                    }}
                    className="px-4 py-3 rounded-xl border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[42px]"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filtros y Búsqueda */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="relative sm:col-span-1">
                <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-stone-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none min-h-[38px]"
                />
              </div>

              <div>
                <select
                  value={filterModulo}
                  onChange={(e) => setFilterModulo(e.target.value as any)}
                  className="w-full text-xs px-2.5 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none min-h-[38px]"
                >
                  <option value="TODOS">Todos los Módulos</option>
                  <option value="MAQUINARIAS">Módulo Maquinarias</option>
                  <option value="PROPIEDAD">Módulo Propiedad</option>
                </select>
              </div>

              <div>
                <select
                  value={filterClase}
                  onChange={(e) => setFilterClase(e.target.value as any)}
                  className="w-full text-xs px-2.5 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none min-h-[38px]"
                >
                  <option value="TODOS">Todas las Clases</option>
                  <option value="GASTO">Gastos</option>
                  <option value="INGRESO">Ingresos</option>
                </select>
              </div>

              <div>
                <select
                  value={filterActivo}
                  onChange={(e) => setFilterActivo(e.target.value as any)}
                  className="w-full text-xs px-2.5 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none min-h-[38px]"
                >
                  <option value="TODOS">Todos los Estados</option>
                  <option value="ACTIVOS">Solo Activos</option>
                  <option value="INACTIVOS">Solo Inactivos</option>
                </select>
              </div>
            </div>

            {/* Listado / Tabla de Ítems */}
            <div className="space-y-2 pt-1">
              {filteredItems.map((item) => {
                const isActivo = item.activo !== false;
                const mod = item.modulo || (item.tipo && item.tipo.includes('maquinaria') ? 'MAQUINARIAS' : 'PROPIEDAD');
                const cls = item.clase || (item.tipo && item.tipo.includes('ingreso') ? 'INGRESO' : 'GASTO');

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 rounded-xl border transition gap-2 ${
                      isActivo
                        ? 'border-stone-200 bg-stone-50/60 hover:bg-white'
                        : 'border-stone-200/60 bg-stone-100/70 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          cls === 'INGRESO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {cls === 'INGRESO' ? '+' : '-'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-stone-900">{item.nombre}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              mod === 'MAQUINARIAS'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {mod}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              cls === 'INGRESO' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {cls}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Unidad: <strong>{item.unidad || 'unidades'}</strong>
                          {(item.precioPredeterminado || item.precio) ? (
                            <span> &bull; Precio Base: {item.moneda || 'BOB'} {item.precioPredeterminado || item.precio}</span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-200/60">
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          isActivo
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-stone-200 text-stone-600 border border-stone-300'
                        }`}
                      >
                        {isActivo ? 'Activo' : 'Inactivo'}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleEditItem(item)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[32px]"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-stone-500" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleItemStatus(item)}
                        disabled={saving}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition min-h-[32px] ${
                          isActivo
                            ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                            : 'border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                        }`}
                        title={
                          isActivo
                            ? 'Desactivar para ocultar de formularios sin eliminar el historial contable'
                            : 'Reactivar ítem'
                        }
                      >
                        <span>{isActivo ? 'Desactivar' : 'Reactivar'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="py-8 text-center text-xs text-stone-400 bg-stone-50 rounded-xl border border-stone-200">
                  No se encontraron ítems con los filtros seleccionados.
                </div>
              )}
            </div>
          </div>
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
              Establece la tasa oficial de conversión utilizada en informes y hojas de cálculo
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
                  className="w-full text-base font-bold font-mono px-3.5 py-2.5 rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
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
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[42px]"
                />
              </div>

              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 space-y-1">
                <p className="font-semibold">Información del Registro:</p>
                <p className="text-[11px] text-emerald-800">
                  Última actualización registrada en Google Sheets: {exchangeRate.fechaActualizacion || 'Hoy'}
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
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                Activos Patrimoniales y Mejoras ({assets.length})
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Inversiones patrimoniales, valores acumulados e historial de mejoras incorporadas
              </p>
            </div>
          </div>

          {/* Form when open */}
          {showAssetForm && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Registrar Activo Patrimonial
              </h3>
              <form onSubmit={handleAssetSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Tipo de Activo</label>
                  <select
                    value={aTipo}
                    onChange={(e) => setATipo(e.target.value as any)}
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white min-h-[42px]"
                  >
                    <option value="MAQUINARIA">Maquinaria / Pesada</option>
                    <option value="LOTE">Terreno / Lote / Propiedad Agrícola</option>
                    <option value="OTRO">Infraestructura / Silos / Tinglados / Otros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Nombre del Activo *</label>
                  <input
                    type="text"
                    value={aNombre}
                    onChange={(e) => setANombre(e.target.value)}
                    placeholder="Tractor John Deere 6110M"
                    required
                    className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white min-h-[42px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Valor Inicial *</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={aValorInicial}
                      onChange={(e) => setAValorInicial(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="85000"
                      required
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white font-bold min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda</label>
                    <select
                      value={aMoneda}
                      onChange={(e) => setAMoneda(e.target.value as Currency)}
                      className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 bg-white font-bold min-h-[42px]"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="BOB">BOB (Bs)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white hover:bg-emerald-800 transition cursor-pointer min-h-[42px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Registrar Activo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAssetForm(false)}
                    className="px-4 py-3 rounded-xl border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer min-h-[42px]"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Records List FIRST */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-3">
            {assets.map((asset) => (
              <div key={asset.id} className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-stone-900 truncate">{asset.nombre}</h4>
                    <p className="text-xs text-stone-500 truncate">
                      Adquisición: {asset.moneda} {asset.valorInicial.toLocaleString()} &bull; Fecha: {asset.fechaAdquisicion}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[10px] text-stone-500 block">Valor Acumulado</span>
                    <span className="text-base font-bold text-emerald-800 font-mono">
                      {asset.moneda} {asset.valorAcumulado.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Improvements List */}
                {asset.mejoras && asset.mejoras.length > 0 && (
                  <div className="pt-2 border-t border-stone-200/80 space-y-1 text-xs">
                    <p className="text-[11px] font-semibold text-stone-700">Mejoras Aplicadas:</p>
                    {asset.mejoras.map((m) => (
                      <div key={m.id} className="flex justify-between text-stone-600 bg-white p-2 rounded border border-stone-200/60">
                        <span>{m.fecha} — {m.descripcion}</span>
                        <span className="font-bold text-stone-900">+{m.moneda} {m.costo.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Improvement Inline Form */}
                {selectedAssetId === asset.id ? (
                  <form onSubmit={handleImprovementSubmit} className="pt-2 border-t border-stone-200 space-y-2 bg-stone-100 p-3 rounded-lg">
                    <p className="text-xs font-bold text-stone-800">Añadir Mejora Posterior al Activo:</p>
                    <input
                      type="text"
                      value={impDesc}
                      onChange={(e) => setImpDesc(e.target.value)}
                      placeholder="Ej: Instalación de piloto automático"
                      required
                      className="w-full text-xs p-2 rounded border border-stone-300 bg-white min-h-[38px]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={impCosto}
                        onChange={(e) => setImpCosto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder="6000"
                        required
                        className="flex-1 text-xs p-2 rounded border border-stone-300 bg-white font-bold min-h-[38px]"
                      />
                      <button type="submit" className="bg-emerald-700 text-white px-3 py-2 text-xs font-bold rounded cursor-pointer min-h-[38px]">
                        Añadir
                      </button>
                      <button type="button" onClick={() => setSelectedAssetId(null)} className="bg-stone-300 text-stone-800 px-3 py-2 text-xs rounded cursor-pointer min-h-[38px]">
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedAssetId(asset.id)}
                    className="text-xs text-emerald-700 hover:underline font-semibold pt-1 block cursor-pointer"
                  >
                    + Añadir mejora posterior (Ej: Piloto automático USD 6.000)
                  </button>
                )}
              </div>
            ))}

            {assets.length === 0 && (
              <div className="py-8 text-center text-xs text-stone-400">
                No hay activos patrimoniales registrados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
