import React, { useState } from 'react';
import { Lock, Eye, EyeOff, RefreshCw, AlertCircle } from 'lucide-react';
import { loginWithUserPassword } from '../services/backend';
import { UserSession } from '../types';

interface Props {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginView: React.FC<Props> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Por favor ingresa la contraseña.');
      return;
    }

    setLoading(true);
    try {
      const session = await loginWithUserPassword(password.trim());
      onLoginSuccess(session);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al verificar credenciales';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-[#F8F9FA] p-4 overflow-y-auto selection:bg-emerald-100 selection:text-emerald-900">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 my-auto">
        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Maquinarias y Propiedad
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestión agrícola
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">Error de acceso</p>
              <p className="mt-0.5 text-stone-800">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese contraseña"
                required
                autoFocus
                className="block w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-sm shadow-sm transition active:scale-95 disabled:opacity-60 cursor-pointer min-h-[44px]"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
                <span>Ingresando...</span>
              </>
            ) : (
              <span>Ingresar</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
