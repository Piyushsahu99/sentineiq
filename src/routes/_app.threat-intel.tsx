import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBadge } from "@/components/sq/risk";
import { maliciousIps, threatCampaigns, malwareFamilies, mitreMatrix, iocs } from "@/lib/mock/data";
import { ThreatMap } from "@/components/sq/threat-map";
import { TrendingUp, TrendingDown, Copy, Bug, Skull } from "lucide-react";

export const Route = createFileRoute("/_app/threat-intel")({
  component: ThreatIntelPage,
});

const mapPoints = [
  { country: "RU", count: 214, severity: "critical" as const },
  { country: "CN", count: 188, severity: "critical" as const },
  { country: "IR", count: 92, severity: "high" as const },
  { country: "NG", count: 71, severity: "high" as const },
  { country: "BR", count: 55, severity: "medium" as const },
  { country: "VN", count: 41, severity: "medium" as const },
  { country: "IN", count: 34, severity: "low" as const },
  { country: "US", count: 28, severity: "low" as const },
];

function ThreatIntelPage() {
  return (
    <div>
      <PageHeader
        title="Threat Intelligence"
        subtitle="External signal fused with internal telemetry: campaigns, IOCs, malware families, and MITRE mapping."
        badge={<span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full hairline bg-emerald-500/10 text-emerald-300">18 feeds live</span>}
      />

      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 xl:col-span-8">
          <SectionHeader title="Global Threat Map" description="Origin of blocked events over the last 24h" />
          <ThreatMap points={mapPoints} className="w-full h-[380px]" />
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-4">
          <SectionHeader title="Malware Families" description="Trending on your tenant" />
          <div className="space-y-2">
            {malwareFamilies.map((m) => (
              <div key={m.name} className="flex items-center gap-3 rounded-lg hairline bg-white/3 p-3">
                <div className="h-8 w-8 rounded-md grid place-items-center bg-rose-500/10 text-rose-300"><Skull className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-[10px] text-muted-foreground">{m.type}</div>
                </div>
                <div className={`text-xs font-mono inline-flex items-center gap-1 ${m.trend >= 0 ? "text-rose-300" : "text-emerald-300"}`}>
                  {m.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(m.trend)}%
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-7 p-0">
          <div className="p-5 pb-2"><SectionHeader title="Known Malicious IPs" description="Auto-correlated with your firewall + VPN telemetry" /></div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-4 [&>th]:py-2">
                  <th>IP</th><th>Country</th><th>Category</th><th>Confidence</th><th>Hits</th>
                </tr>
              </thead>
              <tbody>
                {maliciousIps.map((ip) => (
                  <tr key={ip.id} className="border-t border-white/4 hover:bg-white/3">
                    <td className="px-4 py-2 font-mono text-xs">{ip.ip}</td>
                    <td className="px-4 py-2 text-xs">{ip.country}</td>
                    <td className="px-4 py-2"><RiskBadge severity={ip.confidence > 85 ? "critical" : "high"} label={ip.category} /></td>
                    <td className="px-4 py-2 font-mono text-xs">{ip.confidence}%</td>
                    <td className="px-4 py-2 font-mono text-xs">{ip.hits.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-5">
          <SectionHeader title="Threat Campaigns" />
          <div className="space-y-2">
            {threatCampaigns.map((c) => (
              <div key={c.name} className="rounded-lg hairline bg-white/3 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{c.name}</div>
                  <span className="text-[10px] text-muted-foreground">{c.updated}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{c.actor} · {c.sector}</div>
                <div className="mt-2 flex gap-4 text-[11px]">
                  <span><b className="text-foreground font-mono">{c.ttps}</b> TTPs</span>
                  <span><b className="text-foreground font-mono">{c.victims}</b> victims</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-7">
          <SectionHeader title="MITRE ATT&CK Coverage" description="Tactic heatmap · brighter = more incidents this month" />
          <div className="flex flex-wrap gap-1.5">
            {mitreMatrix.tactics.map((tactic, i) => {
              const hot = mitreMatrix.hot.find((h) => h.t === i)?.n ?? 0;
              const intensity = Math.min(1, hot / 8);
              return (
                <div key={tactic} className="rounded-md hairline p-3 min-w-[130px] flex-1 relative overflow-hidden"
                  style={{ background: hot > 0 ? `linear-gradient(135deg, color-mix(in oklab, var(--risk-high) ${intensity*40}%, transparent), color-mix(in oklab, var(--risk-critical) ${intensity*30}%, transparent))` : undefined }}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tactic}</div>
                  <div className="text-xl font-mono mt-1">{hot || "—"}</div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-5">
          <SectionHeader title="Indicators of Compromise" description="TLP:AMBER · auto-shared via FS-ISAC" />
          <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
            {iocs.map((i) => (
              <div key={i.id} className="rounded-lg hairline p-2 flex items-center gap-3">
                <div className="h-7 w-7 rounded-md grid place-items-center bg-violet-500/10 text-violet-300"><Bug className="h-3.5 w-3.5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono truncate">{i.value}</div>
                  <div className="text-[10px] text-muted-foreground">{i.type} · {i.campaign} · {i.first}</div>
                </div>
                <button className="text-[10px] text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
