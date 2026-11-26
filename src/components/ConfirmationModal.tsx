import React from 'react';
import { AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { useI18n } from '../services/i18n';

export interface ConfirmationModalMetric {
  label: string;
  value: string | number;
}

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  type?: 'warning' | 'danger' | 'info';
  itemTitle?: string;
  itemSubtitle?: string;
  metrics?: ConfirmationModalMetric[];
  message?: string;
  errorMsg?: string | null;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
  confirmTone?: 'danger' | 'success' | 'amber';
  singleButton?: boolean;
  customActions?: React.ReactNode;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  type = 'warning',
  itemTitle,
  itemSubtitle,
  metrics = [],
  message,
  errorMsg,
  onConfirm,
  confirmText,
  cancelText,
  isConfirming = false,
  confirmTone = 'danger',
  singleButton = false,
  customActions,
}) => {
  const { t, bi } = useI18n();
  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const iconBg = isDanger ? 'bg-[#FCECEC] text-[#C44545]' : 'bg-amber-50 text-amber-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26352D]/45 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm sm:max-w-md rounded-2xl bg-white p-4 sm:p-5 shadow-xl border border-[#E2E7E3] space-y-3.5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            {isDanger ? <Trash2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[#26352D] truncate">{title}</h3>
            {subtitle && <p className="text-xs text-[#5E6D64] truncate">{subtitle}</p>}
          </div>
        </div>

        {/* Item Info Card */}
        {itemTitle && (
          <div className="rounded-xl bg-[#FAFBF8] border border-[#E2E7E3] overflow-hidden">
            <div className="p-3 space-y-0.5">
              <p className="text-xs font-bold text-[#26352D] truncate">{itemTitle}</p>
              {itemSubtitle && <p className="text-[11px] text-[#5E6D64] truncate">{itemSubtitle}</p>}
            </div>
            {metrics.length > 0 && (
              <div className="divide-y divide-[#E2E7E3] border-t border-[#E2E7E3] bg-white px-3 py-1 text-xs">
                {metrics.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <span className="text-[#5E6D64]">{m.label}</span>
                    <span className="font-semibold text-[#26352D] tabular-nums">{m.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="rounded-xl border border-[#C44545]/30 bg-[#FCECEC] px-3 py-2.5 text-xs font-medium text-[#962D2D] flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C44545]" />
            <span className="break-words">{errorMsg}</span>
          </div>
        )}

        {/* Bottom Message */}
        {message && <p className="text-xs text-[#526058] leading-relaxed">{message}</p>}

        {/* Actions / Buttons */}
        <div className="pt-1">
          {customActions ? (
            customActions
          ) : singleButton ? (
            <button
              type="button"
              disabled={isConfirming}
              onClick={onConfirm || onClose}
              className="w-full h-[40px] px-4 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isConfirming && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>{confirmText || bi('Aceptar', 'Accept')}</span>
            </button>
          ) : (
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isConfirming}
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-[#D4DDD6] bg-white text-xs font-semibold text-[#26352D] hover:bg-[#F5F7F4] cursor-pointer min-h-[38px] disabled:opacity-50"
              >
                {cancelText || t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={onConfirm}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition cursor-pointer min-h-[38px] disabled:opacity-50 shadow-xs ${
                  confirmTone === 'success'
                    ? 'bg-[#24875B] hover:bg-[#1D704B]'
                    : confirmTone === 'amber'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[#C44545] hover:bg-[#A93838]'
                }`}
              >
                {isConfirming && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{confirmText || bi('Eliminar', 'Delete')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
