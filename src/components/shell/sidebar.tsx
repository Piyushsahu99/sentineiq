import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, GitBranch, FileSearch2, Coins, Radar, Globe2, Atom, Users, Brain,
  Network, Bell, FileBarChart2, Settings2, ChevronLeft, ChevronRight, Shield, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/sq/logo";
import { session } from "@/lib/session";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const nav = [
  { section: "Operations", items: [
    { to: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard, kbd: "D" },
    { to: "/correlation", label: "Correlation Engine", icon: GitBranch, kbd: "C", badge: "AI" },
    { to: "/investigations", label: "AI Investigations", icon: FileSearch2, kbd: "I" },
    { to: "/alerts", label: "Alert Center", icon: Bell, kbd: "A", badge: 12 },
  ]},
  { section: "Analytics", items: [
    { to: "/transactions", label: "Transaction Analytics", icon: Coins },
    { to: "/telemetry", label: "Cybersecurity Telemetry", icon: Radar },
    { to: "/threat-intel", label: "Threat Intelligence", icon: Globe2 },
    { to: "/behavior", label: "Customer Behaviour", icon: Users },
  ]},
  { section: "Intelligence", items: [
    { to: "/quantum", label: "Quantum Risk", icon: Atom, badge: "PQC" },
    { to: "/explainable-ai", label: "Explainable AI", icon: Brain },
    { to: "/graph", label: "Knowledge Graph", icon: Network },
  ]},
  { section: "Governance", items: [
    { to: "/reports", label: "Reports", icon: FileBarChart2 },
    { to: "/settings", label: "Settings", icon: Settings2 },
  ]},
] as const;

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => session.subscribe(() => tick((n) => n + 1)), []);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = session.getRole();

  return (
    <>
      <div className={cn("flex items-center h-16 px-4 border-b border-white/6", collapsed && "justify-center px-2")}>
        <Logo showWord={!collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-4 space-y-6">
        {nav.map((group) => (
          <div key={group.section}>
            {!collapsed && (
              <div className="px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2">
                {group.section}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-white/6 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/4",
                      collapsed && "justify-center px-0",
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {active && (
                      <motion.span
                        layoutId="side-active"
                        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-gradient-to-b from-cyan-400 to-violet-500"
                      />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", active && "text-cyan-300")} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {"badge" in item && item.badge != null && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/10 text-foreground/80">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-white/6 p-3", collapsed && "flex justify-center")}>
        {!collapsed ? (
          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Session</span>
            </div>
            <div className="text-xs font-medium truncate">{session.getEmail()}</div>
            <div className="text-[10px] text-muted-foreground truncate">{role ?? "SOC Analyst"}</div>
          </div>
        ) : (
          <Shield className="h-4 w-4 text-emerald-400" />
        )}
      </div>
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 shrink-0 border-r border-white/6 bg-sidebar/70 backdrop-blur-xl transition-[width] duration-300 relative",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      <SidebarBody collapsed={collapsed} />
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-16 h-6 w-6 grid place-items-center rounded-full glass-strong text-muted-foreground hover:text-foreground z-10"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}

export function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[280px] p-0 border-white/6 bg-sidebar/95 backdrop-blur-xl flex flex-col"
      >
        <SidebarBody collapsed={false} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
