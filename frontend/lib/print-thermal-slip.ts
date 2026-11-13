function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function thermalReceiptPage(
  paperMm: number | null,
  parts: {
    businessTitle: string;
    address?: string | null;
    poBox?: string | null;
    phone?: string | null;
    email?: string | null;
    tin?: string | null;
    vrn?: string | null;
    title: string;
    customerLabel: string;
    customerName: string;
    dateLabel: string;
    date: string;
    referenceLabel: string;
    reference: string;
    descriptionLabel: string;
    qtyLabel: string;
    rateLabel: string;
    amountLabel: string;
    lines: { description: string; qty: string; rate: string; amount: string }[];
    totalLabel: string;
    total: string;
    extras?: { label: string; value: string }[];
    thanks: string;
  },
) {
  const fixed =
    paperMm != null && Number.isFinite(paperMm)
      ? Math.min(80, Math.max(48, Math.round(paperMm)))
      : null;
  const pageSize = fixed ? `${fixed}mm auto` : "auto";
  const box = fixed ? `${fixed}mm` : "100%";
  const location = (parts.address ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p class="sub">${esc(line)}</p>`)
    .join("");
  const poBox = parts.poBox?.trim()
    ? `<p class="sub">P.O.BOX ${esc(parts.poBox.trim())}</p>`
    : "";
  const phone = parts.phone?.trim()
    ? `<p class="sub">MOB: ${esc(parts.phone.trim())}</p>`
    : "";
  const email = parts.email?.trim()
    ? `<p class="sub">EMAIL: ${esc(parts.email.trim())}</p>`
    : "";
  const tin = parts.tin?.trim()
    ? `<p class="sub">TIN: ${esc(parts.tin.trim())}</p>`
    : "";
  const vrn = parts.vrn?.trim()
    ? `<p class="sub">VRN: ${esc(parts.vrn.trim())}</p>`
    : "";
  const rows = parts.lines
    .map(
      (line) =>
        `<tr><td>${esc(line.description)}</td><td class="n">${esc(line.qty)}</td><td class="n">${esc(line.rate)}</td><td class="n">${esc(line.amount)}</td></tr>`,
    )
    .join("");
  const extras = (parts.extras ?? [])
    .map(
      (row) =>
        `<div class="total"><span>${esc(row.label)}:</span><span>${esc(row.value)}</span></div>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt</title>
<style>
  @page { size: ${pageSize}; margin: 0; }
  html, body { margin: 0; padding: 0; width: ${box}; height: auto; background: #fff; color: #000; }
  body { font: 11px/1.25 Arial, Helvetica, sans-serif; }
  .slip { width: ${box}; padding: 3mm 3.5mm 4mm; box-sizing: border-box; }
  h1 { margin: 0; font-size: 13px; font-weight: 800; line-height: 1.15; text-align: center; text-transform: uppercase; }
  .sub { margin: 0; font-size: 8px; font-weight: 600; letter-spacing: 0.03em; line-height: 1.35; text-align: center; text-transform: uppercase; }
  .gap { margin-top: 1.2mm; }
  .rule { border: 0; border-top: 1px solid #000; margin: 1.6mm 0; }
  .banner { margin: 0.5mm 0; font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-align: center; text-transform: uppercase; }
  .meta { display: flex; justify-content: space-between; gap: 3mm; margin: 0.5mm 0; font-size: 11px; }
  .meta b { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  table { table-layout: fixed; }
  th { font-weight: 700; text-align: left; padding: 0.8mm 1mm 0.8mm 0; border-bottom: 1px solid #000; }
  td { padding: 1mm 1mm 0 0; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; width: 18%; }
  th.n { text-align: right; }
  .total { display: flex; justify-content: flex-end; gap: 8mm; margin-top: 0.6mm; font-size: 11px; font-weight: 700; }
  .foot { margin: 0; font-size: 10px; text-align: center; }
  .foot strong { display: block; margin-top: 1mm; font-size: 10px; text-transform: uppercase; }
</style></head><body><div class="slip">
  <h1>${esc(parts.businessTitle)}</h1>
  ${location}
  ${poBox}
  ${phone}
  ${email}
  ${tin}
  ${vrn}
  <div class="rule"></div>
  <p class="banner">${esc(parts.title)}</p>
  <div class="rule"></div>
  <div class="meta"><b>${esc(parts.customerLabel)}:</b><span>${esc(parts.customerName)}</span></div>
  <div class="meta"><b>${esc(parts.dateLabel)}:</b><span>${esc(parts.date)}</span></div>
  <div class="meta"><b>${esc(parts.referenceLabel)}:</b><span>${esc(parts.reference)}</span></div>
  ${
    rows
      ? `<div class="rule"></div>
  <table>
    <thead><tr>
      <th>${esc(parts.descriptionLabel)}</th>
      <th class="n">${esc(parts.qtyLabel)}</th>
      <th class="n">${esc(parts.rateLabel)}</th>
      <th class="n">${esc(parts.amountLabel)}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
      : ""
  }
  <div class="rule"></div>
  <div class="total"><span>${esc(parts.totalLabel)}:</span><span>${esc(parts.total)}</span></div>
  ${extras}
  <div class="rule"></div>
  <p class="foot">${esc(parts.thanks)}<strong>${esc(parts.businessTitle)}</strong></p>
</div></body></html>`;
}

/** Print a document that is only as tall as the receipt, on a narrow roll. */
export function printThermalSlip(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:80mm;height:800px;border:0;opacity:0;";
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => window.setTimeout(() => frame.remove(), 400);
  win.addEventListener("afterprint", cleanup);
  window.setTimeout(() => {
    win.focus();
    win.print();
    window.setTimeout(cleanup, 60_000);
  }, 80);
}
