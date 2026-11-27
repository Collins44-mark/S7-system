"use client";

import { useCallback, useMemo, useState } from "react";
import { Factory, MoreVertical } from "lucide-react";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { parseAmount } from "@/lib/format";
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

type StockItem = {
  id: string;
  name: string;
  unit: string;
  quantity: string;
};

type RangeKey = "today" | "week" | "month" | "year" | "custom";

type ProductionRow = {
  id: string;
  sourceQuantity: string;
  sourceQuantityAfter: string;
  resultQuantity: string;
  resultQuantityAfter: string;
  createdAt: string;
  sourceItem: { id: string; name: string; unit: string };
  resultItem: { id: string; name: string; unit: string };
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

function formatQty(raw: unknown) {
  const parsed = parseAmount(raw);
  if (parsed == null) return "—";
  const rounded = Math.round(parsed * 1000) / 1000;
  const whole = Math.abs(rounded - Math.trunc(rounded)) < 1e-9;
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: whole ? 0 : 3,
  }).format(rounded);
}

function whenLabel(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function knownError(
  message: string,
  t: (key: string) => string,
) {
  if (message === "PRODUCTION_NOT_ENOUGH") return t("production.notEnough");
  if (message === "PRODUCTION_SAME_ITEM") return t("production.sameItem");
  if (message === "PRODUCTION_ITEM_MISSING") return t("production.itemMissing");
  return message;
}

export default function ProductionPage() {
  const { t } = useI18n();
  const { query } = useSearch();
  const [sourceId, setSourceId] = useState("");
  const [resultId, setResultId] = useState("");
  const [sourceAmount, setSourceAmount] = useState("");
  const [resultAmount, setResultAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewing, setViewing] = useState<ProductionRow | null>(null);
  const period = useMemo(() => bounds(range, from, to), [range, from, to]);

  const load = useCallback(async () => {
    const itemsRes = await api.get<StockItem[]>("/items");
    if (!period) return { items: itemsRes.data, rows: [] as ProductionRow[] };
    const productionRes = await api.get<ProductionRow[]>("/production", {
      params: { from: period.start.toISOString(), to: period.end.toISOString() },
    });
    return { items: itemsRes.data, rows: productionRes.data };
  }, [period]);

  const { data, error, loading, refetch } = useAsyncData(load, [load]);
  const items = data?.items ?? [];
  const source = items.find((item) => item.id === sourceId) ?? null;
  const result = items.find((item) => item.id === resultId) ?? null;
  const used = parseAmount(sourceAmount);
  const made = parseAmount(resultAmount);
  const amountsOk = used != null && used > 0 && made != null && made > 0;
  const sameItem = source != null && result != null && source.id === result.id;
  const short =
    source != null && used != null && used > (parseAmount(source.quantity) ?? 0);
  const ready = source != null && result != null && amountsOk && !sameItem && !short;

  const q = query.trim().toLowerCase();
  const history = useMemo(() => {
    const rows = data?.rows ?? [];
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.sourceItem.name} ${row.resultItem.name}`.toLowerCase().includes(q),
    );
  }, [data?.rows, q]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!source || !result) {
      setFormError(t("production.chooseItem"));
      return;
    }
    if (sameItem) {
      setFormError(t("production.sameItem"));
      return;
    }
    if (!amountsOk) {
      setFormError(t("production.amountInvalid"));
      return;
    }
    if (short) {
      setFormError(t("production.notEnough"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/production", {
        sourceItemId: source.id,
        sourceQuantity: used,
        resultItemId: result.id,
        resultQuantity: made,
      });
      setSourceAmount("");
      setResultAmount("");
      await refetch();
    } catch (err: unknown) {
      setFormError(knownError(getApiErrorMessage(err), t));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("production.title")}</h1>
        <PageLoading label={t("production.loading")} />
      </div>
    );
  }

  return (
    <div className="animate-in-page space-y-6">
      {error ? <ErrorBanner message={error} onRetry={() => refetch()} /> : null}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("production.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("production.intro")}</p>
      </div>

      <form onSubmit={save} className="glass grid gap-4 rounded-2xl p-5 sm:grid-cols-2">
        {formError ? (
          <p className="text-sm text-red-600 sm:col-span-2" role="alert">
            {formError}
          </p>
        ) : null}
        <div>
          <Label>{t("production.from")}</Label>
          <Select
            value={sourceId}
            onValueChange={(value) => setSourceId(value ?? "")}
          >
            <SelectTrigger className="mt-1 w-full rounded-xl">
              <SelectValue placeholder={t("production.chooseItem")}>
                {source ? source.name : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {source ? (
            <p className="mt-1 text-xs text-slate-500">
              {t("production.inStock", {
                qty: formatQty(source.quantity),
                unit: source.unit,
              })}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="production-used">{t("production.used")}</Label>
          <Input
            id="production-used"
            inputMode="decimal"
            value={sourceAmount}
            onChange={(e) => setSourceAmount(e.target.value)}
            placeholder="1"
            className="mt-1 rounded-xl"
          />
        </div>
        <div>
          <Label>{t("production.to")}</Label>
          <Select
            value={resultId}
            onValueChange={(value) => setResultId(value ?? "")}
          >
            <SelectTrigger className="mt-1 w-full rounded-xl">
              <SelectValue placeholder={t("production.chooseItem")}>
                {result ? result.name : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {result ? (
            <p className="mt-1 text-xs text-slate-500">
              {t("production.inStock", {
                qty: formatQty(result.quantity),
                unit: result.unit,
              })}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="production-made">{t("production.made")}</Label>
          <Input
            id="production-made"
            inputMode="decimal"
            value={resultAmount}
            onChange={(e) => setResultAmount(e.target.value)}
            placeholder="2"
            className="mt-1 rounded-xl"
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={saving || !ready}
            className="btn-primary-gradient rounded-xl text-white"
          >
            {saving ? t("production.saving") : t("production.save")}
          </Button>
        </div>
      </form>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <h2 className="text-sm font-semibold text-slate-700">
            {t("production.history")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={range}
              onValueChange={(value) => {
                if (
                  value === "today" ||
                  value === "week" ||
                  value === "month" ||
                  value === "year" ||
                  value === "custom"
                ) {
                  setRange(value);
                }
              }}
            >
              <SelectTrigger className="h-9 w-40 rounded-xl">
                <SelectValue>{t(`production.${range}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("production.today")}</SelectItem>
                <SelectItem value="week">{t("production.week")}</SelectItem>
                <SelectItem value="month">{t("production.month")}</SelectItem>
                <SelectItem value="year">{t("production.year")}</SelectItem>
                <SelectItem value="custom">{t("production.custom")}</SelectItem>
              </SelectContent>
            </Select>
            {range === "custom" ? (
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
            ) : null}
          </div>
        </div>
        {range === "custom" && !period ? (
          <p className="px-5 pt-3 text-sm text-amber-800">{t("production.customHint")}</p>
        ) : null}
        {history.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Factory}
              title={
                range === "today" && !q
                  ? t("production.emptyTitle")
                  : t("production.noneInRange")
              }
              description={
                range === "today" && !q ? t("production.emptyDesc") : undefined
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("production.col.from")}</TableHead>
                <TableHead>{t("production.col.used")}</TableHead>
                <TableHead>{t("production.col.to")}</TableHead>
                <TableHead>{t("production.col.made")}</TableHead>
                <TableHead>{t("production.col.stock")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("production.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.sourceItem.name}</TableCell>
                  <TableCell>
                    {formatQty(row.sourceQuantity)} {row.sourceItem.unit}
                  </TableCell>
                  <TableCell>{row.resultItem.name}</TableCell>
                  <TableCell>
                    {formatQty(row.resultQuantity)} {row.resultItem.unit}
                  </TableCell>
                  <TableCell>
                    {formatQty(row.resultQuantityAfter)} {row.resultItem.unit}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                        aria-label={t("production.actions")}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewing(row)}>
                          {t("production.view")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <Dialog open={viewing != null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="glass max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("production.details")}</DialogTitle>
          </DialogHeader>
          {viewing ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t("production.col.when")}</dt>
                <dd className="font-medium text-slate-800">{whenLabel(viewing.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t("production.from")}</dt>
                <dd className="font-medium text-slate-800">{viewing.sourceItem.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t("production.used")}</dt>
                <dd className="font-medium text-slate-800">
                  {formatQty(viewing.sourceQuantity)} {viewing.sourceItem.unit}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t("production.stockLeft")}</dt>
                <dd className="font-medium text-slate-800">
                  {formatQty(viewing.sourceQuantityAfter)} {viewing.sourceItem.unit}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t("production.to")}</dt>
                <dd className="font-medium text-slate-800">{viewing.resultItem.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t("production.made")}</dt>
                <dd className="font-medium text-slate-800">
                  {formatQty(viewing.resultQuantity)} {viewing.resultItem.unit}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t("production.col.stock")}</dt>
                <dd className="font-medium text-slate-800">
                  {formatQty(viewing.resultQuantityAfter)} {viewing.resultItem.unit}
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
