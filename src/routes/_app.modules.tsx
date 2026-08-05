import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard, PageHeader } from "@/components/sq/glass-card";
import {
  LayoutDashboard, GitBranch, FileSearch2, Coins, Radar, Globe2, Atom, Users, Brain,
  Network, Bell, FileBarChart2, Settings2, Upload, Activity, ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_app/modules")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Module Hub — SentinelQ" },
      { name: "description", content: "Every SentinelQ module in one place: correlation, fraud analytics, telemetry, quantum risk and governance." },
      { property: "og:title", content: "Module Hub — SentinelQ" },
      { property: "og:description", content: "Every SentinelQ module in one place: correlation, fraud analytics, telemetry, quantum risk and governance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ModulesPage,
});

type Mod = { to: string; name: string; desc: string; icon: LucideIcon; action: string; accent: string };

const groups: { section: string; items: Mod[] }[] = [
  {
    section: "Operations",
    items: [
      { to: "/dashboard", name: "Executive Dashboard", desc: "Correlated cyber, fraud and quantum posture at a glance.", icon: LayoutDashboard, action: "Open dashboard", accent: "var(--cyber-blue)" },
      { to: "/correlation", name: "Correlation Engine", desc: "Link transactions to cyber events with model-led risk scoring.", icon: GitBranch, action: "Run correlation", accent: "var(--cyber-cyan)" },
      { to: "/investigations", name: "AI Investigations", desc: "Evidence-grounded case files with root cause and impact.", icon: FileSearch2, action: "Review cases", accent: "var(--cyber-violet)" },
      { to: "/alerts", name: "Alert Center", desc: "Triage prioritised alerts and close the false-positive loop.", icon: Bell, action: "Triage alerts", accent: "var(--risk-critical)" },
    ],
  },
  {
    section: "Analytics",
    items: [
      { to: "/ingest", name: "Bank Data Ingest", desc: "Upload transaction and telemetry payloads for instant analysis.", icon: Upload, action: "Ingest data", accent: "var(--risk-low)" },
      { to: "/transactions", name: "Transaction Analytics", desc: "Amounts, channels and blocked wires across the portfolio.", icon: Coins, action: "View transactions", accent: "var(--cyber-cyan)" },
      { to: "/telemetry", name: "Cybersecurity Telemetry", desc: "Login, device and network events feeding the engine.", icon: Radar, action: "Inspect events", accent: "var(--cyber-blue)" },
      { to: "/threat-intel", name: "Threat Intelligence", desc: "Geo risk map and external indicators of compromise.", icon: Globe2, action: "Open threat map", accent: "var(--risk-high)" },
      { to: "/behavior", name: "Customer Behaviour", desc: "Baselines and z-score anomalies per customer profile.", icon: Users, action: "View baselines", accent: "var(--cyber-violet)" },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { to: "/quantum", name: "Quantum Risk", desc: "Post-quantum readiness and harvest-now-decrypt-later signals.", icon: Atom, action: "Assess readiness", accent: "var(--cyber-violet)" },
      { to: "/explainable-ai", name: "Explainable AI", desc: "Feature attributions behind every risk decision.", icon: Brain, action: "Explain a score", accent: "var(--cyber-cyan)" },
      { to: "/graph", name: "Knowledge Graph", desc: "Entity links between accounts, devices, IPs and merchants.", icon: Network, action: "Explore graph", accent: "var(--cyber-blue)" },
      { to: "/model-drift", name: "Model Drift Monitor", desc: "PSI drift tracking with automated retraining and rollback.", icon: Activity, action: "Check drift", accent: "var(--risk-medium)" },
    ],
  },
  {
    section: "Governance",
    items: [
      { to: "/reports", name: "Reports", desc: "Regulator-ready briefs exported from live evidence.", icon: FileBarChart2, action: "Build report", accent: "var(--cyber-blue)" },
      { to: "/settings", name: "Settings", desc: "Region, bank, currency and demo data controls.", icon: Settings2, action: "Open settings", accent: "var(--cyber-cyan)" },
    ],
  },
];

function ModuleCard({ m }: { m: Mod }) {
  const Icon = m.icon;
  return (
    <GlassCard className="group flex flex-col h-full">
      <div className="flex items-start gap-3">
        <div
          className="h-9 w-9 rounded-lg grid place-items-center shrink-0"
          style={{ color: m.accent, background: `color-mix(in oklab, ${m.accent} 12%, transparent)` }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight text-foreground truncate">{m.name}</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{m.desc}</p>
        </div>
      </div>
      <Link
        to={m.to}
        className="mt-4 inline-flex items-center gap-1.5 self-start text-[11px] font-medium text-cyan-300 rounded-md px-2 py-1 -ml-2 hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
      >
        {m.action}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </GlassCard>
  );
}

function ModulesPage() {
  return (
    <div>
      <PageHeader
        title="Module Hub"
        subtitle="Every SentinelQ capability, one click away."
      />
      <div className="space-y-7">
        {groups.map((g) => (
          <section key={g.section}>
            <div className="flex items-center gap-2.5 mb-3">
              <span aria-hidden className="h-3.5 w-[2px] rounded-full bg-primary/70" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.section}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {g.items.map((m) => <ModuleCard key={m.to} m={m} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
