import React from 'react';
import { ConfirmationModal } from './ConfirmationModal';
import { DuplicateCheckResult, DuplicateMatchItem } from '../types';
import { useI18n } from '../services/i18n';
import { formatDateLocale, formatMoneyLocale, formatNumberLocale } from '../services/formatters';

export interface DuplicateWarningModalProps {
  duplicateCheck: DuplicateCheckResult | null;
  isConfirming: boolean;
  errorMsg?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  duplicateCheck,
  isConfirming,
  errorMsg,
  onCancel,
  onConfirm,
}) => {
  const { lang, bi, translateUnit } = useI18n();
  const isOpen = Boolean(duplicateCheck && duplicateCheck.matches && duplicateCheck.matches.length > 0);

  if (!isOpen || !duplicateCheck) return null;

  const renderMatchCard = (m: DuplicateMatchItem, idx: number) => {
    const fechaLabel = formatDateLocale(m.fecha, lang);
    const isJob = m.entityType === 'service_external' || m.entityType === 'job_property';
    const isHarvest = m.entityType === 'harvest';
    const isExpense = m.entityType === 'expense' || m.entityType === 'expense_allocated';

    let primaryLabel = '';
    if (isJob) {
      primaryLabel = [m.maquinariaNombre, m.implementoNombre].filter(Boolean).join(' · ') || bi('Maquinaria', 'Machinery');
    } else if (isHarvest) {
      primaryLabel = m.productoNombre || m.conceptoNombre || bi('Cosecha', 'Harvest');
    } else {
      primaryLabel = m.conceptoNombre || bi('Gasto', 'Expense');
    }

    const partyOrTarget = (() => {
      if (m.entityType === 'service_external') {
        if (m.clientePendiente || !m.clienteNombre) return bi('Cliente pendiente', 'Pending customer');
        return m.clienteNombre;
      }
      if (m.entityType === 'job_property' || isHarvest) {
        return m.loteNombre || '—';
      }
      if (m.entityType === 'expense_allocated') {
        return m.lotesResumen || m.loteNombre || bi('Múltiples lotes', 'Multiple lots');
      }
      return [m.maquinariaNombre, m.implementoNombre, m.loteNombre].filter(Boolean).join(' · ');
    })();

    const hasQty = typeof m.cantidad === 'number' && Number.isFinite(m.cantidad) && m.cantidad > 0;
    const isWholeQty = hasQty && Math.abs((m.cantidad as number) - Math.round(m.cantidad as number)) < 0.0001;
    const qtyLabel = hasQty
      ? `${formatNumberLocale(m.cantidad as number, lang, isWholeQty ? 0 : 2)}${m.unidad ? ` ${translateUnit(m.unidad)}` : ''}`
      : '';

    const hasAmount = !isHarvest && typeof m.importe === 'number' && Number.isFinite(m.importe) && m.importe >= 0 && m.moneda;
    const amountLabel = hasAmount ? formatMoneyLocale(m.importe as number, m.moneda as 'BOB' | 'USD', lang) : '';

    return (
      <div
        key={m.id || idx}
        className="rounded-xl bg-[#FAFBF8] border border-[#E2E7E3] px-3 py-2.5 space-y-1.5 text-xs"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#26352D] truncate">{primaryLabel}</p>
            {partyOrTarget && (
              <p className="text-[11px] text-[#5E6D64] truncate">{partyOrTarget}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <span className="inline-block font-semibold text-[#26352D] tabular-nums">{fechaLabel}</span>
            {m.campanaNombre && (
              <p className="text-[10px] text-[#6B7A71] truncate max-w-[120px]">{m.campanaNombre}</p>
            )}
          </div>
        </div>

        {(qtyLabel || amountLabel) && (
          <div className="flex items-center justify-between gap-2 border-t border-[#E2E7E3]/80 pt-1.5 text-[11px]">
            <span className="text-[#5E6D64] tabular-nums">
              {qtyLabel || (isExpense ? bi('Gasto registrado', 'Recorded expense') : '')}
            </span>
            {amountLabel && (
              <span className="font-bold text-[#26352D] tabular-nums">{amountLabel}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const count = duplicateCheck.matches.length;
  const countLabel =
    count === 1
      ? bi('1 registro coincidente', '1 matching record')
      : bi(`${count} registros coincidentes`, `${count} matching records`);

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onCancel}
      type="warning"
      zIndexClass="z-[70]"
      title={bi('Posible registro duplicado', 'Possible duplicate record')}
      subtitle={countLabel}
      message={bi(
        'Ya existe un registro similar dentro de un rango de 30 días. Verifica que no estés registrando nuevamente la misma operación.',
        'A similar record already exists within a 30-day range. Please verify you are not recording the same operation again.'
      )}
      bodyContent={
        <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-0.5">
          {duplicateCheck.matches.map(renderMatchCard)}
        </div>
      }
      errorMsg={errorMsg}
      onConfirm={onConfirm}
      cancelText={bi('Cancelar', 'Cancel')}
      confirmText={bi('Avanzar', 'Continue')}
      confirmTone="amber"
      isConfirming={isConfirming}
    />
  );
};
