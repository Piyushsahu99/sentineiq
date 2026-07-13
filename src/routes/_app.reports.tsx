import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { FileText, Shield, DollarSign, Briefcase, ScrollText, Download } from "lucide-react";
import { toast } from "sonner";
import { usePrefs, formatCompact } from "@/lib/currency";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

const reports = [
  { k: "soc", name: "SOC Weekly Report", icon: Shield, desc: "Alerts, MTTD/MTTR, top attack categories, coverage gaps.", accent: "from-cyan-500/20 to-blue-500/20" },
  { k: "fraud", name: "Fraud Analytics Report", icon: DollarSign, desc: "Prevented losses, top typologies, model performance, decisions.", accent: "from-violet-500/20 to-fuchsia-500/20" },
  { k: "exec", name: "Executive Briefing", icon: Briefcase, desc: "Board-level KPIs, notable incidents, strategic risk, quantum posture.", accent: "from-emerald-500/20 to-teal-500/20" },
  { k: "comp", name: "Compliance Report", icon: ScrollText, desc: "PSD2 SCA, DORA incidents, GDPR breach registry, PCI DSS controls.", accent: "from-amber-500/20 to-rose-500/20" },
] as const;

function ReportsPage() {
  const [sel, setSel] = useState<typeof reports[number]["k"]>("exec");
  const r = reports.find((x) => x.k === sel)!;
  const prefs = usePrefs();
  const fraudPrevented = formatCompact(24_600_000, prefs);

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Auto-generated, evidence-linked reports for SOC, Fraud, Compliance, and the board."
        actions={<button onClick={() => toast.success(r.name + " exported as PDF")} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110 inline-flex items-center gap-1"><Download className="h-3 w-3" />Download</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {reports.map((r) => (
          <button key={r.k} onClick={() => setSel(r.k)} className={`glass rounded-2xl p-4 text-left relative overflow-hidden hover:border-white/12 ${sel === r.k ? "border-cyan-400/40 ring-1 ring-cyan-400/20" : ""}`}>
            <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${r.accent} blur-2xl opacity-50`} />
            <div className="relative">
              <div className="h-9 w-9 rounded-xl grid place-items-center hairline mb-3">
                <r.icon className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="text-sm font-semibold">{r.name}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{r.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-300" />
            <span className="text-sm font-semibold">{r.name} — Preview</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Generated 2 min ago · signed by SentinelQ v2.4.1</span>
        </div>
        <div className="p-8 md:p-12 bg-gradient-to-b from-white/2 to-transparent max-h-[720px] overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">SentinelQ · Confidential</div>
                <h1 className="text-2xl font-bold mt-1">{r.name}</h1>
                <div className="text-xs text-muted-foreground mt-1">Reporting period · Nov 24 – Nov 30, 2026 · Bank AG</div>
              </div>
              <div className="text-right text-[10px] text-muted-foreground">
                <div>Prepared for: Chief Risk Officer</div>
                <div>Distribution: TLP:AMBER</div>
              </div>
            </div>

            <section className="mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive summary</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                SentinelQ processed <b className="text-foreground">8.94M</b> transactions and <b className="text-foreground">148K</b> security events this period.
                <b className="text-foreground"> 42 critical threats</b> were auto-mitigated, preventing an estimated <b className="text-foreground">{fraudPrevented}</b> in fraud losses.
                False-positive rate reduced by <b className="text-foreground">78%</b> vs prior quarter. Quantum readiness is at <b className="text-foreground">62%</b>,
                ahead of the industry benchmark (41%).
              </p>
            </section>

            <section className="mb-6 grid grid-cols-3 gap-3">
              {[
                { l: "Fraud Prevented", v: fraudPrevented },
                { l: "Critical Alerts", v: "42" },
                { l: "MTTD / MTTR", v: "3m / 11m" },
              ].map((k) => (
                <div key={k.l} className="rounded-lg hairline p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">{k.l}</div>
                  <div className="text-lg font-mono">{k.v}</div>
                </div>
              ))}
            </section>

            <section className="mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notable incidents</h2>
              <ol className="list-decimal ml-5 space-y-1 text-sm text-muted-foreground">
                <li>INV-2447 — Coordinated APP fraud attempt (€482K) attributed to FIN7-Wire-24Q4. Blocked.</li>
                <li>INV-2445 — APT beaconing on core-banking segment. 3 endpoints isolated.</li>
                <li>INV-2442 — Insider staging attempt on treasury desk. Contained.</li>
              </ol>
            </section>

            <section className="mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recommendations</h2>
              <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
                <li>Deprecate remaining TLS 1.0 endpoints ahead of Q1 audit.</li>
                <li>Accelerate hybrid Kyber+X25519 pilot in mobile banking channel.</li>
                <li>Extend behaviour model with password-reset→beneficiary velocity feature.</li>
              </ul>
            </section>

            <footer className="mt-10 pt-6 border-t border-white/6 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>SentinelQ Report · Cryptographically signed · Tamper-evident</span>
              <span>Page 1 / 12</span>
            </footer>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
