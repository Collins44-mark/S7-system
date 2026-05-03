export const PRINTER_CONNECTED_STORAGE_KEY = "hardware-printer-connected-v1";

/** Posted from test-print child window after `afterprint` (dialog closed). */
export const HARDWARE_PRINT_TEST_MESSAGE = "hardware-print-test-complete" as const;

export function readPrinterConnected(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRINTER_CONNECTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writePrinterConnected(connected: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PRINTER_CONNECTED_STORAGE_KEY,
      connected ? "1" : "0",
    );
  } catch {
    /* ignore */
  }
}

export function isHardwarePrintTestMessage(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: string }).type === HARDWARE_PRINT_TEST_MESSAGE
  );
}
