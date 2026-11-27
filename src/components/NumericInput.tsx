import React, { useState, useEffect } from 'react';
import { useI18n } from '../services/i18n';
import { FORM_INPUT_CLASS } from './AppSelect';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string;
  onChange: (value: string) => void;
  allowDecimals?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  className = '',
  allowDecimals = true,
  ...props
}) => {
  const { lang } = useI18n();
  const isEn = lang === 'en';
  const thousandSep = isEn ? ',' : '.';
  const decimalSep = isEn ? '.' : ',';

  const formatDisplay = (raw: string | number): string => {
    if (raw === undefined || raw === null || raw === '') return '';
    const str = String(raw);
    const parts = str.split(/[.,]/);
    const intPart = parts[0].replace(/\D/g, '');
    if (!intPart && parts.length <= 1) return str;

    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);

    if (parts.length > 1 && allowDecimals) {
      const decPart = parts.slice(1).join('').replace(/\D/g, '');
      const hasTrailingSeparator = str.endsWith('.') || str.endsWith(',');
      return `${formattedInt}${decimalSep}${decPart}${hasTrailingSeparator && !decPart ? '' : ''}`;
    }
    return formattedInt;
  };

  const [displayValue, setDisplayValue] = useState(() => formatDisplay(value));

  useEffect(() => {
    const parseToRaw = (disp: string): number => {
      if (!disp) return 0;
      const cleaned = disp.replace(new RegExp(`\\${thousandSep}`, 'g'), '').replace(new RegExp(`\\${decimalSep}`), '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    const currentParsed = parseToRaw(displayValue);
    const newParsed = parseToRaw(String(value ?? ''));
    if (Math.abs(currentParsed - newParsed) > 0.000001 || (value === '' && displayValue !== '')) {
      setDisplayValue(formatDisplay(value));
    }
  }, [value, lang, thousandSep, decimalSep]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    setDisplayValue(rawInput);

    const normalized = rawInput
      .replace(new RegExp(`\\${thousandSep}`, 'g'), '')
      .replace(new RegExp(`\\${decimalSep}`), '.');

    onChange(normalized);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      className={`${FORM_INPUT_CLASS} ${className}`}
      {...props}
    />
  );
};
