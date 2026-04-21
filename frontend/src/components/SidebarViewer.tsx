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
    <div className="w-64 h-screen bg-slate-50 border-r border-slate-200 flex flex-col fixed left-0 top-0 shadow-sm z-50">
      <div className="p-8">
        <h1 className="logo text-4xl mb-1 text-slate-900 tracking-tight">UX</h1>
        <p className="eyebrow mt-2 text-slate-700 font-semibold">UXR Social</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-all duration-300 ease-out rounded-xl group",
                isActive
                  ? "bg-blue-50 text-blue-900 font-semibold shadow-sm ring-1 ring-blue-200/80"
                  : "text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-sm"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-all duration-300 group-hover:scale-105",
                  isActive ? "text-blue-600" : "text-slate-500 group-hover:text-blue-600"
                )}
              />
              <span className={cn("tracking-tight", isActive ? "font-semibold" : "font-medium")}>
                {item.name}
              </span>
            </Link>
          );
        })}
        {isAdmin && (
          <>
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
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
                    "flex items-center gap-3 px-4 py-3 transition-all duration-300 ease-out rounded-xl group",
                    isActive
                      ? "bg-blue-50 text-blue-900 font-semibold shadow-sm ring-1 ring-blue-200/80"
                      : "text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-sm"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 shrink-0 transition-all duration-300 group-hover:scale-105",
                      isActive ? "text-blue-600" : "text-slate-500 group-hover:text-blue-600"
                    )}
                  />
                  <span className={cn("tracking-tight", isActive ? "font-semibold" : "font-medium")}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-6 border-t border-slate-200 bg-slate-50/80 space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-white cursor-pointer transition-all duration-300 hover:shadow-sm">
          <Settings className="w-5 h-5 text-slate-500" />
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
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-rose-700 hover:bg-rose-50 cursor-pointer transition-all duration-300 hover:shadow-sm"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="font-semibold tracking-tight">Cerrar Sesión</span>
        </div>
      </div>
    </div>
  );
}
