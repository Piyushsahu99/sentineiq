import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBadge, RiskBar } from "@/components/sq/risk";
import { generateTelemetry, telemetryCategories, type TelemetryCategory } from "@/lib/mock/data";
import { Shield, Wifi, User2, Cpu, Mail, Cloud, Globe, Fingerprint } from "lucide-react";
import { Sparkline } from "@/components/sq/sparkline";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/telemetry")({
  component: TelemetryPage,
});

const iconFor: Record<TelemetryCategory, React.ComponentType<{ className?: string }>> = {
  Firewall: Shield, VPN: Wifi, IAM: User2, Endpoint: Cpu, Email: Mail, Cloud: Cloud, DNS: Globe, Authentication: Fingerprint,
};

function TelemetryPage() {
  const [cat, setCat] = useState<TelemetryCategory>("Endpoint");
  const events = generateTelemetry(cat, 24);
  const trend = Array.from({ length: 24 }, () => Math.round(20 + Math.random()*120));

  return (
    <div>
      <PageHeader
        title="Cybersecurity Telemetry"
        subtitle="Unified plane across firewall, VPN, IAM, endpoint, email, cloud, DNS, and authentication."
        actions={<button className="text-xs px-3 py-1.5 rounded-lg hairline hover:bg-white/6">SIEM: Splunk · Sentinel · Elastic</button>}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {telemetryCategories.map((c) => {
          const Icon = iconFor[c];
          const active = c === cat;
          return (
            <button key={c} onClick={() => setCat(c)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm hairline transition ${active ? "bg-white/10 border-cyan-400/40" : "bg-white/3 text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />
              {c}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 lg:col-span-4">
          <SectionHeader title="Event Volume" description="Last 24h" />
          <Sparkline data={trend} color="var(--cyber-cyan)" width={340} height={90} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {["critical","high","medium"].map((s) => (
              <div key={s} className="rounded-lg hairline p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s}</div>
                <div className="text-lg font-mono">{Math.floor(Math.random()*140)}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 lg:col-span-8 p-0">
          <div className="p-4 flex items-center justify-between border-b border-white/6">
            <div>
              <div className="text-sm font-semibold">{cat} events</div>
              <div className="text-[11px] text-muted-foreground">Live stream · normalised across sources</div>
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> streaming</span>
          </div>
          <div className="max-h-[540px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-card/80 backdrop-blur">
                <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-4 [&>th]:py-2">
                  <th>Sev</th><th>Time</th><th>Source</th><th>Message</th><th>User</th><th>Device</th><th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-white/4 hover:bg-white/3">
                    <td className="px-4 py-2"><RiskBadge severity={e.severity} /></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDistanceToNow(e.ts, { addSuffix: true })}</td>
                    <td className="px-4 py-2 text-xs">{e.source}</td>
                    <td className="px-4 py-2 text-xs">{e.message}</td>
                    <td className="px-4 py-2 text-xs font-mono">{e.user}</td>
                    <td className="px-4 py-2 text-xs font-mono">{e.device}</td>
                    <td className="px-4 py-2 w-32"><div className="flex items-center gap-2"><RiskBar value={e.risk} /><span className="text-xs font-mono">{e.risk}</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
