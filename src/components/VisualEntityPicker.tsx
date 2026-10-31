import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, X, Check, LandPlot } from 'lucide-react';
import { VisualIcon } from './VisualIcon';
import { Machine, MachineJobType, ItemConfig, Lot } from '../types';

// ==========================================
// 1. VISUAL MACHINE PICKER
// ==========================================
interface MachinePickerProps {
  machines: Machine[];
  selectedId?: string;
  selectedMachineId?: string;
  onSelect?: (machineId: string) => void;
  onSelectMachine?: (machine: Machine | any) => void;
  required?: boolean;
  label?: string;
  optionalText?: string;
  allowNone?: boolean;
  noneLabel?: string;
}

export const VisualMachinePicker: React.FC<MachinePickerProps> = ({
  machines,
  selectedId,
  selectedMachineId,
  onSelect,
  onSelectMachine,
  required = false,
  label = 'Maquinaria',
  optionalText,
  allowNone = false,
  noneLabel = 'Gasto general (sin asignar)',
}) => {
  const currentId = selectedId !== undefined ? selectedId : (selectedMachineId || '');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === currentId),
    [machines, currentId]
  );

  const filteredMachines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        (m.identificacion && m.identificacion.toLowerCase().includes(q)) ||
        (m.tipo && m.tipo.toLowerCase().includes(q))
    );
  }, [machines, search]);

  const handleChoose = (id: string, m?: Machine) => {
    (document.activeElement as HTMLElement)?.blur();
    if (onSelect) onSelect(id);
    if (onSelectMachine) onSelectMachine(m || machines.find(x => x.id === id) || { id, nombre: '', tipo: '' });
    setIsOpen(false);
  };

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    setIsOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-stone-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {optionalText && <span className="text-[10px] text-stone-400">{optionalText}</span>}
      </div>

      {/* Trigger Card Field */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border text-left transition cursor-pointer min-h-[50px] group ${
          selectedMachine
            ? 'border-emerald-500/80 bg-emerald-50/40 hover:bg-emerald-50/70 shadow-xs'
            : 'border-stone-300 bg-stone-50 hover:bg-white hover:border-stone-400'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1 rounded-xl bg-white border border-stone-200/80 shadow-2xs shrink-0">
            <VisualIcon
              iconId={selectedMachine?.icono}
              nameHint={selectedMachine ? `${selectedMachine.nombre} ${selectedMachine.tipo}` : 'tractor'}
              category="maquinaria"
              size={36}
            />
          </div>
          <div className="min-w-0 flex-1">
            {selectedMachine ? (
              <>
                <p className="text-xs font-bold text-stone-900 truncate">{selectedMachine.nombre}</p>
                <p className="text-[11px] text-stone-500 truncate">
                  {selectedMachine.identificacion && `${selectedMachine.identificacion} • `}
                  {selectedMachine.tipo || 'Maquinaria'} • Tarifa base: {selectedMachine.moneda}{' '}
                  {selectedMachine.tarifa}/{selectedMachine.unidad}
                </p>
              </>
            ) : (
              <p className="text-xs font-medium text-stone-400">
                Toca para seleccionar maquinaria...
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-stone-400 group-hover:text-emerald-700">
          <span className="text-[10px] font-semibold hidden sm:inline">Cambiar</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>

      {/* iOS Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            {/* Drag Bar */}
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            {/* Header */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">Seleccionar Maquinaria</h3>
                <p className="text-[11px] text-stone-500">
                  {machines.length} equipos registrados en el sistema
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, tipo o código..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {(!required || allowNone) && (
                <button
                  type="button"
                  onClick={() => handleChoose('', undefined)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                    !currentId
                      ? 'border-emerald-600 bg-emerald-50/90 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500">
                      —
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-800">{noneLabel}</p>
                      <p className="text-[11px] text-stone-500">No vincular a una máquina específica</p>
                    </div>
                  </div>
                  {!currentId && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              )}

              {filteredMachines.map((m) => {
                const isSelected = currentId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleChoose(m.id, m)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1 rounded-xl bg-white border border-stone-200 shrink-0">
                        <VisualIcon
                          iconId={m.icono}
                          nameHint={`${m.nombre} ${m.tipo}`}
                          category="maquinaria"
                          size={42}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-stone-900">{m.nombre}</span>
                          {m.identificacion && (
                            <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                              {m.identificacion}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {m.tipo} &bull; Tarifa base:{' '}
                          <span className="font-semibold text-emerald-800">
                            {m.moneda} {m.tarifa}/{m.unidad}
                          </span>
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-stone-100 bg-stone-50 text-right">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. VISUAL JOB TYPE / IMPLEMENT PICKER
// ==========================================
interface JobTypePickerProps {
  jobs?: MachineJobType[];
  jobTypes?: MachineJobType[];
  selectedId?: string;
  selectedJobTypeId?: string;
  onSelect?: (job: MachineJobType) => void;
  onSelectJobType?: (job: MachineJobType | any) => void;
  required?: boolean;
  label?: string;
}

export const VisualJobTypePicker: React.FC<JobTypePickerProps> = ({
  jobs,
  jobTypes,
  selectedId,
  selectedJobTypeId,
  onSelect,
  onSelectJobType,
  required = true,
  label = 'Tipo de Trabajo / Implemento',
}) => {
  const list = jobs || jobTypes || [];
  const currentId = selectedId !== undefined ? selectedId : (selectedJobTypeId || '');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedJob = useMemo(() => list.find((j) => j.id === currentId), [list, currentId]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((j) => j.nombre.toLowerCase().includes(q));
  }, [list, search]);

  const handleChoose = (j: MachineJobType) => {
    (document.activeElement as HTMLElement)?.blur();
    if (onSelect) onSelect(j);
    if (onSelectJobType) onSelectJobType(j);
    setIsOpen(false);
  };

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    setIsOpen(false);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-stone-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger Card */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border text-left transition cursor-pointer min-h-[50px] group ${
          selectedJob
            ? 'border-emerald-500/80 bg-emerald-50/40 hover:bg-emerald-50/70 shadow-xs'
            : 'border-stone-300 bg-stone-50 hover:bg-white hover:border-stone-400'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1 rounded-xl bg-white border border-stone-200/80 shadow-2xs shrink-0">
            <VisualIcon
              iconId={selectedJob?.icono}
              nameHint={selectedJob ? selectedJob.nombre : 'sembradora'}
              category="implemento"
              size={36}
            />
          </div>
          <div className="min-w-0 flex-1">
            {selectedJob ? (
              <>
                <p className="text-xs font-bold text-emerald-950 truncate">{selectedJob.nombre}</p>
                <p className="text-[11px] text-stone-500 truncate">
                  Tarifa predeterminada:{' '}
                  <span className="font-bold text-emerald-800 font-mono">
                    {selectedJob.moneda === 'USD' ? 'USD' : 'Bs'} {selectedJob.tarifa} / {selectedJob.unidad}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-xs font-medium text-stone-400">
                Toca para seleccionar labor o implemento...
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-stone-400 group-hover:text-emerald-700">
          <span className="text-[10px] font-semibold hidden sm:inline">Cambiar</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>

      {/* iOS Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Seleccionar Labor / Implemento
                </h3>
                <p className="text-[11px] text-stone-500">
                  {list.length} trabajos disponibles para esta máquina
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar trabajo (siembra, romplow, rastra...)"
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {filteredJobs.map((j) => {
                const isSelected = selectedId === j.id;
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => handleChoose(j)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1 rounded-xl bg-white border border-stone-200 shrink-0">
                        <VisualIcon
                          iconId={j.icono}
                          nameHint={j.nombre}
                          category="implemento"
                          size={40}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-stone-900">{j.nombre}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Tarifa:{' '}
                          <span className="font-bold text-emerald-800 font-mono">
                            {j.moneda === 'USD' ? 'USD' : 'Bs'} {j.tarifa} / {j.unidad}
                          </span>
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-stone-100 bg-stone-50 text-right">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. VISUAL EXPENSE ITEM PICKER
// ==========================================
interface ExpenseItemPickerProps {
  items: ItemConfig[];
  selectedName?: string;
  selectedItemName?: string;
  onSelect?: (item: ItemConfig | { nombre: string; icono?: string; unidad?: string; precio?: number; precioDefecto?: number; moneda?: any }) => void;
  onSelectItem?: (item: ItemConfig | any) => void;
  required?: boolean;
  label?: string;
  defaultIcon?: string;
}

export const VisualExpenseItemPicker: React.FC<ExpenseItemPickerProps> = ({
  items,
  selectedName,
  selectedItemName,
  onSelect,
  onSelectItem,
  required = true,
  label = 'Insumo o Concepto de Gasto',
  defaultIcon = 'diesel',
}) => {
  const currentName = selectedName !== undefined ? selectedName : (selectedItemName || '');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedItem = useMemo(
    () => items.find((i) => i.nombre.toLowerCase() === currentName.toLowerCase()),
    [items, currentName]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [items, search]);

  const handleChoose = (item: ItemConfig | any) => {
    (document.activeElement as HTMLElement)?.blur();
    if (onSelect) onSelect(item);
    if (onSelectItem) onSelectItem(item);
    setIsOpen(false);
  };

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    setIsOpen(false);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-stone-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger Card */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-stone-300 bg-white hover:border-emerald-500 shadow-2xs text-left transition cursor-pointer min-h-[50px] group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1 rounded-xl bg-stone-50 border border-stone-200 shrink-0">
            <VisualIcon
              iconId={selectedItem?.icono}
              nameHint={selectedName || 'diesel'}
              category="gasto"
              size={36}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-stone-900 truncate">
              {selectedName || 'Seleccionar ítem...'}
            </p>
            {selectedItem?.unidad && (
              <p className="text-[11px] text-stone-500 truncate">
                Unidad habitual: {selectedItem.unidad}
                {selectedItem.precioPredeterminado ? ` • Precio base: ${selectedItem.moneda} ${selectedItem.precioPredeterminado}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-stone-400 group-hover:text-emerald-700">
          <span className="text-[10px] font-semibold hidden sm:inline">Cambiar</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>

      {/* iOS Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Seleccionar Concepto de Gasto
                </h3>
                <p className="text-[11px] text-stone-500">
                  {items.length} rubros e insumos configurados
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar diésel, aceite, filtro, semillas..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {filteredItems.map((item) => {
                const isSelected = currentName.toLowerCase() === item.nombre.toLowerCase();
                return (
                  <button
                    key={item.id || item.nombre}
                    type="button"
                    onClick={() => handleChoose(item)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1 rounded-xl bg-white border border-stone-200 shrink-0">
                        <VisualIcon
                          iconId={item.icono}
                          nameHint={item.nombre}
                          category="gasto"
                          size={40}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-stone-900">{item.nombre}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {item.unidad && `Unidad: ${item.unidad}`}
                          {item.precioPredeterminado ? ` • Ref: ${item.moneda} ${item.precioPredeterminado}` : ''}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-stone-100 bg-stone-50 text-right">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. VISUAL INCOME ITEM PICKER (Cosechas / Ingresos Agrícolas)
// ==========================================
interface IncomeItemPickerProps {
  items: ItemConfig[];
  selectedName?: string;
  selectedItemName?: string;
  onSelect?: (item: ItemConfig | { nombre: string; icono?: string; unidad?: string; precio?: number; precioPredeterminado?: number; moneda?: any }) => void;
  onSelectItem?: (item: ItemConfig | any) => void;
  required?: boolean;
  label?: string;
  defaultIcon?: string;
}

const DEFAULT_INCOME_ITEMS: Partial<ItemConfig>[] = [
  { id: 'def_soya', nombre: 'Venta Cosecha Soya', icono: 'soya', unidad: 'toneladas' },
  { id: 'def_maiz', nombre: 'Venta Cosecha Maíz', icono: 'maiz', unidad: 'toneladas' },
  { id: 'def_trigo', nombre: 'Venta Cosecha Trigo', icono: 'trigo', unidad: 'toneladas' },
  { id: 'def_sorgo', nombre: 'Venta Cosecha Sorgo', icono: 'sorgo', unidad: 'toneladas' },
  { id: 'def_girasol', nombre: 'Venta Cosecha Girasol', icono: 'girasol', unidad: 'toneladas' },
  { id: 'def_semilla', nombre: 'Venta de Semilla', icono: 'granos', unidad: 'bolsas' },
  { id: 'def_otros', nombre: 'Otros Ingresos del Lote', icono: 'otros-ingresos', unidad: 'unidades' },
];

export const VisualIncomeItemPicker: React.FC<IncomeItemPickerProps> = ({
  items,
  selectedName,
  selectedItemName,
  onSelect,
  onSelectItem,
  required = true,
  label = 'Concepto / Producto de Cosecha',
  defaultIcon = 'soya',
}) => {
  const currentName = selectedName !== undefined ? selectedName : (selectedItemName || '');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Use available income items or fallback to default standard crops
  const effectiveItems = useMemo(() => {
    return items.length > 0 ? items : (DEFAULT_INCOME_ITEMS as ItemConfig[]);
  }, [items]);

  const selectedItem = useMemo(
    () => effectiveItems.find((i) => i.nombre.toLowerCase() === currentName.toLowerCase()),
    [effectiveItems, currentName]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return effectiveItems;
    return effectiveItems.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [effectiveItems, search]);

  const handleChoose = (item: ItemConfig | any) => {
    (document.activeElement as HTMLElement)?.blur();
    if (onSelect) onSelect(item);
    if (onSelectItem) onSelectItem(item);
    setIsOpen(false);
  };

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    setIsOpen(false);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-stone-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger Card */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-stone-300 bg-white hover:border-emerald-500 shadow-2xs text-left transition cursor-pointer min-h-[50px] group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1 rounded-xl bg-emerald-50/60 border border-emerald-200/80 shrink-0">
            <VisualIcon
              iconId={selectedItem?.icono}
              nameHint={selectedName || defaultIcon}
              category="ingreso"
              size={36}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-stone-900 truncate">
              {selectedName || 'Seleccionar producto / cosecha...'}
            </p>
            {selectedItem?.unidad && (
              <p className="text-[11px] text-stone-500 truncate">
                Unidad habitual: {selectedItem.unidad}
                {selectedItem.precioPredeterminado ? ` • Ref: ${selectedItem.moneda || 'USD'} ${selectedItem.precioPredeterminado}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-stone-400 group-hover:text-emerald-700">
          <span className="text-[10px] font-semibold hidden sm:inline">Cambiar</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>

      {/* iOS Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Concepto / Producto de Ingreso
                </h3>
                <p className="text-[11px] text-stone-500">
                  {effectiveItems.length} rubros de ingresos agrícolas disponibles
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar soya, maíz, trigo, sorgo, girasol..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {filteredItems.map((item) => {
                const isSelected = currentName.toLowerCase() === item.nombre.toLowerCase();
                return (
                  <button
                    key={item.id || item.nombre}
                    type="button"
                    onClick={() => handleChoose(item)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1 rounded-xl bg-white border border-stone-200 shrink-0">
                        <VisualIcon
                          iconId={item.icono}
                          nameHint={item.nombre}
                          category="ingreso"
                          size={40}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-stone-900">{item.nombre}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {item.unidad && `Unidad: ${item.unidad}`}
                          {item.precioPredeterminado ? ` • Ref: ${item.moneda || 'USD'} ${item.precioPredeterminado}` : ''}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-stone-100 bg-stone-50 text-right">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. VISUAL LOT PICKER (Selector iOS para Lotes)
// ==========================================
interface LotPickerProps {
  lots: Lot[];
  selectedId?: string;
  selectedLotId?: string;
  onSelect?: (lotId: string) => void;
  onSelectLot?: (lot: Lot) => void;
  required?: boolean;
  label?: string;
}

export const VisualLotPicker: React.FC<LotPickerProps> = ({
  lots,
  selectedId,
  selectedLotId,
  onSelect,
  onSelectLot,
  required = true,
  label = 'Lote de Origen',
}) => {
  const currentId = selectedId !== undefined ? selectedId : (selectedLotId || '');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLot = useMemo(() => lots.find((l) => l.id === currentId), [lots, currentId]);

  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter(
      (l) =>
        l.nombre.toLowerCase().includes(q) ||
        (l.cultivoActual && l.cultivoActual.toLowerCase().includes(q)) ||
        (l.ubicacion && l.ubicacion.toLowerCase().includes(q))
    );
  }, [lots, search]);

  const handleChoose = (l: Lot) => {
    (document.activeElement as HTMLElement)?.blur();
    if (onSelect) onSelect(l.id);
    if (onSelectLot) onSelectLot(l);
    setIsOpen(false);
  };

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    setIsOpen(false);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-stone-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger Card */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-stone-300 bg-white hover:border-emerald-500 shadow-2xs text-left transition cursor-pointer min-h-[50px] group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0">
            <LandPlot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {selectedLot ? (
              <>
                <p className="text-xs font-bold text-stone-900 truncate">{selectedLot.nombre}</p>
                <p className="text-[11px] text-stone-500 truncate">
                  {selectedLot.superficieHectareas || selectedLot.superficie || 0} ha
                  {selectedLot.cultivoActual ? ` • ${selectedLot.cultivoActual}` : ' • Sin cultivo asignado'}
                </p>
              </>
            ) : (
              <p className="text-xs font-medium text-stone-400">
                Toca para seleccionar lote...
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2 text-stone-400 group-hover:text-emerald-700">
          <span className="text-[10px] font-semibold hidden sm:inline">Cambiar</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>

      {/* iOS Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">Seleccionar Lote</h3>
                <p className="text-[11px] text-stone-500">
                  {lots.length} lotes registrados en la propiedad
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar lote por nombre o cultivo..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {filteredLots.map((l) => {
                const isSelected = currentId === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleChoose(l)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100 shrink-0">
                        <LandPlot className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-stone-900">{l.nombre}</p>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {l.superficieHectareas || l.superficie || 0} ha
                          {l.cultivoActual ? ` • Cultivo: ${l.cultivoActual}` : ' • Sin cultivo'}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-stone-100 bg-stone-50 text-right">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
