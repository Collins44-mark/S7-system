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

type BusinessRow = {
  id: string;
  name: string;
  uniqueCode: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminDashboardPage() {
  const [businessName, setBusinessName] = useState("");
  const [password, setPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get<BusinessRow[]>("/admin/businesses");
    return data;
  }, []);

  const { data: businesses, error, loading, refetch } = useAsyncData(load, []);

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await api.post("/admin/businesses", {
        name: businessName.trim(),
        password,
      });
      setBusinessName("");
      setPassword("");
      await refetch();
    } catch (err: unknown) {
      setCreateError(getApiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(row: BusinessRow) {
    try {
      await api.patch(`/admin/businesses/${row.id}`, {
        isActive: !row.isActive,
      });
      await refetch();
    } catch {
      /* surfaced via refetch */
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Businesses</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create tenants with sequential IDs (S7-0001 …). Deactivated businesses
          cannot sign in.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="mb-4 font-semibold text-slate-200">Create business</h2>
        <form onSubmit={createBusiness} className="flex flex-wrap gap-4">
          {createError && (
            <p className="w-full text-sm text-red-400" role="alert">
              {createError}
            </p>
          )}
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label htmlFor="bizName" className="text-slate-300">
              Business name
            </Label>
            <Input
              id="bizName"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="border-slate-700 bg-slate-950 text-white"
            />
          </div>
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label htmlFor="bizPass" className="text-slate-300">
              Initial password
            </Label>
            <Input
              id="bizPass"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-slate-700 bg-slate-950 text-white"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={creating}
              className="bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Login ID for the business will be the generated code (e.g. S7-0001).
        </p>
      </section>

      <section>
        <h2 className="mb-4 font-semibold text-slate-200">All businesses</h2>
        {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
        {loading && !businesses?.length && (
          <PageLoading label="Loading businesses…" />
        )}
        {!loading && businesses && businesses.length === 0 && (
          <EmptyState
            title="No businesses yet"
            description="Create one above to issue the first S7- code."
          />
        )}
        {businesses && businesses.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/90 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-slate-800/80 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-indigo-300">
                      {b.uniqueCode}
                    </td>
                    <td className="px-4 py-3">{b.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          b.isActive
                            ? "text-emerald-400"
                            : "text-amber-400/90"
                        }
                      >
                        {b.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-200 hover:bg-slate-800"
                        onClick={() => toggleActive(b)}
                      >
                        {b.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
