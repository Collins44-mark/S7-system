"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { setAuthToken } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  return <>{children}</>;
}
