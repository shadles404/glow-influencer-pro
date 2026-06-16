import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { fmtUSD, monthKey, monthLabel, proRatedSalary, fmtPct, ratingFor } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Velocity" }] }),
  component: ReportsPage,
});

function buildMonths(count = 12) {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

function ReportsPage() {
  const months = buildMonths();
  const [period, setPeriod] = useState(months[0]);

  const { data } = useQuery({
    queryKey: ["report", period],
    queryFn: async () => {
      const [infs, cats, ts, exps, pays] = await Promise.all([
        supabase.from("influencers").select("*"),
        supabase.from("categories").select("*"),
        supabase.from("monthly_targets").select("*").eq("period", period),
        supabase.from("expenses").select("*").gte("expense_date", period).lt("expense_date", monthKey(new Date(new Date(period).setMonth(new Date(period).getMonth() + 1)))),
        supabase.from("payments").select("*").eq("period", period),
      ]);
      return { infs: infs.data ?? [], cats: cats.data ?? [], ts: ts.data ?? [], exps: exps.data ?? [], pays: pays.data ?? [] };
    },
  });

  if (!data) return <div className="p-8 text-muted-foreground">Loading report…</div>;

  const totalBudget = data.cats.reduce((s, c) => s + Number(c.monthly_budget), 0);
  const totalExpenses = data.exps.reduce((s, e) => s + Number(e.amount), 0);
  const totalSalariesDue = data.infs.reduce((s, i) => {
    const t = data.ts.find((x) => x.influencer_id === i.id);
    return s + proRatedSalary(Number(i.monthly_salary), t?.target_videos ?? 0, t?.completed_videos ?? 0);
  }, 0);
  const totalPaid = data.pays.reduce((s, p) => s + Number(p.amount), 0);

  const exportCSV = () => {
    const rows = [
      ["Influencer", "Target", "Completed", "Achievement %", "Salary", "Pro-rated", "Rating"],
      ...data.infs.map((i) => {
        const t = data.ts.find((x) => x.influencer_id === i.id);
        const tgt = t?.target_videos ?? 0;
        const cmp = t?.completed_videos ?? 0;
        const pct = tgt ? (cmp / tgt) * 100 : 0;
        return [
          i.full_name,
          tgt,
          cmp,
          pct.toFixed(1),
          Number(i.monthly_salary),
          proRatedSalary(Number(i.monthly_salary), tgt, cmp),
          ratingFor(pct).label,
        ];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `velocity-report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Performance summary · ${monthLabel(period)}`}
        action={
          <div className="flex gap-3">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-input border border-border rounded-md px-3 py-2 text-sm font-mono">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button onClick={exportCSV} className="bg-indigo text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110">
              Export CSV
            </button>
            <button onClick={() => window.print()} className="border border-border rounded-md px-4 py-2 text-sm hover:bg-white/5">
              Print PDF
            </button>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        <section className="grid grid-cols-4 gap-4">
          <Card label="Total Budget" value={fmtUSD(totalBudget)} />
          <Card label="Total Expenses" value={fmtUSD(totalExpenses)} />
          <Card label="Total Salaries Due" value={fmtUSD(totalSalariesDue)} />
          <Card label="Remaining" value={fmtUSD(totalBudget - totalExpenses - totalPaid)} accent="text-cyan" />
        </section>

        <div className="stat-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-widest">Influencer Performance</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-mono text-muted-foreground uppercase border-b border-border bg-white/[0.02]">
                <th className="px-6 py-4 text-left font-normal">Name</th>
                <th className="px-6 py-4 text-left font-normal">Target</th>
                <th className="px-6 py-4 text-left font-normal">Completed</th>
                <th className="px-6 py-4 text-left font-normal">Achievement</th>
                <th className="px-6 py-4 text-left font-normal">Pro-rated Salary</th>
                <th className="px-6 py-4 text-left font-normal">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.infs.map((i) => {
                const t = data.ts.find((x) => x.influencer_id === i.id);
                const tgt = t?.target_videos ?? 0;
                const cmp = t?.completed_videos ?? 0;
                const pct = tgt ? (cmp / tgt) * 100 : 0;
                const r = ratingFor(pct);
                return (
                  <tr key={i.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-sm font-medium">{i.full_name}</td>
                    <td className="px-6 py-4 text-sm font-mono">{tgt}</td>
                    <td className="px-6 py-4 text-sm font-mono">{cmp}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fmtPct(pct)}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fmtUSD(proRatedSalary(Number(i.monthly_salary), tgt, cmp))}</td>
                    <td className={`px-6 py-4 text-xs font-bold uppercase ${r.color}`}>{r.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="stat-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-widest">Category Spending</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-mono text-muted-foreground uppercase border-b border-border bg-white/[0.02]">
                <th className="px-6 py-4 text-left font-normal">Category</th>
                <th className="px-6 py-4 text-left font-normal">Budget</th>
                <th className="px-6 py-4 text-left font-normal">Expenses</th>
                <th className="px-6 py-4 text-left font-normal">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.cats.map((c) => {
                const spent = data.exps.filter((e) => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0);
                const pct = Number(c.monthly_budget) ? (spent / Number(c.monthly_budget)) * 100 : 0;
                return (
                  <tr key={c.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-sm font-medium">{c.name}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fmtUSD(Number(c.monthly_budget))}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fmtUSD(spent)}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fmtPct(pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="stat-card p-5">
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
