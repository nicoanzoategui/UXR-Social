import Link from "next/link";

export default function BlockedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-6">
      <p className="text-center text-neutral-700 text-base max-w-md mb-8">
        Acceso restringido. Necesitás un link válido o iniciar sesión.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-6 py-3 text-sm font-semibold hover:bg-black transition-colors"
      >
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
