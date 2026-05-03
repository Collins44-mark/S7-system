"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useAsyncData } from "@/hooks/use-async-data";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { SparkArea } from "@/components/spark-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package } from "lucide-react";

type Period = "daily" | "weekly" | "monthly";

type SalesRes = {
  totalSales: string;
  totalProfit: string;
  itemsSold: number;
  start: string;
  end: string;
  period: string;
};

type TsRes = { dates: string[]; sales: string[]; profit: string[] };

type Restock = {
  id: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  item: { name: string };
};

type ReportPayload = {
  sales: SalesRes;
  timeseries: TsRes;
  restocks: Restock[];
};

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async (): Promise<ReportPayload> => {
    const useCustomRange = custom && Boolean(from && to);
    const salesUrl = useCustomRange
      ? `/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : `/reports/sales?period=${period}`;
    const restockUrl = useCustomRange
      ? `/reports/restocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : "/reports/restocks";
    const [s, t, r] = await Promise.all([
      api.get<SalesRes>(salesUrl),
      api.get<TsRes>(`/reports/timeseries?period=${period}`),
      api.get<Restock[]>(restockUrl),
    ]);
    return {
      sales: s.data,
      timeseries: t.data,
      restocks: r.data,
    };
  }, [period, custom, from, to]);

  const { data, error, loading, refetch } = useAsyncData(load, [
    period,
    custom,
    from,
    to,
    load,
  ]);

  if (loading && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <PageLoading label="Loading reports…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const sales = data!.sales;
  const ts = data!.timeseries;
  const restocks = data!.restocks;
  const salesNums = (ts?.sales ?? []).map((x) => Number(x));
  const profitNums = (ts?.profit ?? []).map((x) => Number(x));
  const useCustomRange = custom && Boolean(from && to);

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
      <div className="flex flex-wrap gap-2">
        {(["daily", "weekly", "monthly"] as const).map((p) => (
          <Button
            key={p}
            type="button"
            variant={!custom && period === p ? "default" : "secondary"}
            className="rounded-xl capitalize"
            onClick={() => {
              setCustom(false);
              setPeriod(p);
            }}
          >
            {p}
          </Button>
        ))}
        <Button
          type="button"
          variant={custom ? "default" : "secondary"}
          className="rounded-xl"
          onClick={() => setCustom(true)}
        >
          Custom range
        </Button>
      </div>
      {custom && (
        <div className="glass rounded-xl p-4 text-sm text-slate-600">
          {!useCustomRange && (
            <p className="mb-3 text-amber-800">
              Choose <strong>From</strong> and <strong>To</strong>, then
              Apply to filter sales and restocks. Charts still follow the
              period buttons above.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-slate-500">From</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">To</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => refetch()}
              disabled={!from || !to}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass card-hover rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            Total sales
          </span>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {money(sales.totalSales)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {new Date(sales.start).toLocaleDateString()} —{" "}
            {new Date(sales.end).toLocaleDateString()}
          </p>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            Total profit
          </span>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {money(sales.totalProfit)}
          </p>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            Items sold
          </span>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {sales.itemsSold}
          </p>
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          Revenue ({period})
        </h3>
        <SparkArea values={salesNums} color="#6366f1" className="h-32 w-full" />
      </div>
      <div className="glass rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          Profit ({period})
        </h3>
        <SparkArea values={profitNums} color="#10b981" className="h-32 w-full" />
      </div>
      <div className="glass overflow-hidden rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          Restock history
        </h3>
        {restocks.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No restock events"
            description="Restocks appear when you add stock from Inventory → row menu → Restock."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restocks.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.item.name}</TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {r.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
