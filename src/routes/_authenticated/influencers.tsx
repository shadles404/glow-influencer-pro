import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { fmtUSD } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/influencers")({
  head: () => ({ meta: [{ title: "Influencers — Velocity" }] }),
  component: InfluencersPage,
});

type Inf = {
  id: string;
  full_name: string;
  phone: string | null;
  category_id: string | null;
  monthly_salary: number;
  product: string | null;
  priority: "important" | "second_important" | "third_important";
  status: "active" | "inactive";
};

const PRIORITY_LABEL = {
  important: "Important",
  second_important: "Second",
  third_important: "Third",
} as const;

function InfluencersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Inf | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: influencers } = useQuery({
    queryKey: ["influencers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("influencers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Inf[];
    },
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id, name")).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("influencers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["influencers"] });
      toast.success("Influencer removed");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Influencers"
        subtitle={`${influencers?.length ?? 0} total · ${influencers?.filter((i) => i.status === "active").length ?? 0} active`}
        action={
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-indigo text-white text-sm font-medium px-3 py-2 rounded-md hover:brightness-110"
          >
            <Plus className="size-4" /> Add Influencer
          </button>
        }
      />
      <div className="p-8">
        <div className="stat-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-mono text-muted-foreground uppercase border-b border-border bg-white/[0.02]">
                <th className="px-6 py-4 font-normal">Name</th>
                <th className="px-6 py-4 font-normal">Phone</th>
                <th className="px-6 py-4 font-normal">Category</th>
                <th className="px-6 py-4 font-normal">Product</th>
                <th className="px-6 py-4 font-normal">Priority</th>
                <th className="px-6 py-4 font-normal">Salary</th>
                <th className="px-6 py-4 font-normal">Status</th>
                <th className="px-6 py-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {influencers?.map((i) => {
                const cat = categories?.find((c) => c.id === i.category_id);
                return (
                  <tr key={i.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{i.full_name}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono">{i.phone || "—"}</td>
                    <td className="px-6 py-4 text-xs">{cat?.name || "—"}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{i.product || "—"}</td>
                    <td className="px-6 py-4 text-xs">{PRIORITY_LABEL[i.priority]}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fmtUSD(Number(i.monthly_salary))}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                          i.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-white/5 text-muted-foreground border-border"
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditing(i);
                            setShowForm(true);
                          }}
                          className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-white"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => confirm("Delete this influencer?") && del.mutate(i.id)}
                          className="p-1.5 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {influencers?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No influencers yet. Click "Add Influencer" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <InfluencerForm
          initial={editing}
          categories={categories ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["influencers"] });
            setShowForm(false);
          }}
        />
      )}
    </>
  );
}

function InfluencerForm({
  initial,
  categories,
  onClose,
  onSaved,
}: {
  initial: Inf | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? "",
    phone: initial?.phone ?? "",
    category_id: initial?.category_id ?? "",
    monthly_salary: initial?.monthly_salary ?? 0,
    product: initial?.product ?? "",
    priority: initial?.priority ?? "third_important",
    status: initial?.status ?? "active",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      full_name: form.full_name,
      phone: form.phone || null,
      category_id: form.category_id || null,
      monthly_salary: Number(form.monthly_salary),
      product: form.product || null,
      priority: form.priority,
      status: form.status,
    };
    const { error } = initial
      ? await supabase.from("influencers").update(payload).eq("id", initial.id)
      : await supabase.from("influencers").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Updated" : "Created");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="stat-card p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">{initial ? "Edit" : "New"} Influencer</h2>
        <Field label="Full Name">
          <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="form-input" />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="form-input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="form-input">
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Monthly Salary">
            <input
              type="number"
              step="0.01"
              required
              value={form.monthly_salary}
              onChange={(e) => setForm({ ...form, monthly_salary: Number(e.target.value) })}
              className="form-input"
            />
          </Field>
        </div>
        <Field label="Product Assigned">
          <input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} className="form-input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Priority">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Inf["priority"] })} className="form-input">
              <option value="important">Important</option>
              <option value="second_important">Second Important</option>
              <option value="third_important">Third Important</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Inf["status"] })} className="form-input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-white/5">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo text-white rounded-md text-sm font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <style>{`.form-input { width:100%; background: oklch(0.27 0.03 265); border:1px solid oklch(0.30 0.03 265); border-radius: 6px; padding: 8px 12px; font-size: 14px; color: white; }
        .form-input:focus { outline:none; box-shadow:0 0 0 2px oklch(0.62 0.20 280); }`}</style>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
