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

  const handleCopy = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex flex-col max-h-[90vh] w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900">
                Especificación del Contrato Google Apps Script
              </h3>
              <p className="text-xs text-stone-500">
                Acciones requeridas en `dispatch_` para Google Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-stone-100 border-b border-stone-200 flex items-start gap-3">
          <Info className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs text-stone-800 space-y-1">
            <p className="font-semibold">
              Estado de conexión:{' '}
              <span className="font-normal text-stone-700">
                {statusInfo?.message || 'Servicio de Apps Script en línea'}
              </span>
            </p>
            <p className="text-[11px] text-stone-600">
              Esta ventana contiene la referencia de las acciones que la aplicación envía a través de <code>dispatch_()</code>.
            </p>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col bg-stone-900 text-stone-100">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <span className="text-xs font-mono text-emerald-400">Referencia de Código.gs — Contrato de Acciones</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition active:scale-95 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar Código</span>
                </>
              )}
            </button>
          </div>

          <pre className="flex-1 overflow-auto mt-3 p-3 bg-black/40 rounded-lg text-xs font-mono text-stone-300 select-all leading-relaxed max-h-[460px]">
            {GOOGLE_APPS_SCRIPT_CODE}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-3.5 bg-stone-50">
          <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Doble contraseña: <code>CONTRASENA_USUARIO</code> y <code>CONTRASENA_ADMIN</code> en hoja <code>configuracion</code>.</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-stone-200 px-4 py-2 text-xs font-medium text-stone-800 hover:bg-stone-300 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
