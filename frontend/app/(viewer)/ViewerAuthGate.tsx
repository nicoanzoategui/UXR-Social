"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  fetchMeWithCredentials,
  validateShareToken,
  getStoredShareToken,
  setStoredShareToken,
} from "@/lib/auth";

type GateState = "checking" | "ok" | "fail";

export default function ViewerAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<GateState>("checking");
  const [adminRouteAllowed, setAdminRouteAllowed] = useState(true);

  const shareFromQuery = searchParams.get("share_token");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState("checking");

      if (shareFromQuery) {
        try {
          const v = await validateShareToken(shareFromQuery);
          if (!cancelled && v.valid) {
            setStoredShareToken(shareFromQuery);
            setState("ok");
            return;
          }
        } catch {
          /* fall through */
        }
        if (!cancelled) {
          setStoredShareToken(null);
          setState("fail");
        }
        return;
      }

      const stored = getStoredShareToken();
      if (stored) {
        try {
          const v = await validateShareToken(stored);
          if (!cancelled && v.valid) {
            setState("ok");
            return;
          }
        } catch {
          /* fall through */
        }
        if (!cancelled) setStoredShareToken(null);
      }

      try {
        await fetchMeWithCredentials();
        if (!cancelled) setState("ok");
      } catch {
        if (!cancelled) setState("fail");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [shareFromQuery, pathname]);

  useEffect(() => {
    if (state === "fail") {
      router.replace("/blocked");
    }
  }, [state, router]);

  useEffect(() => {
    if (state !== "ok") {
      setAdminRouteAllowed(true);
      return;
    }

    const isAdminRoute = pathname === "/upload" || pathname === "/settings";
    if (!isAdminRoute) {
      setAdminRouteAllowed(true);
      return;
    }

    let cancelled = false;
    setAdminRouteAllowed(false);

    (async () => {
      try {
        const me = await fetchMeWithCredentials();
        if (cancelled) return;
        if (me.role === "admin") {
          setAdminRouteAllowed(true);
        } else {
          router.replace("/dashboard");
        }
      } catch {
        if (!cancelled) {
          router.replace("/dashboard");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, pathname, router]);

  if (state !== "ok") {
    return <div className="min-h-screen bg-neutral-50" />;
  }

  if (!adminRouteAllowed) {
    return <div className="min-h-screen bg-neutral-50" />;
  }

  return <>{children}</>;
}
