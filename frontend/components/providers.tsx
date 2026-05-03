"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { setAuthToken } from "@/lib/api";
import { I18nProvider } from "@/lib/i18n-context";
import { SearchProvider } from "@/lib/search-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  return (
    <I18nProvider>
      <SearchProvider>{children}</SearchProvider>
    </I18nProvider>
  );
}
