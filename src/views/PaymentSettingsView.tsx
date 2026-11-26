import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, Save } from 'lucide-react';
import type { PaymentSettings } from '../types';
import * as backend from '../services/backend';
import { useI18n } from '../services/i18n';
import { Switch } from '../components/Switch';

interface PaymentSettingsViewProps {
  paymentSettings: PaymentSettings | null;
  onRefresh: () => Promise<void> | void;
  onBack: () => void;
}

export const PaymentSettingsView: React.FC<PaymentSettingsViewProps> = ({
  paymentSettings,
  onRefresh,
  onBack,
}) => {
  const { t, bi } = useI18n();

  const [plazoDias, setPlazoDias] = useState<string>('');
  const [aplicarInteres, setAplicarInteres] = useState<boolean>(false);
  const [tasaMensual, setTasaMensual] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!paymentSettings) return;
    setPlazoDias(
      paymentSettings.plazoDiasPredeterminado !== null && paymentSettings.plazoDiasPredeterminado !== undefined
        ? String(paymentSettings.plazoDiasPredeterminado)
        : ''
    );
    setAplicarInteres(Boolean(paymentSettings.aplicarInteresPorDefecto));
    setTasaMensual(
      paymentSettings.porcentajeInteresMensual !== null && paymentSettings.porcentajeInteresMensual !== undefined
        ? String(paymentSettings.porcentajeInteresMensual)
        : ''
    );
  }, [paymentSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const parsedPlazo = plazoDias.trim() === '' ? null : Number(plazoDias);
    if (parsedPlazo !== null && (isNaN(parsedPlazo) || parsedPlazo < 0)) {
      setNotice({
        type: 'err',
        text: bi('El plazo de pago debe ser un número entero mayor o igual a 0.', 'Payment term must be 0 or greater.'),
      });
      return;
    }

    const parsedTasa = tasaMensual.trim() === '' ? null : Number(tasaMensual.replace(',', '.'));
    if (aplicarInteres && (parsedTasa === null || isNaN(parsedTasa) || parsedTasa <= 0)) {
      setNotice({
        type: 'err',
        text: bi(
          'Ingresa un porcentaje de interés mensual mayor a 0 para activar el interés por mora.',
          'Enter a monthly interest percentage greater than 0 to enable late interest.'
        ),
      });
      return;
    }
    if (parsedTasa !== null && (isNaN(parsedTasa) || parsedTasa < 0)) {
      setNotice({
        type: 'err',
        text: bi('El porcentaje de interés mensual no puede ser negativo.', 'Monthly interest percentage cannot be negative.'),
      });
      return;
    }

    setSaving(true);
    try {
      await backend.savePaymentSettings({
        plazoDiasPredeterminado: parsedPlazo !== null ? Math.round(parsedPlazo) : null,
        aplicarInteresPorDefecto: aplicarInteres,
        porcentajeInteresMensual: parsedTasa,
      });
      await onRefresh();
      setNotice({
        type: 'ok',
        text: bi('Configuración de cobros guardada.', 'Payment settings saved.'),
      });
    } catch (err: any) {
      setNotice({
        type: 'err',
        text: err?.message || bi('No se pudo guardar la configuración.', 'Could not save settings.'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7ECE8]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#26352D] leading-snug">{t('paymentSettings.title')}</h2>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium flex items-start gap-2 ${
            notice.type === 'ok'
              ? 'border-[#24875B]/30 bg-[#EAF5EE] text-[#1D5C3F]'
              : 'border-[#C44545]/30 bg-[#FCECEC] text-[#962D2D]'
          }`}
        >
          {notice.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#24875B]" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C44545]" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E2E7E3] bg-white p-4 space-y-4">
        <div>
          <label className="block text-[13px] font-semibold text-[#26352D] mb-1">
            {t('paymentSettings.defaultTermDays')}
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={plazoDias}
              onChange={(e) => setPlazoDias(e.target.value)}
              placeholder={bi('Sin definir', 'Not set')}
              className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white pl-3 pr-14 text-sm font-medium text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#64746B]">
              {bi('días', 'days')}
            </span>
          </div>
        </div>

        <div className="pt-1 border-t border-[#EEF2EF]">
          <Switch<boolean>
            inline
            label={bi('Aplicar interés por mora', 'Apply late interest')}
            value={aplicarInteres}
            onChange={setAplicarInteres}
          />
        </div>

        {aplicarInteres && (
          <div>
            <label className="block text-[13px] font-semibold text-[#26352D] mb-1">
              {t('paymentSettings.monthlyInterestPercent')}
              <span className="text-[#C44545] ml-0.5">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={tasaMensual}
                onChange={(e) => setTasaMensual(e.target.value)}
                placeholder="0.00"
                className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white pl-3 pr-9 text-sm font-medium text-[#1F2D25] tabular-nums focus:border-[#24875B] focus:outline-none"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#64746B]">
                %
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-[#64746B] leading-relaxed">
          {bi(
            'Estos cambios se aplican únicamente a nuevas deudas.',
            'These changes apply only to new debts.'
          )}
        </p>

        <div className="pt-1 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto h-[42px] px-5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saving ? t('common.saving') : t('common.save')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
