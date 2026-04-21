import Link from "next/link";

export default function BlockedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-6">
      <p className="text-center text-slate-700 text-base max-w-md mb-8">
        Acceso restringido. Necesitás un link válido o iniciar sesión.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-xl bg-[#2563eb] text-white px-6 py-3 text-sm font-semibold shadow-md transition-all duration-300 hover:bg-blue-700 hover:shadow-lg"
      >
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
