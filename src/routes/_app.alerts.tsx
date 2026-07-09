import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { GlassCard, PageHeader } from "@/components/sq/glass-card";
import { RiskBadge } from "@/components/sq/risk";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useAlerts, type DbAlert } from "@/lib/live-queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { runProactiveScan } from "@/lib/correlation.functions";

export const Route = createFileRoute("/_app/alerts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Alerts — SentinelQ" },
      { name: "description", content: "SOC triage queue for correlated cyber and fraud alerts." },
      { property: "og:title", content: "Alerts — SentinelQ" },
      { property: "og:description", content: "SOC triage queue for correlated cyber and fraud alerts." },
      { property: "og:url", content: "https://sentinel-q.today/alerts" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://sentinel-q.today/alerts" }],
  }),
  component: AlertsPage,
});


type Sev = "critical" | "high" | "medium" | "low" | "info";
const asSev = (s: string): Sev => (["critical","high","medium","low","info"].includes(s) ? s : "info") as Sev;

const tabs = [
  { k: "critical", label: "Critical" },
  { k: "high", label: "High" },
  { k: "medium", label: "Medium" },
  { k: "low", label: "Low" },
  { k: "acknowledged", label: "Acknowledged" },
  { k: "resolved", label: "Resolved" },
] as const;
type TabKey = typeof tabs[number]["k"];

function matches(a: DbAlert, k: TabKey) {
  if (k === "acknowledged") return a.status === "acknowledged";
  if (k === "resolved") return a.status === "resolved";
  return a.severity === k && a.status === "open";
}

function AlertsPage() {
  const { data: alerts = [] } = useAlerts();
  const [tab, setTab] = useState<TabKey>("critical");
  const [selId, setSelId] = useState<string | null>(null);

  const list = useMemo(() => alerts.filter((a) => matches(a, tab)), [alerts, tab]);
  useEffect(() => { if (!selId && list[0]) setSelId(list[0].id); }, [list, selId]);
  const sel = alerts.find((a) => a.id === selId) ?? list[0];

  async function update(status: string) {
    if (!sel) return;
    const { error } = await supabase.from("alerts").update({ status, updated_at: new Date().toISOString() }).eq("id", sel.id);
    if (error) toast.error(error.message); else toast.success(`Alert ${status}`);
  }

  const scan = useServerFn(runProactiveScan);
  async function proactive() {
    try {
      const res: any = await (scan as any)();
      if (res?.created) toast.success(`Proactive scan created ${res.severity} alert from ${res.evidence_count} events`);
      else toast.info(res?.message ?? "No critical events in the last 15 minutes");
    } catch (e: any) { toast.error(e.message ?? "Scan failed"); }
  }

  return (
    <div>
      <PageHeader
        title="Alert Center"
        subtitle="Real-time incident queue backed by Realtime — with ownership, SLAs, and proactive scans."
        actions={
          <div className="flex gap-2">
            <button onClick={proactive} className="text-xs px-3 py-1.5 rounded-lg hairline hover:bg-white/6">Run proactive scan</button>
            <button className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110">Create alert rule</button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => {
          const count = alerts.filter((a) => matches(a, t.k)).length;
          const active = tab === t.k;
          return (
            <button key={t.k} onClick={() => { setTab(t.k); setSelId(null); }} className={`px-3 py-1.5 text-xs rounded-lg hairline flex items-center gap-2 ${active ? "bg-white/10 border-cyan-400/40" : "bg-white/3 text-muted-foreground hover:text-foreground"}`}>
              {t.label}
              <span className={`text-[10px] font-mono px-1.5 rounded ${active ? "bg-cyan-400/20 text-cyan-200" : "bg-white/8"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-2">
          {list.length === 0 && <div className="text-xs text-muted-foreground p-4">No alerts in this bucket.</div>}
          {list.map((a, i) => (
            <motion.button
              key={a.id} onClick={() => setSelId(a.id)}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className={`w-full text-left glass rounded-xl p-4 hover:border-white/12 ${sel?.id === a.id ? "border-cyan-400/40 ring-1 ring-cyan-400/20" : ""}`}
            >
              <div className="flex items-start gap-4">
                <RiskBadge severity={asSev(a.severity)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{a.id.slice(0,8)} · {a.source ?? "—"} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">SLA</div>
                  <div className="text-xs font-mono text-amber-300">{a.sla_minutes ?? 60}m</div>
                </div>
                <div className="text-right w-24">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
                  <div className="text-xs">{a.status}</div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          {sel && (
            <GlassCard>
              <div className="flex items-center justify-between mb-2">
                <RiskBadge severity={asSev(sel.severity)} />
                <span className="text-[10px] font-mono text-muted-foreground">{sel.id.slice(0,8)}</span>
              </div>
              <div className="text-base font-semibold">{sel.title}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{sel.source ?? "—"} · {formatDistanceToNow(new Date(sel.created_at), { addSuffix: true })}</div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg hairline bg-white/3 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Status</div>
                  <div className="mt-1 text-sm">{sel.status}</div>
                </div>
                <div className="rounded-lg hairline bg-white/3 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">SLA</div>
                  <div className="mt-1 text-sm">{sel.sla_minutes ?? 60} min</div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => update("acknowledged")} className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110">Acknowledge</button>
                <button onClick={() => update("resolved")} className="flex-1 text-xs px-3 py-1.5 rounded-lg hairline hover:bg-white/6">Resolve</button>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
