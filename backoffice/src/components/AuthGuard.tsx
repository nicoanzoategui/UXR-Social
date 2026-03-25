"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getMe } from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (pathname === "/login") {
            setAuthorized(true);
            return;
        }
        getMe()
            .then((user) => {
                if (user.role !== "admin") {
                    setAuthorized(false);
                    router.push("/login");
                } else {
                    setAuthorized(true);
                }
            })
            .catch(() => {
                localStorage.removeItem("isAdminLoggedIn");
                localStorage.removeItem("role");
                setAuthorized(false);
                router.push("/login");
            });
    }, [pathname, router]);

    if (!authorized && pathname !== "/login") {
        return <div className="min-h-screen bg-[var(--color-bg-page)]" />;
    }

    return <>{children}</>;
}
