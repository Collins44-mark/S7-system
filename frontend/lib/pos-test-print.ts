import { HARDWARE_PRINT_TEST_MESSAGE } from "./printer-connection";

/**
 * Opens a narrow POS-style page and triggers the system print dialog.
 * The OS lists printers the machine knows (USB, Bluetooth, network, PDF).
 * After the print dialog closes, the child posts {@link HARDWARE_PRINT_TEST_MESSAGE} to `opener`.
 * Window is opened without `noopener` so `opener` exists for `postMessage`.
 */
export function openPosTestPrint(paperMm: number, businessTitle: string): void {
  const w = Math.min(60, Math.max(50, Math.round(paperMm)));
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const title = esc(businessTitle.trim() || "Receipt");
  const msgType = esc(HARDWARE_PRINT_TEST_MESSAGE);
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Test</title>
<style>
  @page { size: ${w}mm auto; margin: 2mm; }
  body { margin: 0; padding: 6mm; font: 12px/1.35 system-ui, sans-serif; color: #111; }
  .r { max-width: ${w}mm; margin: 0 auto; }
  h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
  .sub { text-align: center; font-size: 10px; color: #555; margin-bottom: 8px; }
  .line { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; font-size: 11px; }
  .tot { font-weight: 700; border-top: 1px dashed #999; margin-top: 8px; padding-top: 6px; }
</style></head><body><div class="r">
  <h1>${title}</h1>
  <div class="sub">Test · ${w} mm · POS layout</div>
  <div class="line"><span>Sample line ×1</span><span>0.00</span></div>
  <div class="line tot"><span>Total</span><span>0.00</span></div>
</div>
<script>
(function(){
  var T="${msgType}";
  function notify(){
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: T }, "*");
      }
    } catch (e) {}
  }
  addEventListener("load", function(){
    setTimeout(function(){ print(); }, 200);
  });
  addEventListener("afterprint", notify);
})();<\/script>
</body></html>`);
  win.document.close();
}
