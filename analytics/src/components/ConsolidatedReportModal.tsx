"use client";

import React, { useRef, useState } from "react";
import { X, Download, Activity, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
// Remove static imports to avoid build errors if not installed
// import html2canvas from "html2canvas";
// import { jsPDF } from "jspdf";

interface ConsolidatedReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
}

export default function ConsolidatedReportModal({ isOpen, onClose, data }: ConsolidatedReportModalProps) {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

    if (!data) return null;

    const loadScripts = () => {
        return new Promise<void>((resolve, reject) => {
            if ((window as any).html2canvas && (window as any).jspdf) {
                resolve();
                return;
            }

            const s1 = document.createElement("script");
            s1.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

            const s2 = document.createElement("script");
            s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

            let loadedCount = 0;
            const onLoaded = () => {
                loadedCount++;
                if (loadedCount === 2) resolve();
            };

            s1.onload = onLoaded;
            s2.onload = onLoaded;
            s1.onerror = reject;
            s2.onerror = reject;

            document.head.appendChild(s1);
            document.head.appendChild(s2);
        });
    };

    const handleDownload = async () => {
        if (!reportRef.current) return;

        setIsDownloading(true);
        setDownloadStatus("Cargando librerías...");

        try {
            await loadScripts();

            setDownloadStatus("Capturando el reporte, puede tardar unos segundos...");

            const html2canvas = (window as any).html2canvas;
            const { jsPDF } = (window as any).jspdf;

            const element = reportRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
            });

            const imgData = canvas.toDataURL("image/jpeg", 0.95);
            const pdf = new jsPDF({
                unit: "mm",
                format: "a4",
                orientation: "portrait",
            });

            const pW = pdf.internal.pageSize.getWidth();
            const pH = pdf.internal.pageSize.getHeight();
            const ratio = canvas.width / canvas.height;
            const imgW = pW;
            const imgH = imgW / ratio;

            let posY = 0;
            let remaining = imgH;
            let first = true;

            while (remaining > 0) {
                if (!first) pdf.addPage();
                pdf.addImage(imgData, "JPEG", 0, -posY, imgW, imgH);
                posY += pH;
                remaining -= pH;
                first = false;
            }

            const fileName = `reporte-consolidado-uxr-social-${data.metadata?.period?.toLowerCase() || 'periodo'}-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
            setDownloadStatus("✓ PDF descargado correctamente");
            setTimeout(() => setDownloadStatus(null), 3000);
        } catch (error) {
            console.error("Error generating PDF:", error);
            setDownloadStatus("Error al generar el PDF");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200]"
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl bg-[#f5f5f3] rounded-[2rem] shadow-2xl z-[201] flex flex-col overflow-hidden border border-slate-200"
                    >
                        {/* Download Bar */}
                        <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between text-white shrink-0">
                            <span className="text-xs opacity-80">
                                UXR Social · Reporte Inteligente · {data.metadata?.period}
                            </span>
                            <div className="flex items-center gap-4">
                                {downloadStatus && (
                                    <span className="text-[10px] text-slate-400 animate-pulse">{downloadStatus}</span>
                                )}
                                <button
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className="bg-white text-[#1a1a1a] px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isDownloading ? <Activity className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                    {isDownloading ? "Generando..." : "Descargar PDF ↓"}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Report Area */}
                        <div className="flex-1 overflow-y-auto p-12">
                            <div
                                ref={reportRef}
                                className="bg-white max-w-[860px] mx-auto p-[36px_40px] rounded-lg shadow-sm text-[#1a1a1a] font-sans"
                                style={{ fontFamily: "'Inter', Arial, sans-serif" }}
                            >
                                {/* CSS defined as string to ensure it's captured by html2canvas if needed, or just use Tailwind styles */}
                                <style dangerouslySetInnerHTML={{
                                    __html: `
                  .report-container { font-size: 13px; color: #1a1a1a; }
                  .slabel { font-size: 9px; font-weight: 700; letter-spacing: .1em; color: #aaa; text-transform: uppercase; margin: 20px 0 10px; }
                  .metric-card { background: #f7f7f5; border-radius: 7px; padding: 11px 13px; }
                  .prob-card { border: 0.5px solid #e0e0dc; border-radius: 9px; padding: 13px 14px; margin-bottom: 11px; break-inside: avoid; page-break-inside: avoid; }
                  .tag { font-size: 9px; padding: 2px 7px; border-radius: 10px; font-weight: 600; display: inline-block; margin-right: 4px; }
                ` }} />

                                <div className="report-container">
                                    {/* HEADER */}
                                    <div className="flex justify-between items-start border-b-[1.5px] border-[#1a1a1a] pb-4 mb-[22px]">
                                        <div>
                                            <div className="text-[10px] font-bold tracking-widest text-[#888] uppercase">UXR Social · Analytics Report</div>
                                            <div className="text-xl font-bold mt-1">Análisis de Rendimiento Consolidado</div>
                                            <div className="text-[11px] text-[#666] mt-0.5">Período: {data.metadata?.period} · Redes: {data.metadata?.networks}</div>
                                        </div>
                                        <div className="text-right text-[10px] text-[#999]">
                                            <div>Fecha de generación</div>
                                            <div className="text-xs font-semibold text-[#1a1a1a] mt-0.5">{data.metadata?.generated_at}</div>
                                        </div>
                                    </div>

                                    {/* MÉTRICAS */}
                                    <div className="slabel">Resumen del período</div>
                                    <div className="grid grid-cols-4 gap-2 mb-5">
                                        <div className="metric-card">
                                            <div className="text-xl font-bold leading-none">{data.summary?.total_comments || 0}</div>
                                            <div className="text-[10px] text-[#888] mt-1">Total comentarios</div>
                                            {data.summary?.growth?.total !== undefined && (
                                                <div className={`text-[10px] mt-0.5 font-semibold ${data.summary.growth.total >= 0 ? 'text-[#2a7a5a]' : 'text-rose-600'}`}>
                                                    {data.summary.growth.total >= 0 ? '↑' : '↓'} {Math.abs(data.summary.growth.total)}% vs anterior
                                                </div>
                                            )}
                                        </div>
                                        <div className="metric-card">
                                            <div className="text-xl font-bold leading-none">{data.summary?.unique_authors || 0}</div>
                                            <div className="text-[10px] text-[#888] mt-1">Autores únicos</div>
                                            {data.summary?.growth?.authors !== undefined && (
                                                <div className="text-[10px] mt-0.5 font-semibold text-[#2a7a5a]">
                                                    ↑ {data.summary.growth.authors}%
                                                </div>
                                            )}
                                        </div>
                                        <div className="metric-card">
                                            <div className="text-xl font-bold leading-none">{data.summary?.avg_per_day || 0}</div>
                                            <div className="text-[10px] text-[#888] mt-1">Comentarios / día</div>
                                        </div>
                                        <div className="metric-card">
                                            <div className="text-xl font-bold leading-none">{data.summary?.active_networks || 0}</div>
                                            <div className="text-[10px] text-[#888] mt-1">Redes activas</div>
                                            <div className="text-[10px] mt-0.5 font-semibold text-[#888]">{data.metadata?.networks}</div>
                                        </div>
                                    </div>

                                    {/* CHARTS ROW */}
                                    <div className="grid grid-cols-2 gap-3 mb-5">
                                        <div className="border-[0.5px] border-[#e0e0dc] rounded-lg p-[13px_14px]">
                                            <div className="text-[11px] font-bold mb-2.5">Distribución por categoría</div>
                                            <div className="flex items-start gap-4">
                                                <div className="shrink-0 pt-1">
                                                    <svg width="64" height="64" viewBox="0 0 100 100">
                                                        <circle cx="50" cy="50" r="32" fill="none" stroke="#f0f0ec" strokeWidth="16" />
                                                        {data.topics && data.topics.length > 0 && (() => {
                                                            let cumulativePercent = 0;
                                                            return data.topics.map((topic: any, idx: number) => {
                                                                const percent = (topic.value / (data.metadata?.total_comments || 1));
                                                                const color = idx === 0 ? '#534AB7' : idx === 1 ? '#E24B4A' : idx === 2 ? '#1D9E75' : idx === 3 ? '#EF9F27' : '#999';
                                                                const circumference = 201; // 2 * pi * 32
                                                                const dashArray = `${percent * circumference} ${circumference}`;
                                                                const dashOffset = -cumulativePercent * circumference;
                                                                cumulativePercent += percent;

                                                                return (
                                                                    <circle
                                                                        key={topic.name}
                                                                        cx="50" cy="50" r="32"
                                                                        fill="none"
                                                                        stroke={color}
                                                                        strokeWidth="16"
                                                                        strokeDasharray={dashArray}
                                                                        strokeDashoffset={dashOffset}
                                                                        transform="rotate(-90 50 50)"
                                                                    />
                                                                );
                                                            });
                                                        })()}
                                                        <text x="50" y="48" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1a1a1a">{data.metadata?.total_comments}</text>
                                                        <text x="50" y="58" textAnchor="middle" fontSize="8" fill="#888">total</text>
                                                    </svg>
                                                </div>
                                                <div className="text-[9px] text-[#444] leading-[1.6] flex-1">
                                                    {data.topics?.map((topic: any, idx: number) => (
                                                        <div key={topic.name} className="flex items-center justify-between gap-1.5 border-b border-[#f0f0ed] pb-0.5 mb-0.5 last:border-0">
                                                            <div className="flex items-center gap-1.5 truncate">
                                                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: idx === 0 ? '#534AB7' : idx === 1 ? '#E24B4A' : idx === 2 ? '#1D9E75' : idx === 3 ? '#EF9F27' : '#999' }}></span>
                                                                <span className="truncate">{topic.name}</span>
                                                            </div>
                                                            <span className="font-bold">{topic.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="border-[0.5px] border-[#e0e0dc] rounded-lg p-[13px_14px]">
                                            <div className="text-[11px] font-bold mb-2.5">Mix de redes sociales</div>
                                            <div className="space-y-1.5">
                                                {data.distribution?.networks?.map((net: any) => (
                                                    <div key={net.name} className="flex items-center gap-2 text-[10px]">
                                                        <span className="w-16 text-[#666] shrink-0">{net.name}</span>
                                                        <div className="flex-1 h-[6px] bg-[#f0f0ec] rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full"
                                                                style={{
                                                                    width: `${(net.value / (data.metadata?.total_comments || 1)) * 100}%`,
                                                                    background: net.name === 'LinkedIn' ? '#0077B5' : net.name === 'Facebook' ? '#1877F2' : net.name === 'Instagram' ? '#E1306C' : net.name === 'X' ? '#000' : '#888'
                                                                }}
                                                            ></div>
                                                        </div>
                                                        <span className="w-6 text-right font-bold">{net.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* TRENDS CHART */}
                                    <div className="border-[0.5px] border-[#e0e0dc] rounded-lg p-[13px_14px] mb-5">
                                        <div className="text-[11px] font-bold mb-3">Volumen de menciones por día</div>
                                        <div className="h-[120px] w-full relative pt-2">
                                            {/* Simple SVG Line Chart for PDF compatibility */}
                                            <svg width="100%" height="100%" viewBox="0 0 800 120" preserveAspectRatio="none">
                                                {/* Grid lines */}
                                                <line x1="0" y1="0" x2="800" y2="0" stroke="#f0f0ec" strokeWidth="1" />
                                                <line x1="0" y1="40" x2="800" y2="40" stroke="#f0f0ec" strokeWidth="1" />
                                                <line x1="0" y1="80" x2="800" y2="80" stroke="#f0f0ec" strokeWidth="1" />
                                                <line x1="0" y1="120" x2="800" y2="120" stroke="#f0f0ec" strokeWidth="1" />

                                                {/* Data mapping - simplified logic for PDF visualization */}
                                                {data.trends && data.trends.length > 0 && (() => {
                                                    const dates = Array.from(new Set(data.trends.map((t: any) => t.date))).sort();
                                                    const networks = Array.from(new Set(data.trends.map((t: any) => t.network)));
                                                    const maxVal = Math.max(...data.trends.map((t: any) => t.count), 5);

                                                    return networks.map((net: string, nIdx: number) => {
                                                        const color = net === 'LinkedIn' ? '#0077B5' : net === 'Facebook' ? '#1877F2' : net === 'Instagram' ? '#E1306C' : net === 'X' ? '#000' : '#888';
                                                        const points = dates.map((date, dIdx) => {
                                                            const entry = data.trends.find((t: any) => t.date === date && t.network === net);
                                                            const x = (dIdx / (dates.length - 1)) * 800;
                                                            const y = 120 - ((entry?.count || 0) / maxVal) * 100;
                                                            return `${x},${y}`;
                                                        }).join(" ");

                                                        return (
                                                            <g key={net}>
                                                                <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} strokeLinejoin="round" />
                                                            </g>
                                                        );
                                                    });
                                                })()}
                                            </svg>
                                            <div className="flex justify-between mt-1 text-[8px] text-[#999]">
                                                <span>{data.metadata?.period?.split('Hasta')[0]?.replace('Desde', '')?.trim() || 'Inicio'}</span>
                                                <span>{data.metadata?.period?.split('Hasta')[1]?.trim() || 'Fin'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* TOP PROBLEMS */}
                                    <div className="slabel">Análisis de problemáticas detectadas</div>
                                    {data.top_problems?.map((prob: any, idx: number) => (
                                        <div key={idx} className="prob-card">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: idx === 0 ? '#FCEBEB' : idx === 1 ? '#FAEEDA' : '#EEEDFE', color: idx === 0 ? '#A32D2D' : idx === 1 ? '#854F0B' : '#534AB7' }}>
                                                    {idx + 1}
                                                </div>
                                                <div className="text-[13px] font-bold flex-1">{prob.title}</div>
                                                <div className="text-[10px] text-[#999] whitespace-nowrap">{prob.count} menciones · {prob.percentage}% del segmento</div>
                                            </div>
                                            <div className="h-1 bg-[#f0f0ec] rounded-full mb-2">
                                                <div className="h-1 rounded-full" style={{ width: `${prob.percentage}%`, background: idx === 0 ? '#E24B4A' : idx === 1 ? '#EF9F27' : '#7F77DD' }}></div>
                                            </div>
                                            <div className="text-[11px] text-[#444] leading-relaxed mb-2">{prob.description}</div>
                                            <div className="mb-2.5">
                                                {prob.tags?.map((tag: string) => (
                                                    <span key={tag} className="tag" style={{ background: idx === 0 ? '#FCEBEB' : idx === 1 ? '#FAEEDA' : '#EEEDFE', color: idx === 0 ? '#A32D2D' : idx === 1 ? '#854F0B' : '#534AB7' }}>
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="p-[9px_11px] rounded-r-md text-[10px] text-[#444] leading-relaxed border-l-[3px]" style={{ background: idx === 0 ? '#fdf5f5' : idx === 1 ? '#fdf9f0' : '#f5f5fd', borderColor: idx === 0 ? '#E24B4A' : idx === 1 ? '#EF9F27' : '#7F77DD' }}>
                                                <strong className="block mb-1 text-[#1a1a1a]">Casos representativos registrados:</strong>
                                                <div className="space-y-1.5 mt-1">
                                                    {prob.quotes?.map((q: any, i: number) => (
                                                        <div key={i} className="flex gap-1.5">
                                                            <span className="opacity-40">•</span>
                                                            <div>
                                                                <span className="font-bold text-[#1a1a1a]">{q.author}:</span>
                                                                <span className="ml-1 text-[#555]">"{q.text}"</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* FEEDBACK INSIGHTS */}
                                    <div className="slabel mt-5">Señal positiva — contexto de reputación</div>
                                    {data.feedback_insights?.map((insight: any, idx: number) => (
                                        <div key={idx} className="p-[10px_12px] rounded-r-md mb-2 bg-[#f9f9f7] border-l-[3px] border-[#1D9E75]" style={{ borderColor: idx === 0 ? '#1D9E75' : '#534AB7' }}>
                                            <div className="text-xs font-bold mb-0.5">{insight.title}</div>
                                            <div className="text-[10px] text-[#555] leading-relaxed">{insight.description}</div>
                                        </div>
                                    ))}

                                    {/* FOOTER */}
                                    <div className="mt-6 pt-3 border-t-[0.5px] border-[#e0e0dc] flex justify-between text-[9px] text-[#bbb]">
                                        <span>UXR Social · Analytics Report · Smart Summary</span>
                                        <span>Generado el {data.metadata?.generated_at}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
