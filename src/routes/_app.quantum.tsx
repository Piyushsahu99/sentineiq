import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBadge } from "@/components/sq/risk";
import { ProgressRing } from "@/components/sq/progress-ring";
import { cryptoAssets, quantumRoadmap, kpis } from "@/lib/mock/data";
import { Atom, ShieldCheck, Clock } from "lucide-react";
import { usePrefs, formatCompact } from "@/lib/currency";

export const Route = createFileRoute("/_app/quantum")({
  component: QuantumPage,
});

function QuantumPage() {
  const prefs = usePrefs();
  const hndlTotal = cryptoAssets.reduce((s, a) => s + a.hndl, 0);
  return (
    <div>
      <PageHeader
        title="Quantum Risk Monitoring"
        subtitle="Cryptographic inventory, Harvest-Now-Decrypt-Later exposure, and post-quantum migration path."
        badge={<span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/20 to-blue-500/20 hairline">PQC</span>}
      />

      <div className="grid grid-cols-12 gap-6 mb-6">
        <GlassCard className="col-span-12 md:col-span-4 flex items-center gap-6 justify-center">
          <ProgressRing value={kpis.quantumReadiness} label="Readiness" size={160} color="var(--cyber-violet)" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantum Readiness</div>
            <div className="text-sm">Above industry benchmark (banking sector: 41%)</div>
            <div className="text-[11px] text-muted-foreground mt-2">Next uplift: hybrid Kyber+X25519 in customer channels</div>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">HNDL Exposure</div>
              <div className="text-3xl font-mono mt-1">{formatCompact(hndlTotal, prefs)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Long-term sensitive data protected by pre-quantum crypto</div>
            </div>
            <div className="h-10 w-10 rounded-xl grid place-items-center hairline bg-rose-500/10 text-rose-300"><Clock className="h-5 w-5" /></div>
          </div>
          <div className="mt-4 space-y-1.5 text-xs">
            <div className="flex justify-between"><span>Client PII (7y retention)</span><span className="font-mono">{formatCompact(210_000_000, prefs)}</span></div>
            <div className="flex justify-between"><span>Wire audit trail (10y)</span><span className="font-mono">{formatCompact(340_000_000, prefs)}</span></div>
            <div className="flex justify-between"><span>Contracts &amp; loan docs</span><span className="font-mono">{formatCompact(88_000_000, prefs)}</span></div>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Migration Strategy</div>
              <div className="text-lg font-semibold mt-1">Hybrid PQC</div>
              <div className="text-[11px] text-muted-foreground">NIST-selected · agility library in place</div>
            </div>
            <div className="h-10 w-10 rounded-xl grid place-items-center hairline bg-violet-500/10 text-violet-300"><Atom className="h-5 w-5" /></div>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            {["Kyber-1024 (KEM)","Dilithium3 (Sign)","Falcon-512 (Cert)","SPHINCS+ (Backup)"].map((a) => (
              <div key={a} className="flex items-center justify-between rounded-md hairline bg-white/3 px-2 py-1">
                <span>{a}</span>
                <RiskBadge severity="info" label="approved" />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mb-6 p-0">
        <div className="p-5 pb-2"><SectionHeader title="Cryptographic Asset Inventory" description="Grouped by primitive · sorted by migration priority" /></div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-4 [&>th]:py-2">
                <th>Asset</th><th>Count</th><th>Migration Risk</th><th>HNDL Exposure</th><th>Recommended</th>
              </tr>
            </thead>
            <tbody>
              {cryptoAssets.map((a) => (
                <tr key={a.asset} className="border-t border-white/4 hover:bg-white/3">
                  <td className="px-4 py-2.5 font-medium text-sm">{a.asset}</td>
                  <td className="px-4 py-2.5 font-mono">{a.count.toLocaleString()}</td>
                  <td className="px-4 py-2.5"><RiskBadge severity={a.risk} /></td>
                  <td className="px-4 py-2.5 font-mono">${(a.hndl/1_000_000).toFixed(1)}M</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.risk === "critical" ? "Immediate deprecation" : a.risk === "high" ? "Migrate to hybrid PQC" : a.risk === "medium" ? "Plan Q2 rotation" : "Monitor"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Quantum Readiness Timeline" description="Program milestones" action={<span className="text-[10px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> aligned with CISA PQC roadmap</span>} />
        <div className="relative pl-4">
          <span className="absolute left-1 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400/50 to-violet-500/50" />
          {quantumRoadmap.map((m) => (
            <div key={m.q} className="relative mb-4 last:mb-0">
              <span className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ${m.status === "done" ? "bg-emerald-400" : m.status === "in-progress" ? "bg-amber-400 pulse-ring" : "bg-white/30"}`} />
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-16">{m.q}</span>
                <span className="text-sm font-medium">{m.milestone}</span>
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${m.status === "done" ? "bg-emerald-500/15 text-emerald-300" : m.status === "in-progress" ? "bg-amber-500/15 text-amber-300" : "bg-white/6 text-muted-foreground"}`}>{m.status}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
