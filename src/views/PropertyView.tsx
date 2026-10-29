import React, { useState } from 'react';
import {
  Trees,
  CirclePlus,
  CircleMinus,
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
} from 'lucide-react';
import { VisualIcon } from '../components/VisualIcon';
import {
  VisualExpenseItemPicker,
  VisualIncomeItemPicker,
  VisualLotPicker,
} from '../components/VisualEntityPicker';
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
} from '../types';
import {
  createExpense,
  updateExpense,
  deleteExpense,
  createIncome,
  updateIncome,
  deleteIncome,
  formatDateDDMMAAAA,
  isTechnicalId,
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
  | 'historial';

interface MovementItem {
  id: string;
  tipo: 'ingreso' | 'gasto_directo' | 'maquinaria_recibida';
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
}

export const PropertyView: React.FC<Props> = ({
  activeCampaign,
  lots,
  expenses,
  incomes,
  jobs,
  itemsConfig = [],
  currency,
  exchangeRate,
  onRefreshData,
}) => {
  const [currentScreen, setCurrentScreen] = useState<PropertyScreen>('main');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filters for Movimientos
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialFilter, setHistorialFilter] = useState<'todos' | 'ingresos' | 'gastos' | 'maquinaria'>('todos');
  const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);

  // Accordion state for Mis lotes (only 1 lot expanded at a time)
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);

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

  const propertyExpenses = (expenses || []).filter((e) => e.modulo === 'propiedad');
  const propertyIncomes = incomes || [];
  const linkedPropertyJobs = (jobs || []).filter((j) => j.tipoTrabajo === 'propiedad');

  const propertyExpenseItems = (itemsConfig || []).filter(
    (item) =>
      item.activo !== false &&
      ((item.modulo === 'PROPIEDAD' && item.clase === 'GASTO') ||
        item.tipo === 'gasto_propiedad')
  );

  const propertyIncomeItems = (itemsConfig || []).filter(
    (item) =>
      item.activo !== false &&
      ((item.modulo === 'PROPIEDAD' && item.clase === 'INGRESO') ||
        item.tipo === 'ingreso_propiedad')
  );

  // Build combined chronological movements for the Historial
  const allMovements: MovementItem[] = [
    ...propertyIncomes.map((i) => ({
      id: i.id,
      tipo: 'ingreso' as const,
      fecha: i.fecha,
      loteId: i.loteId,
      loteNombre: i.loteNombre || (lots.find((l) => l.id === i.loteId)?.nombre) || 'Lote',
      titulo: i.concepto,
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
    })),
    ...propertyExpenses.map((e) => {
      const isJobLinked = Boolean(e.esTrabajoPropio || e.trabajoId);
      return {
        id: e.id,
        tipo: (isJobLinked ? 'maquinaria_recibida' : 'gasto_directo') as 'gasto_directo' | 'maquinaria_recibida',
        fecha: e.fecha,
        loteId: e.loteId,
        loteNombre: e.loteNombre || (lots.find((l) => l.id === e.loteId)?.nombre) || 'Lote',
        titulo: e.itemGasto,
        detalle: `${e.cantidad} ${e.unidad || ''} ${e.precio ? `@ ${e.moneda === 'USD' ? 'USD' : 'Bs'} ${e.precio}` : ''} ${e.observacion ? `• ${e.observacion}` : ''}`.trim(),
        monto: e.total,
        moneda: (e.moneda === 'USD' ? 'USD' : 'BOB') as Currency,
        tipoCambio: e.tipoCambio || e.tc || exchangeRate?.tasaBobPerUsd,
        cantidad: e.cantidad,
        unidad: e.unidad,
        precioUnitario: e.precio,
        observacion: e.observacion,
        esTrabajoPropio: isJobLinked,
        trabajoId: e.trabajoId,
        icono: e.icono || (itemsConfig.find((it) => it.nombre.toLowerCase() === e.itemGasto.toLowerCase())?.icono) || 'semillas',
      };
    }),
    ...linkedPropertyJobs
      .filter((j) => !propertyExpenses.some((e) => e.trabajoId === j.id))
      .map((j) => ({
        id: j.id,
        tipo: 'maquinaria_recibida' as const,
        fecha: j.fecha,
        loteId: j.loteId,
        loteNombre: j.loteNombre || (lots.find((l) => l.id === j.loteId)?.nombre) || 'Lote',
        titulo: `Labor: ${j.maquinariaNombre || 'Maquinaria'}`,
        detalle: `${j.cantidad} ${j.unidad}s @ ${j.moneda === 'USD' ? 'USD' : 'Bs'} ${j.tarifa}/${j.unidad} ${j.observacion ? `• ${j.observacion}` : ''}`.trim(),
        monto: j.total,
        moneda: (j.moneda === 'USD' ? 'USD' : 'BOB') as Currency,
        tipoCambio: j.tipoCambio || j.tc || exchangeRate?.tasaBobPerUsd,
        cantidad: j.cantidad,
        unidad: j.unidad,
        precioUnitario: j.tarifa,
        observacion: j.observacion,
        esTrabajoPropio: true,
        trabajoId: j.id,
        icono: j.icono || 'tractor',
      })),
  ].sort((a, b) => (b.fecha > a.fecha ? 1 : -1));

  // Total movements count
  const totalMovementsCount = allMovements.length;

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
    const selectedItemObj = propertyExpenseItems.find((it) => it.nombre.toLowerCase() === expItem.toLowerCase());
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
        icono: selectedItemObj?.icono,
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

  // Open Edit Modal for a manual expense or income
  const handleOpenEditMovement = (m: MovementItem) => {
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
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar el registro');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePromptDeleteExp = (id: string, titulo: string) => {
    setItemToDelete({ id, tipo: 'gasto', titulo });
  };

  const handlePromptDeleteInc = (id: string, titulo: string) => {
    setItemToDelete({ id, tipo: 'ingreso', titulo });
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;
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
      onRefreshData();
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
      {/* iOS Subscreen Navigation Bar */}
      {currentScreen !== 'main' && (
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setCurrentScreen('main')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 font-bold text-sm transition cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Volver</span>
          </button>
          <span className="text-sm font-bold text-slate-800">
            {currentScreen === 'ingreso' && 'Registrar Ingreso'}
            {currentScreen === 'gasto' && 'Registrar Gasto'}
            {currentScreen === 'lotes' && 'Mis lotes'}
            {currentScreen === 'maquinaria_recibida' && 'Trabajos de maquinaria'}
            {currentScreen === 'historial' && 'Movimientos'}
          </span>
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
      {/* VISTA PRINCIPAL (MAIN): ORDEN EXACTO SOLICITADO             */}
      {/* ============================================================ */}
      {/* VISTA PRINCIPAL (MAIN): ORDEN UNIFORME CON MAQUINARIAS      */}
      {/* ============================================================ */}
      {currentScreen === 'main' && (
        <div className="space-y-5">
          {/* SECCIÓN A: REGISTRAR MOVIMIENTO */}
          <div className="space-y-2">
            <h2 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase px-1">
              REGISTRAR MOVIMIENTO
            </h2>

            {/* Dos botones compactos estilo iOS: INGRESO (verde suave) y GASTO (rojo suave) */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Botón INGRESO */}
              <button
                type="button"
                onClick={() => setCurrentScreen('ingreso')}
                className="w-full min-h-[72px] sm:min-h-[76px] p-3 sm:p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs border border-emerald-500/20 flex flex-col items-center justify-center gap-1 transition active:scale-[0.98] cursor-pointer select-none"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <CirclePlus className="h-5 w-5 text-emerald-100 shrink-0" />
                  <span className="text-sm sm:text-base font-bold tracking-tight">
                    Ingreso
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs text-emerald-100/90 font-medium text-center truncate max-w-full px-1">
                  Cosecha o venta
                </span>
              </button>

              {/* Botón GASTO */}
              <button
                type="button"
                onClick={() => setCurrentScreen('gasto')}
                className="w-full min-h-[72px] sm:min-h-[76px] p-3 sm:p-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-xs border border-rose-400/20 flex flex-col items-center justify-center gap-1 transition active:scale-[0.98] cursor-pointer select-none"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <CircleMinus className="h-5 w-5 text-rose-100 shrink-0" />
                  <span className="text-sm sm:text-base font-bold tracking-tight">
                    Gasto
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs text-rose-100/90 font-medium text-center truncate max-w-full px-1">
                  Insumos del lote
                </span>
              </button>
            </div>
          </div>

          {/* SECCIÓN B: CONSULTAR REGISTROS (1. Movimientos, 2. Mis lotes, 3. Trabajos de maquinaria) */}
          <div className="space-y-2">
            <h2 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase px-1">
              CONSULTAR REGISTROS
            </h2>

            <div className="space-y-2.5">
              {/* Opción 1: Movimientos */}
              <button
                type="button"
                onClick={() => setCurrentScreen('historial')}
                className="w-full bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs hover:bg-slate-50 active:scale-[0.99] transition cursor-pointer text-left min-h-[68px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100/80 shrink-0">
                    <History className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        Movimientos
                      </h3>
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full shrink-0">
                        {totalMovementsCount}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Ingresos, cosechas y gastos directos
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* Opción 2: Mis lotes */}
              <button
                type="button"
                onClick={() => setCurrentScreen('lotes')}
                className="w-full bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs hover:bg-slate-50 active:scale-[0.99] transition cursor-pointer text-left min-h-[68px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100/80 shrink-0">
                    <LandPlot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        Mis lotes
                      </h3>
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full shrink-0">
                        {lots.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Superficies, labores, cosechas y balance
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* Opción 3: Trabajos de maquinaria */}
              <button
                type="button"
                onClick={() => setCurrentScreen('maquinaria_recibida')}
                className="w-full bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs hover:bg-slate-50 active:scale-[0.99] transition cursor-pointer text-left min-h-[68px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-100/80 shrink-0">
                    <Tractor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        Trabajos de maquinaria
                      </h3>
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full shrink-0">
                        {linkedPropertyJobs.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Labores recibidas en lotes
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
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
          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
            <div className="pb-3 border-b border-stone-100 mb-4">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Wheat className="h-5 w-5 text-emerald-700" />
                <span>Registrar Ingreso Agrícola</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Ventas de cosecha (soya, maíz, trigo, sorgo) u otros ingresos del lote.
              </p>
            </div>

            <form onSubmit={handleIncomeSubmit} className="space-y-4">
              {/* Lote de Origen */}
              <VisualLotPicker
                lots={lots}
                selectedLotId={incLotId}
                onSelect={(id) => setIncLotId(id)}
                label="Lote de Origen"
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
                label="Concepto / Producto de Cosecha"
                required
              />

              {/* Fecha */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
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
                  <label className="block text-xs font-bold text-stone-700 mb-1">Unidad</label>
                  <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
                    {[
                      { val: 'toneladas', label: 'Toneladas (t)' },
                      { val: 'quintales', label: 'Quintales (qq)' },
                      { val: 'kg', label: 'Kilos (kg)' },
                      { val: 'bolsas', label: 'Bolsas' },
                    ].map((u) => {
                      const isSel = incUnidad.toLowerCase().startsWith(u.val.slice(0, 3));
                      return (
                        <button
                          key={u.val}
                          type="button"
                          onClick={() => setIncUnidad(u.val)}
                          className={`py-2 px-1.5 rounded-lg text-[11px] font-semibold text-center transition cursor-pointer select-none ${
                            isSel
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-600 font-extrabold shadow-2xs'
                              : 'bg-white/70 hover:bg-white text-stone-600 border border-transparent font-medium'
                          }`}
                        >
                          {u.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Precio y Moneda */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
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
                  <label className="block text-xs font-bold text-stone-700 mb-1">Moneda</label>
                  <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 gap-1 min-h-[44px] items-center">
                    {[
                      { val: 'USD', label: 'USD ($)' },
                      { val: 'BOB', label: 'BOB (Bs)' },
                    ].map((m) => {
                      const isSel = incMoneda === m.val;
                      return (
                        <button
                          key={m.val}
                          type="button"
                          onClick={() => setIncMoneda(m.val as Currency)}
                          className={`flex-1 py-2 px-2 rounded-lg text-xs transition cursor-pointer select-none ${
                            isSel
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-600 font-extrabold shadow-2xs'
                              : 'bg-white/70 hover:bg-white text-stone-600 border border-transparent font-medium'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Comprador, silo de acopio, condiciones de entrega..."
                  value={incObs}
                  onChange={(e) => setIncObs(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Total Calculado en Moneda Original */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-900">Total Ingreso ({incMoneda}):</span>
                <span className="text-base font-extrabold text-emerald-900 font-mono">
                  {incMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                  {incCalculatedTotal.toLocaleString('es-BO', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 transition disabled:opacity-50 cursor-pointer min-h-[46px]"
                >
                  <Plus className="h-5 w-5" />
                  <span>{saving ? 'Guardando...' : 'Guardar Ingreso'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('main')}
                  className="px-4 py-3.5 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 text-sm font-semibold cursor-pointer min-h-[46px]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FORMULARIO: REGISTRAR GASTO AGRÍCOLA                         */}
      {/* ============================================================ */}
      {currentScreen === 'gasto' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-xs">
            <div className="pb-3 border-b border-stone-100 mb-4">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-rose-700" />
                <span>Registrar Gasto Agrícola</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Insumos directos asignados a un lote: semillas, fertilizantes, defensivos, etc.
              </p>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              {/* Lote Destino */}
              <VisualLotPicker
                lots={lots}
                selectedLotId={expLotId}
                onSelect={(id) => setExpLotId(id)}
                label="Lote Destino"
                required
              />

              {/* Selector Visual de Insumo / Rubro */}
              <VisualExpenseItemPicker
                items={propertyExpenseItems}
                selectedItemName={expItem}
                onSelectItem={(item) => {
                  setExpItem(item.nombre);
                  if (item.unidad) setExpUnidad(item.unidad);
                  if (item.precioDefecto) setExpPrecio(item.precioDefecto);
                  if (item.moneda) setExpMoneda(item.moneda);
                }}
                label="Insumo o Concepto de Gasto"
                defaultIcon="semillas"
                required
              />

              {/* Fecha */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
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
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Cantidad <span className="text-red-500">*</span>
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
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Unidad</label>
                  <select
                    value={expUnidad}
                    onChange={(e) => setExpUnidad(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none min-h-[44px]"
                  >
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="litros">Litros (l)</option>
                    <option value="bolsas">Bolsas</option>
                    <option value="toneladas">Toneladas (t)</option>
                    <option value="unidades">Unidades</option>
                  </select>
                </div>
              </div>

              {/* Precio y Moneda */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
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
                  <label className="block text-xs font-bold text-stone-700 mb-1">Moneda</label>
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

              {/* Observación */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Dosis aplicada, proveedor, factura o remisión..."
                  value={expObs}
                  onChange={(e) => setExpObs(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-rose-600 focus:outline-none"
                />
              </div>

              {/* Total Calculado en Moneda Original */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-xs font-bold text-rose-900">Total Gasto ({expMoneda}):</span>
                <span className="text-base font-extrabold text-rose-900 font-mono">
                  {expMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                  {expCalculatedTotal.toLocaleString('es-BO', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3.5 text-sm font-bold text-white shadow-xs hover:bg-rose-700 active:bg-rose-800 transition disabled:opacity-50 cursor-pointer min-h-[46px]"
                >
                  <Plus className="h-5 w-5" />
                  <span>{saving ? 'Guardando...' : 'Guardar Gasto'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('main')}
                  className="px-4 py-3.5 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 text-sm font-semibold cursor-pointer min-h-[46px]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. MIS LOTES (UNIFICADO CON EL RESUMEN POR LOTE - ACCORDION) */}
      {/* ============================================================ */}
      {currentScreen === 'lotes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">Mis lotes</h2>
              <p className="text-xs text-slate-500">
                Superficie total:{' '}
                <strong className="text-emerald-700">
                  {lots
                    .reduce((sum, l) => sum + (Number(l.superficieHectareas) || 0), 0)
                    .toFixed(1)}{' '}
                  hectáreas
                </strong>
              </p>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
              {lots.length} lotes
            </span>
          </div>

          <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/70 text-xs text-emerald-900 leading-relaxed flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>
              Toca cualquier lote para desplegar su detalle completo: labores de maquinaria, cosechas, insumos y cálculos económicos.
            </span>
          </div>

          {/* Listado de Lotes con Acordeón Expandible */}
          <div className="space-y-3">
            {lots.map((lot) => {
              const isExpanded = expandedLotId === lot.id;
              const lotMachineryJobs = linkedPropertyJobs.filter((j) => j.loteId === lot.id);
              const lotIncomes = propertyIncomes.filter((i) => i.loteId === lot.id);
              const lotExpensesDirect = propertyExpenses.filter(
                (e) => e.loteId === lot.id && !e.esTrabajoPropio && !e.trabajoId
              );

              const hrs = lotMachineryJobs
                .filter((j) => j.unidad === 'hora' || (j.unidad as string) === 'h')
                .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);
              const ha = lotMachineryJobs
                .filter((j) => j.unidad === 'hectarea' || (j.unidad as string) === 'ha')
                .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

              return (
                <div
                  key={lot.id}
                  className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedLotId(isExpanded ? null : lot.id)}
                    className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50 active:bg-slate-100 min-h-[64px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">
                          {lot.nombre}
                        </h3>
                        {lot.cultivoActual && (
                          <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2.5 py-0.5 rounded-lg font-semibold shrink-0">
                            {lot.cultivoActual}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-emerald-700 mt-1">
                        {lot.superficieHectareas} Hectáreas
                        {lot.ubicacion && (
                          <span className="text-slate-500 font-normal ml-2">&bull; {lot.ubicacion}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-slate-400 p-2 shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-emerald-700" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </button>

                  {/* Detalle Acordeón Completo del Lote */}
                  {isExpanded && (
                    <div className="px-4 pb-5 pt-2 border-t border-slate-100 space-y-3.5 bg-slate-50/60 text-xs">
                      {/* 1. Datos Agronómicos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-slate-200/60">
                        <div>
                          <span className="text-[11px] text-slate-400 block font-semibold">SUPERFICIE</span>
                          <span className="font-bold text-slate-900 text-sm">{lot.superficieHectareas} ha</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block font-semibold">CULTIVO ACTUAL</span>
                          <span className="font-bold text-emerald-800 text-sm">{lot.cultivoActual || 'Sin cultivo'}</span>
                        </div>
                        {lot.ubicacion && (
                          <div className="col-span-full">
                            <span className="text-[11px] text-slate-400 block font-semibold">UBICACIÓN</span>
                            <span className="text-slate-700">{lot.ubicacion}</span>
                          </div>
                        )}
                        {lot.observaciones && (
                          <div className="col-span-full">
                            <span className="text-[11px] text-slate-400 block font-semibold">NOTAS AGRONÓMICAS</span>
                            <span className="text-slate-600 italic">{lot.observaciones}</span>
                          </div>
                        )}
                      </div>

                      {/* 2. Trabajos de Maquinaria Recibidos */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Tractor className="h-4 w-4 text-amber-600" />
                            <span>Trabajos de Maquinaria ({lotMachineryJobs.length})</span>
                          </span>
                          <span className="font-mono font-bold text-amber-900 text-[11px]">
                            {hrs > 0 ? `${hrs.toFixed(1)} h` : ''}
                            {hrs > 0 && ha > 0 ? ' / ' : ''}
                            {ha > 0 ? `${ha.toFixed(1)} ha` : ''}
                            {hrs === 0 && ha === 0 ? '0 h' : ''}
                          </span>
                        </div>

                        {lotMachineryJobs.length > 0 ? (
                          <div className="space-y-1.5 pt-1">
                            {lotMachineryJobs.map((j) => (
                              <div
                                key={j.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 border border-amber-100/70"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-md bg-white border border-amber-200/80 flex items-center justify-center shrink-0">
                                    <VisualIcon name={j.icono || 'tractor'} size="xs" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-800 block truncate">
                                      {j.maquinariaNombre}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      {formatDateDDMMAAAA(j.fecha)} &bull; {j.cantidad} {j.unidad}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-bold font-mono text-rose-700 shrink-0 ml-2">
                                  {j.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                  {j.total.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic pt-1">
                            Sin labores de maquinaria en esta campaña.
                          </p>
                        )}
                      </div>

                      {/* 3. Cosechas e Ingresos del Lote */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Wheat className="h-4 w-4 text-emerald-600" />
                            <span>Cosechas e Ingresos ({lotIncomes.length})</span>
                          </span>
                          <span className="font-mono font-bold text-emerald-800 text-[11px]">
                            {lotIncomes.reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0).toFixed(1)} t
                          </span>
                        </div>

                        {lotIncomes.length > 0 ? (
                          <div className="space-y-1.5 pt-1">
                            {lotIncomes.map((i) => (
                              <div
                                key={i.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 border border-emerald-100/70"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-md bg-white border border-emerald-200/80 flex items-center justify-center shrink-0">
                                    <VisualIcon name="granos" size="xs" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-800 block truncate">{i.concepto}</span>
                                    <span className="text-[11px] text-slate-500">
                                      {formatDateDDMMAAAA(i.fecha)} &bull; {i.cantidad} {i.unidad}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-bold font-mono text-emerald-700 shrink-0 ml-2">
                                  + {i.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                  {i.total.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic pt-1">
                            Sin ingresos o cosechas registradas aún.
                          </p>
                        )}
                      </div>

                      {/* 4. Gastos e Insumos Directos */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Receipt className="h-4 w-4 text-rose-600" />
                            <span>Insumos y Gastos Directos ({lotExpensesDirect.length})</span>
                          </span>
                        </div>

                        {lotExpensesDirect.length > 0 ? (
                          <div className="space-y-1.5 pt-1">
                            {lotExpensesDirect.map((e) => (
                              <div
                                key={e.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-rose-50/40 border border-rose-100/70"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-md bg-white border border-rose-200/80 flex items-center justify-center shrink-0">
                                    <VisualIcon name={e.icono || (itemsConfig.find(it => it.nombre.toLowerCase() === e.itemGasto.toLowerCase())?.icono) || 'semillas'} size="xs" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-800 block truncate">{e.itemGasto}</span>
                                    <span className="text-[11px] text-slate-500">
                                      {formatDateDDMMAAAA(e.fecha)} &bull; {e.cantidad} {e.unidad}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-bold font-mono text-rose-700 shrink-0 ml-2">
                                  - {e.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                                  {e.total.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic pt-1">
                            Sin insumos directos registrados en este lote.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {lots.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200/80">
                No hay lotes registrados aún.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. TRABAJOS DE MAQUINARIA RECIBIDOS EN PROPIEDAD             */}
      {/* ============================================================ */}
      {currentScreen === 'maquinaria_recibida' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Trabajos de maquinaria
              </h2>
              <p className="text-xs text-slate-500">
                Labores asignadas a lotes de la propiedad
              </p>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-xl">
              {linkedPropertyJobs.length} labores
            </span>
          </div>

          <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/70 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Costos automáticos:</strong> Estos trabajos provienen de labores realizadas por la maquinaria propia en los lotes. Para editar o eliminar un trabajo, debes gestionarlo desde la pestaña <strong>Maquinarias</strong>.
            </span>
          </div>

          <div className="space-y-3">
            {linkedPropertyJobs.map((j) => (
              <div
                key={j.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2.5 shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                      <VisualIcon name={j.icono || 'tractor'} size="xs" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        {formatDateDDMMAAAA(j.fecha)}
                      </span>
                      <span className="text-[11px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md ml-2">
                        {j.maquinariaNombre}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                    Maq. Propia
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Lote Destino:</span>
                    <span className="font-bold text-emerald-800 text-sm">
                      {j.loteNombre || 'Lote'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Labor Realizada:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {j.cantidad} {j.unidad}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Tarifa: <span className="font-semibold text-slate-700">{j.moneda === 'USD' ? 'USD' : 'Bs'} {j.tarifa}/{j.unidad}</span>
                </div>

                {j.observacion && (
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-xl border border-slate-200/60 break-words">
                    {j.observacion}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Costo Asignado al Lote
                  </span>
                  <div className="text-right">
                    <span className="text-base font-bold font-mono text-rose-700 block">
                      - {j.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                      {j.total.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {j.tipoCambio && j.tipoCambio > 0 && (
                      <span className="text-[11px] text-slate-400 font-medium block">
                        {j.moneda === 'USD'
                          ? `equiv. Bs ${(j.total * j.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (TC: ${j.tipoCambio})`
                          : `equiv. USD ${(j.total / j.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (TC: ${j.tipoCambio})`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {linkedPropertyJobs.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200/80">
                No hay trabajos de maquinaria propia asignados a lotes en esta campaña.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. MOVIMIENTOS DE PROPIEDAD (HISTORIAL CON EDITAR Y ELIMINAR)*/}
      {/* ============================================================ */}
      {currentScreen === 'historial' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5">
            {/* Header info */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Movimientos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ingresos, cosechas y gastos directos ({filteredMovements.length} registros)
                </p>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl shrink-0">
                {filteredMovements.length} registros
              </span>
            </div>

            {/* Filtros: Búsqueda y Pestañas Segmentadas iOS */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por lote, concepto o detalle..."
                  value={historialSearch}
                  onChange={(e) => setHistorialSearch(e.target.value)}
                  className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                />
              </div>

              {/* Segmented Control iOS: Todos, Ingresos, Gastos directos, Maquinaria */}
              <div className="flex p-1 bg-slate-100 rounded-xl gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setHistorialFilter('todos')}
                  className={`flex-1 min-h-[38px] px-2 text-xs font-bold rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                    historialFilter === 'todos'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({allMovements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('ingresos')}
                  className={`flex-1 min-h-[38px] px-2 text-xs font-bold rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                    historialFilter === 'ingresos'
                      ? 'bg-white text-emerald-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ingresos ({propertyIncomes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('gastos')}
                  className={`flex-1 min-h-[38px] px-2 text-xs font-bold rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                    historialFilter === 'gastos'
                      ? 'bg-white text-rose-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gastos directos ({propertyExpenses.filter((e) => !e.esTrabajoPropio && !e.trabajoId).length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistorialFilter('maquinaria')}
                  className={`flex-1 min-h-[38px] px-2 text-xs font-bold rounded-lg transition cursor-pointer text-center whitespace-nowrap ${
                    historialFilter === 'maquinaria'
                      ? 'bg-white text-amber-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Maquinaria ({linkedPropertyJobs.length})
                </button>
              </div>
            </div>

            {/* Listado Compacto de Movimientos estilo iOS Card */}
            <div className="space-y-2.5 pt-1">
              {filteredMovements.map((m) => {
                const isExpanded = expandedMovementId === m.id;

                return (
                  <div
                    key={`${m.tipo}-${m.id}`}
                    className={`rounded-2xl border transition overflow-hidden ${
                      isExpanded
                        ? 'border-slate-300 bg-slate-50/70 shadow-xs'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Fila compacta clicable */}
                    <button
                      type="button"
                      onClick={() => setExpandedMovementId(isExpanded ? null : m.id)}
                      className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left transition cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border ${
                            m.tipo === 'ingreso'
                              ? 'bg-emerald-50 border-emerald-200/80'
                              : m.tipo === 'gasto_directo'
                              ? 'bg-rose-50 border-rose-200/80'
                              : 'bg-amber-50 border-amber-200/80'
                          }`}
                        >
                          <VisualIcon
                            name={m.icono || (m.tipo === 'ingreso' ? 'granos' : m.tipo === 'gasto_directo' ? 'semillas' : 'tractor')}
                            size="sm"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {m.titulo}
                            </h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                                m.tipo === 'ingreso'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : m.tipo === 'gasto_directo'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {m.tipo === 'ingreso'
                                ? 'Ingreso Cosecha'
                                : m.tipo === 'gasto_directo'
                                ? 'Gasto Directo'
                                : 'Maq. Propia'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                            <span className="font-semibold text-slate-600">{formatDateDDMMAAAA(m.fecha)}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-emerald-800 truncate">Lote: {m.loteNombre}</span>
                            {m.cantidad !== undefined && m.cantidad > 0 && (
                              <>
                                <span>&bull;</span>
                                <span className="font-medium text-slate-600 truncate">{m.cantidad} {m.unidad || ''}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span
                            className={`text-sm sm:text-base font-bold font-mono block ${
                              m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {m.tipo === 'ingreso' ? '+ ' : '- '}
                            {m.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                            {m.monto.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-slate-400 pl-1">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Desplegable de Detalles */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-200/70 space-y-3 bg-white/60">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Tipo</span>
                            <span className="font-semibold text-slate-700">
                              {m.tipo === 'ingreso' ? 'Ingreso de cosecha' : m.tipo === 'gasto_directo' ? 'Gasto directo agrícola' : 'Labor maquinaria propia'}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Lote asignado</span>
                            <span className="font-semibold text-slate-700">{m.loteNombre}</span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Cantidad y Unidad</span>
                            <span className="font-semibold text-slate-700">
                              {m.cantidad ? `${m.cantidad} ${m.unidad || ''}` : 'No especificada'}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Equivalencia Moneda</span>
                            <span className="font-semibold text-slate-700">
                              {m.tipoCambio && m.tipoCambio > 0 ? (
                                m.moneda === 'USD'
                                  ? `Bs ${(m.monto * m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : `USD ${(m.monto / m.tipoCambio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              ) : (
                                'TC no registrado'
                              )}
                            </span>
                          </div>
                        </div>

                        {m.detalle && (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Observación / Detalle</span>
                            <p className="text-slate-700 mt-0.5 break-words font-medium">{m.detalle}</p>
                          </div>
                        )}

                        {/* Botones de acción Editar y Eliminar */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                          {(m.tipo === 'gasto_directo' || m.tipo === 'ingreso') && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditMovement(m)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition cursor-pointer min-h-[38px]"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-slate-600" />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  m.tipo === 'gasto_directo'
                                    ? handlePromptDeleteExp(m.id, m.titulo)
                                    : handlePromptDeleteInc(m.id, m.titulo)
                                }
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 transition cursor-pointer min-h-[38px]"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                <span>Eliminar</span>
                              </button>
                            </>
                          )}

                          {m.tipo === 'maquinaria_recibida' && (
                            <span className="text-xs text-slate-400 italic bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                              Labor registrada en Maquinarias. Gestionar en el módulo de Maquinarias.
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredMovements.length === 0 && (
                <div className="py-10 text-center text-xs text-slate-400">
                  No se encontraron movimientos registrados con los filtros seleccionados.
                </div>
              )}
            </div>
          </div>
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

            <form onSubmit={handleSaveEditMovement} className="space-y-3.5 overflow-y-auto flex-1 pr-1">
              {/* Fecha */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={editFecha}
                  onChange={(e) => setEditFecha(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                />
              </div>

              {/* Lote */}
              <div>
                <VisualLotPicker
                  lots={lots}
                  selectedLotId={editLotId}
                  onSelect={(id) => setEditLotId(id)}
                  label="Lote"
                  required
                />
              </div>

              {/* Concepto / Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Concepto / Descripción <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editConcepto}
                  onChange={(e) => setEditConcepto(e.target.value)}
                  placeholder="Ej. Semillas de Soya, Venta Cosecha..."
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                />
              </div>

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cantidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0.01"
                    value={editCantidad}
                    onChange={(e) => setEditCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unidad</label>
                  <input
                    type="text"
                    value={editUnidad}
                    onChange={(e) => setEditUnidad(e.target.value)}
                    placeholder="kg, toneladas, bolsas..."
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Precio Unitario y Moneda */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Precio Unitario <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0"
                    value={editPrecio}
                    onChange={(e) => setEditPrecio(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-semibold min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Moneda</label>
                  <select
                    value={editMoneda}
                    onChange={(e) => setEditMoneda(e.target.value as Currency)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                  >
                    <option value="BOB">BOB (Bs)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Tipo de Cambio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Cambio (Bs/$)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={editTc}
                  onChange={(e) => setEditTc(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="6.96"
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={editObs}
                  onChange={(e) => setEditObs(e.target.value)}
                  placeholder="Notas adicionales..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Total Calculado en Moneda Original */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-xs font-bold text-slate-700">Total recalculado:</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">
                  {editMoneda === 'USD' ? 'USD' : 'Bs'}{' '}
                  {(Number(editCantidad || 0) * Number(editPrecio || 0)).toLocaleString('es-BO', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Botones Guardar / Cancelar */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingMovement(null)}
                  className="w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer min-h-[46px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 min-h-[46px] flex items-center justify-center gap-1.5"
                >
                  {savingEdit ? 'Guardando en servidor...' : 'Guardar Cambios'}
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
    </div>
  );
};
