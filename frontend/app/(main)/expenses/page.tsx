"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreVertical, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { money, parseAmount } from "@/lib/format";
import { useAsyncData } from "@/hooks/use-async-data";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type RangeKey = "today" | "yesterday" | "week" | "month" | "year" | "custom";

type ExpenseRow = {
  id: string;
  amount: string;
  note: string | null;
  spentAt: string;
};

type ExpenseList = {
  total: string;
  count: number;
  items: ExpenseRow[];
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function bounds(range: RangeKey, from: string, to: string) {
  const now = new Date();
  if (range === "today") return { start: startOfDay(now), end: endOfDay(now) };
  if (range === "yesterday") {
    const day = new Date(now);
    day.setDate(day.getDate() - 1);
    return { start: startOfDay(day), end: endOfDay(day) };
  }
  if (range === "week") {
    const start = startOfDay(now);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end: endOfDay(end) };
  }
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  if (range === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  if (!from || !to) return null;
  return { start: startOfDay(new Date(from)), end: endOfDay(new Date(to)) };
}

function slipDate(iso: string) {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${date.getFullYear()}`;
}

export default function ExpensesPage() {
  const { t } = useI18n();
  const { query } = useSearch();
  const [range, setRange] = useState<RangeKey>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const period = useMemo(() => bounds(range, from, to), [range, from, to]);

  const load = useCallback(async (): Promise<ExpenseList | null> => {
    if (!period) return null;
    const { data } = await api.get<ExpenseList>("/expenses", {
      params: { from: period.start.toISOString(), to: period.end.toISOString() },
    });
    return data;
  }, [period]);

  const { data, error, loading, refetch } = useAsyncData(load, [load]);
  const rows = data?.items ?? [];
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return rows;
    return rows.filter((row) => (row.note ?? "").toLowerCase().includes(q));
  }, [rows, q]);
  const pageSizes = [10, 40, 70, 100] as const;
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [q, range, from, to, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);
  const rangeFrom = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = Math.min(currentPage * pageSize, filtered.length);

  const rangeLabel = t(`expenses.${range}`);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    if (value == null || value <= 0) {
      setFormError(t("expenses.amountRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/expenses", {
        amount: value,
        note,
        spentAt: new Date().toISOString(),
      });
      setAmount("");
      setNote("");
      await refetch();
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: ExpenseRow) {
    setEditing(row);
    setEditAmount(String(row.amount));
    setEditNote(row.note ?? "");
    setEditError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const value = parseAmount(editAmount);
    if (value == null || value <= 0) {
      setEditError(t("expenses.amountRequired"));
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await api.patch(`/expenses/${editing.id}`, { amount: value, note: editNote });
      setEditing(null);
      await refetch();
    } catch (err: unknown) {
      setEditError(getApiErrorMessage(err));
    } finally {
      setEditSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/expenses/${id}`);
      await refetch();
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err));
    }
  }

  if (loading && !data && period) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("expenses.title")}</h1>
        <PageLoading label={t("expenses.loading")} />
      </div>
    );
  }

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("expenses.title")}</h1>
        <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
          <Select
            value={range}
            onValueChange={(value) => {
              if (
                value === "today" ||
                value === "yesterday" ||
                value === "week" ||
                value === "month" ||
                value === "year" ||
                value === "custom"
              ) {
                setRange(value);
              }
            }}
          >
            <SelectTrigger className="h-9 w-44 rounded-xl">
              <SelectValue>{rangeLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t("expenses.today")}</SelectItem>
              <SelectItem value="yesterday">{t("expenses.yesterday")}</SelectItem>
              <SelectItem value="week">{t("expenses.week")}</SelectItem>
              <SelectItem value="month">{t("expenses.month")}</SelectItem>
              <SelectItem value="year">{t("expenses.year")}</SelectItem>
              <SelectItem value="custom">{t("expenses.custom")}</SelectItem>
            </SelectContent>
          </Select>
          {range === "custom" && (
            <>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 w-[9.5rem] rounded-xl"
                aria-label={t("reports.from")}
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 w-[9.5rem] rounded-xl"
                aria-label={t("reports.to")}
              />
            </>
          )}
        </div>
      </div>

      {range === "custom" && !period ? (
        <p className="text-sm text-amber-800">{t("reports.customHint")}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass card-hover rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            {t("expenses.total")}
          </span>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {money(data?.total ?? 0)}
          </p>
        </div>
        <div className="glass card-hover rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            {t("expenses.count")}
          </span>
          <p className="mt-2 text-2xl font-bold text-slate-800">{data?.count ?? 0}</p>
        </div>
      </div>

      <form onSubmit={save} className="glass grid gap-4 rounded-2xl p-5 sm:grid-cols-2">
        <h3 className="text-sm font-semibold text-slate-700 sm:col-span-2">
          {t("expenses.add")}
        </h3>
        {formError ? (
          <p className="text-sm text-red-600 sm:col-span-2" role="alert">
            {formError}
          </p>
        ) : null}
        <div>
          <Label htmlFor="expense-amount">{t("expenses.amount")}</Label>
          <Input
            id="expense-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor="expense-note">{t("expenses.note")}</Label>
          <Input
            id="expense-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 rounded-xl"
          />
        </div>
        <div className="flex justify-center sm:col-span-2">
          <Button
            type="submit"
            disabled={saving}
            className="btn-primary-gradient rounded-xl px-8 text-white"
          >
            {saving ? t("expenses.saving") : t("expenses.save")}
          </Button>
        </div>
      </form>

      <div className="glass overflow-hidden rounded-2xl p-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={t("expenses.empty")}
            description={t("expenses.emptyDesc")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("expenses.date")}</TableHead>
                <TableHead>{t("expenses.note")}</TableHead>
                <TableHead className="text-right">{t("expenses.amount")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{slipDate(row.spentAt)}</TableCell>
                  <TableCell>{row.note || "—"}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">{money(row.amount)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => void remove(row.id)}
                        >
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {filtered.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {t("inventory.showing", {
                from: rangeFrom,
                to: rangeTo,
                total: filtered.length,
              })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">{t("inventory.perPage")}</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  const n = Number(value);
                  if (n === 10 || n === 40 || n === 70 || n === 100) setPageSize(n);
                }}
              >
                <SelectTrigger className="h-9 w-[5.5rem] rounded-xl" aria-label={t("inventory.perPage")}>
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
        ) : null}
      </div>

      <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="glass max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("expenses.edit")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-4">
            {editError ? (
              <p className="text-sm text-red-600" role="alert">
                {editError}
              </p>
            ) : null}
            <div>
              <Label htmlFor="edit-expense-amount">{t("expenses.amount")}</Label>
              <Input
                id="edit-expense-amount"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="edit-expense-note">{t("expenses.note")}</Label>
              <Input
                id="edit-expense-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="flex justify-center">
              <Button
                type="submit"
                disabled={editSaving}
                className="btn-primary-gradient rounded-xl px-8 text-white"
              >
                {editSaving ? t("expenses.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
