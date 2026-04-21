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
    <div className="w-64 h-screen bg-white border-r border-[#e2e8f0] flex flex-col fixed left-0 top-0 z-50">
      <div className="p-8">
        <h1 className="logo text-4xl mb-1 text-[#1e293b] tracking-tight">UX</h1>
        <p className="eyebrow mt-2 text-[#64748b] font-semibold">UXR Social</p>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 mt-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 pl-4 pr-4 py-3 rounded-r-lg transition-all duration-300 ease-out group border-l-[3px]",
                isActive
                  ? "bg-[#f1f5f9] text-[#1e293b] font-semibold border-[#3b82f6]"
                  : "border-transparent text-[#64748b] hover:text-[#1e293b] hover:bg-[#f8fafc]"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-all duration-300 group-hover:scale-105",
                  isActive ? "text-[#3b82f6]" : "text-[#64748b] group-hover:text-[#3b82f6]"
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
              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">
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
                    "flex items-center gap-3 pl-4 pr-4 py-3 rounded-r-lg transition-all duration-300 ease-out group border-l-[3px]",
                    isActive
                      ? "bg-[#f1f5f9] text-[#1e293b] font-semibold border-[#3b82f6]"
                      : "border-transparent text-[#64748b] hover:text-[#1e293b] hover:bg-[#f8fafc]"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 shrink-0 transition-all duration-300 group-hover:scale-105",
                      isActive ? "text-[#3b82f6]" : "text-[#64748b] group-hover:text-[#3b82f6]"
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

      <div className="p-6 border-t border-[#e2e8f0] bg-white space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#64748b] hover:text-[#1e293b] hover:bg-[#f8fafc] cursor-pointer transition-all duration-300">
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
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer transition-all duration-300"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="font-semibold tracking-tight">Cerrar Sesión</span>
        </div>
      </div>
    </div>
  );
}
