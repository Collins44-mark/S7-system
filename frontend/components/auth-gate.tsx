"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";

/** Allows only BUSINESS users into the main app shell. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);
  const router = useRouter();
  const pathname = usePathname();
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
    if (session.role === "SUPER_ADMIN") {
      router.replace("/admin/dashboard");
    }
  }, [ready, token, session, router, pathname]);

  if (!ready || !token || !session || session.role !== "BUSINESS") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 text-slate-600">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
