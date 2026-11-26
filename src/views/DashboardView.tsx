import React from 'react';
import { Tractor, Sprout, ChevronRight, AlertCircle } from 'lucide-react';
import { Campaign } from '../types';
import { useI18n } from '../services/i18n';

interface Props {
  activeCampaign: Campaign | null;
  onNavigate: (view: 'maquinarias' | 'propiedad') => void;
}

export const DashboardView: React.FC<Props> = ({
  activeCampaign,
  onNavigate,
}) => {
  const { t, bi } = useI18n();

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Banner si no hay campaña activa */}
      {!activeCampaign && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-amber-900 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">
            {bi(
              'No hay una campaña activa. Activa una campaña en ',
              'There is no active campaign. Activate a campaign in '
            )}
            <span className="font-bold">{t('nav.admin')}</span>
            {bi(' para registrar movimientos.', ' to record movements.')}
          </p>
        </div>
      )}

      {/* Accesos principales: Maquinarias y Propiedad */}
      <section aria-label={t('nav.homeSubtitle')} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        {/* Botón Maquinarias */}
        <button
          type="button"
          onClick={() => onNavigate('maquinarias')}
          className="group w-full rounded-2xl border border-[#DCE5DF] bg-white p-5 sm:p-6 text-left flex items-center justify-between gap-4 hover:border-[#24875B]/50 hover:bg-[#FAFDFB] active:scale-[0.99] transition-all cursor-pointer min-h-[108px] shadow-[0_1px_2px_rgba(38,53,45,0.04)]"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EAF5EE] text-[#24875B] group-hover:bg-[#24875B] group-hover:text-white transition-colors">
              <Tractor className="h-7 w-7" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#26352D] tracking-tight leading-snug">
                {t('dashboard.machineryTitle')}
              </h2>
              <p className="text-xs text-[#5E6D64] mt-0.5 leading-snug">
                {t('dashboard.machineryDesc')}
              </p>
            </div>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F7F5] text-[#5E6D64] group-hover:bg-[#EAF5EE] group-hover:text-[#24875B] transition-colors">
            <ChevronRight className="h-5 w-5" />
          </div>
        </button>

        {/* Botón Propiedad */}
        <button
          type="button"
          onClick={() => onNavigate('propiedad')}
          className="group w-full rounded-2xl border border-[#DCE5DF] bg-white p-5 sm:p-6 text-left flex items-center justify-between gap-4 hover:border-[#24875B]/50 hover:bg-[#FAFDFB] active:scale-[0.99] transition-all cursor-pointer min-h-[108px] shadow-[0_1px_2px_rgba(38,53,45,0.04)]"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EAF5EE] text-[#24875B] group-hover:bg-[#24875B] group-hover:text-white transition-colors">
              <Sprout className="h-7 w-7" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#26352D] tracking-tight leading-snug">
                {t('dashboard.propertyTitle')}
              </h2>
              <p className="text-xs text-[#5E6D64] mt-0.5 leading-snug">
                {t('dashboard.propertyDesc')}
              </p>
            </div>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F7F5] text-[#5E6D64] group-hover:bg-[#EAF5EE] group-hover:text-[#24875B] transition-colors">
            <ChevronRight className="h-5 w-5" />
          </div>
        </button>
      </section>
    </div>
  );
};
