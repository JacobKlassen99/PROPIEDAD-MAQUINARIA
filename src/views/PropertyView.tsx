import React, { useState } from 'react';
import {
  Trees,
  CirclePlus,
  CircleMinus,
  LandPlot,
  Tractor,
  ChartColumnIncreasing,
  History,
  ChevronRight,
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
} from 'lucide-react';
import {
  Campaign,
  Lot,
  Expense,
  Income,
  MachineryJob,
  Currency,
  ExchangeRateConfig,
  ItemConfig,
} from '../types';
import {
  createExpense,
  deleteExpense,
  createIncome,
  deleteIncome,
} from '../services/backend';

interface Props {
  activeCampaign: Campaign | null;
  lots: Lot[];
  expenses: Expense[];
  incomes: Income[];
  jobs: MachineryJob[];
  itemsConfig: ItemConfig[];
  currency: Currency;
  exchangeRate: ExchangeRateConfig;
  onRefreshData: () => void;
}

type PropertyScreen =
  | 'main'
  | 'ingreso'
  | 'gasto'
  | 'lotes'
  | 'maquinaria_recibida'
  | 'resultados'
  | 'historial';

export const PropertyView: React.FC<Props> = ({
  activeCampaign,
  lots,
  expenses,
  incomes,
  jobs,
  currency,
  exchangeRate,
  onRefreshData,
}) => {
  const [currentScreen, setCurrentScreen] = useState<PropertyScreen>('main');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filters for Historial
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialFilter, setHistorialFilter] = useState<'todos' | 'ingresos' | 'gastos' | 'maquinaria'>('todos');

  // Form State for Agricultural Expense
  const [expFecha, setExpFecha] = useState(new Date().toISOString().slice(0, 10));
  const [expLotId, setExpLotId] = useState('');
  const [expItem, setExpItem] = useState('Semillas');
  const [expCantidad, setExpCantidad] = useState<number | ''>(1);
  const [expUnidad, setExpUnidad] = useState('kg');
  const [expPrecio, setExpPrecio] = useState<number | ''>('');
  const [expMoneda, setExpMoneda] = useState<Currency>('BOB');
  const [expObs, setExpObs] = useState('');

  // Form State for Agricultural Income
  const [incFecha, setIncFecha] = useState(new Date().toISOString().slice(0, 10));
  const [incLotId, setIncLotId] = useState('');
  const [incConcepto, setIncConcepto] = useState('Venta Cosecha Soya');
  const [incCantidad, setIncCantidad] = useState<number | ''>(100);
  const [incUnidad, setIncUnidad] = useState('toneladas');
  const [incPrecio, setIncPrecio] = useState<number | ''>('');
  const [incMoneda, setIncMoneda] = useState<Currency>('BOB');
  const [incObs, setIncObs] = useState('');

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

  const propertyExpenses = (expenses || []).filter((e) => e.modulo === 'propiedad');
  const propertyIncomes = incomes || [];
  const linkedPropertyJobs = (jobs || []).filter((j) => j.tipoTrabajo === 'propiedad');

  // Total movements count
  const totalMovementsCount =
    propertyIncomes.length + propertyExpenses.length + linkedPropertyJobs.length;

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!activeCampaign) {
      setErrorMsg('Debes seleccionar o activar una campaña activa.');
      return;
    }

    if (!expLotId) {
      setErrorMsg('Selecciona un lote obligatorio para el gasto agrícola.');
      return;
    }

    if (!expPrecio || Number(expPrecio) <= 0) {
      setErrorMsg('Ingresa un precio unitario válido.');
      return;
    }

    const lotObj = lots.find((l) => l.id === expLotId);
    const totalExp = (Number(expCantidad) || 1) * Number(expPrecio);

    setSaving(true);
    try {
      await createExpense({
        fecha: expFecha,
        campanaId: activeCampaign.id,
        modulo: 'propiedad',
        loteId: expLotId,
        loteNombre: lotObj?.nombre,
        itemGasto: expItem,
        cantidad: Number(expCantidad) || 1,
        unidad: expUnidad,
        precio: Number(expPrecio),
        moneda: expMoneda,
        tipoCambio: exchangeRate.tasaBobPerUsd,
        total: totalExp,
        observacion: expObs.trim(),
      });

      setSuccessMsg('Gasto agrícola registrado en el lote seleccionado.');
      setExpPrecio('');
      setExpObs('');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el gasto agrícola');
    } finally {
      setSaving(false);
    }
  };

  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    if (!incPrecio || Number(incPrecio) <= 0) {
      setErrorMsg('Ingresa el precio unitario de venta.');
      return;
    }

    const lotObj = lots.find((l) => l.id === incLotId);
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
        cantidad: Number(incCantidad) || 0,
        unidad: incUnidad,
        precio: Number(incPrecio),
        moneda: incMoneda,
        tipoCambio: exchangeRate.tasaBobPerUsd,
        total: totalInc,
        observacion: incObs.trim(),
      });

      setSuccessMsg('Ingreso de cosecha registrado exitosamente.');
      setIncPrecio('');
      setIncObs('');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el ingreso');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExp = async (id: string) => {
    if (!window.confirm('¿Confirmas eliminar este gasto agrícola?')) return;
    try {
      await deleteExpense(id);
      setSuccessMsg('Gasto agrícola eliminado.');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const handleDeleteInc = async (id: string) => {
    if (!window.confirm('¿Confirmas eliminar este registro de ingreso?')) return;
    try {
      await deleteIncome(id);
      setSuccessMsg('Ingreso eliminado.');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar');
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

  // Build combined chronological movements for the Historial
  interface MovementItem {
    id: string;
    tipo: 'ingreso' | 'gasto_directo' | 'maquinaria_recibida';
    fecha: string;
    loteNombre: string;
    titulo: string;
    detalle: string;
    monto: number;
    moneda: Currency;
  }

  const allMovements: MovementItem[] = [
    ...propertyIncomes.map((i) => ({
      id: i.id,
      tipo: 'ingreso' as const,
      fecha: i.fecha,
      loteNombre: i.loteNombre || 'Lote',
      titulo: i.concepto,
      detalle: `${i.cantidad} ${i.unidad} ${i.precio ? `@ ${i.moneda} ${i.precio}` : ''} ${i.observacion ? `• ${i.observacion}` : ''}`.trim(),
      monto: i.total,
      moneda: i.moneda,
    })),
    ...propertyExpenses.map((e) => ({
      id: e.id,
      tipo: (e.esTrabajoPropio ? 'maquinaria_recibida' : 'gasto_directo') as 'gasto_directo' | 'maquinaria_recibida',
      fecha: e.fecha,
      loteNombre: e.loteNombre || 'Lote',
      titulo: e.itemGasto,
      detalle: `${e.cantidad} ${e.unidad} ${e.observacion ? `• ${e.observacion}` : ''}`.trim(),
      monto: e.total,
      moneda: e.moneda,
    })),
    ...linkedPropertyJobs
      .filter((j) => !propertyExpenses.some((e) => e.trabajoId === j.id))
      .map((j) => ({
        id: j.id,
        tipo: 'maquinaria_recibida' as const,
        fecha: j.fecha,
        loteNombre: j.loteNombre || 'Lote',
        titulo: `Labor: ${j.maquinariaNombre}`,
        detalle: `${j.cantidad} ${j.unidad}s @ ${j.moneda} ${j.tarifa}/${j.unidad} ${j.observacion ? `• ${j.observacion}` : ''}`.trim(),
        monto: j.total,
        moneda: j.moneda,
      })),
  ].sort((a, b) => (b.fecha > a.fecha ? 1 : -1));

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
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      {/* Module Title Header */}
      <div className="flex flex-col gap-1 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-emerald-700 text-white shrink-0">
            <Trees className="h-4 w-4" />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight truncate">
            PROPIEDAD
          </h1>
        </div>
        <p className="text-xs text-stone-500">
          Lotes agrícolas, cosechas, insumos y costos de maquinaria recibida
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

            {/* Dos botones grandes: INGRESO (verde) y GASTO (rojo) */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Botón INGRESO */}
              <button
                type="button"
                onClick={() => setCurrentScreen('ingreso')}
                className="w-full min-h-[76px] sm:min-h-[84px] p-3 sm:p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm flex flex-col items-center justify-center gap-1.5 transition cursor-pointer select-none border border-emerald-700"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <CirclePlus className="h-5 w-5 sm:h-6 sm:w-6 text-white shrink-0" />
                  <span className="text-sm sm:text-base font-bold tracking-wider uppercase">
                    INGRESO
                  </span>
                </div>
                <span className="text-[11px] text-emerald-100 font-medium text-center leading-tight">
                  Cosecha o venta
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
                  Insumos del lote
                </span>
              </button>
            </div>
          </div>

          {/* SEPARADOR */}
          <div className="border-t border-stone-200 pt-2" />

          {/* SECCIÓN B: CONSULTAR REGISTROS (4 OPCIONES INDEPENDIENTES) */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-stone-600 uppercase">
              CONSULTAR REGISTROS
            </h2>

            <div className="space-y-2.5">
              {/* Opción A: Lotes registrados */}
              <button
                type="button"
                onClick={() => setCurrentScreen('lotes')}
                className="w-full bg-white border border-stone-200 hover:border-emerald-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-2xs hover:bg-stone-50 active:bg-stone-100 transition cursor-pointer text-left min-h-[64px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 shrink-0">
                    <LandPlot className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-stone-900 leading-snug truncate">
                      Lotes registrados
                    </h3>
                    <p className="text-xs text-stone-500 leading-snug mt-0.5 break-words">
                      Superficies, cultivos y estado agronómico ({lots.length} lotes)
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-400 shrink-0" />
              </button>

              {/* Opción B: Gastos de maquinaria recibida (con distintivo rojo sutil de gasto) */}
              <button
                type="button"
                onClick={() => setCurrentScreen('maquinaria_recibida')}
                className="w-full bg-white border border-stone-200 hover:border-rose-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-2xs hover:bg-stone-50 active:bg-stone-100 transition cursor-pointer text-left min-h-[64px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200/60 shrink-0">
                    <Tractor className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-stone-900 leading-snug truncate">
                        Gastos de maquinaria recibida
                      </h3>
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded shrink-0 hidden sm:inline-block">
                        Gasto automático
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 leading-snug mt-0.5 break-words">
                      Trabajos internos recibidos desde Maquinarias ({linkedPropertyJobs.length} registros)
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-400 shrink-0" />
              </button>

              {/* Opción C: Actividad por lote */}
              <button
                type="button"
                onClick={() => setCurrentScreen('resultados')}
                className="w-full bg-white border border-stone-200 hover:border-emerald-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-2xs hover:bg-stone-50 active:bg-stone-100 transition cursor-pointer text-left min-h-[64px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 shrink-0">
                    <ChartColumnIncreasing className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-stone-900 leading-snug truncate">
                      Actividad por lote
                    </h3>
                    <p className="text-xs text-stone-500 leading-snug mt-0.5 break-words">
                      Labores realizadas, cosechas e insumos aplicados ({lots.length} lotes)
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-stone-400 shrink-0" />
              </button>

              {/* Opción D: Historial de movimientos */}
              <button
                type="button"
                onClick={() => setCurrentScreen('historial')}
                className="w-full bg-white border border-stone-200 hover:border-emerald-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-2xs hover:bg-stone-50 active:bg-stone-100 transition cursor-pointer text-left min-h-[64px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 shrink-0">
                    <History className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-stone-900 leading-snug truncate">
                      Historial de movimientos
                    </h3>
                    <p className="text-xs text-stone-500 leading-snug mt-0.5 break-words">
                      Ingresos y gastos agrícolas de la campaña ({totalMovementsCount} registros)
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
      {/* FORMULARIO: REGISTRAR INGRESO AGRÍCOLA                       */}
      {/* ============================================================ */}
      {currentScreen === 'ingreso' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              Ingreso Agrícola
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
            <div className="pb-3 border-b border-stone-100 mb-4">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Wheat className="h-4 w-4 text-emerald-700" />
                <span>Registrar Ingreso Agrícola</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Ventas de cosecha (soya, maíz, trigo, sorgo) u otros ingresos del lote.
              </p>
            </div>

            <form onSubmit={handleIncomeSubmit} className="space-y-4">
              {/* Lote */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Lote de Origen <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={incLotId}
                  onChange={(e) => setIncLotId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold text-emerald-950 min-h-[44px]"
                >
                  <option value="">-- Seleccionar Lote --</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} ({l.superficieHectareas} ha &bull; {l.cultivoActual || 'Sin cultivo'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Concepto / Producto */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Concepto / Producto <span className="text-red-500">*</span>
                </label>
                <select
                  value={incConcepto}
                  onChange={(e) => setIncConcepto(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                >
                  <option value="Venta Cosecha Soya">Venta Cosecha Soya</option>
                  <option value="Venta Cosecha Maíz">Venta Cosecha Maíz</option>
                  <option value="Venta Cosecha Trigo">Venta Cosecha Trigo</option>
                  <option value="Venta Cosecha Sorgo">Venta Cosecha Sorgo</option>
                  <option value="Venta Cosecha Girasol">Venta Cosecha Girasol</option>
                  <option value="Venta de Semilla">Venta de Semilla</option>
                  <option value="Otros Ingresos del Lote">Otros Ingresos del Lote</option>
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
                    value={incFecha}
                    onChange={(e) => setIncFecha(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
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
                    min="0.01"
                    placeholder="0.0"
                    value={incCantidad}
                    onChange={(e) => setIncCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Unidad</label>
                  <select
                    value={incUnidad}
                    onChange={(e) => setIncUnidad(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  >
                    <option value="toneladas">Toneladas (t)</option>
                    <option value="quintales">Quintales (qq)</option>
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="bolsas">Bolsas</option>
                  </select>
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
                    value={incPrecio}
                    onChange={(e) => setIncPrecio(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Moneda</label>
                  <select
                    value={incMoneda}
                    onChange={(e) => setIncMoneda(e.target.value as Currency)}
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
                    Total Ingreso
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {incCantidad || 0} {incUnidad} &times; {incMoneda} {incPrecio || 0}
                  </span>
                </div>
                <span className="text-base sm:text-lg font-black text-emerald-950 font-mono">
                  {formatMoney(incCalculatedTotal, incMoneda)}
                </span>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Observaciones <span className="text-stone-400 font-normal">(Opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={incObs}
                  onChange={(e) => setIncObs(e.target.value)}
                  placeholder="Silo de acopio, comprador, número de liquidación..."
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
                <span>{saving ? 'Guardando...' : 'Guardar Ingreso Agrícola'}</span>
              </button>
            </form>
          </div>

          {/* Lista de ingresos recientes */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Ingresos de Cosecha ({propertyIncomes.length})
            </h3>

            <div className="space-y-2">
              {propertyIncomes.map((i) => (
                <div
                  key={i.id}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-900">{i.concepto}</span>
                      <span className="text-[11px] text-stone-500 font-normal">({i.fecha})</span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5 truncate">
                      Lote: <strong className="text-emerald-900">{i.loteNombre || 'Lote'}</strong> &bull; {i.cantidad} {i.unidad}
                    </p>
                    {i.observacion && (
                      <p className="text-[11px] text-stone-500 italic mt-0.5 break-words">
                        {i.observacion}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-emerald-800 text-xs bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200/60">
                      Cosecha registrada
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteInc(i.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Eliminar ingreso"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {propertyIncomes.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-4">
                  No hay ingresos de cosecha registrados en esta campaña.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FORMULARIO: REGISTRAR GASTO AGRÍCOLA DIRECTO                 */}
      {/* ============================================================ */}
      {currentScreen === 'gasto' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
              Gasto Agrícola
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
            <div className="pb-3 border-b border-stone-100 mb-4">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-rose-700" />
                <span>Registrar Gasto Agrícola</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Semillas, agroquímicos, fertilizantes, jornales manuales u otros insumos del lote.
              </p>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              {/* Lote */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Lote Asignado <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={expLotId}
                  onChange={(e) => setExpLotId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none font-bold text-emerald-950 min-h-[44px]"
                >
                  <option value="">-- Seleccionar Lote --</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} ({l.superficieHectareas} ha &bull; {l.cultivoActual || 'Sin cultivo'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rubro / Insumo */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Rubro / Insumo <span className="text-red-500">*</span>
                </label>
                <select
                  value={expItem}
                  onChange={(e) => setExpItem(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none font-semibold min-h-[44px]"
                >
                  <option value="Semillas">Semillas e Inoculantes</option>
                  <option value="Agroquímicos">Agroquímicos / Defensivos (Fungicidas, Herbicidas, Insecticidas)</option>
                  <option value="Fertilizantes">Fertilizantes y Enmiendas</option>
                  <option value="Mano de Obra">Mano de Obra / Jornales Manuales</option>
                  <option value="Riego">Riego y Agua</option>
                  <option value="Flete">Flete y Logística de Cosecha</option>
                  <option value="Otros Gastos">Otros Gastos Agrícolas</option>
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
                    min="0.01"
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
                    placeholder="kg, litros, bolsas, jornales..."
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
                    Total Gasto Lote
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
                  value={expObs}
                  onChange={(e) => setExpObs(e.target.value)}
                  placeholder="Proveedor, dosis aplicada, factura..."
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
                <span>{saving ? 'Guardando...' : 'Guardar Gasto Agrícola'}</span>
              </button>
            </form>
          </div>

          {/* Lista de gastos agrícolas recientes */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Gastos Agrícolas ({propertyExpenses.length})
            </h3>

            <div className="space-y-2">
              {propertyExpenses.map((exp) => (
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
                      Lote: <strong className="text-stone-800">{exp.loteNombre || 'Lote'}</strong> &bull; {exp.cantidad} {exp.unidad}
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
                    {!exp.esTrabajoPropio && (
                      <button
                        type="button"
                        onClick={() => handleDeleteExp(exp.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Eliminar gasto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {propertyExpenses.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-4">
                  No hay gastos agrícolas registrados en esta campaña.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONSULTA A: LOTES REGISTRADOS (SOLO LECTURA)                 */}
      {/* ============================================================ */}
      {currentScreen === 'lotes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
              {lots.length} lotes
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Lotes Registrados en la Propiedad
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Superficie total:{' '}
                  <strong className="text-emerald-900">
                    {lots
                      .reduce((sum, l) => sum + (Number(l.superficieHectareas) || 0), 0)
                      .toFixed(1)}{' '}
                    hectáreas
                  </strong>
                </p>
              </div>

              <div className="text-[11px] text-stone-500 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                Administración de lotes: <strong className="text-stone-800">Administración → Lotes</strong>
              </div>
            </div>

            {/* Listado de tarjetas de lotes (Mobile First, Cero desplazamiento horizontal) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {lots.map((lot) => {
                return (
                  <div
                    key={lot.id}
                    className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 hover:bg-stone-50 hover:border-emerald-300 transition flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-stone-900 truncate">{lot.nombre}</h4>
                          <p className="text-xs font-semibold text-emerald-800">
                            {lot.superficieHectareas} Hectáreas
                          </p>
                        </div>
                        {lot.cultivoActual && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold shrink-0">
                            {lot.cultivoActual}
                          </span>
                        )}
                      </div>

                      {lot.ubicacion && (
                        <p className="text-[11px] text-stone-600 mt-2">
                          <span className="text-stone-400">Ubicación:</span> {lot.ubicacion}
                        </p>
                      )}

                      {lot.observaciones && (
                        <p className="text-[11px] text-stone-500 italic mt-1 bg-white p-2 rounded-lg border border-stone-200/60 break-words">
                          {lot.observaciones}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {lots.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs text-stone-400">
                  No hay lotes registrados aún. Puedes darlos de alta en el módulo de Administración → Lotes.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONSULTA B: GASTOS DE MAQUINARIA RECIBIDA (VINCULADOS)       */}
      {/* ============================================================ */}
      {currentScreen === 'maquinaria_recibida' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              {linkedPropertyJobs.length} labores recibidas
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/60 shrink-0">
                  <Tractor className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-900">
                    Gastos de Maquinaria Recibida
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Labores de tractores y equipos asignadas a lotes de la propiedad.
                  </p>
                </div>
              </div>

              {/* Distintivo de no duplicación manual */}
              <div className="mt-3 bg-amber-50/80 p-3 rounded-xl border border-amber-200/70 text-xs text-amber-900 leading-relaxed">
                <strong>Gasto registrado automáticamente:</strong> Estos costos provienen de trabajos realizados por tu propia maquinaria en los lotes. Para modificar o anular un registro, debes gestionarlo directamente desde el módulo <strong>Maquinarias</strong>.
              </div>
            </div>

            {/* VISTA MÓVIL: Tarjetas Verticales Compactas */}
            <div className="block md:hidden space-y-2.5">
              {linkedPropertyJobs.map((j) => (
                <div
                  key={j.id}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                    <span className="text-xs font-bold text-stone-900">
                      {j.fecha} &mdash; {j.maquinariaNombre}
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                      Maquinaria Propia
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-xs text-stone-700">
                    <div>
                      <span className="text-stone-500 text-[11px] block">Lote Destino:</span>
                      <span className="font-bold text-emerald-900">{j.loteNombre || 'Lote'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px] block">Trabajo Realizado:</span>
                      <span className="font-semibold font-mono">
                        {j.cantidad} {j.unidad}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-stone-600">
                    <span className="text-stone-500 text-[11px]">Tarifa Aplicada: </span>
                    <span className="font-mono">
                      {j.moneda} {j.tarifa}/{j.unidad}
                    </span>
                  </div>

                  {j.observacion && (
                    <p className="text-[11px] text-stone-500 italic bg-white p-1.5 rounded border border-stone-200/60 break-words">
                      {j.observacion}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/60">
                    <div>
                      <span className="text-[10px] text-stone-500 block uppercase">Costo Asignado al Lote</span>
                      <span className="text-sm font-bold text-rose-800 font-mono">
                        {formatMoney(j.total, j.moneda)}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500 font-mono italic">
                      Movimiento vinculado
                    </span>
                  </div>
                </div>
              ))}

              {linkedPropertyJobs.length === 0 && (
                <div className="py-10 text-center text-xs text-stone-400">
                  No hay trabajos de maquinaria propia asignados a lotes en esta campaña.
                </div>
              )}
            </div>

            {/* VISTA ESCRITORIO: Tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-3 font-semibold">Fecha</th>
                    <th className="py-2.5 px-3 font-semibold">Lote Destino</th>
                    <th className="py-2.5 px-3 font-semibold">Maquinaria</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Horas / Ha</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tarifa</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Costo para el Lote</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {linkedPropertyJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-stone-50">
                      <td className="py-2 px-3 text-stone-600 whitespace-nowrap">{j.fecha}</td>
                      <td className="py-2 px-3 font-bold text-emerald-900">{j.loteNombre || 'Lote'}</td>
                      <td className="py-2 px-3 font-medium text-stone-900">{j.maquinariaNombre}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {j.cantidad} {j.unidad}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {j.moneda} {j.tarifa}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-rose-800 font-mono">
                        {formatMoney(j.total, j.moneda)}
                      </td>
                    </tr>
                  ))}
                  {linkedPropertyJobs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-stone-400">
                        No hay trabajos de maquinaria propia asignados a lotes en esta campaña.
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
      {/* CONSULTA C: RESULTADOS POR LOTE                              */}
      {/* ============================================================ */}
      {currentScreen === 'resultados' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
              {lots.length} lotes analizados
            </span>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
              <h2 className="text-sm font-bold text-stone-900">
                Actividad por Lote
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Labores de maquinaria recibidas, cosechas e insumos aplicados en cada lote.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lots.map((lot) => {
                const lotMachineryJobs = linkedPropertyJobs.filter((j) => j.loteId === lot.id);
                const lotIncomes = propertyIncomes.filter((i) => i.loteId === lot.id);
                const lotExpensesDirect = propertyExpenses.filter(
                  (e) => e.loteId === lot.id && !e.esTrabajoPropio
                );

                const hrs = lotMachineryJobs
                  .filter((j) => j.unidad === 'hora')
                  .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);
                const ha = lotMachineryJobs
                  .filter((j) => j.unidad === 'hectarea')
                  .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

                return (
                  <div
                    key={lot.id}
                    className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-stone-900 truncate">{lot.nombre}</h4>
                        <p className="text-[11px] text-stone-500 truncate">
                          {lot.superficieHectareas} Hectáreas &bull; {lot.cultivoActual || 'Sin cultivo'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs my-2">
                      <div className="flex justify-between items-center text-stone-700 bg-stone-50 p-2 rounded-lg border border-stone-100">
                        <span>Labores de Maquinaria:</span>
                        <span className="font-bold text-stone-900 font-mono">
                          {lotMachineryJobs.length} ({hrs > 0 ? `${hrs.toFixed(1)} h` : ''}{hrs > 0 && ha > 0 ? ' / ' : ''}{ha > 0 ? `${ha.toFixed(1)} ha` : ''}{hrs === 0 && ha === 0 ? '0 h' : ''})
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-stone-700 bg-stone-50 p-2 rounded-lg border border-stone-100">
                        <span>Cosechas Registradas:</span>
                        <span className="font-bold text-emerald-900 font-mono">
                          {lotIncomes.length} registro{lotIncomes.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-stone-700 bg-stone-50 p-2 rounded-lg border border-stone-100">
                        <span>Insumos / Gastos Directos:</span>
                        <span className="font-bold text-stone-900 font-mono">
                          {lotExpensesDirect.length} insumo{lotExpensesDirect.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {lots.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs text-stone-400 bg-white rounded-2xl border border-stone-200">
                  No hay lotes configurados en la propiedad.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONSULTA D: HISTORIAL DE MOVIMIENTOS                         */}
      {/* ============================================================ */}
      {currentScreen === 'historial' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
              {filteredMovements.length} movimientos
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                Historial de Movimientos de la Propiedad
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Ingresos agrícolas, gastos directos del lote y gastos de maquinaria propia vinculados.
              </p>
            </div>

            {/* Filtros: Búsqueda y Pestañas de Tipo */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por lote, concepto, labor o detalle..."
                  value={historialSearch}
                  onChange={(e) => setHistorialSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[40px]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistorialFilter('todos')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center truncate px-2 ${
                    historialFilter === 'todos'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Todos ({allMovements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('ingresos')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center truncate px-2 ${
                    historialFilter === 'ingresos'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Ingresos ({propertyIncomes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('gastos')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center truncate px-2 ${
                    historialFilter === 'gastos'
                      ? 'bg-rose-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Gastos directos ({propertyExpenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('maquinaria')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center truncate px-2 ${
                    historialFilter === 'maquinaria'
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Maquinaria ({linkedPropertyJobs.length})
                </button>
              </div>
            </div>

            {/* Listado Mobile-First (Cero desplazamiento horizontal) */}
            <div className="space-y-2.5">
              {filteredMovements.map((m) => (
                <div
                  key={`${m.tipo}-${m.id}`}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-stone-200/60 pb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-900 truncate">
                          {m.titulo}
                        </span>
                        <span className="text-[11px] text-stone-500 font-normal shrink-0">
                          ({m.fecha})
                        </span>
                      </div>
                      <span className="text-[11px] text-emerald-900 font-semibold block mt-0.5">
                        Lote: {m.loteNombre}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        m.tipo === 'ingreso'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.tipo === 'gasto_directo'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {m.tipo === 'ingreso'
                        ? 'Ingreso'
                        : m.tipo === 'gasto_directo'
                        ? 'Gasto Directo'
                        : 'Maq. Propia'}
                    </span>
                  </div>

                  {m.detalle && (
                    <p className="text-[11px] text-stone-600 break-words">
                      {m.detalle}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
                    <span className="text-[10px] text-stone-500 uppercase">
                      {m.tipo === 'ingreso' ? 'Estado' : 'Costo Imputado'}
                    </span>
                    {m.tipo === 'ingreso' ? (
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                        Cosecha registrada
                      </span>
                    ) : (
                      <span className="text-sm font-bold font-mono text-rose-800">
                        - {formatMoney(m.monto, m.moneda)}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {filteredMovements.length === 0 && (
                <div className="py-8 text-center text-xs text-stone-400">
                  No se encontraron movimientos registrados con los filtros seleccionados.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
