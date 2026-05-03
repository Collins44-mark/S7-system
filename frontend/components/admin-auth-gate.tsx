"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";

/** Allows only SUPER_ADMIN into admin routes. */
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setReady(true);
    });
    if (useAuthStore.persist.hasHydrated()) setReady(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!token || !session) {
      router.replace("/login");
      return;
    }
    if (session.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [ready, token, session, router]);

  if (!ready || !token || !session || session.role !== "SUPER_ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
