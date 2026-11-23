import React, { useState } from 'react';
import { Copy, Check, X, FileCode, CheckCircle2, Info } from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/appsScriptCode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  statusInfo?: { ok: boolean; message: string };
}

export const AppsScriptModal: React.FC<Props> = ({ isOpen, onClose, statusInfo }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const totalLines = GOOGLE_APPS_SCRIPT_CODE.split('\n').length;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = GOOGLE_APPS_SCRIPT_CODE;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="flex flex-col max-h-[90vh] w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5 bg-stone-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <FileCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">
                Código.gs completo — Google Apps Script
              </h3>
              <p className="text-[11px] text-stone-500 truncate">
                Backend completo ({totalLines.toLocaleString('es-BO')} líneas) con consulta oficial BCB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-3 bg-stone-100 border-b border-stone-200 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs text-stone-800 space-y-0.5">
            <p className="font-semibold">
              {statusInfo?.message || 'Listo para copiar y pegar en Código.gs de Google Apps Script'}
            </p>
            <p className="text-[11px] text-stone-600 leading-snug">
              Incluye todas las funciones existentes del sistema más las acciones <code>fx.syncAuto</code> y <code>fx.refresh</code> para el Banco Central de Bolivia. Al pegarlo en Apps Script, deberá implementar una nueva versión del Web App.
            </p>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-hidden p-4 sm:p-5 flex flex-col bg-stone-900 text-stone-100">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-800">
            <span className="text-xs font-mono text-emerald-400 truncate">
              Código.gs — Completo ({totalLines.toLocaleString('es-BO')} líneas)
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition active:scale-95 cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>¡Código copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar Código.gs completo</span>
                </>
              )}
            </button>
          </div>

          <pre className="flex-1 overflow-auto mt-3 p-3 bg-black/40 rounded-lg text-[11px] font-mono text-stone-300 select-all leading-relaxed max-h-[460px]">
            {GOOGLE_APPS_SCRIPT_CODE}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-5 py-3 bg-stone-50">
          <div className="text-[11px] text-stone-500 flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="truncate">
              Conserva las 14 hojas originales, sesiones y contraseñas en <code>Configuracion</code>.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-stone-200 px-4 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-300 transition cursor-pointer shrink-0"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
