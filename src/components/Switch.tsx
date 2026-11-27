import React from 'react';
import { FORM_LABEL_CLASS, sanitizeFieldLabel } from './AppSelect';

export interface SwitchOption<T extends string | boolean> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SwitchProps<T extends string | boolean> {
  value: T;
  onChange: (value: T) => void;
  leftOption?: SwitchOption<T>;
  rightOption?: SwitchOption<T>;
  label?: string;
  description?: string;
  required?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  /**
   * 'auto' (default): renders a conventional ON/OFF toggle when value is boolean,
   * and a dual-labeled toggle (Left [track+knob] Right) when value is a string.
   */
  mode?: 'auto' | 'boolean' | 'dual';
  /**
   * When true (boolean mode), renders label on the left and the toggle switch on the right
   * on a single compact horizontal row.
   */
  inline?: boolean;
  className?: string;
}

/**
 * Reusable genuine toggle Switch component.
 * - Dual-option string mode (e.g. USD / Bs): Left label + compact rounded green track with sliding white circle + Right label.
 * - Boolean mode (e.g. Late interest, Show zero-balance): Conventional ON/OFF rounded track (gray OFF, green ON) with sliding white circle.
 */
export function Switch<T extends string | boolean>({
  value,
  onChange,
  leftOption,
  rightOption,
  label,
  description,
  required = false,
  ariaLabel,
  disabled = false,
  size = 'md',
  mode = 'auto',
  inline = false,
  className = '',
}: SwitchProps<T>) {
  const isBooleanMode = mode === 'boolean' || (mode === 'auto' && typeof value === 'boolean');
  const cleanLabel = label ? sanitizeFieldLabel(label, required) : '';
  const heightClass = size === 'sm' ? 'h-[36px]' : 'h-[40px]';

  // ------------------------------------------------------------------
  // 1. CONVENTIONAL BOOLEAN ON/OFF SWITCH
  // ------------------------------------------------------------------
  if (isBooleanMode) {
    const checked = Boolean(value);
    const activeText = checked
      ? rightOption?.label || 'Sí'
      : leftOption?.label || 'No';

    const toggleBoolean = () => {
      if (disabled) return;
      if (checked && leftOption?.disabled) return;
      if (!checked && rightOption?.disabled) return;
      const nextVal = (checked ? (leftOption ? leftOption.value : false) : (rightOption ? rightOption.value : true)) as T;
      onChange(nextVal);
    };

    const track = (
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
          checked ? 'bg-[#24875B]' : 'bg-[#CBD5CF]'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    );

    if (inline) {
      return (
        <div
          className={`flex items-center justify-between gap-3 w-full min-w-0 ${
            disabled ? 'opacity-60' : ''
          } ${className}`}
        >
          <div className="min-w-0 flex-1">
            {cleanLabel && (
              <span
                onClick={toggleBoolean}
                className={`block text-[13px] font-semibold text-[#26352D] leading-snug ${
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {cleanLabel}
                {required && <span className="text-[#C44545] ml-0.5">*</span>}
              </span>
            )}
            {description && (
              <span className="block text-[11px] text-[#64746B] mt-0.5 leading-snug">
                {description}
              </span>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel || cleanLabel || activeText}
            disabled={disabled}
            onClick={toggleBoolean}
            className="inline-flex items-center gap-2 shrink-0 min-h-[36px] pl-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24875B]/40 rounded-full cursor-pointer disabled:cursor-not-allowed"
          >
            {track}
          </button>
        </div>
      );
    }

    // Form-field aligned boolean switch (keeps exact 40px field height beside grid inputs)
    return (
      <div className={`w-full min-w-0 ${className}`}>
        {cleanLabel && (
          <label className={`${FORM_LABEL_CLASS} whitespace-nowrap truncate`}>
            {cleanLabel}
            {required && <span className="text-[#C44545] ml-0.5">*</span>}
          </label>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel || cleanLabel || activeText}
          disabled={disabled}
          onClick={toggleBoolean}
          className={`w-full ${heightClass} px-3 rounded-xl border bg-white flex items-center justify-between gap-2.5 transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24875B]/25 ${
            checked ? 'border-[#24875B]/45 bg-[#F6FBF8]' : 'border-[#CFD8D2] bg-white'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-[#24875B]/60'}`}
        >
          <span
            className={`text-xs sm:text-[13px] font-bold truncate transition-colors ${
              checked ? 'text-[#175B3D]' : 'text-[#5E6D64]'
            }`}
          >
            {activeText}
          </span>
          {track}
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 2. DUAL-LABELED TOGGLE SWITCH (e.g. USD [●—] Bs)
  // ------------------------------------------------------------------
  if (!leftOption || !rightOption) {
    return null;
  }

  const isRightSelected = value === rightOption.value;

  const handleSelect = (opt: SwitchOption<T>) => {
    if (disabled || opt.disabled) return;
    if (opt.value !== value) {
      onChange(opt.value);
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    const target = isRightSelected ? leftOption : rightOption;
    if (target.disabled) return;
    onChange(target.value);
  };

  const isLeftDisabled = disabled || Boolean(leftOption.disabled);
  const isRightDisabled = disabled || Boolean(rightOption.disabled);

  return (
    <div className={`w-full min-w-0 ${className}`}>
      {cleanLabel && (
        <label className={`${FORM_LABEL_CLASS} whitespace-nowrap truncate`}>
          {cleanLabel}
          {required && <span className="text-[#C44545] ml-0.5">*</span>}
        </label>
      )}
      <div
        role="group"
        aria-label={ariaLabel || cleanLabel || `${leftOption.label} / ${rightOption.label}`}
        aria-disabled={disabled || undefined}
        className={`w-full ${heightClass} ${
          size === 'sm' ? 'px-2 gap-1.5' : 'px-2.5 gap-2.5'
        } rounded-xl border border-[#DCE3DF] bg-[#F8FAF8] flex items-center justify-center select-none transition-opacity ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <button
          type="button"
          disabled={isLeftDisabled}
          onClick={() => handleSelect(leftOption)}
          className={`min-w-0 flex-1 text-right text-xs sm:text-[13px] leading-tight whitespace-nowrap py-1 transition-colors focus-visible:outline-none ${
            isLeftDisabled
              ? !isRightSelected
                ? 'font-extrabold text-[#175B3D] cursor-not-allowed'
                : 'font-medium text-[#95A29B] cursor-not-allowed'
              : !isRightSelected
              ? 'font-extrabold text-[#175B3D] cursor-pointer'
              : 'font-medium text-[#7A8780] hover:text-[#26352D] cursor-pointer'
          }`}
        >
          {leftOption.label}
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={isRightSelected}
          aria-label={ariaLabel || `${leftOption.label} / ${rightOption.label}`}
          disabled={disabled || (isRightSelected ? isLeftDisabled : isRightDisabled)}
          onClick={handleToggle}
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-[#24875B] p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24875B]/40 cursor-pointer disabled:cursor-not-allowed"
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out ${
              isRightSelected ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>

        <button
          type="button"
          disabled={isRightDisabled}
          onClick={() => handleSelect(rightOption)}
          className={`min-w-0 flex-1 text-left text-xs sm:text-[13px] leading-tight whitespace-nowrap py-1 transition-colors focus-visible:outline-none ${
            isRightDisabled
              ? isRightSelected
                ? 'font-extrabold text-[#175B3D] cursor-not-allowed'
                : 'font-medium text-[#95A29B] cursor-not-allowed'
              : isRightSelected
              ? 'font-extrabold text-[#175B3D] cursor-pointer'
              : 'font-medium text-[#7A8780] hover:text-[#26352D] cursor-pointer'
          }`}
        >
          {rightOption.label}
        </button>
      </div>
    </div>
  );
}
