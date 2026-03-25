"use client";

import { useEffect, useState } from "react";
import {
    Users as UsersIcon,
    MessageSquare,
    TrendingUp,
    Calendar,
    Activity,
    X,
    ChevronDown,
    ArrowRight,
    Sparkles,
    FileText,
    Copy,
    Download,
    Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getSummary, getTrends, getTopics, getComments, getThemeReport, getConsolidatedReport } from "@/lib/api";
import TrendsChart from "@/components/TrendsChart";
import ConsolidatedReportModal from "@/components/ConsolidatedReportModal";
import ThemeReportModal from "@/components/ThemeReportModal";

export default function ChatbotAnalyticsPage() {
    const [summary, setSummary] = useState<any>(null);
    const [trends, setTrends] = useState<any[]>([]);
    const [topics, setTopics] = useState<any[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [topicComments, setTopicComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [allComments, setAllComments] = useState<any[]>([]); // New state for all chatbot comments
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState(""); // New search state

    // Report State
    const [themeReportData, setThemeReportData] = useState<any>(null);
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const [consolidatedData, setConsolidatedData] = useState<any>(null);
    const [showConsolidatedModal, setShowConsolidatedModal] = useState(false);
    const [isGeneratingConsolidated, setIsGeneratingConsolidated] = useState(false);

    const [copied, setCopied] = useState(false);

    // Filter State
    const [dateRange, setDateRange] = useState({
        start: "",
        end: ""
    });
    const [activePreset, setActivePreset] = useState("all");

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    async function fetchData() {
        setIsRefreshing(true);
        try {
            const params = {
                start_date: dateRange.start || undefined,
                end_date: dateRange.end || undefined,
                network: "Chatbot"
            };

            const [sumData, trendData, topicData, commentsData] = await Promise.all([
                getSummary(params),
                getTrends(params),
                getTopics(params),
                getComments(params) // Fetch all comments initially
            ]);
            setSummary(sumData);
            setTrends(trendData);
            setTopics(topicData || []);
            setAllComments(commentsData || []);
        } catch (error) {
            console.error("Error fetching chatbot analytics:", error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }

    const applyPreset = (days: number, label: string) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);

        setDateRange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        });
        setActivePreset(label);
    };

    const clearFilters = () => {
        setDateRange({ start: "", end: "" });
        setActivePreset("all");
    };

    const openTopicDetails = (topicName: string) => {
        setSelectedTopic(topicName);
    };

    const filteredComments = allComments.filter(comment => {
        const matchesTopic = selectedTopic ? comment.theme === selectedTopic : true;
        const matchesSearch = searchTerm
            ? comment.comment_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
            comment.author_name.toLowerCase().includes(searchTerm.toLowerCase())
            : true;
        return matchesTopic && matchesSearch;
    });

    const generateReport = async () => {
        if (!selectedTopic) return;
        setIsGeneratingReport(true);
        try {
            const params = {
                theme: selectedTopic,
                network: "Chatbot",
                start_date: dateRange.start || undefined,
                end_date: dateRange.end || undefined
            };
            const data = await getThemeReport(params);
            setThemeReportData(data);
            setShowThemeModal(true);
        } catch (error) {
            console.error("Error generating report:", error);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const generateConsolidatedReport = async () => {
        setIsGeneratingConsolidated(true);
        try {
            const params = {
                network: "Chatbot",
                start_date: dateRange.start || undefined,
                end_date: dateRange.end || undefined
            };
            const data = await getConsolidatedReport(params);
            setConsolidatedData(data);
            setShowConsolidatedModal(true);
        } catch (error) {
            console.error("Error generating consolidated report:", error);
        } finally {
            setIsGeneratingConsolidated(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <Activity className="w-12 h-12 text-emerald-500 animate-spin" />
                    <p className="text-slate-500 font-medium">Cargando Chatbot Intelligence...</p>
                </div>
            </div>
        );
    }

    const stats = [
        { name: "Total Mensajes", value: summary?.total_comments || 0, icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-50" },
        { name: "Participantes", value: summary?.unique_authors || 0, icon: UsersIcon, color: "text-blue-600", bg: "bg-blue-50" },
        { name: "Promedio Diario", value: summary?.avg_per_day || 0, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
        { name: "Temas Detectados", value: topics.length, icon: Activity, color: "text-rose-600", bg: "bg-rose-50" },
    ];

    return (
        <div className="space-y-8 pb-12">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="heading-xl">Analytics de Chatbot & WhatsApp</h1>
                    <p className="body-md mt-2 text-[var(--color-text-muted)]">Monitoreo de conversaciones y flujo de mensajes.</p>
                </div>
                {isRefreshing && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        <Activity className="w-3 h-3 animate-spin" /> Actualizando
                    </div>
                )}

                <button
                    onClick={generateConsolidatedReport}
                    disabled={isGeneratingConsolidated}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                >
                    {isGeneratingConsolidated ? (
                        <Activity className="w-3 h-3 animate-spin" />
                    ) : (
                        <FileText className="w-4 h-4" />
                    )}
                    Reporte Consolidado
                </button>
            </header>

            {/* Filter Bar */}
            <div className="card p-6 shadow-sm border border-[var(--color-border-soft)] space-y-6 bg-white">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Periodo:</span>
                            {[
                                { label: "all", text: "Todo", days: 0 },
                                { label: "7d", text: "Semana", days: 7 },
                                { label: "30d", text: "Mes", days: 30 }
                            ].map(preset => (
                                <button
                                    key={preset.label}
                                    onClick={() => preset.days === 0 ? clearFilters() : applyPreset(preset.days, preset.label)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activePreset === preset.label
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    {preset.text}
                                </button>
                            ))}
                        </div>

                        <div className="relative flex-1 max-w-md">
                            <input
                                type="text"
                                placeholder="Buscar en mensajes o autores..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-10 py-2.5 text-xs font-medium focus:outline-none focus:border-emerald-400 transition-all"
                            />
                            <Activity className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => {
                                setDateRange(prev => ({ ...prev, start: e.target.value }));
                                setActivePreset("custom");
                            }}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-emerald-400"
                        />
                        <span className="text-slate-300">→</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => {
                                setDateRange(prev => ({ ...prev, end: e.target.value }));
                                setActivePreset("custom");
                            }}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-emerald-400"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="card p-6 flex items-center justify-between shadow-sm bg-white"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center border border-[var(--color-border-soft)]`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.name}</p>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">{stat.value}</h3>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Chart Section */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card p-8 min-h-[450px] shadow-sm bg-white"
            >
                <div className="mb-8">
                    <h2 className="heading-md flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-emerald-600" />
                        Flujo de Mensajes (Chatbot)
                    </h2>
                    <p className="body-sm mt-1">Volumen de interacciones diarias.</p>
                </div>
                <div className="h-[300px]">
                    <TrendsChart data={trends} />
                </div>
            </motion.div>

            {/* Topics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-1 card p-8 shadow-sm bg-white"
                >
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-purple-600" />
                        Temas Predominantes
                    </h2>
                    <div className="space-y-4">
                        {topics.map((topic: any, index: number) => (
                            <div
                                key={topic.topic}
                                onClick={() => openTopicDetails(topic.topic)}
                                className="group cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                            >
                                <div className="flex justify-between items-center text-xs mb-1">
                                    <span className="font-black text-slate-700 uppercase tracking-wider">{topic.topic}</span>
                                    <span className="font-bold text-slate-400">{topic.count}</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(topic.count / Math.max(summary.total_comments, 1)) * 100}%` }}
                                        className="h-full bg-purple-500 rounded-full"
                                        transition={{ duration: 1 }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Selected Topic Comments */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lg:col-span-2 card p-0 shadow-sm bg-white overflow-hidden flex flex-col"
                >
                    <header className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                                {selectedTopic ? `Mensajes: ${selectedTopic}` : "Todos los Mensajes"}
                            </h2>
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black">
                                {filteredComments.length}
                            </span>
                            {selectedTopic && (
                                <button
                                    onClick={generateReport}
                                    disabled={isGeneratingReport}
                                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-md shadow-purple-200 disabled:opacity-50"
                                >
                                    {isGeneratingReport ? (
                                        <Activity className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-3 h-3" />
                                    )}
                                    Resumen IA
                                </button>
                            )}
                        </div>
                        {selectedTopic && (
                            <button
                                onClick={() => setSelectedTopic(null)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                                <X className="w-3 h-3" /> Limpiar Filtro
                            </button>
                        )}
                    </header>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-h-[500px]">
                        {filteredComments.length > 0 ? (
                            filteredComments.map((comment: any, idx: number) => (
                                <div key={comment.id} className="relative pl-6 border-l-2 border-emerald-100 group">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="text-[10px] font-black text-slate-900">{comment.author_name}</span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {new Date(comment.comment_date).toLocaleString()}
                                        </span>
                                        <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight border border-purple-100">
                                            {comment.theme || "Sin Categoría"}
                                        </span>
                                        {comment.session_id && (
                                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[8px] font-bold">
                                                SID: {comment.session_id}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600 font-medium">{comment.comment_text}</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 flex flex-col items-center gap-3">
                                <Activity className="w-8 h-8 text-slate-200" />
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No se encontraron mensajes relevantes.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            <ConsolidatedReportModal
                isOpen={showConsolidatedModal}
                onClose={() => setShowConsolidatedModal(false)}
                data={consolidatedData}
            />
            <ThemeReportModal
                isOpen={showThemeModal}
                onClose={() => setShowThemeModal(false)}
                data={themeReportData}
            />
        </div>
    );
}
