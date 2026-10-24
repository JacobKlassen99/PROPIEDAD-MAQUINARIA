import React, { useState } from 'react';
import {
  Tractor,
  CirclePlus,
  CircleMinus,
  HandCoins,
  LandPlot,
  Receipt,
  ClipboardList,
  ChartNoAxesColumn,
  ChevronRight,
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
} from 'lucide-react';
import {
  Campaign,
  Machine,
  Lot,
  MachineryJob,
  Expense,
  Currency,
  ExchangeRateConfig,
  ItemConfig,
} from '../types';
import {
  createMachineryJob,
  deleteMachineryJob,
  createExpense,
  deleteExpense,
} from '../services/backend';

interface Props {
  activeCampaign: Campaign | null;
  machines: Machine[];
  lots: Lot[];
  jobs: MachineryJob[];
  expenses: Expense[];
  itemsConfig: ItemConfig[];
  currency: Currency;
  exchangeRate: ExchangeRateConfig;
  onRefreshData: () => void;
}

type MachineryScreen =
  | 'main'
  | 'ingreso_opciones'
  | 'servicio_otros'
  | 'trabajo_propiedad'
  | 'gasto'
  | 'historial'
  | 'resumen';

export const MachineryView: React.FC<Props> = ({
  activeCampaign,
  machines,
  lots,
  jobs,
  expenses,
  currency,
  exchangeRate,
  onRefreshData,
}) => {
  const [currentScreen, setCurrentScreen] = useState<MachineryScreen>('main');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & type filter for Historial
  const [searchTerm, setSearchTerm] = useState('');
  const [historialFilter, setHistorialFilter] = useState<'todos' | 'terceros' | 'propiedad'>('todos');

  // Form State for Machinery Job
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [cliente, setCliente] = useState('');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tarifa, setTarifa] = useState<number | ''>('');
  const [unidad, setUnidad] = useState<'hora' | 'hectarea'>('hora');
  const [jobMoneda, setJobMoneda] = useState<Currency>('BOB');
  const [observacion, setObservacion] = useState('');

  // Form State for Machinery Expense
  const [expMachineId, setExpMachineId] = useState('');
  const [expItemGasto, setExpItemGasto] = useState('Combustible');
  const [expCantidad, setExpCantidad] = useState<number | ''>(1);
  const [expUnidad, setExpUnidad] = useState('litros');
  const [expPrecio, setExpPrecio] = useState<number | ''>('');
  const [expFecha, setExpFecha] = useState(new Date().toISOString().slice(0, 10));
  const [expMoneda, setExpMoneda] = useState<Currency>('BOB');
  const [expObservacion, setExpObservacion] = useState('');

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

  const handleMachineChange = (mId: string) => {
    setSelectedMachineId(mId);
    const m = machines.find((item) => item.id === mId);
    if (m) {
      setTarifa(m.tarifa || 0);
      setUnidad((m.unidad === 'ha' || m.unidad === 'hectarea') ? 'hectarea' : 'hora');
      setJobMoneda(m.moneda || 'BOB');
    }
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
        cliente: tipoTrabajo === 'tercero' ? cliente.trim() : undefined,
        loteId: tipoTrabajo === 'propiedad' ? selectedLotId : undefined,
        loteNombre: tipoTrabajo === 'propiedad' ? lotObj?.nombre : undefined,
        cantidad: Number(cantidad),
        unidad,
        tarifa: Number(tarifa) || 0,
        moneda: jobMoneda,
        tipoCambio: exchangeRate.tasaBobPerUsd,
        total: calculatedTotal,
        observacion: observacion.trim(),
      });

      setSuccessMsg(
        tipoTrabajo === 'tercero'
          ? 'Servicio para otros guardado exitosamente (+ Ingreso Maquinarias).'
          : 'Trabajo en propiedad guardado (+ Ingreso Maquinarias y − Gasto en Lote).'
      );

      setCantidad('');
      setCliente('');
      setObservacion('');
      onRefreshData();
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

    if (!expPrecio || expPrecio <= 0) {
      setErrorMsg('Ingresa un precio unitario válido.');
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
        tipoCambio: exchangeRate.tasaBobPerUsd,
        total: expCalculatedTotal,
        observacion: expObservacion.trim(),
      });

      setSuccessMsg('Gasto de maquinaria registrado exitosamente.');
      setExpPrecio('');
      setExpObservacion('');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el gasto');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!window.confirm('¿Confirmas eliminar este trabajo? Se anularán sus movimientos vinculados.')) {
      return;
    }
    try {
      await deleteMachineryJob(id);
      setSuccessMsg('Trabajo eliminado exitosamente.');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const handleDeleteExp = async (id: string) => {
    if (!window.confirm('¿Confirmas eliminar este gasto de maquinaria?')) return;
    try {
      await deleteExpense(id);
      setSuccessMsg('Gasto de maquinaria eliminado.');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const externalJobs = jobs.filter((j) => j.tipoTrabajo === 'tercero');
  const propertyJobs = jobs.filter((j) => j.tipoTrabajo === 'propiedad');
  const machineryExpenses = expenses.filter((e) => e.modulo === 'maquinarias');

  const filteredJobs = jobs.filter((j) => {
    if (historialFilter === 'terceros' && j.tipoTrabajo !== 'tercero') return false;
    if (historialFilter === 'propiedad' && j.tipoTrabajo !== 'propiedad') return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (j.maquinariaNombre && j.maquinariaNombre.toLowerCase().includes(term)) ||
      (j.cliente && j.cliente.toLowerCase().includes(term)) ||
      (j.loteNombre && j.loteNombre.toLowerCase().includes(term)) ||
      (j.observacion && j.observacion.toLowerCase().includes(term))
    );
  });

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      {/* Module Title Header */}
      <div className="flex flex-col gap-1 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-emerald-700 text-white shrink-0">
            <Tractor className="h-4 w-4" />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight truncate">
            MAQUINARIAS
          </h1>
        </div>
        <p className="text-xs text-stone-500">
          Servicios para otros, trabajos en propiedad, gastos y rendimiento de equipos
        </p>
      </div>

      {/* Global Notifications */}
      {errorMsg && (
        <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span className="break-words">{errorMsg}</span>
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
        <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="break-words">{successMsg}</span>
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
      {/* VISTA PRINCIPAL (MAIN): REGISTRAR Y CONSULTAR SEPARADOS       */}
      {/* ============================================================ */}
      {currentScreen === 'main' && (
        <div className="space-y-6">
          {/* SECCIÓN A: REGISTRAR NUEVO MOVIMIENTO */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-stone-600 uppercase">
              REGISTRAR NUEVO MOVIMIENTO
            </h2>

            {/* Dos botones grandes: SERVICIO (verde) y GASTO (rojo) */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Botón SERVICIO */}
              <button
                type="button"
                onClick={() => setCurrentScreen('ingreso_opciones')}
                className="w-full min-h-[76px] sm:min-h-[84px] p-3 sm:p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm flex flex-col items-center justify-center gap-1.5 transition cursor-pointer select-none border border-emerald-700"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <CirclePlus className="h-5 w-5 sm:h-6 sm:w-6 text-white shrink-0" />
                  <span className="text-sm sm:text-base font-bold tracking-wider uppercase">
                    SERVICIO
                  </span>
                </div>
                <span className="text-[11px] text-emerald-100 font-medium text-center leading-tight">
                  Servicio o labor
                </span>
              </button>

              {/* Botón GASTO */}
              <button
                type="button"
                onClick={() => setCurrentScreen('gasto')}
                className="w-full min-h-[76px] sm:min-h-[84px] p-3 sm:p-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm flex flex-col items-center justify-center gap-1.5 transition cursor-pointer select-none border border-rose-700"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <CircleMinus className="h-5 w-5 sm:h-6 sm:w-6 text-white shrink-0" />
                  <span className="text-sm sm:text-base font-bold tracking-wider uppercase">
                    GASTO
                  </span>
                </div>
                <span className="text-[11px] text-rose-100 font-medium text-center leading-tight">
                  Combustible y repuestos
                </span>
              </button>
            </div>
          </div>

          {/* SEPARADOR */}
          <div className="border-t border-stone-200 pt-2" />

          {/* SECCIÓN B: CONSULTAR REGISTROS */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-stone-600 uppercase">
              CONSULTAR REGISTROS
            </h2>

            <div className="space-y-2.5">
              {/* Tarjeta 1: Historial de trabajos */}
              <button
                type="button"
                onClick={() => setCurrentScreen('historial')}
                className="w-full bg-white border border-stone-200 hover:border-emerald-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-2xs hover:bg-stone-50 active:bg-stone-100 transition cursor-pointer text-left min-h-[64px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 shrink-0">
                    <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-stone-900 leading-snug truncate">
                      Historial de trabajos
                    </h3>
                    <p className="text-xs text-stone-500 leading-snug mt-0.5 break-words">
                      Servicios para otros y trabajos en propiedad ({jobs.length} registros)
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-400 shrink-0" />
              </button>

              {/* Tarjeta 2: Resumen de maquinarias */}
              <button
                type="button"
                onClick={() => setCurrentScreen('resumen')}
                className="w-full bg-white border border-stone-200 hover:border-emerald-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-2xs hover:bg-stone-50 active:bg-stone-100 transition cursor-pointer text-left min-h-[64px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 shrink-0">
                    <ChartNoAxesColumn className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-stone-900 leading-snug truncate">
                      Resumen de maquinarias
                    </h3>
                    <p className="text-xs text-stone-500 leading-snug mt-0.5 break-words">
                      Horas, hectáreas y trabajos realizados por equipo ({machines.length} equipos)
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-400 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-VISTA: ELECCIÓN DE TIPO DE SERVICIO                      */}
      {/* ============================================================ */}
      {currentScreen === 'ingreso_opciones' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-stone-900">
                REGISTRAR SERVICIO DE MAQUINARIA
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Selecciona si el trabajo se realizó en un lote propio o para un cliente externo.
              </p>
            </div>

            {/* Dos opciones: TRABAJO PROPIEDAD primero y más resaltante */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {/* PRIMERA OPCIÓN: Trabajo Propiedad (Resaltado Verde Principal) */}
              <button
                type="button"
                onClick={() => setCurrentScreen('trabajo_propiedad')}
                className="flex flex-col items-center justify-between p-4 sm:p-5 rounded-2xl border-2 border-emerald-600 bg-emerald-50/90 hover:bg-emerald-100 text-center transition cursor-pointer min-h-[150px] space-y-2 group shadow-sm ring-2 ring-emerald-500/20"
              >
                <div className="p-3 rounded-xl bg-emerald-700 text-white shadow-xs group-hover:scale-105 transition shrink-0">
                  <LandPlot className="h-6 w-6" />
                </div>
                <div className="w-full">
                  <span className="text-sm sm:text-base font-extrabold text-emerald-950 block leading-tight break-words">
                    TRABAJO PROPIEDAD
                  </span>
                  <span className="text-xs text-emerald-800 font-semibold block mt-1 leading-snug break-words">
                    Trabajo en lote propio
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-900 bg-emerald-200/90 px-3 py-1 rounded-full border border-emerald-300">
                  Opción Principal &bull; + Maq. y &minus; Lote
                </span>
              </button>

              {/* SEGUNDA OPCIÓN: Servicio para otros (Secundario Discreto) */}
              <button
                type="button"
                onClick={() => setCurrentScreen('servicio_otros')}
                className="flex flex-col items-center justify-between p-4 sm:p-5 rounded-2xl border border-stone-300 hover:border-emerald-600 bg-white hover:bg-stone-50 text-center transition cursor-pointer min-h-[150px] space-y-2 group"
              >
                <div className="p-3 rounded-xl bg-stone-100 text-stone-700 group-hover:scale-105 transition shrink-0 border border-stone-200">
                  <HandCoins className="h-6 w-6" />
                </div>
                <div className="w-full">
                  <span className="text-xs sm:text-sm font-bold text-stone-800 block leading-tight break-words">
                    Servicio para otros
                  </span>
                  <span className="text-[10px] text-stone-500 block mt-1 leading-snug break-words">
                    Cliente externo &bull; Sin lote
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200">
                  + Ingreso Maquinarias
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FORMULARIO: SERVICIO PARA OTROS (TERCEROS)                   */}
      {/* ============================================================ */}
      {currentScreen === 'servicio_otros' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              Servicio para otros
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
            <div className="pb-3 border-b border-stone-100 mb-4">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-emerald-700" />
                <span>Registrar Servicio para otros</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Genera ingreso para Maquinarias. No se solicita lote.
              </p>
            </div>

            <form onSubmit={(e) => handleJobSubmit(e, 'tercero')} className="space-y-4">
              {/* Maquinaria */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Maquinaria <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedMachineId}
                  onChange={(e) => handleMachineChange(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                >
                  <option value="">-- Seleccionar Maquinaria --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({m.identificacion}) &mdash; {m.moneda} {m.tarifa}/{m.unidad}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Cliente o Beneficiario <span className="text-stone-400 font-normal">(Opcional)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    placeholder="Ej. Juan Pérez, Hacienda El Palmar"
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <input
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Cantidad trabajada <span className="text-red-500">*</span>
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
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Unidad</label>
                  <select
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value as 'hora' | 'hectarea')}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  >
                    <option value="hora">Horas</option>
                    <option value="hectarea">Hectáreas</option>
                  </select>
                </div>
              </div>

              {/* Tarifa y Moneda */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Tarifa por {unidad}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0"
                    value={tarifa}
                    onChange={(e) => setTarifa(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda</label>
                  <select
                    value={jobMoneda}
                    onChange={(e) => setJobMoneda(e.target.value as Currency)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  >
                    <option value="BOB">BOB (Bs)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Total Calculado */}
              <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-emerald-800 block uppercase font-bold">
                    Ingreso para Maquinarias
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {cantidad || 0} {unidad}s &times; {jobMoneda} {tarifa || 0}
                  </span>
                </div>
                <span className="text-base sm:text-lg font-black text-emerald-950 font-mono">
                  {formatMoney(calculatedTotal, jobMoneda)}
                </span>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Observaciones <span className="text-stone-400 font-normal">(Opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Detalles del trabajo, operador..."
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Botón Guardar */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[46px]"
              >
                <CirclePlus className="h-4 w-4" />
                <span>{saving ? 'Guardando...' : 'Guardar Servicio para otros'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FORMULARIO: TRABAJO PROPIEDAD                                */}
      {/* ============================================================ */}
      {currentScreen === 'trabajo_propiedad' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              Trabajo Propiedad
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
            <div className="pb-3 border-b border-stone-100 mb-4">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <LandPlot className="h-4 w-4 text-emerald-700" />
                <span>Registrar Trabajo en Propiedad</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Genera un único registro contable: + Ingreso para Maquinarias y − Gasto para el Lote.
              </p>
            </div>

            <form onSubmit={(e) => handleJobSubmit(e, 'propiedad')} className="space-y-4">
              {/* Lote (Obligatorio) */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Lote de Destino <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold text-emerald-950 min-h-[44px]"
                >
                  <option value="">-- Seleccionar Lote Obligatorio --</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} ({l.superficieHectareas} ha &bull; {l.cultivoActual || 'Sin cultivo'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Maquinaria */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Maquinaria <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedMachineId}
                  onChange={(e) => handleMachineChange(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                >
                  <option value="">-- Seleccionar Maquinaria --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({m.identificacion}) &mdash; {m.moneda} {m.tarifa}/{m.unidad}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <input
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Cantidad trabajada <span className="text-red-500">*</span>
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
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Unidad</label>
                  <select
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value as 'hora' | 'hectarea')}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  >
                    <option value="hora">Horas</option>
                    <option value="hectarea">Hectáreas</option>
                  </select>
                </div>
              </div>

              {/* Tarifa y Moneda */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Tarifa por {unidad}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0"
                    value={tarifa}
                    onChange={(e) => setTarifa(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda</label>
                  <select
                    value={jobMoneda}
                    onChange={(e) => setJobMoneda(e.target.value as Currency)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  >
                    <option value="BOB">BOB (Bs)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Explicación de Movimiento Vinculado */}
              <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-900 uppercase">
                    Impacto Contable Automático
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-950 font-mono">
                    {formatMoney(calculatedTotal, jobMoneda)}
                  </span>
                </div>
                <div className="text-[11px] text-stone-600 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                    <span>&bull; + {formatMoney(calculatedTotal, jobMoneda)}</span>
                    <span className="text-stone-500 font-normal">como ingreso para Maquinarias</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-800 font-semibold">
                    <span>&bull; &minus; {formatMoney(calculatedTotal, jobMoneda)}</span>
                    <span className="text-stone-500 font-normal">como gasto para el Lote seleccionado</span>
                  </div>
                </div>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Observaciones <span className="text-stone-400 font-normal">(Opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Detalles de la labor (arado, siembra, fumigación)..."
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Botón Guardar */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[46px]"
              >
                <CirclePlus className="h-4 w-4" />
                <span>{saving ? 'Guardando...' : 'Guardar Trabajo en Propiedad'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FORMULARIO: GASTO DE MAQUINARIA                              */}
      {/* ============================================================ */}
      {currentScreen === 'gasto' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
              Gasto de Maquinaria
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
            <div className="pb-3 border-b border-stone-100 mb-4">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <CircleMinus className="h-4 w-4 text-rose-700" />
                <span>Registrar Gasto de Maquinaria</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Combustible, mantenimiento, reparaciones, repuestos, sueldos u otros insumos.
              </p>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              {/* Maquinaria Asignada */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Maquinaria Asignada <span className="text-stone-400 font-normal">(Opcional si es gasto general)</span>
                </label>
                <select
                  value={expMachineId}
                  onChange={(e) => setExpMachineId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none min-h-[44px]"
                >
                  <option value="">-- General / Sin asignar --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({m.identificacion})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rubro / Concepto de Gasto */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Rubro / Concepto <span className="text-red-500">*</span>
                </label>
                <select
                  value={expItemGasto}
                  onChange={(e) => setExpItemGasto(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none font-semibold min-h-[44px]"
                >
                  <option value="Combustible">Combustible (Diésel / Gasolina)</option>
                  <option value="Repuestos">Repuestos y Piezas</option>
                  <option value="Mantenimiento">Mantenimiento y Lubricantes</option>
                  <option value="Reparaciones">Reparaciones y Taller</option>
                  <option value="Sueldos">Sueldos y Operadores</option>
                  <option value="Seguro">Seguro y Patentes</option>
                  <option value="Otros">Otros Gastos</option>
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <input
                    type="date"
                    required
                    value={expFecha}
                    onChange={(e) => setExpFecha(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Cantidad <span className="text-red-500">*</span>
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
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Unidad</label>
                  <input
                    type="text"
                    value={expUnidad}
                    onChange={(e) => setExpUnidad(e.target.value)}
                    placeholder="litros, piezas, horas..."
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Precio y Moneda */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Precio Unitario <span className="text-red-500">*</span>
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
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda</label>
                  <select
                    value={expMoneda}
                    onChange={(e) => setExpMoneda(e.target.value as Currency)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none min-h-[44px]"
                  >
                    <option value="BOB">BOB (Bs)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Total Calculado */}
              <div className="bg-rose-50/80 p-3.5 rounded-xl border border-rose-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-rose-800 block uppercase font-bold">
                    Total Gasto
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {expCantidad || 1} &times; {expMoneda} {expPrecio || 0}
                  </span>
                </div>
                <span className="text-base sm:text-lg font-black text-rose-950 font-mono">
                  {formatMoney(expCalculatedTotal, expMoneda)}
                </span>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Observaciones <span className="text-stone-400 font-normal">(Opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={expObservacion}
                  onChange={(e) => setExpObservacion(e.target.value)}
                  placeholder="Factura, proveedor, detalle del repuesto..."
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none"
                />
              </div>

              {/* Botón Guardar */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold py-3 text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[46px]"
              >
                <CircleMinus className="h-4 w-4" />
                <span>{saving ? 'Guardando...' : 'Guardar Gasto de Maquinaria'}</span>
              </button>
            </form>
          </div>

          {/* Lista de gastos recientes */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Gastos de Maquinarias ({machineryExpenses.length})
            </h3>

            <div className="space-y-2">
              {machineryExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-900">{exp.itemGasto}</span>
                      <span className="text-[11px] text-stone-500 font-normal">({exp.fecha})</span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5 truncate">
                      {exp.maquinariaNombre ? `Equipo: ${exp.maquinariaNombre}` : 'Gasto general'} &bull; {exp.cantidad} {exp.unidad}
                    </p>
                    {exp.observacion && (
                      <p className="text-[11px] text-stone-500 italic mt-0.5 break-words">
                        {exp.observacion}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-rose-800 text-sm">
                      {formatMoney(exp.total, exp.moneda)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteExp(exp.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Eliminar gasto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {machineryExpenses.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-4">
                  No hay gastos de maquinaria registrados en esta campaña.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONSULTA: HISTORIAL DE TRABAJOS                             */}
      {/* ============================================================ */}
      {currentScreen === 'historial' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
              {filteredJobs.length} trabajos
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                Historial de Trabajos de Maquinaria
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Servicios realizados para clientes externos y labores en lotes propios.
              </p>
            </div>

            {/* Filtros: Búsqueda y Tipo de Trabajo */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por equipo, cliente, lote u observación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[40px]"
                />
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistorialFilter('todos')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center ${
                    historialFilter === 'todos'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Todos ({jobs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('terceros')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center ${
                    historialFilter === 'terceros'
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Para otros ({externalJobs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('propiedad')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center ${
                    historialFilter === 'propiedad'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  En propiedad ({propertyJobs.length})
                </button>
              </div>
            </div>

            {/* VISTA MÓVIL: Tarjetas Verticales Compactas (Cero desplazamiento horizontal) */}
            <div className="block md:hidden space-y-2.5">
              {filteredJobs.map((j) => (
                <div
                  key={j.id}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-stone-200/60 pb-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-stone-900 block truncate">
                        {j.fecha} &mdash; {j.maquinariaNombre}
                      </span>
                      <span className="text-[11px] text-stone-600 block mt-0.5">
                        {j.tipoTrabajo === 'propiedad'
                          ? `Lote: ${j.loteNombre || 'Propiedad'}`
                          : `Cliente: ${j.cliente || 'Externo'}`}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        j.tipoTrabajo === 'propiedad'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {j.tipoTrabajo === 'propiedad' ? 'Propiedad' : 'Para otros'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-stone-500 block">Trabajo Realizado:</span>
                      <span className="font-semibold text-stone-800 font-mono">
                        {j.cantidad} {j.unidad}s
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-stone-500 block">Fecha:</span>
                      <span className="font-medium text-stone-700 font-mono">
                        {j.fecha}
                      </span>
                    </div>
                  </div>

                  {j.observacion && (
                    <p className="text-[11px] text-stone-500 italic bg-white p-1.5 rounded border border-stone-200/60 break-words">
                      {j.observacion}
                    </p>
                  )}

                  <div className="flex items-center justify-end pt-1 border-t border-stone-200/60">
                    <button
                      type="button"
                      onClick={() => handleDeleteJob(j.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition min-h-[36px] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}

              {filteredJobs.length === 0 && (
                <div className="py-8 text-center text-xs text-stone-400">
                  No se encontraron registros de trabajos con los filtros actuales.
                </div>
              )}
            </div>

            {/* VISTA ESCRITORIO: Tabla Excel */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-3 font-semibold">Fecha</th>
                    <th className="py-2.5 px-3 font-semibold">Tipo</th>
                    <th className="py-2.5 px-3 font-semibold">Maquinaria</th>
                    <th className="py-2.5 px-3 font-semibold">Destino</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Trabajado</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {filteredJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-stone-50">
                      <td className="py-2 px-3 text-stone-600 font-sans">{j.fecha}</td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] rounded font-semibold ${
                            j.tipoTrabajo === 'propiedad'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {j.tipoTrabajo === 'propiedad' ? 'Propiedad' : 'Para otros'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-stone-900 font-sans">{j.maquinariaNombre}</td>
                      <td className="py-2 px-3 text-stone-800 font-sans">
                        {j.tipoTrabajo === 'propiedad' ? j.loteNombre || 'Lote Propio' : j.cliente || 'Externo'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {j.cantidad} {j.unidad}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteJob(j.id)}
                          className="p-1 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded transition cursor-pointer"
                          title="Eliminar trabajo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-stone-400">
                        No se encontraron registros de trabajos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONSULTA: RESUMEN DE MAQUINARIAS                            */}
      {/* ============================================================ */}
      {currentScreen === 'resumen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
              {machines.length} maquinarias
            </span>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
              <h2 className="text-sm font-bold text-stone-900">
                Resumen Operativo por Maquinaria
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Total de horas y hectáreas trabajadas y cantidad de servicios realizados por equipo.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {machines.map((m) => {
                const machineJobs = jobs.filter((j) => j.maquinariaId === m.id);

                const hrs = machineJobs
                  .filter((j) => j.unidad === 'hora')
                  .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);
                const ha = machineJobs
                  .filter((j) => j.unidad === 'hectarea')
                  .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

                return (
                  <div
                    key={m.id}
                    className="w-full rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between pb-2 border-b border-stone-100">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-stone-900 truncate">{m.nombre}</h4>
                        <p className="text-[11px] text-stone-500 truncate">
                          {m.identificacion}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded shrink-0 ${
                          m.estado === 'operativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.estado === 'mantenimiento'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {m.estado}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-stone-50 p-2 rounded-lg border border-stone-100">
                        <span className="text-[10px] text-stone-500 block">Horas</span>
                        <p className="text-xs font-bold text-stone-900 font-mono">{hrs.toFixed(1)} h</p>
                      </div>
                      <div className="bg-stone-50 p-2 rounded-lg border border-stone-100">
                        <span className="text-[10px] text-stone-500 block">Hectáreas</span>
                        <p className="text-xs font-bold text-stone-900 font-mono">{ha.toFixed(1)} ha</p>
                      </div>
                      <div className="bg-stone-50 p-2 rounded-lg border border-stone-100">
                        <span className="text-[10px] text-stone-500 block">Trabajos</span>
                        <p className="text-xs font-bold text-stone-900 font-mono">{machineJobs.length}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {machines.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-stone-400 bg-white rounded-2xl border border-stone-200">
                  No hay maquinarias registradas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
