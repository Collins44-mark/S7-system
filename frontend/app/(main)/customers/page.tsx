"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import { api } from "@/lib/api";
import { money, parseAmount } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Users, Wallet } from "lucide-react";

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
  status: string;
  createdAt: string;
  settledAt: string | null;
  customer: { id: string; name: string; phone: string };
  order: {
    orderNumber: string;
    receiptNumber?: string | null;
    totalAmount?: string;
    payments: { createdAt: string; amount: string }[];
  };
};

type DatePreset = "all" | "today" | "week" | "month" | "year" | "custom";

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function shortReceipt(value?: string | null) {
  if (!value) return "—";
  const match = value.trim().match(/^RCT-0*(\d+)$/i);
  if (!match) return value;
  return `RCT-${match[1].padStart(3, "0")}`;
}

function matchesDate(
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
  if (from && d < new Date(`${from}T00:00:00`)) return false;
  if (to && d > new Date(`${to}T23:59:59.999`)) return false;
  return true;
}

function isPaidOff(d: Debt) {
  return d.status === "SETTLED" || Number(d.amount) <= 0;
}

function activityAt(d: Debt) {
  const stamps = [
    d.createdAt,
    d.settledAt,
    d.order.payments[0]?.createdAt,
  ].filter((v): v is string => Boolean(v));
  return stamps.reduce((latest, next) =>
    new Date(next) > new Date(latest) ? next : latest,
  );
}

type PaymentRow = {
  id: string;
  amount: string;
  method: string;
  note: string | null;
  createdAt: string;
};

type AccountCustomer = {
  id: string;
  name: string;
  phone: string;
  creditBalance: string;
};

type AccountEntry = {
  id: string;
  amount: string;
  balanceAfter: string;
  kind: string;
  method: string | null;
  note: string | null;
  createdAt: string;
};

type PaidResult = {
  debt: {
    customer: { name: string; phone: string };
    order: {
      orderNumber: string;
      receiptNumber?: string | null;
      totalAmount: string;
      amountPaid: string;
      balance: string;
    };
  };
  payment: { method: string; createdAt: string };
};

export default function CustomersPage() {
  const { t } = useI18n();
  const { query } = useSearch();
  const load = useCallback(async () => {
    const { data } = await api.get<Debt[]>("/debts");
    return data;
  }, []);

  const { data: debts, error, loading, refetch } = useAsyncData(load, [load]);

  const loadAccounts = useCallback(async () => {
    const { data } = await api.get<AccountCustomer[]>("/customers/accounts");
    return data;
  }, []);
  const {
    data: accounts,
    error: accountsError,
    loading: accountsLoading,
    refetch: refetchAccounts,
  } = useAsyncData(loadAccounts, [loadAccounts]);

  const [tab, setTab] = useState<"debtors" | "accounts">("debtors");
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [historyDebt, setHistoryDebt] = useState<Debt | null>(null);
  const [history, setHistory] = useState<PaymentRow[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [debtReceipt, setDebtReceipt] = useState<ReceiptOrder | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositCustomer, setDepositCustomer] = useState<AccountCustomer | null>(
    null,
  );
  const [accountHistoryFor, setAccountHistoryFor] = useState<AccountCustomer | null>(
    null,
  );
  const [accountHistory, setAccountHistory] = useState<AccountEntry[] | null>(null);
  const [accountHistoryError, setAccountHistoryError] = useState<string | null>(
    null,
  );
  const [receiptsFor, setReceiptsFor] = useState<AccountCustomer | null>(null);
  const [receipts, setReceipts] = useState<ReceiptOrder[] | null>(null);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const [saleReceipt, setSaleReceipt] = useState<ReceiptOrder | null>(null);

  async function openHistory(d: Debt) {
    setHistoryDebt(d);
    setHistory(null);
    setHistoryError(null);
    try {
      const { data } = await api.get<PaymentRow[]>(`/debts/${d.id}/payments`);
      setHistory(data);
    } catch (err: unknown) {
      setHistoryError(getApiErrorMessage(err));
      setHistory([]);
    }
  }

  const list = useMemo(() => debts ?? [], [debts]);
  const qDebt = query.trim().toLowerCase();
  const filteredDebts = useMemo(() => {
    return list.filter((d) => {
      if (!matchesDate(activityAt(d), datePreset, dateFrom, dateTo)) return false;
      if (!qDebt) return true;
      const name = d.customer.name.toLowerCase();
      const phone = (d.customer.phone ?? "").toLowerCase();
      const receipt = (d.order.receiptNumber ?? "").toLowerCase();
      return (
        name.includes(qDebt) ||
        phone.includes(qDebt) ||
        receipt.includes(qDebt) ||
        shortReceipt(d.order.receiptNumber).toLowerCase().includes(qDebt)
      );
    });
  }, [list, qDebt, datePreset, dateFrom, dateTo]);

  const debtorsTotal = useMemo(
    () =>
      filteredDebts.reduce((sum, debt) => {
        if (isPaidOff(debt)) return sum;
        return sum + (parseAmount(debt.amount) ?? 0);
      }, 0),
    [filteredDebts],
  );
  const accountList = useMemo(() => accounts ?? [], [accounts]);
  const filteredAccounts = useMemo(() => {
    if (!qDebt) return accountList;
    return accountList.filter((c) => {
      const name = c.name.toLowerCase();
      const phone = (c.phone ?? "").toLowerCase();
      return name.includes(qDebt) || phone.includes(qDebt);
    });
  }, [accountList, qDebt]);
  const accountsTotal = useMemo(
    () =>
      filteredAccounts.reduce(
        (sum, customer) => sum + (parseAmount(customer.creditBalance) ?? 0),
        0,
      ),
    [filteredAccounts],
  );

  const pageSizes = [10, 40, 70, 100] as const;
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [qDebt, datePreset, dateFrom, dateTo, pageSize, tab]);

  const activeRows = tab === "accounts" ? filteredAccounts : filteredDebts;
  const pageCount = Math.max(1, Math.ceil(activeRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDebts.slice(start, start + pageSize);
  }, [filteredDebts, currentPage, pageSize]);
  const accountPageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAccounts.slice(start, start + pageSize);
  }, [filteredAccounts, currentPage, pageSize]);
  const rangeFrom = activeRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = Math.min(currentPage * pageSize, activeRows.length);

  async function openReceipts(customer: AccountCustomer) {
    setReceiptsFor(customer);
    setReceipts(null);
    setReceiptsError(null);
    try {
      const { data } = await api.get<ReceiptOrder[]>(
        `/customers/${customer.id}/receipts`,
      );
      setReceipts(data);
    } catch (err: unknown) {
      setReceiptsError(getApiErrorMessage(err));
      setReceipts([]);
    }
  }

  async function openAccountHistory(customer: AccountCustomer) {
    setAccountHistoryFor(customer);
    setAccountHistory(null);
    setAccountHistoryError(null);
    try {
      const { data } = await api.get<AccountEntry[]>(
        `/customers/${customer.id}/account`,
      );
      setAccountHistory(data);
    } catch (err: unknown) {
      setAccountHistoryError(getApiErrorMessage(err));
      setAccountHistory([]);
    }
  }

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
      {accountsError && (
        <ErrorBanner message={accountsError} onRetry={() => refetchAccounts()} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-slate-800">{t("customers.title")}</h1>
          <div className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
            <button
              type="button"
              onClick={() => setTab("debtors")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === "debtors"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t("customers.tab.debtors")}
            </button>
            <button
              type="button"
              onClick={() => setTab("accounts")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === "accounts"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t("customers.tab.accounts")}
            </button>
          </div>
        </div>
        {tab === "accounts" ? (
          <Button
            type="button"
            className="btn-primary-gradient rounded-xl text-white"
            onClick={() => {
              setDepositCustomer(null);
              setDepositOpen(true);
            }}
          >
            {t("customers.addMoney")}
          </Button>
        ) : (
        <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
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
                <SelectItem value="custom">{t("orders.filter.custom")}</SelectItem>
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
        </div>
        )}
      </div>
      {tab === "debtors" ? (
        <div className="glass card-hover max-w-sm rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            {t("customers.debtorsTotal")}
          </span>
          <p className="mt-2 text-2xl font-bold text-red-600">{money(debtorsTotal)}</p>
          <p className="mt-1 text-xs text-slate-500">{t("customers.debtorsTotalHint")}</p>
        </div>
      ) : (
        <div className="glass card-hover max-w-sm rounded-2xl p-5">
          <span className="text-xs font-medium uppercase text-slate-500">
            {t("customers.accountsTotal")}
          </span>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{money(accountsTotal)}</p>
          <p className="mt-1 text-xs text-slate-500">{t("customers.accountsTotalHint")}</p>
        </div>
      )}
      <div className="glass overflow-hidden rounded-2xl">
        {tab === "accounts" ? (
          accountsLoading && !accounts ? (
            <div className="p-6">
              <PageLoading label={t("customers.loading")} />
            </div>
          ) : accountList.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Wallet}
                title={t("customers.accountsEmptyTitle")}
                description={t("customers.accountsEmptyDesc")}
              />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-600">
              {t("dashboard.noSearchResults")}
            </div>
          ) : (
            <>
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
                      {t("customers.col.balance")}
                    </TableHead>
                    <TableHead className="text-xs uppercase text-slate-500">
                      {t("customers.col.action")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountPageRows.map((c) => (
                    <TableRow key={c.id} className="border-slate-100">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell className="font-semibold text-emerald-700">
                        {money(c.creditBalance)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100">
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setDepositCustomer(c);
                                setDepositOpen(true);
                              }}
                            >
                              {t("customers.addMoney")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void openAccountHistory(c)}>
                              {t("customers.accountHistory")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void openReceipts(c)}>
                              {t("customers.viewReceipts")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {t("inventory.showing", {
                    from: rangeFrom,
                    to: rangeTo,
                    total: filteredAccounts.length,
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
                  <Button type="button" variant="secondary" size="sm" className="rounded-xl" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    {t("inventory.prev")}
                  </Button>
                  <span className="text-xs text-slate-600">
                    {t("inventory.pageOf", { page: currentPage, pages: pageCount })}
                  </span>
                  <Button type="button" variant="secondary" size="sm" className="rounded-xl" disabled={currentPage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                    {t("inventory.next")}
                  </Button>
                </div>
              </div>
            </>
          )
        ) : list.length === 0 ? (
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
          <>
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
              {pageRows.map((d) => {
                const lastPay = d.order.payments[0]?.createdAt;
                const paidOff = isPaidOff(d);
                return (
                  <TableRow key={d.id} className="border-slate-100">
                    <TableCell className="font-medium">
                      {d.customer.name}
                    </TableCell>
                    <TableCell>{d.customer.phone}</TableCell>
                    <TableCell
                      className={
                        paidOff
                          ? "font-semibold text-emerald-600"
                          : "font-semibold text-red-600"
                      }
                    >
                      {paidOff ? t("customers.paid") : money(d.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {shortReceipt(d.order.receiptNumber)}
                      {lastPay && (
                        <span className="block text-xs text-slate-400">
                          {t("customers.lastPayment")}{" "}
                          {new Date(lastPay).toLocaleDateString()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100">
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!paidOff && (
                            <DropdownMenuItem onClick={() => setPayDebt(d)}>
                              {t("customers.recordPay")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => void openHistory(d)}>
                            {t("customers.viewHistory")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredDebts.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {t("inventory.showing", {
                  from: rangeFrom,
                  to: rangeTo,
                  total: filteredDebts.length,
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
          )}
          </>
        )}
      </div>

      <PayDebtDialog
        debt={payDebt}
        t={t}
        onClose={() => setPayDebt(null)}
        onPaid={(result) => {
          setPayDebt(null);
          void refetch();
          setDebtReceipt({
            kind: "debt",
            orderNumber: result.debt.order.orderNumber,
            receiptNumber: result.debt.order.receiptNumber,
            createdAt: result.payment.createdAt,
            totalAmount: String(result.debt.order.totalAmount),
            amountPaid: String(result.debt.order.amountPaid),
            balance: String(result.debt.order.balance),
            paymentMethod: result.payment.method,
            customer: {
              name: result.debt.customer.name,
              phone: result.debt.customer.phone,
            },
            orderItems: [],
          });
        }}
      />

      <Dialog
        open={!!historyDebt}
        onOpenChange={(v) => {
          if (!v) setHistoryDebt(null);
        }}
      >
        <DialogContent className="glass max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("customers.historyTitle")}</DialogTitle>
            {historyDebt?.order.totalAmount != null && (
              <p className="text-sm text-slate-600">
                {t("customers.originalAmount")}{" "}
                <span className="font-semibold text-slate-800">
                  {money(historyDebt.order.totalAmount)}
                </span>
              </p>
            )}
          </DialogHeader>
          {historyError && (
            <p className="text-sm text-red-600">{historyError}</p>
          )}
          {history == null && !historyError && (
            <p className="text-sm text-slate-500">{t("common.loading")}</p>
          )}
          {history && history.length === 0 && (
            <p className="text-sm text-slate-600">{t("customers.historyEmpty")}</p>
          )}
          {history && history.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {history.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {new Date(p.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.note === "Debt payment"
                        ? t("customers.historyDebt")
                        : t("customers.historySale")}
                      {" · "}
                      {t(`payment.${p.method}`)}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-800">
                    {money(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DepositDialog
        open={depositOpen}
        customer={depositCustomer}
        accounts={accountList}
        t={t}
        onClose={() => {
          setDepositOpen(false);
          setDepositCustomer(null);
        }}
        onSaved={() => {
          setDepositOpen(false);
          setDepositCustomer(null);
          void refetchAccounts();
        }}
      />

      <Dialog
        open={!!accountHistoryFor}
        onOpenChange={(v) => {
          if (!v) setAccountHistoryFor(null);
        }}
      >
        <DialogContent className="glass max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("customers.accountHistory")}</DialogTitle>
            {accountHistoryFor && (
              <p className="text-sm text-slate-600">
                {accountHistoryFor.name} · {money(accountHistoryFor.creditBalance)}
              </p>
            )}
          </DialogHeader>
          {accountHistoryError && (
            <p className="text-sm text-red-600">{accountHistoryError}</p>
          )}
          {accountHistory == null && !accountHistoryError && (
            <p className="text-sm text-slate-500">{t("common.loading")}</p>
          )}
          {accountHistory && accountHistory.length === 0 && (
            <p className="text-sm text-slate-600">{t("customers.historyEmpty")}</p>
          )}
          {accountHistory && accountHistory.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {accountHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.kind === "DEPOSIT"
                          ? t("customers.accountDeposit")
                          : t("customers.accountPurchase")}
                        {entry.method ? ` · ${t(`payment.${entry.method}`)}` : ""}
                      </p>
                    </div>
                    <span
                      className={
                        entry.kind === "DEPOSIT"
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-slate-800"
                      }
                    >
                      {money(entry.amount)}
                    </span>
                  </div>
                  {entry.note ? (
                    <p className="mt-1 text-xs text-slate-500">{entry.note}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {t("customers.balanceAfter")} {money(entry.balanceAfter)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!receiptsFor}
        onOpenChange={(v) => {
          if (!v) setReceiptsFor(null);
        }}
      >
        <DialogContent className="glass max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("customers.receiptsTitle")}</DialogTitle>
            {receiptsFor && (
              <p className="text-sm text-slate-500">
                {receiptsFor.name} · {receiptsFor.phone}
              </p>
            )}
          </DialogHeader>
          {receiptsError && <p className="text-sm text-red-600">{receiptsError}</p>}
          {receipts == null && !receiptsError && (
            <PageLoading label={t("customers.loading")} />
          )}
          {receipts && receipts.length === 0 && (
            <p className="text-sm text-slate-500">{t("customers.receiptsEmpty")}</p>
          )}
          {receipts && receipts.length > 0 && (
            <div className="space-y-2">
              {receipts.map((order) => (
                <button
                  key={order.orderNumber + (order.receiptNumber ?? "")}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    setSaleReceipt(order);
                    setReceiptsFor(null);
                  }}
                >
                  <span className="font-medium text-slate-800">
                    {order.receiptNumber
                      ? shortReceipt(order.receiptNumber)
                      : order.orderNumber}
                  </span>
                  <span className="text-sm text-slate-500">
                    {money(order.totalAmount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReceiptDialog
        order={saleReceipt}
        open={!!saleReceipt}
        onClose={() => setSaleReceipt(null)}
      />

      <ReceiptDialog
        order={debtReceipt}
        open={!!debtReceipt}
        autoPrint
        onClose={() => setDebtReceipt(null)}
      />
    </div>
  );
}

function DepositDialog({
  open,
  customer,
  accounts,
  t,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer: AccountCustomer | null;
  accounts: AccountCustomer[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const selected = accounts.find((c) => c.id === accountId) ?? null;

  useEffect(() => {
    if (!open) return;
    setMode(customer ? "existing" : accounts.length > 0 ? "existing" : "new");
    setAccountId(customer?.id ?? "");
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setAmount("");
    setMethod("CASH");
    setNote("");
    setErr(null);
  }, [open, customer, accounts.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "existing" && !selected) {
      setErr(t("orders.accountRequired"));
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const person = mode === "existing" && selected ? selected : null;
      await api.post("/customers/deposit", {
        customerId: person?.id,
        name: person ? person.name : name.trim(),
        phone: person ? person.phone : phone.trim(),
        amount: Number(amount),
        method,
        note: note.trim() || undefined,
      });
      onSaved();
    } catch (error: unknown) {
      setErr(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("customers.addMoneyTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div>
            <Label>{t("orders.customerSection")}</Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                if (v !== "existing" && v !== "new") return;
                setMode(v);
                if (v === "new") setAccountId("");
              }}
            >
              <SelectTrigger className="mt-1 w-full rounded-xl">
                <SelectValue>
                  {mode === "existing"
                    ? t("customers.existingAccount")
                    : t("customers.newAccount")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">{t("customers.existingAccount")}</SelectItem>
                <SelectItem value="new">{t("customers.newAccount")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "existing" ? (
            <div>
              <Label>{t("orders.selectAccount")}</Label>
              <Select
                value={accountId}
                onValueChange={(v) => {
                  if (!v) return;
                  setAccountId(v);
                }}
              >
                <SelectTrigger className="mt-1 w-full rounded-xl">
                  <SelectValue placeholder={t("orders.selectAccount")}>
                    {selected ? `${selected.name} · ${selected.phone}` : null}
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
              {selected && (
                <p className="mt-1 text-xs text-slate-500">
                  {t("customers.accountHint", {
                    amount: money(selected.creditBalance),
                  })}
                </p>
              )}
            </div>
          ) : (
            <>
              <div>
                <Label>{t("orders.name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label>{t("orders.phone")}</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="mt-1 rounded-xl"
                />
              </div>
            </>
          )}
          <div>
            <Label>{t("customers.depositAmount")}</Label>
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
            <Select value={method} onValueChange={(v) => v && setMethod(v)}>
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
            <Label>{t("reports.colNotes")}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 rounded-xl"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="btn-primary-gradient w-full rounded-xl text-white"
          >
            {loading ? t("customers.savingPayment") : t("customers.addMoney")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
  onPaid: (result: PaidResult) => void;
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
      const { data } = await api.post<PaidResult>(`/debts/${debt.id}/pay`, {
        amount: Number(amount),
        paymentMethod: method,
      });
      onPaid(data);
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
