"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart2,
  Box,
  Wallet,
  Grid,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
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
  { href: "/expenses", navKey: "expenses", icon: Wallet },
  { href: "/reports", navKey: "reports", icon: BarChart2 },
  { href: "/settings", navKey: "settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { query, setQuery, clearQuery } = useSearch();
  const { locale, setLocale, t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const session = useAuthStore((s) => s.session);
  const businessName =
    session?.role === "BUSINESS" ? session.businessName : "Store";
  const businessLogo =
    session?.role === "BUSINESS" ? session.logoDataUrl : null;
  const businessId =
    session?.role === "BUSINESS" ? session.businessId : undefined;
  const clear = useAuthStore((s) => s.clear);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    clearQuery();
  }, [pathname, clearQuery]);

  useEffect(() => {
    if (!token || session?.role !== "BUSINESS") return;
    let cancelled = false;
    api
      .get<{
        uniqueCode: string;
        name: string;
        ownerName: string | null;
        id: string;
        phone: string | null;
        email: string | null;
        address: string | null;
        poBox: string | null;
        tin: string | null;
        vrn: string | null;
        logoDataUrl: string | null;
        receiptPaperWidthMm: number | null;
        printReceiptAfterSale: boolean;
      }>("/auth/me")
      .then(({ data }) => {
        if (cancelled) return;
        setSession(token, {
          role: "BUSINESS",
          businessId: data.uniqueCode,
          businessName: data.name,
          ownerName: data.ownerName,
          id: data.id,
          phone: data.phone,
          email: data.email,
          address: data.address,
          poBox: data.poBox,
          tin: data.tin,
          vrn: data.vrn,
          logoDataUrl: data.logoDataUrl,
          receiptPaperWidthMm: data.receiptPaperWidthMm,
          printReceiptAfterSale: data.printReceiptAfterSale,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, session?.role, setSession]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  function handleLogout() {
    clear();
    router.replace("/login");
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      {drawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] transition-opacity"
          aria-label={t("sidebar.close")}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={cn(
          "glass fixed top-3 bottom-3 left-3 z-50 flex w-[min(18rem,calc(100vw-1.5rem))] flex-col overflow-hidden",
          "rounded-[1.75rem] border border-white/80 shadow-[0_8px_40px_rgba(59,130,246,0.18)]",
          "ring-1 ring-white/60 transition-transform duration-300 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-[calc(100%+1.5rem)] pointer-events-none",
        )}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-6 pb-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {businessLogo ? (
              <img
                src={businessLogo}
                alt=""
                className="h-9 w-9 shrink-0 rounded-2xl object-cover shadow-md"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/25">
                <Box className="h-4 w-4 text-white" />
              </div>
            )}
            <span className="truncate text-sm font-bold text-slate-800">
              {businessName}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 shrink-0 rounded-xl text-slate-500 hover:bg-slate-100"
            onClick={() => setDrawerOpen(false)}
            aria-label={t("sidebar.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "sidebar-item flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-gradient-to-r from-blue-500/15 to-indigo-500/10 text-blue-700 shadow-sm"
                    : "text-slate-600 hover:bg-blue-500/8 hover:text-blue-700",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(`nav.${item.navKey}`)}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 mb-4 mt-auto space-y-3 rounded-2xl border border-white/80 bg-white/50 p-4 shadow-inner">
          <div className="flex items-center gap-3">
            {businessLogo ? (
              <img
                src={businessLogo}
                alt=""
                className="h-11 w-11 shrink-0 rounded-2xl object-cover shadow-md"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 text-sm font-bold text-white shadow-md">
                {(businessName ?? "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {businessName}
              </p>
              {businessId ? (
                <p className="truncate font-mono text-xs text-slate-500">
                  {businessId}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  {session?.role === "SUPER_ADMIN"
                    ? "Super admin"
                    : t("nav.settings")}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 rounded-xl border-slate-200/80 bg-white/60 text-slate-700 hover:bg-red-50 hover:text-red-700"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {t("common.logout")}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/60 glass px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-10 w-10 shrink-0 rounded-2xl border border-slate-200/80 bg-white/70 text-slate-700 shadow-sm hover:bg-blue-500/10 hover:text-blue-700"
              onClick={() => setDrawerOpen(true)}
              aria-label={t("sidebar.open")}
              aria-expanded={drawerOpen}
            >
              <Menu className="h-5 w-5" strokeWidth={2.25} />
            </Button>
            <div className="relative min-w-0 max-w-md flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                className="rounded-2xl border-slate-200/50 bg-slate-100/80 pl-10 text-sm"
                aria-label={t("common.search")}
              />
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-slate-400">
                ⌕
              </span>
            </div>
          </div>
          <Select
            value={locale}
            onValueChange={(v) => {
              if (v === "en" || v === "sw") setLocale(v as Locale);
            }}
          >
            <SelectTrigger
              className="h-9 w-[7.5rem] shrink-0 rounded-xl border-slate-200/80 text-xs sm:text-sm"
              aria-label={t("common.language")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("common.english")}</SelectItem>
              <SelectItem value="sw">{t("common.swahili")}</SelectItem>
            </SelectContent>
          </Select>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
