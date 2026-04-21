"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessagesSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getCommentsPaged } from "@/lib/api";
import {
  viewerBtnSecondary,
  viewerInput,
  viewerMuted,
  viewerTabActive,
  viewerTabInactive,
} from "@/lib/viewer-ui";

const PAGE_SIZE = 50;
const REDES_NETWORKS = "Instagram,Facebook,LinkedIn,X";
const ALL_NETWORKS = `${REDES_NETWORKS},Chatbot`;

type TabId = "todos" | "redes" | "chatbot";

type AuthorGroup = {
  key: string;
  comments: Record<string, unknown>[];
  latest: Record<string, unknown>;
};

function normalizeAuthorKey(c: Record<string, unknown>): string {
  const name = String(c.author_name || "").trim().toLowerCase();
  return name || `__id_${String(c.id)}`;
}

function groupItemsByAuthor(items: Record<string, unknown>[]): AuthorGroup[] {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const c of items) {
    const k = normalizeAuthorKey(c);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  const groups: AuthorGroup[] = [];
  for (const [key, comments] of map) {
    const sorted = [...comments].sort(
      (a, b) =>
        new Date(String(b.comment_date)).getTime() -
        new Date(String(a.comment_date)).getTime()
    );
    groups.push({ key, comments: sorted, latest: sorted[0] });
  }
  groups.sort(
    (a, b) =>
      new Date(String(b.latest.comment_date)).getTime() -
      new Date(String(a.latest.comment_date)).getTime()
  );
  return groups;
}

function uniqueNetworks(comments: Record<string, unknown>[]): string[] {
  return [...new Set(comments.map((c) => String(c.network || "")).filter(Boolean))];
}

function OriginBadge({ network }: { network: string }) {
  const label =
    network === "google_maps"
      ? "Google Maps"
      : network === "Chatbot"
        ? "Chatbot"
        : network;

  const styleMap: Record<string, { bg: string; color: string }> = {
    Instagram: { bg: "#fce4ec", color: "#c2185b" },
    Facebook: { bg: "#e3f2fd", color: "#1565c0" },
    LinkedIn: { bg: "#e8f5e9", color: "#2e7d32" },
    X: { bg: "#f5f5f5", color: "#37352f" },
    Chatbot: { bg: "#ede7f6", color: "#4527a0" },
  };

  const s =
    styleMap[network] ||
    (network === "google_maps"
      ? { bg: "#f5f5f5", color: "#37352f" }
      : { bg: "var(--color-bg-soft)", color: "var(--color-text-muted)" });

  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md shrink-0 border border-[var(--color-border-soft)]"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {label}
    </span>
  );
}

function ThemeBadge({ theme }: { theme: string | null | undefined }) {
  const t = theme || "Sin clasificar";
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-[var(--color-border-soft)] shrink-0 max-w-[140px] truncate">
      {t}
    </span>
  );
}

export default function ConversacionesPage() {
  const [tab, setTab] = useState<TabId>("todos");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadMessages, setThreadMessages] = useState<Record<string, unknown>[]>([]);
  const [threadTitle, setThreadTitle] = useState("");

  const buildNetworkParam = useCallback(() => {
    if (tab === "chatbot") return "Chatbot";
    if (selectedNetworks.length > 0) return selectedNetworks.join(",");
    if (tab === "todos") return ALL_NETWORKS;
    return REDES_NETWORKS;
  }, [tab, selectedNetworks]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const { items: rows, total: t } = await getCommentsPaged({
        network: buildNetworkParam(),
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
        search: searchApplied || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(rows);
      setTotal(t);
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildNetworkParam, dateRange.start, dateRange.end, searchApplied, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    setPage(0);
  }, [tab, dateRange.start, dateRange.end, searchApplied, selectedNetworks]);

  const applySearch = () => {
    setSearchApplied(searchInput.trim());
    setPage(0);
  };

  const toggleNetwork = (id: string) => {
    if (id === "") {
      setSelectedNetworks([]);
      return;
    }
    setSelectedNetworks((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const openThread = async (
    c: Record<string, unknown>,
    opts?: { authorThread?: boolean }
  ) => {
    setPanelOpen(true);
    setThreadLoading(true);
    setThreadTitle(String(c.author_name || "Mensaje"));
    const net = String(c.network || "");
    const forceAuthor = opts?.authorThread === true;

    try {
      let rows: Record<string, unknown>[] = [];

      if (!forceAuthor && net === "Chatbot" && c.session_id) {
        const r = await getCommentsPaged({
          session_id: String(c.session_id),
          limit: 500,
          offset: 0,
        });
        rows = r.items;
        setThreadTitle(`Sesión · ${String(c.session_id).slice(0, 24)}…`);
      } else if (!forceAuthor && c.post_id) {
        const r = await getCommentsPaged({
          post_id: String(c.post_id),
          limit: 500,
          offset: 0,
        });
        rows = r.items;
        setThreadTitle("Hilo del post");
      } else {
        const author = String(c.author_name || "").trim();
        if (!author) {
          rows = [c];
          setThreadTitle("Mensaje");
        } else {
          const r = await getCommentsPaged({
            network: buildNetworkParam(),
            start_date: dateRange.start || undefined,
            end_date: dateRange.end || undefined,
            search: searchApplied || undefined,
            author_name: author,
            limit: 500,
            offset: 0,
          });
          rows = r.items.length ? r.items : [c];
          setThreadTitle(
            `${author} · ${rows.length} mensaje${rows.length === 1 ? "" : "s"}`
          );
        }
      }

      rows = [...rows].sort(
        (a, b) =>
          new Date(String(a.comment_date)).getTime() -
          new Date(String(b.comment_date)).getTime()
      );
      setThreadMessages(rows);
    } catch (e) {
      console.error(e);
      setThreadMessages([c]);
    } finally {
      setThreadLoading(false);
    }
  };

  const groupedItems = useMemo(() => groupItemsByAuthor(items), [items]);

  const closePanel = () => {
    setPanelOpen(false);
    setThreadMessages([]);
  };

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const networkOptions = [
    { id: "", label: "Todas" },
    { id: "Instagram", label: "IG" },
    { id: "Facebook", label: "FB" },
    { id: "LinkedIn", label: "LI" },
    { id: "X", label: "X" },
  ];

  return (
    <div className="space-y-8 pb-12 relative">
      <header>
        <h1 className="heading-xl">Conversaciones</h1>
        <p className={`body-md mt-2 ${viewerMuted}`}>
          Mensajes de redes sociales y chatbot en un solo lugar.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-4">
        {(
          [
            { id: "todos" as TabId, label: "Todos" },
            { id: "redes" as TabId, label: "Redes Sociales" },
            { id: "chatbot" as TabId, label: "Chatbot" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`transition-all duration-300 ${
              tab === t.id ? viewerTabActive : viewerTabInactive
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card card-pad-lg space-y-6 card-interactive">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((p) => ({ ...p, start: e.target.value }))
              }
              className={viewerInput}
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((p) => ({ ...p, end: e.target.value }))
              }
              className={viewerInput}
            />
          </div>
        </div>

        {(tab === "todos" || tab === "redes") && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              Red social
            </span>
            <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 w-fit">
              {networkOptions.map((net) => (
                <button
                  key={net.id || "all"}
                  type="button"
                  onClick={() => toggleNetwork(net.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all duration-300 ${
                    (net.id === "" && selectedNetworks.length === 0) ||
                    (net.id !== "" && selectedNetworks.includes(net.id))
                      ? "bg-white text-slate-900 border border-slate-200 shadow-sm ring-1 ring-blue-200/60"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {net.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en texto o autor…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              className={`w-full rounded-xl pl-11 pr-4 py-3 ${viewerInput}`}
            />
          </div>
          <button
            type="button"
            onClick={applySearch}
            className="btn btn-primary px-6 min-h-0 h-12 shrink-0"
          >
            Buscar
          </button>
        </div>
      </div>

      <div className="card overflow-hidden card-interactive">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-[var(--color-text-muted)]">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">Cargando…</span>
          </div>
        ) : items.length === 0 ? (
          <p className="text-center py-16 text-sm text-[var(--color-text-muted)] italic">
            No hay mensajes con estos filtros.
          </p>
        ) : (
          <ul className="divide-y divide-[#e2e8f0]">
            {groupedItems.map((g) => {
              const c = g.latest;
              const n = g.comments.length;
              const multi = n > 1;
              const nets = uniqueNetworks(g.comments);
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => openThread(c, { authorThread: multi })}
                    className={`w-full text-left p-5 transition-all duration-200 flex flex-col gap-2 hover:bg-[#f8fafc] ${
                      multi
                        ? "border-l-[3px] border-l-[#3b82f6] bg-white/80"
                        : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {multi ? (
                        <span className="inline-flex items-center gap-1 rounded-[20px] bg-[#eff6ff] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563eb]">
                          <MessagesSquare className="h-3.5 w-3.5" />
                          Hilo · {n} mensajes
                        </span>
                      ) : null}
                      {nets.length <= 2
                        ? nets.map((net) => (
                            <OriginBadge key={net} network={net} />
                          ))
                        : (
                            <>
                              <OriginBadge network={nets[0]} />
                              <span className="text-[10px] font-medium text-[#64748b]">
                                +{nets.length - 1} redes
                              </span>
                            </>
                          )}
                      {!multi ? (
                        <ThemeBadge theme={c.theme as string} />
                      ) : null}
                      <span className="text-xs text-[#64748b] ml-auto">
                        {c.comment_date
                          ? new Date(String(c.comment_date)).toLocaleString()
                          : ""}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#1e293b] break-words">
                      {String(c.author_name || "—")}
                    </p>
                    <p className="text-sm text-[#1e293b] line-clamp-3 text-left">
                      {multi ? (
                        <span className="text-[#64748b]">Último: </span>
                      ) : null}
                      {String(c.comment_text || "")}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200/80 bg-slate-50/90">
          <span className="text-xs text-slate-600">
            {total === 0
              ? "0 mensajes"
              : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className={`${viewerBtnSecondary} gap-1 px-3 py-2 disabled:opacity-40`}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              type="button"
              disabled={page >= maxPage || loading}
              onClick={() => setPage((p) => p + 1)}
              className={`${viewerBtnSecondary} gap-1 px-3 py-2 disabled:opacity-40`}
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              role="presentation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 bg-slate-900/25 z-[80] cursor-pointer backdrop-blur-[1px]"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#f9fafb] border-l border-slate-200 z-[90] flex flex-col shadow-xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-200/90 bg-white/80">
                <h2 className="text-sm font-semibold text-[var(--color-text-heading)] truncate pr-2">
                  {threadTitle}
                </h2>
                <button
                  type="button"
                  onClick={closePanel}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-soft)] text-[var(--color-text-muted)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {threadLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-muted)]" />
                  </div>
                ) : (
                  threadMessages.map((m) => (
                    <div
                      key={String(m.id)}
                      className="p-3 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-page)]"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <OriginBadge network={String(m.network || "")} />
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {m.comment_date
                            ? new Date(String(m.comment_date)).toLocaleString()
                            : ""}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[var(--color-text-heading)] mb-1">
                        {String(m.author_name || "—")}
                      </p>
                      <p className="text-sm text-[var(--color-text-body)]">
                        {String(m.comment_text || "")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
