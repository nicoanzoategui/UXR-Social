/**
 * Estilos compartidos del área autenticada (alineados al dashboard).
 * Usar junto con .card / tokens en globals.css donde aplique.
 */

/** Superficie de tarjeta: gris muy claro, borde slate, sombra suave */
export const viewerCard =
  "rounded-xl border border-slate-200/80 bg-[#f9fafb] shadow-sm transition-all duration-300";

/** Bloque con gradiente muy sutil (filtros, cabeceras de sección) */
export const viewerCardGradient =
  "rounded-xl border border-slate-200/80 p-5 md:p-6 shadow-sm bg-[#f9fafb] bg-gradient-to-b from-[#f9fafb] to-blue-50/40";

/** Botón principal azul vibrante */
export const viewerBtnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-blue-600/20 bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0";

/** Secundario / outline */
export const viewerBtnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-300 hover:border-blue-300 hover:bg-blue-50/70 hover:shadow-sm disabled:opacity-50";

/** Pestaña o chip activo */
export const viewerTabActive =
  "bg-[#2563eb] text-white border-[#2563eb] shadow-md scale-[1.02]";

export const viewerTabInactive =
  "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50/60 hover:text-slate-800";

/** Campos de formulario */
export const viewerInput =
  "bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 transition-all duration-200 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none";

export const viewerInputLg =
  "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[var(--color-text-body)] font-semibold outline-none transition-all duration-200 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

/** Texto de apoyo bajo títulos */
export const viewerMuted = "text-slate-600";
