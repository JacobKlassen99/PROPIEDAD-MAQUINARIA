import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { VisualIcon } from './VisualIcon';
import { Machine, MachineJobType, ItemConfig } from '../types';

// ==========================================
// 1. VISUAL MACHINE PICKER
// ==========================================
interface MachinePickerProps {
  machines: Machine[];
  selectedId: string;
  onSelect: (machineId: string) => void;
  required?: boolean;
  label?: string;
  optionalText?: string;
}

export const VisualMachinePicker: React.FC<MachinePickerProps> = ({
  machines,
  selectedId,
  onSelect,
  required = false,
  label = 'Maquinaria',
  optionalText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedId),
    [machines, selectedId]
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

  const handleChoose = (id: string) => {
    onSelect(id);
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
        onClick={() => setIsOpen(true)}
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
          <div className="flex-1" onClick={() => setIsOpen(false)} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            {/* Drag Bar */}
            <div className="pt-3 pb-1" onClick={() => setIsOpen(false)}>
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
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full"
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
                  autoFocus
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
              {!required && (
                <button
                  type="button"
                  onClick={() => handleChoose('')}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                    !selectedId
                      ? 'border-emerald-600 bg-emerald-50/90 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500">
                      —
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-800">Sin asignar / General</p>
                      <p className="text-[11px] text-stone-500">No vincular a una máquina específica</p>
                    </div>
                  </div>
                  {!selectedId && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              )}

              {filteredMachines.map((m) => {
                const isSelected = selectedId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleChoose(m.id)}
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
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100"
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
  jobs: MachineJobType[];
  selectedId: string;
  onSelect: (job: MachineJobType) => void;
  required?: boolean;
}

export const VisualJobTypePicker: React.FC<JobTypePickerProps> = ({
  jobs,
  selectedId,
  onSelect,
  required = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedJob = useMemo(() => jobs.find((j) => j.id === selectedId), [jobs, selectedId]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => j.nombre.toLowerCase().includes(q));
  }, [jobs, search]);

  const handleChoose = (j: MachineJobType) => {
    onSelect(j);
    setIsOpen(false);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-stone-700 mb-1">
        Tipo de Trabajo / Implemento {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger Card */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
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
          <div className="flex-1" onClick={() => setIsOpen(false)} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1" onClick={() => setIsOpen(false)}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Seleccionar Labor / Implemento
                </h3>
                <p className="text-[11px] text-stone-500">
                  {jobs.length} trabajos disponibles para esta máquina
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full"
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
                  autoFocus
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
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100"
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
  selectedName: string;
  onSelect: (item: ItemConfig | { nombre: string; icono?: string; unidad?: string; precio?: number }) => void;
  required?: boolean;
}

export const VisualExpenseItemPicker: React.FC<ExpenseItemPickerProps> = ({
  items,
  selectedName,
  onSelect,
  required = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedItem = useMemo(
    () => items.find((i) => i.nombre.toLowerCase() === selectedName.toLowerCase()),
    [items, selectedName]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [items, search]);

  const handleChoose = (item: ItemConfig) => {
    onSelect(item);
    setIsOpen(false);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-stone-700 mb-1">
        Insumo o Concepto de Gasto {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger Card */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
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
          <div className="flex-1" onClick={() => setIsOpen(false)} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1" onClick={() => setIsOpen(false)}>
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
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full"
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
                  autoFocus
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {filteredItems.map((item) => {
                const isSelected = selectedName.toLowerCase() === item.nombre.toLowerCase();
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
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100"
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
