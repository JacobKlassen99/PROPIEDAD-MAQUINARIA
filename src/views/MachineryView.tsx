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
} from '../types';
import {
  createMachineryJob,
  updateMachineryJob,
  deleteMachineryJob,
  createExpense,
  deleteExpense,
  formatDateDDMMAAAA,
  isTechnicalId,
  NEW_HOLLAND_DEFAULT_JOBS,
} from '../services/backend';
import { VisualIcon } from '../components/VisualIcon';
import {
  VisualMachinePicker,
  VisualJobTypePicker,
  VisualExpenseItemPicker,
  VisualLotPicker,
} from '../components/VisualEntityPicker';

interface Props {
  activeCampaign: Campaign | null;
  machines: Machine[];
  machineJobTypes?: MachineJobType[];
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
  machineJobTypes = [],
  lots,
  jobs,
  expenses,
  itemsConfig = [],
  currency,
  exchangeRate,
  onRefreshData,
}) => {
  const [currentScreen, setCurrentScreen] = useState<MachineryScreen>('main');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & type filter for Movimientos (Ingresos y Gastos)
  const [searchTerm, setSearchTerm] = useState('');
  const [historialFilter, setHistorialFilter] = useState<'todos' | 'ingresos' | 'gastos'>('todos');
  const [serviciosSubFilter, setServiciosSubFilter] = useState<'todos' | 'terceros' | 'propiedad'>('todos');
  const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  // Form State for Machinery Job
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string>('');
  const [selectedJobNombre, setSelectedJobNombre] = useState<string>('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [cliente, setCliente] = useState('');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tarifa, setTarifa] = useState<number | ''>('');
  const [unidad, setUnidad] = useState<'hora' | 'hectarea'>('hora');
  const [jobMoneda, setJobMoneda] = useState<Currency>('BOB');
  const [observacion, setObservacion] = useState('');

  // Accordion state for machines in resumen
  const [expandedMachineId, setExpandedMachineId] = useState<string | null>(null);

  // Form State for Machinery Expense
  const [expMachineId, setExpMachineId] = useState('');
  const [expItemGasto, setExpItemGasto] = useState('Combustible');
  const [expCantidad, setExpCantidad] = useState<number | ''>(1);
  const [expUnidad, setExpUnidad] = useState('litros');
  const [expPrecio, setExpPrecio] = useState<number | ''>('');
  const [expFecha, setExpFecha] = useState(new Date().toISOString().slice(0, 10));
  const [expMoneda, setExpMoneda] = useState<Currency>('BOB');
  const [expObservacion, setExpObservacion] = useState('');

  // Editing Job State (iOS Modal)
  const [editingJob, setEditingJob] = useState<MachineryJob | null>(null);
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
  const [editObservacion, setEditObservacion] = useState('');

  // Deleting Job State (iOS Confirmation Modal)
  const [jobToDelete, setJobToDelete] = useState<MachineryJob | null>(null);
  const [deletingJob, setDeletingJob] = useState(false);

  const getAvailableJobsForMachine = (mId: string): MachineJobType[] => {
    if (!mId) return [];
    const m = machines.find((item) => item.id === mId);
    let list = (machineJobTypes || []).filter((j) => String(j.maquinaId) === String(mId) && j.activo !== false);
    if (list.length === 0 && m?.trabajos && m.trabajos.length > 0) {
      list = m.trabajos.filter((j) => j.activo !== false);
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

  const getMachineSubtitle = (m: Machine) => {
    if (m.identificacion && !isTechnicalId(m.identificacion) && m.identificacion !== m.id && m.identificacion !== m.nombre) {
      return `${m.identificacion} • ${m.tipo || 'Equipo'}`;
    }
    return m.tipo || 'Equipo';
  };

  const getMachineOptionLabel = (m: Machine, includeRate = false) => {
    const alias = (!isTechnicalId(m.identificacion) && m.identificacion !== m.id && m.identificacion !== m.nombre)
      ? ` (${m.identificacion})`
      : (m.tipo ? ` (${m.tipo})` : '');
    const rateStr = includeRate ? ` — ${m.moneda === 'USD' ? 'USD' : 'Bs'} ${m.tarifa}/${m.unidad}` : '';
    return `${m.nombre}${alias}${rateStr}`;
  };

  const handleMachineChange = (mId: string) => {
    setSelectedMachineId(mId);
    const availableJobs = getAvailableJobsForMachine(mId);
    if (availableJobs.length > 0) {
      const firstJob = availableJobs[0];
      setSelectedJobTypeId(firstJob.id);
      setSelectedJobNombre(firstJob.nombre);
      setTarifa(firstJob.tarifa);
      setUnidad(firstJob.unidad === 'ha' || firstJob.unidad === 'hectarea' ? 'hectarea' : 'hora');
      setJobMoneda(firstJob.moneda);
    } else {
      setSelectedJobTypeId('');
      setSelectedJobNombre('');
      const m = machines.find((item) => item.id === mId);
      if (m) {
        setTarifa(m.tarifa || 0);
        setUnidad((m.unidad === 'ha' || m.unidad === 'hectarea') ? 'hectarea' : 'hora');
        setJobMoneda(m.moneda || 'BOB');
      }
    }
  };

  const handleJobTypeChange = (jobId: string) => {
    setSelectedJobTypeId(jobId);
    const availableJobs = getAvailableJobsForMachine(selectedMachineId);
    const jobDef = availableJobs.find((j) => j.id === jobId);
    if (jobDef) {
      setSelectedJobNombre(jobDef.nombre);
      setTarifa(jobDef.tarifa);
      setUnidad(jobDef.unidad === 'ha' || jobDef.unidad === 'hectarea' ? 'hectarea' : 'hora');
      setJobMoneda(jobDef.moneda);
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
        trabajoTipoId: selectedJobTypeId || undefined,
        trabajoNombre: selectedJobNombre || undefined,
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
      setCurrentScreen('main');
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
      setCurrentScreen('main');
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el gasto');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditJob = (j: MachineryJob) => {
    setEditingJob(j);
    setEditFecha(j.fecha ? j.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditMachineId(j.maquinariaId || '');
    setEditJobTypeId(j.trabajoTipoId || '');
    setEditJobNombre(j.trabajoNombre || '');
    setEditTipoTrabajo(j.tipoTrabajo || 'tercero');
    setEditCliente(j.cliente || '');
    setEditLotId(j.loteId || '');
    setEditCantidad(j.cantidad ?? '');
    setEditUnidad(j.unidad === 'hectarea' || (j.unidad as string) === 'ha' ? 'hectarea' : 'hora');
    setEditTarifa(j.tarifa ?? '');
    setEditMoneda(j.moneda || 'BOB');
    setEditObservacion(j.observacion || '');
  };

  const handleSaveEditJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!editMachineId) {
      setErrorMsg('Selecciona una maquinaria.');
      return;
    }
    if (editTipoTrabajo === 'propiedad' && !editLotId) {
      setErrorMsg('Para trabajos en propiedad, el lote es obligatorio.');
      return;
    }
    if (!editCantidad || Number(editCantidad) <= 0) {
      setErrorMsg('La cantidad trabajada debe ser mayor a 0.');
      return;
    }

    const machineObj = machines.find((m) => m.id === editMachineId);
    const lotObj = lots.find((l) => l.id === editLotId);
    const cantNum = Number(editCantidad);
    const tarifaNum = Number(editTarifa) || 0;
    const totalNum = cantNum * tarifaNum;

    setSaving(true);
    try {
      await updateMachineryJob(editingJob.id, {
        fecha: editFecha,
        maquinariaId: editMachineId,
        maquinariaNombre: machineObj?.nombre || editingJob.maquinariaNombre,
        trabajoTipoId: editJobTypeId || undefined,
        trabajoNombre: editJobNombre || undefined,
        tipoTrabajo: editTipoTrabajo,
        cliente: editTipoTrabajo === 'tercero' ? editCliente.trim() : undefined,
        loteId: editTipoTrabajo === 'propiedad' ? editLotId : undefined,
        loteNombre: editTipoTrabajo === 'propiedad' ? lotObj?.nombre : undefined,
        cantidad: cantNum,
        unidad: editUnidad,
        tarifa: tarifaNum,
        moneda: editMoneda,
        total: totalNum,
        observacion: editObservacion.trim(),
      });
      setSuccessMsg('Trabajo actualizado exitosamente.');
      setEditingJob(null);
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar el trabajo');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) return;
    setDeletingJob(true);
    setErrorMsg(null);
    try {
      await deleteMachineryJob(jobToDelete.id);
      setSuccessMsg('Trabajo eliminado exitosamente.');
      setJobToDelete(null);
      onRefreshData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar el trabajo');
    } finally {
      setDeletingJob(false);
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

  const machineryExpenseItems = (itemsConfig || []).filter(
    (item) =>
      item.activo !== false &&
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

  // All machinery movements: Includes ALL jobs (propiedad + tercero) and machinery expenses
  const allMachineryMovements: MachineryMovementItem[] = [
    ...jobs.map((j) => ({
      id: j.id,
      kind: 'servicio' as const,
      tipoTrabajo: j.tipoTrabajo,
      fecha: j.fecha,
      titulo: j.trabajoNombre || 'Labor de maquinaria',
      maquinariaNombre: j.maquinariaNombre || 'Maquinaria',
      destinoOCliente:
        j.tipoTrabajo === 'propiedad'
          ? (j.loteNombre ? `Lote: ${j.loteNombre}` : 'Lote propio')
          : (j.cliente ? `Cliente: ${j.cliente}` : 'Cliente externo'),
      cantidadTexto: `${j.cantidad} ${j.unidad === 'hectarea' || (j.unidad as string) === 'ha' ? 'ha' : 'h'}`,
      total: j.total,
      moneda: (j.moneda || 'BOB') as Currency,
      tipoCambio: j.tipoCambio,
      tarifaOPrecio: j.tarifa,
      unidad: j.unidad === 'hectarea' || (j.unidad as string) === 'ha' ? 'ha' : 'hora',
      observacion: j.observacion,
      icono: j.icono || 'tractor',
      creadoEn: j.creadoEn,
      rawJob: j,
    })),
    ...machineryExpenses.map((e) => ({
      id: e.id,
      kind: 'gasto' as const,
      fecha: e.fecha,
      titulo: e.itemGasto || 'Gasto',
      maquinariaNombre: e.maquinariaNombre ? `Equipo: ${e.maquinariaNombre}` : 'Gasto general',
      destinoOCliente: e.maquinariaNombre || 'General',
      cantidadTexto: e.cantidad ? `${e.cantidad} ${e.unidad || ''}`.trim() : undefined,
      total: e.total,
      moneda: ((e.moneda as Currency) || 'BOB') as Currency,
      tipoCambio: e.tipoCambio,
      tarifaOPrecio: e.precio,
      unidad: e.unidad,
      observacion: e.observacion,
      icono: e.icono || e.itemGasto || 'repuestos',
      creadoEn: e.creadoEn,
      rawExpense: e,
    })),
  ].sort((a, b) => {
    const timeA = a.creadoEn ? new Date(a.creadoEn).getTime() : new Date(a.fecha).getTime();
    const timeB = b.creadoEn ? new Date(b.creadoEn).getTime() : new Date(b.fecha).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return (b.id || '').localeCompare(a.id || '');
  });

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
      {/* iOS Subscreen Navigation Bar with Back Button */}
      {currentScreen !== 'main' && (
        <div className="flex items-center gap-3 pb-2 border-b border-slate-200/80">
          <button
            type="button"
            onClick={() => setCurrentScreen('main')}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-slate-800 hover:bg-slate-100 flex items-center gap-2 font-bold text-sm transition active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-700" />
            <span>Volver</span>
          </button>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
            {currentScreen === 'historial' && 'Movimientos'}
            {currentScreen === 'resumen' && 'Máquinas'}
            {currentScreen === 'gasto' && 'Registrar Gasto de Maquinaria'}
            {currentScreen === 'ingreso_opciones' && 'Tipo de Servicio'}
            {currentScreen === 'servicio_otros' && 'Servicio para otros'}
            {currentScreen === 'trabajo_propiedad' && 'Trabajo en propiedad'}
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
      {/* VISTA PRINCIPAL (MAIN): REGISTRAR Y CONSULTAR SEPARADOS       */}
      {/* ============================================================ */}
      {currentScreen === 'main' && (
        <div className="space-y-5">
          {/* SECCIÓN A: REGISTRAR MOVIMIENTO */}
          <div className="space-y-2">
            <h2 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase px-1">
              REGISTRAR MOVIMIENTO
            </h2>

            {/* Dos botones compactos estilo iOS: SERVICIO (Verde John Deere) y GASTO (Rojo claro) */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {/* Botón SERVICIO */}
              <button
                type="button"
                onClick={() => setCurrentScreen('ingreso_opciones')}
                className="w-full min-h-[70px] sm:min-h-[74px] p-3 rounded-2xl bg-[#367C2B] hover:bg-[#2e6b25] active:bg-[#26581e] text-white shadow-xs border border-[#367C2B]/20 flex flex-col items-center justify-center gap-0.5 transition active:scale-[0.98] cursor-pointer select-none"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <CirclePlus className="h-4 w-4 text-white shrink-0" />
                  <span className="text-sm sm:text-base font-bold tracking-tight text-white">
                    Servicio
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs text-white/90 font-medium text-center truncate max-w-full px-1">
                  Servicio o labor
                </span>
              </button>

              {/* Botón GASTO */}
              <button
                type="button"
                onClick={() => setCurrentScreen('gasto')}
                className="w-full min-h-[70px] sm:min-h-[74px] p-3 rounded-2xl bg-[#FCE8E8] hover:bg-[#f8d7d7] active:bg-[#f4c6c6] text-[#B42323] shadow-xs border border-[#f3c2c2] flex flex-col items-center justify-center gap-0.5 transition active:scale-[0.98] cursor-pointer select-none"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <CircleMinus className="h-4 w-4 text-[#B42323] shrink-0" />
                  <span className="text-sm sm:text-base font-bold tracking-tight text-[#B42323]">
                    Gasto
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs text-[#B42323]/80 font-medium text-center truncate max-w-full px-1">
                  Combustible y repuestos
                </span>
              </button>
            </div>
          </div>

          {/* SECCIÓN B: CONSULTAR REGISTROS (1. Movimientos, 2. Máquinas) */}
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
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        Movimientos
                      </h3>
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full shrink-0">
                        {allMachineryMovements.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Trabajos en propiedad, servicios a terceros y gastos
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </button>

              {/* Opción 2: Máquinas */}
              <button
                type="button"
                onClick={() => setCurrentScreen('resumen')}
                className="w-full bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs hover:bg-slate-50 active:scale-[0.99] transition cursor-pointer text-left min-h-[68px]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
                    <Tractor className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug truncate">
                        Máquinas
                      </h3>
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full shrink-0">
                        {machines.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Horas, hectáreas y rendimiento por equipo
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
              {/* Maquinaria con selector visual e icono */}
              <VisualMachinePicker
                label="Maquinaria *"
                machines={machines}
                selectedMachineId={selectedMachineId}
                onSelectMachine={(m) => handleMachineChange(m.id)}
                required
              />

              {/* Tipo de Trabajo / Implemento con selector visual */}
              {selectedMachineId && (
                <div>
                  {getAvailableJobsForMachine(selectedMachineId).length > 0 ? (
                    <div className="space-y-1.5">
                      <VisualJobTypePicker
                        label="Tipo de Trabajo / Labor *"
                        jobTypes={getAvailableJobsForMachine(selectedMachineId)}
                        selectedJobTypeId={selectedJobTypeId}
                        onSelectJobType={(j) => handleJobTypeChange(j.id)}
                        required
                      />
                      <p className="text-[11px] text-emerald-800 font-medium">
                        Tarifa, moneda y unidad asignadas automáticamente. Puedes modificar la tarifa si se pactó un precio diferente.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Tipo de Trabajo / Labor <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Siembra, Arada, Rastra..."
                        value={selectedJobNombre}
                        onChange={(e) => setSelectedJobNombre(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                      />
                    </div>
                  )}
                </div>
              )}

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
              {/* Lote (Obligatorio) con selector visual estilo iOS */}
              <VisualLotPicker
                lots={lots}
                selectedLotId={selectedLotId}
                onSelect={(id) => setSelectedLotId(id)}
                label="Lote de Destino"
                required
              />

              {/* Maquinaria con selector visual e icono */}
              <VisualMachinePicker
                label="Maquinaria *"
                machines={machines}
                selectedMachineId={selectedMachineId}
                onSelectMachine={(m) => handleMachineChange(m.id)}
                required
              />

              {/* Tipo de Trabajo / Implemento con selector visual */}
              {selectedMachineId && (
                <div>
                  {getAvailableJobsForMachine(selectedMachineId).length > 0 ? (
                    <div className="space-y-1.5">
                      <VisualJobTypePicker
                        label="Tipo de Trabajo / Labor *"
                        jobTypes={getAvailableJobsForMachine(selectedMachineId)}
                        selectedJobTypeId={selectedJobTypeId}
                        onSelectJobType={(j) => handleJobTypeChange(j.id)}
                        required
                      />
                      <p className="text-[11px] text-emerald-800 font-medium">
                        Tarifa, moneda y unidad asignadas automáticamente. Puedes modificar la tarifa si se pactó un precio diferente.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Tipo de Trabajo / Labor <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Siembra, Arada, Rastra..."
                        value={selectedJobNombre}
                        onChange={(e) => setSelectedJobNombre(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                      />
                    </div>
                  )}
                </div>
              )}

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
              {/* Maquinaria Asignada con selector visual */}
              <VisualMachinePicker
                label="Maquinaria Asignada (Opcional si es general)"
                machines={machines}
                selectedMachineId={expMachineId}
                onSelectMachine={(m) => setExpMachineId(m.id)}
                allowNone
                noneLabel="-- Gasto General / Sin asignar a equipo --"
              />

              {/* Rubro / Concepto de Gasto con selector visual e iconos */}
              <VisualExpenseItemPicker
                label="Rubro / Concepto de Gasto *"
                items={machineryExpenseItems}
                selectedItemName={expItemGasto}
                onSelectItem={(item) => {
                  setExpItemGasto(item.nombre);
                  if (item.unidad) setExpUnidad(item.unidad);
                  if (item.precioPredeterminado && !expPrecio) setExpPrecio(item.precioPredeterminado);
                  if (item.moneda) setExpMoneda(item.moneda);
                }}
                required
              />

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
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white border border-stone-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                      <VisualIcon name={exp.icono || exp.itemGasto || 'repuestos'} size="sm" />
                    </div>
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
      {/* CONSULTA: MOVIMIENTOS (SERVICIOS Y GASTOS)                   */}
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
                  Labores en propiedad, servicios y gastos ({filteredMachineryMovements.length} registros)
                </p>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl shrink-0">
                {filteredMachineryMovements.length} registros
              </span>
            </div>

            {/* Filtros: Búsqueda y Dos Grupos Diferenciados iOS */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por equipo, concepto, cliente o lote..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                />
              </div>

              {/* PRIMER GRUPO: TIPO DE MOVIMIENTO */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block px-0.5">
                  Tipo de movimiento
                </span>
                <div className="grid grid-cols-3 gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setHistorialFilter('todos');
                      setServiciosSubFilter('todos');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs transition cursor-pointer min-h-[42px] select-none ${
                      historialFilter === 'todos'
                        ? 'bg-emerald-50 border-2 border-[#367C2B] text-[#367C2B] font-bold shadow-2xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <ClipboardList className={`h-4 w-4 shrink-0 ${historialFilter === 'todos' ? 'text-[#367C2B]' : 'text-slate-500'}`} />
                    <span className="truncate">Todos ({allMachineryMovements.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHistorialFilter('ingresos');
                      setServiciosSubFilter('todos');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs transition cursor-pointer min-h-[42px] select-none ${
                      historialFilter === 'ingresos' || (historialFilter as string) === 'servicios'
                        ? 'bg-emerald-50 border-2 border-[#367C2B] text-[#367C2B] font-bold shadow-2xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <Tractor className={`h-4 w-4 shrink-0 ${historialFilter === 'ingresos' || (historialFilter as string) === 'servicios' ? 'text-[#367C2B]' : 'text-slate-500'}`} />
                    <span className="truncate">Ingresos ({jobs.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHistorialFilter('gastos');
                      setServiciosSubFilter('todos');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs transition cursor-pointer min-h-[42px] select-none ${
                      historialFilter === 'gastos'
                        ? 'bg-emerald-50 border-2 border-[#367C2B] text-[#367C2B] font-bold shadow-2xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <Receipt className={`h-4 w-4 shrink-0 ${historialFilter === 'gastos' ? 'text-[#367C2B]' : 'text-slate-500'}`} />
                    <span className="truncate">Gastos ({machineryExpenses.length})</span>
                  </button>
                </div>
              </div>

              {/* SEGUNDO GRUPO: ORIGEN DEL INGRESO (Sólo cuando Tipo es Ingresos) */}
              {(historialFilter === 'ingresos' || (historialFilter as string) === 'servicios') && (
                <div className="pt-2.5 border-t border-slate-100 space-y-1.5 animate-in fade-in duration-150">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block px-0.5">
                    Origen del ingreso
                  </span>
                  <div className="grid grid-cols-3 gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => setServiciosSubFilter('todos')}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs transition cursor-pointer min-h-[42px] select-none ${
                        serviciosSubFilter === 'todos'
                          ? 'bg-emerald-50 border-2 border-[#367C2B] text-[#367C2B] font-bold shadow-2xs'
                          : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <ClipboardList className={`h-4 w-4 shrink-0 ${serviciosSubFilter === 'todos' ? 'text-[#367C2B]' : 'text-slate-500'}`} />
                      <span className="truncate">Todos ({jobs.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setServiciosSubFilter('propiedad')}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs transition cursor-pointer min-h-[42px] select-none ${
                        serviciosSubFilter === 'propiedad'
                          ? 'bg-emerald-50 border-2 border-[#367C2B] text-[#367C2B] font-bold shadow-2xs'
                          : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <LandPlot className={`h-4 w-4 shrink-0 ${serviciosSubFilter === 'propiedad' ? 'text-[#367C2B]' : 'text-slate-500'}`} />
                      <span className="truncate">Propiedad ({propertyJobs.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setServiciosSubFilter('terceros')}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs transition cursor-pointer min-h-[42px] select-none ${
                        serviciosSubFilter === 'terceros'
                          ? 'bg-emerald-50 border-2 border-[#367C2B] text-[#367C2B] font-bold shadow-2xs'
                          : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <User className={`h-4 w-4 shrink-0 ${serviciosSubFilter === 'terceros' ? 'text-[#367C2B]' : 'text-slate-500'}`} />
                      <span className="truncate">Terceros ({externalJobs.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Indicación discreta debajo de los filtros */}
              <div className="pt-0.5 px-0.5">
                <span className="text-xs text-slate-500 font-medium">
                  Mostrando:{' '}
                  <strong className="text-slate-800 font-bold">
                    {historialFilter === 'todos' && 'Todos los movimientos'}
                    {historialFilter === 'gastos' && 'Gastos directos de maquinaria'}
                    {(historialFilter === 'ingresos' || (historialFilter as string) === 'servicios') && (
                      <>
                        Ingresos por trabajos &middot;{' '}
                        {serviciosSubFilter === 'todos' && 'Todos (Propiedad y Terceros)'}
                        {serviciosSubFilter === 'propiedad' && 'Trabajos en Propiedad'}
                        {serviciosSubFilter === 'terceros' && 'Servicios a Terceros'}
                      </>
                    )}
                  </strong>
                </span>
              </div>
            </div>

            {/* Listado Compacto de Movimientos estilo iOS Card */}
            <div className="space-y-2.5 pt-1">
              {filteredMachineryMovements.map((m) => {
                const isExpanded = expandedMovementId === m.id;

                return (
                  <div
                    key={`${m.kind}-${m.id}`}
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
                            m.kind === 'servicio'
                              ? m.tipoTrabajo === 'propiedad'
                                ? 'bg-emerald-50 border-emerald-200/80'
                                : 'bg-blue-50 border-blue-200/80'
                              : 'bg-rose-50 border-rose-200/80'
                          }`}
                        >
                          <VisualIcon
                            name={m.icono || (m.kind === 'servicio' ? 'tractor' : 'repuestos')}
                            size="sm"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 leading-snug break-words whitespace-normal">
                              {m.titulo}
                            </h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                                m.kind === 'servicio'
                                  ? m.tipoTrabajo === 'propiedad'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {m.kind === 'servicio'
                                ? m.tipoTrabajo === 'propiedad'
                                  ? 'Ingreso Propiedad'
                                  : 'Ingreso Terceros'
                                : 'Gasto Maq.'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            <span className="font-semibold text-slate-600">
                              {formatDateDDMMAAAA(m.fecha)}
                            </span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span className="font-medium text-slate-700">{m.maquinariaNombre}</span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            <span
                              className={
                                m.tipoTrabajo === 'propiedad'
                                  ? 'text-emerald-800 font-semibold'
                                  : 'text-slate-600'
                              }
                            >
                              {m.destinoOCliente}
                            </span>
                            {m.cantidadTexto && (
                              <>
                                <span className="mx-1.5 text-slate-300">·</span>
                                <span className="font-semibold text-slate-700">
                                  {m.cantidadTexto}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span
                            className={`text-sm sm:text-base font-bold font-mono block ${
                              m.kind === 'servicio' ? 'text-emerald-800' : 'text-rose-700'
                            }`}
                          >
                            {m.kind === 'servicio' ? '+ ' : '- '}
                            {m.moneda === 'USD' ? 'USD' : 'Bs'}{' '}
                            {m.total.toLocaleString('es-BO', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Detalle desplegable con tarifa, observaciones y acciones */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2.5 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200/70">
                          <div>
                            <span className="text-[11px] text-slate-400 block font-medium">
                              Tarifa / Precio:
                            </span>
                            <span className="font-bold text-slate-800">
                              {m.tarifaOPrecio !== undefined
                                ? `${m.moneda === 'USD' ? 'USD' : 'Bs'} ${m.tarifaOPrecio} / ${m.unidad || 'unidad'}`
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400 block font-medium">
                              Equivalencia:
                            </span>
                            <span className="font-bold text-slate-700 font-mono">
                              {m.tipoCambio && m.tipoCambio > 0 ? (
                                m.moneda === 'USD'
                                  ? `Bs ${(m.total * m.tipoCambio).toLocaleString('es-BO', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })} (TC: ${m.tipoCambio})`
                                  : `USD ${(m.total / m.tipoCambio).toLocaleString('es-BO', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })} (TC: ${m.tipoCambio})`
                              ) : (
                                '—'
                              )}
                            </span>
                          </div>
                        </div>

                        {m.observacion && (
                          <p className="text-xs text-slate-600 italic bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60 break-words">
                            {m.observacion}
                          </p>
                        )}

                        {/* Botones de acción dentro del detalle */}
                        <div className="flex items-center gap-2 pt-1">
                          {m.kind === 'servicio' && m.rawJob && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditJob(m.rawJob!)}
                                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer min-h-[38px]"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-slate-600" />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setJobToDelete(m.rawJob!)}
                                className="flex-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-rose-200 min-h-[38px]"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                <span>Eliminar</span>
                              </button>
                            </>
                          )}
                          {m.kind === 'gasto' && m.rawExpense && (
                            <button
                              type="button"
                              onClick={() => setExpenseToDelete(m.rawExpense!)}
                              className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-rose-200 min-h-[38px]"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              <span>Eliminar Gasto</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredMachineryMovements.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200/60">
                  No se encontraron movimientos registrados con los filtros seleccionados.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONSULTA: MÁQUINAS (RESUMEN OPERATIVO)                       */}
      {/* ============================================================ */}
      {currentScreen === 'resumen' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Máquinas ({machines.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Total de horas, hectáreas y cantidad de labores por equipo
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              {machines.map((m) => {
                const machineJobs = jobs.filter((j) => j.maquinariaId === m.id);
                const hrs = machineJobs
                  .filter((j) => j.unidad === 'hora' || (j.unidad as string) === 'h')
                  .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);
                const ha = machineJobs
                  .filter((j) => j.unidad === 'hectarea' || (j.unidad as string) === 'ha')
                  .reduce((sum, j) => sum + (Number(j.cantidad) || 0), 0);

                const machineJobTypesList = getAvailableJobsForMachine(m.id);
                const isExpanded = expandedMachineId === m.id;

                return (
                  <div
                    key={m.id}
                    className="w-full rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-2xs space-y-2.5"
                  >
                    {/* Encabezado */}
                    <div className="flex items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                          <VisualIcon name={m.icono || m.tipo || 'tractor'} size="sm" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-900 leading-snug break-words line-clamp-2">
                            {m.nombre}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            {m.tipo || 'Tractor'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                          m.estado === 'operativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.estado === 'mantenimiento'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {m.estado || 'operativo'}
                      </span>
                    </div>

                    {/* Estadísticas en tres columnas compactas */}
                    <div className="grid grid-cols-3 divide-x divide-slate-200/80 bg-slate-50/80 py-2 rounded-xl border border-slate-100 text-center">
                      <div className="px-1">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Horas</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">{hrs.toFixed(1)} h</span>
                      </div>
                      <div className="px-1">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Hectáreas</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">{ha.toFixed(1)} ha</span>
                      </div>
                      <div className="px-1">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Trabajos</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">{machineJobs.length}</span>
                      </div>
                    </div>

                    {/* Fila delgada para Tarifas y trabajos */}
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => setExpandedMachineId(isExpanded ? null : m.id)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-semibold transition cursor-pointer min-h-[34px]"
                      >
                        <span>Tarifas y trabajos ({machineJobTypesList.length})</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 space-y-2 max-h-72 overflow-y-auto pr-1">
                          {machineJobTypesList.map((jobDef) => (
                            <div
                              key={jobDef.id}
                              className="p-2.5 rounded-xl bg-white border border-slate-200/90 flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
                                  <VisualIcon name={jobDef.icono || jobDef.nombre} size="xs" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-bold text-slate-900 block truncate">
                                    {jobDef.nombre}
                                  </span>
                                  <span className="text-[11px] font-semibold text-emerald-800 font-mono">
                                    {jobDef.moneda === 'USD' ? 'USD' : 'Bs'} {jobDef.tarifa} / {jobDef.unidad}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                                Activo
                              </span>
                            </div>
                          ))}
                          {machineJobTypesList.length === 0 && (
                            <div className="p-3 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                              Tarifa base general: {m.moneda} {m.tarifa} / {m.unidad}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {machines.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                  No hay maquinarias registradas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDITAR TRABAJO (ESTILO iOS)                          */}
      {/* ============================================================ */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Editar Trabajo de Maquinaria
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Actualiza los datos del trabajo y sus movimientos contables vinculados
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditJob} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Fecha */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  required
                  value={editFecha}
                  onChange={(e) => setEditFecha(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[46px]"
                />
              </div>

              {/* Maquinaria */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Maquinaria
                </label>
                <select
                  required
                  value={editMachineId}
                  onChange={(e) => setEditMachineId(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[46px]"
                >
                  <option value="">-- Seleccionar Maquinaria --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {getMachineOptionLabel(m, false)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Trabajo / Labor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Trabajo / Labor
                </label>
                {getAvailableJobsForMachine(editMachineId).length > 0 && (
                  <select
                    value={editJobTypeId}
                    onChange={(e) => {
                      const jId = e.target.value;
                      setEditJobTypeId(jId);
                      const jDef = getAvailableJobsForMachine(editMachineId).find((x) => x.id === jId);
                      if (jDef) {
                        setEditJobNombre(jDef.nombre);
                        setEditTarifa(jDef.tarifa);
                        setEditUnidad(jDef.unidad === 'ha' || jDef.unidad === 'hectarea' ? 'hectarea' : 'hora');
                        setEditMoneda(jDef.moneda);
                      }
                    }}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[46px] mb-1.5"
                  >
                    <option value="">-- Seleccionar de la lista o escribir abajo --</option>
                    {getAvailableJobsForMachine(editMachineId).map((jDef) => (
                      <option key={jDef.id} value={jDef.id}>
                        {jDef.nombre} ({jDef.moneda} {jDef.tarifa}/{jDef.unidad})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="Nombre del trabajo o labor..."
                  value={editJobNombre}
                  onChange={(e) => setEditJobNombre(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[44px]"
                />
              </div>

              {/* Destino Segmented Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destino
                </label>
                <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setEditTipoTrabajo('tercero')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                      editTipoTrabajo === 'tercero'
                        ? 'bg-white text-blue-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Para otros (Cliente)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTipoTrabajo('propiedad')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                      editTipoTrabajo === 'propiedad'
                        ? 'bg-white text-emerald-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    En propiedad (Lote)
                  </button>
                </div>
              </div>

              {/* Cliente o Lote */}
              {editTipoTrabajo === 'tercero' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cliente / Beneficiario
                  </label>
                  <input
                    type="text"
                    value={editCliente}
                    onChange={(e) => setEditCliente(e.target.value)}
                    placeholder="Nombre del cliente externo..."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none min-h-[46px]"
                  />
                </div>
              ) : (
                <VisualLotPicker
                  lots={lots}
                  selectedLotId={editLotId}
                  onSelect={(id) => setEditLotId(id)}
                  label="Lote Propio"
                  required
                />
              )}

              {/* Cantidad y Unidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cantidad trabajada
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    required
                    min="0.1"
                    value={editCantidad}
                    onChange={(e) => setEditCantidad(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold min-h-[46px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unidad
                  </label>
                  <select
                    value={editUnidad}
                    onChange={(e) => setEditUnidad(e.target.value as 'hora' | 'hectarea')}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[46px]"
                  >
                    <option value="hora">Horas</option>
                    <option value="hectarea">Hectáreas</option>
                  </select>
                </div>
              </div>

              {/* Tarifa y Moneda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tarifa por {editUnidad}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={editTarifa}
                    onChange={(e) => setEditTarifa(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold min-h-[46px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Moneda
                  </label>
                  <select
                    value={editMoneda}
                    onChange={(e) => setEditMoneda(e.target.value as Currency)}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none min-h-[46px]"
                  >
                    <option value="BOB">BOB (Bs)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  rows={2}
                  value={editObservacion}
                  onChange={(e) => setEditObservacion(e.target.value)}
                  className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="flex-1 min-h-[48px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  setDeletingExpense(true);
                  try {
                    await deleteExpense(expenseToDelete.id);
                    setSuccessMsg('Gasto de maquinaria eliminado exitosamente.');
                    setExpenseToDelete(null);
                    onRefreshData();
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
    </div>
  );
};
