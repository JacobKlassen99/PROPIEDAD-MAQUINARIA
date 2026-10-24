import React, { useEffect, useState } from 'react';
import { RefreshCw, X, AlertCircle } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface Props {
  hasUnsavedChanges?: boolean;
}

export const PWAUpdateNotification: React.FC<Props> = ({ hasUnsavedChanges = false }) => {
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Periodic check for updates every 15 minutes
        setInterval(() => {
          r.update();
        }, 15 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('SW registration error', error);
    },
  });

  const handleUpdate = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'Tienes un formulario con cambios sin guardar. ¿Deseas actualizar ahora de todos modos y perder los cambios no guardados?'
      );
      if (!confirmLeave) {
        return;
      }
    }
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    // Only dismisses for the current session (memory state, not saved in localStorage)
    setDismissedThisSession(true);
  };

  if (!needRefresh || dismissedThisSession) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm rounded-xl border border-emerald-300 bg-white p-4 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
          <RefreshCw className="h-5 w-5 animate-spin" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-stone-900">Nueva versión disponible</h4>
          <p className="mt-1 text-xs text-stone-600">
            Se ha publicado una actualización de MAQUINARIAS Y PROPIEDAD con mejoras del sistema.
          </p>

          {hasUnsavedChanges && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded p-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Hay cambios sin guardar en pantalla.</span>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleUpdate}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-emerald-800 transition active:scale-95 cursor-pointer"
            >
              Actualizar ahora
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition cursor-pointer"
            >
              Descartar
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-stone-400 hover:text-stone-600 p-0.5 rounded"
          title="Descartar por ahora"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
