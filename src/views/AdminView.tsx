import React, { useState } from 'react';
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
  createAsset,
  addAssetImprovement,
  checkIsAdmin,
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
  campaigns,
  activeCampaign,
  machines,
  lots,
  jobs,
  expenses,
  incomes,
  itemsConfig,
  assets,
  exchangeRate,
  currency,
  onRefreshData,
}) => {
  const isAdmin = checkIsAdmin(session);

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
  const [tasa, setTasa] = useState<number>(exchangeRate.tasaBobPerUsd || 6.96);
  const [tasaNota, setTasaNota] = useState('');

  // Asset Form State
  const [aTipo, setATipo] = useState<'maquinaria' | 'terreno' | 'infraestructura'>('maquinaria');
  const [aNombre, setANombre] = useState('');
  const [aIdentificador, setAIdentificador] = useState('');
  const [aValorInicial, setAValorInicial] = useState<number | ''>(85000);
  const [aMoneda, setAMoneda] = useState<Currency>('USD');
  const [aFecha, setAFecha] = useState(new Date().toISOString().slice(0, 10));

  // Asset Improvement Form State
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [impFecha, setImpFecha] = useState(new Date().toISOString().slice(0, 10));
  const [impDesc, setImpDesc] = useState('');
  const [impCosto, setImpCosto] = useState<number | ''>(6000);
  const [impMoneda, setImpMoneda] = useState<Currency>('USD');

  // Security guard for non-admin users
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl border border-red-200 bg-red-50 text-center space-y-3 shadow-xs">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700">
            <Lock className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-base font-bold text-red-950">Acceso Restringido</h2>
        <p className="text-xs text-red-800 leading-relaxed">
          La sección de Administración está reservada únicamente para usuarios con rol de Administrador.
        </p>
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

  const handleDeleteMachineConfirm = async (id: string) => {
    if (!window.confirm('¿Confirmas eliminar esta maquinaria?')) return;
    try {
      await deleteMachine(id);
      setSuccessMsg('Maquinaria eliminada.');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  // Submit Exchange Rate
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tasa || tasa <= 0) return;
    setSaving(true);
    try {
      await saveExchangeRateConfig({
        tasaBobPerUsd: Number(tasa),
        nota: tasaNota.trim() || 'Configurado manualmente por el administrador',
      });
      setSuccessMsg('Tipo de cambio actualizado.');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar tipo de cambio');
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
                      onClick={() => handleDeleteMachineConfirm(m.id)}
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
                            onClick={() => handleDeleteMachineConfirm(m.id)}
                            className="p-1 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded transition cursor-pointer"
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
        </div>
      )}

      {/* DETAIL 4: ÍTEMS DE INGRESOS Y GASTOS */}
      {screen === 'items' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Tag className="h-5 w-5 text-emerald-700" />
                Ítems de Ingresos y Gastos ({itemsConfig.length})
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Rubros y conceptos predeterminados para la clasificación de transacciones
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-3">
            <p className="text-xs text-stone-600 leading-relaxed">
              Los rubros y conceptos se configuran automáticamente desde Google Sheets según las categorías de insumos, servicios, semillas y diésel utilizadas en las campañas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2">
                <span className="text-xs font-bold text-stone-900 uppercase tracking-wider block border-b border-stone-200/60 pb-1.5">
                  Rubros Frecuentes
                </span>
                <ul className="text-xs text-stone-700 space-y-1">
                  <li>&bull; Diésel y Combustibles</li>
                  <li>&bull; Repuestos y Mantenimiento</li>
                  <li>&bull; Semillas y Agroquímicos</li>
                  <li>&bull; Servicios a Terceros</li>
                  <li>&bull; Venta de Cosecha</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2">
                <span className="text-xs font-bold text-stone-900 uppercase tracking-wider block border-b border-stone-200/60 pb-1.5">
                  Resumen de Conceptos ({itemsConfig.length})
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {itemsConfig.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs bg-white p-2 rounded border border-stone-200/60">
                      <span className="font-semibold text-stone-800">{item.nombre}</span>
                      <span className="text-[10px] text-stone-500 uppercase">{item.tipo}</span>
                    </div>
                  ))}
                  {itemsConfig.length === 0 && (
                    <p className="text-xs text-stone-400 italic">No hay ítems personalizados cargados.</p>
                  )}
                </div>
              </div>
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
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  value={tasa}
                  onChange={(e) => setTasa(parseFloat(e.target.value))}
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
                    <option value="maquinaria">Maquinaria / Pesada</option>
                    <option value="terreno">Terreno / Propiedad Agrícola</option>
                    <option value="infraestructura">Infraestructura / Silos / Tinglados</option>
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
