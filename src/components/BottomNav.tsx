import React from 'react';
import {
  House,
  Tractor,
  Sprout,
  Settings,
} from 'lucide-react';
import { MainView, UserSession } from '../types';

interface BottomNavProps {
  currentView: MainView;
  onNavigate: (view: MainView) => void;
  session: UserSession | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onNavigate,
}) => {
  const navItems: { id: MainView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: House,
    },
    {
      id: 'maquinarias',
      label: 'Maquinarias',
      icon: Tractor,
    },
    {
      id: 'propiedad',
      label: 'Propiedad',
      icon: Sprout,
    },
    {
      id: 'administracion',
      label: 'Administración',
      icon: Settings,
    },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="no-print shrink-0 z-40 w-full bg-white border-t border-slate-200"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.25rem)',
      }}
    >
      <div className="grid grid-cols-4 items-stretch h-[68px] max-w-2xl mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 px-1 py-1.5 min-h-[48px] text-center transition-colors cursor-pointer select-none active:scale-[0.97] ${
                isActive
                  ? 'text-[#24875B]'
                  : 'text-slate-500 hover:text-[#26352D]'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-3 right-3 h-[2.5px] rounded-b-full bg-[#24875B]"
                />
              )}
              <Icon
                className={`h-6 w-6 shrink-0 ${
                  isActive ? 'stroke-[2.3]' : 'stroke-[1.8]'
                }`}
              />
              <span
                className={`text-[11px] sm:text-xs leading-tight tracking-tight whitespace-nowrap ${
                  isActive ? 'font-bold text-[#24875B]' : 'font-medium text-slate-600'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
