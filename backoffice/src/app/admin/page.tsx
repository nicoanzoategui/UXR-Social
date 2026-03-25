"use client";

import { useState, useEffect } from "react";
import {
  UploadCloud,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  History,
  TrendingUp,
  X,
  Trash2,
  Save,
  Info,
  Trash,
  Search,
  Globe,
  Instagram,
  Facebook,
  Linkedin,
  Twitter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import { getDatasets, uploadCSV, deleteDataset, scrapeGoogleMapsV2, getDownloadUrl } from "@/lib/api";

interface CSVRow {
  [key: string]: any;
  id_internal_preview: string;
}

export default function AdminDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [network, setNetwork] = useState("Instagram");
  const [uploading, setUploading] = useState(false);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Google Scraper States
  const [googleUrl, setGoogleUrl] = useState("");
  const [maxReviews, setMaxReviews] = useState(50);
  const [isScraping, setIsScraping] = useState(false);

  // Preview States
  const [showPreview, setShowPreview] = useState(false);
  const [previewRows, setPreviewRows] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [originalFilename, setOriginalFilename] = useState("");

  const PREFERRED_COLUMNS = [
    "Timestamp (ART)",
    "Red",
    "Tipo de mensaje",
    "Recibido de (nombre de la red)",
    "Message"
  ];

  async function fetchDatasets() {
    try {
      const data = await getDatasets();
      console.log("Fetched datasets:", data);
      setDatasets(data);
    } catch (error) {
      console.error("Error fetching datasets:", error);
    }
  }

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (selectedFile) {
      setFile(selectedFile);
      setOriginalFilename(selectedFile.name);

      if (selectedFile.name.endsWith(".txt")) {
        // If it's a .txt from Google Maps, we don't need preview for now
        // or we can just skip it and let the user upload directly
        setStatus({ type: 'success', msg: "Archivo .txt detectado. Puedes subirlo directamente." });
        return;
      }

      // Parse CSV for Preview
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rawHeaders = results.meta.fields || [];
          setHeaders(rawHeaders);

          // Auto-select preferred columns
          const toSelect = rawHeaders.filter(h => PREFERRED_COLUMNS.includes(h));
          setSelectedColumns(toSelect.length > 0 ? toSelect : rawHeaders);

          const rowsWithId = (results.data as any[]).map((row: any, index: number) => ({
            ...row,
            id_internal_preview: `row-${index}-${Date.now()}`
          }));
          setPreviewRows(rowsWithId as CSVRow[]);
          setShowPreview(true);
        },
        error: (error) => {
          setStatus({ type: 'error', msg: "Error al leer el archivo CSV." });
        }
      });
    }
  };

  const handleDeleteDataset = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este dataset y todos sus comentarios?")) return;
    try {
      await deleteDataset(id);
      setStatus({ type: 'success', msg: "Dataset eliminado correctamente." });
      fetchDatasets();
    } catch (error) {
      setStatus({ type: 'error', msg: "Error al eliminar el dataset." });
    }
  };

  const removeRow = (id: string) => {
    setPreviewRows(prev => prev.filter(row => row.id_internal_preview !== id));
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
    );
  };

  const cancelSync = () => {
    setShowPreview(false);
    setFile(null);
    setPreviewRows([]);
    setSelectedColumns([]);
  };

  const confirmAndSync = async () => {
    if (previewRows.length === 0) {
      setStatus({ type: 'error', msg: "No hay filas para sincronizar." });
      return;
    }

    setUploading(true);
    setStatus(null);
    setShowPreview(false);

    // Convert filtered rows AND columns back to CSV string
    const filteredData = previewRows.map(row => {
      const filteredRow: any = {};
      selectedColumns.forEach(col => {
        filteredRow[col] = row[col];
      });
      return filteredRow;
    });

    const csvContent = Papa.unparse(filteredData);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const filteredFile = new File([blob], originalFilename, { type: 'text/csv' });

    const formData = new FormData();
    formData.append("file", filteredFile || file); // Use original file if no preview (txt)
    formData.append("network", file?.name.endsWith(".txt") ? "google_maps" : network);
    formData.append("account_name", network);

    try {
      await uploadCSV(formData);
      setStatus({ type: 'success', msg: "Sincronización completada con éxito." });
      setFile(null);
      fetchDatasets();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Fallo en la sincronización. Verifica el formato.";
      setStatus({ type: 'error', msg: errorMsg });
    } finally {
      setUploading(false);
    }
  };

  const uploadDirect = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("network", "google_maps");
    formData.append("account_name", "Google Maps");

    try {
      await uploadCSV(formData);
      setStatus({ type: 'success', msg: "Archivo subido y procesado correctamente." });
      setFile(null);
      fetchDatasets();
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.response?.data?.detail || "Error al subir el archivo." });
    } finally {
      setUploading(false);
    }
  };

  const handleGoogleScrape = async () => {
    if (!googleUrl) {
      setStatus({ type: 'error', msg: "Por favor, ingresa una URL de Google Maps." });
      return;
    }

    try {
      const parsed = new URL(googleUrl);
      if (!parsed.hostname.includes("google.com") || !parsed.pathname.includes("/maps")) {
        setStatus({ type: 'error', msg: "La URL debe ser de Google Maps (google.com/maps/...)." });
        return;
      }
    } catch {
      setStatus({ type: 'error', msg: "La URL ingresada no es válida." });
      return;
    }

    setIsScraping(true);
    setStatus(null);

    try {
      await scrapeGoogleMapsV2(googleUrl, maxReviews);
      setStatus({ type: 'success', msg: "Barrido de Google iniciado. Cuando finalice, aparecerá el archivo para descargar en el historial." });

      const intervalId = setInterval(() => {
        fetchDatasets();
      }, 5000);
      const timeoutId = setTimeout(() => clearInterval(intervalId), 120000);

      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "Fallo al iniciar el barrido de Google.";
      setStatus({ type: 'error', msg: errorMsg });
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <header>
        <h1 className="heading-xl">Panel de Control</h1>
        <p className="body-md mt-2 text-[var(--color-text-muted)]">Gestión técnica y sincronización de datos de redes sociales.</p>
      </header>

      {/* Main Grid: Upload Center */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card card-pad-lg shadow-md border-[var(--color-border-medium)] h-full">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-500/20">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="heading-md">Sincronización Sprout</h2>
              <p className="body-sm">Sube tu exportación de Sprout Social.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Red Social</label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[var(--color-text-body)] font-semibold outline-none focus:border-slate-500 transition-all appearance-none cursor-pointer"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23677489\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
              >
                <option>Instagram</option>
                <option>Facebook</option>
                <option>LinkedIn</option>
                <option>X</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Archivo CSV</label>
              <div className="relative group">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-slate-200 group-hover:border-slate-400 rounded-2xl p-6 transition-all bg-white flex flex-col items-center justify-center text-center">
                  <FileText className="w-8 h-8 text-slate-300 group-hover:text-slate-600 mb-2 transition-colors" />
                  <p className="text-xs font-bold text-slate-600 truncate max-w-full px-4">
                    {file ? file.name : "Seleccionar CSV o TXT"}
                  </p>
                  {file && file.name.endsWith(".txt") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); uploadDirect(); }}
                      className="mt-4 px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-black transition-colors"
                    >
                      Subir Ahora
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Google Scraper Card */}
        <div className="card card-pad-lg shadow-md border-[var(--color-border-medium)] h-full bg-gradient-to-br from-white to-slate-50/50">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h2 className="heading-md">Barrido Google</h2>
              <p className="body-sm">Extrae comentarios de Google Maps.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">URL de Google Maps</label>
              <input
                type="text"
                placeholder="https://www.google.com/maps/place/..."
                value={googleUrl}
                onChange={(e) => setGoogleUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 transition-all"
              />
              <p className="text-[10px] text-slate-400 pl-1 font-medium italic">Pega la URL del perfil del negocio o lugar.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Cantidad Máxima de Reseñas</label>
              <input
                type="number"
                min="1"
                max="500"
                value={maxReviews}
                onChange={(e) => setMaxReviews(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 transition-all"
              />
              <p className="text-[10px] text-slate-400 pl-1 font-medium italic">Por defecto: 50. Máximo recomendado: 200.</p>
            </div>

            <button
              onClick={handleGoogleScrape}
              disabled={isScraping || !googleUrl}
              className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg ${isScraping || !googleUrl
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/10'
                }`}
            >
              {isScraping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando Barrido...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  Iniciar Barrido
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Status Notification */}
        <div className="lg:col-span-2">
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center gap-3 p-4 rounded-xl text-sm font-bold border ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                  }`}
              >
                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {status.msg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* History Section - Simplified */}
      <section className="space-y-6">
        <h2 className="heading-md flex items-center gap-3">
          <History className="w-6 h-6 text-slate-800" />
          Historial de Sincronización
        </h2>
        <div className="card overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest w-12">#</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Archivo</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Red</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Registros</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Estado</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datasets.map((dataset, index) => (
                <tr key={dataset.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5 text-xs font-bold text-slate-400">
                    {index + 1}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{dataset.file_name}</p>
                        <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                          Subido el {dataset.uploaded_at ? new Date(dataset.uploaded_at).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="eyebrow !min-h-0 !py-1 !px-3 font-bold text-[10px] uppercase">{dataset.social_network}</span>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-600">
                    {dataset.cleaned_rows_count || 0} filas
                  </td>
                  <td className="px-8 py-5">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[10px] font-bold uppercase tracking-wider ${dataset.status === 'ready' || dataset.status === 'READY'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : dataset.status === 'failed' || dataset.status === 'FAILED'
                        ? 'bg-rose-50 text-rose-600 border border-rose-100'
                        : 'bg-slate-50 text-slate-400 border border-slate-200'
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${dataset.status === 'ready' || dataset.status === 'READY'
                        ? 'bg-emerald-500'
                        : dataset.status === 'failed' || dataset.status === 'FAILED'
                          ? 'bg-rose-500'
                          : 'bg-slate-400 animate-pulse'
                        }`} />
                      {dataset.status}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteDataset(dataset.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Eliminar dataset"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                      {dataset.social_network === 'google_maps' && dataset.status === 'ready' && (
                        <a
                          href={getDownloadUrl(dataset.raw_file_path.split('/').pop() || '')}
                          download
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          title="Descargar archivo .txt"
                        >
                          <UploadCloud className="w-4 h-4 transform rotate-180" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {datasets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center italic text-slate-400 body-sm text-balance">
                    No hay registros de sincronización. Comienza subiendo un dataset arriba.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PREVIEW MODAL */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={cancelSync}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-6xl h-[85vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-slate-800"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="heading-md flex items-center gap-3">
                    <Info className="w-6 h-6 text-slate-800" />
                    Gestión de Datos (Importación)
                  </h3>
                  <p className="body-sm text-slate-500">Selecciona las columnas y filas que deseas mantener.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right mr-4 border-r pr-6 border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Columnas</p>
                    <p className="text-2xl font-black text-slate-900">{selectedColumns.length}/{headers.length}</p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filas</p>
                    <p className="text-2xl font-black text-slate-900">{previewRows.length}</p>
                  </div>
                  <button onClick={cancelSync} className="p-3 hover:bg-slate-200 rounded-full transition-colors ml-4">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Column Selector */}
              <div className="px-8 py-6 bg-slate-50/30 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Columnas a Incluir:</p>
                <div className="flex flex-wrap gap-2">
                  {headers.map(header => (
                    <button
                      key={`col-sel-${header}`}
                      onClick={() => toggleColumn(header)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedColumns.includes(header)
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                    >
                      {header}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead className="sticky top-0 z-20 bg-white shadow-sm">
                    <tr className="border-b-2 border-slate-100">
                      <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50/80 rounded-tl-xl text-center">Delete</th>
                      {headers.map(header => (
                        <th
                          key={header}
                          className={`px-4 py-4 text-[10px] font-bold uppercase tracking-widest bg-slate-50/80 last:rounded-tr-xl transition-opacity ${selectedColumns.includes(header) ? 'opacity-100 text-slate-800' : 'opacity-20 text-slate-400'
                            }`}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.id_internal_preview} className="group hover:bg-slate-50 transition-colors border-b border-slate-50">
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeRow(row.id_internal_preview)}
                            className="p-2 text-rose-400 hover:text-white hover:bg-rose-500 rounded-lg transition-all"
                            title="Eliminar esta fila"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                        {headers.map(header => (
                          <td
                            key={`${row.id_internal_preview}-${header}`}
                            className={`px-4 py-3 text-sm max-w-[300px] truncate transition-opacity ${selectedColumns.includes(header) ? 'text-slate-600' : 'opacity-20 bg-slate-50/50'
                              }`}
                          >
                            {String(row[header] || "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* FOOTER - Fixed at the bottom of the modal */}
              <div className="p-8 border-t border-slate-100 flex items-center justify-between bg-slate-50/80 backdrop-blur-md sticky bottom-0 z-30">
                <button
                  onClick={cancelSync}
                  className="btn border border-slate-200 hover:bg-white text-slate-600 px-6"
                >
                  Descartar Todo
                </button>
                <div className="flex items-center gap-6">
                  <p className="text-xs font-medium text-slate-400 italic hidden md:block">
                    * Los datos excluidos no se enviarán al servidor.
                  </p>
                  <button
                    onClick={confirmAndSync}
                    className="btn bg-slate-900 hover:bg-black text-white shadow-2xl shadow-slate-500/40 px-12 gap-3 font-black text-sm uppercase tracking-wider h-14"
                  >
                    <Save className="w-5 h-5" />
                    Finalizar Sincronización
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {uploading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/60 backdrop-blur-md">
          <div className="text-center space-y-4">
            <Loader2 className="w-16 h-16 animate-spin text-slate-800 mx-auto" />
            <p className="heading-md animate-pulse">Guardando Cambios...</p>
            <p className="body-sm text-slate-500">Sincronizando los datos filtrados con la plataforma.</p>
          </div>
        </div>
      )}
    </div>
  );
}
