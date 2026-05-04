"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import { api } from "@/lib/api";
import { money, parseAmount } from "@/lib/format";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, ShoppingCart } from "lucide-react";

const PAYMENT_CODES = [
  "CASH",
  "MPESA",
  "AIRTEL_MONEY",
  "TIGO_PESA",
  "BANK",
] as const;

type ItemRow = {
  id: string;
  name: string;
  sellingPrice: string;
  quantity: string;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  receiptNumber?: string | null;
  totalAmount: string;
  amountPaid: string;
  balance: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  customer: { name: string; phone: string };
  orderItems: ReceiptOrder["orderItems"];
};

export default function OrdersPage() {
  const { t } = useI18n();
  const { query } = useSearch();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptOrder | null>(null);
  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false);

  const loadOrders = useCallback(async () => {
    const { data } = await api.get<OrderRow[]>("/orders");
    return data;
  }, []);

  const { data: orders, error, loading, refetch } = useAsyncData(
    loadOrders,
    [loadOrders],
  );

  const loadItems = useCallback(async () => {
    const { data } = await api.get<ItemRow[]>("/items");
    setItems(
      data.map((i) => {
        const sp = parseAmount(i.sellingPrice);
        return {
          id: i.id,
          name: i.name,
          sellingPrice: sp != null ? sp.toFixed(2) : "0.00",
          quantity: String((i as unknown as { quantity?: unknown }).quantity ?? "0"),
        };
      }),
    );
  }, []);

  useEffect(() => {
    if (createOpen) loadItems();
  }, [createOpen, loadItems]);

  const orderList = useMemo(() => orders ?? [], [orders]);
  const q = query.trim().toLowerCase();
  const orderFiltered = useMemo(() => {
    if (!q) return orderList;
    return orderList.filter((o) => {
      const num = o.orderNumber.toLowerCase();
      const cust = o.customer.name.toLowerCase();
      const phone = o.customer.phone.toLowerCase();
      const method = o.paymentMethod.toLowerCase();
      return (
        num.includes(q) ||
        cust.includes(q) ||
        phone.includes(q) ||
        method.includes(q) ||
        o.status.toLowerCase().includes(q)
      );
    });
  }, [orderList, q]);

  if (loading && !orders) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("orders.title")}</h1>
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
        <h1 className="text-2xl font-bold text-slate-800">{t("orders.title")}</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("orders.title")}</h1>
        <Button
          className="btn-primary-gradient rounded-xl text-white"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("orders.new")}
        </Button>
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
            {orderFiltered.map((o) => (
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
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => {
                      setReceiptAutoPrint(false);
                      setReceipt({
                        orderNumber: o.orderNumber,
                        receiptNumber: o.receiptNumber,
                        createdAt: o.createdAt,
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
            totalAmount: created.totalAmount,
            amountPaid: created.amountPaid,
            balance: created.balance,
            paymentMethod: created.paymentMethod,
            customer: created.customer,
            orderItems: created.orderItems,
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
  const { query: globalQuery } = useSearch();
  const [step, setStep] = useState(1);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [lines, setLines] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [payMethod, setPayMethod] = useState<string>("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [wantPrintReceipt, setWantPrintReceipt] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setCustName("");
      setCustPhone("");
      setLines({});
      setSearch("");
      setPayMethod("CASH");
      setAmountPaid("");
      setWantPrintReceipt(true);
      setError(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const g = globalQuery.trim().toLowerCase();
    const s = search.trim().toLowerCase();
    return items.filter((i) => {
      const name = i.name.toLowerCase();
      if (g && !name.includes(g)) return false;
      if (s && !name.includes(s)) return false;
      return true;
    });
  }, [items, search, globalQuery]);

  const total = useMemo(() => {
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

  useEffect(() => {
    if (step === 3 && total > 0 && !amountPaid) {
      setAmountPaid(total.toFixed(2));
    }
  }, [step, total, amountPaid]);

  function setQty(id: string, delta: number) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const stock = parseAmount(it.quantity) ?? 0;
    setLines((prev) => {
      const cur = prev[id] ?? 0;
      const next = Math.max(0, Math.min(stock, cur + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  function setQtyValue(id: string, raw: string) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const stock = parseAmount(it.quantity) ?? 0;
    const v = parseFloat(String(raw).replace(",", "."));
    const next = Number.isFinite(v) ? Math.max(0, Math.min(stock, v)) : 0;
    setLines((prev) => {
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
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
    const paid = parseAmount(amountPaid);
    if (paid == null || paid < 0) {
      setError(t("orders.amountPaidInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post<OrderRow>("/orders", {
        customerName: custName,
        customerPhone: custPhone,
        items: orderItems,
        paymentMethod: payMethod,
        amountPaid: paid,
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
        <div className="mb-4 flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  step >= n
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {n}
              </div>
              {n < 3 && <div className="h-0.5 w-8 bg-slate-200" />}
            </div>
          ))}
        </div>
        {error && (
          <p className="mb-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700">
              {t("orders.customerSection")}
            </h3>
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
                required
                className="mt-1 rounded-xl"
              />
            </div>
            <Button
              type="button"
              className="btn-primary-gradient w-full rounded-xl text-white"
              onClick={() => custName && custPhone && setStep(2)}
              disabled={!custName || !custPhone}
            >
              {t("orders.nextItems")}
            </Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700">
              {t("orders.lineItemsSection")}
            </h3>
            <Input
              placeholder={t("orders.searchItems")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl"
            />
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {filtered.map((it) => {
                const q = lines[it.id] ?? 0;
                const stock = parseAmount(it.quantity) ?? 0;
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{it.name}</p>
                      <p className="text-xs text-slate-500">
                        {t("orders.stockLine", {
                          price: money(it.sellingPrice),
                          qty: it.quantity,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7"
                        onClick={() => setQty(it.id, -1)}
                      >
                        −
                      </Button>
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        max={stock}
                        value={q === 0 ? "" : String(q)}
                        onChange={(e) => setQtyValue(it.id, e.target.value)}
                        className="h-8 w-20 rounded-lg text-center"
                        aria-label="Quantity"
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="h-7 w-7 bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={() => setQty(it.id, 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-blue-50 p-3">
              <span className="text-sm text-slate-600">{t("orders.totalLabel")}</span>
              <span className="font-bold text-blue-700">{money(total)}</span>
            </div>
            <Button
              type="button"
              className="btn-primary-gradient w-full rounded-xl text-white"
              disabled={total <= 0}
              onClick={() => setStep(3)}
            >
              {t("orders.nextCheckout")}
            </Button>
          </div>
        )}
        {step === 3 && (
          <form onSubmit={finish} className="space-y-4">
            <h3 className="font-semibold text-slate-700">
              {t("orders.checkoutSection")}
            </h3>
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("orders.totalLabel")}</span>
                <span className="font-bold">{money(total)}</span>
              </div>
            </div>
            <div>
              <Label>{t("orders.paymentMethod")}</Label>
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
            <div className="flex items-center justify-between rounded-xl bg-orange-50 p-3">
              <span className="text-sm text-slate-600">{t("orders.balanceDue")}</span>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
