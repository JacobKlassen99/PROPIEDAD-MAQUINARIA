import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Search, X } from 'lucide-react';

export type FilterAccent = 'neutral' | 'green' | 'red';

export interface CompactFilterOption {
  value: string;
  label: string;
}

interface CompactFilterProps {
  value: string;
  onChange: (value: string) => void;
  options: CompactFilterOption[];
  accent?: FilterAccent;
  ariaLabel?: string;
  className?: string;
}

const ACCENT_STYLES: Record<FilterAccent, { select: string; icon: string }> = {
  neutral: {
    select:
      'bg-white border-[#D6DDD8] text-[#26352D] hover:bg-[#FAFBF8] focus:border-[#24875B]',
    icon: 'text-[#5E6D64]',
  },
  green: {
    select:
      'bg-[#EAF5EE] border-[#BFE0CD] text-[#1D734C] hover:bg-[#E1F1E7] focus:border-[#24875B]',
    icon: 'text-[#24875B]',
  },
  red: {
    select:
      'bg-[#FCECEC] border-[#F2C6C6] text-[#B83838] hover:bg-[#F9E2E2] focus:border-[#C44545]',
    icon: 'text-[#C44545]',
  },
};

export const CompactFilter: React.FC<CompactFilterProps> = ({
  value,
  onChange,
  options,
  accent = 'neutral',
  ariaLabel,
  className = '',
}) => {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className={`relative inline-flex items-center shrink-0 min-w-0 ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={`appearance-none cursor-pointer h-[34px] pl-2 pr-5.5 sm:pl-2.5 sm:pr-6 rounded-xl border text-[11px] sm:text-[11.5px] font-semibold leading-none outline-none transition-colors max-w-[104px] sm:max-w-[148px] truncate ${styles.select}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-[#26352D]">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`w-3.5 h-3.5 pointer-events-none absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 ${styles.icon}`}
      />
    </div>
  );
};

interface SearchToggleProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  ariaLabel?: string;
  /** When true, only renders the magnifying glass trigger button (input rendered separately by ListToolbar). */
  buttonOnly?: boolean;
}

export const SearchToggle: React.FC<SearchToggleProps> = ({
  value,
  onChange,
  placeholder = 'Buscar...',
  isOpen: controlledOpen,
  onOpenChange,
  ariaLabel = 'Buscar',
  buttonOnly = false,
}) => {
  const [internalOpen, setInternalOpen] = useState(Boolean(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (open && !buttonOnly) {
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
      return () => window.clearTimeout(id);
    }
  }, [open, buttonOnly]);

  const handleToggle = () => {
    if (open) {
      if (value) onChange('');
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  const handleClose = () => {
    if (value) onChange('');
    setOpen(false);
  };

  if (buttonOnly || !open) {
    const active = open || Boolean(value);
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`h-[34px] w-[34px] shrink-0 rounded-xl border inline-flex items-center justify-center transition-colors ${
          active
            ? 'bg-[#EAF5EE] border-[#BFE0CD] text-[#24875B]'
            : 'bg-white border-[#D6DDD8] text-[#5E6D64] hover:bg-[#FAFBF8] hover:text-[#26352D]'
        }`}
      >
        <Search className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="relative flex items-center flex-1 min-w-0">
      <Search className="w-3.5 h-3.5 text-[#7A8780] absolute left-3 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[36px] pl-8 pr-8 rounded-xl border border-[#C9D3CD] bg-white text-[13px] text-[#26352D] placeholder:text-[#8A968F] outline-none focus:border-[#24875B] transition-colors"
      />
      <button
        type="button"
        onClick={handleClose}
        aria-label="Cerrar búsqueda"
        className="absolute right-1.5 h-6 w-6 rounded-lg inline-flex items-center justify-center text-[#7A8780] hover:text-[#26352D] hover:bg-[#EFF2EF] transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

interface ListToolbarProps {
  title?: string;
  countLabel?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  className?: string;
}

export const ListToolbar: React.FC<ListToolbarProps> = ({
  title,
  countLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  filters,
  className = '',
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasSearch = searchValue !== undefined && onSearchChange !== undefined;

  useEffect(() => {
    if (searchOpen) {
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
      return () => window.clearTimeout(id);
    }
  }, [searchOpen]);

  const handleCloseSearch = () => {
    if (onSearchChange && searchValue) {
      onSearchChange('');
    }
    setSearchOpen(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-baseline gap-1.5 min-w-0">
          {title && (
            <h2 className="text-[13px] font-semibold text-[#26352D] truncate">{title}</h2>
          )}
          {countLabel && (
            <span className="text-[11.5px] font-medium text-[#7A8780] whitespace-nowrap shrink-0">
              {countLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          {hasSearch && (
            <SearchToggle
              value={searchValue}
              onChange={onSearchChange}
              isOpen={searchOpen}
              onOpenChange={setSearchOpen}
              buttonOnly
              ariaLabel="Buscar en la lista"
            />
          )}
          {filters}
        </div>
      </div>

      {hasSearch && searchOpen && (
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#7A8780] absolute left-3 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-[38px] pl-9 pr-9 rounded-xl border border-[#C9D3CD] bg-white text-[13px] text-[#26352D] placeholder:text-[#8A968F] outline-none focus:border-[#24875B] transition-colors"
          />
          <button
            type="button"
            onClick={handleCloseSearch}
            aria-label="Cerrar búsqueda"
            className="absolute right-1.5 h-7 w-7 rounded-lg inline-flex items-center justify-center text-[#7A8780] hover:text-[#26352D] hover:bg-[#EFF2EF] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

interface CompactListProps {
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  className?: string;
}

export const CompactList: React.FC<CompactListProps> = ({
  children,
  isEmpty = false,
  emptyMessage = 'No hay registros para mostrar.',
  emptyIcon,
  className = '',
}) => {
  if (isEmpty) {
    return (
      <div
        className={`rounded-2xl border border-[#E2E7E3] bg-white px-4 py-7 text-center ${className}`}
      >
        {emptyIcon && <div className="flex justify-center mb-2 text-[#A5B1AA]">{emptyIcon}</div>}
        <p className="text-[13px] font-medium text-[#7A8780]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden divide-y divide-[#EFF2EF] ${className}`}
    >
      {children}
    </div>
  );
};

interface CompactListRowProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightPrimary?: React.ReactNode;
  rightSecondary?: React.ReactNode;
  rightActions?: React.ReactNode;
  chevron?: 'right' | 'down' | 'up' | 'none';
  isExpanded?: boolean;
  expandedContent?: React.ReactNode;
  onClick?: () => void;
  muted?: boolean;
  className?: string;
}

export const CompactListRow: React.FC<CompactListRowProps> = ({
  icon,
  title,
  subtitle,
  rightPrimary,
  rightSecondary,
  rightActions,
  chevron,
  isExpanded = false,
  expandedContent,
  onClick,
  muted = false,
  className = '',
}) => {
  const resolvedChevron =
    chevron !== undefined
      ? chevron
      : expandedContent !== undefined
      ? isExpanded
        ? 'up'
        : 'down'
      : onClick
      ? 'right'
      : 'none';

  const rowInner = (
    <>
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-[#26352D] leading-snug truncate">
          {title}
        </div>
        {subtitle && (
          <div className="text-[11.5px] text-[#5E6D64] leading-snug mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>

      {(rightPrimary || rightSecondary) && (
        <div className="text-right shrink-0 pl-1">
          {rightPrimary && (
            <div className="text-[13px] font-bold leading-snug tabular-nums whitespace-nowrap">
              {rightPrimary}
            </div>
          )}
          {rightSecondary && (
            <div className="text-[11px] text-[#7A8780] leading-snug mt-0.5 tabular-nums whitespace-nowrap">
              {rightSecondary}
            </div>
          )}
        </div>
      )}

      {rightActions && <div className="shrink-0 flex items-center gap-1.5">{rightActions}</div>}

      {resolvedChevron !== 'none' && (
        <div className="shrink-0 text-[#9AA69F]">
          {resolvedChevron === 'right' && <ChevronRight className="w-4 h-4" />}
          {resolvedChevron === 'down' && <ChevronDown className="w-4 h-4" />}
          {resolvedChevron === 'up' && <ChevronUp className="w-4 h-4" />}
        </div>
      )}
    </>
  );

  return (
    <div className={`${muted ? 'opacity-65 bg-[#FAFBF8]/60' : ''} ${className}`}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="w-full min-h-[54px] px-3.5 py-2.5 flex items-center gap-2.5 text-left hover:bg-[#FAFBF8] active:bg-[#F2F5F3] transition-colors"
        >
          {rowInner}
        </button>
      ) : (
        <div className="w-full min-h-[54px] px-3.5 py-2.5 flex items-center gap-2.5">
          {rowInner}
        </div>
      )}

      {isExpanded && expandedContent && (
        <div className="bg-[#FAFBF8] border-t border-[#EFF2EF] px-3.5 py-3">
          {expandedContent}
        </div>
      )}
    </div>
  );
};
