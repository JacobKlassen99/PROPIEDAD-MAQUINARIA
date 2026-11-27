import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, X, Check, LandPlot, Wrench, List, Tractor } from 'lucide-react';
import { VisualIcon } from './VisualIcon';
import { sanitizeFieldLabel } from './AppSelect';
import { Machine, MachineJobType, ItemConfig, Lot } from '../types';
import { isTechnicalId } from '../services/backend';
import { useI18n } from '../services/i18n';

function getTriggerClasses(required: boolean, hasValue: boolean): {
  button: string;
  icon: string;
  text: string;
  chevron: string;
} {
  if (hasValue) {
    return {
      button:
        'border-[#CFD8D2] bg-white hover:border-[#24875B] focus:border-[#24875B] focus:ring-2 focus:ring-[#24875B]/15',
      icon: 'text-[#3B6B55]',
      text: 'text-[#1F2D25]',
      chevron: 'text-[#5E6D64]',
    };
  }
  if (required) {
    return {
      button:
        'border-[#86D4AA] bg-[#EAF7F0] hover:bg-[#DEF3E7] focus:border-[#24875B]',
      icon: 'text-[#16834A]',
      text: 'text-[#16834A]',
      chevron: 'text-[#16834A]',
    };
  }
  return {
    button:
      'border-[#C8D4CC] bg-[#F4F7F5] hover:bg-[#EDF2EE] focus:border-[#24875B]',
    icon: 'text-[#64746B]',
    text: 'text-[#5B6B62]',
    chevron: 'text-[#64746B]',
  };
}

function cleanOptionalLabel(label: string, required: boolean): { text: string; isOptionalTag: boolean } {
  const withoutStar = sanitizeFieldLabel(label, required);
  const hasOptInText = /\((opcional|optional)[^)]*\)/i.test(withoutStar);
  const clean = withoutStar.replace(/\s*\((opcional|optional)[^)]*\)/gi, '').trim();
  return { text: clean, isOptionalTag: !required && hasOptInText };
}

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
  label,
  optionalText,
  allowNone = false,
  noneLabel,
}) => {
  const { t, bi } = useI18n();
  const resolvedLabel = label ?? t('picker.machineLabel');
  const resolvedNoneLabel = noneLabel ?? bi('Gasto general (sin asignar)', 'General expense (unassigned)');
  const currentId = selectedId !== undefined ? selectedId : (selectedMachineId || '');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === currentId),
    [machines, currentId]
  );

  const hasValue = Boolean(selectedMachine);
  const styles = getTriggerClasses(required, hasValue);
  const { text: cleanLabel, isOptionalTag } = cleanOptionalLabel(resolvedLabel, required);
  const showOptional = !required && (optionalText || isOptionalTag);

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
    if (onSelectMachine) onSelectMachine(m || machines.find((x) => x.id === id) || { id, nombre: '', tipo: '' });
    setIsOpen(false);
  };

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    setIsOpen(false);
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex items-center justify-between gap-1 mb-1">
        <label className="block text-[13px] font-semibold text-[#26352D] truncate">
          {cleanLabel}
          {required && <span className="text-[#C44545] ml-0.5">*</span>}
        </label>
        {showOptional && (
          <span className="text-[12px] text-[#7A8780] font-normal shrink-0">
            {optionalText || t('common.optional')}
          </span>
        )}
      </div>

      {/* Compact Single-Line Trigger (40px) */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className={`w-full h-[40px] px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer focus:outline-none ${styles.button}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedMachine && selectedMachine.icono ? (
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <VisualIcon iconId={selectedMachine.icono} nameHint={selectedMachine.nombre} category="maquinaria" size={26} />
            </div>
          ) : (
            <Tractor className={`h-[17px] w-[17px] shrink-0 ${styles.icon}`} />
          )}
          <span className={`text-sm font-semibold truncate ${styles.text}`}>
            {selectedMachine ? selectedMachine.nombre : t('picker.machinePlaceholder')}
          </span>
        </div>
        <ChevronDown className={`h-[17px] w-[17px] shrink-0 ${styles.chevron}`} />
      </button>

      {/* Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">{t('picker.machinePlaceholder')}</h3>
                <p className="text-xs text-stone-500">
                  {machines.length}{' '}
                  {machines.length === 1
                    ? bi('máquina disponible', 'machine available')
                    : bi('máquinas disponibles', 'machines available')}
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

            <div className="px-4 pt-2.5 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={bi('Buscar por nombre, tipo o código...', 'Search by name, type, or code...')}
                  className="w-full h-[40px] pl-9 pr-8 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-900 focus:bg-white focus:border-[#24875B] focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {(!required || allowNone) && (
                <button
                  type="button"
                  onClick={() => handleChoose('', undefined)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                    !currentId
                      ? 'border-emerald-600 bg-emerald-50/90 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-sm font-bold text-stone-500">
                      —
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-800">{resolvedNoneLabel}</p>
                      <p className="text-xs text-stone-500">
                        {bi('No vincular a una máquina específica', 'Do not link to a specific machine')}
                      </p>
                    </div>
                  </div>
                  {!currentId && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
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
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1 rounded-lg bg-white border border-stone-200 shrink-0">
                        <VisualIcon
                          iconId={m.icono}
                          nameHint={`${m.nombre} ${m.tipo}`}
                          category="maquinaria"
                          size={38}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-stone-900">{m.nombre}</span>
                          {m.identificacion && !isTechnicalId(m.identificacion) && m.identificacion !== m.nombre && (
                            <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                              {m.identificacion}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {m.tipo || t('common.machine')} ·{' '}
                          <span className="font-semibold text-emerald-800">
                            {m.moneda === 'USD' ? 'USD' : 'Bs'} {m.tarifa}/{m.unidad === 'ha' || m.unidad === 'hectarea' ? 'ha' : 'h'}
                          </span>
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
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
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                {t('common.close')}
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
  onSelect?: (job: MachineJobType | null) => void;
  onSelectJobType?: (job: MachineJobType | null) => void;
  required?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
  label?: string;
  optionalText?: string;
}

export const VisualJobTypePicker: React.FC<JobTypePickerProps> = ({
  jobs,
  jobTypes,
  selectedId,
  selectedJobTypeId,
  onSelect,
  onSelectJobType,
  required = false,
  allowNone = true,
  noneLabel,
  label,
  optionalText,
}) => {
  const { t, bi } = useI18n();
  const resolvedLabel = label ?? bi('Implemento agrícola', 'Agricultural implement');
  const resolvedNoneLabel = noneLabel ?? bi('Sin implemento (usar tarifa de máquina)', 'No implement (use machine rate)');
  const list = jobs || jobTypes || [];
  const currentId = selectedId !== undefined ? selectedId : (selectedJobTypeId || '');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedJob = useMemo(() => list.find((j) => j.id === currentId), [list, currentId]);
  const hasValue = Boolean(selectedJob);
  const styles = getTriggerClasses(required, hasValue);
  const { text: cleanLabel } = cleanOptionalLabel(resolvedLabel, required);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((j) => j.nombre.toLowerCase().includes(q));
  }, [list, search]);

  const handleChoose = (j: MachineJobType | null) => {
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
    <div className="w-full min-w-0">
      <div className="flex items-center justify-between gap-1 mb-1">
        <label className="block text-[13px] font-semibold text-[#26352D] truncate">
          {cleanLabel}
          {required && <span className="text-[#C44545] ml-0.5">*</span>}
        </label>
        {!required && (
          <span className="text-[12px] text-[#7A8780] font-normal shrink-0">
            {optionalText || t('common.optional')}
          </span>
        )}
      </div>

      {/* Compact Single-Line Trigger (40px) */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className={`w-full h-[40px] px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer focus:outline-none ${styles.button}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedJob && selectedJob.icono ? (
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <VisualIcon iconId={selectedJob.icono} nameHint={selectedJob.nombre} category="implemento" size={26} />
            </div>
          ) : (
            <Wrench className={`h-[17px] w-[17px] shrink-0 ${styles.icon}`} />
          )}
          <span className={`text-sm font-semibold truncate ${styles.text}`}>
            {selectedJob ? selectedJob.nombre : t('picker.implementPlaceholder')}
          </span>
        </div>
        <ChevronDown className={`h-[17px] w-[17px] shrink-0 ${styles.chevron}`} />
      </button>

      {/* Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">{resolvedLabel}</h3>
                <p className="text-xs text-stone-500">
                  {list.length}{' '}
                  {list.length === 1
                    ? bi('implemento compatible', 'compatible implement')
                    : bi('implementos compatibles', 'compatible implements')}
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

            <div className="px-4 pt-2.5 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('picker.implementSearch')}
                  className="w-full h-[40px] pl-9 pr-8 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-900 focus:bg-white focus:border-[#24875B] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {(allowNone || !required) && (
                <button
                  type="button"
                  onClick={() => handleChoose(null)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                    !currentId
                      ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-sm font-bold text-stone-500 shrink-0">
                      —
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-900">{resolvedNoneLabel}</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {bi(
                          'Aplica únicamente la tarifa propia de la máquina',
                          'Applies only the machine base rate'
                        )}
                      </p>
                    </div>
                  </div>
                  {!currentId && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              )}

              {filteredJobs.map((j) => {
                const isSelected = currentId === j.id;
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => handleChoose(j)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1 rounded-lg bg-white border border-stone-200 shrink-0">
                        <VisualIcon
                          iconId={j.icono}
                          nameHint={j.nombre}
                          category="implemento"
                          size={38}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-stone-900">{j.nombre}</p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {bi('Tarifa', 'Rate')}:{' '}
                          <span className="font-bold text-emerald-800 tabular-nums">
                            {j.moneda === 'USD' ? 'USD' : 'Bs'} {j.tarifa}/{j.unidad === 'ha' || j.unidad === 'hectarea' ? 'ha' : 'h'}
                          </span>
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
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
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                {t('common.close')}
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
  label,
}) => {
  const { t, bi, translateUnit } = useI18n();
  const resolvedLabel = label ?? t('picker.expenseLabel');
  const currentName = (selectedName !== undefined ? selectedName : (selectedItemName || '')).trim();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const hasValue = Boolean(currentName);
  const styles = getTriggerClasses(required, hasValue);
  const { text: cleanLabel } = cleanOptionalLabel(resolvedLabel, required);

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
    <div className="w-full min-w-0">
      <div className="flex items-center justify-between gap-1 mb-1">
        <label className="block text-[13px] font-semibold text-[#26352D] truncate">
          {cleanLabel}
          {required && <span className="text-[#C44545] ml-0.5">*</span>}
        </label>
      </div>

      {/* Compact Single-Line Trigger (40px) */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className={`w-full h-[40px] px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer focus:outline-none ${styles.button}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {(() => {
            const expItem = items.find((i) => i.nombre.toLowerCase() === currentName.toLowerCase());
            return expItem && expItem.icono ? (
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <VisualIcon iconId={expItem.icono} nameHint={currentName} category="gasto" size={26} />
              </div>
            ) : (
              <List className={`h-[17px] w-[17px] shrink-0 ${styles.icon}`} />
            );
          })()}
          <span className={`text-sm font-semibold truncate ${styles.text}`}>
            {currentName || t('picker.expensePlaceholder')}
          </span>
        </div>
        <ChevronDown className={`h-[17px] w-[17px] shrink-0 ${styles.chevron}`} />
      </button>

      {/* Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {bi('Seleccionar concepto de gasto', 'Select expense concept')}
                </h3>
                <p className="text-xs text-stone-500">
                  {items.length} {bi('rubros e insumos configurados', 'configured items & inputs')}
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

            <div className="px-4 pt-2.5 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('picker.expenseSearch')}
                  className="w-full h-[40px] pl-9 pr-8 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-900 focus:bg-white focus:border-[#24875B] focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="h-4 w-4" />
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
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1 rounded-lg bg-white border border-stone-200 shrink-0">
                        <VisualIcon
                          iconId={item.icono}
                          nameHint={item.nombre}
                          category="gasto"
                          size={38}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-stone-900">{item.nombre}</p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {item.unidad && `${t('common.unit')}: ${translateUnit(item.unidad)}`}
                          {item.precioPredeterminado ? ` • Ref: ${item.moneda} ${item.precioPredeterminado}` : ''}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
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
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                {t('common.close')}
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
  label,
}) => {
  const { t, bi, translateUnit } = useI18n();
  const resolvedLabel = label ?? t('picker.incomeLabel');
  const currentName = (selectedName !== undefined ? selectedName : (selectedItemName || '')).trim();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const effectiveItems = useMemo(() => {
    return items.length > 0 ? items : (DEFAULT_INCOME_ITEMS as ItemConfig[]);
  }, [items]);

  const hasValue = Boolean(currentName);
  const styles = getTriggerClasses(required, hasValue);
  const { text: cleanLabel } = cleanOptionalLabel(resolvedLabel, required);

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
    <div className="w-full min-w-0">
      <div className="flex items-center justify-between gap-1 mb-1">
        <label className="block text-[13px] font-semibold text-[#26352D] truncate">
          {cleanLabel}
          {required && <span className="text-[#C44545] ml-0.5">*</span>}
        </label>
      </div>

      {/* Compact Single-Line Trigger (40px) */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className={`w-full h-[40px] px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer focus:outline-none ${styles.button}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {(() => {
            const incItem = effectiveItems.find((i) => i.nombre.toLowerCase() === currentName.toLowerCase());
            return incItem && incItem.icono ? (
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <VisualIcon iconId={incItem.icono} nameHint={currentName} category="ingreso" size={26} />
              </div>
            ) : (
              <List className={`h-[17px] w-[17px] shrink-0 ${styles.icon}`} />
            );
          })()}
          <span className={`text-sm font-semibold truncate ${styles.text}`}>
            {currentName || t('picker.incomePlaceholder')}
          </span>
        </div>
        <ChevronDown className={`h-[17px] w-[17px] shrink-0 ${styles.chevron}`} />
      </button>

      {/* Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {t('picker.incomePlaceholder')}
                </h3>
                <p className="text-xs text-stone-500">
                  {effectiveItems.length}{' '}
                  {bi('rubros de ingresos agrícolas disponibles', 'farm income items available')}
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

            <div className="px-4 pt-2.5 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('picker.incomeSearch')}
                  className="w-full h-[40px] pl-9 pr-8 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-900 focus:bg-white focus:border-[#24875B] focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="h-4 w-4" />
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
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1 rounded-lg bg-white border border-stone-200 shrink-0">
                        <VisualIcon
                          iconId={item.icono}
                          nameHint={item.nombre}
                          category="ingreso"
                          size={38}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-stone-900">{item.nombre}</p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {item.unidad && `${t('common.unit')}: ${translateUnit(item.unidad)}`}
                          {item.precioPredeterminado ? ` • Ref: ${item.moneda || 'USD'} ${item.precioPredeterminado}` : ''}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
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
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. VISUAL LOT PICKER (Selector para Lotes)
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
  label,
}) => {
  const { t, bi } = useI18n();
  const resolvedLabel = label ?? t('picker.lotLabel');
  const currentId = selectedId !== undefined ? selectedId : (selectedLotId || '');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLot = useMemo(() => lots.find((l) => l.id === currentId), [lots, currentId]);
  const hasValue = Boolean(selectedLot);
  const styles = getTriggerClasses(required, hasValue);
  const { text: cleanLabel } = cleanOptionalLabel(resolvedLabel, required);

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
    <div className="w-full min-w-0">
      <div className="flex items-center justify-between gap-1 mb-1">
        <label className="block text-[13px] font-semibold text-[#26352D] truncate">
          {cleanLabel}
          {required && <span className="text-[#C44545] ml-0.5">*</span>}
        </label>
      </div>

      {/* Compact Single-Line Trigger (40px) */}
      <button
        type="button"
        onClick={() => {
          setSearch('');
          setIsOpen(true);
        }}
        className={`w-full h-[40px] px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer focus:outline-none ${styles.button}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <LandPlot className={`h-[17px] w-[17px] shrink-0 ${styles.icon}`} />
          <span className={`text-sm font-semibold truncate ${styles.text}`}>
            {selectedLot ? selectedLot.nombre : t('picker.lotPlaceholder')}
          </span>
        </div>
        <ChevronDown className={`h-[17px] w-[17px] shrink-0 ${styles.chevron}`} />
      </button>

      {/* Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="flex-1" onClick={handleClose} />
          <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
            <div className="pt-3 pb-1 cursor-pointer" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">{t('picker.lotPlaceholder')}</h3>
                <p className="text-xs text-stone-500">
                  {lots.length} {bi('lotes registrados en la propiedad', 'lots registered on the property')}
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

            <div className="px-4 pt-2.5 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('picker.lotSearch')}
                  className="w-full h-[40px] pl-9 pr-8 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-900 focus:bg-white focus:border-[#24875B] focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="h-4 w-4" />
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
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 shrink-0">
                        <LandPlot className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-stone-900">{l.nombre}</p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {l.superficieHectareas || l.superficie || 0} ha
                          {l.cultivoActual
                            ? ` • ${bi('Cultivo', 'Crop')}: ${l.cultivoActual}`
                            : ` • ${bi('Sin cultivo', 'No crop')}`}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 ml-2">
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
                className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
