import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Clock, Search, User, X } from 'lucide-react';
import type { Customer } from '../types';
import { useI18n } from '../services/i18n';
import { FORM_LABEL_CLASS, sanitizeFieldLabel } from './AppSelect';

interface CustomerPickerProps {
  label: string;
  customers: Customer[];
  selectedCustomerId: string;
  isPending?: boolean;
  onSelectCustomer: (customer: Customer) => void;
  onSelectPending?: () => void;
  allowPending?: boolean;
  pendingLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  optionalText?: string;
  includeInactiveSelected?: boolean;
}

/**
 * Compact 40px single-line selector for the centralized Customer catalog.
 * Supports explicit "Pending customer / buyer" selection without allowing free text.
 */
export const CustomerPicker: React.FC<CustomerPickerProps> = ({
  label,
  customers,
  selectedCustomerId,
  isPending = false,
  onSelectCustomer,
  onSelectPending,
  allowPending = false,
  pendingLabel,
  placeholder,
  required = false,
  disabled = false,
  optionalText,
  includeInactiveSelected = true,
}) => {
  const { bi } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(selectedCustomerId)) || null,
    [customers, selectedCustomerId]
  );

  const visibleCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (!c.activo && !(includeInactiveSelected && String(c.id) === String(selectedCustomerId))) {
          return false;
        }
        if (!q) return true;
        return `${c.nombre} ${c.telefono || ''} ${c.direccion || ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [customers, search, includeInactiveSelected, selectedCustomerId]);

  const effectivePendingLabel = pendingLabel || bi('Cliente pendiente', 'Pending customer');
  const effectivePlaceholder = placeholder || bi('Seleccionar cliente', 'Select customer');

  const hasValue = Boolean(selectedCustomer) || Boolean(allowPending && isPending);
  const isRequiredEmpty = required && !hasValue;

  const displayLabel = selectedCustomer
    ? selectedCustomer.nombre
    : allowPending && isPending
    ? effectivePendingLabel
    : effectivePlaceholder;

  const cleanLabel = sanitizeFieldLabel(label, required);

  return (
    <div className="w-full">
      <label className={FORM_LABEL_CLASS}>
        {cleanLabel}
        {required ? (
          <span className="text-[#C44545] ml-0.5">*</span>
        ) : optionalText ? (
          <span className="text-[#7A8780] font-normal ml-1">{optionalText}</span>
        ) : null}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setSearch('');
            setOpen(true);
          }
        }}
        className={`w-full h-[40px] px-3 rounded-xl border flex items-center justify-between gap-2 text-left transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
          isRequiredEmpty
            ? 'bg-[#EAF7F0] border-[#86D4AA] text-[#16834A] hover:bg-[#E1F3E9]'
            : allowPending && isPending && !selectedCustomer
            ? 'bg-amber-50/70 border-amber-300 text-amber-900 hover:bg-amber-50'
            : 'bg-white border-[#CFD8D2] text-[#1F2D25] hover:border-[#9EB4A7]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {allowPending && isPending && !selectedCustomer ? (
            <Clock className="h-[17px] w-[17px] shrink-0 text-amber-600" />
          ) : (
            <User
              className={`h-[17px] w-[17px] shrink-0 ${
                isRequiredEmpty ? 'text-[#16834A]' : 'text-[#5E6D64]'
              }`}
            />
          )}
          <span className="text-sm font-semibold truncate">{displayLabel}</span>
        </div>
        <ChevronDown
          className={`h-[17px] w-[17px] shrink-0 ${
            isRequiredEmpty ? 'text-[#16834A]' : 'text-[#5E6D64]'
          }`}
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md max-h-[82dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white border border-[#DCE2DD] shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#E7ECE8] bg-[#F8FAF8]">
              <h3 className="text-sm font-bold text-[#26352D] truncate">{cleanLabel}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={bi('Cerrar', 'Close')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5E6D64] hover:bg-[#EAEFEA] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-[#EFF2EF]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A8780]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={bi('Buscar cliente por nombre...', 'Search customer by name...')}
                  autoFocus
                  className="w-full h-[38px] pl-9 pr-3 rounded-xl border border-[#CFD8D2] bg-[#FAFBF8] text-sm text-[#1F2D25] focus:bg-white focus:border-[#24875B] focus:outline-none"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#EFF2EF]">
              {allowPending && onSelectPending && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectPending();
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-3 flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                    isPending && !selectedCustomer
                      ? 'bg-amber-50 text-amber-900'
                      : 'hover:bg-[#F5F7F4] text-[#26352D]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{effectivePendingLabel}</p>
                      <p className="text-[11px] text-[#64746B] truncate">
                        {bi(
                          'Guardar sin cliente asignado para completar después',
                          'Save without customer to complete later'
                        )}
                      </p>
                    </div>
                  </div>
                  {isPending && !selectedCustomer && (
                    <Check className="h-4 w-4 shrink-0 text-amber-700" />
                  )}
                </button>
              )}

              {visibleCustomers.length === 0 ? (
                <div className="px-4 py-8 text-center space-y-1">
                  <p className="text-sm font-semibold text-[#4B5A52]">
                    {search.trim()
                      ? bi('No se encontraron clientes.', 'No customers found.')
                      : bi('No hay clientes registrados.', 'No customers registered.')}
                  </p>
                  <p className="text-xs text-[#7A8780]">
                    {bi(
                      'Registra nuevos clientes en Administración → Clientes.',
                      'Register new customers in Administration → Customers.'
                    )}
                  </p>
                </div>
              ) : (
                visibleCustomers.map((c) => {
                  const active = String(c.id) === String(selectedCustomerId);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectCustomer(c);
                        setOpen(false);
                      }}
                      className={`w-full px-4 py-3 flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                        active ? 'bg-[#EAF5EE] text-[#1D5C3F]' : 'hover:bg-[#F5F7F4] text-[#26352D]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {c.nombre}
                          {!c.activo && (
                            <span className="ml-1.5 text-[11px] font-medium text-[#7A8780]">
                              ({bi('Inactivo', 'Inactive')})
                            </span>
                          )}
                        </p>
                        {(c.telefono || c.direccion) && (
                          <p className="text-xs text-[#64746B] truncate">
                            {[c.telefono, c.direccion].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      {active && <Check className="h-4 w-4 shrink-0 text-[#24875B]" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
