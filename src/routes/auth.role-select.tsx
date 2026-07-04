import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/sq/glass-card";
import { session, type Role } from "@/lib/session";
import { Shield, DollarSign, Gauge, Briefcase } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/auth/role-select")({
  component: RolePage,
});

const roles: { name: Role; icon: React.ComponentType<{ className?: string }>; desc: string; kpis: string[]; accent: string }[] = [
  { name: "SOC Analyst", icon: Shield, desc: "Investigate incidents, triage alerts, hunt threats in real time.", kpis: ["Alerts","Telemetry","Correlation","Copilot"], accent: "from-cyan-400/30 to-blue-500/30" },
  { name: "Fraud Analyst", icon: DollarSign, desc: "Review flagged transactions, model fraud patterns, block wires.", kpis: ["Transactions","Fraud Trends","Behaviour","Rules"], accent: "from-violet-400/30 to-fuchsia-500/30" },
  { name: "Risk Manager", icon: Gauge, desc: "Own aggregated bank-wide risk posture and quantum readiness.", kpis: ["Risk","Quantum","Compliance","Reports"], accent: "from-amber-400/30 to-rose-500/30" },
  { name: "Executive", icon: Briefcase, desc: "Board-level view of losses prevented, incidents, and strategic risk.", kpis: ["KPIs","Fraud $$","Trend","Briefings"], accent: "from-emerald-400/30 to-teal-500/30" },
];

function RolePage() {
  const nav = useNavigate();
  const [sel, setSel] = useState<Role>("SOC Analyst");
  return (
    <div className="w-full max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">Select your operating role</h1>
        <p className="text-xs text-muted-foreground mt-2">Your dashboard, KPIs, and default views adapt to how you work.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((r) => (
          <motion.button
            key={r.name}
            whileHover={{ y: -4 }}
            onClick={() => setSel(r.name)}
            className="text-left"
          >
            <GlassCard className={`h-full relative overflow-hidden ${sel === r.name ? "border-cyan-400/40 ring-1 ring-cyan-400/30" : ""}`}>
              <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${r.accent} opacity-40 blur-2xl`} />
              <div className="relative">
                <div className="h-10 w-10 rounded-xl grid place-items-center hairline mb-3">
                  <r.icon className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="text-sm font-semibold">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.desc}</div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {r.kpis.map((k) => (
                    <span key={k} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/6">{k}</span>
                  ))}
                </div>
              </div>
            </GlassCard>
          </motion.button>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">You can change this from Settings → User Roles at any time.</p>
        <button onClick={() => { session.setRole(sel); nav({ to: "/dashboard" }); }} className="rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold px-5 py-2 text-sm hover:brightness-110">
          Enter SentinelQ
        </button>
      </div>
    </div>
  );
}
