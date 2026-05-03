"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money, paymentLabel } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAsyncData } from "@/hooks/use-async-data";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
import { TableSkeletonRows } from "@/components/table-skeleton";
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
import { Users } from "lucide-react";

const PAYMENT = [
  { v: "CASH", l: "Cash" },
  { v: "MPESA", l: "M-Pesa" },
  { v: "AIRTEL_MONEY", l: "Airtel Money" },
  { v: "TIGO_PESA", l: "Tigo Pesa" },
  { v: "BANK", l: "Bank" },
] as const;

type Debt = {
  id: string;
  amount: string;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  order: {
    orderNumber: string;
    payments: { createdAt: string; amount: string }[];
  };
};

export default function CustomersPage() {
  const load = useCallback(async () => {
    const { data } = await api.get<Debt[]>("/debts");
    return data;
  }, []);

  const { data: debts, error, loading, refetch } = useAsyncData(load, [load]);

  const [payDebt, setPayDebt] = useState<Debt | null>(null);

  if (loading && !debts) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">
          Customers (debtors)
        </h1>
        <PageLoading label="Loading balances…" />
        <div className="glass overflow-hidden rounded-2xl">
          <TableSkeletonRows rows={5} />
        </div>
      </div>
    );
  }

  if (error && !debts) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">
          Customers (debtors)
        </h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const list = debts ?? [];

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <h1 className="text-2xl font-bold text-slate-800">
        Customers (debtors)
      </h1>
      <div className="glass overflow-hidden rounded-2xl">
        {list.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No outstanding debt"
              description="When a customer underpays an order, the balance appears here so you can record payments later."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs uppercase text-slate-500">
                  Name
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500">
                  Phone
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500">
                  Owed
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500">
                  Order
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((d) => {
                const lastPay = d.order.payments[0]?.createdAt;
                return (
                  <TableRow key={d.id} className="border-slate-100">
                    <TableCell className="font-medium">
                      {d.customer.name}
                    </TableCell>
                    <TableCell>{d.customer.phone}</TableCell>
                    <TableCell className="font-semibold text-red-600">
                      {money(d.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      #{d.order.orderNumber}
                      {lastPay && (
                        <span className="block text-xs text-slate-400">
                          Last payment{" "}
                          {new Date(lastPay).toLocaleDateString()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-lg bg-green-100 text-green-800 hover:bg-green-200"
                        onClick={() => setPayDebt(d)}
                      >
                        Record payment
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <PayDebtDialog
        debt={payDebt}
        onClose={() => setPayDebt(null)}
        onPaid={() => {
          setPayDebt(null);
          void refetch();
        }}
      />
    </div>
  );
}

function PayDebtDialog({
  debt,
  onClose,
  onPaid,
}: {
  debt: Debt | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (debt) {
      setAmount(debt.amount);
      setMethod("CASH");
      setErr(null);
    }
  }, [debt]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!debt) return;
    setLoading(true);
    setErr(null);
    try {
      await api.post(`/debts/${debt.id}/pay`, {
        amount: Number(amount),
        paymentMethod: method,
      });
      onPaid();
    } catch (error: unknown) {
      setErr(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!debt} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass rounded-2xl">
        <DialogHeader>
          <DialogTitle>Payment for {debt?.customer.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div>
            <Label>Amount (full balance or partial)</Label>
            <Input
              type="number"
              step="0.01"
              min={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label>Method</Label>
            <Select
              value={method}
              onValueChange={(v) => v && setMethod(v)}
            >
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT.map((p) => (
                  <SelectItem key={p.v} value={p.v}>
                    {paymentLabel(p.v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="btn-primary-gradient w-full rounded-xl text-white"
          >
            {loading ? "Saving…" : "Apply payment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
