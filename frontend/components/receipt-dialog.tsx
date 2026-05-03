"use client";

import { money, paymentLabel } from "@/lib/format";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ReceiptOrder = {
  orderNumber: string;
  createdAt: string;
  totalAmount: string;
  amountPaid: string;
  balance: string;
  paymentMethod: string;
  customer: { name: string; phone: string };
  orderItems: {
    quantity: number;
    unitSellPrice: string;
    lineTotal: string;
    item: { name: string };
  }[];
};

export function ReceiptDialog({
  order,
  open,
  onClose,
}: {
  order: ReceiptOrder | null;
  open: boolean;
  onClose: () => void;
}) {
  const session = useAuthStore((s) => s.session);
  const store =
    session?.role === "BUSINESS"
      ? session.businessName
      : "HardwareHub";

  if (!order) return null;

  const date = new Date(order.createdAt).toLocaleString();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl bg-white shadow-xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Receipt</DialogTitle>
        </DialogHeader>
        <div className="text-center">
          <div className="mb-4 border-b border-dashed border-slate-300 pb-4">
            <h2 className="text-lg font-bold text-slate-800">{store}</h2>
            {session?.role === "BUSINESS" && (
              <p className="text-xs text-slate-500 font-mono">
                {session.businessId}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Order #{order.orderNumber} · {date}
            </p>
          </div>
          <div className="mb-4 space-y-2 text-left text-sm">
            {order.orderItems.map((li) => (
              <div key={li.item.name + li.quantity} className="flex justify-between gap-2">
                <span>
                  {li.item.name} ×{li.quantity}
                </span>
                <span>{money(li.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-dashed border-slate-300 pt-3 text-sm">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{money(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Paid</span>
              <span className="text-green-600">{money(order.amountPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span>Balance</span>
              <span className="text-orange-600">{money(order.balance)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Method</span>
              <span>{paymentLabel(order.paymentMethod)}</span>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Thank you for your purchase!
          </p>
          <div className="mt-5 flex gap-2 print:hidden">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 rounded-xl"
              onClick={() => window.print()}
            >
              Print
            </Button>
            <Button
              type="button"
              className="btn-primary-gradient flex-1 rounded-xl text-white"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
