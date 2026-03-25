"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, User, ChevronRight, Lock, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { login } from "@/lib/api";

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
            const data = await login(username, password);
            if (data.role !== "admin") {
                setError("Access restricted to administrators.");
                return;
            }
            localStorage.setItem("isAdminLoggedIn", "true");
            localStorage.setItem("role", data.role);
            router.push("/admin");
        } catch (err: any) {
            setError(err.response?.data?.detail || "Invalid credentials");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)] p-4 relative overflow-hidden">
             {/* Background decorative elements - Adjusted to Gray/Slate tones */}
             <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-400/10 rounded-full blur-[120px]" />
             <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-600/10 rounded-full blur-[120px]" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full card p-12 rounded-[2.5rem] shadow-2xl relative z-10 bg-white/80 backdrop-blur-xl border-[var(--color-border-medium)]"
            >
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-400/20 -rotate-3 group hover:rotate-0 transition-transform duration-300">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="logo text-4xl mb-2 !text-slate-900">SA</h1>
                    <p className="eyebrow mt-2 !bg-slate-100 !text-slate-700">Back Office Admin</p>
                    <p className="text-[var(--color-text-muted)] mt-4 body-sm font-medium">Restricted access for system administrators and data controllers.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    {error && (
                         <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-50 border border-slate-200 text-slate-600 text-xs py-3 px-4 rounded-xl font-bold flex items-center gap-2"
                         >
                            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                            {error}
                         </motion.div>
                    )}
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Admin Identity</label>
                        <div className="relative">
                            <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="admin_user_id"
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-4 text-[var(--color-text-body)] font-semibold focus:outline-none focus:border-slate-500 transition-all shadow-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Master Key</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-4 text-[var(--color-text-body)] font-semibold focus:outline-none focus:border-slate-500 transition-all shadow-sm"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn w-full py-5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white shadow-xl shadow-slate-500/20 flex items-center justify-center gap-3 group mt-8 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading ? (
                             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span className="font-bold tracking-tight text-white">Authenticate Administrator</span>
                                <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-10 text-center border-t border-slate-100 pt-8">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                        Admin Kernel v2.1 • Access Logged
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
