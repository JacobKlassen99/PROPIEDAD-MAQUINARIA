import React from 'react';
import { Menu, RefreshCw, FileCode } from 'lucide-react';
import { Campaign, Currency, ExchangeRateConfig } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface Props {
  title: string;
  subtitle?: string;
  activeCampaign: Campaign | null;
  currency: Currency;
  onCurrencyToggle: () => void;
  exchangeRate: ExchangeRateConfig;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenMobileMenu: () => void;
  onOpenAppsScriptModal: () => void;
  showCurrencyToggle?: boolean;
}

export const Navbar: React.FC<Props> = ({
  title,
  subtitle,
  activeCampaign,
  currency,
  onCurrencyToggle,
  exchangeRate,
  onRefresh,
  isRefreshing,
  onOpenMobileMenu,
  onOpenAppsScriptModal,
  showCurrencyToggle = false,
}) => {
  return (
    <header className="sticky top-0 z-20 w-full max-w-full flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-3 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile Hamburger & Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-1 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition active:scale-95 cursor-pointer shrink-0"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
            {title}
          </h2>
        </div>
      </div>

      {/* Right: Quick actions adaptables a 320px */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Active Campaign Badge */}
        {activeCampaign && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-900 shrink-0 max-w-[120px] sm:max-w-[200px]"
            title={`Campaña activa: ${activeCampaign.nombre}`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">
              {activeCampaign.nombre}
            </span>
          </div>
        )}

        {/* Currency Switcher (Bs / USD) - Strictly enabled only in Administration / Financial Reports */}
        {showCurrencyToggle && (
          <div className="flex items-center border border-stone-200 rounded-lg p-0.5 bg-stone-50 shrink-0">
            <button
              type="button"
              onClick={() => currency !== 'BOB' && onCurrencyToggle()}
              className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[11px] sm:text-xs font-bold rounded transition cursor-pointer ${
                currency === 'BOB'
                  ? 'bg-white text-emerald-800 shadow-xs border border-stone-200/80'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Bolivianos"
            >
              Bs
            </button>
            <button
              type="button"
              onClick={() => currency !== 'USD' && onCurrencyToggle()}
              className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[11px] sm:text-xs font-bold rounded transition cursor-pointer ${
                currency === 'USD'
                  ? 'bg-white text-emerald-800 shadow-xs border border-stone-200/80'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Dólares"
            >
              USD
            </button>
          </div>
        )}

        {/* Exchange Rate Tip (Visible in Admin view) */}
        {showCurrencyToggle && (
          <div className="hidden xl:flex items-center text-[10px] text-stone-500 bg-stone-100/80 px-2 py-1 rounded">
            <span>TC: 1 USD = {(exchangeRate?.tasaBobPerUsd || 6.96).toFixed(2)} Bs</span>
          </div>
        )}

        {/* Apps Script Code Modal (Desktop only) */}
        <button
          type="button"
          onClick={onOpenAppsScriptModal}
          className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50 transition cursor-pointer"
          title="Ver o copiar Código.gs para Google Sheets"
        >
          <FileCode className="h-3.5 w-3.5 text-emerald-700" />
          <span>Apps Script</span>
        </button>

        {/* Manual Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5 min-h-[38px]"
          title="Actualizar datos desde Google Sheets"
          aria-label="Actualizar datos"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-emerald-600' : 'text-slate-600'}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>

        {/* PWA In-App Install Button */}
        <div className="hidden sm:block shrink-0">
          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
};
