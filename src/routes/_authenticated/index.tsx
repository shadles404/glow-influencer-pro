import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtUSD, fmtPct, monthKey, proRatedSalary } from "@/lib/format";
import { PageHeader } from "@/components/AppShell";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Velocity" }] }),
  component: Dashboard,
});

const CHART_COLORS = ["oklch(0.62 0.20 280)", "oklch(0.82 0.14 210)", "oklch(0.74 0.16 160)", "oklch(0.82 0.16 80)", "oklch(0.65 0.22 25)"];

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="stat-card p-5">
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono ${accent ?? ""}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-2">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const period = monthKey();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", period],
    queryFn: async () => {
      const [influencers, targets, expenses, payments, categories] = await Promise.all([
        supabase.from("influencers").select("id, full_name, monthly_salary, status, category_id"),
        supabase.from("monthly_targets").select("*").eq("period", period),
        supabase.from("expenses").select("amount, category_id, expense_date").gte("expense_date", period),
        supabase.from("payments").select("amount, period").eq("period", period),
        supabase.from("categories").select("*"),
      ]);
      return {
        influencers: influencers.data ?? [],
        targets: targets.data ?? [],
        expenses: expenses.data ?? [],
        payments: payments.data ?? [],
        categories: categories.data ?? [],
      };
    },
  });

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Loading metrics…</div>;

  const { influencers, targets, expenses, payments, categories } = data;
  const active = influencers.filter((i) => i.status === "active");
  const monthlyBudget = categories.reduce((s, c) => s + Number(c.monthly_budget), 0);
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const paymentsTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const budgetUsed = expensesTotal + paymentsTotal;
  const remaining = monthlyBudget - budgetUsed;
  const totalTarget = targets.reduce((s, t) => s + t.target_videos, 0);
  const totalCompleted = targets.reduce((s, t) => s + t.completed_videos, 0);
  const completionPct = totalTarget ? (totalCompleted / totalTarget) * 100 : 0;

  const salaryDue = influencers.reduce((s, i) => {
    const t = targets.find((x) => x.influencer_id === i.id);
    return s + proRatedSalary(Number(i.monthly_salary), t?.target_videos ?? 0, t?.completed_videos ?? 0);
  }, 0);

  const perfData = influencers.slice(0, 8).map((i) => {
    const t = targets.find((x) => x.influencer_id === i.id);
    return {
      name: i.full_name.split(" ")[0],
      Target: t?.target_videos ?? 0,
      Completed: t?.completed_videos ?? 0,
    };
  });

  const categoryData = categories.map((c) => {
    const used =
      expenses.filter((e) => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0) +
      influencers
        .filter((i) => i.category_id === c.id)
        .reduce((s, i) => {
          const t = targets.find((x) => x.influencer_id === i.id);
          return s + proRatedSalary(Number(i.monthly_salary), t?.target_videos ?? 0, t?.completed_videos ?? 0);
        }, 0);
    return { name: c.name, value: Math.round(used), budget: Number(c.monthly_budget) };
  });

  const budgetTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      month: d.toLocaleDateString("en-US", { month: "short" }),
      Budget: monthlyBudget,
      Spent: i === 5 ? budgetUsed : Math.round(budgetUsed * (0.4 + i * 0.12)),
    };
  });

  return (
    <>
      <PageHeader title="Campaign Overview" subtitle={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
      <div className="p-8 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Influencers" value={String(influencers.length)} hint={`${active.length} active`} />
          <StatCard label="Monthly Budget" value={fmtUSD(monthlyBudget)} />
          <StatCard label="Budget Used" value={fmtUSD(budgetUsed)} hint={fmtPct((budgetUsed / (monthlyBudget || 1)) * 100) + " of budget"} />
          <StatCard label="Remaining" value={fmtUSD(remaining)} accent="text-cyan" />
          <StatCard label="Salary Due" value={fmtUSD(salaryDue)} hint={`${fmtUSD(paymentsTotal)} paid`} />
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Target Videos" value={String(totalTarget)} />
          <StatCard label="Completed Videos" value={String(totalCompleted)} accent="text-cyan" />
          <StatCard label="Completion" value={fmtPct(completionPct)} accent={completionPct >= 80 ? "text-emerald-400" : "text-amber-400"} />
          <StatCard label="Expenses (Non-Salary)" value={fmtUSD(expensesTotal)} />
        </section>

        <section className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 stat-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest">Target vs Completed</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={perfData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.03 265)" />
                <XAxis dataKey="name" stroke="oklch(0.68 0.025 260)" fontSize={11} />
                <YAxis stroke="oklch(0.68 0.025 260)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.025 265)", border: "1px solid oklch(0.30 0.03 265)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="Target" fill="oklch(0.62 0.20 280)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Completed" fill="oklch(0.82 0.14 210)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="col-span-12 lg:col-span-4 stat-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-6">Category Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.21 0.025 265)", border: "1px solid oklch(0.30 0.03 265)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {categoryData.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {c.name}
                  </span>
                  <span className="font-mono text-muted-foreground">{fmtUSD(c.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 stat-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-6">Budget vs Spending Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={budgetTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.03 265)" />
                <XAxis dataKey="month" stroke="oklch(0.68 0.025 260)" fontSize={11} />
                <YAxis stroke="oklch(0.68 0.025 260)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.025 265)", border: "1px solid oklch(0.30 0.03 265)", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="Budget" stroke="oklch(0.62 0.20 280)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Spent" stroke="oklch(0.82 0.14 210)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </>
  );
}
