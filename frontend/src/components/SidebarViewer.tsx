"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  Upload,
  Users,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { logout } from "@/lib/api";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Conversaciones", href: "/conversaciones", icon: MessageSquare },
  { name: "Reportes", href: "/reportes", icon: FileText },
];

export default function SidebarViewer() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const readRole = () => {
      if (typeof window === "undefined") return;
      setIsAdmin(localStorage.getItem("role") === "admin");
    };
    readRole();
    window.addEventListener("storage", readRole);
    return () => window.removeEventListener("storage", readRole);
  }, []);

  return (
    <div className="w-64 h-screen bg-white border-r border-[var(--color-border-soft)] flex flex-col fixed left-0 top-0 shadow-sm z-50">
      <div className="p-8">
        <h1 className="logo text-4xl mb-1 text-slate-900">UX</h1>
        <p className="eyebrow mt-2 text-slate-500">UXR Social</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-all duration-200 group",
                isActive
                  ? "bg-[rgba(55,53,47,0.08)] text-[#37352f] font-medium rounded-[6px]"
                  : "rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-bg-soft)]/50"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                  isActive
                    ? "text-[#37352f]"
                    : "text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-600)]"
                )}
              />
              <span
                className={cn(
                  "tracking-tight",
                  isActive ? "font-medium" : "font-semibold"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
        {isAdmin && (
          <>
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                ADMINISTRACIÓN
              </p>
            </div>
            {(
              [
                { name: "Importar datos", href: "/upload", icon: Upload },
                { name: "Usuarios", href: "/settings", icon: Users },
              ] as const
            ).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-all duration-200 group",
                    isActive
                      ? "bg-[rgba(55,53,47,0.08)] text-[#37352f] font-medium rounded-[6px]"
                      : "rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-bg-soft)]/50"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                      isActive
                        ? "text-[#37352f]"
                        : "text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-600)]"
                    )}
                  />
                  <span
                    className={cn(
                      "tracking-tight",
                      isActive ? "font-medium" : "font-semibold"
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-6 border-t border-[var(--color-border-soft)] space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-bg-soft)]/50 cursor-pointer transition-all">
          <Settings className="w-5 h-5" />
          <span className="font-semibold tracking-tight">Configuración</span>
        </div>
        <div
          onClick={async () => {
            try {
              await logout();
            } finally {
              window.location.href = "/blocked";
            }
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50/50 cursor-pointer transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-semibold tracking-tight">Cerrar Sesión</span>
        </div>
      </div>
    </div>
  );
}
