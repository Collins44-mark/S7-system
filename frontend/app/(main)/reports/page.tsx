"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import { api } from "@/lib/api";
import { formatAmount, money, parseAmount } from "@/lib/format";
import { useAsyncData } from "@/hooks/use-async-data";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreVertical, Package } from "lucide-react";

type Period = "daily" | "weekly" | "monthly";

type SalesRes = {
  totalSales: string;
  totalProfit: string;
  costOfGoodsSold: string;
  itemsSold: string;
  start: string;
  end: string;
  period: string;
};

type RestockLine = {
  id: string;
  name: string;
  unit: string;
  quantity: string;
  quantityBefore: string | null;
  quantityAfter: string | null;
};

type Restock = {
  id: string;
  number: string;
  notes: string | null;
  createdAt: string;
  totalQuantity: string;
  lines: RestockLine[];
};

function qtyLabel(value: string | null) {
  if (value == null) return "—";
  const n = parseAmount(value);
  if (n == null) return "—";
  return formatAmount(n);
}

type ReportPayload = {
  sales: SalesRes;
  restocks: Restock[];
  expensesTotal: string;
};

export default function ReportsPage() {
  const { t } = useI18n();
  const { query } = useSearch();
  const [period, setPeriod] = useState<Period>("daily");
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openRestock, setOpenRestock] = useState<Restock | null>(null);

  const load = useCallback(async (): Promise<ReportPayload> => {
    const useCustomRange = custom && Boolean(from && to);
    const salesUrl = useCustomRange
      ? `/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : `/reports/sales?period=${period}`;
    const restockUrl = useCustomRange
      ? `/reports/restocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : `/reports/restocks?period=${period}`;
    const [s, r] = await Promise.all([
      api.get<SalesRes>(salesUrl),
      api.get<Restock[]>(restockUrl),
    ]);
    const expenses = await api.get<{ total: string }>("/expenses", {
      params: { from: s.data.start, to: s.data.end },
    });
    return {
      sales: s.data,
      restocks: r.data,
      expensesTotal: expenses.data.total,
    };
  }, [period, custom, from, to]);

  const { data, error, loading, refetch } = useAsyncData(load, [
    period,
    custom,
    from,
    to,
    load,
  ]);

  const restocks = useMemo(() => data?.restocks ?? [], [data]);
  const qRep = query.trim().toLowerCase();
  const restocksFiltered = useMemo(() => {
    if (!qRep) return restocks;
    return restocks.filter((r) => {
      const notes = (r.notes ?? "").toLowerCase();
      const names = r.lines.map((line) => line.name.toLowerCase()).join(" ");
      return (
        r.number.toLowerCase().includes(qRep) ||
        notes.includes(qRep) ||
        names.includes(qRep)
      );
    });
  }, [restocks, qRep]);

  const pageSizes = [10, 40, 70, 100] as const;
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [qRep, period, custom, from, to, pageSize]);

  const pageCount = Math.max(1, Math.ceil(restocksFiltered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return restocksFiltered.slice(start, start + pageSize);
  }, [restocksFiltered, currentPage, pageSize]);
  const rangeFrom =
    restocksFiltered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = Math.min(currentPage * pageSize, restocksFiltered.length);

  if (loading && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("reports.title")}</h1>
        <PageLoading label={t("reports.loading")} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("reports.title")}</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const sales = data!.sales;
  const useCustomRange = custom && Boolean(from && to);

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("reports.title")}</h1>
        <div className="glass flex flex-wrap items-center justify-end gap-3 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs font-medium text-slate-600">
              {t("reports.period")}
            </Label>
            <Select
              value={custom ? "custom" : period}
              onValueChange={(v) => {
                if (v === "custom") {
                  setCustom(true);
                  return;
                }
                if (v === "daily" || v === "weekly" || v === "monthly") {
                  setCustom(false);
                  setPeriod(v);
                }
              }}
            >
              <SelectTrigger className="h-9 w-[9.5rem] rounded-xl" aria-label={t("reports.period")}>
                <SelectValue>
                  {custom
                    ? t("reports.customRange")
                    : t(`reports.${period}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("reports.daily")}</SelectItem>
                <SelectItem value="weekly">{t("reports.weekly")}</SelectItem>
                <SelectItem value="monthly">{t("reports.monthly")}</SelectItem>
                <SelectItem value="custom">{t("reports.customRange")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {custom && (
            <>
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-xs font-medium text-slate-600">
                  {t("reports.from")}
                </Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 w-[9.5rem] rounded-xl"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-xs font-medium text-slate-600">
                  {t("reports.to")}
                </Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 w-[9.5rem] rounded-xl"
                />
              </div>
            </>
          )}
        </div>
      </div>
      {custom && !useCustomRange && (
        <p className="text-sm text-amber-800">{t("reports.customHint")}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass card-hover rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            {t("reports.totalSales")}
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
            {t("reports.costOfGoods")}
          </span>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {money(sales.costOfGoodsSold)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{t("reports.costOfGoodsHint")}</p>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            {t("reports.totalProfit")}
          </span>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {money(sales.totalProfit)}
          </p>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            {t("reports.itemsSold")}
          </span>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {sales.itemsSold}
          </p>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            {t("reports.expenses")}
          </span>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {money(data?.expensesTotal ?? 0)}
          </p>
        </div>
      </div>
      <div className="glass overflow-hidden rounded-2xl p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          {t("reports.restockHistory")}
        </h3>
        {restocks.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t("reports.noRestock")}
            description={t("reports.noRestockDesc")}
          />
        ) : restocksFiltered.length === 0 ? (
          <p className="text-center text-sm text-slate-600">
            {t("dashboard.noSearchResults")}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.colRestock")}</TableHead>
                  <TableHead>{t("reports.colDate")}</TableHead>
                  <TableHead>{t("inventory.col.qty")}</TableHead>
                  <TableHead className="text-right">{t("reports.colAction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.number}</TableCell>
                    <TableCell>
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{qtyLabel(r.totalQuantity)}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                        aria-label={t("reports.viewItems")}
                        onClick={() => setOpenRestock(r)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="-mx-5 mt-4 flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {t("inventory.showing", {
                  from: rangeFrom,
                  to: rangeTo,
                  total: restocksFiltered.length,
                })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">{t("inventory.perPage")}</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    if (n === 10 || n === 40 || n === 70 || n === 100) setPageSize(n);
                  }}
                >
                  <SelectTrigger
                    className="h-9 w-[5.5rem] rounded-xl"
                    aria-label={t("inventory.perPage")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizes.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("inventory.prev")}
                </Button>
                <span className="text-xs text-slate-600">
                  {t("inventory.pageOf", { page: currentPage, pages: pageCount })}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  {t("inventory.next")}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      <Dialog
        open={openRestock != null}
        onOpenChange={(v) => !v && setOpenRestock(null)}
      >
        <DialogContent className="glass max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {openRestock
                ? `${openRestock.number} · ${t("reports.viewItems")}`
                : t("reports.viewItems")}
            </DialogTitle>
          </DialogHeader>
          {openRestock && (
            <div className="space-y-3">
              {openRestock.lines.map((line) => (
                <div
                  key={line.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                >
                  <p className="text-sm font-medium text-slate-800">{line.name}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <div>
                      <p>{t("reports.found")}</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-800">
                        {qtyLabel(line.quantityBefore)}
                      </p>
                    </div>
                    <div>
                      <p>{t("reports.added")}</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-800">
                        {qtyLabel(line.quantity)}
                      </p>
                    </div>
                    <div>
                      <p>{t("reports.newQty")}</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-800">
                        {qtyLabel(line.quantityAfter)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {openRestock.notes ? (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-700">
                    {t("reports.colNotes")}:{" "}
                  </span>
                  {openRestock.notes}
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
