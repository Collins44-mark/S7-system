"use client";

import { useEffect, useMemo } from "react";
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
  receiptNumber?: string | null;
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
  autoPrint = false,
}: {
  order: ReceiptOrder | null;
  open: boolean;
  onClose: () => void;
  /** When true (e.g. right after checkout), may open the browser print dialog once. */
  autoPrint?: boolean;
}) {
  const session = useAuthStore((s) => s.session);
  const businessTitle =
    session?.role === "BUSINESS" ? session.businessName : "Receipt";

  const paperMm = useMemo(() => {
    if (session?.role === "BUSINESS" && session.receiptPaperWidthMm) {
      return session.receiptPaperWidthMm;
    }
    return 60;
  }, [session]);

  useEffect(() => {
    if (!open || !order || !autoPrint) return;
    const sessionNow = useAuthStore.getState().session;
    if (sessionNow?.role === "BUSINESS" && sessionNow.printReceiptAfterSale === false) {
      return;
    }
    const t = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(t);
  }, [open, order, autoPrint]);

  if (!order) return null;

  const date = new Date(order.createdAt).toLocaleString();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-print-root,
          #receipt-print-root * {
            visibility: visible !important;
          }
          #receipt-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: ${paperMm}mm;
            max-width: ${paperMm}mm;
            padding: 4mm;
            font-size: 11px;
            color: #000;
            background: #fff;
          }
        }
      `}</style>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-sm rounded-2xl bg-white shadow-xl print:border-0 print:shadow-none">
          <DialogHeader>
            <DialogTitle className="sr-only">Receipt</DialogTitle>
          </DialogHeader>
          <div
            id="receipt-print-root"
            className="text-center"
            style={{
              maxWidth: `${paperMm}mm`,
              margin: "0 auto",
            }}
          >
            <div className="mb-4 border-b border-dashed border-slate-300 pb-4">
              <h2 className="text-lg font-bold text-slate-800">{businessTitle}</h2>
              {session?.role === "BUSINESS" && (
                <p className="text-xs text-slate-500 font-mono">{session.businessId}</p>
              )}
              {order.receiptNumber ? (
                <p className="mt-1 font-mono text-sm font-semibold text-slate-800">
                  Receipt {order.receiptNumber}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">
                Order #{order.orderNumber} · {date}
              </p>
            </div>
            <div className="mb-4 space-y-2 text-left text-sm">
              <p className="text-xs text-slate-600">
                {order.customer.name} · {order.customer.phone}
              </p>
              {order.orderItems.map((li) => (
                <div
                  key={`${li.item.name}-${li.quantity}-${li.lineTotal}`}
                  className="flex justify-between gap-2"
                >
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
                Print receipt
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
    </>
  );
}
