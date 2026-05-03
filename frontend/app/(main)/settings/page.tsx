"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuthStore } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n-context";
import type { Locale } from "@/lib/messages";
import { openPosTestPrint } from "@/lib/pos-test-print";
import {
  isHardwarePrintTestMessage,
  readPrinterConnected,
  writePrinterConnected,
} from "@/lib/printer-connection";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { Badge } from "@/components/ui/badge";
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

type Me = {
  id: string;
  name: string;
  uniqueCode: string;
  createdAt: string;
  receiptPaperWidthMm: number;
  printReceiptAfterSale: boolean;
};

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n();
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);

  const [name, setName] = useState("");
  const [paperMm, setPaperMm] = useState("58");
  const [printAfterSale, setPrintAfterSale] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [printerConnected, setPrinterConnected] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get<Me>("/auth/me");
    return data;
  }, []);

  const { data: profile, error, loading, refetch } = useAsyncData(load, [load]);

  useEffect(() => {
    setPrinterConnected(readPrinterConnected());
  }, []);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (!isHardwarePrintTestMessage(ev.data)) return;
      writePrinterConnected(true);
      setPrinterConnected(true);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    const w = profile.receiptPaperWidthMm ?? 58;
    setPaperMm(String(Math.min(60, Math.max(50, w))));
    setPrintAfterSale(profile.printReceiptAfterSale ?? true);
  }, [profile]);

  useEffect(() => {
    if (!profile || !token) return;
    const s = useAuthStore.getState().session;
    if (s?.role !== "BUSINESS") return;
    setSession(token, {
      ...s,
      businessName: profile.name,
      receiptPaperWidthMm: Math.min(
        60,
        Math.max(50, profile.receiptPaperWidthMm ?? 58),
      ),
      printReceiptAfterSale: profile.printReceiptAfterSale,
    });
  }, [profile, token, setSession]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || session?.role !== "BUSINESS") return;
    setSaving(true);
    setMsg(null);
    setSaveError(null);
    const width = parseInt(paperMm, 10);
    if (Number.isNaN(width) || width < 50 || width > 60) {
      setSaveError(t("settings.widthError"));
      setSaving(false);
      return;
    }
    try {
      const { data } = await api.patch<Me>("/auth/me", {
        name: name || undefined,
        receiptPaperWidthMm: width,
        printReceiptAfterSale: printAfterSale,
      });
      setSession(token, {
        role: "BUSINESS",
        businessId: data.uniqueCode,
        businessName: data.name,
        id: data.id,
        receiptPaperWidthMm: Math.min(
          60,
          Math.max(50, data.receiptPaperWidthMm),
        ),
        printReceiptAfterSale: data.printReceiptAfterSale,
      });
      setMsg(t("common.saved"));
      await refetch();
    } catch (err: unknown) {
      setSaveError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const testTitle = (name || profile?.name || "Business").trim();
  const widthNum = parseInt(paperMm, 10) || 58;

  function runTestPrint() {
    openPosTestPrint(widthNum, testTitle);
  }

  if (loading && !profile) {
    return (
      <div className="animate-in-page max-w-lg space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("settings.title")}</h1>
        <PageLoading label={t("settings.loading")} />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="animate-in-page max-w-lg space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("settings.title")}</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="animate-in-page max-w-2xl space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <h1 className="text-2xl font-bold text-slate-800">{t("settings.title")}</h1>

      <div className="glass rounded-2xl p-6">
        <h3 className="mb-3 font-semibold text-slate-700">
          {t("settings.languageSection")}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-slate-600">{t("common.language")}</Label>
          <Select
            value={locale}
            onValueChange={(v) => {
              if (v === "en" || v === "sw") setLocale(v as Locale);
            }}
          >
            <SelectTrigger className="w-48 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("common.english")}</SelectItem>
              <SelectItem value="sw">{t("common.swahili")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="mb-2 font-semibold text-slate-700">
          {t("settings.printersTitle")}
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          {t("settings.printersSystemHint")}
        </p>
        <Button
          type="button"
          className="btn-primary-gradient mb-4 rounded-xl text-white"
          onClick={runTestPrint}
        >
          {t("settings.printersScan")}
        </Button>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("settings.printersColDestination")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("settings.printersStatus")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium text-slate-800">
                {t("settings.printersSystemRow")}
              </TableCell>
              <TableCell>
                <Badge
                  className={
                    printerConnected
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }
                >
                  {printerConnected
                    ? t("settings.printersReady")
                    : t("settings.printersNotReady")}
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="mt-3 text-xs text-slate-500">
          {t("settings.printersAfterPrintHint")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              writePrinterConnected(true);
              setPrinterConnected(true);
            }}
          >
            {t("settings.printersMarkReady")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl text-slate-600"
            onClick={() => {
              writePrinterConnected(false);
              setPrinterConnected(false);
            }}
          >
            {t("settings.printersClear")}
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 font-semibold text-slate-700">{t("settings.profile")}</h3>
        <form onSubmit={save} className="space-y-4">
          {saveError && (
            <p className="text-sm text-red-600" role="alert">
              {saveError}
            </p>
          )}
          <div>
            <Label htmlFor="code">{t("settings.loginId")}</Label>
            <Input
              id="code"
              readOnly
              value={profile?.uniqueCode ?? ""}
              className="mt-1 rounded-xl bg-slate-50 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="name">{t("settings.businessName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 rounded-xl"
            />
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="mb-4 font-semibold text-slate-700">
              {t("settings.posSection")}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="paper">{t("settings.receiptWidth")}</Label>
                <Input
                  id="paper"
                  type="number"
                  min={50}
                  max={60}
                  value={paperMm}
                  onChange={(e) => setPaperMm(e.target.value)}
                  className="mt-1 max-w-[12rem] rounded-xl"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={printAfterSale}
                  onChange={(e) => setPrintAfterSale(e.target.checked)}
                />
                {t("settings.printAfterSale")}
              </label>
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                onClick={runTestPrint}
              >
                {t("settings.printTest")}
              </Button>
            </div>
          </div>

          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          <Button
            type="submit"
            disabled={saving}
            className="btn-primary-gradient rounded-xl text-white"
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </form>
      </div>
    </div>
  );
}
