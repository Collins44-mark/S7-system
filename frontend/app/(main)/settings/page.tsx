"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAsyncData } from "@/hooks/use-async-data";
import { useAuthStore } from "@/lib/auth-store";
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
  receiptPrinterAddress: string | null;
};

export default function SettingsPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);

  const [name, setName] = useState("");
  const [paperMm, setPaperMm] = useState("60");
  const [printAfterSale, setPrintAfterSale] = useState(true);
  const [printerNote, setPrinterNote] = useState("");
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
    setPaperMm(String(profile.receiptPaperWidthMm ?? 60));
    setPrintAfterSale(profile.printReceiptAfterSale ?? true);
    setPrinterNote(profile.receiptPrinterAddress ?? "");
  }, [profile]);

  useEffect(() => {
    if (!profile || !token) return;
    const s = useAuthStore.getState().session;
    if (s?.role !== "BUSINESS") return;
    setSession(token, {
      ...s,
      businessName: profile.name,
      receiptPaperWidthMm: profile.receiptPaperWidthMm,
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
    if (Number.isNaN(width) || width < 58 || width > 80) {
      setSaveError("Paper width must be between 58 and 80 mm.");
      setSaving(false);
      return;
    }
    try {
      const { data } = await api.patch<Me>("/auth/me", {
        name: name || undefined,
        receiptPaperWidthMm: width,
        printReceiptAfterSale: printAfterSale,
        receiptPrinterAddress: printerNote.trim() || null,
      });
      setSession(token, {
        role: "BUSINESS",
        businessId: data.uniqueCode,
        businessName: data.name,
        id: data.id,
        receiptPaperWidthMm: data.receiptPaperWidthMm,
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
            <h3 className="mb-2 font-semibold text-slate-700">Receipt &amp; thermal printer</h3>
            <p className="mb-4 text-sm text-slate-600">
              Receipts use your <strong>business name</strong> and a sequential{" "}
              <strong className="font-mono">RCT-000001</strong> number assigned at checkout. Printing
              uses the browser&apos;s print dialog so you can send the job to a{" "}
              <strong>58–60&nbsp;mm</strong> thermal driver (USB, Bluetooth, or shared queue). Web apps
              cannot open a raw TCP connection to a printer IP; note the address below for your staff or
              a desktop print agent if you use one.
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="paper">Receipt paper width (mm)</Label>
                <Input
                  id="paper"
                  type="number"
                  min={58}
                  max={80}
                  value={paperMm}
                  onChange={(e) => setPaperMm(e.target.value)}
                  className="mt-1 max-w-[12rem] rounded-xl"
                />
                <p className="mt-1 text-xs text-slate-500">Typical thermal rolls: 58 or 60 mm.</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={printAfterSale}
                  onChange={(e) => setPrintAfterSale(e.target.checked)}
                />
                Allow automatic print dialog after a new sale (when checkout enables receipt)
              </label>
              <div>
                <Label htmlFor="printerNote">Printer / queue note (optional)</Label>
                <Input
                  id="printerNote"
                  value={printerNote}
                  onChange={(e) => setPrinterNote(e.target.value)}
                  placeholder="e.g. Star TSP143 · 192.168.1.50:9100"
                  className="mt-1 rounded-xl"
                />
                <p className="mt-1 text-xs text-slate-500">
                  For your records only; choose the actual printer in the system print dialog.
                </p>
              </div>
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
