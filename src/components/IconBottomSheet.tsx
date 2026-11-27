import React, { useState, useMemo } from 'react';
import { Search, X, Check } from 'lucide-react';
import { VisualIcon } from './VisualIcon';
import { ICON_CATALOG, IconCategory, IconDefinition, searchIcons } from '../services/iconCatalog';
import { useI18n } from '../services/i18n';

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
  const { t, bi, translateIcon } = useI18n();
  const initialCat = category || defaultCategory;
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<IconCategory | 'todos'>(initialCat);
  const [tempSelectedId, setTempSelectedId] = useState<string>(selectedIconId || '');

  const sheetTitle = useMemo(() => {
    if (title) return title;
    const cat = category || activeCategory;
    if (cat === 'maquinaria') return bi('Elegir icono de maquinaria', 'Choose machinery icon');
    if (cat === 'implemento') return bi('Elegir icono de implemento', 'Choose implement icon');
    if (cat === 'gasto') return bi('Elegir icono de gasto', 'Choose expense icon');
    if (cat === 'ingreso') return bi('Elegir icono agrícola', 'Choose agricultural icon');
    return bi('Elegir icono', 'Choose icon');
  }, [title, category, activeCategory, bi]);

  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setActiveCategory(category || defaultCategory);
      setTempSelectedId(selectedIconId || '');
    }
  }, [isOpen, selectedIconId, category, defaultCategory]);

  const filteredIcons = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = searchIcons('', activeCategory);
    if (!q) return base;
    return base.filter((icon) => {
      const translated = translateIcon(icon.id, icon.name).toLowerCase();
      return (
        icon.name.toLowerCase().includes(q) ||
        translated.includes(q) ||
        icon.id.toLowerCase().includes(q) ||
        icon.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [searchTerm, activeCategory, translateIcon]);

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

  const categoryTabs: Array<{ value: IconCategory | 'todos'; label: string }> = [
    { value: 'todos', label: `${t('iconSheet.all')} (${ICON_CATALOG.length})` },
    { value: 'ingreso', label: t('iconSheet.incomes') },
    { value: 'gasto', label: t('iconSheet.expenses') },
    { value: 'maquinaria', label: t('iconSheet.machinery') },
    { value: 'implemento', label: t('iconSheet.implements') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="flex-1" onClick={handleClose} />

      <div className="w-full max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl border-t border-[#E6EBE7] flex flex-col max-h-[86vh] animate-slideUp overflow-hidden">
        <div className="pt-2.5 pb-1 cursor-grab" onClick={handleClose}>
          <div className="w-10 h-1 bg-[#CFD8D2] rounded-full mx-auto" />
        </div>

        <div className="px-4 py-2 flex items-center justify-between border-b border-[#EDF1EE]">
          <div className="min-w-0 pr-2">
            <h3 className="text-base font-bold text-[#1F2D25] tracking-tight truncate">{sheetTitle}</h3>
            <p className="text-[11px] text-[#6E7C74] truncate">
              {bi(
                'Toca una ilustración para aplicarla al registro',
                'Tap an illustration to apply it to this record'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('common.close')}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#7A8780] hover:text-[#1F2D25] rounded-full hover:bg-[#F2F5F3] transition cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A8780]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={bi(
                'Buscar soya, maíz, diésel, tractor, drone...',
                'Search soybean, corn, diesel, tractor, drone...'
              )}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#DCE3DE] bg-[#F7F9F8] text-xs text-[#1F2D25] focus:bg-white focus:border-[#24875B] focus:outline-none transition min-h-[38px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label={bi('Limpiar búsqueda', 'Clear search')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#7A8780] hover:text-[#1F2D25] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Compact continuous horizontal category selector with hidden scrollbar */}
          <div
            role="tablist"
            aria-label={bi('Categorías de iconos', 'Icon categories')}
            className="w-full rounded-xl bg-[#EDF1EE] p-1 border border-[#E2E8E4]"
          >
            <div className="flex items-center gap-1 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {categoryTabs.map((tab) => {
                const isActive = activeCategory === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCategory(tab.value)}
                    className={`flex-1 shrink-0 snap-start py-1.5 px-2.5 rounded-[9px] text-[11px] leading-tight whitespace-nowrap transition-all duration-150 cursor-pointer min-h-[30px] ${
                      isActive
                        ? 'bg-[#24875B] text-white font-semibold shadow-xs'
                        : 'text-[#526058] font-medium hover:text-[#1F2D25]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filteredIcons.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#7A8780]">
              {bi(
                `No se encontraron iconos para "${searchTerm}"`,
                `No icons found for "${searchTerm}"`
              )}
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
                        ? 'border-[#24875B] bg-[#EAF5EE]/85 ring-2 ring-[#24875B]/25 shadow-xs'
                        : 'border-[#E6EBE7] bg-white hover:bg-[#F7F9F8] hover:border-[#CFD8D2]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#24875B] text-white shadow-xs z-10">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}

                    <div className="p-0.5 flex items-center justify-center min-h-[60px]">
                      <VisualIcon iconId={icon.id} size={58} />
                    </div>

                    <span className="text-[11px] font-semibold text-[#1F2D25] mt-1 line-clamp-2 leading-tight">
                      {translateIcon(icon.id, icon.name)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-[#EDF1EE] bg-[#F7F9F8] flex items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-[#6E7C74] truncate">
            {bi(
              'Toca cualquier icono para aplicarlo',
              'Tap any icon to apply it'
            )}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 rounded-xl border border-[#DCE3DE] bg-white text-xs font-semibold text-[#26352D] hover:bg-[#EFF3F0] transition cursor-pointer shrink-0 min-h-[34px]"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
