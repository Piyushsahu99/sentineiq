import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/sq/logo";
import {
  Shield, Activity, Brain, Network, Atom, FileBarChart2, Zap, Lock,
  ChevronDown, ArrowRight, CheckCircle2, Globe2, IndianRupee,
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

const NAV = [
  { label: "Platform", href: "#platform" },
  { label: "Modules", href: "#modules" },
  { label: "Workflow", href: "#workflow" },
  { label: "FAQ", href: "#faq" },
];

const METRICS = [
  { k: "₹2,400 Cr", v: "Fraud prevented (YTD)" },
  { k: "2.4M", v: "Signals / day correlated" },
  { k: "94 ms", v: "Median decision latency" },
  { k: "12", v: "Global bank tenants" },
];

const CAPABILITIES = [
  { icon: Shield, title: "Unified cyber plane", body: "Firewall, VPN, IAM, endpoint, DNS, email and cloud normalised into one taxonomy." },
  { icon: IndianRupee, title: "Fraud in real time", body: "Every transaction scored on device, geo, velocity and beneficiary trust in under 100 ms." },
  { icon: Network, title: "Entity graph", body: "Customers, devices, IPs, merchants and threat actors modelled as first-class nodes." },
  { icon: Brain, title: "Explainable AI", body: "Each decision ships with contributing features, weights and counter-evidence." },
  { icon: Atom, title: "Quantum readiness", body: "Cryptographic inventory, HNDL exposure and PQ migration priorities per asset." },
  { icon: FileBarChart2, title: "Board-ready reports", body: "DORA, PSD2, PCI DSS 4.0 and risk-committee packs, auto-assembled." },
];

const MODULES: [string, string][] = [
  ["Dashboard", "Executive overview"],
  ["Alerts", "SOC triage queue"],
  ["Transactions", "Fraud correlation"],
  ["Investigations", "AI-generated cases"],
  ["Correlation", "Kill-chain timeline"],
  ["Telemetry", "SIEM unified plane"],
  ["Behaviour", "Customer analytics"],
  ["Threat Intel", "IOC and actor feeds"],
  ["Quantum", "PQ inventory"],
  ["Graph", "Entity relationships"],
  ["Explainable AI", "Model transparency"],
  ["Reports", "Compliance packs"],
];

const WORKFLOW = [
  { n: "01", t: "Ingest", d: "SIEM, core banking, EDR, network and IAM streams normalised." },
  { n: "02", t: "Enrich", d: "Device, geo, IOC and behavioural baselines joined per event." },
  { n: "03", t: "Correlate", d: "Weighted composite risk across cyber and fraud dimensions." },
  { n: "04", t: "Investigate", d: "AI agent drafts root cause, kill-chain and evidence log." },
  { n: "05", t: "Respond", d: "Auto-block, notify or escalate — with a full audit trail." },
];

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
    <div className="min-h-screen relative overflow-x-hidden bg-vault font-body text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-rule opacity-40" />

      {/* Nav */}
      <header className="relative z-20 border-b border-white/6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-muted-foreground">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className="hover:text-foreground transition">{n.label}</a>
            ))}
            <Link to="/about" className="hover:text-foreground transition">About</Link>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {authed ? (
              <button onClick={ctaEnter} className="text-[13px] rounded-md bg-brand text-white font-medium px-4 py-2 hover:brightness-110 whitespace-nowrap">
                Open console
              </button>
            ) : (
              <>
                <Link to="/auth/login" className="hidden sm:inline text-[13px] px-3 py-2 rounded-md text-muted-foreground hover:text-foreground">Sign in</Link>
                <Link to="/auth/login" className="text-[13px] rounded-md bg-brand text-white font-medium px-4 py-2 hover:brightness-110 whitespace-nowrap">
                  Request access
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-14">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[11px] tracking-wide text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Live correlation engine · Random Forest + LLM narration
          </div>

          <h1 className="mt-7 font-display text-[34px] leading-[1.14] sm:text-5xl sm:leading-[1.12] lg:text-[56px] lg:leading-[1.1] tracking-tight">
            Cyber and fraud,<br />
            <span className="text-gradient-brand">correlated in one ledger.</span>
          </h1>

          <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground max-w-2xl">
            SentinelQ joins cyber telemetry, transaction fraud, behavioural analytics, threat
            intelligence and post-quantum risk into a single scored decision — so SOC, fraud and
            risk teams stop arguing over which dashboard is right.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <button onClick={ctaEnter} disabled={checking} className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60">
              {authed ? "Open console" : "Launch demo console"} <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#platform" className="inline-flex items-center gap-2 rounded-md border border-white/12 px-5 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-white/25 transition">
              How it works
            </a>
          </div>
        </motion.div>

        {/* Metric rail */}
        <motion.dl
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mt-14 grid grid-cols-2 lg:grid-cols-4 rule-top border-x border-b border-white/8 rounded-lg overflow-hidden"
        >
          {METRICS.map((m, i) => (
            <div key={m.v} className={`px-5 py-6 ${i % 2 === 1 ? "border-l border-white/8" : ""} ${i >= 2 ? "border-t border-white/8" : ""} lg:border-t-0 ${i > 0 ? "lg:border-l lg:border-white/8" : ""}`}>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{m.v}</dt>
              <dd className="mt-2 font-display text-2xl sm:text-[28px] text-foreground">{m.k}</dd>
            </div>
          ))}
        </motion.dl>

        {/* Live SOC strip */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }} className="mt-6 panel rounded-lg p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[13px] font-medium whitespace-nowrap">Global SOC · Live</span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground truncate">us-east · eu-west · ap-south</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">v4.12.0</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Activity, label: "Alerts (24h)", value: "128", trend: "+12%" },
              { icon: IndianRupee, label: "Blocked wires", value: "₹18.4 Cr", trend: "+3.2%" },
              { icon: Brain, label: "AI investigations", value: "42", trend: "+9%" },
              { icon: Atom, label: "PQ-ready assets", value: "63%", trend: "+8%" },
            ].map((k) => (
              <div key={k.label} className="rounded-md border border-white/8 bg-white/3 p-3">
                <div className="flex items-center justify-between">
                  <k.icon className="h-4 w-4 text-indigo-300" />
                  <span className="text-[10px] font-mono text-emerald-400">{k.trend}</span>
                </div>
                <div className="mt-2 font-display text-lg sm:text-xl truncate">{k.value}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground leading-tight">{k.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Capabilities */}
      <Section id="platform" eyebrow="The platform" title="Correlation, not silos."
        lead="Cyber and fraud teams see the same event, at the same time, with the same evidence chain. Every signal is deduplicated, scored and joined into an entity graph.">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAPABILITIES.map((f) => (
            <article key={f.title} className="panel panel-hover rounded-lg p-6">
              <div className="h-9 w-9 rounded-md grid place-items-center border border-white/10 bg-brand/15">
                <f.icon className="h-4 w-4 text-indigo-300" />
              </div>
              <h3 className="mt-5 font-display text-base">{f.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* Modules */}
      <Section id="modules" eyebrow="Modules" title="Purpose-built for every role."
        action={
          <button onClick={ctaEnter} className="inline-flex items-center gap-2 text-[13px] rounded-md border border-white/12 px-4 py-2 hover:border-white/25 transition">
            Open live demo <ArrowRight className="h-3.5 w-3.5" />
          </button>
        }>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MODULES.map(([n, d]) => (
            <div key={n} className="panel panel-hover rounded-lg p-4">
              <div className="text-[13px] font-medium">{n}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Workflow */}
      <Section id="workflow" eyebrow="Workflow" title="From raw signal to blocked wire.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {WORKFLOW.map((s) => (
            <div key={s.n} className="panel rounded-lg p-5">
              <div className="font-mono text-[11px] text-indigo-300">{s.n}</div>
              <div className="mt-3 font-display text-[15px]">{s.t}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Trust */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="panel rounded-lg p-6 md:p-8 flex flex-wrap items-center gap-6 justify-between">
          <div>
            <div className="font-display text-[15px] flex items-center gap-2"><Lock className="h-4 w-4 text-emerald-400" /> Enterprise-grade by default</div>
            <p className="text-[12px] text-muted-foreground mt-2">Zero-trust access, row-level security and full audit logging for every query and decision.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {["SOC 2 Type II", "ISO 27001", "PCI DSS 4.0", "PSD2", "DORA", "NIST CSF 2.0"].map((c) => (
              <span key={c} className="px-2.5 py-1 rounded-full border border-white/10 bg-white/3">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-300">FAQ</div>
        <h2 className="mt-3 font-display text-2xl md:text-3xl tracking-tight">Questions from CISOs, answered.</h2>
        <div className="mt-8 divide-y divide-white/8 border-y border-white/8">
          {FAQ_ITEMS.map((f, i) => <FaqRow key={i} q={f.q} a={f.a} defaultOpen={i === 0} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="relative panel rounded-xl p-10 text-center overflow-hidden">
          <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-64 w-[620px] rounded-full bg-brand/25 blur-3xl" />
          <div className="relative">
            <Globe2 className="h-7 w-7 mx-auto text-indigo-300" />
            <h2 className="mt-5 font-display text-2xl md:text-3xl tracking-tight">See correlation live.</h2>
            <p className="mt-3 text-[14px] text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Launch the SentinelQ demo tenant with pre-loaded fraud scenarios, threat actors and a live AI copilot.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center">
              <button onClick={ctaEnter} className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:brightness-110">
                <Zap className="h-4 w-4" /> Enter demo console
              </button>
              <Link to="/auth/login" className="rounded-md border border-white/12 px-5 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-white/25 transition">Sign in</Link>
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
              {["No card required", "Pre-loaded scenarios", "Full read/write demo tenant", "Reset any time"].map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> {b}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-[11px] text-muted-foreground/70">
          <div className="flex items-center gap-3"><Logo /> <span>© 2026 SentinelQ · Enterprise Banking Cybersecurity</span></div>
          <div className="flex gap-4"><span>Privacy</span><span>Security</span><span>DPA</span><span>Sub-processors</span></div>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, eyebrow, title, lead, action, children }: {
  id?: string; eyebrow: string; title: string; lead?: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={id} className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-300">{eyebrow}</div>
          <h2 className="mt-3 font-display text-2xl md:text-[32px] leading-tight tracking-tight">{title}</h2>
          {lead && <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
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
    <div>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-4 py-5 text-left group">
        <span className="text-[14px] font-medium group-hover:text-indigo-200 transition">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180 text-indigo-300" : ""}`} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <p className="pb-5 pr-8 text-[13px] text-muted-foreground leading-relaxed">{a}</p>
      </motion.div>
    </div>
  );
}
