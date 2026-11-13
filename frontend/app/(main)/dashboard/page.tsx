"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useAsyncData } from "@/hooks/use-async-data";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import { useAuthStore } from "@/lib/auth-store";
import {
  AlertTriangle,
  DollarSign,
  Inbox,
  Package,
  TrendingUp,
} from "lucide-react";

type DashboardRes = {
  totalItemSkus: number;
  totalUnitsInStock: number;
  stockValue: string;
  totalProfitAllTime: string;
  lowStockCount: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    totalAmount: string;
    balance: string;
    status: string;
    customer: { name: string };
  }[];
};

const DASH_CARD = "glass rounded-2xl";

function greetingKey(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "dashboard.greeting.morning";
  if (hour >= 12 && hour < 17) return "dashboard.greeting.afternoon";
  return "dashboard.greeting.evening";
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { query } = useSearch();
  const now = useNow();
  const session = useAuthStore((s) => s.session);
  const userName =
    session?.role === "BUSINESS" ? (session.ownerName?.trim() ?? "") : "";
  const dateLocale = locale === "sw" ? "sw" : "en-GB";
  const load = useCallback(async (): Promise<DashboardRes> => {
    const d = await api.get<DashboardRes>("/reports/dashboard");
    return d.data;
  }, []);

  const { data, error, loading, refetch } = useAsyncData(load, [load]);

  const recentFiltered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const rows = data.recentOrders.slice(0, 4);
    if (!q) return rows;
    return rows.filter((o) => {
      const num = o.orderNumber.toLowerCase();
      const cust = o.customer.name.toLowerCase();
      const st = o.status.toLowerCase();
      return num.includes(q) || cust.includes(q) || st.includes(q);
    });
  }, [data, query]);

  const dash = data;

  return (
    <div className="animate-in-page space-y-6">
        {loading && !dash ? (
          <PageLoading label={t("dashboard.loading")} />
        ) : error && !dash ? (
          <div className="space-y-4">
            <p className="text-base text-slate-500 sm:text-lg">{t(greetingKey(now))}</p>
            {userName ? (
              <p className="mt-1 text-2xl font-bold leading-tight text-slate-800">
                {userName}
              </p>
            ) : null}
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
              {t("dashboard.subtitle")}
            </p>
            <ErrorBanner message={error} onRetry={() => refetch()} />
          </div>
        ) : dash ? (
          <>
            {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 sm:max-w-[60%]">
                <p className="text-base text-slate-500 sm:text-lg">{t(greetingKey(now))}</p>
                {userName ? (
                  <p className="mt-1 text-2xl font-bold leading-none text-slate-800">
                    {userName}
                  </p>
                ) : null}
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
                  {t("dashboard.subtitle")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-4">
                <div className="text-right text-slate-600">
                  <p className="text-sm">
                    {now.toLocaleDateString(dateLocale, { weekday: "long" })}
                  </p>
                  <p className="text-sm">
                    {now.toLocaleDateString(dateLocale, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <div className={`${DASH_CARD} card-hover p-4 sm:p-5`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("dashboard.skus")}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{dash.totalItemSkus}</p>
              </div>
              <div className={`${DASH_CARD} card-hover p-4 sm:p-5`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("dashboard.stockValue")}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                    <DollarSign className="h-4 w-4 text-indigo-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{money(dash.stockValue)}</p>
              </div>
              <div className={`${DASH_CARD} card-hover p-4 sm:p-5`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("dashboard.profit")}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {money(dash.totalProfitAllTime)}
                </p>
              </div>
              <div className={`${DASH_CARD} card-hover p-4 sm:p-5`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("dashboard.lowStock")}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{dash.lowStockCount}</p>
                <span className="text-xs text-orange-600">{t("dashboard.needsAttention")}</span>
              </div>
            </div>
            <div className={`${DASH_CARD} p-4 sm:p-5`}>
              <h3 className="mb-4 text-sm font-semibold text-slate-700">
                {t("dashboard.recentOrders")}
              </h3>
              {dash.recentOrders.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title={t("dashboard.noOrders")}
                  description={t("dashboard.noOrdersDesc")}
                />
              ) : recentFiltered.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title={t("dashboard.noSearchResults")}
                  description={t("dashboard.noOrdersDesc")}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-3">{t("dashboard.order")}</th>
                        <th className="pb-3">{t("dashboard.customer")}</th>
                        <th className="pb-3">{t("dashboard.amount")}</th>
                        <th className="pb-3">{t("dashboard.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentFiltered.map((o) => (
                        <tr key={o.id} className="border-t border-slate-100">
                          <td className="py-3 font-medium">#{o.orderNumber}</td>
                          <td>{o.customer.name}</td>
                          <td>{money(o.totalAmount)}</td>
                          <td>
                            <Badge
                              variant="secondary"
                              className={
                                o.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-amber-100 text-amber-800"
                              }
                            >
                              {o.status === "COMPLETED"
                                ? t("dashboard.paid")
                                : t("dashboard.pending")}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
    </div>
  );
}
