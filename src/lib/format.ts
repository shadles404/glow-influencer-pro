export const fmtUSD = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n ?? 0));

export const fmtUSDExact = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));

export const fmtPct = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;

/** First day of given (or current) month as YYYY-MM-01 */
export const monthKey = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
};

export const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export const proRatedSalary = (salary: number, target: number, completed: number) => {
  if (!target || target <= 0) return 0;
  const ratio = Math.min(completed / target, 1);
  return Math.round(salary * ratio * 100) / 100;
};

export const ratingFor = (pct: number) => {
  if (pct >= 100) return { label: "Excellent", color: "text-emerald-400" };
  if (pct >= 80) return { label: "Good", color: "text-cyan" };
  if (pct >= 60) return { label: "Average", color: "text-amber-400" };
  return { label: "Poor", color: "text-red-400" };
};
