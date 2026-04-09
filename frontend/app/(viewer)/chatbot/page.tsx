"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChatbotRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/conversaciones");
  }, [router]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-[var(--color-text-muted)]">
      Redirigiendo…
    </div>
  );
}
