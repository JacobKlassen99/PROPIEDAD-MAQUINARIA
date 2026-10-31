import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, FileCode, User, LogOut, CheckCircle2 } from 'lucide-react';
import { Campaign, Currency, ExchangeRateConfig, UserSession } from '../types';
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
  onOpenAppsScriptModal: () => void;
  session: UserSession | null;
  onLogout: () => void;
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
  onOpenAppsScriptModal,
  session,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleOpenLogoutConfirm = () => {
    setIsUserMenuOpen(false);
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full max-w-full flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 sm:px-6 backdrop-blur-md shadow-xs">
        {/* Left: Pantalla actual (sin botón hamburguesa) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight truncate">
            {title}
          </h1>
        </div>

        {/* Right: Acciones y sesión */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">

          {/* Active Campaign Badge (ej. 2026) */}
          {activeCampaign && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs sm:text-xs font-bold text-emerald-900 shrink-0 max-w-[110px] sm:max-w-[180px]"
              title={`Gestión activa: ${activeCampaign.nombre}`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{activeCampaign.nombre}</span>
            </div>
          )}

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center min-w-[38px] min-h-[38px]"
            title="Actualizar datos desde Google Sheets"
            aria-label="Actualizar datos"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-emerald-600' : 'text-slate-600'}`} />
          </button>

          {/* User Session Icon Button & Popover */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title="Opciones de usuario y sesión"
              aria-label="Menú de usuario"
              aria-expanded={isUserMenuOpen}
            >
              <User className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-slate-700" />
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 origin-top-right">
                {/* User Info Header */}
                <div className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    {session?.usuario ? session.usuario.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {session?.usuario || 'Administrador'}
                    </p>
                    <span className="inline-block text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200/60 capitalize tracking-tight">
                      {session?.rol || 'administrador'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-1.5 pt-1 border-t border-slate-100">
                  {/* Cerrar sesión */}
                  <button
                    type="button"
                    onClick={handleOpenLogoutConfirm}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition text-left cursor-pointer active:scale-98"
                  >
                    <LogOut className="h-4 w-4 text-red-600 shrink-0" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PWA In-App Install Button (Discreet) */}
          <div className="hidden sm:block shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Confirmation Modal: Cerrar Sesión */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <LogOut className="h-7 w-7" />
            </div>

            <div className="space-y-1.5">
              <h3 id="logout-title" className="text-lg font-bold text-slate-900 tracking-tight">
                ¿Cerrar sesión?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Estás seguro de que deseas salir de la aplicación MAQUINARIAS Y PROPIEDAD?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold transition active:scale-95 cursor-pointer min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition active:scale-95 cursor-pointer min-h-[44px] shadow-sm"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
