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
      <main className="flex-1 ml-64 min-h-screen p-4 md:p-8">
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
