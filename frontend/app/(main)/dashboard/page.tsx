"use client";

import { useCallback } from "react";
import { api } from "@/lib/api";
import { money, parseAmount } from "@/lib/format";
import { useAsyncData } from "@/hooks/use-async-data";
import { SparkArea } from "@/components/spark-area";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
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
  const load = useCallback(async (): Promise<DashPayload> => {
    const [d, t] = await Promise.all([
      api.get<DashboardRes>("/reports/dashboard"),
      api.get<TsRes>("/reports/timeseries?period=weekly"),
    ]);
    return { dashboard: d.data, timeseries: t.data };
  }, []);

  const { data, error, loading, refetch } = useAsyncData(load, [load]);

  if (loading && !data) {
    return <PageLoading label="Loading dashboard…" />;
  }

  if (error && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
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
        Dashboard
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass card-hover rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Items (SKUs)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {dash.totalItemSkus}
          </p>
          <span className="text-xs text-slate-500">
            {dash.totalUnitsInStock} units in stock
          </span>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Inventory value
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
              <DollarSign className="h-4 w-4 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {money(dash.stockValue)}
          </p>
          <span className="text-xs text-slate-500">At buying price</span>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total profit
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {money(dash.totalProfitAllTime)}
          </p>
          <span className="text-xs text-slate-500">All-time from sales</span>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Low stock alerts
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {dash.lowStockCount}
          </p>
          <span className="text-xs text-orange-600">Needs attention</span>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Sales (weekly)
          </h3>
          <SparkArea values={salesNums} color="#3b82f6" className="h-28 w-full" />
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Profit (weekly)
          </h3>
          <SparkArea values={profitNums} color="#10b981" className="h-28 w-full" />
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          Recent orders
        </h3>
        {dash.recentOrders.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No orders yet"
            description="Create an order from the Orders page when you sell stock."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-3">Order</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {dash.recentOrders.map((o) => (
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
                        {o.status === "COMPLETED" ? "Paid" : "Pending"}
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
