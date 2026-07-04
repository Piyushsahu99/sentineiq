import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { ProgressRing } from "@/components/sq/progress-ring";
import { RiskBadge } from "@/components/sq/risk";
import { recentInvestigations } from "@/lib/mock/data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, FileText, CheckSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/investigations")({
  component: InvestigationsPage,
});

const inv = {
  id: "INV-2447",
  title: "Coordinated wire fraud via account takeover",
  attackType: "Account Takeover → Authorized Push Payment (APP) Fraud",
  confidence: 97,
  impactUsd: 482_000,
  rootCause: "Endpoint compromise (RedLine infostealer) → credential theft → self-service password reset → new-beneficiary + oversized wire, coordinated with a mule IBAN from the FIN7-Wire-24Q4 campaign.",
  actions: [
    "Auto-hold SWIFT MT103 EUR 482,000 (completed)",
    "Force-revoke sessions and re-enrol MFA for customer C-88214",
    "Isolate Win11-Fresh endpoint via EDR; collect memory + prefetch",
    "File SAR with FIU referencing FIN7-Wire-24Q4 attribution",
    "Add IBAN NL22 INGB 0007 214 921 to internal deny-list, propagate via FS-ISAC",
    "Update fraud model: add feature ‘password-reset → new-beneficiary within 10m’",
  ],
  risk: [
    { l: "Threat Intel Match", w: "critical" as const, note: "Europol EMPACT mule feed" },
    { l: "Behaviour Delta", w: "high" as const, note: "0.91 · 34× baseline amount" },
    { l: "Endpoint Compromise", w: "critical" as const, note: "RedLine C2 quarantined" },
    { l: "Session Anomaly", w: "medium" as const, note: "New device + VPN + reset in 10m" },
    { l: "Customer Vulnerability", w: "low" as const, note: "Wealth segment, high-value account" },
  ],
};

function InvestigationsPage() {
  return (
    <div>
      <PageHeader
        title="AI Investigation"
        subtitle="Automatically generated, explainable, evidence-linked incident narrative — ready for SOC, Fraud, and Compliance."
        actions={
          <>
            <button onClick={() => toast.success("PDF export queued (INV-2447.pdf)")} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110 inline-flex items-center gap-1"><Download className="h-3 w-3" /> Download PDF</button>
            <button className="text-xs px-3 py-1.5 rounded-lg hairline hover:bg-white/6">Share with L2</button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-6 mb-6">
        <GlassCard className="col-span-12 lg:col-span-8 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-400/20 to-violet-500/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-cyan-300" />
              AI Attack Summary · Case {inv.id}
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-tight">{inv.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
              A high-value Wealth Management customer was targeted by an <b className="text-foreground">RedLine info-stealer</b> that harvested credentials from
              a personal Windows 11 device. The attacker used a <b className="text-foreground">commercial VPN in NL</b> to log in, reset the account
              password, add a new beneficiary linked to the <b className="text-foreground">FIN7-Wire-24Q4</b> mule network, and initiate a
              <b className="text-foreground"> €482,000 SWIFT MT103</b>. SentinelQ correlated cyber, fraud, behavioural and threat-intel signals in 11 minutes
              end-to-end and auto-mitigated the transaction with <b className="text-foreground">97% confidence</b>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["PSD2 SCA","DORA reportable","GDPR breach: N","FIN7 attribution","SWIFT MT103","APP Fraud"].map((t) => (
                <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full hairline bg-white/4">{t}</span>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 lg:col-span-4 flex items-center gap-6 justify-center">
          <ProgressRing value={inv.confidence} label="Confidence" size={140} />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Impact Averted</div>
            <div className="text-2xl font-bold font-mono">${inv.impactUsd.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-2">Attack Type</div>
            <div className="text-sm font-medium">{inv.attackType}</div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 lg:col-span-8">
          <SectionHeader title="Root Cause" />
          <p className="text-sm text-muted-foreground leading-relaxed">{inv.rootCause}</p>

          <SectionHeader title="Evidence" description="Sample log excerpts and correlated telemetry" />
          <div className="rounded-lg hairline bg-black/40 font-mono text-[11px] p-3 space-y-1 overflow-x-auto scrollbar-thin">
            <div><span className="text-cyan-300">EDR:</span> <span className="text-muted-foreground">detection.family=RedLine action=quarantine host=Win11-Fresh proc=chrome.exe pid=8142</span></div>
            <div><span className="text-cyan-300">IAM:</span> <span className="text-muted-foreground">event=password.reset user=j.watson channel=email-token ip=185.220.101.44 duration=42s</span></div>
            <div><span className="text-cyan-300">NET:</span> <span className="text-muted-foreground">vpn.exit=NordVPN-NL-421 asn=AS9009 geo=NL geo_delta_km=1200</span></div>
            <div><span className="text-cyan-300">CORE:</span> <span className="text-muted-foreground">beneficiary.add iban=NL22INGB0007214921 first_seen=true mcc_risk=high</span></div>
            <div><span className="text-cyan-300">PAY:</span> <span className="text-muted-foreground">swift.mt103 amount=482000 ccy=EUR baseline_median=14235 delta_x=33.87</span></div>
            <div><span className="text-cyan-300">TI:</span>  <span className="text-muted-foreground">match feed=EMPACT campaign=FIN7-Wire-24Q4 confidence=0.96 ttl=72h</span></div>
          </div>

          <SectionHeader title="Recommended Actions" />
          <div className="space-y-2">
            {inv.actions.map((a) => (
              <label key={a} className="flex items-start gap-2 text-sm cursor-pointer">
                <CheckSquare className="h-4 w-4 mt-0.5 text-cyan-300" />
                <span>{a}</span>
              </label>
            ))}
          </div>

          <div className="mt-6">
            <Accordion type="multiple" className="space-y-2">
              <AccordionItem value="tech" className="hairline rounded-lg px-4">
                <AccordionTrigger className="text-sm">Technical Details</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  RedLine variant hash <span className="font-mono">b8f2c19ac1e2…a0f1</span> matched YARA <span className="font-mono">Redline_v3_stealer</span>. C2 <span className="font-mono">c2.pay-alerts[.]xyz</span> resolved via DoH from endpoint. Endpoint EDR (SentinelOne) score 94. Session risk fingerprint delta 0.91.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="biz" className="hairline rounded-lg px-4">
                <AccordionTrigger className="text-sm">Business Summary</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  A Wealth Management customer nearly lost €482,000 to a coordinated fraud ring linked to FIN7. SentinelQ intercepted the wire before settlement, avoiding potential reputational damage and liability under PSD2 SCA rules. No customer funds were lost. Recommended executive briefing.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="comp" className="hairline rounded-lg px-4">
                <AccordionTrigger className="text-sm">Compliance Notes</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-1">
                  <div>• <b>DORA</b> — Significant incident under Art. 19; report within 24h.</div>
                  <div>• <b>PSD2 SCA</b> — Reset event bypassed strong customer authentication proxy; investigate control gap.</div>
                  <div>• <b>GDPR</b> — No personal data disclosed to third party; no Art.33 notification required.</div>
                  <div>• <b>FS-ISAC</b> — Share IOCs (IBAN, IP, hash) under TLP:AMBER within 4h.</div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </GlassCard>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <GlassCard>
            <SectionHeader title="Risk Factors" />
            <div className="space-y-2">
              {inv.risk.map((r) => (
                <div key={r.l} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">{r.l}</div>
                    <div className="text-[11px] text-muted-foreground">{r.note}</div>
                  </div>
                  <RiskBadge severity={r.w} />
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader title="Related Investigations" />
            <div className="space-y-2">
              {recentInvestigations.slice(1,5).map((i) => (
                <div key={i.id} className="flex items-start gap-2 text-sm hover:bg-white/3 rounded-md p-1.5 cursor-pointer">
                  <FileText className="h-3.5 w-3.5 mt-0.5 text-violet-300" />
                  <div>
                    <div className="text-xs font-medium">{i.title}</div>
                    <div className="text-[10px] text-muted-foreground">{i.id} · {i.confidence}%</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
