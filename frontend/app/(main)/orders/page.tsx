"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { money, parseAmount, paymentLabel } from "@/lib/format";
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

const PAYMENT = [
  { v: "CASH", l: "Cash" },
  { v: "MPESA", l: "M-Pesa" },
  { v: "AIRTEL_MONEY", l: "Airtel Money" },
  { v: "TIGO_PESA", l: "Tigo Pesa" },
  { v: "BANK", l: "Bank" },
] as const;

type ItemRow = {
  id: string;
  name: string;
  sellingPrice: string;
  quantity: number;
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
          quantity: i.quantity,
        };
      }),
    );
  }, []);

  useEffect(() => {
    if (createOpen) loadItems();
  }, [createOpen, loadItems]);

  if (loading && !orders) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
        <PageLoading label="Loading orders…" />
        <div className="glass overflow-hidden rounded-2xl">
          <TableSkeletonRows rows={6} />
        </div>
      </div>
    );
  }

  if (error && !orders) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const orderList = orders ?? [];

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
        <Button
          className="btn-primary-gradient rounded-xl text-white"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New order
        </Button>
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="text-xs uppercase text-slate-500">
                Order
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Customer
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Total
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Paid
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Balance
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Method
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Status
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderList.map((o) => (
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
                <TableCell>{paymentLabel(o.paymentMethod)}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      o.status === "COMPLETED"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    {o.status === "COMPLETED" ? "Paid" : "Pending"}
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
                    Receipt
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
              title="No orders yet"
              description="When you sell stock, create an order here to deduct inventory and record payment."
            />
          </div>
        )}
      </div>

      <CreateOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        items={items}
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
}: {
  open: boolean;
  onClose: () => void;
  items: ItemRow[];
  onCreated: (o: OrderRow, opts?: { autoPrint?: boolean }) => void;
}) {
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
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

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
    setLines((prev) => {
      const cur = prev[id] ?? 0;
      const next = Math.max(0, Math.min(it.quantity, cur + delta));
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
      setError("Add at least one line item");
      return;
    }
    const paid = parseAmount(amountPaid);
    if (paid == null || paid < 0) {
      setError("Amount paid must be a valid number.");
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
          : "Order failed";
      setError(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
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
            <h3 className="font-semibold text-slate-700">Customer</h3>
            <div>
              <Label>Name</Label>
              <Input
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                required
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label>Phone</Label>
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
              Next: items
            </Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700">Line items</h3>
            <Input
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl"
            />
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {filtered.map((it) => {
                const q = lines[it.id] ?? 0;
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{it.name}</p>
                      <p className="text-xs text-slate-500">
                        {money(it.sellingPrice)} each · {it.quantity} in stock
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
                      <span className="w-6 text-center text-sm font-medium">
                        {q}
                      </span>
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
              <span className="text-sm text-slate-600">Total</span>
              <span className="font-bold text-blue-700">{money(total)}</span>
            </div>
            <Button
              type="button"
              className="btn-primary-gradient w-full rounded-xl text-white"
              disabled={total <= 0}
              onClick={() => setStep(3)}
            >
              Next: checkout
            </Button>
          </div>
        )}
        {step === 3 && (
          <form onSubmit={finish} className="space-y-4">
            <h3 className="font-semibold text-slate-700">Checkout</h3>
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total</span>
                <span className="font-bold">{money(total)}</span>
              </div>
            </div>
            <div>
              <Label>Payment method</Label>
              <Select
                value={payMethod}
                onValueChange={(v) => v && setPayMethod(v)}
              >
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT.map((p) => (
                    <SelectItem key={p.v} value={p.v}>
                      {p.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount paid</Label>
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
              <span className="text-sm text-slate-600">Balance due</span>
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
              Offer customer receipt (browser print — 60mm layout in Settings)
            </label>
            <Button
              type="submit"
              disabled={submitting}
              className="btn-primary-gradient w-full rounded-xl text-white"
            >
              {submitting ? "Processing…" : "Complete order"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
