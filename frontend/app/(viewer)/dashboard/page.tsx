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

      <div className="card card-pad-lg border border-[var(--color-border-soft)] space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mr-2">
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
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                activePreset === preset.label
                  ? "bg-[var(--color-primary-800)] text-white border-[var(--color-primary-800)]"
                  : "bg-white text-[var(--color-text-muted)] border-[var(--color-border-soft)] hover:bg-[var(--color-bg-soft)]"
              }`}
            >
              {preset.text}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--color-border-soft)]">
          <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => {
              setDateRange((p) => ({ ...p, start: e.target.value }));
              setActivePreset("custom");
            }}
            className="bg-[var(--color-bg-soft)] border border-[var(--color-border-soft)] rounded-lg px-3 py-2 text-xs"
          />
          <span className="text-[var(--color-text-muted)]">→</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => {
              setDateRange((p) => ({ ...p, end: e.target.value }));
              setActivePreset("custom");
            }}
            className="bg-[var(--color-bg-soft)] border border-[var(--color-border-soft)] rounded-lg px-3 py-2 text-xs"
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
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-5 border border-[var(--color-border-soft)] flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-soft)] flex items-center justify-center border border-[var(--color-border-soft)] text-[var(--color-text-muted)]">
              <m.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                {m.label}
              </p>
              <p className="text-2xl font-semibold text-[var(--color-text-heading)] mt-1">
                {m.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card card-pad-lg border border-[var(--color-border-soft)]">
        <h2 className="heading-md text-lg mb-6">Top 5 temas</h2>
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
                <div className="h-2 rounded-full bg-[var(--color-bg-soft)] border border-[var(--color-border-soft)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary-600)] opacity-80"
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
        className="card card-pad-lg border border-[var(--color-border-soft)] min-h-[400px]"
      >
        <div className="mb-6">
          <h2 className="heading-md text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--color-text-muted)]" />
            Tendencias
          </h2>
          <p className="body-sm mt-1 text-[var(--color-text-muted)]">
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
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] text-sm font-semibold text-[var(--color-text-body)] hover:bg-[var(--color-bg-soft)] transition-colors"
        >
          Ver conversaciones
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/reportes"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[var(--color-primary-800)] text-white text-sm font-semibold hover:bg-[var(--color-primary-900)] transition-colors"
        >
          Ver reportes
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
