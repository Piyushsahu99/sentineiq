import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GlassCard, PageHeader } from "@/components/sq/glass-card";
import { alerts } from "@/lib/mock/data";
import { RiskBadge } from "@/components/sq/risk";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import type { Severity } from "@/lib/mock/data";

export const Route = createFileRoute("/_app/alerts")({
  component: AlertsPage,
});

const tabs = [
  { k: "critical", label: "Critical", filter: (a: typeof alerts[number]) => a.severity === "critical" && a.status !== "resolved" },
  { k: "medium", label: "Medium", filter: (a: typeof alerts[number]) => a.severity === "medium" && a.status !== "resolved" },
  { k: "low", label: "Low", filter: (a: typeof alerts[number]) => a.severity === "low" && a.status !== "resolved" },
  { k: "acknowledged", label: "Acknowledged", filter: (a: typeof alerts[number]) => a.status === "acknowledged" },
  { k: "resolved", label: "Resolved", filter: (a: typeof alerts[number]) => a.status === "resolved" },
] as const;

function AlertsPage() {
  const [tab, setTab] = useState<typeof tabs[number]["k"]>("critical");
  const [sel, setSel] = useState(alerts[0]);
  const list = useMemo(() => alerts.filter(tabs.find((t) => t.k === tab)!.filter), [tab]);

  return (
    <div>
      <PageHeader
        title="Alert Center"
        subtitle="Real-time incident queue with ownership, SLAs, and one-click AI investigation."
        actions={<button className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110">Create alert rule</button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => {
          const count = alerts.filter(t.filter).length;
          const active = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)} className={`px-3 py-1.5 text-xs rounded-lg hairline flex items-center gap-2 ${active ? "bg-white/10 border-cyan-400/40" : "bg-white/3 text-muted-foreground hover:text-foreground"}`}>
              {t.label}
              <span className={`text-[10px] font-mono px-1.5 rounded ${active ? "bg-cyan-400/20 text-cyan-200" : "bg-white/8"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-2">
          {list.map((a, i) => (
            <motion.button
              key={a.id}
              onClick={() => setSel(a)}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className={`w-full text-left glass rounded-xl p-4 hover:border-white/12 ${sel.id === a.id ? "border-cyan-400/40 ring-1 ring-cyan-400/20" : ""}`}
            >
              <div className="flex items-start gap-4">
                <RiskBadge severity={a.severity as Severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{a.id} · {a.source} · {formatDistanceToNow(a.ts, { addSuffix: true })}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">SLA</div>
                  <div className={`text-xs font-mono ${a.slaMin < 0 ? "text-rose-400" : a.slaMin < 30 ? "text-amber-300" : "text-emerald-300"}`}>{a.slaMin < 0 ? `-${Math.abs(a.slaMin)}m` : `${a.slaMin}m`}</div>
                </div>
                <div className="text-right w-24">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Owner</div>
                  <div className="text-xs">{a.assignee}</div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <GlassCard>
            <div className="flex items-center justify-between mb-2">
              <RiskBadge severity={sel.severity as Severity} />
              <span className="text-[10px] font-mono text-muted-foreground">{sel.id}</span>
            </div>
            <div className="text-base font-semibold">{sel.title}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{sel.source} · {formatDistanceToNow(sel.ts, { addSuffix: true })}</div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg hairline bg-white/3 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Assignee</div>
                <select className="mt-1 w-full bg-transparent text-sm outline-none">
                  <option>{sel.assignee}</option>
                  <option>N. Chen</option>
                  <option>R. Patel</option>
                  <option>M. Silva</option>
                  <option>A. Kowalski</option>
                </select>
              </div>
              <div className="rounded-lg hairline bg-white/3 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Status</div>
                <select className="mt-1 w-full bg-transparent text-sm outline-none">
                  <option>{sel.status}</option>
                  <option>investigating</option>
                  <option>acknowledged</option>
                  <option>resolved</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Status Timeline</div>
              <ol className="relative border-l border-white/10 ml-1 pl-4 space-y-2">
                {[
                  { t: formatDistanceToNow(sel.ts, { addSuffix: true }), ev: "Alert created by AI Correlation" },
                  { t: "12m ago", ev: "Assigned to " + sel.assignee },
                  { t: "8m ago", ev: "Enrichment complete: TI + Behaviour" },
                  { t: "now", ev: "Awaiting analyst review" },
                ].map((r, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_6px_var(--cyber-cyan)]" />
                    <div className="text-xs">{r.ev}</div>
                    <div className="text-[10px] text-muted-foreground">{r.t}</div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110">Acknowledge</button>
              <button className="flex-1 text-xs px-3 py-1.5 rounded-lg hairline hover:bg-white/6">Resolve</button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
