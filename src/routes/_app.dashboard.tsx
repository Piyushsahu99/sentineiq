import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard, SectionHeader, PageHeader } from "@/components/sq/glass-card";
import { KpiCard } from "@/components/sq/kpi-card";
import { ProgressRing } from "@/components/sq/progress-ring";
import { Heatmap } from "@/components/sq/heatmap";
import { RiskBadge, RiskBar, SeverityDot } from "@/components/sq/risk";
import { Sparkline } from "@/components/sq/sparkline";
import {
  kpis, heatmap, attackCategories, fraudTrend, txStream, riskDistribution,
} from "@/lib/mock/data";
import { Shield, AlertTriangle, ShieldCheck, Activity, Gauge, Sparkles, Atom, TrendingUp, Ban, FileSearch2, ArrowRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useAlerts, useDashboardStats, useInvestigations, useTransactions } from "@/lib/live-queries";

export const Route = createFileRoute("/_app/dashboard")({
  ssr: false,
  component: Dashboard,
});

const tooltipStyle = { background: "rgba(20,25,45,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12, backdropFilter: "blur(12px)" } as const;
type Sev = "critical" | "high" | "medium" | "low" | "info";
const asSev = (s: string): Sev => (["critical","high","medium","low","info"].includes(s) ? s : "info") as Sev;

function Dashboard() {
  const stats = useDashboardStats();
  const alerts = useAlerts();
  const invs = useInvestigations();
  const txs = useTransactions(30);

  const s = stats.data;
  const blocked = (txs.data ?? []).filter((t) => t.status === "blocked").slice(0, 6);
  const feed = (txs.data ?? []).slice(0, 14);

  return (
    <div>
      <PageHeader
        title="Executive Security Dashboard"
        subtitle="Real-time correlation of cyber, fraud, behavioural and quantum signals across the entire bank."
        badge={<span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full hairline bg-emerald-500/10 text-emerald-300">Live</span>}
        actions={
          <>
            <button className="text-xs px-3 py-1.5 rounded-lg hairline hover:bg-white/6">Last 24h</button>
            <button className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110">Export brief</button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
        <KpiCard label="Total Threats" value={(s?.totalTelemetry ?? 0) + (alerts.data?.length ?? 0)} delta={12} icon={<Shield className="h-4 w-4" />} />
        <KpiCard label="Critical Alerts" value={s?.criticalAlerts ?? 0} delta={-8} icon={<AlertTriangle className="h-4 w-4" />} accent="var(--risk-critical)" gradient="from-rose-500/20 to-orange-500/20" />
        <KpiCard label="Fraud Prevented" value={s?.fraudPreventedUsd ?? 0} format={(n) => "$" + (n/1_000).toFixed(1) + "K"} delta={18} icon={<ShieldCheck className="h-4 w-4" />} accent="var(--risk-low)" gradient="from-emerald-500/20 to-teal-500/20" />
        <KpiCard label="Transactions Monitored" value={s?.transactionsMonitored ?? 0} delta={4} icon={<Activity className="h-4 w-4" />} />
        <KpiCard label="Avg. Risk Score" value={s?.avgRisk ?? 0} unit="/100" delta={-3} icon={<Gauge className="h-4 w-4" />} accent="var(--cyber-violet)" gradient="from-violet-500/20 to-fuchsia-500/20" />
        <KpiCard label="AI Investigations" value={s?.totalInvestigations ?? 0} delta={7} icon={<Sparkles className="h-4 w-4" />} accent="var(--cyber-cyan)" />
        <KpiCard label="Quantum Readiness" value={kpis.quantumReadiness} unit="%" delta={2} icon={<Atom className="h-4 w-4" />} accent="var(--cyber-violet)" gradient="from-violet-500/20 to-blue-500/20" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <GlassCard className="col-span-12 xl:col-span-8 p-0">
          <div className="p-5 pb-3">
            <SectionHeader title="Live Transaction Feed" description="Streaming from Supabase Realtime · every insert triggers correlation" action={<span className="text-[10px] text-muted-foreground flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> streaming</span>} />
          </div>
          <div className="max-h-[380px] overflow-y-auto scrollbar-thin px-5 pb-5">
            <ol className="relative border-l border-white/8 ml-2 space-y-3">
              {feed.map((t, i) => {
                const risk = t.risk_score ?? 0;
                const sev: Sev = risk >= 80 ? "critical" : risk >= 60 ? "high" : risk >= 40 ? "medium" : risk >= 20 ? "low" : "info";
                return (
                  <motion.li key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="ml-4 group">
                    <div className="absolute -left-[6px] mt-1.5"><SeverityDot severity={sev} pulse={sev === "critical"} /></div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">{new Date(t.created_at).toLocaleTimeString()}</span>
                      <RiskBadge severity={sev} />
                      <span className="text-sm font-medium">{t.currency} {Number(t.amount).toLocaleString()} · {t.channel}</span>
                      <span className="text-[11px] text-muted-foreground">{t.merchant ?? "—"}</span>
                      <span className="ml-auto text-xs font-mono text-muted-foreground">{t.country ?? "??"} · {t.status}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <RiskBar value={risk} className="max-w-[220px]" />
                      <span className="text-[10px] text-muted-foreground font-mono">{risk}</span>
                    </div>
                  </motion.li>
                );
              })}
              {!feed.length && <li className="text-xs text-muted-foreground p-4">No live transactions yet.</li>}
            </ol>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-6 xl:col-span-4">
          <SectionHeader title="Risk Distribution" description="Open findings by severity" />
          <div className="grid grid-cols-5 items-center gap-2">
            <div className="col-span-3 h-52">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={riskDistribution} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                    {riskDistribution.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="col-span-2 space-y-2">
              {riskDistribution.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }} />{d.name}</span>
                  <span className="font-mono">{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-8">
          <SectionHeader title="Threat Heatmap" description="Events by day × hour · deeper red = higher volume" />
          <Heatmap data={heatmap} labelsX={Array.from({ length: 24 }, (_, i) => (i % 3 === 0 ? String(i).padStart(2,"0") : ""))} labelsY={["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]} />
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-6 xl:col-span-4">
          <SectionHeader title="Top Attack Categories" description="30-day rolling volume" />
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={attackCategories} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "hsl(220 10% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: "hsl(220 10% 65%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="value" fill="var(--cyber-cyan)" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-8">
          <SectionHeader title="Fraud Trends" description="Attempted vs prevented ($) — 30 days" action={<span className="text-xs text-emerald-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> +18% prevention</span>} />
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={fraudTrend}>
                <defs>
                  <linearGradient id="grad-prev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyber-cyan)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--cyber-cyan)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-att" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--risk-critical)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--risk-critical)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: "hsl(220 10% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(220 10% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => "$" + (v/1000).toFixed(0) + "K"} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => "$" + v.toLocaleString()} />
                <Area type="monotone" dataKey="attempted" stroke="var(--risk-critical)" strokeWidth={2} fill="url(#grad-att)" />
                <Area type="monotone" dataKey="prevented" stroke="var(--cyber-cyan)" strokeWidth={2} fill="url(#grad-prev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-6 xl:col-span-4">
          <SectionHeader title="Transaction Monitoring" description="Rolling 60-second stream" />
          <div className="grid grid-cols-3 gap-3">
            <div><div className="text-[10px] text-muted-foreground uppercase">Approved</div><div className="text-lg font-mono">2,847<span className="text-xs text-muted-foreground">/s</span></div><Sparkline data={txStream.map((s) => s.approved)} color="var(--risk-low)" width={110} height={30} /></div>
            <div><div className="text-[10px] text-muted-foreground uppercase">Flagged</div><div className="text-lg font-mono">91<span className="text-xs text-muted-foreground">/s</span></div><Sparkline data={txStream.map((s) => s.flagged)} color="var(--risk-medium)" width={110} height={30} /></div>
            <div><div className="text-[10px] text-muted-foreground uppercase">Blocked</div><div className="text-lg font-mono">14<span className="text-xs text-muted-foreground">/s</span></div><Sparkline data={txStream.map((s) => s.blocked)} color="var(--risk-critical)" width={110} height={30} /></div>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <ProgressRing value={94} size={140} label="Model Health" sublabel="ensemble v2.4.1 · 12 features" />
          </div>
        </GlassCard>

        <RecentPanel title="Recent AI Investigations" href="/investigations" items={(invs.data ?? []).slice(0, 6).map((i) => ({
          id: i.id, primary: i.title, secondary: `${i.confidence}% confidence · $${Number(i.business_impact ?? 0).toLocaleString()} impact`, ts: new Date(i.created_at).getTime(), icon: <FileSearch2 className="h-3.5 w-3.5 text-violet-300" />,
        }))} />
        <RecentPanel title="Recent Alerts" href="/alerts" items={(alerts.data ?? []).slice(0, 6).map((a) => ({
          id: a.id, primary: a.title, secondary: `${a.source ?? "—"} · ${a.status}`, ts: new Date(a.created_at).getTime(), severity: asSev(a.severity),
        }))} />
        <RecentPanel title="Recent Blocked Transactions" href="/transactions" items={blocked.map((t) => ({
          id: t.id, primary: `${t.currency} ${Number(t.amount).toLocaleString()} · ${t.country ?? "—"}`, secondary: `${t.channel} · risk ${t.risk_score ?? "—"}`, ts: new Date(t.created_at).getTime(), icon: <Ban className="h-3.5 w-3.5 text-rose-300" />,
        }))} />
      </div>
    </div>
  );
}

function RecentPanel({ title, items, href }: { title: string; items: { id: string; primary: string; secondary?: string; ts: number; icon?: React.ReactNode; severity?: Sev }[]; href: string }) {
  return (
    <GlassCard className="col-span-12 md:col-span-6 xl:col-span-4">
      <SectionHeader title={title} action={<Link to={href} className="text-[11px] text-cyan-300 hover:underline inline-flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>} />
      <div className="space-y-2.5">
        {items.length ? items.map((it) => (
          <div key={it.id} className="flex items-start gap-3 hover:bg-white/3 rounded-lg p-2 -mx-2 cursor-pointer">
            <div className="mt-1">{it.severity ? <SeverityDot severity={it.severity} /> : it.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{it.primary}</div>
              {it.secondary && <div className="text-[11px] text-muted-foreground truncate">{it.secondary}</div>}
            </div>
            <div className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(it.ts, { addSuffix: true })}</div>
          </div>
        )) : <div className="text-xs text-muted-foreground p-2">No items yet.</div>}
      </div>
    </GlassCard>
  );
}
