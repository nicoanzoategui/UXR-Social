"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  LayoutList,
  Calendar,
  Activity,
  Tags,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { getSummary, getTrends, getTopics } from "@/lib/api";
import TrendsChart from "@/components/TrendsChart";

const REDES = "Instagram,Facebook,LinkedIn,X,google_maps";
const ALL = `${REDES},Chatbot`;

/** Primario vibrante para CTAs e interactivos */
const PRIMARY = "#2563eb";

const METRIC_STYLES = [
  {
    accent: "#3b82f6",
    gradient: "linear-gradient(145deg, #f9fafb 0%, rgba(59, 130, 246, 0.08) 100%)",
  },
  {
    accent: "#10b981",
    gradient: "linear-gradient(145deg, #f9fafb 0%, rgba(16, 185, 129, 0.08) 100%)",
  },
  {
    accent: "#8b5cf6",
    gradient: "linear-gradient(145deg, #f9fafb 0%, rgba(139, 92, 246, 0.08) 100%)",
  },
  {
    accent: "#f59e0b",
    gradient: "linear-gradient(145deg, #f9fafb 0%, rgba(245, 158, 11, 0.09) 100%)",
  },
] as const;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [activePreset, setActivePreset] = useState("all");

  const [totalAll, setTotalAll] = useState(0);
  const [totalRedes, setTotalRedes] = useState(0);
  const [totalChatbot, setTotalChatbot] = useState(0);
  const [uniqueTopics, setUniqueTopics] = useState(0);
  const [topThemes, setTopThemes] = useState<{ topic: string; count: number }[]>([]);
  const [trends, setTrends] = useState<
    { date: string; network: string; count: number }[]
  >([]);
  const [maxTopicCount, setMaxTopicCount] = useState(1);

  const dateParams = useMemo(
    () => ({
      start_date: dateRange.start || undefined,
      end_date: dateRange.end || undefined,
    }),
    [dateRange.start, dateRange.end]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        const [sumAll, sumRedes, sumBot, topicsRedes, topicsBot, trendRows] =
          await Promise.all([
            getSummary({ ...dateParams, network: ALL }),
            getSummary({ ...dateParams, network: REDES }),
            getSummary({ ...dateParams, network: "Chatbot" }),
            getTopics({ ...dateParams, network: REDES }),
            getTopics({ ...dateParams, network: "Chatbot" }),
            getTrends({ ...dateParams, network: ALL }),
          ]);
        if (cancelled) return;

        setTotalAll(sumAll?.total_comments ?? 0);
        setTotalRedes(sumRedes?.total_comments ?? 0);
        setTotalChatbot(sumBot?.total_comments ?? 0);

        const merged = new Map<string, number>();
        const addTopics = (arr: { topic?: string; count?: number }[]) => {
          (arr || []).forEach((row) => {
            const k = row.topic || "Sin clasificar";
            merged.set(k, (merged.get(k) || 0) + (row.count || 0));
          });
        };
        addTopics(topicsRedes || []);
        addTopics(topicsBot || []);
        setUniqueTopics(merged.size);
        const sorted = [...merged.entries()]
          .map(([topic, count]) => ({ topic, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopThemes(sorted);
        setMaxTopicCount(Math.max(1, sorted[0]?.count ?? 1));

        setTrends(
          (trendRows || []) as { date: string; network: string; count: number }[]
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setFetchError(
            "No se pudieron cargar los datos. Verificá la conexión o intentá de nuevo."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dateParams]);

  const applyPreset = (days: number, label: string) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setDateRange({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });
    setActivePreset(label);
  };

  const clearFilters = () => {
    setDateRange({ start: "", end: "" });
    setActivePreset("all");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-[var(--color-text-muted)]">
          <Activity className="w-10 h-10 animate-spin" />
          <p className="text-sm font-medium">Cargando panel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-12">
      {fetchError && (
        <div className="bg-rose-50 border border-[var(--color-border-soft)] text-rose-800 px-4 py-3 rounded-lg text-sm font-medium">
          {fetchError}
        </div>
      )}

      <header>
        <h1 className="heading-xl">Dashboard</h1>
        <p className="body-md mt-2 text-[var(--color-text-muted)]">
          Resumen de actividad en redes y chatbot.
        </p>
      </header>

      <div
        className="rounded-xl border border-slate-200/80 p-5 md:p-6 space-y-4 shadow-sm bg-[#f9fafb]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #f9fafb 0%, rgba(37, 99, 235, 0.04) 100%)",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mr-2">
            Periodo
          </span>
          {[
            { label: "all", text: "Todo", days: 0 },
            { label: "7d", text: "7 días", days: 7 },
            { label: "30d", text: "30 días", days: 30 },
            { label: "90d", text: "90 días", days: 90 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                preset.days === 0
                  ? clearFilters()
                  : applyPreset(preset.days, preset.label)
              }
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-300 ease-out ${
                activePreset === preset.label
                  ? "text-white shadow-md scale-[1.02]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50/60 hover:text-slate-800 hover:shadow-sm"
              }`}
              style={
                activePreset === preset.label
                  ? { backgroundColor: PRIMARY, borderColor: PRIMARY }
                  : undefined
              }
            >
              {preset.text}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200/80">
          <Calendar className="w-4 h-4 text-slate-500" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => {
              setDateRange((p) => ({ ...p, start: e.target.value }));
              setActivePreset("custom");
            }}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 transition-all duration-200 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => {
              setDateRange((p) => ({ ...p, end: e.target.value }));
              setActivePreset("custom");
            }}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 transition-all duration-200 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Total mensajes",
            value: totalAll,
            icon: MessageSquare,
          },
          {
            label: "Mensajes redes",
            value: totalRedes,
            icon: LayoutList,
          },
          {
            label: "Mensajes chatbot",
            value: totalChatbot,
            icon: MessageSquare,
          },
          {
            label: "Temas únicos",
            value: uniqueTopics,
            icon: Tags,
          },
        ].map((m, i) => {
          const style = METRIC_STYLES[i];
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-xl border-x border-b border-slate-200/90 border-t-4 p-5 shadow-sm flex items-start gap-3 transition-all duration-300 ease-out hover:shadow-md hover:-translate-y-1 hover:border-slate-300/80"
              style={{
                background: style.gradient,
                borderTopColor: style.accent,
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105"
                style={{
                  backgroundColor: `${style.accent}18`,
                  color: style.accent,
                }}
              >
                <m.icon className="w-5 h-5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {m.label}
                </p>
                <p className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
                  {m.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200/80 p-6 md:p-8 shadow-sm bg-[#f9fafb] transition-all duration-300 hover:shadow-md">
        <h2 className="heading-md text-lg mb-6 text-slate-900">Top 5 temas</h2>
        <div className="space-y-4">
          {topThemes.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] italic">
              No hay datos de temas en este periodo.
            </p>
          ) : (
            topThemes.map((row) => (
              <div key={row.topic} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-[var(--color-text-body)] truncate pr-2">
                    {row.topic}
                  </span>
                  <span className="text-[var(--color-text-muted)] shrink-0">
                    {row.count}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200/80 border border-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm"
                    style={{
                      width: `${(row.count / maxTopicCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-200/80 p-6 md:p-8 shadow-sm bg-[#f9fafb] min-h-[400px] transition-all duration-300 hover:shadow-md"
        style={{
          backgroundImage:
            "linear-gradient(165deg, #f9fafb 0%, rgba(37, 99, 235, 0.05) 55%, #f9fafb 100%)",
        }}
      >
        <div className="mb-6">
          <h2 className="heading-md text-lg flex items-center gap-2 text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Calendar className="w-5 h-5" />
            </span>
            Tendencias
          </h2>
          <p className="body-sm mt-2 text-slate-600">
            Evolución en el tiempo (redes + chatbot).
          </p>
        </div>
        <div className="h-[300px]">
          <TrendsChart data={trends} />
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/conversaciones"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-blue-600/20 bg-[#2563eb] text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Ver conversaciones
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
