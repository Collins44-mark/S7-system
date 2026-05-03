"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
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

const PAYMENT_CODES = [
  "CASH",
  "MPESA",
  "AIRTEL_MONEY",
  "TIGO_PESA",
  "BANK",
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
  const { t } = useI18n();
  const { query } = useSearch();
  const load = useCallback(async () => {
    const { data } = await api.get<Debt[]>("/debts");
    return data;
  }, []);

  const { data: debts, error, loading, refetch } = useAsyncData(load, [load]);

  const [payDebt, setPayDebt] = useState<Debt | null>(null);

  const list = useMemo(() => debts ?? [], [debts]);
  const qDebt = query.trim().toLowerCase();
  const filteredDebts = useMemo(() => {
    if (!qDebt) return list;
    return list.filter((d) => {
      const name = d.customer.name.toLowerCase();
      const phone = d.customer.phone.toLowerCase();
      const order = d.order.orderNumber.toLowerCase();
      return name.includes(qDebt) || phone.includes(qDebt) || order.includes(qDebt);
    });
  }, [list, qDebt]);

  if (loading && !debts) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("customers.title")}</h1>
        <PageLoading label={t("customers.loading")} />
        <div className="glass overflow-hidden rounded-2xl">
          <TableSkeletonRows rows={5} />
        </div>
      </div>
    );
  }

  if (error && !debts) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("customers.title")}</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <h1 className="text-2xl font-bold text-slate-800">{t("customers.title")}</h1>
      <div className="glass overflow-hidden rounded-2xl">
        {list.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title={t("customers.emptyTitle")}
              description={t("customers.emptyDesc")}
            />
          </div>
        ) : filteredDebts.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-600">
            {t("dashboard.noSearchResults")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-xs uppercase text-slate-500">
                  {t("customers.col.name")}
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500">
                  {t("customers.col.phone")}
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500">
                  {t("customers.col.owed")}
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500">
                  {t("customers.col.order")}
                </TableHead>
                <TableHead className="text-xs uppercase text-slate-500">
                  {t("customers.col.action")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDebts.map((d) => {
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
                          {t("customers.lastPayment")}{" "}
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
                        {t("customers.recordPay")}
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
        t={t}
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
  t,
  onClose,
  onPaid,
}: {
  debt: Debt | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
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
          <DialogTitle>
            {debt
              ? t("customers.paymentTitle", { name: debt.customer.name })
              : ""}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div>
            <Label>{t("customers.amountLabel")}</Label>
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
            <Label>{t("customers.method")}</Label>
            <Select
              value={method}
              onValueChange={(v) => v && setMethod(v)}
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
          <Button
            type="submit"
            disabled={loading}
            className="btn-primary-gradient w-full rounded-xl text-white"
          >
            {loading ? t("customers.savingPayment") : t("customers.applyPayment")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
