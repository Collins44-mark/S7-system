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
};

export default function SettingsPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);

  const [name, setName] = useState("");
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
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || session?.role !== "BUSINESS") return;
    setSaving(true);
    setMsg(null);
    setSaveError(null);
    try {
      const { data } = await api.patch<Me>("/auth/me", {
        name: name || undefined,
      });
      setSession(token, {
        role: "BUSINESS",
        businessId: data.uniqueCode,
        businessName: data.name,
        id: data.id,
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
    <div className="animate-in-page max-w-lg space-y-6">
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
