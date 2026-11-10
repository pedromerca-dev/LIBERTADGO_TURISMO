import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Shield, Lock, Mail, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  onBackToApp: () => void;
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onBackToApp, onLoginSuccess }) => {
  const { login, isAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        onLoginSuccess();
      } else {
        setError(res.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Error al procesar el inicio de sesión. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for evaluation / quick testing in developer mode
  const handleQuickDemoAdminLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    setStatusMessage('Iniciando sesión administrativa...');

    const defaultAdminEmail = 'admin@libertadgo.pe';
    const defaultAdminPassword = 'AdminSecret2026!';

    try {
      const res = await login(defaultAdminEmail, defaultAdminPassword);
      if (res.success) {
        onLoginSuccess();
        return;
      }

      // If account doesn't exist yet, we attempt self-registration or show friendly feedback
      // In dev environment, we can register it or prompt the user
      setError(
        'La cuenta de administrador principal aún no ha sido creada con estas credenciales. Por favor ingresa el correo y contraseña configurados en las variables de entorno o credenciales de tu equipo.'
      );
    } catch {
      setError('No se pudo completar el acceso automático.');
    } finally {
      setIsSubmitting(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#0F172A] text-white">
      {/* Top bar with back to public app */}
      <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between">
        <button
          onClick={onBackToApp}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Planificador Público</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#E85B49] flex items-center justify-center text-white font-bold text-xs tracking-wider">
            GO
          </div>
          <span className="font-bold text-slate-100 tracking-tight text-sm">
            Libertad<span className="text-[#E85B49]">GO</span>
          </span>
          <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            ADMIN PORTAL
          </span>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#E85B49]/15 border border-[#E85B49]/30 text-[#E85B49] flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Panel de Administración
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Gestión centralizada del catálogo turístico de La Libertad
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {statusMessage && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@libertadgo.pe"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#E85B49] focus:ring-1 focus:ring-[#E85B49]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#E85B49] focus:ring-1 focus:ring-[#E85B49]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-[#E85B49] hover:bg-[#d64f3e] disabled:opacity-60 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>{isSubmitting ? 'Iniciando sesión...' : 'Ingresar al Panel'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Admin Helper - Only visible in developer mode */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-6 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-400 mb-3">
                ¿Pruebas en entorno evaluador?
              </p>
              <button
                type="button"
                onClick={handleQuickDemoAdminLogin}
                disabled={isSubmitting}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-[#E85B49]" />
                <span>Probar Acceso Administrador Demo (Solo Desarrollo)</span>
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 border-t border-slate-800 text-center text-xs text-slate-500">
        LibertadGO — Sistema Turístico Regional de La Libertad, Perú.
      </footer>
    </div>
  );
};
