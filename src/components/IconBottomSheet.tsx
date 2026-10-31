import React, { useState, useMemo } from 'react';
import { Search, X, Check } from 'lucide-react';
import { VisualIcon } from './VisualIcon';
import { ICON_CATALOG, IconCategory, IconDefinition, searchIcons } from '../services/iconCatalog';

interface IconBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (icon: IconDefinition | any) => void;
  selectedIconId?: string;
  defaultCategory?: IconCategory | 'todos';
  category?: IconCategory | 'todos';
  title?: string;
}

export const IconBottomSheet: React.FC<IconBottomSheetProps> = ({
  isOpen,
  onClose,
  onSelectIcon,
  selectedIconId,
  defaultCategory = 'todos',
  category,
  title,
}) => {
  const initialCat = category || defaultCategory;
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<IconCategory | 'todos'>(initialCat);
  const [tempSelectedId, setTempSelectedId] = useState<string>(selectedIconId || '');

  // Dynamic context-aware sheet title
  const sheetTitle = useMemo(() => {
    if (title) return title;
    const cat = category || activeCategory;
    if (cat === 'maquinaria') return 'Elegir icono de maquinaria';
    if (cat === 'implemento') return 'Elegir icono de implemento';
    if (cat === 'gasto') return 'Elegir icono de gasto';
    if (cat === 'ingreso') return 'Elegir icono de ingreso agrícola';
    return 'Elegir icono visual';
  }, [title, category, activeCategory]);

  // Reset states when opening
  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setActiveCategory(category || defaultCategory);
      setTempSelectedId(selectedIconId || '');
    }
  }, [isOpen, selectedIconId, category, defaultCategory]);

  const filteredIcons = useMemo(() => {
    return searchIcons(searchTerm, activeCategory);
  }, [searchTerm, activeCategory]);

  if (!isOpen) return null;

  const handleClose = () => {
    (document.activeElement as HTMLElement)?.blur();
    onClose();
  };

  const handleSelect = (icon: IconDefinition) => {
    (document.activeElement as HTMLElement)?.blur();
    setTempSelectedId(icon.id);
    onSelectIcon(icon);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
      {/* Backdrop tap to close */}
      <div className="flex-1" onClick={handleClose} />

      {/* iOS Bottom Sheet Container */}
      <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-stone-200/80 flex flex-col max-h-[85vh] animate-slideUp overflow-hidden">
        {/* iOS Drag Handle */}
        <div className="pt-3 pb-1 cursor-grab" onClick={handleClose}>
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto" />
        </div>

        {/* Header */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">{sheetTitle}</h3>
            <p className="text-[11px] text-stone-500">Selecciona una imagen realista para identificar el registro</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar soya, maíz, diésel, tractor..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition min-h-[38px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs (iOS Segmented Style) */}
        <div className="px-4 pb-2">
          <div className="bg-stone-100 p-1 rounded-xl flex text-[11px] font-semibold text-stone-600 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveCategory('todos')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeCategory === 'todos' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              Todos ({ICON_CATALOG.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('ingreso')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeCategory === 'ingreso' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'hover:text-stone-900'
              }`}
            >
              Ingresos
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('gasto')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeCategory === 'gasto' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'hover:text-stone-900'
              }`}
            >
              Gastos
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('maquinaria')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeCategory === 'maquinaria' ? 'bg-white text-emerald-800 shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              Maquinarias
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('implemento')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer whitespace-nowrap ${
                activeCategory === 'implemento' ? 'bg-white text-emerald-800 shadow-xs' : 'hover:text-stone-900'
              }`}
            >
              Implementos
            </button>
          </div>
        </div>

        {/* Icons Grid Gallery */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filteredIcons.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400">
              No se encontraron iconos para &ldquo;{searchTerm}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pb-4">
              {filteredIcons.map((icon) => {
                const isSelected = tempSelectedId === icon.id;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => handleSelect(icon)}
                    className={`flex flex-col items-center justify-between p-2 rounded-2xl border text-center transition cursor-pointer relative group ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/30 shadow-xs'
                        : 'border-stone-200/90 bg-white hover:bg-stone-50 hover:border-stone-300'
                    }`}
                  >
                    {/* Active check badge */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs z-10">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}

                    {/* Realistic Visual Icon */}
                    <div className="p-1 flex items-center justify-center min-h-[58px]">
                      <VisualIcon iconId={icon.id} size={54} />
                    </div>

                    {/* Icon Label */}
                    <span className="text-[11px] font-bold text-stone-800 mt-1 line-clamp-2 leading-tight">
                      {icon.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-stone-100 bg-stone-50 flex items-center justify-between text-xs">
          <span className="text-[11px] text-stone-500">
            Toca cualquier icono para aplicarlo inmediatamente
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
