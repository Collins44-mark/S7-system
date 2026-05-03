"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuthStore } from "@/lib/auth-store";
import { openPosTestPrint } from "@/lib/pos-test-print";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Me = {
  id: string;
  name: string;
  uniqueCode: string;
  createdAt: string;
  receiptPaperWidthMm: number;
  printReceiptAfterSale: boolean;
};

export default function SettingsPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);

  const [name, setName] = useState("");
  const [paperMm, setPaperMm] = useState("58");
  const [printAfterSale, setPrintAfterSale] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.get<Me>("/auth/me");
    return data;
  }, []);

  const { data: profile, error, loading, refetch } = useAsyncData(load, [load]);

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
      receiptPaperWidthMm: Math.min(60, Math.max(50, profile.receiptPaperWidthMm ?? 58)),
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
      setSaveError("Receipt width must be between 50 and 60 mm.");
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
        receiptPaperWidthMm: Math.min(60, Math.max(50, data.receiptPaperWidthMm)),
        printReceiptAfterSale: data.printReceiptAfterSale,
      });
      setMsg("Saved");
      await refetch();
    } catch (err: unknown) {
      setSaveError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !profile) {
    return (
      <div className="animate-in-page max-w-lg space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <PageLoading label="Loading settings…" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="animate-in-page max-w-lg space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const testTitle = (name || profile?.name || "Business").trim();

  return (
    <div className="animate-in-page max-w-2xl space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
      <div className="glass rounded-2xl p-6">
        <h3 className="mb-4 font-semibold text-slate-700">Business profile</h3>
        <form onSubmit={save} className="space-y-4">
          {saveError && (
            <p className="text-sm text-red-600" role="alert">
              {saveError}
            </p>
          )}
          <div>
            <Label htmlFor="code">Login ID (code)</Label>
            <Input
              id="code"
              readOnly
              value={profile?.uniqueCode ?? ""}
              className="mt-1 rounded-xl bg-slate-50 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 rounded-xl"
            />
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="mb-4 font-semibold text-slate-700">POS receipt</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="paper">Receipt width (mm)</Label>
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
                Print receipt after sale
              </label>
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                onClick={() =>
                  openPosTestPrint(parseInt(paperMm, 10) || 58, testTitle)
                }
              >
                Print test receipt
              </Button>
            </div>
          </div>

          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          <Button
            type="submit"
            disabled={saving}
            className="btn-primary-gradient rounded-xl text-white"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </div>
    </div>
  );
}
