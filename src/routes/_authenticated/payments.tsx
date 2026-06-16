import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { fmtUSDExact, monthKey, monthLabel, proRatedSalary, fmtPct } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments — Velocity" }] }),
  component: PaymentsPage,
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

function PaymentsPage() {
  const qc = useQueryClient();
  const months = buildMonths();
  const [period, setPeriod] = useState(months[0]);

  const { data } = useQuery({
    queryKey: ["payments", period],
    queryFn: async () => {
      const [infs, ts, pays] = await Promise.all([
        supabase.from("influencers").select("*").eq("status", "active").order("full_name"),
        supabase.from("monthly_targets").select("*").eq("period", period),
        supabase.from("payments").select("*").eq("period", period),
      ]);
      return { infs: infs.data ?? [], ts: ts.data ?? [], pays: pays.data ?? [] };
    },
  });

  const markPaid = useMutation({
    mutationFn: async ({ influencer_id, amount }: { influencer_id: string; amount: number }) => {
      const { error } = await supabase
        .from("payments")
        .upsert({ influencer_id, period, amount, paid_at: new Date().toISOString() }, { onConflict: "influencer_id,period" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", period] });
      toast.success("Marked as paid");
    },
    onError: (e) => toast.error(e.message),
  });

  const rows =
    data?.infs.map((i) => {
      const t = data.ts.find((x) => x.influencer_id === i.id);
      const target = t?.target_videos ?? 0;
      const completed = t?.completed_videos ?? 0;
      const payable = proRatedSalary(Number(i.monthly_salary), target, completed);
      const paid = data.pays.find((p) => p.influencer_id === i.id);
      return { i, target, completed, payable, paid };
    }) ?? [];

  const totalPayable = rows.reduce((s, r) => s + r.payable, 0);
  const totalPaid = rows.reduce((s, r) => s + (r.paid ? Number(r.paid.amount) : 0), 0);

  return (
    <>
      <PageHeader
        title="Payment Center"
        subtitle={`Pro-rated by achievement · ${monthLabel(period)}`}
        action={
          <div className="flex gap-3">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-input border border-border rounded-md px-3 py-2 text-sm font-mono">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button onClick={() => window.print()} className="flex items-center gap-2 border border-border rounded-md px-3 py-2 text-sm hover:bg-white/5">
              <Printer className="size-4" /> Print
            </button>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        <section className="grid grid-cols-3 gap-4">
          <div className="stat-card p-5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Total Payable</p>
            <p className="text-2xl font-bold font-mono">{fmtUSDExact(totalPayable)}</p>
          </div>
          <div className="stat-card p-5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Already Paid</p>
            <p className="text-2xl font-bold font-mono text-emerald-400">{fmtUSDExact(totalPaid)}</p>
          </div>
          <div className="stat-card p-5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Outstanding</p>
            <p className="text-2xl font-bold font-mono text-cyan">{fmtUSDExact(totalPayable - totalPaid)}</p>
          </div>
        </section>

        <div className="stat-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-mono text-muted-foreground uppercase border-b border-border bg-white/[0.02]">
                <th className="px-6 py-4 text-left font-normal">Name</th>
                <th className="px-6 py-4 text-left font-normal">Target</th>
                <th className="px-6 py-4 text-left font-normal">Completed</th>
                <th className="px-6 py-4 text-left font-normal">Achievement</th>
                <th className="px-6 py-4 text-left font-normal">Salary</th>
                <th className="px-6 py-4 text-left font-normal">Payable</th>
                <th className="px-6 py-4 text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ i, target, completed, payable, paid }) => {
                const pct = target ? (completed / target) * 100 : 0;
                return (
                  <tr key={i.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-sm font-medium">{i.full_name}</td>
                    <td className="px-6 py-4 text-sm font-mono">{target}</td>
                    <td className="px-6 py-4 text-sm font-mono text-cyan">{completed}</td>
                    <td className="px-6 py-4 text-xs font-mono text-muted-foreground">{fmtPct(pct)}</td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{fmtUSDExact(Number(i.monthly_salary))}</td>
                    <td className="px-6 py-4 text-sm font-mono font-semibold">{fmtUSDExact(payable)}</td>
                    <td className="px-6 py-4 text-right">
                      {paid ? (
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold uppercase">
                          Paid {fmtUSDExact(Number(paid.amount))}
                        </span>
                      ) : (
                        <button
                          onClick={() => markPaid.mutate({ influencer_id: i.id, amount: payable })}
                          disabled={payable <= 0}
                          className="inline-flex items-center gap-1.5 bg-indigo text-white text-xs font-medium px-3 py-1.5 rounded hover:brightness-110 disabled:opacity-30"
                        >
                          <Check className="size-3.5" /> Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No active influencers for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
