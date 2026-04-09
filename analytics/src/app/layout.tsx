"use client";

import { Inter, Merriweather } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { usePathname } from "next/navigation";

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

const merriweather = Merriweather({
  weight: ['400', '700', '900'],
  subsets: ["latin"],
  variable: '--font-merriweather',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <html
      lang="en"
      className={`${inter.variable} ${merriweather.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <AuthGuard>
          <div className="flex min-h-screen bg-[var(--color-bg-page)]">
            {!isLoginPage && <Sidebar />}
            <main className={isLoginPage ? "flex-1" : "flex-1 ml-64 p-8 min-h-screen"}>
              <div className={isLoginPage ? "" : "container max-w-7xl mx-auto"}>
                {children}
              </div>
            </main>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
