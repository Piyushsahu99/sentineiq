import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBar } from "@/components/sq/risk";
import { useCustomers, useTelemetry } from "@/lib/live-queries";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Smartphone, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { usePrefs, formatMoney } from "@/lib/currency";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/behavior")({
  ssr: false,
  component: BehaviorPage,
});

const tooltipStyle = { background: "rgba(20,25,45,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 } as const;

function BehaviorPage() {
  const { data: customers = [], isLoading } = useCustomers();
  const [selId, setSelId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const prefs = usePrefs();

  useEffect(() => { if (!selId && customers.length) setSelId(customers[0].id); }, [customers, selId]);
  const sel = customers.find((c: any) => c.id === selId) ?? null;

  const filtered = useMemo(() => {
    if (!q.trim()) return customers;
    const term = q.toLowerCase();
    return customers.filter((c: any) => (c.full_name ?? "").toLowerCase().includes(term) || (c.email ?? "").toLowerCase().includes(term));
  }, [q, customers]);

  const { data: txs = [] } = useQuery({
    queryKey: ["customer-tx", selId],
    enabled: !!selId,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("id, amount, currency, country, channel, merchant, status, risk_score, created_at")
        .eq("customer_id", selId!).order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: telem = [] } = useTelemetry(200);
  const custEvents = useMemo(() => (telem as any[]).filter((t) => t.metadata?.customer_id === selId).slice(0, 10), [telem, selId]);

  // Derived stats
  const stats = useMemo(() => {
    if (!txs.length) return { avgAmount: 0, trustedDevices: 0, activeHour: "—", location: "—", risk: 0 };
    const amounts = txs.map((t: any) => Number(t.amount));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const hours = txs.map((t: any) => new Date(t.created_at).getUTCHours());
    const hourMode = hours.sort((a, b) => hours.filter(h => h === b).length - hours.filter(h => h === a).length)[0];
    const country = (txs.find((t: any) => t.country)?.country) ?? "—";
    const scores = txs.map((t: any) => t.risk_score ?? 0).filter((n) => n > 0);
    const risk = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return { avgAmount: avg, trustedDevices: 0, activeHour: `${hourMode}:00`, location: country, risk };
  }, [txs]);

  const trend = useMemo(() => {
    // 30-day rolling: bucket by day
    const buckets = new Array(30).fill(0);
    const counts = new Array(30).fill(0);
    const now = Date.now();
    for (const t of txs as any[]) {
      const days = Math.floor((now - new Date(t.created_at).getTime()) / (24 * 3600_000));
      if (days >= 0 && days < 30) {
        buckets[29 - days] += t.risk_score ?? 0;
        counts[29 - days]++;
      }
    }
    return buckets.map((sum, i) => ({ d: i, risk: counts[i] ? Math.round(sum / counts[i]) : 0 }));
  }, [txs]);

  return (
    <div>
      <PageHeader
        title="Customer Behaviour Analytics"
        subtitle="Live behavioural baselines derived from ingested transactions and cyber events. Selecting a customer replays their real activity."
        badge={<span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full hairline bg-emerald-500/10 text-emerald-300">{customers.length} customers</span>}
      />
      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 lg:col-span-4 p-0">
          <div className="p-4 border-b border-white/6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer…" className="w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-cyan-400/40" />
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {isLoading ? "Loading…" : (<>No customers yet. <Link to="/ingest" className="text-cyan-300 hover:underline">Ingest bank data</Link>.</>)}
              </div>
            ) : filtered.map((c: any) => {
              const initials = (c.full_name ?? "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("");
              return (
                <button key={c.id} onClick={() => setSelId(c.id)} className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-white/4 hover:bg-white/3 ${selId === c.id ? "bg-white/6" : ""}`}>
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 grid place-items-center text-[11px] font-bold text-black">{initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.full_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.email ?? c.id.slice(0, 8)} · {c.segment ?? "retail"}</div>
                  </div>
                  <div className="w-20"><RiskBar value={c.risk_baseline ?? 20} /></div>
                </button>
              );
            })}
          </div>
        </GlassCard>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          {sel ? (
            <>
              <GlassCard>
                <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 grid place-items-center text-lg font-bold text-black">{(sel.full_name ?? "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</div>
                    <div>
                      <div className="text-xl font-semibold">{sel.full_name}</div>
                      <div className="text-xs text-muted-foreground">{sel.email ?? sel.id.slice(0, 8)} · {sel.segment ?? "retail"} · {sel.country ?? "—"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Behaviour risk</div>
                    <div className="text-2xl font-mono">{stats.risk || sel.risk_baseline}<span className="text-sm text-muted-foreground">/100</span></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat icon={<MapPin className="h-4 w-4" />} label="Recent Country" value={stats.location} />
                  <Stat icon={<Smartphone className="h-4 w-4" />} label="Transactions (60d)" value={String(txs.length)} />
                  <Stat icon={<Clock className="h-4 w-4" />} label="Active Hour (UTC)" value={stats.activeHour} />
                  <Stat icon={<TrendingUp className="h-4 w-4" />} label="Avg Amount" value={stats.avgAmount ? formatMoney(stats.avgAmount, prefs) : "—"} />
                </div>
              </GlassCard>

              <GlassCard>
                <SectionHeader title="Risk Trend" description="Rolling 30-day averaged risk score from live transactions" />
                <div className="h-52">
                  {txs.length ? (
                    <ResponsiveContainer>
                      <LineChart data={trend}>
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="d" tick={{ fill: "hsl(220 10% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "hsl(220 10% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line type="monotone" dataKey="risk" stroke="var(--cyber-cyan)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full grid place-items-center text-xs text-muted-foreground">No transactions yet for this customer.</div>
                  )}
                </div>
              </GlassCard>

              <GlassCard>
                <SectionHeader title="Behaviour Timeline & Change Detection" description="Interleaved cyber events + transactions ordered newest first" />
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                  {(() => {
                    type Row = { ts: string; kind: "tx" | "cyber"; text: string; sev: string };
                    const rows: Row[] = [
                      ...custEvents.map((e: any): Row => ({
                        ts: e.created_at, kind: "cyber", text: e.message ?? "cyber event",
                        sev: e.severity ?? "info",
                      })),
                      ...txs.map((t: any): Row => ({
                        ts: t.created_at, kind: "tx",
                        text: `${t.channel ?? "tx"} ${formatMoney(t.amount, { currency: t.currency })} → ${t.country ?? "—"} · ${t.merchant ?? "—"}`,
                        sev: (t.risk_score ?? 0) >= 70 ? "critical" : (t.risk_score ?? 0) >= 50 ? "high" : (t.risk_score ?? 0) >= 30 ? "medium" : "low",
                      })),
                    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 30);
                    if (!rows.length) return <div className="p-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-2"><AlertTriangle className="h-5 w-5 opacity-60" /> No activity yet for this customer.</div>;
                    return rows.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg hairline bg-white/3 p-3">
                        <span className="text-[10px] font-mono text-muted-foreground w-16 mt-0.5">{formatDistanceToNow(new Date(r.ts), { addSuffix: true })}</span>
                        <span className={`h-2 w-2 rounded-full mt-1.5 ${r.sev === "critical" ? "bg-rose-400" : r.sev === "high" ? "bg-amber-400" : r.sev === "medium" ? "bg-yellow-300" : "bg-emerald-400"}`} />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-12">{r.kind}</span>
                        <div className="text-sm flex-1">{r.text}</div>
                      </div>
                    ));
                  })()}
                </div>
              </GlassCard>
            </>
          ) : (
            <GlassCard><div className="p-8 text-center text-xs text-muted-foreground">Select a customer to view their behaviour.</div></GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg hairline bg-white/3 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-sm font-semibold truncate">{value}</div>
    </div>
  );
}
