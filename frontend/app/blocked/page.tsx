import Link from "next/link";

export default function BlockedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] px-6">
      <p className="text-center text-slate-700 text-base max-w-md mb-8">
        Acceso restringido. Necesitás un link válido o iniciar sesión.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-lg bg-[#3b82f6] text-white px-6 py-3 text-sm font-semibold shadow-sm transition-all duration-300 hover:bg-[#2563eb] hover:shadow-md"
      >
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
