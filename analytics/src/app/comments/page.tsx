"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  Share2,
  ExternalLink,
  MessageSquare,
  Tag as TagIcon,
  Plus,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Star
} from "lucide-react";
import { getComments, updateCommentTags } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

export default function CommentsPage() {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [themeFilter, setThemeFilter] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [activePreset, setActivePreset] = useState("all");
  const [editingTags, setEditingTags] = useState<number | null>(null);
  const [newTag, setNewTag] = useState("");
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchComments();
  }, [selectedNetworks, themeFilter, dateRange]);

  async function fetchComments() {
    setLoading(true);
    try {
      const data = await getComments({
        network: selectedNetworks.length > 0 ? selectedNetworks.join(',') : undefined,
        search: search || undefined,
        theme: themeFilter || undefined,
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined
      });
      setComments(data);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
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
    setThemeFilter("");
    setSearch("");
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

  const toggleThread = (key: string) => {
    const newExpanded = new Set(expandedThreads);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedThreads(newExpanded);
  };

  // Group comments into threads by author
  const getThreadedComments = () => {
    const groups: { [key: string]: any[] } = {};
    comments.forEach(c => {
      const key = `${c.author_name}-${c.network}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    // Sort groups by the date of the latest comment in each thread
    return Object.entries(groups).sort((a, b) => {
      const lastA = new Date(a[1][0].comment_date).getTime();
      const lastB = new Date(b[1][0].comment_date).getTime();
      return lastB - lastA;
    });
  };

  const threadedComments = getThreadedComments();

  const handleAddTag = async (commentId: number, currentTags: string) => {
    if (!newTag.trim()) return;
    const updatedTags = currentTags ? `${currentTags},${newTag.trim()}` : newTag.trim();
    try {
      await updateCommentTags(commentId, updatedTags);
      setComments(comments.map(c => c.id === commentId ? { ...c, tags: updatedTags } : c));
      setNewTag("");
    } catch (error) {
      console.error("Error updating tags:", error);
    }
  };

  const handleRemoveTag = async (commentId: number, tagToRemove: string, currentTags: string) => {
    const updatedTags = (currentTags || "")
      .split(",")
      .filter(t => t.trim() !== tagToRemove.trim())
      .join(",");
    try {
      await updateCommentTags(commentId, updatedTags);
      setComments(comments.map(c => c.id === commentId ? { ...c, tags: updatedTags } : c));
    } catch (error) {
      console.error("Error removing tag:", error);
    }
  };

  return (
    <div className="space-y-10 pb-12">
      <header>
        <h1 className="heading-xl">Comentarios Redes Sociales</h1>
        <p className="body-md mt-2 text-[var(--color-text-muted)]">Explora conversaciones agrupadas por usuario en tus redes sociales (IG, FB, LI, X).</p>
      </header>

      {/* NEW FILTER BAR (Synced with Analytics) */}
      <div className="card p-6 shadow-sm border border-[var(--color-border-soft)] space-y-6">
        {/* Row 1: Search */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar palabras clave en comentarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchComments()}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-[var(--color-text-body)] focus:outline-none focus:border-[var(--color-primary-600)] transition-all text-sm"
          />
        </div>

        {/* Row 2: Presets & Networks */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
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
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Red Social:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {[
                { id: "", label: "Todas" },
                { id: "Instagram", label: "IG" },
                { id: "Facebook", label: "FB" },
                { id: "LinkedIn", label: "LI" },
                { id: "X", label: "X" },
                { id: "google_maps", label: "G-Maps" }
              ].map(net => (
                <button
                  key={net.id}
                  onClick={() => toggleNetwork(net.id)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${(net.id === "" && selectedNetworks.length === 0) || (net.id !== "" && selectedNetworks.includes(net.id))
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {net.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Themes & Custom Range */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 pt-4 border-t border-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Tema:</span>
            <select
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-xs font-bold focus:outline-none focus:border-[var(--color-primary-600)] transition-all outline-none appearance-none cursor-pointer pr-10"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/px\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23677489\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
            >
              <option value="">Todos los Temas</option>
              <option value="Inscripciones">Inscripciones</option>
              <option value="Soporte & Ayuda">Soporte & Ayuda</option>
              <option value="Costos">Costos</option>
              <option value="Feedback">Feedback</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, start: e.target.value }));
                setActivePreset("custom");
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-[var(--color-primary-600)]"
            />
            <span className="text-slate-300">→</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange(prev => ({ ...prev, end: e.target.value }));
                setActivePreset("custom");
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-[var(--color-primary-600)]"
            />
          </div>

          <button
            onClick={clearFilters}
            className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors lg:ml-auto flex items-center gap-2"
          >
            <X className="w-3 h-3" /> Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Grid of Thread Cards */}
      <div className="grid grid-cols-1 gap-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-8 animate-pulse space-y-4 shadow-sm border border-[var(--color-border-soft)]">
              <div className="flex justify-between">
                <div className="w-48 h-6 bg-slate-100 rounded" />
                <div className="w-24 h-6 bg-slate-100 rounded" />
              </div>
              <div className="w-full h-24 bg-slate-50 rounded-xl" />
            </div>
          ))
        ) : (
          threadedComments.map(([key, threadComments]) => {
            const firstComment = threadComments[0];
            const isExpanded = expandedThreads.has(key);
            const visibleComments = isExpanded ? threadComments : [firstComment];

            return (
              <motion.div
                layout
                key={key}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card shadow-sm border border-[var(--color-border-soft)] overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Thread Header */}
                <div
                  onClick={() => toggleThread(key)}
                  className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center text-[var(--color-primary-700)] font-black text-sm">
                      {firstComment.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--color-primary-900)] leading-tight">{firstComment.author_name}</h3>
                      <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-0.5">{firstComment.account_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-pill text-[10px] font-bold uppercase tracking-wider border shadow-sm ${firstComment.network === 'Instagram' ? 'bg-pink-50 text-pink-600 border-pink-100' :
                      firstComment.network === 'Facebook' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        firstComment.network === 'LinkedIn' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                          firstComment.network === 'Google' ? 'bg-red-50 text-red-600 border-red-100' :
                            firstComment.network === 'google_maps' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                              'bg-slate-50 text-slate-600 border-slate-100'
                      }`}>
                      {firstComment.network}
                    </div>

                    <div className={`px-3 py-1 rounded-pill text-[10px] font-bold uppercase tracking-wider border shadow-sm ${firstComment.theme === 'Inscripciones' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                      firstComment.theme === 'Soporte & Ayuda' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        firstComment.theme === 'Costos' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          firstComment.theme === 'Feedback' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                            'bg-slate-50 text-slate-600 border-slate-100'
                      }`}>
                      {firstComment.theme || 'Otros'}
                    </div>

                    {threadComments.length > 1 && (
                      <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    )}
                  </div>
                </div>

                {/* Thread Body (Comments) */}
                <div className="p-8 space-y-6 bg-white relative">
                  {/* Vertical Line for threading visual (only if expanded and more than 1) */}
                  {isExpanded && threadComments.length > 1 && (
                    <div className="absolute left-12 top-0 bottom-0 w-0.5 bg-slate-100 -z-1" />
                  )}

                  {visibleComments.map((comment, index) => (
                    <div key={comment.id} className="relative pl-12">
                      {/* Connection Dot */}
                      <div className="absolute left-0 top-3 w-3 h-3 rounded-full bg-white border-2 border-[var(--color-primary-400)] -translate-x-1/2 z-10" />

                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-black text-slate-700">
                            {new Date(comment.comment_date).toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100">
                            {(() => {
                              const diffTime = Math.abs(new Date().getTime() - new Date(comment.comment_date).getTime());
                              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                              if (diffDays === 0) return "Hoy";
                              if (diffDays === 1) return "Hace 1 día";
                              return `Hace ${diffDays} días`;
                            })()}
                          </span>
                          {comment.rating && (
                            <div className="flex items-center gap-0.5 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-2.5 h-2.5 ${i < comment.rating ? 'fill-orange-400 text-orange-400' : 'text-orange-200'}`} />
                              ))}
                              <span className="text-[9px] font-black text-orange-600 ml-1">{comment.rating}</span>
                            </div>
                          )}
                          {comment.tags && (
                            <div className="flex gap-2">
                              {comment.tags.split(",").filter((t: string) => t.trim()).map((tag: string) => (
                                <span key={tag} className="px-2 py-0.5 bg-slate-100 rounded-lg text-[9px] font-bold text-slate-500 flex items-center gap-1">
                                  <TagIcon className="w-2.5 h-2.5" />
                                  {tag.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className={`body-md text-[var(--color-text-body)] font-medium leading-relaxed ${!isExpanded ? 'line-clamp-1' : ''}`}>
                          {comment.comment_text}
                        </p>

                        {comment.owner_reply && (
                          <div className="bg-slate-50 border-l-2 border-slate-200 p-4 rounded-r-xl mt-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Respuesta del Propietario</p>
                            <p className="text-sm text-slate-600 italic leading-relaxed">
                              {comment.owner_reply}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-4 pt-1">
                          {editingTags === comment.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddTag(comment.id, comment.tags)}
                                placeholder="New tag..."
                                className="bg-white border border-[var(--color-primary-400)] rounded-lg px-2 py-1 text-[10px] text-[var(--color-text-body)] focus:outline-none w-24"
                              />
                              <button onClick={() => handleAddTag(comment.id, comment.tags)} className="text-emerald-600">
                                <Check className="w-3 h-3" />
                              </button>
                              <button onClick={() => setEditingTags(null)} className="text-slate-400">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingTags(comment.id)}
                              className="text-[10px] font-bold text-slate-400 hover:text-[var(--color-primary-600)] flex items-center gap-1.5 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Tag
                            </button>
                          )}
                          <a href={comment.link} target="_blank" className="text-[10px] font-bold text-slate-400 hover:text-[var(--color-primary-600)] flex items-center gap-1.5 transition-colors">
                            <ExternalLink className="w-3 h-3" /> Link
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Thread Actions */}
                <div className="px-8 py-4 bg-slate-50/30 border-t border-slate-100 flex justify-between items-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {threadComments.length} {threadComments.length === 1 ? 'INTERACCIÓN' : 'INTERACCIONES'}
                  </p>
                  {threadComments.length > 1 && (
                    <button
                      onClick={() => toggleThread(key)}
                      className="text-[10px] font-black text-[var(--color-primary-700)] hover:text-[var(--color-primary-900)] uppercase tracking-wider transition-colors flex items-center gap-2"
                    >
                      {isExpanded ? 'Ver menos' : `Ver todo el hilo (${threadComments.length})`}
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}

        {!loading && threadedComments.length === 0 && (
          <div className="card p-24 text-center shadow-sm border border-[var(--color-border-soft)]">
            <Share2 className="w-16 h-16 text-slate-200 mx-auto mb-6" />
            <h3 className="heading-md">No conversations found</h3>
            <p className="body-md text-[var(--color-text-muted)] mt-2">Adjust your search or network filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
