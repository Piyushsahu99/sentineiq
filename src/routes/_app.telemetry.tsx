import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBadge } from "@/components/sq/risk";
import { useTelemetry } from "@/lib/live-queries";
import { Sparkline } from "@/components/sq/sparkline";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/telemetry")({
  ssr: false,
  component: TelemetryPage,
});

type Sev = "critical" | "high" | "medium" | "low" | "info";
const SEV_ORDER: Sev[] = ["critical", "high", "medium", "low", "info"];

function classify(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (/vpn|tor/.test(m)) return "VPN";
  if (/malware|beacon|c2|infostealer|ransomware|redline/.test(m)) return "Endpoint";
  if (/phish|credential|password/.test(m)) return "Email";
  if (/mfa|login|auth|sim.?swap|device/.test(m)) return "Authentication";
  if (/dns|domain|tunnel/.test(m)) return "DNS";
  if (/firewall|block|deny/.test(m)) return "Firewall";
  if (/cloud|aws|azure|gcp/.test(m)) return "Cloud";
  return "IAM";
}

function TelemetryPage() {
  const { data: events = [], isLoading } = useTelemetry(200);
  const [cat, setCat] = useState<string | null>(null);

  const enriched = useMemo(() => events.map((e: any) => ({ ...e, kind: classify(e.message ?? "") })), [events]);
  const categories = useMemo(() => {
    const c = new Map<string, number>();
    enriched.forEach((e) => c.set(e.kind, (c.get(e.kind) ?? 0) + 1));
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [enriched]);
  const filtered = cat ? enriched.filter((e) => e.kind === cat) : enriched;

  const sevCounts = SEV_ORDER.map((s) => ({ sev: s, n: filtered.filter((e) => e.severity === s).length }));
  // 24-bucket trend of last 200 events by hour
  const trend = useMemo(() => {
    const now = Date.now();
    const buckets = new Array(24).fill(0);
    for (const e of enriched) {
      const t = new Date(e.created_at).getTime();
      const idx = 23 - Math.min(23, Math.floor((now - t) / 3600_000));
      if (idx >= 0) buckets[idx]++;
    }
    return buckets;
  }, [enriched]);

  return (
    <div>
      <PageHeader
        title="Cybersecurity Telemetry"
        subtitle="Live cyber events feeding the risk engine."
        badge={<span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full hairline bg-emerald-500/10 text-emerald-300">{events.length} live</span>}
      />


      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setCat(null)} className={`px-3 py-1.5 rounded-lg text-sm hairline ${!cat ? "bg-white/10 border-cyan-400/40" : "bg-white/3 text-muted-foreground hover:text-foreground"}`}>All</button>
        {categories.map(([c, n]) => (
          <button key={c} onClick={() => setCat(c)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hairline transition ${cat === c ? "bg-white/10 border-cyan-400/40" : "bg-white/3 text-muted-foreground hover:text-foreground"}`}>
            {c} <span className="text-[10px] font-mono opacity-70">{n}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 lg:col-span-4">
          <SectionHeader title="Event Volume" description="Last 24 hours · hourly bucketed" />
          <Sparkline data={trend} color="var(--cyber-cyan)" width={340} height={90} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {sevCounts.slice(0, 3).map(({ sev, n }) => (
              <div key={sev} className="rounded-lg hairline p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{sev}</div>
                <div className="text-lg font-mono">{n}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 lg:col-span-8 p-0">
          <div className="p-4 flex items-center justify-between border-b border-white/6 gap-3">
            <div className="text-sm font-semibold truncate">{cat ?? "All"} events</div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> streaming</span>
          </div>
          <div className="max-h-[540px] overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <AlertTriangle className="h-6 w-6 opacity-60" />
                {isLoading ? "Loading telemetry…" : (
                  <>No {cat ?? ""} events yet. <Link to="/ingest" className="text-cyan-300 hover:underline">Ingest a batch</Link> to populate this view.</>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {filtered.map((e: any) => (
                  <li key={e.id} className="px-4 py-2.5 hover:bg-white/3 flex items-start gap-3">
                    <RiskBadge severity={(e.severity ?? "info") as Sev} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-foreground truncate">{e.message}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{e.kind} · {e.user_ref ?? "—"} · {e.ip ?? "—"}</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </GlassCard>

          </div>
        </GlassCard>
      </div>
    </div>
  );
}
