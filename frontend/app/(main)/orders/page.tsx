"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import { api } from "@/lib/api";
import { formatAmountInput, money, parseAmount } from "@/lib/format";
import { useAsyncData } from "@/hooks/use-async-data";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { TableSkeletonRows } from "@/components/table-skeleton";
import { ReceiptDialog, type ReceiptOrder } from "@/components/receipt-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Plus, ShoppingCart, Trash2 } from "lucide-react";

const QTY_STEP = 0.5;

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

/** Keep partial entries such as "" and "0." so the line is not removed mid-typing. */
function qtyDraftFromRaw(raw: string) {
  const cleaned = raw.replace(/,/g, ".");
  if (cleaned === "" || /^\d*\.?\d{0,3}$/.test(cleaned)) return cleaned;
  return null;
}

function qtyFromDraft(raw: string, maximum: number) {
  const parsed = parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return roundQty(Math.min(maximum, parsed));
}

function formatQty(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return String(roundQty(value));
}

function steppedQty(
  draft: string | undefined,
  current: number,
  delta: number,
  maximum: number,
) {
  const parsed = draft == null ? current : parseFloat(draft);
  const base = Number.isFinite(parsed) ? parsed : current;
  return roundQty(Math.max(0, Math.min(maximum, base + delta)));
}

const PAYMENT_CODES = [
  "CASH",
  "MPESA",
  "AIRTEL_MONEY",
  "TIGO_PESA",
  "BANK",
  "ACCOUNT",
] as const;

const ORDER_STATUSES = ["COMPLETED", "PENDING", "CANCELLED"] as const;

type DatePreset = "all" | "today" | "week" | "month" | "year" | "custom";

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function receiptSearchText(value: string | null | undefined) {
  if (!value) return "";
  const raw = value.trim().toLowerCase();
  const match = value.trim().match(/^RCT-0*(\d+)$/i);
  if (!match) return raw;
  const short = `rct-${match[1].padStart(3, "0")}`;
  return `${raw} ${short}`;
}

function orderMatchesDate(
  createdAt: string,
  preset: DatePreset,
  from: string,
  to: string,
) {
  if (preset === "all") return true;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  if (preset === "today") return d >= startOfLocalDay(now);
  if (preset === "week") {
    const s = startOfLocalDay(now);
    const mondayOffset = (s.getDay() + 6) % 7;
    s.setDate(s.getDate() - mondayOffset);
    return d >= s;
  }
  if (preset === "month") {
    return d >= new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (preset === "year") {
    return d >= new Date(now.getFullYear(), 0, 1);
  }
  if (!from && !to) return true;
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (d < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`);
    if (d > end) return false;
  }
  return true;
}

type ItemRow = {
  id: string;
  name: string;
  unit: string;
  sellingPrice: string;
  quantity: string;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  receiptNumber?: string | null;
  otherCharges: string;
  discount?: string;
  totalAmount: string;
  amountPaid: string;
  balance: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  customer: { name: string; phone: string | null };
  orderItems: ReceiptOrder["orderItems"];
};

export default function OrdersPage() {
  const { t } = useI18n();
  const { query } = useSearch();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRow | null>(null);
  const [receipt, setReceipt] = useState<ReceiptOrder | null>(null);
  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadOrders = useCallback(async () => {
    const { data } = await api.get<OrderRow[]>("/orders");
    return data;
  }, []);

  const {
    data: orders,
    error,
    loading,
    refetch,
  } = useAsyncData(loadOrders, [loadOrders]);

  const loadItems = useCallback(async () => {
    const { data } = await api.get<ItemRow[]>("/items");
    setItems(
      data.map((i) => {
        const sp = parseAmount(i.sellingPrice);
        return {
          id: i.id,
          name: i.name,
          unit:
            typeof (i as unknown as { unit?: unknown }).unit === "string"
              ? String((i as unknown as { unit?: unknown }).unit)
              : "pcs",
          sellingPrice: sp != null ? formatAmountInput(sp) : "0",
          quantity: String(
            (i as unknown as { quantity?: unknown }).quantity ?? "0",
          ),
        };
      }),
    );
  }, []);

  useEffect(() => {
    if (createOpen || editingOrder) void loadItems();
  }, [createOpen, editingOrder, loadItems]);

  const orderList = useMemo(() => orders ?? [], [orders]);
  const customerOptions = useMemo(() => {
    const names = new Set<string>();
    for (const o of orderList) names.add(o.customer.name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [orderList]);
  const q = query.trim().toLowerCase();
  const orderFiltered = useMemo(() => {
    return orderList.filter((o) => {
      if (!orderMatchesDate(o.createdAt, datePreset, dateFrom, dateTo)) {
        return false;
      }
      if (customerFilter !== "all" && o.customer.name !== customerFilter) {
        return false;
      }
      if (methodFilter !== "all" && o.paymentMethod !== methodFilter) {
        return false;
      }
      if (statusFilter !== "all" && o.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const num = o.orderNumber.toLowerCase();
      const receipt = receiptSearchText(o.receiptNumber);
      const cust = o.customer.name.toLowerCase();
      const phone = (o.customer.phone ?? "").toLowerCase();
      const method = o.paymentMethod.toLowerCase();
      return (
        num.includes(q) ||
        receipt.includes(q) ||
        cust.includes(q) ||
        phone.includes(q) ||
        method.includes(q) ||
        o.status.toLowerCase().includes(q)
      );
    });
  }, [
    orderList,
    q,
    datePreset,
    dateFrom,
    dateTo,
    customerFilter,
    methodFilter,
    statusFilter,
  ]);
  const pageSizes = [10, 40, 70, 100] as const;
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [
    q,
    datePreset,
    dateFrom,
    dateTo,
    customerFilter,
    methodFilter,
    statusFilter,
    pageSize,
  ]);
  const pageCount = Math.max(1, Math.ceil(orderFiltered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return orderFiltered.slice(start, start + pageSize);
  }, [orderFiltered, currentPage, pageSize]);
  const rangeFrom =
    orderFiltered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = Math.min(currentPage * pageSize, orderFiltered.length);

  if (loading && !orders) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {t("orders.title")}
        </h1>
        <PageLoading label={t("orders.loading")} />
        <div className="glass overflow-hidden rounded-2xl">
          <TableSkeletonRows rows={6} />
        </div>
      </div>
    );
  }

  if (error && !orders) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {t("orders.title")}
        </h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {t("orders.title")}
        </h1>
        <Button
          className="btn-primary-gradient rounded-xl text-white"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("orders.new")}
        </Button>
      </div>
      <div className="glass flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Label className="shrink-0 text-xs font-medium text-slate-600">
            {t("orders.filter.date")}
          </Label>
          <Select
            value={datePreset}
            onValueChange={(v) => {
              if (
                v === "all" ||
                v === "today" ||
                v === "week" ||
                v === "month" ||
                v === "year" ||
                v === "custom"
              ) {
                setDatePreset(v);
              }
            }}
          >
            <SelectTrigger
              className="h-9 w-[9.5rem] rounded-xl"
              aria-label={t("orders.filter.date")}
            >
              <SelectValue>
                {datePreset === "all"
                  ? t("orders.filter.all")
                  : datePreset === "today"
                    ? t("orders.filter.today")
                    : datePreset === "week"
                      ? t("orders.filter.week")
                      : datePreset === "month"
                        ? t("orders.filter.month")
                        : datePreset === "year"
                          ? t("orders.filter.year")
                          : t("orders.filter.custom")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders.filter.all")}</SelectItem>
              <SelectItem value="today">{t("orders.filter.today")}</SelectItem>
              <SelectItem value="week">{t("orders.filter.week")}</SelectItem>
              <SelectItem value="month">{t("orders.filter.month")}</SelectItem>
              <SelectItem value="year">{t("orders.filter.year")}</SelectItem>
              <SelectItem value="custom">
                {t("orders.filter.custom")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {datePreset === "custom" && (
          <>
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs font-medium text-slate-600">
                {t("orders.filter.from")}
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-[9.5rem] rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs font-medium text-slate-600">
                {t("orders.filter.to")}
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-[9.5rem] rounded-xl"
              />
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <Label className="shrink-0 text-xs font-medium text-slate-600">
            {t("orders.filter.customer")}
          </Label>
          <Select
            value={customerFilter}
            onValueChange={(v) => {
              if (v) setCustomerFilter(v);
            }}
          >
            <SelectTrigger
              className="h-9 w-[9.5rem] rounded-xl"
              aria-label={t("orders.filter.customer")}
            >
              <SelectValue>
                {customerFilter === "all"
                  ? t("orders.filter.all")
                  : customerFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders.filter.all")}</SelectItem>
              {customerOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="shrink-0 text-xs font-medium text-slate-600">
            {t("orders.filter.method")}
          </Label>
          <Select
            value={methodFilter}
            onValueChange={(v) => {
              if (v) setMethodFilter(v);
            }}
          >
            <SelectTrigger
              className="h-9 w-[9.5rem] rounded-xl"
              aria-label={t("orders.filter.method")}
            >
              <SelectValue>
                {methodFilter === "all"
                  ? t("orders.filter.all")
                  : t(`payment.${methodFilter}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders.filter.all")}</SelectItem>
              {PAYMENT_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(`payment.${code}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="shrink-0 text-xs font-medium text-slate-600">
            {t("orders.filter.status")}
          </Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              if (v) setStatusFilter(v);
            }}
          >
            <SelectTrigger
              className="h-9 w-[9.5rem] rounded-xl"
              aria-label={t("orders.filter.status")}
            >
              <SelectValue>
                {statusFilter === "all"
                  ? t("orders.filter.all")
                  : t(`orders.status.${statusFilter}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders.filter.all")}</SelectItem>
              {ORDER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`orders.status.${status}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="text-xs uppercase text-slate-500">
                {t("orders.col.order")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("orders.col.customer")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("orders.col.total")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("orders.col.paid")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("orders.col.balance")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("orders.col.method")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("orders.col.status")}
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((o) => (
              <TableRow key={o.id} className="border-slate-100">
                <TableCell className="font-medium">#{o.orderNumber}</TableCell>
                <TableCell>{o.customer.name}</TableCell>
                <TableCell>{money(o.totalAmount)}</TableCell>
                <TableCell>{money(o.amountPaid)}</TableCell>
                <TableCell
                  className={
                    Number(o.balance) > 0 ? "font-medium text-red-600" : ""
                  }
                >
                  {money(o.balance)}
                </TableCell>
                <TableCell>{t(`payment.${o.paymentMethod}`)}</TableCell>
                <TableCell>
                  <Badge
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
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                        aria-label={t("orders.editOrder")}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingOrder(o)}>
                          {t("orders.editOrder")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        setReceiptAutoPrint(false);
                        setReceipt({
                          orderNumber: o.orderNumber,
                          receiptNumber: o.receiptNumber,
                          createdAt: o.createdAt,
                          otherCharges: o.otherCharges,
                          discount: o.discount,
                          totalAmount: o.totalAmount,
                          amountPaid: o.amountPaid,
                          balance: o.balance,
                          paymentMethod: o.paymentMethod,
                          customer: o.customer,
                          orderItems: o.orderItems,
                        });
                      }}
                    >
                      {t("orders.receipt")}
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {orderList.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={ShoppingCart}
              title={t("orders.emptyTitle")}
              description={t("orders.emptyDesc")}
            />
          </div>
        )}
        {orderList.length > 0 && orderFiltered.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-600">
            {t("dashboard.noSearchResults")}
          </div>
        )}
        {orderFiltered.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {t("inventory.showing", {
                from: rangeFrom,
                to: rangeTo,
                total: orderFiltered.length,
              })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">
                {t("inventory.perPage")}
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  const n = Number(value);
                  if (n === 10 || n === 40 || n === 70 || n === 100)
                    setPageSize(n);
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
        ) : null}
      </div>

      <CreateOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        items={items}
        t={t}
        onCreated={async (created, opts) => {
          setCreateOpen(false);
          await refetch();
          setReceiptAutoPrint(Boolean(opts?.autoPrint));
          setReceipt({
            orderNumber: created.orderNumber,
            receiptNumber: created.receiptNumber,
            createdAt: created.createdAt,
            otherCharges: created.otherCharges,
            discount: created.discount,
            totalAmount: created.totalAmount,
            amountPaid: created.amountPaid,
            balance: created.balance,
            paymentMethod: created.paymentMethod,
            customer: created.customer,
            orderItems: created.orderItems,
          });
        }}
      />
      <EditOrderDialog
        order={editingOrder}
        items={items}
        t={t}
        onClose={() => setEditingOrder(null)}
        onUpdated={async (updated) => {
          setEditingOrder(null);
          await refetch();
          setReceiptAutoPrint(false);
          setReceipt({
            orderNumber: updated.orderNumber,
            receiptNumber: updated.receiptNumber,
            createdAt: updated.createdAt,
            otherCharges: updated.otherCharges,
            discount: updated.discount,
            totalAmount: updated.totalAmount,
            amountPaid: updated.amountPaid,
            balance: updated.balance,
            paymentMethod: updated.paymentMethod,
            customer: updated.customer,
            orderItems: updated.orderItems,
          });
        }}
      />
      <ReceiptDialog
        order={receipt}
        open={!!receipt}
        autoPrint={receiptAutoPrint}
        onClose={() => {
          setReceipt(null);
          setReceiptAutoPrint(false);
        }}
      />
    </div>
  );
}

function CreateOrderDialog({
  open,
  onClose,
  items,
  onCreated,
  t,
}: {
  open: boolean;
  onClose: () => void;
  items: ItemRow[];
  onCreated: (o: OrderRow, opts?: { autoPrint?: boolean }) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [customerKind, setCustomerKind] = useState<"name" | "account">("name");
  const [accountId, setAccountId] = useState("");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [lines, setLines] = useState<Record<string, number>>({});
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [payMethod, setPayMethod] = useState<string>("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [discount, setDiscount] = useState("");
  const [wantPrintReceipt, setWantPrintReceipt] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<
    { id: string; name: string; phone: string; creditBalance: string }[]
  >([]);

  useEffect(() => {
    if (open) {
      setCustomerKind("name");
      setAccountId("");
      setCustName("");
      setCustPhone("");
      setLines({});
      setQtyDraft({});
      setCartIds([]);
      setSearch("");
      setPayMethod("CASH");
      setAmountPaid("");
      setOtherCharges("");
      setDiscount("");
      setWantPrintReceipt(true);
      setError(null);
      void api
        .get<
          { id: string; name: string; phone: string; creditBalance: string }[]
        >("/customers/accounts")
        .then((res) => setAccounts(res.data))
        .catch(() => setAccounts([]));
    }
  }, [open]);

  const searchHits = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return [];
    return items.filter((i) => i.name.toLowerCase().includes(s)).slice(0, 8);
  }, [items, search]);
  const cartItems = useMemo(
    () =>
      cartIds
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is ItemRow => item != null),
    [cartIds, items],
  );

  const itemsTotal = useMemo(() => {
    let t = 0;
    for (const [id, q] of Object.entries(lines)) {
      if (q <= 0) continue;
      const it = items.find((x) => x.id === id);
      if (it) {
        const unit = parseAmount(it.sellingPrice) ?? 0;
        t += unit * q;
      }
    }
    return t;
  }, [lines, items]);
  const otherChargesNum = Math.max(0, parseAmount(otherCharges) ?? 0);
  const gross = itemsTotal + otherChargesNum;
  const discountNum = Math.max(0, parseAmount(discount) ?? 0);
  const total = Math.max(0, gross - discountNum);

  const selectedAccount = useMemo(
    () => accounts.find((c) => c.id === accountId) ?? null,
    [accounts, accountId],
  );
  const accountMatch = useMemo(() => {
    if (customerKind === "account") return selectedAccount;
    const phone = custPhone.trim();
    if (!phone) return null;
    return accounts.find((c) => c.phone.trim() === phone) ?? null;
  }, [accounts, custPhone, customerKind, selectedAccount]);
  const accountBalance = parseAmount(accountMatch?.creditBalance) ?? 0;

  useEffect(() => {
    if (!open) return;
    if (payMethod === "ACCOUNT") {
      const cap = Math.min(total, Math.max(0, accountBalance));
      setAmountPaid(cap > 0 ? formatAmountInput(cap) : "");
      return;
    }
    setAmountPaid(
      total > 0 ? formatAmountInput(total) : gross > 0 ? "0" : "",
    );
  }, [open, total, gross, payMethod, accountBalance]);

  function rememberInCart(id: string) {
    setCartIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function addSearchedItem(id: string) {
    setQty(id, 1);
    setSearch("");
  }

  function removeLine(id: string) {
    forgetQtyDraft(id);
    setCartIds((ids) => ids.filter((itemId) => itemId !== id));
    setLines((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function forgetQtyDraft(id: string) {
    setQtyDraft((prev) => {
      if (!(id in prev)) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function setQty(id: string, delta: number) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const stock = parseAmount(it.quantity) ?? 0;
    const next = steppedQty(qtyDraft[id], lines[id] ?? 0, delta, stock);
    forgetQtyDraft(id);
    if (next > 0) {
      rememberInCart(id);
      setLines((prev) => ({ ...prev, [id]: next }));
      return;
    }
    setCartIds((ids) => ids.filter((itemId) => itemId !== id));
    setLines((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function setQtyValue(id: string, raw: string) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const draft = qtyDraftFromRaw(raw);
    if (draft == null) return;
    const stock = parseAmount(it.quantity) ?? 0;
    rememberInCart(id);
    setQtyDraft((prev) => ({ ...prev, [id]: draft }));
    setLines((prev) => ({ ...prev, [id]: qtyFromDraft(draft, stock) }));
  }

  function commitQty(id: string) {
    const it = items.find((i) => i.id === id);
    if (!it || !(id in qtyDraft)) return;
    const stock = parseAmount(it.quantity) ?? 0;
    const next = qtyFromDraft(qtyDraft[id], stock);
    forgetQtyDraft(id);
    if (next > 0) {
      setLines((prev) => ({ ...prev, [id]: next }));
      return;
    }
    setCartIds((ids) => ids.filter((itemId) => itemId !== id));
    setLines((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  const paidNum = parseAmount(amountPaid) ?? 0;
  const balance = paidNum - total;

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const orderItems = Object.entries(lines)
      .filter(([, q]) => q > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));
    if (!orderItems.length) {
      setError(t("orders.addOneLine"));
      return;
    }
    if (customerKind === "account" && !selectedAccount) {
      setError(t("orders.accountRequired"));
      return;
    }
    const paid = parseAmount(amountPaid);
    if (paid == null || paid < 0) {
      setError(t("orders.amountPaidInvalid"));
      return;
    }
    const charges = otherCharges.trim() === "" ? 0 : parseAmount(otherCharges);
    if (charges == null || charges < 0) {
      setError(t("orders.otherChargesInvalid"));
      return;
    }
    const discountAmount = discount.trim() === "" ? 0 : parseAmount(discount);
    if (discountAmount == null || discountAmount < 0) {
      setError(t("orders.discountInvalid"));
      return;
    }
    const payable = itemsTotal + charges;
    if (discountAmount > payable + 0.001) {
      setError(t("orders.discountTooHigh"));
      return;
    }
    const nextTotal = payable - discountAmount;
    if (
      customerKind === "name" &&
      paid + 0.001 < nextTotal &&
      !custPhone.trim()
    ) {
      setError(t("orders.phoneRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const sellingTo =
        customerKind === "account" && selectedAccount
          ? selectedAccount
          : { name: custName, phone: custPhone };
      const { data } = await api.post<OrderRow>("/orders", {
        customerName: sellingTo.name,
        customerPhone: sellingTo.phone,
        items: orderItems,
        paymentMethod: customerKind === "account" ? "ACCOUNT" : payMethod,
        amountPaid: paid,
        otherCharges: charges,
        discount: discountAmount,
      });
      onCreated(data, { autoPrint: wantPrintReceipt });
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "message" in err.response.data
          ? String((err.response.data as { message: unknown }).message)
          : t("orders.orderFailed");
      setError(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("orders.newOrderTitle")}</DialogTitle>
        </DialogHeader>
        {error && (
          <p className="mb-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={finish} className="space-y-4">
          <div>
            <Label>{t("orders.customerSection")}</Label>
            <Select
              value={customerKind}
              onValueChange={(v) => {
                if (v !== "name" && v !== "account") return;
                setCustomerKind(v);
                setAccountId("");
                setCustName("");
                setCustPhone("");
                setPayMethod(v === "account" ? "ACCOUNT" : "CASH");
              }}
            >
              <SelectTrigger className="mt-1 w-full rounded-xl">
                <SelectValue>
                  {customerKind === "account"
                    ? t("payment.ACCOUNT")
                    : t("orders.name")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t("orders.name")}</SelectItem>
                <SelectItem value="account">{t("payment.ACCOUNT")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {customerKind === "name" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("orders.name")}</Label>
                <Input
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label>{t("orders.phone")}</Label>
                <Input
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>
          ) : (
            <div>
              <Label>{t("orders.selectAccount")}</Label>
              <Select
                value={accountId}
                onValueChange={(v) => {
                  if (!v) return;
                  setAccountId(v);
                  const acc = accounts.find((c) => c.id === v);
                  if (!acc) return;
                  setCustName(acc.name);
                  setCustPhone(acc.phone);
                  setPayMethod("ACCOUNT");
                }}
              >
                <SelectTrigger className="mt-1 w-full rounded-xl">
                  <SelectValue placeholder={t("orders.selectAccount")}>
                    {selectedAccount
                      ? `${selectedAccount.name} · ${selectedAccount.phone}`
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {`${acc.name} · ${acc.phone} · ${money(acc.creditBalance)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-slate-500">
                {accounts.length === 0
                  ? t("customers.accountsEmptyTitle")
                  : selectedAccount
                    ? t("customers.accountHint", {
                        amount: money(selectedAccount.creditBalance),
                      })
                    : t("orders.payFromAccount")}
              </p>
            </div>
          )}
          <Input
            placeholder={t("orders.searchItems")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl"
          />
          {searchHits.length > 0 ? (
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-2">
              {searchHits.map((it) => (
                <div
                  key={it.id}
                  className="flex items-start justify-between gap-3 px-1 py-1"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      {money(it.sellingPrice)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t("orders.inStock", {
                        qty: `${it.quantity} ${it.unit}`,
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                    onClick={() => addSearchedItem(it.id)}
                  >
                    {t("orders.add")}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {cartItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                {t("orders.cartEmpty")}
              </p>
            ) : (
              cartItems.map((it) => {
                const q = lines[it.id] ?? 0;
                return (
                  <div
                    key={it.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{it.name}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-800">
                        {money(it.sellingPrice)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t("orders.inStock", {
                          qty: `${it.quantity} ${it.unit}`,
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7"
                        onClick={() => setQty(it.id, -QTY_STEP)}
                      >
                        −
                      </Button>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={qtyDraft[it.id] ?? formatQty(q)}
                        onChange={(e) => setQtyValue(it.id, e.target.value)}
                        onBlur={() => commitQty(it.id)}
                        className="h-8 w-20 rounded-lg text-center"
                        aria-label="Quantity"
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="h-7 w-7 bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={() => setQty(it.id, QTY_STEP)}
                      >
                        +
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                        aria-label={t("orders.removeItem")}
                        onClick={() => removeLine(it.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("orders.paymentMethod")}</Label>
              {customerKind === "account" ? (
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {t("payment.ACCOUNT")}
                </p>
              ) : (
                <Select
                  value={payMethod}
                  onValueChange={(v) => v && setPayMethod(v)}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {t(`payment.${code}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {payMethod === "ACCOUNT" && customerKind === "name" && (
                <p className="mt-1 text-xs text-slate-500">
                  {accountMatch
                    ? t("customers.accountHint", {
                        amount: money(accountBalance),
                      })
                    : t("customers.noAccount")}
                </p>
              )}
            </div>
            <div>
              <Label>{t("orders.otherCharges")}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={otherCharges}
                onChange={(e) => setOtherCharges(e.target.value)}
                placeholder="0.00"
                className="mt-1 appearance-none rounded-xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div>
              <Label>{t("orders.discount")}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
                className="mt-1 appearance-none rounded-xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div>
              <Label>{t("orders.amountPaid")}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                required
                className="mt-1 rounded-xl"
              />
            </div>
          </div>
          {discountNum > 0 ? (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-600">
                {t("orders.discount")}
              </span>
              <span className="font-medium text-slate-700">
                -{money(Math.min(discountNum, gross))}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-xl bg-blue-50 p-3">
            <span className="text-sm text-slate-600">
              {t("orders.totalLabel")}
            </span>
            <span className="font-bold text-blue-700">{money(total)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-orange-50 p-3">
            <span className="text-sm text-slate-600">
              {t("orders.balanceDue")}
            </span>
            <span className="font-bold text-orange-600">
              {money(Math.max(0, -balance))}
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={wantPrintReceipt}
              onChange={(e) => setWantPrintReceipt(e.target.checked)}
            />
            {t("orders.printReceiptAfter")}
          </label>
          <Button
            type="submit"
            disabled={submitting}
            className="btn-primary-gradient w-full rounded-xl text-white"
          >
            {submitting ? t("orders.processing") : t("orders.completeOrder")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditOrderDialog({
  order,
  items,
  onClose,
  onUpdated,
  t,
}: {
  order: OrderRow | null;
  items: ItemRow[];
  onClose: () => void;
  onUpdated: (order: OrderRow) => void | Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [lines, setLines] = useState<Record<string, number>>({});
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [otherChargesInput, setOtherChargesInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const paidSyncedToLoadedTotal = useRef(false);
  const paidForTotal = useRef<number | null>(null);

  const originalLinesById = useMemo(() => {
    const map = new Map<string, ReceiptOrder["orderItems"][number]>();
    if (!order) return map;
    for (const line of order.orderItems) {
      map.set(line.item.id, line);
    }
    return map;
  }, [order]);

  useEffect(() => {
    if (!order) return;
    const nextLines: Record<string, number> = {};
    const nextIds: string[] = [];
    for (const line of order.orderItems) {
      const item = items.find((candidate) => candidate.id === line.item.id);
      if (!item) continue;
      const quantity = parseAmount(line?.quantity) ?? 0;
      if (quantity > 0) {
        nextLines[item.id] = quantity;
        nextIds.push(item.id);
      }
    }
    setLines(nextLines);
    setQtyDraft({});
    setCartIds(nextIds);
    setSearch("");
    paidSyncedToLoadedTotal.current = false;
    paidForTotal.current = null;
    setAmountPaid(formatAmountInput(parseAmount(order.amountPaid) ?? 0));
    setOtherChargesInput(
      formatAmountInput(parseAmount(order.otherCharges) ?? 0),
    );
    setDiscountInput(formatAmountInput(parseAmount(order.discount) ?? 0));
    setCustomerName(order.customer.name);
    setPhone(order.customer.phone ?? "");
    setError(null);
  }, [items, order]);

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((item) => item.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, search]);
  const cartItems = useMemo(
    () =>
      cartIds
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is ItemRow => item != null),
    [cartIds, items],
  );

  function originalQuantity(id: string) {
    return parseAmount(originalLinesById.get(id)?.quantity) ?? 0;
  }

  function availableForOrder(item: ItemRow) {
    return (parseAmount(item.quantity) ?? 0) + originalQuantity(item.id);
  }

  function rememberInCart(id: string) {
    setCartIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }

  function forgetQtyDraft(id: string) {
    setQtyDraft((prev) => {
      if (!(id in prev)) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function setQty(id: string, delta: number) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    const nextQuantity = steppedQty(
      qtyDraft[id],
      lines[id] ?? 0,
      delta,
      availableForOrder(item),
    );
    forgetQtyDraft(id);
    if (nextQuantity > 0) {
      rememberInCart(id);
      setLines((current) => ({ ...current, [id]: nextQuantity }));
      return;
    }
    setCartIds((ids) => ids.filter((itemId) => itemId !== id));
    setLines((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function setQtyValue(id: string, raw: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    const draft = qtyDraftFromRaw(raw);
    if (draft == null) return;
    rememberInCart(id);
    setQtyDraft((prev) => ({ ...prev, [id]: draft }));
    setLines((current) => ({
      ...current,
      [id]: qtyFromDraft(draft, availableForOrder(item)),
    }));
  }

  function commitQty(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || !(id in qtyDraft)) return;
    const nextQuantity = qtyFromDraft(qtyDraft[id], availableForOrder(item));
    forgetQtyDraft(id);
    if (nextQuantity > 0) {
      setLines((current) => ({ ...current, [id]: nextQuantity }));
      return;
    }
    setCartIds((ids) => ids.filter((itemId) => itemId !== id));
    setLines((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  const itemsTotal = useMemo(
    () =>
      Object.entries(lines).reduce((sum, [id, quantity]) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item || quantity <= 0) return sum;
        const price =
          parseAmount(originalLinesById.get(id)?.unitSellPrice) ??
          parseAmount(item.sellingPrice) ??
          0;
        return sum + price * quantity;
      }, 0),
    [items, lines, originalLinesById],
  );
  const otherCharges = Math.max(0, parseAmount(otherChargesInput) ?? 0);
  const gross = itemsTotal + otherCharges;
  const discountAmount = Math.max(0, parseAmount(discountInput) ?? 0);
  const total = Math.max(0, gross - discountAmount);
  if (order) {
    const savedTotal = parseAmount(order.totalAmount) ?? 0;
    const savedPaid = parseAmount(order.amountPaid) ?? 0;
    if (!paidSyncedToLoadedTotal.current) {
      if (Math.abs(total - savedTotal) < 0.001) {
        paidSyncedToLoadedTotal.current = true;
        paidForTotal.current = total;
        const saved = formatAmountInput(savedPaid);
        if (amountPaid !== saved) setAmountPaid(saved);
      }
    } else if (
      paidForTotal.current == null ||
      Math.abs(paidForTotal.current - total) >= 0.001
    ) {
      paidForTotal.current = total;
      const nextPaid = formatAmountInput(total);
      if (amountPaid !== nextPaid) setAmountPaid(nextPaid);
    }
  }

  const paid = parseAmount(amountPaid) ?? 0;
  const balance = Math.max(0, total - paid);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setError(null);
    const orderItems = Object.entries(lines)
      .filter(([, quantity]) => quantity > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));
    if (!orderItems.length) {
      setError(t("orders.addOneLine"));
      return;
    }
    const paidAmount = parseAmount(amountPaid);
    if (paidAmount == null || paidAmount < 0) {
      setError(t("orders.amountPaidInvalid"));
      return;
    }
    const charges =
      otherChargesInput.trim() === "" ? 0 : parseAmount(otherChargesInput);
    if (charges == null || charges < 0) {
      setError(t("orders.otherChargesInvalid"));
      return;
    }
    const discountValue =
      discountInput.trim() === "" ? 0 : parseAmount(discountInput);
    if (discountValue == null || discountValue < 0) {
      setError(t("orders.discountInvalid"));
      return;
    }
    const payable = itemsTotal + charges;
    if (discountValue > payable + 0.001) {
      setError(t("orders.discountTooHigh"));
      return;
    }
    const nextTotal = payable - discountValue;
    if (!customerName.trim()) {
      setError(t("orders.name"));
      return;
    }
    if (paidAmount + 0.001 < nextTotal && !phone.trim()) {
      setError(t("orders.phoneRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.patch<OrderRow>(`/orders/${order.id}`, {
        items: orderItems,
        amountPaid: paidAmount,
        otherCharges: charges,
        discount: discountValue,
        customerName: customerName.trim(),
        ...(phone.trim() ? { customerPhone: phone.trim() } : {}),
      });
      await onUpdated(data);
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "message" in err.response.data
          ? String((err.response.data as { message: unknown }).message)
          : t("orders.updateOrderFailed");
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("orders.editOrder")}</DialogTitle>
        </DialogHeader>
        {order ? (
          <form onSubmit={submit} className="space-y-4">
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <Label htmlFor="edit-order-name" className="w-16 shrink-0">
                  {t("orders.name")}
                </Label>
                <Input
                  id="edit-order-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="rounded-xl bg-white"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="edit-order-phone" className="w-16 shrink-0">
                  {t("orders.phone")}
                </Label>
                <Input
                  id="edit-order-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required={balance > 0}
                  className="rounded-xl bg-white"
                />
              </div>
            </div>
            <Input
              placeholder={t("orders.searchItems")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl"
            />
            {searchHits.length > 0 ? (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {searchHits.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-1 py-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t("orders.stockLine", {
                          price: money(item.sellingPrice),
                          qty: `${item.quantity} ${item.unit}`,
                        })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                      onClick={() => {
                        setQty(item.id, 1);
                        setSearch("");
                      }}
                    >
                      {t("orders.add")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {cartItems.map((item) => {
                const quantity = lines[item.id] ?? 0;
                const price =
                  parseAmount(originalLinesById.get(item.id)?.unitSellPrice) ??
                  parseAmount(item.sellingPrice) ??
                  0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t("orders.stockLine", {
                          price: money(price),
                          qty: `${item.quantity} ${item.unit}`,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7"
                        onClick={() => setQty(item.id, -QTY_STEP)}
                      >
                        −
                      </Button>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={qtyDraft[item.id] ?? formatQty(quantity)}
                        onChange={(e) => setQtyValue(item.id, e.target.value)}
                        onBlur={() => commitQty(item.id)}
                        className="h-8 w-20 rounded-lg text-center"
                        aria-label="Quantity"
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="h-7 w-7 bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={() => setQty(item.id, QTY_STEP)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2 rounded-xl bg-blue-50 p-3 text-sm">
              <div>
                <Label className="text-slate-600">
                  {t("orders.otherCharges")}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={otherChargesInput}
                  onChange={(e) => setOtherChargesInput(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <Label className="text-slate-600">{t("orders.discount")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              {discountAmount > 0 ? (
                <div className="flex justify-between text-slate-600">
                  <span>{t("orders.discount")}</span>
                  <span>-{money(Math.min(discountAmount, gross))}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-blue-700">
                <span>{t("orders.totalLabel")}</span>
                <span>{money(total)}</span>
              </div>
              <div>
                <Label className="text-slate-600">
                  {t("orders.amountPaid")}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
              {balance > 0.001 ? (
                <div className="flex justify-between font-medium text-orange-600">
                  <span>{t("orders.balanceDue")}</span>
                  <span>{money(balance)}</span>
                </div>
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="btn-primary-gradient w-full rounded-xl text-white"
            >
              {submitting
                ? t("orders.updatingOrder")
                : t("orders.updateReceipt")}
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
