"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAsyncData } from "@/hooks/use-async-data";
import { ErrorBanner } from "@/components/error-banner";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/empty-state";
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
  Droplet,
  Grid,
  Home,
  Layers,
  Paintbrush,
  Plus,
  Wrench,
  Zap,
} from "lucide-react";

type Cat = {
  id: string;
  name: string;
  _count: { items: number };
};

const iconFor = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("plumb")) return Droplet;
  if (n.includes("elect")) return Zap;
  if (n.includes("finish")) return Paintbrush;
  if (n.includes("roof")) return Layers;
  if (n.includes("fast")) return Wrench;
  if (n.includes("build")) return Home;
  return Home;
};

const colors = [
  "bg-blue-100 text-blue-600",
  "bg-indigo-100 text-indigo-600",
  "bg-orange-100 text-orange-600",
  "bg-emerald-100 text-emerald-600",
  "bg-red-100 text-red-600",
  "bg-slate-100 text-slate-600",
];

export default function CategoriesPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.get<Cat[]>("/categories");
    return data;
  }, []);

  const { data: list, error, loading, refetch } = useAsyncData(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/categories", { name });
      setName("");
      setOpen(false);
      await refetch();
    } catch (err: unknown) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !list) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Categories</h1>
        <PageLoading />
      </div>
    );
  }

  if (error && !list) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Categories</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const categories = list ?? [];

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Categories</h1>
        <Button
          className="btn-primary-gradient rounded-xl text-white"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add category
        </Button>
      </div>
      {categories.length === 0 ? (
        <EmptyState
          icon={Grid}
          title="No categories yet"
          description="Categories organize your inventory. Add Building, Plumbing, Electrical, or your own labels."
          action={
            <Button
              className="btn-primary-gradient text-white"
              onClick={() => setOpen(true)}
            >
              Add category
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c, i) => {
            const Icon = iconFor(c.name);
            const colorClass = colors[i % colors.length];
            return (
              <div
                key={c.id}
                className="glass card-hover cursor-default rounded-2xl p-5"
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${colorClass}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-800">{c.name}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {c._count.items} items
                </p>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass rounded-2xl">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <form onSubmit={add} className="space-y-4">
            {formError && (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            )}
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={saving}
              className="btn-primary-gradient w-full rounded-xl text-white"
            >
              {saving ? "Saving…" : "Add"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
