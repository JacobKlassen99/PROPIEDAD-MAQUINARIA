import React from 'react';
import {
  Tractor,
  Trees,
  LayoutDashboard,
  Settings,
  LogOut,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { UserSession } from '../types';
import { checkIsAdmin } from '../services/backend';

export type MainView = 'inicio' | 'maquinarias' | 'propiedad' | 'administracion';

interface Props {
  currentView: MainView;
  onNavigate: (view: MainView) => void;
  session: UserSession | null;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<Props> = ({
  currentView,
  onNavigate,
  session,
  onLogout,
  isOpenMobile,
  onCloseMobile,
}) => {
  const isAdmin = checkIsAdmin(session);

  const mainModules: { id: MainView; label: string; sublabel: string; icon: React.ElementType }[] = [
    {
      id: 'maquinarias',
      label: 'MAQUINARIAS',
      sublabel: 'Terceros, propiedad y gastos',
      icon: Tractor,
    },
    {
      id: 'propiedad',
      label: 'PROPIEDAD',
      sublabel: 'Lotes, gastos e ingresos',
      icon: Trees,
    },
  ];

  const handleSelect = (view: MainView) => {
    onNavigate(view);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-stone-900 text-stone-200">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-stone-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
            <Tractor className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold tracking-tight text-white truncate">
              MAQUINARIAS Y PROPIEDAD
            </h1>
            <p className="text-[11px] text-stone-400 truncate">
              Gestión Agrícola &bull; Sheets
            </p>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="px-3 py-4 space-y-6">
          {/* Aux: Inicio */}
          <div>
            <button
              type="button"
              onClick={() => handleSelect('inicio')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition cursor-pointer ${
                currentView === 'inicio'
                  ? 'bg-emerald-800/80 text-white font-semibold'
                  : 'text-stone-300 hover:bg-stone-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 text-stone-400" />
              <span>Inicio / Resumen</span>
            </button>
          </div>

          {/* PRIMARY BUSINESS MODULES */}
          <div>
            <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
              <span>Módulos Principales</span>
              <span className="text-[9px] bg-emerald-950 px-1.5 py-0.5 rounded text-emerald-300 border border-emerald-800">2</span>
            </div>
            <div className="space-y-1.5">
              {mainModules.map((mod) => {
                const Icon = mod.icon;
                const isActive = currentView === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelect(mod.id)}
                    className={`w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-xl transition cursor-pointer ${
                      isActive
                        ? 'bg-emerald-700 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500'
                        : 'bg-stone-800/60 text-stone-200 hover:bg-stone-800 hover:text-white border border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isActive ? 'bg-emerald-600 text-white' : 'bg-stone-700/60 text-stone-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold tracking-wide truncate">{mod.label}</p>
                        <p
                          className={`text-[10px] truncate ${
                            isActive ? 'text-emerald-100' : 'text-stone-400'
                          }`}
                        >
                          {mod.sublabel}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        isActive ? 'text-emerald-200 translate-x-0.5' : 'text-stone-500'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* AUXILIARY SCREENS: ADMINISTRACIÓN */}
          {isAdmin && (
            <div>
              <div className="px-3 mb-2 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">
                Administración
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleSelect('administracion')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition cursor-pointer ${
                    currentView === 'administracion'
                      ? 'bg-stone-800 text-white font-semibold'
                      : 'text-stone-300 hover:bg-stone-800/60 hover:text-white'
                  }`}
                >
                  <Settings className="h-4 w-4 shrink-0 text-stone-400" />
                  <span>Administración</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Session Footer */}
      <div className="p-3 border-t border-stone-800 bg-stone-950/40">
        <div className="flex items-center justify-between p-2 rounded-lg bg-stone-800/40 border border-stone-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-700 text-stone-200">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {session?.usuario || 'admin'}
              </p>
              <p className="text-[10px] text-emerald-400 capitalize truncate">
                {session?.rol || 'administrador'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-stone-700/60 rounded-md transition cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30 shadow-lg">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex w-68 max-w-[80vw] flex-1 flex-col shadow-2xl z-10">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
