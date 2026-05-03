"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
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

type Category = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  buyingPrice: string;
  sellingPrice: string;
  quantity: number;
  lowStockThreshold: number;
  category: Category;
};

type InventoryPayload = { items: Item[]; categories: Category[] };

export default function InventoryPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [restockItem, setRestockItem] = useState<Item | null>(null);

  const load = useCallback(async (): Promise<InventoryPayload> => {
    const [it, cat] = await Promise.all([
      api.get<Item[]>("/items"),
      api.get<(Category & { _count?: { items: number } })[]>("/categories"),
    ]);
    return {
      items: it.data,
      categories: cat.data.map(({ id, name }) => ({ id, name })),
    };
  }, []);

  const { data, error, loading, refetch } = useAsyncData(load, [load]);

  const items = data?.items ?? [];
  const categories = data?.categories ?? [];

  async function remove(id: string) {
    if (!confirm("Delete this item?")) return;
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
        <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
        <PageLoading label="Loading inventory…" />
        <div className="glass overflow-hidden rounded-2xl">
          <TableSkeletonRows rows={8} />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="animate-in-page space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
        <ErrorBanner message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="animate-in-page space-y-6">
      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
        <Button
          className="btn-primary-gradient rounded-xl text-white"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add item
        </Button>
      </div>
      {categories.length === 0 && (
        <ErrorBanner
          message="Add at least one category before creating items (Categories in the sidebar)."
        />
      )}
      <div className="glass overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="text-xs uppercase text-slate-500">
                Item
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Category
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Buy
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Sell
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Qty
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Profit / unit
              </TableHead>
              <TableHead className="text-xs uppercase text-slate-500">
                Status
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const low = item.quantity <= item.lowStockThreshold;
              const profit =
                Number(item.sellingPrice) - Number(item.buyingPrice);
              return (
                <TableRow
                  key={item.id}
                  className={low ? "low-stock-row border-slate-100" : "border-slate-100"}
                >
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category.name}</TableCell>
                  <TableCell>{money(item.buyingPrice)}</TableCell>
                  <TableCell>{money(item.sellingPrice)}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="text-emerald-600">
                    {money(profit)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        low
                          ? "rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700"
                          : "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                      }
                    >
                      {low ? "Low stock" : "In stock"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditItem(item)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRestockItem(item)}>
                          Restock
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => remove(item.id)}
                        >
                          Delete
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
              title="No inventory items"
              description="Create a category, then add your first product with buy/sell price and quantity."
            />
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
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [threshold, setThreshold] = useState("10");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setName(initial.name);
        setCategoryId(initial.category.id);
        setBuyingPrice(String(initial.buyingPrice));
        setSellingPrice(String(initial.sellingPrice));
        setQuantity(String(initial.quantity));
        setThreshold(String(initial.lowStockThreshold));
      } else {
        setName("");
        setCategoryId(categories[0]?.id ?? "");
        setBuyingPrice("");
        setSellingPrice("");
        setQuantity("");
        setThreshold("10");
      }
    }
  }, [open, initial, categories]);

  const profitPreview =
    Number(sellingPrice || 0) - Number(buyingPrice || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name,
        categoryId,
        buyingPrice: Number(buyingPrice),
        sellingPrice: Number(sellingPrice),
        quantity: Number(quantity),
        lowStockThreshold: Number(threshold),
      };
      if (initial) {
        await api.patch(`/items/${initial.id}`, body);
      } else {
        await api.post("/items", body);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit item" : "Add item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
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
            <Label>Category</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => v && setCategoryId(v)}
              required
            >
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue placeholder="Category" />
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
              {money(profitPreview)}
            </span>
          </div>
          <Button
            type="submit"
            disabled={saving}
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
        quantity: Number(qty),
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
          <DialogTitle>Restock {item?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Quantity to add</Label>
            <Input
              type="number"
              min={1}
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
