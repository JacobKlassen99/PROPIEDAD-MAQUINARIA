import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, User, Eye, EyeOff, AlertCircle, RefreshCw, HelpCircle, CheckCircle2 } from 'lucide-react';
import { loginWithUserPassword, checkBackendHealth } from '../services/backend';
import { UserSession } from '../types';
import { AppsScriptModal } from '../components/AppsScriptModal';

interface Props {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginView: React.FC<Props> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<{ checked: boolean; ok: boolean; message: string }>({
    checked: false,
    ok: false,
    message: 'Verificando disponibilidad de Google Apps Script...',
  });
  const [showCodeModal, setShowCodeModal] = useState(false);

  useEffect(() => {
    let isMounted = true;
    checkBackendHealth()
      .then((res) => {
        if (isMounted) {
          if (res && res.ok) {
            setBackendStatus({
              checked: true,
              ok: true,
              message: 'Conectado exitosamente a Google Apps Script',
            });
          } else {
            setBackendStatus({
              checked: true,
              ok: false,
              message: 'Backend disponible pero respuesta inusual',
            });
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setBackendStatus({
            checked: true,
            ok: false,
            message: `Fallo de red: ${err.message}`,
          });
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Por favor ingresa la contraseña de usuario.');
      return;
    }

    setLoading(true);
    try {
      const session = await loginWithUserPassword(password.trim());
      onLoginSuccess(session);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al verificar credenciales con el backend';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-stone-100 p-4 selection:bg-emerald-100 selection:text-emerald-900">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-900/10 mb-3 border border-emerald-600">
            <ShieldCheck className="h-9 w-9 text-emerald-100" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 font-sans">
            MAQUINARIAS Y PROPIEDAD
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Gestión de Trabajos, Lotes, Campañas y Finanzas Agrícolas
          </p>
        </div>

        {/* Login Form Card */}
        <div className="rounded-2xl bg-white p-7 shadow-xl border border-stone-200">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Acceso al Sistema</h2>
              <p className="text-xs text-stone-500">Módulos operativos Maquinarias y Propiedad</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Google Sheets</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">Respuesta del backend:</p>
                <p className="mt-0.5 text-stone-800 font-mono text-[11px] bg-red-100/60 p-1.5 rounded border border-red-200">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-stone-700">
                  Contraseña de Usuario (CONTRASENA_USUARIO)
                </label>
                <span className="text-[10px] text-stone-400">Hoja configuracion</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese contraseña de usuario"
                  required
                  autoFocus
                  className="block w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-stone-300 bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                Permite registrar y consultar trabajos, gastos y servicios en Maquinarias y Propiedad.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-2.5 text-sm shadow-sm transition active:scale-95 disabled:opacity-60 cursor-pointer min-h-[44px]"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Verificando con Google Sheets...</span>
                </>
              ) : (
                <span>Ingresar al Sistema</span>
              )}
            </button>
          </form>

          {/* Backend Connection Indicator */}
          <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <div className="flex items-center gap-1.5 text-[11px]">
              {backendStatus.ok ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Apps Script conectado</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 text-stone-400 animate-spin" />
                  <span>{backendStatus.message}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCodeModal(true)}
              className="text-[11px] text-stone-600 hover:text-stone-900 font-medium flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="h-3 w-3" />
              <span>Info de Contrato</span>
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-stone-400">
          MAQUINARIAS Y PROPIEDAD &bull; Conexión directa a Google Sheets &bull; PWA
        </p>
      </div>

      <AppsScriptModal
        isOpen={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        statusInfo={backendStatus}
      />
    </div>
  );
};
