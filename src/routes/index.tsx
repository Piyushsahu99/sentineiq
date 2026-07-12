import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/sq/logo";
import { GlassCard } from "@/components/sq/glass-card";
import {
  Shield, Activity, Brain, Network, Atom, FileBarChart2, Zap, Lock,
  ChevronDown, ArrowRight, CheckCircle2, Sparkles, Globe2, DollarSign,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SentinelQ — Banking Cyber AI & Fraud Correlation" },
      { name: "description", content: "Correlate cyber telemetry, fraud, behavioral analytics, and post-quantum risk in real time — for SOC, fraud, risk, and executive teams." },
      { property: "og:title", content: "SentinelQ — Banking Cyber AI & Fraud Correlation" },
      { property: "og:description", content: "Correlate cyber, fraud, and quantum risk in real time. Built for SOC, fraud, risk, and executive teams at modern banks." },
      { property: "og:url", content: "https://sentinel-q.today/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/c8dd4fc7-2143-40e0-b1f3-e97ca18b5270" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/c8dd4fc7-2143-40e0-b1f3-e97ca18b5270" },
    ],
    links: [{ rel: "canonical", href: "https://sentinel-q.today/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    }],
  }),
  component: Landing,
});


function Landing() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
      setChecking(false);
    });
  }, []);

  async function ctaEnter() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { nav({ to: "/auth/login" }); return; }
    const { data: r } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).limit(1).maybeSingle();
    nav({ to: r?.role ? "/dashboard" : "/auth/role-select" });
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-aurora text-foreground">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/10 to-background/95 pointer-events-none" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[ticker_6s_linear_infinite] opacity-60" />

      {/* Nav */}
      <header className="relative z-20 px-4 sm:px-6 md:px-10 py-4 sm:py-5 flex items-center justify-between gap-3">
        <div className="min-w-0 shrink-0"><Logo /></div>
        <nav className="hidden md:flex items-center gap-7 text-xs text-muted-foreground">
          <a href="#platform" className="hover:text-foreground transition">Platform</a>
          <a href="#modules" className="hover:text-foreground transition">Modules</a>
          <a href="#workflow" className="hover:text-foreground transition">Workflow</a>
          <a href="#faq" className="hover:text-foreground transition">FAQ</a>
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {authed ? (
            <button onClick={ctaEnter} className="text-xs rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold px-3 sm:px-4 py-2 hover:brightness-110 whitespace-nowrap">
              Open console
            </button>
          ) : (
            <>
              <Link to="/auth/login" className="text-xs px-2.5 sm:px-3 py-2 rounded-lg hairline hover:bg-white/6">Sign in</Link>
              <Link to="/auth/login" className="text-xs rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold px-3 sm:px-4 py-2 hover:brightness-110 whitespace-nowrap">
                Request access
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-4 sm:px-6 md:px-10 pt-10 sm:pt-14 pb-20 sm:pb-24 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 rounded-full hairline bg-white/3 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300">
            <Sparkles className="h-3 w-3" /> Gemini-powered · Live correlation engine
          </div>
          <h1 className="mt-6 text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] max-w-4xl">
            The unified <span className="text-gradient-cyber">cyber &amp; fraud</span> intelligence platform for modern banks.
          </h1>
          <p className="mt-5 max-w-2xl text-sm md:text-base text-muted-foreground leading-relaxed">
            SentinelQ correlates cyber telemetry, transaction fraud, behavioral analytics, threat intel, and post-quantum risk in real time — so your SOC, fraud, and risk teams work from one source of truth.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={ctaEnter} disabled={checking} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold px-5 py-2.5 text-sm hover:brightness-110 disabled:opacity-60">
              {authed ? "Open console" : "Launch demo console"} <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#modules" className="text-xs px-4 py-2.5 rounded-lg hairline hover:bg-white/6 text-muted-foreground hover:text-foreground">Explore modules</a>
          </div>

          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
            {[
              { k: "$4.2B", v: "Fraud prevented (YTD)" },
              { k: "18M+", v: "Signals/day correlated" },
              { k: "94ms", v: "Median decision latency" },
              { k: "38", v: "Global bank tenants" },
            ].map((s) => (
              <div key={s.v} className="rounded-xl hairline glass px-4 py-3">
                <div className="text-lg font-bold text-gradient-cyber font-mono">{s.k}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Preview card */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="mt-16 relative">
          <div className="absolute -inset-6 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 blur-3xl -z-10" />
          <GlassCard className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold">Global SOC · Live</span>
                <span className="text-[10px] text-muted-foreground">us-east · eu-west · ap-south</span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">correlation.pipeline · v4.12.0</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Activity, label: "Alerts (24h)", value: "1,284", trend: "+12%", color: "text-cyan-300" },
                { icon: DollarSign, label: "Blocked wires", value: "$18.4M", trend: "+3.2%", color: "text-emerald-300" },
                { icon: Brain, label: "AI investigations", value: "312", trend: "+41%", color: "text-violet-300" },
                { icon: Atom, label: "PQ-ready assets", value: "63%", trend: "+8%", color: "text-fuchsia-300" },
              ].map((k) => (
                <div key={k.label} className="rounded-lg hairline bg-white/3 p-3">
                  <div className="flex items-center justify-between">
                    <k.icon className={`h-4 w-4 ${k.color}`} />
                    <span className="text-[9px] text-emerald-400 font-mono">{k.trend}</span>
                  </div>
                  <div className="mt-2 text-xl font-bold font-mono">{k.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Platform pillars */}
      <section id="platform" className="relative z-10 px-4 sm:px-6 md:px-10 py-20 max-w-7xl mx-auto">
        <div className="max-w-2xl">
          <div className="text-[10px] uppercase tracking-widest text-cyan-300">The platform</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Correlation, not silos.</h2>
          <p className="mt-3 text-sm text-muted-foreground">Cyber and fraud teams see the same event, at the same time, with the same evidence chain. Every signal is deduplicated, scored, and joined into an entity graph.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Shield, title: "Unified cyber plane", body: "Firewall, VPN, IAM, endpoint, DNS, email, cloud — normalised into one taxonomy." },
            { icon: DollarSign, title: "Fraud in real time", body: "Score transactions against device, geo, velocity, and beneficiary trust in <100ms." },
            { icon: Network, title: "Entity graph", body: "Customers, devices, IPs, merchants, and threat actors as first-class nodes." },
            { icon: Brain, title: "Explainable AI", body: "Every decision comes with contributing features, weights, and counter-evidence." },
            { icon: Atom, title: "Quantum readiness", body: "Cryptographic inventory, HNDL exposure, and PQ migration priorities per asset." },
            { icon: FileBarChart2, title: "Board-ready reports", body: "DORA, PSD2, PCI DSS 4.0, and internal risk committee packs — auto-assembled." },
          ].map((f) => (
            <GlassCard key={f.title} className="p-5">
              <div className="h-9 w-9 rounded-lg grid place-items-center bg-gradient-to-br from-cyan-400/20 to-violet-500/20 hairline">
                <f.icon className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-4 text-sm font-semibold">{f.title}</div>
              <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.body}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="relative z-10 px-4 sm:px-6 md:px-10 py-20 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-300">Modules</div>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Purpose-built for every role.</h2>
          </div>
          <button onClick={ctaEnter} className="text-xs px-4 py-2 rounded-lg hairline hover:bg-white/6 inline-flex items-center gap-2">
            Open live demo <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Dashboard", "Executive overview"],
            ["Alerts", "SOC triage queue"],
            ["Transactions", "Fraud correlation"],
            ["Investigations", "AI-generated cases"],
            ["Correlation", "Kill-chain timeline"],
            ["Telemetry", "SIEM unified plane"],
            ["Behavior", "Customer analytics"],
            ["Threat Intel", "IOC + actor feeds"],
            ["Quantum", "PQ inventory"],
            ["Graph", "Entity relationships"],
            ["Explainable AI", "Model transparency"],
            ["Reports", "Compliance packs"],
          ].map(([n, d]) => (
            <div key={n} className="rounded-xl hairline bg-white/3 p-4 hover:bg-white/6 transition group">
              <div className="text-sm font-semibold group-hover:text-cyan-300 transition">{n}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="relative z-10 px-4 sm:px-6 md:px-10 py-20 max-w-7xl mx-auto">
        <div className="max-w-2xl">
          <div className="text-[10px] uppercase tracking-widest text-cyan-300">Workflow</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">From raw signal to blocked wire.</h2>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { n: "01", t: "Ingest", d: "SIEM, core banking, EDR, network, and IAM streams normalised." },
            { n: "02", t: "Enrich", d: "Device, geo, IOC, and behavioral baselines joined per event." },
            { n: "03", t: "Correlate", d: "Weighted composite risk score across cyber + fraud dimensions." },
            { n: "04", t: "Investigate", d: "Gemini agent drafts root cause, kill-chain, and evidence log." },
            { n: "05", t: "Respond", d: "Auto-block, notify analyst, or escalate — with full audit trail." },
          ].map((s) => (
            <GlassCard key={s.n} className="p-5 relative">
              <div className="text-[10px] font-mono text-cyan-300">{s.n}</div>
              <div className="mt-2 text-sm font-semibold">{s.t}</div>
              <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{s.d}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Trust bar */}
      <section className="relative z-10 px-4 sm:px-6 md:px-10 py-14 max-w-7xl mx-auto">
        <GlassCard className="p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-6 justify-between">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><Lock className="h-4 w-4 text-emerald-400" /> Enterprise-grade by default</div>
              <div className="text-[11px] text-muted-foreground mt-1">Zero-trust access, row-level security, and full audit logging for every query and decision.</div>
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              {["SOC 2 Type II","ISO 27001","PCI DSS 4.0","PSD2","DORA","NIST CSF 2.0"].map((c) => (
                <span key={c} className="px-2.5 py-1 rounded-full hairline bg-white/3">{c}</span>
              ))}
            </div>
          </div>
        </GlassCard>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 px-4 sm:px-6 md:px-10 py-20 max-w-4xl mx-auto">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-cyan-300">FAQ</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Questions from CISOs, answered.</h2>
          <p className="mt-3 text-sm text-muted-foreground">Everything security leadership asks before rolling SentinelQ to production.</p>
        </div>
        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map((f, i) => <FaqRow key={i} q={f.q} a={f.a} defaultOpen={i === 0} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-4 sm:px-6 md:px-10 py-20 max-w-5xl mx-auto text-center">
        <div className="relative rounded-3xl hairline glass p-10 overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[600px] bg-gradient-to-b from-cyan-500/25 to-transparent blur-3xl" />
          <div className="relative">
            <Globe2 className="h-8 w-8 mx-auto text-cyan-300" />
            <h3 className="mt-4 text-2xl md:text-3xl font-bold">See correlation live.</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
              Launch the SentinelQ demo tenant with pre-loaded fraud scenarios, threat actors, and a live AI copilot.
            </p>
            <div className="mt-6 inline-flex flex-wrap gap-3 justify-center">
              <button onClick={ctaEnter} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold px-5 py-2.5 text-sm hover:brightness-110">
                <Zap className="h-4 w-4" /> Enter demo console
              </button>
              <Link to="/auth/login" className="text-xs px-4 py-2.5 rounded-lg hairline hover:bg-white/6">Sign in</Link>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
              {["No card required","Pre-loaded scenarios","Full read/write demo tenant","Reset any time"].map((b) => (
                <span key={b} className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> {b}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-4 sm:px-6 md:px-10 py-8 border-t border-white/6 flex flex-wrap items-center justify-between gap-4 text-[10px] text-muted-foreground/70">
        <div className="flex items-center gap-3"><Logo /> <span>© 2026 SentinelQ · Enterprise Banking Cybersecurity</span></div>
        <div className="flex gap-4"><span>Privacy</span><span>Security</span><span>DPA</span><span>Sub-processors</span></div>
      </footer>
    </div>
  );
}

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "How is SentinelQ different from a SIEM like Splunk or Sentinel?",
    a: "SIEMs collect and search logs. SentinelQ sits above your SIEM and joins cyber telemetry with core-banking transactions, behavioral baselines, threat intel, and quantum risk into a single correlated decision. Your existing SIEM keeps ingesting — SentinelQ turns it into blocked wires and closed cases.",
  },
  {
    q: "How does the AI copilot avoid hallucinations?",
    a: "The copilot is grounded on live tenant data: alerts, transactions, telemetry rows, and the entity graph — every answer is derived from rows we can cite, and the underlying prompt forbids the model from stating facts not present in the pulled context. Investigations link back to the exact records used as evidence.",
  },
  {
    q: "Where does the correlation happen — client, server, or model?",
    a: "Correlation is a deterministic server-side function that runs on every ingested transaction and cyber event. The AI layer only summarises and explains what the correlation engine already scored. That means decisions are reproducible, auditable, and independent of model drift.",
  },
  {
    q: "What does deployment look like for a bank?",
    a: "SentinelQ ships as a managed multi-tenant SaaS with a private single-tenant option for tier-1 banks. Data is isolated by row-level security policies keyed to the tenant. Typical onboarding is 4–6 weeks: connectors, RBAC mapping, playbook tuning, and parallel-run validation against your existing controls.",
  },
  {
    q: "How is customer PII protected?",
    a: "PII is minimised at ingest, tokenised at rest, and never sent to any external model provider. The AI copilot uses tenant-scoped context with a strict no-retention policy. All access is audited and RLS-enforced per role: SOC, fraud, risk, and executive.",
  },
  {
    q: "What compliance frameworks are covered?",
    a: "SOC 2 Type II, ISO 27001, PCI DSS 4.0, PSD2 SCA, DORA operational resilience, and NIST CSF 2.0. Every alert, investigation, and executive report maps to specific control IDs and is exportable for auditor review.",
  },
  {
    q: "What is the post-quantum readiness module?",
    a: "It inventories your cryptographic assets — TLS endpoints, signing keys, HSMs, PKI, and long-lived data — and scores Harvest-Now-Decrypt-Later exposure. It then proposes a migration path to hybrid PQ (Kyber / Dilithium) prioritised by business impact and remaining lifetime of the protected data.",
  },
  {
    q: "Can I try it without connecting my own bank data?",
    a: "Yes. Launch the demo console above and you get a fully populated tenant with synthetic customers, transactions, threat actors, and a working correlation engine. Trigger a suspicious transaction from the Transactions page and watch a full investigation get generated in real time.",
  },
];

function FaqRow({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl hairline glass overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/3 transition">
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180 text-cyan-300" : ""}`} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <div className="px-5 pb-5 text-xs text-muted-foreground leading-relaxed">{a}</div>
      </motion.div>
    </div>
  );
}
