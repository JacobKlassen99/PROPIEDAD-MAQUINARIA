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
    ...(isAdmin
      ? [
          {
            id: 'administracion' as MainView,
            label: 'Admin',
            icon: Settings,
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Navegación móvil inferior"
      className="fixed bottom-0 inset-x-0 z-40 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 lg:hidden pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.3)]"
    >
      <div
        className={`grid ${
          isAdmin ? 'grid-cols-4' : 'grid-cols-3'
        } items-center h-14 max-w-md mx-auto px-1`}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`relative flex flex-col items-center justify-center h-full py-1 text-center transition cursor-pointer select-none min-h-[48px] ${
                isActive
                  ? 'text-emerald-400 font-bold'
                  : 'text-stone-400 hover:text-stone-200 font-medium'
              }`}
            >
              {/* Active top indicator pill */}
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-emerald-400 rounded-full" />
              )}
              <Icon
                className={`h-5 w-5 shrink-0 transition-transform ${
                  isActive ? 'scale-110 text-emerald-400 stroke-[2.4]' : 'stroke-[1.8]'
                }`}
              />
              <span className="text-[10px] tracking-tight leading-none mt-1 truncate max-w-[64px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
