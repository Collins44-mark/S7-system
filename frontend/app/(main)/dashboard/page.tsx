"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
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
import { useBusinessWeather } from "@/lib/business-weather";
import { greetingKey, type WeatherReport } from "@/lib/weather-scene";
import {
  AlertTriangle,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  DollarSign,
  Inbox,
  Moon,
  Sun,
  TrendingUp,
  Wallet,
} from "lucide-react";

type DashboardRes = {
  totalItemSkus: number;
  totalUnitsInStock: number;
  stockValue: string;
  totalProfitAllTime: string;
  expensesTotal: string;
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

const SUMMARY_CARD = "glass dash-sky-card card-hover rounded-2xl";

function WeatherChip({
  weather,
  night,
}: {
  weather: WeatherReport;
  night: boolean;
}) {
  const Icon =
    weather.condition === "storm"
      ? CloudLightning
      : weather.condition === "rain"
        ? CloudRain
        : weather.condition === "fog"
          ? CloudFog
          : weather.condition === "cloudy"
            ? Cloud
            : night
              ? Moon
              : Sun;
  const place = /tanzania/i.test(weather.locationName)
    ? weather.locationName
    : `${weather.locationName}, Tanzania`;

  return (
    <div className="dash-weather flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
      <Icon className="h-7 w-7 shrink-0 text-white" strokeWidth={1.75} />
      <div className="min-w-0 text-left">
        <p className="text-lg font-semibold leading-none text-white">
          {Math.round(weather.temperatureC)}°C
        </p>
        <p className="mt-1 truncate text-xs text-white/80">{place}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { query } = useSearch();
  const session = useAuthStore((s) => s.session);
  const userName =
    session?.role === "BUSINESS" ? (session.ownerName?.trim() ?? "") : "";
  const { now, timeZone, hour, weather, dark } = useBusinessWeather();
  const titleClass =
    "text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]";
  const mutedClass =
    "text-white/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]";
  const dateLocale = locale === "sw" ? "sw" : "en-GB";
  const dayKey = now.toDateString();
  const load = useCallback(async (): Promise<DashboardRes> => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const d = await api.get<DashboardRes>("/reports/dashboard", {
      params: { from: start.toISOString(), to: end.toISOString() },
    });
    return d.data;
  }, [dayKey]);

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

  const heading = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 sm:max-w-[60%]">
        <p className={`text-base font-medium leading-6 sm:text-lg ${mutedClass}`}>
          {t(greetingKey(hour))}
        </p>
        {userName ? (
          <p className={`mt-1 text-3xl font-bold leading-none tracking-tight sm:text-4xl ${titleClass}`}>
            {userName}
          </p>
        ) : null}
        <p className={`mt-3 max-w-xl text-sm leading-6 sm:text-base ${mutedClass}`}>
          {t("dashboard.subtitle")}
        </p>
      </div>
      <div className="flex flex-col items-end gap-3">
        <div className={`text-right text-sm leading-5 ${mutedClass}`}>
          <p>{now.toLocaleDateString(dateLocale, { weekday: "long", timeZone })}</p>
          <p>
            {now.toLocaleDateString(dateLocale, {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone,
            })}
          </p>
        </div>
        {weather ? <WeatherChip weather={weather} night={dark} /> : null}
      </div>
    </div>
  );

  return (
    <div className="animate-in-page flex flex-col gap-6">
        {loading && !dash ? (
          <>
            {heading}
            <PageLoading label={t("dashboard.loading")} />
          </>
        ) : error && !dash ? (
          <div className="space-y-4">
            {heading}
            <ErrorBanner message={error} onRetry={() => refetch()} />
          </div>
        ) : dash ? (
          <>
            {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
            {heading}
            <div className="mt-8 grid grid-cols-2 gap-4 sm:mt-10 lg:grid-cols-4 lg:gap-5">
              <div className={`${SUMMARY_CARD} p-4 sm:p-5`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                    {t("dashboard.expenses")}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100">
                    <Wallet className="h-4 w-4 text-red-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {money(dash.expensesTotal ?? 0)}
                </p>
              </div>
              <div className={`${SUMMARY_CARD} p-4 sm:p-5`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                    {t("dashboard.stockValue")}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                    <DollarSign className="h-4 w-4 text-indigo-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{money(dash.stockValue)}</p>
              </div>
              <div className={`${SUMMARY_CARD} p-4 sm:p-5`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
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
              <Link
                href="/inventory?stock=low"
                className={`${SUMMARY_CARD} block p-4 sm:p-5`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                    {t("dashboard.lowStock")}
                  </span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800">{dash.lowStockCount}</p>
                <span className="text-xs text-orange-600">{t("dashboard.needsAttention")}</span>
              </Link>
            </div>
            <div className="glass dash-orders rounded-2xl p-4 sm:p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-800">
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
                      <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        <th className="pb-3">{t("dashboard.order")}</th>
                        <th className="pb-3">{t("dashboard.customer")}</th>
                        <th className="pb-3">{t("dashboard.amount")}</th>
                        <th className="pb-3">{t("dashboard.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentFiltered.map((o) => (
                        <tr key={o.id} className="border-t border-slate-200/80">
                          <td className="py-3.5 font-medium text-slate-800">#{o.orderNumber}</td>
                          <td className="py-3.5 text-slate-700">{o.customer.name}</td>
                          <td className="py-3.5 text-slate-700">{money(o.totalAmount)}</td>
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
