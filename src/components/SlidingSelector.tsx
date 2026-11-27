import React from 'react';

export interface SlidingSelectorOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SlidingSelectorProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SlidingSelectorOption<T>[];
  ariaLabel: string;
  className?: string;
}

/**
 * Continuous horizontal sliding selector bar.
 * - Single seamless bar (zero gaps between options)
 * - Smooth sliding green active indicator (#24875B)
 * - Compact 36px height (h-9) optimized for 320px–430px mobile viewports
 * - Small icon beside label (never stacked above)
 */
export function SlidingSelector<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: SlidingSelectorProps<T>) {
  const count = Math.max(1, options.length);
  const activeIdx = Math.max(
    0,
    options.findIndex((opt) => opt.value === value)
  );

  const gridColsClass =
    count === 2
      ? 'grid-cols-2'
      : count === 3
      ? 'grid-cols-3'
      : count === 4
      ? 'grid-cols-4'
      : 'grid-cols-1';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`relative grid ${gridColsClass} w-full h-9 rounded-xl bg-[#EDF1EE] border border-[#DDE4DF] p-[3px] select-none ${className}`}
    >
      {/* Smooth sliding green indicator */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] rounded-[9px] bg-[#24875B] shadow-xs transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 6px) / ${count})`,
          transform: `translateX(${activeIdx * 100}%)`,
        }}
      />

      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              if (!isActive) onChange(opt.value);
            }}
            className={`relative z-10 inline-flex items-center justify-center gap-1 min-w-0 px-1.5 h-full rounded-[9px] text-[12px] sm:text-[13px] leading-none whitespace-nowrap transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24875B]/40 ${
              isActive
                ? 'text-white font-bold'
                : 'text-[#44544C] hover:text-[#1F2D25] font-semibold'
            }`}
          >
            {opt.icon && (
              <span
                className={`inline-flex items-center justify-center shrink-0 ${
                  isActive ? 'text-white' : 'text-[#526058]'
                }`}
              >
                {opt.icon}
              </span>
            )}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
