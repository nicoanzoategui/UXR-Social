"use client";

import { useEffect, useState } from "react";
import {
  Users as UsersIcon,
  MessageSquare,
  Share2,
  TrendingUp,
  Calendar,
  Activity,
  X,
  ChevronDown,
  ArrowRight,
  FileText,
  Copy,
  Download,
  Check,
  Search,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { getSummary, getTrends, getDistribution, getTopics, getComments, getThemeReport, getConsolidatedReport } from "@/lib/api";
import TrendsChart from "@/components/TrendsChart";
import ConsolidatedReportModal from "@/components/ConsolidatedReportModal";
import ThemeReportModal from "@/components/ThemeReportModal";
import { AnimatePresence } from "framer-motion";

export default function GoogleReviewsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [distribution, setDistribution] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [themeComments, setThemeComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [themeReportData, setThemeReportData] = useState<any>(null);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [consolidatedData, setConsolidatedData] = useState<any>(null);
  const [showConsolidatedModal, setShowConsolidatedModal] = useState(false);
  const [isGeneratingConsolidated, setIsGeneratingConsolidated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filter State
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: "",
    end: ""
  });
  const [activePreset, setActivePreset] = useState("all");

  useEffect(() => {
    fetchData();
  }, [selectedNetworks, dateRange]);

  async function fetchData() {
    setIsRefreshing(true);
    try {
      const params = {
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
        network: "Google" // Force Google Reviews
      };

      const [sumData, trendData, distData, topicData] = await Promise.all([
        getSummary(params),
        getTrends(params),
        getDistribution(params),
        getTopics(params)
      ]);
      setSummary(sumData);
      setTrends(trendData);
      setDistribution(distData);
      setTopics(topicData || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
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
    setSelectedNetworks([]);
    setActivePreset("all");
  };

  const openThemeDetails = async (themeName: string) => {
    setSelectedTheme(themeName);
    setLoadingComments(true);
    try {
      const params = {
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
        network: "Google",
        theme: themeName
      };
      const data = await getComments(params);
      setThemeComments(data);
    } catch (error) {
      console.error("Error fetching theme comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const generateReport = async () => {
    if (!selectedTheme) return;
    setIsGeneratingReport(true);
    try {
      const params = {
        theme: selectedTheme,
        network: "Google",
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined
      };
      const data = await getThemeReport(params);
      setThemeReportData(data);
      setShowThemeModal(true);
    } catch (error) {
      console.error("Error generating theme report:", error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const generateConsolidatedReport = async () => {
    setIsGeneratingConsolidated(true);
    try {
      const params = {
        network: "Google",
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

  const toggleNetwork = (id: string) => {
    if (id === "") {
      setSelectedNetworks([]);
      return;
    }

    setSelectedNetworks(prev =>
      prev.includes(id)
        ? prev.filter(n => n !== id)
        : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-sky-500/10 rounded-full border border-sky-500/20 flex items-center justify-center">
            <Activity className="w-6 h-6 text-sky-600 animate-spin" />
          </div>
          <p className="text-slate-500 font-medium tracking-wide">Cargando inteligencia...</p>
        </div>
      </div>
    );
  }

  const stats = [
    { name: "Total Reseñas", value: summary?.total_comments || 0, icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-50", growth: summary?.growth?.total },
    { name: "Autores Únicos", value: summary?.unique_authors || 0, icon: UsersIcon, color: "text-purple-600", bg: "bg-purple-50", growth: summary?.growth?.authors },
    { name: "Puntuación Media", value: "4.8", icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50", growth: 0 },
    { name: "Volumen Diario", value: summary?.avg_per_day || 0, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", growth: summary?.growth?.avg },
  ];

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="heading-xl">Analytics de Reseñas Google</h1>
          <p className="body-md mt-2 text-[var(--color-text-muted)]">Monitoreo de feedback y reputación en Google Maps.</p>
        </div>

        {isRefreshing && (
          <div className="flex items-center gap-2 text-[10px] font-bold text-sky-600 uppercase tracking-widest bg-sky-50 px-3 py-1 rounded-full border border-sky-100">
            <Activity className="w-3 h-3 animate-spin" /> Actualizando Datos
          </div>
        )}

        <button
          onClick={generateConsolidatedReport}
          disabled={isGeneratingConsolidated}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
        >
          {isGeneratingConsolidated ? (
            <Activity className="w-3 h-3 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          Reporte Consolidado
        </button>
      </header>

      {/* NEW FILTER BAR */}
      <div className="card p-6 shadow-sm border border-[var(--color-border-soft)] space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Filtros Rápidos:</span>
            {[
              { label: "all", text: "Todo", days: 0 },
              { label: "7d", text: "Semana", days: 7 },
              { label: "15d", text: "15 Días", days: 15 },
              { label: "1m", text: "Mes", days: 30 },
              { label: "3m", text: "3 Meses", days: 90 }
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => preset.days === 0 ? clearFilters() : applyPreset(preset.days, preset.label)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activePreset === preset.label
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200 scale-105'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
              >
                {preset.text}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Fuente:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white text-slate-900 shadow-sm border border-slate-200">
                Google Maps
              </button>
            </div>
          </div>
        </div>

        {/* Custom Range */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-slate-50">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, start: e.target.value }));
                setActivePreset("custom");
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-sky-400"
            />
            <span className="text-slate-300">→</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, end: e.target.value }));
                setActivePreset("custom");
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-sky-400"
            />
          </div>

          <button
            onClick={clearFilters}
            className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors ml-auto flex items-center gap-2"
          >
            <X className="w-3 h-3" /> Limpiar Filtros
          </button>
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
            className="card p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center border border-[var(--color-border-soft)]`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.name}</p>
                <h3 className="text-2xl font-black text-[var(--color-primary-900)] mt-1">{stat.value}</h3>
              </div>
            </div>

            {stat.growth !== undefined && stat.growth !== 0 && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${stat.growth > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {stat.growth > 0 ? <TrendingUp className="w-3 h-3" /> : <Activity className="w-3 h-3 rotate-180" />}
                {Math.abs(stat.growth)}%
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trends Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-3 card p-8 min-h-[450px] shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="heading-md flex items-center gap-3">
                <Calendar className="w-6 h-6 text-sky-600" />
                Tendencias de Evolución
              </h2>
              <p className="body-sm mt-1">Interacciones a lo largo del tiempo con filtros activos.</p>
            </div>
          </div>
          <div className="h-[300px]">
            <TrendsChart data={trends} />
          </div>
        </motion.div>

        {/* NEW CONVERSATION THEMES SECTION */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-8 lg:col-span-3 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-primary-900)] flex items-center gap-2 font-heading">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                Temas de Conversación
              </h2>
              <p className="body-sm mt-1">Categorización de temas e intenciones de alto nivel.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {topics.map((topic: any, index: number) => (
              <div
                key={topic.topic}
                onClick={() => openThemeDetails(topic.topic)}
                className="group cursor-pointer p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
              >
                <div className="flex justify-between items-center text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-700 uppercase tracking-wider">{topic.topic}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-purple-600 transition-colors" />
                  </div>
                  <span className="font-bold text-slate-400">{topic.count} comentarios</span>
                </div>
                <div className="h-2 bg-slate-100/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(topic.count / Math.max(summary.total_comments, 1)) * 100}%` }}
                    className={`h-full rounded-full ${index === 0 ? 'bg-purple-500' :
                      index === 1 ? 'bg-sky-500' :
                        index === 2 ? 'bg-emerald-500' :
                          'bg-slate-400'
                      }`}
                    transition={{ duration: 1, delay: index * 0.1 }}
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest group-hover:text-purple-600 transition-colors flex items-center gap-1">
                  Ver comentarios <ArrowRight className="w-2.5 h-2.5" />
                </p>
              </div>
            ))}
            {topics.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-8 italic col-span-2">No themes identified yet.</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Social Distribution Refined */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-8 shadow-sm"
        >
          <h2 className="text-lg font-bold text-[var(--color-primary-900)] mb-6 flex items-center gap-2 font-heading">
            <Share2 className="w-5 h-5 text-emerald-600" />
            Mix de Redes Sociales
          </h2>
          <div className="space-y-6">
            {distribution?.networks?.map((net: any) => (
              <div key={net.name} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${net.name === 'Instagram' ? 'bg-pink-50 text-pink-600 border-pink-100' :
                      net.name === 'Facebook' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        net.name === 'LinkedIn' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                          net.name === 'X' ? 'bg-slate-50 text-slate-600 border-slate-100' :
                            net.name === 'Google' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              'bg-slate-50 text-slate-600 border-slate-100'
                      }`}>{net.name}</span>
                  </div>
                  <span className="text-xl font-black text-[var(--color-primary-900)]">{net.value}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(net.value / Math.max(summary.total_comments, 1)) * 100}%` }}
                    className={`h-full opacity-80 ${net.name === 'Instagram' ? 'bg-pink-500' :
                      net.name === 'Facebook' ? 'bg-blue-500' :
                        net.name === 'LinkedIn' ? 'bg-sky-500' :
                          net.name === 'Google' ? 'bg-amber-500' :
                            'bg-slate-500'
                      }`}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
            {(!distribution?.networks || distribution.networks.length === 0) && (
              <p className="text-slate-400 text-sm text-center py-8 italic">No hay datos de redes para mostrar.</p>
            )}
          </div>
        </motion.div>

      </div>

      {/* THEME DETAILS MODAL */}
      <AnimatePresence>
        {selectedTheme && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTheme(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-white rounded-3xl shadow-2xl z-[101] flex flex-col overflow-hidden border border-slate-200"
            >
              <header className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-1 block">Análisis Detallado</span>
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <MessageSquare className="w-6 h-6 text-purple-600" />
                      {selectedTheme}
                    </h3>
                  </div>
                  <button
                    onClick={generateReport}
                    disabled={isGeneratingReport}
                    className="ml-4 flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-200 disabled:opacity-50"
                  >
                    {isGeneratingReport ? (
                      <Activity className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Generar Reporte IA
                  </button>
                </div>
                <button
                  onClick={() => setSelectedTheme(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {loadingComments ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <Activity className="w-8 h-8 text-purple-500 animate-spin" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Analizando comentarios...</p>
                  </div>
                ) : themeComments.length > 0 ? (
                  themeComments.map((comment: any, idx: number) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="relative pl-6 border-l-2 border-purple-100"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-slate-900 group">{comment.author_name}</span>
                        <span className="text-[10px] font-bold text-slate-400">{new Date(comment.comment_date).toLocaleDateString()}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase text-white ${comment.network === 'Instagram' ? 'bg-pink-500' :
                          comment.network === 'Facebook' ? 'bg-blue-500' :
                            comment.network === 'LinkedIn' ? 'bg-sky-500' :
                              comment.network === 'Google' ? 'bg-amber-500' :
                                'bg-slate-500'
                          }`}>{comment.network}</span>
                      </div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">{comment.comment_text}</p>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">No se encontraron comentarios con estos filtros.</p>
                  </div>
                )}
              </div>

              <footer className="px-8 py-6 bg-slate-50/80 border-t border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Mostrando {themeComments.length} interacciones detectadas
                </p>
              </footer>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
