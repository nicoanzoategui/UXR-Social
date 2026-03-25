"use client";

import { useState } from "react";
import {
    UploadCloud,
    MessageSquare,
    CheckCircle2,
    AlertCircle,
    Loader2,
    FileText,
    Save,
    Info,
    X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { uploadChatbotCSV } from "@/lib/api";

export default function ChatbotUploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        if (selectedFile) {
            setFile(selectedFile);
            setStatus(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setStatus(null);

        try {
            await uploadChatbotCSV(file);
            setStatus({ type: 'success', msg: "Chatbot CSV subido y procesado con éxito." });
            setFile(null);
        } catch (error: any) {
            const errorMsg = error.response?.data?.detail || "Error al subir el archivo. Verifica el formato.";
            setStatus({ type: 'error', msg: errorMsg });
        } finally {
            setUploading(false);
        }
    };

    const cancelSelection = () => {
        setFile(null);
        setStatus(null);
    };

    return (
        <div className="space-y-12 pb-20 max-w-4xl mx-auto">
            <header>
                <h1 className="heading-xl">Carga de Chatbot / WhatsApp</h1>
                <p className="body-md mt-2 text-[var(--color-text-muted)]">
                    Sincroniza registros de conversaciones mediante archivos CSV.
                </p>
            </header>

            <div className="card card-pad-lg shadow-md border-[var(--color-border-medium)] bg-white">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                        <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="heading-md">Importar Conversaciones</h2>
                        <p className="body-sm">El archivo debe contener: session_id, actor, message, created_at</p>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Archivo CSV</label>
                        <div className={`relative group border-2 border-dashed rounded-[2rem] p-12 transition-all flex flex-col items-center justify-center text-center ${file ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 hover:border-slate-400 bg-slate-50/30'}`}>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="space-y-4">
                                <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center transition-all ${file ? 'bg-emerald-500 text-white' : 'bg-white text-slate-300 shadow-sm'}`}>
                                    {file ? <CheckCircle2 className="w-10 h-10" /> : <FileText className="w-10 h-10" />}
                                </div>
                                <div>
                                    <p className="text-lg font-black text-slate-900">
                                        {file ? file.name : "Selecciona tu archivo de Chatbot"}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {file ? `${(file.size / 1024).toFixed(2)} KB` : "Arrastra el CSV aquí o haz clic para buscar"}
                                    </p>
                                </div>
                            </div>
                            {file && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); cancelSelection(); }}
                                    className="absolute top-4 right-4 p-2 hover:bg-emerald-100 rounded-full transition-colors z-20"
                                >
                                    <X className="w-5 h-5 text-emerald-600" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 flex gap-4">
                        <Info className="w-6 h-6 text-blue-500 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-blue-900 uppercase tracking-widest">Requisito de Formato</p>
                            <p className="text-sm text-blue-700/80 leading-relaxed">
                                Asegúrate de que las cabeceras del CSV sean exactamente: <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">session_id</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">actor</code>, <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">message</code> y <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">created_at</code>.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={uploading || !file}
                        className={`w-full py-6 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 shadow-xl ${uploading || !file
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20'
                            }`}
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                Procesando Datos...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Sincronizar Chatbot
                            </>
                        )}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className={`flex items-center gap-4 p-6 rounded-[1.5rem] text-sm font-bold border shadow-lg ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}
                    >
                        {status.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                        {status.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
