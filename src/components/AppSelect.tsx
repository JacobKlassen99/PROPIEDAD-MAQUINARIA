import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Currency } from '../types';
import { useI18n } from '../services/i18n';
import { Switch } from './Switch';

export const FORM_LABEL_CLASS = 'block text-[13px] font-semibold text-[#26352D] mb-1 leading-tight';

export const FORM_INPUT_CLASS =
  'w-full h-[40px] px-3 text-sm font-medium text-[#1F2D25] rounded-xl border border-[#CFD8D2] bg-white placeholder:text-[#8A9890] focus:border-[#24875B] focus:ring-2 focus:ring-[#24875B]/15 focus:outline-none transition disabled:opacity-60 disabled:cursor-not-allowed';

export const FORM_TEXTAREA_CLASS =
  'w-full px-3 py-2 text-sm font-medium text-[#1F2D25] rounded-xl border border-[#CFD8D2] bg-white placeholder:text-[#8A9890] focus:border-[#24875B] focus:ring-2 focus:ring-[#24875B]/15 focus:outline-none transition disabled:opacity-60 disabled:cursor-not-allowed';

export function sanitizeFieldLabel(label: string, required?: boolean): string {
  let clean = label.trim();
  if (required) {
    clean = clean.replace(/\s*\*+$/, '').trim();
  }
  return clean;
}

interface AppSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  optionalText?: string;
  icon?: React.ReactNode;
}

export const AppSelect: React.FC<AppSelectProps> = ({
  label,
  required = false,
  optionalText,
  icon,
  value,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const isEmpty = value === undefined || value === null || String(value).trim() === '';
  const isUnselectedRequired = required && isEmpty && !disabled;
  const isUnselectedOptional = !required && isEmpty && !disabled;

  const cleanLabel = label ? sanitizeFieldLabel(label, required) : '';

  return (
    <div className="w-full min-w-0">
      {cleanLabel && (
        <div className="flex items-center justify-between gap-1 mb-1">
          <label className="block text-[13px] font-semibold text-[#26352D] truncate">
            {cleanLabel}
            {required && <span className="text-[#C44545] ml-0.5">*</span>}
          </label>
          {optionalText && (
            <span className="text-[12px] text-[#7A8780] font-normal shrink-0">{optionalText}</span>
          )}
        </div>
      )}
      <div className="relative">
        {icon && (
          <div
            className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center ${
              isUnselectedRequired
                ? 'text-[#16834A]'
                : isUnselectedOptional
                ? 'text-[#64746B]'
                : 'text-[#3B6B55]'
            }`}
          >
            {icon}
          </div>
        )}
        <select
          value={value}
          required={required}
          disabled={disabled}
          className={`w-full h-[40px] text-sm font-semibold rounded-xl border transition appearance-none cursor-pointer py-1.5 pr-9 truncate focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
            icon ? 'pl-9' : 'pl-3'
          } ${
            isUnselectedRequired
              ? 'border-[#86D4AA] bg-[#EAF7F0] text-[#16834A] hover:bg-[#DEF3E7] focus:border-[#24875B]'
              : isUnselectedOptional
              ? 'border-[#C8D4CC] bg-[#F4F7F5] text-[#5B6B62] hover:bg-[#EDF2EE] focus:border-[#24875B]'
              : 'border-[#CFD8D2] bg-white text-[#1F2D25] hover:border-[#24875B] focus:border-[#24875B] focus:ring-2 focus:ring-[#24875B]/15'
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <div
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center ${
            isUnselectedRequired
              ? 'text-[#16834A]'
              : isUnselectedOptional
              ? 'text-[#64746B]'
              : 'text-[#5E6D64]'
          }`}
        >
          <ChevronDown className="h-[17px] w-[17px]" />
        </div>
      </div>
    </div>
  );
};

interface CurrencySelectProps {
  label?: string;
  value: Currency;
  onChange: (currency: Currency) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const CurrencySelect: React.FC<CurrencySelectProps> = ({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
}) => {
  const { t } = useI18n();
  return (
    <Switch<Currency>
      label={label ?? t('common.currency')}
      required={required}
      disabled={disabled}
      value={value}
      onChange={onChange}
      leftOption={{ value: 'USD', label: 'USD' }}
      rightOption={{ value: 'BOB', label: 'Bs' }}
      className={className}
    />
  );
};
