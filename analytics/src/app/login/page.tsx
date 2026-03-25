"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, ChevronRight, Activity } from "lucide-react";
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
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("role", data.role);
            router.push("/analytics");
        } catch (err: any) {
            setError(err.response?.data?.detail || "Invalid credentials");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)] p-4 relative overflow-hidden">
            {/* Background decorative elements */}
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
                    <p className="eyebrow mt-2 text-slate-500 uppercase tracking-widest font-black">UXR Social</p>
                    <p className="text-[var(--color-text-muted)] mt-4 body-sm font-medium">Enter your credentials to synchronize with the intelligence engine.</p>
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
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Identity</label>
                        <div className="relative">
                            <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="analyst_name"
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-11 pr-4 py-4 text-[var(--color-text-body)] font-semibold focus:outline-none focus:border-[var(--color-primary-600)] transition-all shadow-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Security Key</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
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
                                <span className="font-bold tracking-tight">Initialize Session</span>
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-10 text-center border-t border-slate-100 pt-8">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                        UXR Social Framework v4.2
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
