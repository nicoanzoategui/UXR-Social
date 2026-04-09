"use client";

import SidebarViewer from "@/components/SidebarViewer";

export default function ViewerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--color-bg-page)]">
      <SidebarViewer />
      <main className="flex-1 ml-64 p-8 min-h-screen">
        <div className="container max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
