export function money(n: string | number | null | undefined) {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function paymentLabel(m: string) {
  const map: Record<string, string> = {
    CASH: "Cash",
    AIRTEL_MONEY: "Airtel Money",
    MPESA: "M-Pesa",
    TIGO_PESA: "Tigo Pesa",
    BANK: "Bank",
  };
  return map[m] ?? m;
}
