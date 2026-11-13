import Decimal from "decimal.js";

/**
 * Parse API amounts (string, number, or Prisma Decimal-like objects) for math/display.
 */
export function parseAmount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === "bigint") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "string") {
    const t = raw.trim().replace(/\s/g, "");
    if (!t) return null;
    const normalized =
      t.includes(",") && !t.includes(".") ? t.replace(",", ".") : t.replace(/,/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "object" && raw !== null) {
    const ctor = (raw as object).constructor?.name;
    if (ctor === "Decimal" || ctor === "PrismaDecimal") {
      return parseAmount(String(raw));
    }
    if (typeof (raw as { toJSON?: () => unknown }).toJSON === "function") {
      try {
        return parseAmount((raw as { toJSON: () => unknown }).toJSON());
      } catch {
        /* ignore */
      }
    }
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.d)) {
      try {
        const dec = new Decimal(raw as Decimal.Value);
        const n = dec.toNumber();
        return Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    }
    if (typeof (raw as { toString?: () => string }).toString === "function") {
      const s = (raw as { toString: () => string }).toString();
      if (s && s !== "[object Object]") return parseAmount(s);
    }
  }
  return null;
}

/** Whole amounts stay as 1500. Amounts with cents stay as 1500.50. */
export function formatAmount(n: number) {
  const rounded = Math.round(n * 100) / 100;
  const whole = Math.abs(rounded - Math.trunc(rounded)) < 1e-9;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(rounded);
}

/** Same rules, without thousands separators, for number inputs. */
export function formatAmountInput(n: number) {
  const rounded = Math.round(n * 100) / 100;
  const whole = Math.abs(rounded - Math.trunc(rounded)) < 1e-9;
  if (whole) return String(Math.trunc(rounded));
  return rounded.toFixed(2);
}

export function money(n: string | number | null | undefined | object) {
  const parsed = parseAmount(n);
  if (parsed == null) return "—";
  return formatAmount(parsed);
}

export function paymentLabel(m: string) {
  const map: Record<string, string> = {
    CASH: "Cash",
    AIRTEL_MONEY: "Airtel Money",
    MPESA: "M-Pesa",
    TIGO_PESA: "Tigo Pesa",
    BANK: "Bank",
    ACCOUNT: "Account",
  };
  return map[m] ?? m;
}
