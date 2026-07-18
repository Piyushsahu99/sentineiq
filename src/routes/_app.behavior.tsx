import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { customers } from "@/lib/mock/data";
import { RiskBar } from "@/components/sq/risk";
import { Search, User2, MapPin, Smartphone, Clock, TrendingUp } from "lucide-react";
import { usePrefs, formatMoney } from "@/lib/currency";
import { Sparkline } from "@/components/sq/sparkline";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/behavior")({
  component: BehaviorPage,
});

const tooltipStyle = { background: "rgba(20,25,45,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 } as const;

function BehaviorPage() {
  const [sel, setSel] = useState(customers[0]);
  const trend = Array.from({ length: 30 }, (_, i) => ({ d: i, risk: Math.round(20 + Math.sin(i/3)*10 + Math.random()*20 + (i > 24 ? (i-24)*8 : 0)) }));

  return (
    <div>
      <PageHeader
        title="Customer Behaviour Analytics"
        subtitle="Behavioural baselines and drift detection for every customer, updated in real time."
      />
      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 lg:col-span-4 p-0">
          <div className="p-4 border-b border-white/6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="Search customer…" className="w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-cyan-400/40" />
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
            {customers.map((c) => (
              <button key={c.id} onClick={() => setSel(c)} className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-white/4 hover:bg-white/3 ${sel.id === c.id ? "bg-white/6" : ""}`}>
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 grid place-items-center text-[11px] font-bold text-black">{c.name.split(" ").map((n) => n[0]).slice(0,2).join("")}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">{c.id} · {c.segment}</div>
                </div>
                <div className="w-20"><RiskBar value={c.risk} /></div>
              </button>
            ))}
          </div>
        </GlassCard>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          <GlassCard>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 grid place-items-center text-lg font-bold text-black">{sel.name.split(" ").map((n) => n[0]).slice(0,2).join("")}</div>
                <div>
                  <div className="text-xl font-semibold">{sel.name}</div>
                  <div className="text-xs text-muted-foreground">{sel.id} · {sel.segment} · {sel.location}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current risk</div>
                <div className="text-2xl font-mono">{sel.risk}<span className="text-sm text-muted-foreground">/100</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={<MapPin className="h-4 w-4" />} label="Typical Location" value={sel.location} />
              <Stat icon={<Smartphone className="h-4 w-4" />} label="Trusted Devices" value={String(sel.trustedDevices)} />
              <Stat icon={<Clock className="h-4 w-4" />} label="Active Hour" value={`${sel.activeHour}:00`} />
              <Stat icon={<TrendingUp className="h-4 w-4" />} label="Avg Amount" value={`$${sel.avgAmount.toLocaleString()}`} />
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader title="Risk Trend" description="Rolling 30-day behavioural risk score" />
            <div className="h-52">
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="d" tick={{ fill: "hsl(220 10% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(220 10% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="risk" stroke="var(--cyber-cyan)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader title="Behaviour Timeline &amp; Change Detection" />
            <div className="space-y-3">
              {[
                { t: "2m ago", ev: "New device seen (Win11-Fresh) — first-time OS/browser combination", sev: "high" },
                { t: "6m ago", ev: "Login from Amsterdam, NL — 1200km from typical geography", sev: "medium" },
                { t: "12m ago", ev: "Session anchored to commercial VPN (NordVPN NL-421)", sev: "medium" },
                { t: "31m ago", ev: "Baseline drift detected on velocity + amount features (Δ 0.91)", sev: "critical" },
                { t: "3h ago", ev: "Normal salary credit (£4,320) — matches monthly pattern", sev: "low" },
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg hairline bg-white/3 p-3">
                  <span className="text-[10px] font-mono text-muted-foreground w-16 mt-0.5">{r.t}</span>
                  <span className={`h-2 w-2 rounded-full mt-1.5 ${r.sev === "critical" ? "bg-rose-400" : r.sev === "high" ? "bg-amber-400" : r.sev === "medium" ? "bg-yellow-300" : "bg-emerald-400"}`} />
                  <div className="text-sm">{r.ev}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg hairline bg-white/3 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
