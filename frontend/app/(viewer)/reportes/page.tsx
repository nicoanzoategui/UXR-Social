"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Send,
  Plus,
  X,
  Mail,
  CheckCircle2,
  Loader2,
  Trash2,
  Sparkles,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sendReport, getFullReport, getTopics, api } from "@/lib/api";

const stepCircleClass =
  "inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-sm font-semibold";
const stepCircleStyle = { background: "#f1f1ef", color: "#37352f" };

const cardClass =
  "rounded-xl border border-[var(--color-border-soft)] bg-white p-6 sm:p-8";

type DateScope = "comment_date" | "dataset_upload";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFilePart(s: string, maxLen = 48) {
  return s.replace(/[^\w\-]+/g, "_").slice(0, maxLen) || "tema";
}

async function readAxiosBlobErrorMessage(err: unknown): Promise<string> {
  const ax = err as { response?: { data?: Blob }; message?: string };
  const data = ax.response?.data;
  if (data instanceof Blob) {
    try {
      const t = await data.text();
      const j = JSON.parse(t) as { detail?: string };
      return String(j.detail || t || "Error al descargar");
    } catch {
      return "Error al descargar el archivo.";
    }
  }
  return ax.message || "Error al descargar el archivo.";
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  /** Por defecto alineamos con el historial de subidas; el CSV grande suele tener mensajes fuera del rango del calendario. */
  const [dateScope, setDateScope] = useState<DateScope>("dataset_upload");
  const [emails, setEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [aiSummaryByTheme, setAiSummaryByTheme] = useState<Record<string, string>>({});
  const [aiErrorByTheme, setAiErrorByTheme] = useState<Record<string, string>>({});
  const [aiLoadingTheme, setAiLoadingTheme] = useState<string | null>(null);

  const [consolidatedSummary, setConsolidatedSummary] = useState<string | null>(null);
  const [consolidatedLoading, setConsolidatedLoading] = useState(false);
  const [consolidatedError, setConsolidatedError] = useState<string | null>(null);
  const [consolidatedVisible, setConsolidatedVisible] = useState(false);
  const [downloadBusyKey, setDownloadBusyKey] = useState<string | null>(null);
  const [fileDownloadError, setFileDownloadError] = useState<string | null>(null);

  const datesComplete = Boolean(dateRange.start && dateRange.end);

  useEffect(() => {
    setConsolidatedSummary(null);
    setConsolidatedError(null);
    setConsolidatedVisible(false);
    setFileDownloadError(null);
  }, [dateRange.start, dateRange.end, dateScope]);

  useEffect(() => {
    if (!dateRange.start || !dateRange.end) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setTopicsLoading(true);
      try {
        const data = await getTopics({
          start_date: dateRange.start,
          end_date: dateRange.end,
          include_chatbot: true,
          date_scope: dateScope,
        });
        if (!cancelled) setTopics(data || []);
      } catch {
        if (!cancelled) setTopics([]);
      } finally {
        if (!cancelled) setTopicsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateRange.start, dateRange.end, dateScope]);

  const handleThemeSummary = async (themeName: string) => {
    if (!dateRange.start || !dateRange.end) return;
    setAiLoadingTheme(themeName);
    setAiErrorByTheme((prev) => ({ ...prev, [themeName]: "" }));
    try {
      const { data } = await api.post<{
        summary: string;
        comments_analyzed: number;
        theme: string;
      }>(
        "/analytics/theme-summary",
        {},
        {
          params: {
            theme: themeName,
            start_date: dateRange.start,
            end_date: dateRange.end,
            include_chatbot: true,
            date_scope: dateScope,
          },
        }
      );
      setAiSummaryByTheme((prev) => ({
        ...prev,
        [themeName]: data.summary,
      }));
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg =
        ax.response?.data?.detail ||
        ax.message ||
        "No se pudo generar el resumen.";
      setAiErrorByTheme((prev) => ({ ...prev, [themeName]: String(msg) }));
    } finally {
      setAiLoadingTheme(null);
    }
  };

  const downloadConsolidatedPdf = async () => {
    if (!datesComplete) return;
    setFileDownloadError(null);
    setDownloadBusyKey("consolidated-pdf");
    try {
      const res = await api.get("/analytics/consolidated-pdf", {
        params: {
          start_date: dateRange.start,
          end_date: dateRange.end,
          include_chatbot: true,
          date_scope: dateScope,
        },
        responseType: "blob",
      });
      const blob =
        res.data instanceof Blob ? res.data : new Blob([res.data as BlobPart]);
      triggerBlobDownload(
        blob,
        `uxr_consolidado_${dateRange.start}_${dateRange.end}.pdf`
      );
    } catch (err) {
      setFileDownloadError(await readAxiosBlobErrorMessage(err));
    } finally {
      setDownloadBusyKey(null);
    }
  };

  const downloadThemePdf = async (topic: string) => {
    if (!datesComplete) return;
    setFileDownloadError(null);
    setDownloadBusyKey(`theme-pdf:${topic}`);
    try {
      const res = await api.get("/analytics/theme-pdf", {
        params: {
          theme: topic,
          start_date: dateRange.start,
          end_date: dateRange.end,
          include_chatbot: true,
          date_scope: dateScope,
        },
        responseType: "blob",
      });
      const blob =
        res.data instanceof Blob ? res.data : new Blob([res.data as BlobPart]);
      const part = safeFilePart(topic);
      triggerBlobDownload(
        blob,
        `uxr_tema_${part}_${dateRange.start}_${dateRange.end}.pdf`
      );
    } catch (err) {
      setFileDownloadError(await readAxiosBlobErrorMessage(err));
    } finally {
      setDownloadBusyKey(null);
    }
  };

  const handleConsolidatedClick = async () => {
    if (!dateRange.start || !dateRange.end || consolidatedLoading) return;
    if (consolidatedSummary && consolidatedVisible) {
      setConsolidatedVisible(false);
      return;
    }
    if (consolidatedSummary && !consolidatedVisible) {
      setConsolidatedVisible(true);
      return;
    }
    setConsolidatedLoading(true);
    setConsolidatedError(null);
    try {
      const { data } = await api.post<{ summary: string }>(
        "/analytics/consolidated-summary",
        {},
        {
          params: {
            start_date: dateRange.start,
            end_date: dateRange.end,
            include_chatbot: true,
            date_scope: dateScope,
          },
        }
      );
      setConsolidatedSummary(data.summary);
      setConsolidatedVisible(true);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg =
        ax.response?.data?.detail ||
        ax.message ||
        "No se pudo generar el resumen consolidado con IA.";
      setConsolidatedError(String(msg));
    } finally {
      setConsolidatedLoading(false);
    }
  };

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
        end_date: dateRange.end,
        include_chatbot: true,
        date_scope: dateScope,
      });

      setLoadingStep("Enviando emails...");
      await sendReport({
        emails,
        start_date: dateRange.start,
        end_date: dateRange.end,
        report_data: reportData,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: unknown) {
      console.error("Error in report process:", err);
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg =
        ax.response?.data?.detail ||
        "Hubo un error al procesar el reporte. Por favor, intenta nuevamente.";
      setError(msg);
    } finally {
      setIsSending(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-800)]">
          <FileText className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="heading-xl text-[var(--color-text-heading)]">Central de reportes</h1>
          <p className="body-md mt-1 text-[var(--color-text-muted)]">
            Configurá el período, revisá resultados y enviá el PDF por correo.
          </p>
        </div>
      </header>

      {/* ① Configurar análisis */}
      <section className={cardClass}>
        <div className="mb-6 flex items-center gap-3">
          <span className={stepCircleClass} style={stepCircleStyle}>
            1
          </span>
          <h2 className="text-lg font-bold text-[var(--color-text-heading)]">
            ① Configurar análisis
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Desde</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-page)] px-3 py-2.5 text-sm text-[var(--color-text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Hasta</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-page)] px-3 py-2.5 text-sm text-[var(--color-text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]/30"
            />
          </div>
        </div>
        <fieldset className="mt-6 space-y-2 border-0 p-0">
          <legend className="text-xs font-semibold text-[var(--color-text-muted)]">
            ¿Qué fechas usamos para armar el período?
          </legend>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--color-text-body)]">
            <input
              type="radio"
              name="date-scope"
              checked={dateScope === "dataset_upload"}
              onChange={() => setDateScope("dataset_upload")}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">Fecha de subida del archivo</span> — coincide con el historial de
              sincronización. Incluye todos los mensajes de los CSV subidos en el rango (recomendado si el export trae
              conversaciones de meses anteriores).
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--color-text-body)]">
            <input
              type="radio"
              name="date-scope"
              checked={dateScope === "comment_date"}
              onChange={() => setDateScope("comment_date")}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">Fecha del mensaje en el CSV</span> — solo comentarios cuya fecha de
              interacción cae entre Desde y Hasta.
            </span>
          </label>
        </fieldset>
      </section>

      {/* ② Resultados */}
      {datesComplete && (
        <section className={cardClass}>
          <div className="mb-6 flex items-center gap-3">
            <span className={stepCircleClass} style={stepCircleStyle}>
              2
            </span>
            <h2 className="text-lg font-bold text-[var(--color-text-heading)]">② Resultados</h2>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Temas detectados
              </h3>
              {topicsLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Cargando temas…
                </div>
              ) : topics.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No hay datos para este período</p>
              ) : (
                <ul className="space-y-4">
                  {topics.map((row) => (
                    <li
                      key={row.topic}
                      className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-page)]/50 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-text-heading)]">
                            {row.topic}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {row.count} comentarios
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                          <button
                            type="button"
                            onClick={() => handleThemeSummary(row.topic)}
                            disabled={aiLoadingTheme === row.topic}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-primary-700)] transition-colors hover:bg-[var(--color-bg-soft)] disabled:opacity-60"
                          >
                            {aiLoadingTheme === row.topic ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generando…
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                Resumen IA
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      {aiErrorByTheme[row.topic] ? (
                        <p className="mt-3 text-sm font-medium text-red-600">
                          {aiErrorByTheme[row.topic]}
                        </p>
                      ) : null}
                      {aiSummaryByTheme[row.topic] ? (
                        <div className="mt-3 space-y-3">
                          <div
                            className="whitespace-pre-wrap rounded-md border border-[var(--color-border-soft)] bg-[#f7f7f5] p-4 text-sm leading-relaxed text-[var(--color-text-body)]"
                            style={{ borderLeftWidth: 3, borderLeftColor: "#2383e2" }}
                          >
                            {aiSummaryByTheme[row.topic]}
                          </div>
                          <button
                            type="button"
                            onClick={() => downloadThemePdf(row.topic)}
                            disabled={downloadBusyKey === `theme-pdf:${row.topic}`}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text-heading)] transition-colors hover:bg-[var(--color-bg-soft)] disabled:opacity-60"
                          >
                            {downloadBusyKey === `theme-pdf:${row.topic}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            Descargar PDF
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-[var(--color-border-soft)] pt-8">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Resumen consolidado
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={handleConsolidatedClick}
                  disabled={consolidatedLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text-heading)] transition-colors hover:bg-[var(--color-bg-soft)] disabled:opacity-60"
                >
                  {consolidatedLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando resumen con IA…
                    </>
                  ) : consolidatedSummary && consolidatedVisible ? (
                    "Ocultar resumen"
                  ) : (
                    "Ver resumen"
                  )}
                </button>
                {consolidatedSummary ? (
                  <button
                    type="button"
                    onClick={downloadConsolidatedPdf}
                    disabled={!datesComplete || downloadBusyKey === "consolidated-pdf"}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text-heading)] transition-colors hover:bg-[var(--color-bg-soft)] disabled:opacity-60"
                  >
                    {downloadBusyKey === "consolidated-pdf" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Descargar PDF
                  </button>
                ) : null}
              </div>
              {consolidatedError ? (
                <p className="mt-3 text-sm font-medium text-red-600">{consolidatedError}</p>
              ) : null}
              {fileDownloadError ? (
                <p className="mt-3 text-sm font-medium text-red-600">{fileDownloadError}</p>
              ) : null}
              {consolidatedSummary && consolidatedVisible ? (
                <div
                  className="mt-4 max-h-[min(520px,60vh)] overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--color-border-soft)] bg-[#f7f7f5] p-4 text-sm leading-relaxed text-[var(--color-text-body)]"
                  style={{ borderLeftWidth: 3, borderLeftColor: "#2383e2" }}
                >
                  {consolidatedSummary}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* ③ Enviar reporte */}
      <section className={cardClass}>
        <div className="mb-6 flex items-center gap-3">
          <span className={stepCircleClass} style={stepCircleStyle}>
            3
          </span>
          <h2 className="text-lg font-bold text-[var(--color-text-heading)]">③ Enviar reporte</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={currentEmail}
                onChange={(e) => setCurrentEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-page)] py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]/30"
              />
            </div>
            <button
              type="button"
              onClick={addEmail}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-primary-900)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>

          <div className="min-h-[100px] space-y-2">
            <AnimatePresence>
              {emails.map((email) => (
                <motion.div
                  key={email}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-page)] px-3 py-2.5"
                >
                  <span className="text-sm font-medium text-[var(--color-text-body)]">{email}</span>
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="text-[var(--color-text-muted)] transition-colors hover:text-red-600"
                    aria-label={`Quitar ${email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {emails.length === 0 && (
              <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                Todavía no agregaste destinatarios.
              </p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                <X className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                ¡El reporte ha sido enviado con éxito!
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isSending || emails.length === 0 || !dateRange.start || !dateRange.end}
            className="btn btn-primary w-full justify-center py-3.5 text-sm font-semibold disabled:opacity-50"
          >
            {isSending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {loadingStep || "Procesando…"}
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Enviar reporte PDF
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
