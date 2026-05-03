"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart2,
  Box,
  Grid,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import type { Locale } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const nav = [
  { href: "/dashboard", navKey: "dashboard", icon: LayoutDashboard },
  { href: "/inventory", navKey: "inventory", icon: Package },
  { href: "/categories", navKey: "categories", icon: Grid },
  { href: "/orders", navKey: "orders", icon: ShoppingCart },
  { href: "/customers", navKey: "customers", icon: Users },
  { href: "/reports", navKey: "reports", icon: BarChart2 },
  { href: "/settings", navKey: "settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { query, setQuery, clearQuery } = useSearch();
  const { locale, setLocale, t } = useI18n();
  const session = useAuthStore((s) => s.session);
  const businessName =
    session?.role === "BUSINESS" ? session.businessName : "Store";
  const businessId =
    session?.role === "BUSINESS" ? session.businessId : undefined;
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    clearQuery();
  }, [pathname, clearQuery]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <aside className="glass flex w-64 shrink-0 flex-col border-r border-white/60 p-4">
        <div className="mb-4 flex items-center gap-2 px-3 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
            <Box className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-800">
              {businessName}
            </span>
            {businessId && (
              <span className="text-xs text-slate-500 font-mono">
                {businessId}
              </span>
            )}
          </div>
        </div>
        <nav className="flex flex-1 flex-col space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "sidebar-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-blue-500/10 text-blue-700"
                    : "text-slate-600 hover:bg-blue-500/10 hover:text-blue-700",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(`nav.${item.navKey}`)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass flex shrink-0 items-center justify-between gap-3 border-b border-white/60 px-6 py-3">
          <div className="relative min-w-0 flex-1 max-w-md">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.search")}
              className="rounded-xl border-slate-200/50 bg-slate-100/80 pl-10 text-sm"
              aria-label={t("common.search")}
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              ⌕
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Select
              value={locale}
              onValueChange={(v) => {
                if (v === "en" || v === "sw") setLocale(v as Locale);
              }}
            >
              <SelectTrigger
                className="h-9 w-[7.5rem] rounded-xl border-slate-200/80 text-xs sm:text-sm"
                aria-label={t("common.language")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("common.english")}</SelectItem>
                <SelectItem value="sw">{t("common.swahili")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden items-center gap-2 rounded-xl px-2 py-1 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-xs font-bold text-white">
                {(businessName ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <span className="hidden max-w-[200px] truncate text-sm font-medium text-slate-700 lg:inline">
                {businessName}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200/80"
              onClick={() => {
                clear();
                router.replace("/login");
              }}
            >
              <LogOut className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">{t("common.logout")}</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
