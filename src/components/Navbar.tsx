import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, User, LogOut, ShieldOff } from 'lucide-react';
import { Campaign, Currency, ExchangeRateConfig, UserSession } from '../types';
import { hasAdminAuthorization, revokeAdminAuthorization } from '../services/backend';
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
  onAdminAuthorizationRevoked?: () => void;
}

export const Navbar: React.FC<Props> = ({
  title,
  activeCampaign,
  onRefresh,
  isRefreshing,
  session,
  onLogout,
  onAdminAuthorizationRevoked,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showRevokeAdminConfirm, setShowRevokeAdminConfirm] = useState(false);
  const [revokingAdmin, setRevokingAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDeviceAdminAuthorized = hasAdminAuthorization();

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

  const handleOpenRevokeAdminConfirm = () => {
    setIsUserMenuOpen(false);
    setShowRevokeAdminConfirm(true);
  };

  const handleConfirmRevokeAdmin = async () => {
    setRevokingAdmin(true);
    try {
      await revokeAdminAuthorization();
      setShowRevokeAdminConfirm(false);
      onAdminAuthorizationRevoked?.();
    } finally {
      setRevokingAdmin(false);
    }
  };

  return (
    <>
      <header
        className="no-print shrink-0 z-30 w-full max-w-full flex items-center justify-between gap-3 border-b border-slate-200/90 bg-white px-4 sm:px-6 min-h-[60px]"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
        }}
      >
        {/* Left: Current Screen Title */}
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#26352D] tracking-tight truncate">
            {title}
          </h1>
          {activeCampaign && (
            <span
              className="text-xs sm:text-sm font-medium text-slate-500 whitespace-nowrap truncate max-w-[120px] sm:max-w-[200px]"
              title={`Campaña activa: ${activeCampaign.nombre}`}
            >
              · {activeCampaign.nombre}
            </span>
          )}
        </div>

        {/* Right: Refresh & User Session */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3.5 text-[#26352D] hover:bg-slate-50 transition-colors active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 min-h-[44px] min-w-[44px]"
            title="Actualizar datos desde Google Sheets"
            aria-label="Actualizar datos"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${isRefreshing ? 'animate-spin text-[#24875B]' : 'text-slate-600'}`} />
            <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">
              {isRefreshing ? 'Actualizando' : 'Actualizar'}
            </span>
          </button>

          {/* User Session Menu (Cuenta y Seguridad del dispositivo) */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3.5 text-[#26352D] hover:bg-slate-50 transition-colors active:scale-95 cursor-pointer min-h-[44px] min-w-[44px]"
              title="Opciones de cuenta y seguridad"
              aria-label="Cuenta"
              aria-expanded={isUserMenuOpen}
            >
              <User className="h-4.5 w-4.5 text-[#26352D] shrink-0" />
              <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">
                Cuenta
              </span>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-68 bg-white rounded-2xl shadow-lg border border-slate-200 p-2.5 z-50">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAFBF8] border border-slate-100">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF5EE] text-[#24875B] font-bold text-sm">
                    {session?.usuario ? session.usuario.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#26352D] truncate">
                      {session?.usuario || 'Usuario'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isDeviceAdminAuthorized ? 'Dispositivo con acceso Admin' : 'Sesión operativa'}
                    </p>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                  {isDeviceAdminAuthorized && (
                    <button
                      type="button"
                      onClick={handleOpenRevokeAdminConfirm}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-[#C44545] hover:bg-[#FCECEC] rounded-xl transition-colors text-left cursor-pointer min-h-[44px]"
                    >
                      <ShieldOff className="h-4.5 w-4.5 text-[#C44545] shrink-0" />
                      <span>Revocar acceso administrativo</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleOpenLogoutConfirm}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-[#C44545] hover:bg-[#FCECEC] rounded-xl transition-colors text-left cursor-pointer min-h-[44px]"
                  >
                    <LogOut className="h-4.5 w-4.5 text-[#C44545] shrink-0" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:block shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Revoke Administrative Device Access Confirmation Modal */}
      {showRevokeAdminConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-admin-title"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-5 text-center">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-[#FCECEC] text-[#C44545]">
              <ShieldOff className="h-7 w-7" />
            </div>

            <div className="space-y-1.5">
              <h3 id="revoke-admin-title" className="text-lg font-bold text-[#26352D]">
                ¿Revocar acceso administrativo?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Se eliminará la autorización administrativa guardada en este dispositivo. Deberás ingresar la contraseña de administrador para volver a configurar el sistema.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                disabled={revokingAdmin}
                onClick={() => setShowRevokeAdminConfirm(false)}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#26352D] text-sm font-semibold transition-colors cursor-pointer min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={revokingAdmin}
                onClick={handleConfirmRevokeAdmin}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#C44545] hover:bg-[#A83737] text-white text-sm font-bold transition-colors cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
              >
                {revokingAdmin ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Revocando...</span>
                  </>
                ) : (
                  <span>Revocar acceso</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-5 text-center">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-[#FCECEC] text-[#C44545]">
              <LogOut className="h-7 w-7" />
            </div>

            <div className="space-y-1.5">
              <h3 id="logout-title" className="text-lg font-bold text-[#26352D]">
                ¿Cerrar sesión?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                ¿Deseas salir de la aplicación Maquinarias y Propiedad?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#26352D] text-sm font-semibold transition-colors cursor-pointer min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#C44545] hover:bg-[#A83737] text-white text-sm font-bold transition-colors cursor-pointer min-h-[48px]"
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
