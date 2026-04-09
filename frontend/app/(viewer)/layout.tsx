import { Suspense } from "react";
import ViewerAuthGate from "./ViewerAuthGate";
import ViewerShell from "./ViewerShell";

export default function ViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
      <ViewerAuthGate>
        <ViewerShell>{children}</ViewerShell>
      </ViewerAuthGate>
    </Suspense>
  );
}
