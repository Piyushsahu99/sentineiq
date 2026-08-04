import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBadge } from "@/components/sq/risk";
import { ThreatMap } from "@/components/sq/threat-map";
import { useIocs, useTransactions, useTelemetry, useKnowledgeEdges } from "@/lib/live-queries";
import { Copy, Bug, Skull, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/threat-intel")({
  ssr: false,
  component: ThreatIntelPage,
});

const HIGH_RISK_GEO = new Set(["RU", "NG", "AE", "IR", "CN", "VN"]);
type Sev = "critical" | "high" | "medium" | "low" | "info";

function severityForCountry(country: string, count: number): Sev {
  if (HIGH_RISK_GEO.has(country)) return count > 3 ? "critical" : "high";
  if (count > 5) return "medium";
  return "low";
}

function ThreatIntelPage() {
  const { data: iocs = [] } = useIocs();
  const { data: txs = [] } = useTransactions(500);
  const { data: telem = [] } = useTelemetry(200);
  const { data: edges = [] } = useKnowledgeEdges(400);

  const mapPoints = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of txs) if (t.country) counts.set(t.country, (counts.get(t.country) ?? 0) + 1);
    return Array.from(counts.entries()).map(([country, count]) => ({ country, count, severity: severityForCountry(country, count) }));
  }, [txs]);

  const ipHits = useMemo(() => {
    const iocIps = iocs.filter((i: any) => (i.type ?? "").toLowerCase() === "ip");
    // Fuse with cyber telemetry IPs seen
    const seenIps = new Map<string, number>();
    for (const t of telem as any[]) if (t.ip) seenIps.set(String(t.ip), (seenIps.get(String(t.ip)) ?? 0) + 1);
    // Include IOCs even if not seen locally, but sort by hits
    return iocIps.map((i: any) => ({
      id: i.id, ip: i.value, country: "—", category: i.severity ?? "medium",
      confidence: Math.min(99, 60 + (i.seen_count ?? 1) * 4),
      hits: (seenIps.get(i.value) ?? 0) + (i.seen_count ?? 0),
    })).sort((a, b) => b.hits - a.hits).slice(0, 20);
  }, [iocs, telem]);

  const kindCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of edges as any[]) map.set(e.dst_type, (map.get(e.dst_type) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [edges]);

  return (
    <div>
      <PageHeader
        title="Threat Intelligence"
        subtitle="Live IOCs fused with transaction geography."
        badge={<span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full hairline bg-emerald-500/10 text-emerald-300">{iocs.length} IOCs · {edges.length} graph edges</span>}
      />

      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 xl:col-span-8">
          <SectionHeader title="Global Threat Map" description="Live transaction destinations · sized by volume" />
          {mapPoints.length ? (
            <ThreatMap points={mapPoints} className="w-full h-[380px]" />
          ) : (
            <div className="h-[380px] grid place-items-center text-xs text-muted-foreground">
              No transaction destinations yet. <Link to="/ingest" className="ml-1 text-cyan-300 hover:underline">Ingest data</Link>
            </div>
          )}
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-4">
          <SectionHeader title="Knowledge Graph Sinks" description="What ingested data connects into" />
          {kindCounts.length ? (
            <div className="space-y-2">
              {kindCounts.map(([k, n]) => (
                <div key={k} className="flex items-center justify-between rounded-lg hairline bg-white/3 p-3">
                  <div className="text-sm font-medium">{k}</div>
                  <div className="text-xs font-mono">{n} edges</div>
                </div>
              ))}
              <Link to="/graph" className="text-xs text-cyan-300 hover:underline inline-flex items-center gap-1 mt-2">Explore graph <ExternalLink className="h-3 w-3" /></Link>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No graph activity yet — ingest a batch to populate.</div>
          )}
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-7 p-0">
          <div className="p-5 pb-2"><SectionHeader title="Known Malicious IPs" description="Auto-correlated with your live cyber telemetry" /></div>
          <div className="overflow-x-auto scrollbar-thin">
            {ipHits.length ? (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-4 [&>th]:py-2">
                    <th>IP</th><th>Category</th><th>Confidence</th><th>Hits</th>
                  </tr>
                </thead>
                <tbody>
                  {ipHits.map((ip) => (
                    <tr key={ip.id} className="border-t border-white/4 hover:bg-white/3">
                      <td className="px-4 py-2 font-mono text-xs">{ip.ip}</td>
                      <td className="px-4 py-2"><RiskBadge severity={(ip.category as Sev) ?? "medium"} /></td>
                      <td className="px-4 py-2 font-mono text-xs">{ip.confidence}%</td>
                      <td className="px-4 py-2 font-mono text-xs">{ip.hits.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">No IOCs recorded yet.</div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 xl:col-span-5">
          <SectionHeader title="Indicators of Compromise" description="Live · streamed from tenant IOC feed" />
          <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
            {iocs.length ? iocs.map((i: any) => (
              <div key={i.id} className="rounded-lg hairline p-2 flex items-center gap-3">
                <div className="h-7 w-7 rounded-md grid place-items-center bg-violet-500/10 text-violet-300"><Bug className="h-3.5 w-3.5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono truncate">{i.value}</div>
                  <div className="text-[10px] text-muted-foreground">{i.type} · {i.severity} · seen {i.seen_count ?? 1}×</div>
                </div>
                <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => navigator.clipboard?.writeText(i.value)}><Copy className="h-3 w-3" /></button>
              </div>
            )) : (
              <div className="text-xs text-muted-foreground flex items-center gap-2"><Skull className="h-4 w-4 opacity-60" /> No IOCs recorded yet.</div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
