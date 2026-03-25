"use client";

import { useState } from "react";
import { 
  FileText, 
  Send, 
  Plus, 
  X, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  Loader2,
  Trash2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sendReport, getFullReport } from "@/lib/api";

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [emails, setEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const addEmail = () => {
    if (currentEmail && isValidEmail(currentEmail) && !emails.includes(currentEmail)) {
      setEmails([...emails, currentEmail]);
      setCurrentEmail("");
    } else if (currentEmail && !isValidEmail(currentEmail)) {
      setError("El correo ingresado no tiene un formato válido.");
    }
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter((e) => e !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emails.length === 0) {
      setError("Por favor, añade al menos un correo electrónico.");
      return;
    }
    if (!dateRange.start || !dateRange.end) {
      setError("Por favor, selecciona un rango de fechas válido.");
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      setLoadingStep("Generando reporte...");
      const reportData = await getFullReport({
        start_date: dateRange.start,
        end_date: dateRange.end
      });

      setLoadingStep("Enviando emails...");
      await sendReport({
        emails,
        start_date: dateRange.start,
        end_date: dateRange.end,
        report_data: reportData
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error in report process:", err);
      const msg = err.response?.data?.detail || "Hubo un error al procesar el reporte. Por favor, intenta nuevamente.";
      setError(msg);
    } finally {
      setIsSending(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="space-y-10 pb-12 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-primary-600)]/5 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[var(--color-accent-400)]/5 rounded-full blur-[100px] -z-10" />

      <header className="flex items-center gap-6">
        <motion.div 
          initial={{ rotate: -5 }}
          animate={{ rotate: 0 }}
          className="w-20 h-20 bg-[var(--color-primary-800)] rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20"
        >
           <FileText className="w-10 h-10 text-white" />
        </motion.div>
        <div>
          <h1 className="heading-xl">Central de Reportes</h1>
          <p className="body-md mt-1 text-[var(--color-text-muted)]">Genera análisis detallados en PDF y envíalos automáticamente a tus colaboradores.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Configuration Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:col-span-5 h-full"
        >
          <div className="card p-10 h-full rounded-[2.5rem] bg-white/80 backdrop-blur-xl border-[var(--color-border-medium)]">
            <h2 className="text-xl font-bold text-[var(--color-text-heading)] mb-8 flex items-center gap-3 font-heading">
              <Calendar className="w-6 h-6 text-[var(--color-primary-600)]" />
              Periodo del Informe
            </h2>
            
            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Fecha de Apertura</label>
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-[var(--color-primary-600)] shadow-sm transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Fecha de Cierre</label>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-[var(--color-primary-600)] shadow-sm transition-all"
                />
              </div>
            </div>
            
            <div className="mt-12 p-6 bg-[var(--color-bg-soft)] rounded-3xl border border-[var(--color-border-soft)]">
              <p className="text-[11px] font-medium text-[var(--color-text-muted)] leading-relaxed italic">
                Asegúrate de seleccionar un rango con datos para que el reporte sea lo más detallado posible.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Recipients Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="md:col-span-7 h-full"
        >
          <div className="card p-10 h-full rounded-[2.5rem] bg-white/80 backdrop-blur-xl border-[var(--color-border-medium)]">
            <h2 className="text-xl font-bold text-[var(--color-text-heading)] mb-8 flex items-center gap-3 font-heading">
              <Mail className="w-6 h-6 text-[var(--color-primary-600)]" />
              Destinatarios
            </h2>

            <div className="space-y-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="email" 
                    placeholder="ejemplo@organizacion.com"
                    value={currentEmail}
                    onChange={(e) => setCurrentEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl pl-11 pr-4 py-4 text-sm font-semibold focus:outline-none focus:border-[var(--color-primary-600)] transition-all shadow-sm"
                  />
                </div>
                <button 
                  onClick={addEmail}
                  className="bg-[var(--color-primary-900)] text-white w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-black transition-all shadow-lg"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar min-h-[120px]">
                <AnimatePresence>
                  {emails.map((email) => (
                    <motion.div 
                      key={email}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center justify-between p-4 bg-[var(--color-bg-soft)] rounded-2xl border border-[var(--color-border-soft)] group hover:border-[var(--color-primary-600)]/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-[var(--color-primary-600)]" />
                         <span className="text-sm font-bold text-slate-700">{email}</span>
                      </div>
                      <button 
                        onClick={() => removeEmail(email)}
                        className="text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {emails.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 opacity-40">
                    <Mail className="w-10 h-10 mb-3" />
                    <p className="text-[11px] font-black uppercase tracking-widest">Añade al menos un correo</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center gap-8 py-6"
      >
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-rose-50 border border-rose-100 text-rose-600 px-8 py-4 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-sm"
            >
              <X className="w-4 h-4" /> {error}
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-8 py-4 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" /> ¡El reporte ha sido enviado con éxito!
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={handleSubmit}
          disabled={isSending || emails.length === 0 || !dateRange.start || !dateRange.end}
          className="btn btn-primary group relative flex items-center gap-4 px-16 py-6 rounded-[2.25rem] shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all text-base"
        >
          {isSending ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              {loadingStep || "Procesando..."}
            </>
          ) : (
            <>
              <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              Generar y Enviar Reporte PDF
            </>
          )}
        </button>
        
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
           <Sparkles className="w-4 h-4 text-[var(--color-primary-600)]" />
           Sincronización de Datos en Tiempo Real
        </div>
      </motion.div>

      {/* Statistics Preview Card - Premium View */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="premium-card bg-[var(--color-primary-900)] p-12 overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 w-[40%] h-[120%] bg-white/5 skew-x-[20deg] translate-x-1/2 -z-0" />
        
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
          <div className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10">
              <Sparkles className="w-3 h-3 text-white" />
              <span className="text-[9px] font-black text-white uppercase tracking-widest">Output IA Detallado</span>
            </div>
            <h3 className="text-3xl font-black text-white leading-tight font-heading max-w-lg">
              Reportes ejecutivos diseñados para la toma de decisiones.
            </h3>
            <div className="flex flex-wrap justify-center lg:justify-start gap-4">
               {["Análisis de Sentimiento", "Matriz de Temas", "Evolución Viral"].map(tag => (
                 <span key={tag} className="text-[10px] font-bold text-white/60 uppercase tracking-widest border border-white/20 px-3 py-1.5 rounded-xl">
                   {tag}
                 </span>
               ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-5 w-full lg:w-auto min-w-[320px]">
            {[
              { label: "Métricas", value: "Totales", icon: ArrowRight },
              { label: "Canales", value: "Mix Social", icon: ArrowRight },
              { label: "Contexto", value: "Temas IA", icon: ArrowRight },
              { label: "Evidencia", value: "Quotes", icon: ArrowRight }
            ].map((item) => (
              <div key={item.label} className="bg-white/10 backdrop-blur-md border border-white/10 p-6 rounded-3xl group hover:bg-white transition-all duration-500">
                <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1 group-hover:text-slate-400">{item.label}</p>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-white group-hover:text-slate-900">{item.value}</span>
                  <item.icon className="w-4 h-4 text-white/30 group-hover:text-[var(--color-primary-600)] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
