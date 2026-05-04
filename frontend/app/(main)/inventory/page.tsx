"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useSearch } from "@/lib/search-context";
import { api } from "@/lib/api";
import { money, parseAmount } from "@/lib/format";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Layers, Plus, MoreVertical } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { useSearchParams } from "next/navigation";

type Category = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  unit: string;
  buyingPrice: string;
  sellingPrice: string;
  quantity: string;
  lowStockThreshold: string;
  category: Category;
};

type InventoryPayload = { items: Item[]; categories: Category[] };

function coercePriceCell(raw: unknown): string {
  const n = parseAmount(raw);
  if (n != null) return n.toFixed(2);
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "0.00";
}

function normalizeItemFromApi(raw: unknown): Item {
  const r = raw as Record<string, unknown>;
  const cat = r.category as Record<string, unknown> | undefined;
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    unit: typeof r.unit === "string" ? r.unit : String(r.unit ?? "pcs"),
    buyingPrice: coercePriceCell(r.buyingPrice),
    sellingPrice: coercePriceCell(r.sellingPrice),
    quantity: String(r.quantity ?? "0"),
    lowStockThreshold: String(r.lowStockThreshold ?? "0"),
    category: {
      id: String(cat?.id ?? "").trim(),
      name: String(cat?.name ?? "").trim() || "—",
    },
  };
}

/** GET /categories — tolerate extra fields; always `{ id, name }`. */
function normalizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => c != null && typeof c === "object")
    .map((c) => ({
      id: String(c.id ?? "").trim(),
      name:
        typeof c.name === "string"
          ? c.name
          : c.name != null
            ? String(c.name)
            : "",
    }))
    .filter((c) => c.id.length > 0);
}

export default function InventoryPage() {
  const { t } = useI18n();
  const { query } = useSearch();
  const searchParams = useSearchParams();
  const selectedCategoryId = (searchParams.get("categoryId") ?? "").trim();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [restockItem, setRestockItem] = useState<Item | null>(null);

  const load = useCallback(async (): Promise<InventoryPayload> => {
    const [itemsRes, categoriesRes] = await Promise.all([
      api.get<Item[]>("/items"),
      api.get<Category[]>("/categories"),
    ]);
    return {
      items: (itemsRes.data as unknown[]).map((row) => normalizeItemFromApi(row)),
      categories: normalizeCategories(categoriesRes.data),
    };
  }, []);

  const { data, error, loading, refetch } = useAsyncData(load, [load]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const qInv = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    let base = items;
    if (selectedCategoryId) {
      base = base.filter((i) => i.category.id === selectedCategoryId);
    }
    if (!qInv) return base;
    return base.filter(
      (i) =>
        i.name.toLowerCase().includes(qInv) ||
        i.category.name.toLowerCase().includes(qInv) ||
        i.unit.toLowerCase().includes(qInv),
    );
  }, [items, qInv, selectedCategoryId]);

  async function remove(id: string) {
    if (!confirm(t("inventory.deleteConfirm"))) return;
    try {
      await api.delete(`/items/${id}`);
      await refetch();
    } catch {
      /* surface via next load */
    }
  }

  if (loading && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("inventory.title")}</h1>
        <PageLoading label={t("inventory.loading")} />
        <div className="glass overflow-hidden rounded-2xl">
          <TableSkeletonRows rows={8} />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("inventory.title")}</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t("inventory.title")}</h1>
        <Button
          className="btn-primary-gradient rounded-xl text-white"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("inventory.addItem")}
        </Button>
      </div>
      {categories.length === 0 && (
        <ErrorBanner message={t("inventory.addCategoryFirst")} />
      )}
      <div className="glass overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="text-xs uppercase text-slate-500">
                {t("inventory.col.item")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("inventory.col.category")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Unit
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("inventory.col.buy")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("inventory.col.sell")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("inventory.col.qty")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("inventory.col.profit")}
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                {t("inventory.col.status")}
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => {
              const qty = parseAmount(item.quantity) ?? 0;
              const lowThreshold = parseAmount(item.lowStockThreshold) ?? 0;
              const low = qty <= lowThreshold;
              const buy = parseAmount(item.buyingPrice);
              const sell = parseAmount(item.sellingPrice);
              const profit =
                buy != null && sell != null ? sell - buy : null;
              return (
                <TableRow
                  key={item.id}
                  className={low ? "low-stock-row border-slate-100" : "border-slate-100"}
                >
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category.name}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>{money(item.buyingPrice)}</TableCell>
                  <TableCell>{money(item.sellingPrice)}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="text-emerald-600">
                    {profit != null ? money(profit) : "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        low
                          ? "rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700"
                          : "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                      }
                    >
                      {low ? t("inventory.lowStock") : t("inventory.inStock")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditItem(item)}>
                          {t("inventory.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRestockItem(item)}>
                          {t("inventory.restock")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => remove(item.id)}
                        >
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {items.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={Layers}
              title={t("inventory.emptyTitle")}
              description={t("inventory.emptyDesc")}
            />
          </div>
        )}
        {items.length > 0 && filteredItems.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-600">
            {t("dashboard.noSearchResults")}
          </div>
        )}
      </div>

      <ItemFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories}
        onSaved={() => {
          setAddOpen(false);
          void refetch();
        }}
      />
      <ItemFormDialog
        open={!!editItem}
        onClose={() => setEditItem(null)}
        categories={categories}
        initial={editItem ?? undefined}
        onSaved={() => {
          setEditItem(null);
          void refetch();
        }}
      />
      <RestockDialog
        item={restockItem}
        onClose={() => setRestockItem(null)}
        onSaved={() => {
          setRestockItem(null);
          void refetch();
        }}
      />
    </div>
  );
}

function ItemFormDialog({
  open,
  onClose,
  categories,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  initial?: Item;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [categoryId, setCategoryId] = useState("");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [threshold, setThreshold] = useState("10");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setFormError(null);
      setFormSuccess(false);
      if (initial) {
        setName(initial.name);
        setUnit(initial.unit || "pcs");
        setCategoryId(initial.category.id);
        setBuyingPrice(String(initial.buyingPrice));
        setSellingPrice(String(initial.sellingPrice));
        setQuantity(String(initial.quantity));
        setThreshold(String(initial.lowStockThreshold));
      } else {
        setName("");
        setUnit("pcs");
        setCategoryId(categories[0]?.id ?? "");
        setBuyingPrice("");
        setSellingPrice("");
        setQuantity("");
        setThreshold("10");
      }
    }
  }, [open, initial, categories]);

  /** Keep selected category valid when list loads or changes (Radix Select breaks on stale / empty value). */
  useEffect(() => {
    if (!open || initial) return;
    if (categories.length === 0) {
      setCategoryId("");
      return;
    }
    if (!categoryId || !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [open, initial, categories, categoryId]);

  const buyPreview = parseAmount(buyingPrice);
  const sellPreview = parseAmount(sellingPrice);
  const profitPreview =
    buyPreview != null && sellPreview != null
      ? sellPreview - buyPreview
      : null;

  const categorySelectValue =
    categoryId && categories.some((c) => c.id === categoryId)
      ? categoryId
      : undefined;

  const canSubmitAdd =
    categories.length > 0 &&
    Boolean(categoryId && categories.some((c) => c.id === categoryId));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    setSaving(true);
    let completed = false;
    try {
      const cid = categoryId.trim();
      if (!cid || !categories.some((c) => c.id === cid)) {
        setFormError("Please select a category.");
        return;
      }

      const buying = parseFloat(String(buyingPrice).replace(",", "."));
      const selling = parseFloat(String(sellingPrice).replace(",", "."));
      const qty = parseFloat(String(quantity).replace(",", "."));
      const lowStockThreshold = parseFloat(String(threshold).replace(",", "."));

      if (Number.isNaN(buying) || buying < 0) {
        setFormError("Buying price must be a valid number ≥ 0.");
        return;
      }
      if (Number.isNaN(selling) || selling < 0) {
        setFormError("Selling price must be a valid number ≥ 0.");
        return;
      }
      if (Number.isNaN(qty) || qty < 0) {
        setFormError("Quantity must be a valid number ≥ 0.");
        return;
      }
      if (
        Number.isNaN(lowStockThreshold) ||
        lowStockThreshold < 0
      ) {
        setFormError("Low stock threshold must be a valid number ≥ 0.");
        return;
      }

      const body = {
        name: name.trim(),
        unit: unit.trim(),
        categoryId: cid,
        buyingPrice: buying,
        sellingPrice: selling,
        quantity: qty,
        lowStockThreshold,
      };

      if (!body.name) {
        setFormError("Name is required.");
        return;
      }

      console.log("Submitting item:", body);

      if (initial) {
        const res = await api.patch<Item>(`/items/${initial.id}`, body);
        console.log("Item updated:", res.data);
      } else {
        const res = await api.post<Item>("/items", body);
        console.log("Item created:", res.data);
      }

      setFormSuccess(true);
      completed = true;
    } catch (err) {
      console.error("Item save failed:", err);
      setFormError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }

    if (completed) {
      await new Promise((r) => setTimeout(r, 700));
      onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("inventory.dialogEditItem") : t("inventory.addItem")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {formSuccess && (
            <div
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              role="status"
            >
              {initial ? "Item updated." : "Item added successfully."}
            </div>
          )}
          {formError && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap"
              role="alert"
            >
              {formError}
            </div>
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
          <div>
            <Label>Unit</Label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="pcs, m, cm, mm, kg, g, box…"
              required
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select
              value={categorySelectValue}
              onValueChange={(v) => {
                if (v) setCategoryId(v);
              }}
              required
              disabled={categories.length === 0}
            >
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue
                  placeholder={
                    categories.length === 0
                      ? "Create a category first"
                      : "Select category"
                  }
                >
                  {categorySelectValue
                    ? categories.find((c) => c.id === categorySelectValue)
                        ?.name?.trim() ||
                      "Category"
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Buying price</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={buyingPrice}
                onChange={(e) => setBuyingPrice(e.target.value)}
                required
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label>Selling price</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
                className="mt-1 rounded-xl"
              />
            </div>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              step="any"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label>Low stock threshold</Label>
            <Input
              type="number"
              step="any"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required
              className="mt-1 rounded-xl"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3">
            <span className="text-sm text-slate-600">Profit per item</span>
            <span className="font-bold text-emerald-600">
              {profitPreview != null ? money(profitPreview) : "—"}
            </span>
          </div>
          <Button
            type="submit"
            disabled={
              saving ||
              formSuccess ||
              (!initial && !canSubmitAdd) ||
              (!initial && categories.length === 0)
            }
            className="btn-primary-gradient w-full rounded-xl text-white"
          >
            {saving ? "Saving…" : initial ? "Save" : "Add item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RestockDialog({
  item,
  onClose,
  onSaved,
}: {
  item: Item | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setQty("");
      setNotes("");
    }
  }, [item]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setSaving(true);
    try {
      await api.post(`/items/${item.id}/restock`, {
        quantity: parseFloat(String(qty).replace(",", ".")),
        notes: notes || undefined,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {item
              ? t("inventory.restockDialog", { name: item.name })
              : t("inventory.restock")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Quantity to add</Label>
            <Input
              type="number"
              min={0.000001}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 rounded-xl"
            />
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="btn-primary-gradient w-full rounded-xl text-white"
          >
            {saving ? "…" : "Confirm restock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
