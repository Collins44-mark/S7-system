"use client";

import { useEffect, useMemo } from "react";
import { money, parseAmount } from "@/lib/format";
import { printThermalSlip, thermalReceiptPage } from "@/lib/print-thermal-slip";
import { useAuthStore } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function slipDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function slipAmount(value: string | number) {
  const parsed = parseAmount(value);
  if (parsed == null) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function slipQty(value: string) {
  const parsed = parseAmount(value);
  if (parsed == null) return value;
  const whole = Math.abs(parsed - Math.trunc(parsed)) < 1e-9;
  return whole ? String(Math.trunc(parsed)) : String(parsed);
}

function slipHtml(input: {
  order: ReceiptOrder;
  paperMm: number | null;
  businessTitle: string;
  address?: string | null;
  poBox?: string | null;
  phone?: string | null;
  email?: string | null;
  tin?: string | null;
  vrn?: string | null;
  t: (key: string) => string;
}) {
  const debt = input.order.kind === "debt";
  const receiptNo = input.order.receiptNumber
    ? shortReceiptNumber(input.order.receiptNumber)
    : input.order.orderNumber;
  const balance = parseAmount(input.order.balance) ?? 0;
  const extras =
    balance > 0
      ? [
          { label: input.t("receipt.paid"), value: slipAmount(input.order.amountPaid) },
          { label: input.t("receipt.balance"), value: slipAmount(input.order.balance) },
        ]
      : [];
  return thermalReceiptPage(input.paperMm, {
    businessTitle: input.businessTitle,
    address: input.address,
    poBox: input.poBox,
    phone: input.phone,
    email: input.email,
    tin: input.tin,
    vrn: input.vrn,
    title: debt ? input.t("receipt.debtTitle") : input.t("receipt.title"),
    customerLabel: input.t("receipt.customer"),
    customerName: input.order.customer.name,
    dateLabel: input.t("receipt.date"),
    date: slipDate(input.order.createdAt),
    referenceLabel: input.t("receipt.reference"),
    reference: receiptNo,
    descriptionLabel: input.t("receipt.description"),
    qtyLabel: input.t("receipt.qty"),
    rateLabel: input.t("receipt.rate"),
    amountLabel: input.t("receipt.amount"),
    lines: debt
      ? []
      : input.order.orderItems.map((li) => ({
          description: li.item.name,
          qty: `${slipQty(li.quantity)}${li.item.unit ? ` ${li.item.unit}` : ""}`,
          rate: slipAmount(li.unitSellPrice),
          amount: slipAmount(li.lineTotal),
        })),
    totalLabel: input.t("receipt.total"),
    total: slipAmount(input.order.totalAmount),
    extras,
    thanks: debt ? input.t("receipt.debtNote") : input.t("receipt.thanks"),
  });
}

/** RCT-000001 and RCT-1 both display as RCT-001. */
function shortReceiptNumber(value: string) {
  const match = value.trim().match(/^RCT-0*(\d+)$/i);
  if (!match) return value;
  return `RCT-${match[1].padStart(3, "0")}`;
}

async function downloadReceiptPdf(input: {
  paperMm: number | null;
  businessTitle: string;
  receiptLabel: string | null;
  date: string;
  customerName: string;
  customerPhone: string;
  items: ReceiptOrder["orderItems"];
  kind?: "sale" | "debt";
  totalAmount: string;
  amountPaid: string;
  balance: string;
  paymentMethodLabel: string;
  labels: {
    total: string;
    paid: string;
    balance: string;
    method: string;
    thanks: string;
  };
  fileName: string;
}) {
  const { jsPDF } = await import("jspdf");
  const width = input.paperMm ?? 80;
  const line = 4.2;
  const debt = input.kind === "debt";
  const itemLines = debt ? 0 : input.items.length;
  const height = 28 + itemLines * line + 36;
  const doc = new jsPDF({
    unit: "mm",
    format: [width, height],
  });
  const left = 4;
  const right = width - 4;
  let y = 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(input.businessTitle, width / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  if (input.receiptLabel) {
    doc.text(input.receiptLabel, width / 2, y, { align: "center" });
    y += 5;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(input.date, width / 2, y, { align: "center" });
  y += 5;
  doc.text(`${input.customerName} · ${input.customerPhone}`, width / 2, y, {
    align: "center",
  });
  y += 3;
  doc.setLineDashPattern([0.6, 0.8], 0);
  doc.line(left, y, right, y);
  y += 5;

  doc.setFontSize(8);
  if (!debt) {
    for (const li of input.items) {
      const unit = li.item.unit ? ` ${li.item.unit}` : "";
      const label = `${li.item.name} ×${li.quantity}${unit}`;
      doc.text(label, left, y, { maxWidth: width - 22 });
      doc.text(money(li.lineTotal), right, y, { align: "right" });
      y += line;
    }
    y += 1;
  }
  doc.line(left, y, right, y);
  y += 5;

  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, left, y);
    doc.text(value, right, y, { align: "right" });
    y += line;
  };
  row(input.labels.total, money(input.totalAmount), true);
  row(input.labels.paid, money(input.amountPaid));
  row(input.labels.balance, money(input.balance));
  row(input.labels.method, input.paymentMethodLabel);

  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(input.labels.thanks, width / 2, y, {
    align: "center",
    maxWidth: width - 8,
  });

  doc.save(input.fileName);
}

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
    quantity: string;
    unitSellPrice: string;
    lineTotal: string;
    item: { name: string; unit?: string };
  }[];
  /** Debt receipts reuse the sale layout without the item list. */
  kind?: "sale" | "debt";
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
  const { locale, t } = useI18n();
  const session = useAuthStore((s) => s.session);
  const businessTitle =
    session?.role === "BUSINESS" ? session.businessName : t("receipt.title");

  const paperMm = useMemo(() => {
    if (session?.role !== "BUSINESS") return null;
    const w = session.receiptPaperWidthMm;
    if (w == null || !Number.isFinite(w)) return null;
    return Math.min(80, Math.max(48, w));
  }, [session]);

  useEffect(() => {
    if (!open || !order || !autoPrint) return;
    const sessionNow = useAuthStore.getState().session;
    if (sessionNow?.role === "BUSINESS" && sessionNow.printReceiptAfterSale === false) {
      return;
    }
    const timer = window.setTimeout(() => {
      printThermalSlip(
        slipHtml({
          order,
          paperMm,
          businessTitle,
          address: session?.role === "BUSINESS" ? session.address : null,
          poBox: session?.role === "BUSINESS" ? session.poBox : null,
          phone: session?.role === "BUSINESS" ? session.phone : null,
          email: session?.role === "BUSINESS" ? session.email : null,
          tin: session?.role === "BUSINESS" ? session.tin : null,
          vrn: session?.role === "BUSINESS" ? session.vrn : null,
          t,
        }),
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [open, order, autoPrint, paperMm, businessTitle, session, t]);

  if (!order) return null;

  const date = new Date(order.createdAt).toLocaleString(
    locale === "sw" ? "sw" : "en",
  );
  const debt = order.kind === "debt";
  const receiptNo = order.receiptNumber
    ? shortReceiptNumber(order.receiptNumber)
    : null;
  const receiptWord = debt ? t("receipt.debtTitle") : t("receipt.title");
  const thanks = debt ? t("receipt.debtNote") : t("receipt.thanks");
  const methodLabel = t(`payment.${order.paymentMethod}`);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md rounded-2xl bg-white shadow-xl print:border-0 print:shadow-none">
          <DialogHeader>
            <DialogTitle className="sr-only">{receiptWord}</DialogTitle>
          </DialogHeader>
          <div
            id="receipt-print-root"
            className="text-center"
            style={{
              maxWidth: paperMm ? `${paperMm}mm` : "100%",
              margin: "0 auto",
            }}
          >
            <div className="border-b border-black pb-2 text-center text-black">
              <h2 className="text-sm font-extrabold uppercase leading-tight">{businessTitle}</h2>
              {session?.role === "BUSINESS" && session.address
                ? session.address.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => (
                    <p key={`${index}-${line}`} className="text-[9px] font-semibold uppercase leading-tight tracking-wide">{line}</p>
                  ))
                : null}
              {session?.role === "BUSINESS" && session.poBox ? (
                <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide">P.O.BOX {session.poBox}</p>
              ) : null}
              {session?.role === "BUSINESS" && session.phone ? (
                <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide">MOB: {session.phone}</p>
              ) : null}
              {session?.role === "BUSINESS" && session.email ? (
                <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide">EMAIL: {session.email}</p>
              ) : null}
              {session?.role === "BUSINESS" && session.tin ? (
                <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide">TIN: {session.tin}</p>
              ) : null}
              {session?.role === "BUSINESS" && session.vrn ? (
                <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide">VRN: {session.vrn}</p>
              ) : null}
            </div>
            <p className="border-b border-black py-1 text-center text-sm font-extrabold tracking-widest text-black">
              {receiptWord}
            </p>
            <div className="space-y-0.5 border-b border-black py-2 text-xs text-black">
              <div className="flex justify-between gap-3">
                <span className="font-bold">{t("receipt.customer")}:</span>
                <span>{order.customer.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-bold">{t("receipt.date")}:</span>
                <span>{slipDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-bold">{t("receipt.reference")}:</span>
                <span>{receiptNo ?? order.orderNumber}</span>
              </div>
            </div>
            {!debt && (
              <table className="mt-2 w-full table-fixed border-b border-black text-left text-[11px] text-black">
                <thead>
                  <tr className="border-b border-black">
                    <th className="w-[40%] py-1 font-bold">{t("receipt.description")}</th>
                    <th className="w-[14%] py-1 text-right font-bold">{t("receipt.qty")}</th>
                    <th className="w-[23%] py-1 pl-2 text-right font-bold">{t("receipt.rate")}</th>
                    <th className="w-[23%] py-1 pl-2 text-right font-bold">{t("receipt.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.orderItems.map((li) => (
                    <tr key={`${li.item.name}-${li.quantity}-${li.lineTotal}`}>
                      <td className="py-1 pr-1 uppercase">{li.item.name}</td>
                      <td className="py-1 text-right tabular-nums">
                        {slipQty(li.quantity)}
                        {li.item.unit ? ` ${li.item.unit}` : ""}
                      </td>
                      <td className="py-1 pl-2 text-right tabular-nums">{slipAmount(li.unitSellPrice)}</td>
                      <td className="py-1 pl-2 text-right tabular-nums">{slipAmount(li.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="space-y-0.5 border-b border-black py-2 text-xs font-bold text-black">
              <div className="flex justify-end gap-8">
                <span>{t("receipt.total")}:</span>
                <span>{slipAmount(order.totalAmount)}</span>
              </div>
              {(parseAmount(order.balance) ?? 0) > 0 ? (
                <>
                  <div className="flex justify-end gap-8">
                    <span>{t("receipt.paid")}:</span>
                    <span>{slipAmount(order.amountPaid)}</span>
                  </div>
                  <div className="flex justify-end gap-8">
                    <span>{t("receipt.balance")}:</span>
                    <span>{slipAmount(order.balance)}</span>
                  </div>
                </>
              ) : null}
            </div>
            <div className="mt-2 text-center text-[11px] text-black">
              <p>{thanks}</p>
              <p className="mt-1 font-bold uppercase">{businessTitle}</p>
            </div>
            <div className="mt-5 flex gap-2 print:hidden">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 rounded-xl"
                onClick={() =>
                  printThermalSlip(
                    slipHtml({
                      order,
                      paperMm,
                      businessTitle,
                      address: session?.role === "BUSINESS" ? session.address : null,
                      poBox: session?.role === "BUSINESS" ? session.poBox : null,
                      phone: session?.role === "BUSINESS" ? session.phone : null,
                      email: session?.role === "BUSINESS" ? session.email : null,
                      tin: session?.role === "BUSINESS" ? session.tin : null,
                      vrn: session?.role === "BUSINESS" ? session.vrn : null,
                      t,
                    }),
                  )
                }
              >
                {t("receipt.print")}
              </Button>
              <Button
                type="button"
                className="btn-primary-gradient flex-1 rounded-xl text-white"
                onClick={() => {
                  const receiptLabel = receiptNo
                    ? `${receiptWord} ${receiptNo}`
                    : debt
                      ? receiptWord
                      : null;
                  const fileStem = receiptNo
                    ? `${debt ? "debt-" : ""}${receiptNo}`
                    : debt
                      ? "debt-receipt"
                      : "receipt";
                  void downloadReceiptPdf({
                    paperMm,
                    businessTitle,
                    receiptLabel,
                    date,
                    customerName: order.customer.name,
                    customerPhone: order.customer.phone,
                    items: debt ? [] : order.orderItems,
                    kind: debt ? "debt" : "sale",
                    totalAmount: order.totalAmount,
                    amountPaid: order.amountPaid,
                    balance: order.balance,
                    paymentMethodLabel: methodLabel,
                    labels: {
                      total: t("receipt.total"),
                      paid: t("receipt.paid"),
                      balance: t("receipt.balance"),
                      method: t("receipt.method"),
                      thanks,
                    },
                    fileName: `${fileStem}.pdf`,
                  });
                }}
              >
                {t("receipt.export")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
