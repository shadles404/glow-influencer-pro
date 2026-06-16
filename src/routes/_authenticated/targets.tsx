import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { monthKey, monthLabel, fmtPct } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/targets")({
  head: () => ({ meta: [{ title: "Monthly Targets — Velocity" }] }),
  component: TargetsPage,
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

function TargetsPage() {
  const qc = useQueryClient();
  const months = buildMonths();
  const [period, setPeriod] = useState(months[0]);

  const { data } = useQuery({
    queryKey: ["targets", period],
    queryFn: async () => {
      const [infs, ts] = await Promise.all([
        supabase.from("influencers").select("id, full_name, monthly_salary, status").order("full_name"),
        supabase.from("monthly_targets").select("*").eq("period", period),
      ]);
      return { infs: infs.data ?? [], ts: ts.data ?? [] };
    },
  });

  const upsert = useMutation({
    mutationFn: async ({ influencer_id, target_videos, completed_videos }: { influencer_id: string; target_videos: number; completed_videos: number }) => {
      const { error } = await supabase
        .from("monthly_targets")
        .upsert({ influencer_id, period, target_videos, completed_videos }, { onConflict: "influencer_id,period" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["targets", period] }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Monthly Targets"
        subtitle="Assign target videos and record completions"
        action={
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-input border border-border rounded-md px-3 py-2 text-sm font-mono"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        }
      />
      <div className="p-8">
        <div className="stat-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-mono text-muted-foreground uppercase border-b border-border bg-white/[0.02]">
                <th className="px-6 py-4 text-left font-normal">Influencer</th>
                <th className="px-6 py-4 text-left font-normal">Target Videos</th>
                <th className="px-6 py-4 text-left font-normal">Completed</th>
                <th className="px-6 py-4 text-left font-normal">Achievement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.infs.map((i) => {
                const t = data.ts.find((x) => x.influencer_id === i.id);
                const target = t?.target_videos ?? 0;
                const completed = t?.completed_videos ?? 0;
                const pct = target ? (completed / target) * 100 : 0;
                return (
                  <tr key={i.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-sm font-medium">{i.full_name}</td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min={0}
                        defaultValue={target}
                        onBlur={(e) => {
                          const v = Math.max(0, Number(e.target.value));
                          if (v !== target) upsert.mutate({ influencer_id: i.id, target_videos: v, completed_videos: completed });
                        }}
                        className="bg-input border border-border rounded px-2 py-1 text-sm font-mono w-24"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min={0}
                        defaultValue={completed}
                        onBlur={(e) => {
                          const v = Math.max(0, Number(e.target.value));
                          if (v !== completed) upsert.mutate({ influencer_id: i.id, target_videos: target, completed_videos: v });
                        }}
                        className="bg-input border border-border rounded px-2 py-1 text-sm font-mono w-24"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 max-w-xs">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: pct >= 100 ? "oklch(0.74 0.16 160)" : pct >= 70 ? "oklch(0.82 0.14 210)" : "oklch(0.82 0.16 80)",
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-12 text-right">{fmtPct(pct)}</span>
                      </div>
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
