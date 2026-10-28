import React from 'react';
import {
  House,
  Tractor,
  Trees,
  Settings,
} from 'lucide-react';
import { MainView } from './Sidebar';
import { UserSession } from '../types';
import { checkIsAdmin } from '../services/backend';

interface BottomNavProps {
  currentView: MainView;
  onNavigate: (view: MainView) => void;
  session: UserSession | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onNavigate,
  session,
}) => {
  const isAdmin = checkIsAdmin(session);

  const navItems = [
    {
      id: 'inicio' as MainView,
      label: 'Inicio',
      icon: House,
    },
    {
      id: 'maquinarias' as MainView,
      label: 'Maquinarias',
      icon: Tractor,
    },
    {
      id: 'propiedad' as MainView,
      label: 'Propiedad',
      icon: Trees,
    },
    {
      id: 'administracion' as MainView,
      label: 'Admin',
      icon: Settings,
    },
  ];

  return (
    <nav
      aria-label="Navegación inferior"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 lg:hidden pb-[max(env(safe-area-inset-bottom),0.35rem)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
    >
      <div className="grid grid-cols-4 items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center h-full py-1 text-center transition-all cursor-pointer select-none active:scale-95 ${
                isActive
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-full transition-colors ${
                  isActive ? 'bg-emerald-100/70 text-emerald-700' : 'text-slate-500'
                }`}
              >
                <Icon
                  className={`h-6 w-6 shrink-0 transition-transform ${
                    isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'
                  }`}
                />
              </div>
              <span className={`text-xs tracking-tight mt-0.5 truncate max-w-[76px] ${isActive ? 'font-bold text-emerald-800' : 'text-slate-600'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
