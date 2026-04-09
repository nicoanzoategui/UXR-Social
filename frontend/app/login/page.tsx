"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, ChevronRight, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

const ACCESS_TOKEN_COOKIE = "access_token";
const ACCESS_TOKEN_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function loginErrorMessage(err: unknown): string {
  const ax = err as {
    response?: { status?: number; data?: { detail?: unknown } };
  };
  const status = ax.response?.status;
  const detail = ax.response?.data?.detail;
  if (status === 429) {
    return "Demasiados intentos. Esperá un minuto e intentá de nuevo.";
  }
  if (typeof detail === "string") {
    if (detail === "Incorrect username or password") {
      return "Usuario o contraseña incorrectos.";
    }
    return detail;
  }
  if (Array.isArray(detail)) {
    return "Datos de inicio de sesión no válidos.";
  }
  if (!ax.response) {
    return "No se pudo conectar con el servidor. Comprobá que el backend esté en marcha.";
  }
  return "Usuario o contraseña incorrectos.";
}

function setClientAccessTokenCookie(token: string) {
  const encoded = encodeURIComponent(token);
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encoded}; Path=/; Max-Age=${ACCESS_TOKEN_MAX_AGE_SEC}; SameSite=Lax`;
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = username.trim();
      const params = new URLSearchParams();
      params.set("username", u);
      params.set("password", password);
      params.set("grant_type", "password");
      const response = await api.post("/token", params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data = response.data;

      if (!data?.access_token) {
        setError("Usuario o contraseña incorrectos");
        return;
      }

      sessionStorage.setItem("access_token", data.access_token);
      setClientAccessTokenCookie(data.access_token);
      localStorage.setItem("isLoggedIn", "true");
      if (data.role) localStorage.setItem("role", data.role);

      router.push("/dashboard");
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)] p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-accent-300)]/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-primary-600)]/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full card p-12 rounded-[2.5rem] shadow-2xl relative z-10 bg-white/80 backdrop-blur-xl border-[var(--color-border-medium)]"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-[var(--color-primary-800)] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20 rotate-3 group hover:rotate-0 transition-transform duration-300">
            <Activity className="w-10 h-10 text-white" />
          </div>
          <h1 className="logo text-4xl mb-2 text-slate-900">UX</h1>
          <p className="eyebrow mt-2 text-slate-500 uppercase tracking-widest font-black">
            UXR Social
          </p>
          <p className="text-[var(--color-text-muted)] mt-4 body-sm font-medium">
            Iniciá sesión para acceder al panel.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-rose-50 border border-rose-100 text-rose-600 text-xs py-3 px-4 rounded-xl font-bold flex items-center gap-2"
            >
              <Lock className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
              Usuario
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario"
                autoComplete="username"
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-4 text-[var(--color-text-body)] font-semibold focus:outline-none focus:border-[var(--color-primary-600)] transition-all shadow-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-4 text-[var(--color-text-body)] font-semibold focus:outline-none focus:border-[var(--color-primary-600)] transition-all shadow-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-5 rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 group mt-8"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span className="font-bold tracking-tight">Iniciar sesión</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 text-center border-t border-slate-100 pt-8 space-y-3">
          {process.env.NODE_ENV === "development" && (
            <p className="text-slate-500 text-xs leading-relaxed px-2">
              Modo desarrollo: usá el usuario y la contraseña definidos en{" "}
              <span className="font-mono text-slate-600">backend/.env</span>{" "}
              (<span className="font-mono text-slate-600">ADMIN_USERNAME</span> y{" "}
              <span className="font-mono text-slate-600">SEED_SHARED_PASSWORD</span>).
            </p>
          )}
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
            UXR Social Framework
          </p>
        </div>
      </motion.div>
    </div>
  );
}
