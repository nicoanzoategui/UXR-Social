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
import {
  viewerBtnPrimary,
  viewerCardGradient,
  viewerInput,
  viewerTabActive,
  viewerTabInactive,
} from "@/lib/viewer-ui";

const REDES = "Instagram,Facebook,LinkedIn,X";
const ALL = `${REDES},Chatbot`;

const METRIC_STYLES = [
  { accent: "#3b82f6" },
  { accent: "#0d9488" },
  { accent: "#10b981" },
  { accent: "#f59e0b" },
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
    <div className="space-y-6 pb-12">
      {fetchError && (
        <div className="bg-rose-50 border border-[var(--color-border-soft)] text-rose-800 px-4 py-3 rounded-lg text-sm font-medium">
          {fetchError}
        </div>
      )}

      <header>
        <h1 className="text-2xl font-bold leading-tight text-[#1e293b] md:text-3xl">
          Dashboard
        </h1>
        <p className="mt-2 text-base text-[#64748b]">
          Resumen de actividad en redes y chatbot.
        </p>
      </header>

      <div className={`${viewerCardGradient} space-y-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
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
              className={`transition-all duration-300 ease-out ${
                activePreset === preset.label ? viewerTabActive : viewerTabInactive
              }`}
            >
              {preset.text}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#e2e8f0] pt-4">
          <Calendar className="h-4 w-4 shrink-0 text-[#64748b]" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => {
              setDateRange((p) => ({ ...p, start: e.target.value }));
              setActivePreset("custom");
            }}
            className={`${viewerInput} text-xs`}
          />
          <span className="text-[#94a3b8]">→</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => {
              setDateRange((p) => ({ ...p, end: e.target.value }));
              setActivePreset("custom");
            }}
            className={`${viewerInput} text-xs`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
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
              className="group relative flex items-start gap-4 overflow-hidden rounded-[24px] border border-[#e2e8f0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            >
              <div
                className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full"
                style={{ backgroundColor: style.accent }}
              >
                <div className="absolute inset-0 bg-white/20" aria-hidden />
                <m.icon className="relative h-6 w-6 text-white" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium uppercase tracking-wide text-[#64748b]">
                  {m.label}
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums leading-tight text-[#1e293b] md:text-5xl">
                  {m.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="card card-pad-lg card-interactive">
        <h2 className="section-title mb-2">Top 5 temas</h2>
        <p className="section-subtitle mb-6">Temas más frecuentes en el periodo seleccionado.</p>
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
                <div className="h-2 overflow-hidden rounded-full border border-[#e2e8f0] bg-[#f1f5f9]">
                  <div
                    className="h-full rounded-full bg-[#3b82f6] shadow-sm transition-[width] duration-300"
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
        className={`${viewerCardGradient} min-h-[400px] hover:shadow-md`}
      >
        <div className="mb-6">
          <h2 className="flex items-center gap-3 text-2xl font-bold leading-tight text-[#1e293b]">
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#3b82f6]">
              <span className="absolute inset-0 bg-white/20" aria-hidden />
              <Calendar className="relative h-6 w-6 text-white" />
            </span>
            Tendencias
          </h2>
          <p className="mt-2 text-base text-[#64748b]">
            Evolución en el tiempo (redes + chatbot).
          </p>
        </div>
        <div className="h-[300px]">
          <TrendsChart data={trends} />
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-4">
        <Link href="/conversaciones" className={viewerBtnPrimary}>
          Ver conversaciones
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
