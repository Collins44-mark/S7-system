"use client";

import { useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { money, parseAmount } from "@/lib/format";
import { useAsyncData } from "@/hooks/use-async-data";
import { SparkArea } from "@/components/spark-area";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import {
  AlertTriangle,
  DollarSign,
  Inbox,
  LayoutDashboard,
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

type TsRes = { dates: string[]; sales: string[]; profit: string[] };

type DashPayload = { dashboard: DashboardRes; timeseries: TsRes };

export default function DashboardPage() {
  const { t } = useI18n();
  const { query } = useSearch();
  const load = useCallback(async (): Promise<DashPayload> => {
    const [d, t] = await Promise.all([
      api.get<DashboardRes>("/reports/dashboard"),
      api.get<TsRes>("/reports/timeseries?period=weekly"),
    ]);
    return { dashboard: d.data, timeseries: t.data };
  }, []);

  const { data, error, loading, refetch } = useAsyncData(load, [load]);

  const recentFiltered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const rows = data.dashboard.recentOrders;
    if (!q) return rows;
    return rows.filter((o) => {
      const num = o.orderNumber.toLowerCase();
      const cust = o.customer.name.toLowerCase();
      const st = o.status.toLowerCase();
      return num.includes(q) || cust.includes(q) || st.includes(q);
    });
  }, [data, query]);

  if (loading && !data) {
    return <PageLoading label={t("dashboard.loading")} />;
  }

  if (error && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("dashboard.title")}</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const dash = data!.dashboard;
  const ts = data!.timeseries;
  const salesNums = (ts?.sales ?? []).map((s) => parseAmount(s) ?? 0);
  const profitNums = (ts?.profit ?? []).map((s) => parseAmount(s) ?? 0);

  return (
    <div className="animate-in-page space-y-6">
      {error && (
        <ErrorBanner message={error} onRetry={() => refetch()} />
      )}
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
        <LayoutDashboard className="h-7 w-7 text-blue-600" />
        {t("dashboard.title")}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass card-hover rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("dashboard.skus")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {dash.totalItemSkus}
          </p>
          <span className="text-xs text-slate-500">
            {dash.totalUnitsInStock} {t("dashboard.units")}
          </span>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("dashboard.stockValue")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <DollarSign className="h-4 w-4 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {money(dash.stockValue)}
          </p>
          <span className="text-xs text-slate-500">{t("dashboard.atBuy")}</span>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("dashboard.profit")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {money(dash.totalProfitAllTime)}
          </p>
          <span className="text-xs text-slate-500">{t("dashboard.profitHint")}</span>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("dashboard.lowStock")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {dash.lowStockCount}
          </p>
          <span className="text-xs text-orange-600">{t("dashboard.needsAttention")}</span>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            {t("dashboard.salesWeek")}
          </h3>
          <SparkArea values={salesNums} color="#3b82f6" className="h-28 w-full" />
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            {t("dashboard.profitWeek")}
          </h3>
          <SparkArea values={profitNums} color="#10b981" className="h-28 w-full" />
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
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
    </div>
  );
}
