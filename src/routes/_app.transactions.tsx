import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBadge, RiskBar } from "@/components/sq/risk";
import { transactions } from "@/lib/mock/data";
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Filter, Search, Ban, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/transactions")({
  component: TransactionsPage,
});

const tooltipStyle = { background: "rgba(20,25,45,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 } as const;

const behaviour = [
  { k: "Amount", cur: 88, avg: 22 },
  { k: "Velocity", cur: 71, avg: 30 },
  { k: "Geo", cur: 92, avg: 12 },
  { k: "Device", cur: 78, avg: 18 },
  { k: "Beneficiary", cur: 95, avg: 20 },
  { k: "Time", cur: 40, avg: 35 },
];

function TransactionsPage() {
  const [q, setQ] = useState("");
  const [minRisk, setMinRisk] = useState(0);
  const [tab, setTab] = useState<"all"|"suspicious"|"blocked">("all");

  const filtered = useMemo(() => transactions.filter((t) => {
    if (tab === "suspicious" && t.status !== "flagged") return false;
    if (tab === "blocked" && t.status !== "blocked") return false;
    if (t.risk < minRisk) return false;
    if (q && ![t.id, t.merchant, t.country, t.customer].join(" ").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [q, minRisk, tab]);

  const timeline = useMemo(() => {
    const buckets: { t: string; v: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      buckets.push({ t: `${String(i).padStart(2,"0")}:00`, v: Math.round(1200 + Math.random()*1800) });
    }
    return buckets;
  }, []);

  return (
    <div>
      <PageHeader
        title="Transaction Analytics"
        subtitle="Every payment, scored, contextualised, and correlated with cyber telemetry."
        actions={<button className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110">Export CSV</button>}
      />

      <div className="grid grid-cols-12 gap-6 mb-6">
        <GlassCard className="col-span-12 lg:col-span-8">
          <SectionHeader title="Transaction Timeline" description="Volume per hour · last 24h" />
          <div className="h-52">
            <ResponsiveContainer>
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="tx-g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyber-cyan)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--cyber-cyan)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="t" tick={{ fill: "hsl(220 10% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(220 10% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="v" stroke="var(--cyber-cyan)" strokeWidth={2} fill="url(#tx-g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 lg:col-span-4">
          <SectionHeader title="Behaviour Comparison" description="Current transaction vs 90-day baseline" />
          <div className="h-52">
            <ResponsiveContainer>
              <RadarChart data={behaviour}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="k" tick={{ fill: "hsl(220 10% 65%)", fontSize: 10 }} />
                <PolarRadiusAxis stroke="rgba(255,255,255,0.05)" tick={{ fill: "hsl(220 10% 40%)", fontSize: 9 }} />
                <Radar name="Baseline" dataKey="avg" stroke="var(--cyber-cyan)" fill="var(--cyber-cyan)" fillOpacity={0.1} />
                <Radar name="Current" dataKey="cur" stroke="var(--risk-critical)" fill="var(--risk-critical)" fillOpacity={0.25} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-0">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-white/6">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search TX ID, merchant, country, customer…" className="w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-cyan-400/40" />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Min risk
            <input type="range" min={0} max={99} value={minRisk} onChange={(e) => setMinRisk(Number(e.target.value))} className="accent-cyan-400" />
            <span className="font-mono w-6 text-right">{minRisk}</span>
          </div>
          <div className="flex rounded-lg hairline p-0.5 text-xs">
            {(["all","suspicious","blocked"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={`px-3 py-1 rounded-md capitalize ${tab === k ? "bg-white/10 text-foreground" : "text-muted-foreground"}`}>{k}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-4 [&>th]:py-2">
                <th>ID</th><th>Time</th><th>Amount</th><th>Country</th><th>Device</th><th>Method</th><th>Merchant</th><th>Risk</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 40).map((t) => (
                <tr key={t.id} className="border-t border-white/4 hover:bg-white/3">
                  <td className="px-4 py-2.5 font-mono text-xs">{t.id}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDistanceToNow(t.ts, { addSuffix: true })}</td>
                  <td className="px-4 py-2.5 font-mono">{t.currency} {t.amount.toLocaleString()}</td>
                  <td className="px-4 py-2.5">{t.country}</td>
                  <td className="px-4 py-2.5 text-xs">{t.device}</td>
                  <td className="px-4 py-2.5 text-xs">{t.method}</td>
                  <td className="px-4 py-2.5 text-xs truncate max-w-[140px]">{t.merchant}</td>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2"><RiskBar value={t.risk} className="w-16" /><span className="font-mono text-xs">{t.risk}</span></div></td>
                  <td className="px-4 py-2.5">
                    {t.status === "blocked" ? <RiskBadge severity="critical" label={<><Ban className="h-3 w-3 inline mr-0.5" />blocked</>} />
                      : t.status === "flagged" ? <RiskBadge severity="high" label={<><AlertTriangle className="h-3 w-3 inline mr-0.5" />flagged</>} />
                      : <RiskBadge severity="low" label="approved" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs text-muted-foreground flex items-center justify-between border-t border-white/6">
          <span>Showing {Math.min(40, filtered.length)} of {filtered.length}</span>
          <span className="font-mono">Model v2.4.1 · avg latency 27ms</span>
        </div>
      </GlassCard>
    </div>
  );
}
