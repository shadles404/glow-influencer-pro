import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Tags,
  Target,
  Receipt,
  Wallet,
  FileBarChart,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/influencers", label: "Influencers", icon: Users },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/targets", label: "Targets", icon: Target },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/reports", label: "Reports", icon: FileBarChart },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 border-r border-border bg-sidebar flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="size-8 rounded-md bg-indigo flex items-center justify-center font-bold text-white">
            V
          </div>
          <div>
            <p className="font-bold tracking-tight">VELOCITY</p>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Admin OS</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? "bg-white/5 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="size-8 rounded-full bg-cyan/20 ring-1 ring-cyan/30 flex items-center justify-center text-xs font-semibold">
              {email.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs min-w-0">
              <p className="font-medium truncate">{email || "Admin"}</p>
              <p className="text-muted-foreground">Marketing Lead</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between px-8 pt-8 pb-6 border-b border-border">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
