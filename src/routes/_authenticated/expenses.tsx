import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { fmtUSD } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Velocity" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: 0,
    category_id: "",
  });

  const { data } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const [exps, cats] = await Promise.all([
        supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
        supabase.from("categories").select("id, name"),
      ]);
      return { exps: exps.data ?? [], cats: cats.data ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        expense_date: form.expense_date,
        description: form.description,
        amount: form.amount,
        category_id: form.category_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ ...form, description: "", amount: 0 });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense recorded");
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const total = data?.exps.reduce((s, e) => s + Number(e.amount), 0) ?? 0;

  return (
    <>
      <PageHeader title="Expenses" subtitle={`${data?.exps.length ?? 0} entries · ${fmtUSD(total)} total`} />
      <div className="p-8 space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="stat-card p-6 grid grid-cols-12 gap-4 items-end"
        >
          <Field label="Date" className="col-span-2">
            <input type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="form-input" />
          </Field>
          <Field label="Description" className="col-span-4">
            <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Video Shooting" className="form-input" />
          </Field>
          <Field label="Category" className="col-span-3">
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="form-input">
              <option value="">—</option>
              {data?.cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount" className="col-span-2">
            <input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="form-input font-mono" />
          </Field>
          <button className="col-span-1 bg-indigo text-white font-medium px-3 py-2 rounded-md flex items-center justify-center gap-2 hover:brightness-110">
            <Plus className="size-4" />
          </button>
          <style>{`.form-input { width:100%; background: oklch(0.27 0.03 265); border:1px solid oklch(0.30 0.03 265); border-radius: 6px; padding: 8px 12px; font-size: 14px; color: white; }
          .form-input:focus { outline:none; box-shadow:0 0 0 2px oklch(0.62 0.20 280); }`}</style>
        </form>

        <div className="stat-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-mono text-muted-foreground uppercase border-b border-border bg-white/[0.02]">
                <th className="px-6 py-4 text-left font-normal">Date</th>
                <th className="px-6 py-4 text-left font-normal">Description</th>
                <th className="px-6 py-4 text-left font-normal">Category</th>
                <th className="px-6 py-4 text-right font-normal">Amount</th>
                <th className="px-6 py-4 text-right font-normal"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.exps.map((e) => (
                <tr key={e.id} className="hover:bg-white/5">
                  <td className="px-6 py-4 text-xs font-mono text-muted-foreground">{e.expense_date}</td>
                  <td className="px-6 py-4 text-sm">{e.description}</td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{data.cats.find((c) => c.id === e.category_id)?.name || "—"}</td>
                  <td className="px-6 py-4 text-sm font-mono text-right">{fmtUSD(Number(e.amount))}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => del.mutate(e.id)} className="p-1.5 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {data?.exps.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No expenses yet.
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

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
