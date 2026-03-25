"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  UploadCloud,
  History,
  Users,
  MessageSquare,
  LogOut
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Import Center", href: "/admin", icon: UploadCloud },
  { name: "Chatbot", href: "/admin/chatbot", icon: MessageSquare },
  { name: "User Management", href: "/admin/users", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-screen bg-white border-r border-[var(--color-border-soft)] flex flex-col fixed left-0 top-0 shadow-sm z-50">
      <div className="p-8">
        <h1 className="logo text-4xl mb-1">SA</h1>
        <p className="eyebrow mt-2">Back Office</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive
                  ? "bg-[var(--color-bg-soft)] text-[var(--color-primary-800)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-bg-soft)]/50"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                isActive ? "text-[var(--color-primary-700)]" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-600)]"
              )} />
              <span className="font-semibold tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-[var(--color-border-soft)] space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-bg-soft)]/50 cursor-pointer transition-all">
          <Settings className="w-5 h-5" />
          <span className="font-semibold tracking-tight">Settings</span>
        </div>
        <div
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/login";
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50/50 cursor-pointer transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-semibold tracking-tight">Logout</span>
        </div>
      </div>
    </div>
  );
}
