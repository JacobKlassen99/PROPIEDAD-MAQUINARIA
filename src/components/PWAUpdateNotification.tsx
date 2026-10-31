import React, { useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface Props {
  hasUnsavedChanges?: boolean;
}

export const PWAUpdateNotification: React.FC<Props> = ({ hasUnsavedChanges = false }) => {
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Periodic check for SW updates every 30 minutes
        setInterval(() => {
          r.update().catch(() => {});
        }, 30 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] Error en registro de Service Worker:', error);
    },
  });

  const handleUpdate = async () => {
    if (isUpdating) return;

    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'Tienes un formulario con cambios sin guardar. ¿Deseas actualizar de todos modos y perder los cambios no guardados?'
      );
      if (!confirmLeave) {
        return;
      }
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      await updateServiceWorker(true);
    } catch (err) {
      console.error('[PWA] Error durante la actualización:', err);
      setIsUpdating(false);
      setUpdateError('No se pudo actualizar. Intenta de nuevo.');
    }
  };

  const handleDismiss = () => {
    setDismissedThisSession(true);
  };

  if (!needRefresh || dismissedThisSession) {
    return null;
  }

  return (
    <div className="w-full bg-emerald-800 text-white border-b border-emerald-950 shadow-md relative z-50 transition-all duration-300">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        {/* Left info section */}
        <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700/90 border border-emerald-600/60 text-white">
            {isUpdating ? (
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-200" />
            ) : (
              <Download className="h-4 w-4 text-emerald-100" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold tracking-tight text-white">
                Nueva versión disponible
              </span>
              {updateError && (
                <span className="text-[10px] font-bold bg-red-900/90 text-red-100 px-2 py-0.5 rounded border border-red-700">
                  {updateError}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-100/90 truncate">
              Actualiza para utilizar la última versión.
            </p>
          </div>
        </div>

        {/* Action section */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating}
            className={`w-full sm:w-auto px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
              isUpdating
                ? 'bg-emerald-900/90 text-emerald-300 cursor-wait border border-emerald-700/60'
                : 'bg-white text-emerald-950 hover:bg-emerald-50 active:scale-95 hover:shadow-md'
            }`}
          >
            {isUpdating ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-300" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 text-emerald-900" />
                <span>{updateError ? 'Reintentar' : 'Actualizar'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            disabled={isUpdating}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-700/60 rounded-md transition cursor-pointer shrink-0"
            title="Descartar por esta sesión"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
