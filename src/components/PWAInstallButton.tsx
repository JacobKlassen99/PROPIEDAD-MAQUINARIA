import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-800 transition active:scale-95 cursor-pointer ${className}`}
        title="Instalar MAQUINARIAS en tu dispositivo"
      >
        <Download className="w-3.5 h-3.5 text-emerald-200" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white/80 dark:bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 cursor-pointer ${className}`}
          title="Instalar en iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-stone-200">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <h3 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  Instalar en iPhone o iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-stone-600">
                Para instalar <strong>MAQUINARIAS Y PROPIEDAD</strong> en tu pantalla de inicio:
              </p>
              <ol className="mt-3 space-y-2 text-xs text-stone-700 list-decimal pl-4">
                <li>Toca el botón <strong>Compartir</strong> en la barra de Safari (el ícono de cuadro con flecha hacia arriba).</li>
                <li>Desplázate hacia abajo y selecciona <strong>Agregar a pantalla de inicio</strong>.</li>
                <li>Confirma tocando <strong>Agregar</strong> arriba a la derecha.</li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-emerald-700 py-2 text-xs font-medium text-white hover:bg-emerald-800 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
