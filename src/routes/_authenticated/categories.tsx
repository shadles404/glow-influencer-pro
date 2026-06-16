import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { fmtUSD, monthKey } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — Velocity" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const period = monthKey();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState<number>(0);

  const { data } = useQuery({
    queryKey: ["categories-full", period],
    queryFn: async () => {
      const [cats, infs, exps] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("influencers").select("id, category_id"),
        supabase.from("expenses").select("amount, category_id").gte("expense_date", period),
      ]);
      return { cats: cats.data ?? [], infs: infs.data ?? [], exps: exps.data ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").insert({ name, monthly_budget: budget });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setBudget(0);
      qc.invalidateQueries({ queryKey: ["categories-full"] });
      toast.success("Category added");
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories-full"] });
      toast.success("Removed");
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, monthly_budget }: { id: string; monthly_budget: number }) => {
      const { error } = await supabase.from("categories").update({ monthly_budget }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories-full"] }),
  });

  return (
    <>
      <PageHeader title="Categories" subtitle="Budget allocation per category" />
      <div className="p-8 space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="stat-card p-6 flex items-end gap-4"
        >
          <div className="flex-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Category name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Balaala"
              className="mt-1.5 w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="w-48">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Monthly budget</label>
            <input
              required
              type="number"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="mt-1.5 w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
          <button className="bg-indigo text-white font-medium px-4 py-2 rounded-md flex items-center gap-2 hover:brightness-110">
            <Plus className="size-4" /> Add
          </button>
        </form>

        <div className="stat-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-mono text-muted-foreground uppercase border-b border-border bg-white/[0.02]">
                <th className="px-6 py-4 text-left font-normal">Category</th>
                <th className="px-6 py-4 text-left font-normal">Monthly Budget</th>
                <th className="px-6 py-4 text-left font-normal">Influencers</th>
                <th className="px-6 py-4 text-left font-normal">Expenses (this month)</th>
                <th className="px-6 py-4 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.cats.map((c) => {
                const infCount = data.infs.filter((i) => i.category_id === c.id).length;
                const expSum = data.exps
                  .filter((e) => e.category_id === c.id)
                  .reduce((s, e) => s + Number(e.amount), 0);
                return (
                  <tr key={c.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-sm font-medium">{c.name}</td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={Number(c.monthly_budget)}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== Number(c.monthly_budget)) update.mutate({ id: c.id, monthly_budget: v });
                        }}
                        className="bg-input border border-border rounded px-2 py-1 text-sm font-mono w-32"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">{infCount}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fmtUSD(expSum)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => confirm("Delete category?") && del.mutate(c.id)}
                        className="p-1.5 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
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
