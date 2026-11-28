import React from 'react';
import { VisualIcon } from './VisualIcon';
import { ConceptBreakdownRow } from '../services/financialSummary';
import { formatNumberLocale } from '../services/formatters';
import { useI18n } from '../services/i18n';

function getNetColorClass(value: number): string {
  if (value > 0.004) return 'text-[#24875B]';
  if (value < -0.004) return 'text-[#C44545]';
  return 'text-[#26352D]';
}

function getNetBgClass(value: number): string {
  if (value > 0.004) return 'bg-[#EAF5EE] border-[#24875B]/25';
  if (value < -0.004) return 'bg-[#FCECEC] border-[#C44545]/25';
  return 'bg-slate-50 border-slate-200';
}

interface ConceptBreakdownSectionProps {
  title: string;
  variant: 'income' | 'expense';
  rows: ConceptBreakdownRow[];
  total: number;
  totalLabel: string;
  emptyText: string;
  fmt: (val: number) => string;
}

export const ConceptBreakdownSection: React.FC<ConceptBreakdownSectionProps> = ({
  title,
  variant,
  rows,
  total,
  totalLabel,
  emptyText,
  fmt,
}) => {
  const { bi } = useI18n();
  const isIncome = variant === 'income';
  const accentText = isIncome ? 'text-[#24875B]' : 'text-[#C44545]';
  const headerBg = isIncome ? 'bg-[#EAF5EE]/55' : 'bg-[#FCECEC]/55';
  const totalBg = isIncome ? 'bg-[#EAF5EE]/65' : 'bg-[#FCECEC]/65';

  return (
    <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden print:break-inside-avoid">
      <div className={`px-3.5 py-2 border-b border-[#EFF2EF] ${headerBg} flex items-center justify-between gap-2`}>
        <h3 className={`text-xs sm:text-sm font-bold ${accentText}`}>{title}</h3>
      </div>

      {rows.length > 0 ? (
        <div className="divide-y divide-[#EFF2EF]">
          {rows.map((row) => (
            <div
              key={row.key}
              className="px-3.5 py-2 flex items-center justify-between gap-2.5 text-xs sm:text-sm"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <VisualIcon
                  iconId={row.iconId}
                  nameHint={row.label}
                  category={row.iconCategory}
                  size={26}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[#26352D] truncate leading-tight">
                    {row.label}
                    {row.isInactive && (
                      <span className="ml-1.5 text-[10px] font-medium text-[#7A8780]">
                        ({bi('Inactivo', 'Inactive')})
                      </span>
                    )}
                  </p>
                  {row.sublabel && (
                    <p className="text-[10px] text-[#7A8780] truncate leading-tight">
                      {row.sublabel}
                    </p>
                  )}
                </div>
              </div>
              <span className={`font-semibold tabular-nums shrink-0 ${accentText}`}>
                {fmt(row.amount)}
              </span>
            </div>
          ))}

          <div
            className={`px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm ${totalBg}`}
          >
            <span className={`font-bold ${accentText}`}>{totalLabel}</span>
            <span className={`font-extrabold tabular-nums shrink-0 ${accentText}`}>
              {fmt(total)}
            </span>
          </div>
        </div>
      ) : (
        <p className="px-3.5 py-4 text-xs text-[#7A8780] text-center">{emptyText}</p>
      )}
    </div>
  );
};

interface PropertyAccountingSummaryCardProps {
  title?: string;
  totalIngresos: number;
  totalGastosDirectos: number;
  totalGastosMaquinaria: number;
  totalGastos: number;
  resultadoNeto: number;
  fmt: (val: number) => string;
}

export const PropertyAccountingSummaryCard: React.FC<PropertyAccountingSummaryCardProps> = ({
  title,
  totalIngresos,
  totalGastosDirectos,
  totalGastosMaquinaria,
  totalGastos,
  resultadoNeto,
  fmt,
}) => {
  const { t, bi } = useI18n();

  return (
    <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden print:break-inside-avoid">
      <div className="px-3.5 py-2 border-b border-[#EFF2EF] bg-[#F8FAF8] flex items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-bold text-[#26352D]">
          {title || bi('Resumen contable', 'Accounting summary')}
        </h3>
      </div>

      <div className="divide-y divide-[#EFF2EF] text-xs sm:text-sm">
        <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
          <span className="font-medium text-[#26352D]">{t('reports.incomes')}</span>
          <span className="font-bold text-[#24875B] tabular-nums shrink-0">
            {fmt(totalIngresos)}
          </span>
        </div>
        <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
          <span className="text-[#5E6D64]">{bi('Gastos directos', 'Direct expenses')}</span>
          <span className="font-semibold text-[#C44545] tabular-nums shrink-0">
            {fmt(totalGastosDirectos)}
          </span>
        </div>
        <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
          <span className="text-[#5E6D64]">{bi('Maquinaria recibida', 'Machinery received')}</span>
          <span className="font-semibold text-[#C44545] tabular-nums shrink-0">
            {fmt(totalGastosMaquinaria)}
          </span>
        </div>
        <div className="px-3.5 py-2.5 bg-[#FCECEC]/40 flex items-center justify-between gap-2">
          <span className="font-bold text-[#C44545]">{bi('Gastos totales', 'Total expenses')}</span>
          <span className="font-extrabold text-[#C44545] tabular-nums shrink-0">
            {fmt(totalGastos)}
          </span>
        </div>
        <div
          className={`px-3.5 py-3 flex items-center justify-between gap-2 ${getNetBgClass(
            resultadoNeto
          )}`}
        >
          <span className="font-bold text-[#26352D]">{t('reports.netResult')}</span>
          <span
            className={`text-sm sm:text-base font-extrabold tabular-nums shrink-0 ${getNetColorClass(
              resultadoNeto
            )}`}
          >
            {fmt(resultadoNeto)}
          </span>
        </div>
      </div>
    </div>
  );
};

interface PerHectareIndicatorsSectionProps {
  totalHectares: number;
  ingresoPorHa: number | null;
  gastoPorHa: number | null;
  resultadoPorHa: number | null;
  fmt: (val: number) => string;
}

export const PerHectareIndicatorsSection: React.FC<PerHectareIndicatorsSectionProps> = ({
  totalHectares,
  ingresoPorHa,
  gastoPorHa,
  resultadoPorHa,
  fmt,
}) => {
  const { lang, bi } = useI18n();
  if (ingresoPorHa === null && gastoPorHa === null && resultadoPorHa === null) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#E2E7E3] bg-white overflow-hidden print:break-inside-avoid">
      <div className="px-3.5 py-2 border-b border-[#EFF2EF] bg-[#F8FAF8] flex items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-bold text-[#26352D]">
          {bi('Indicadores por hectárea', 'Per-hectare indicators')}
        </h3>
        {totalHectares > 0 && (
          <span className="text-[11px] font-semibold text-[#5E6D64] tabular-nums shrink-0">
            {formatNumberLocale(totalHectares, lang, 1)} ha
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-[#EFF2EF] text-center tabular-nums">
        <div className="px-2 py-2.5 min-w-0">
          <span className="block text-[11px] text-[#5E6D64] truncate">
            {bi('Ingreso/ha', 'Income/ha')}
          </span>
          <strong className="block text-xs sm:text-sm font-bold text-[#24875B] mt-0.5 truncate">
            {ingresoPorHa !== null ? fmt(ingresoPorHa) : '—'}
          </strong>
        </div>
        <div className="px-2 py-2.5 min-w-0">
          <span className="block text-[11px] text-[#5E6D64] truncate">
            {bi('Gasto/ha', 'Expense/ha')}
          </span>
          <strong className="block text-xs sm:text-sm font-bold text-[#C44545] mt-0.5 truncate">
            {gastoPorHa !== null ? fmt(gastoPorHa) : '—'}
          </strong>
        </div>
        <div className="px-2 py-2.5 min-w-0">
          <span className="block text-[11px] text-[#5E6D64] truncate">
            {bi('Resultado/ha', 'Result/ha')}
          </span>
          <strong
            className={`block text-xs sm:text-sm font-bold mt-0.5 truncate ${
              resultadoPorHa !== null ? getNetColorClass(resultadoPorHa) : 'text-[#5E6D64]'
            }`}
          >
            {resultadoPorHa !== null ? fmt(resultadoPorHa) : '—'}
          </strong>
        </div>
      </div>
    </div>
  );
};
