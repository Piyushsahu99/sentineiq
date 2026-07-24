import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/sq/logo";
import { GlassCard } from "@/components/sq/glass-card";
import {
  Shield, Brain, Atom, Network, Activity, Zap, Lock, Layers,
  Database, Cpu, GitBranch, LineChart, Users, Server, Cloud,
  ArrowRight, CheckCircle2, Sparkles, AlertTriangle, Gauge, Globe2,
  FileBarChart2, Workflow, Boxes, ShieldCheck, Radar, KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "About SentinelQ — How Our Cyber + Fraud AI Works" },
      { name: "description", content: "How SentinelQ correlates cyber telemetry, transactions, behavior, and quantum risk — the problem, our engine, models, architecture, metrics, and business impact." },
      { property: "og:title", content: "About SentinelQ — How Our Cyber + Fraud AI Works" },
      { property: "og:description", content: "The problem, our correlation engine, AI models, architecture, security, scalability, and business impact behind SentinelQ." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sentinel-q.today/about" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/c8dd4fc7-2143-40e0-b1f3-e97ca18b5270" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/c8dd4fc7-2143-40e0-b1f3-e97ca18b5270" },
    ],
    links: [{ rel: "canonical", href: "https://sentinel-q.today/about" }],
  }),
  component: About,
});

function About() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
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

      {/* Nav */}
      <header className="relative z-20 px-4 sm:px-6 md:px-10 py-4 sm:py-5 flex items-center justify-between gap-3">
        <Link to="/" className="min-w-0 shrink-0"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-7 text-xs text-muted-foreground">
          <Link to="/" hash="platform" className="hover:text-foreground transition">Platform</Link>
          <Link to="/" hash="modules" className="hover:text-foreground transition">Modules</Link>
          <Link to="/about" className="text-foreground">About</Link>
          <Link to="/" hash="faq" className="hover:text-foreground transition">FAQ</Link>
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={ctaEnter} className="text-xs rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold px-3 sm:px-4 py-2 hover:brightness-110 whitespace-nowrap">
            {authed ? "Open console" : "Launch demo"}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-4 sm:px-6 md:px-10 pt-10 sm:pt-14 pb-16 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 rounded-full hairline bg-white/3 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300">
            <Sparkles className="h-3 w-3" /> About SentinelQ · Evaluator brief
          </div>
          <h1 className="mt-6 text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] max-w-4xl">
            Unified <span className="text-gradient-cyber">cyber &amp; fraud</span> intelligence for modern banks.
          </h1>
          <p className="mt-5 max-w-2xl text-sm md:text-base text-muted-foreground leading-relaxed">
            SentinelQ collapses SOC, fraud, and quantum-risk workflows into a single correlated decision plane — with a deterministic scoring engine, explainable AI narratives, and enterprise controls.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={ctaEnter} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold px-5 py-2.5 text-sm hover:brightness-110">
              Launch demo console <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#architecture" className="text-xs px-4 py-2.5 rounded-lg hairline hover:bg-white/6 text-muted-foreground hover:text-foreground">View architecture</a>
          </div>
        </motion.div>
      </section>

      {/* Problem */}
      <Section id="problem" kicker="01 · The problem" title="Banks fight fraud and cyber threats in silos.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Users, stat: "3 teams", t: "Fragmented response", d: "SOC, fraud ops, and risk each see one slice of the same attack — evidence doesn't join up until after the money leaves." },
            { icon: AlertTriangle, stat: "10k+/day", t: "Alert fatigue", d: "Legacy SIEMs bury analysts in low-confidence noise. Real kill-chains hide in the queue for hours." },
            { icon: Atom, stat: "HNDL", t: "Quantum on the horizon", d: "Harvest-Now-Decrypt-Later attacks target long-lived customer data. Nobody has a cryptographic inventory." },
          ].map((f) => (
            <GlassCard key={f.t} className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg grid place-items-center bg-gradient-to-br from-cyan-400/20 to-violet-500/20 hairline">
                  <f.icon className="h-4 w-4 text-cyan-300" />
                </div>
                <span className="text-[10px] font-mono text-cyan-300">{f.stat}</span>
              </div>
              <div className="mt-4 text-sm font-semibold">{f.t}</div>
              <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.d}</div>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* Solution */}
      <Section id="solution" kicker="02 · Our solution" title="One correlation plane. Every signal joins.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              SentinelQ ingests cyber telemetry, core-banking transactions, behavioral baselines, threat intel, and cryptographic posture into a single entity graph. A deterministic scoring engine produces one composite decision per transaction; a Gemini-powered copilot explains it in bank-grade language.
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {[
                "Every alert cites the exact rows used as evidence.",
                "Combo escalators fire on kill-chains — no averaging away high-risk signals.",
                "Decisions are reproducible, auditable, and independent of model drift.",
                "Analyst feedback tunes suppression without retraining.",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" /> {x}</li>
              ))}
            </ul>
          </div>
          <GlassCard className="p-5">
            <div className="text-[10px] uppercase tracking-widest text-cyan-300">Decision pipeline</div>
            <div className="mt-4 space-y-2">
              {[
                { icon: Database, t: "Ingest", d: "SIEM · core banking · EDR · IAM · DNS" },
                { icon: Layers, t: "Enrich", d: "device · geo · IOC · behavioral baseline" },
                { icon: GitBranch, t: "Correlate", d: "weighted signals + combo escalators" },
                { icon: Brain, t: "Investigate", d: "Gemini narrative + evidence log" },
                { icon: Zap, t: "Respond", d: "block · notify · escalate · audit" },
              ].map((s, i) => (
                <div key={s.t} className="flex items-center gap-3 rounded-lg hairline bg-white/3 px-3 py-2.5">
                  <div className="h-7 w-7 rounded-md grid place-items-center bg-gradient-to-br from-cyan-400/20 to-violet-500/20">
                    <s.icon className="h-3.5 w-3.5 text-cyan-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold">{s.t}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{s.d}</div>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground">0{i + 1}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </Section>

      {/* Features */}
      <Section id="features" kicker="03 · Key features & innovation" title="Purpose-built for correlated decisions.">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Gauge, t: "Weighted correlation engine", d: "Typed signals across fraud, cyber, and quantum dimensions — each with tuned weights and confidence." },
            { icon: Radar, t: "Combo escalators", d: "ATO chains, full kill-chains, and wire-out-of-country combos apply bonuses instead of averaging." },
            { icon: Brain, t: "Explainable AI narratives", d: "Every decision ships with risk breakdown, contributors, confidence, and recommended action." },
            { icon: LineChart, t: "Behavioral baselines", d: "90-day rolling z-scores on amount, hour, merchant, and device — flags dormant-account revival." },
            { icon: Atom, t: "Post-quantum readiness", d: "TLS + key-lifetime inventory scores HNDL exposure and prioritises PQ migration." },
            { icon: ShieldCheck, t: "Feedback loop + suppression", d: "Analyst feedback auto-tunes false-positive rules per customer without retraining." },
          ].map((f) => (
            <GlassCard key={f.t} className="p-5">
              <div className="h-9 w-9 rounded-lg grid place-items-center bg-gradient-to-br from-cyan-400/20 to-violet-500/20 hairline">
                <f.icon className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-4 text-sm font-semibold">{f.t}</div>
              <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.d}</div>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* Architecture */}
      <Section id="architecture" kicker="04 · Technical architecture" title="Edge-first, RLS-secured, model-agnostic.">
        <div className="space-y-3">
          {[
            { icon: Layers, layer: "Presentation", items: ["React 19", "TanStack Start", "Tailwind v4", "shadcn/ui", "Framer Motion", "Leaflet + OpenStreetMap"] },
            { icon: Server, layer: "Server logic", items: ["TanStack createServerFn", "Cloudflare Workers", "Zod validation", "correlation-core.server.ts"] },
            { icon: Database, layer: "Data plane", items: ["Postgres", "Row-Level Security", "Realtime channels", "Storage", "Auth + TOTP MFA"] },
            { icon: Cpu, layer: "AI layer", items: ["Lovable AI Gateway", "Gemini 2.5 Flash", "Deterministic scorer", "Behavioral z-score model", "PQ scorer"] },
            { icon: Activity, layer: "Observability & QA", items: ["Vitest accuracy harness", "Playwright smoke suite", "Analyst feedback telemetry"] },
          ].map((row) => (
            <div key={row.layer} className="rounded-xl hairline glass p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 sm:w-56 shrink-0">
                <div className="h-8 w-8 rounded-md grid place-items-center bg-gradient-to-br from-cyan-400/20 to-violet-500/20 hairline">
                  <row.icon className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="text-xs font-semibold">{row.layer}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.items.map((it) => (
                  <span key={it} className="text-[10px] font-mono px-2 py-1 rounded-full hairline bg-white/3 text-muted-foreground">{it}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Models & APIs */}
      <Section id="models" kicker="05 · Models & APIs" title="What's under the hood.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: Brain, name: "google/gemini-2.5-flash", role: "Narrative synthesis + Copilot Q&A", io: "risk breakdown + timeline → analyst-grade narrative", latency: "~1.2s p50" },
            { icon: GitBranch, name: "Correlation core (in-house)", role: "Deterministic weighted scorer with combo escalators", io: "signals + context → composite score, band, decision", latency: "~94ms p50" },
            { icon: LineChart, name: "Behavioral baseline model", role: "90-day rolling z-scores per customer", io: "amount · hour · merchant · device → anomaly deltas", latency: "~30ms p50" },
            { icon: Atom, name: "PQ readiness scorer", role: "HNDL exposure across TLS + key inventory", io: "asset lifetime + algo → PQ priority score", latency: "batch" },
            { icon: Cloud, name: "Supabase PostgREST + Realtime", role: "Data API, RLS, live channels for alerts & investigations", io: "SQL rows ↔ typed client + websocket", latency: "~40ms p50" },
            { icon: Globe2, name: "OpenStreetMap tiles", role: "Threat map basemap (open-source)", io: "tile x/y/z → raster tile", latency: "CDN edge" },
          ].map((m) => (
            <GlassCard key={m.name} className="p-5">
              <div className="flex items-center gap-2">
                <m.icon className="h-4 w-4 text-cyan-300" />
                <span className="text-xs font-mono font-semibold truncate">{m.name}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{m.role}</div>
              <div className="mt-3 grid grid-cols-1 gap-1 text-[10px] font-mono">
                <div className="text-muted-foreground"><span className="text-cyan-300">io</span> · {m.io}</div>
                <div className="text-muted-foreground"><span className="text-cyan-300">latency</span> · {m.latency}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* Metrics */}
      <Section id="metrics" kicker="06 · Metrics" title="Measured, not marketed.">
        <GlassCard className="p-5 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { k: "40/40", v: "Accuracy tests passing" },
              { k: "100%", v: "Within-1-band accuracy" },
              { k: "0%", v: "FP rate on normal traffic" },
              { k: "0", v: "Missed blocks on kill-chains" },
              { k: "94ms", v: "Median decision latency" },
              { k: "21", v: "Labeled scenarios in corpus" },
            ].map((s) => (
              <div key={s.v} className="rounded-xl hairline bg-white/3 px-3 py-3">
                <div className="text-lg sm:text-xl font-bold text-gradient-cyber font-mono">{s.k}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 leading-tight">{s.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[10px] font-mono text-muted-foreground">
            source · tests/correlation-accuracy.test.ts · correlation-core.server.ts benchmark
          </div>
        </GlassCard>
      </Section>

      {/* Scalability */}
      <Section id="scale" kicker="07 · Scalability" title="Built to grow with your book.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Cloud, t: "Stateless edge compute", d: "Server functions run on Cloudflare Workers — horizontal scale by default, no cold-start regions to manage." },
            { icon: Boxes, t: "Partition-ready schema", d: "Indices on (customer_id, created_at desc) across telemetry and transactions — ready for time-based partitioning at volume." },
            { icon: Workflow, t: "Realtime fan-out", d: "Supabase channels stream alerts and investigations to every open console — no polling, no glue services." },
          ].map((f) => (
            <GlassCard key={f.t} className="p-5">
              <div className="h-9 w-9 rounded-lg grid place-items-center bg-gradient-to-br from-cyan-400/20 to-violet-500/20 hairline">
                <f.icon className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-4 text-sm font-semibold">{f.t}</div>
              <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.d}</div>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* Security */}
      <Section id="security" kicker="08 · Security & compliance" title="Enterprise-grade by default.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Lock, t: "Row-level security", d: "Every table is RLS-enforced per role: SOC, fraud, risk, and executive see only what their scope allows." },
            { icon: KeyRound, t: "Real TOTP MFA", d: "Supabase-native TOTP factors with challenge/verify — no demo bypass, aal2 required for privileged actions." },
            { icon: Shield, t: "PII minimisation", d: "Tokenised at rest, minimised at ingest, and never sent to any external model with retention enabled." },
          ].map((f) => (
            <GlassCard key={f.t} className="p-5">
              <div className="h-9 w-9 rounded-lg grid place-items-center bg-gradient-to-br from-cyan-400/20 to-violet-500/20 hairline">
                <f.icon className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-4 text-sm font-semibold">{f.t}</div>
              <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.d}</div>
            </GlassCard>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {["SOC 2 Type II","ISO 27001","PCI DSS 4.0","PSD2 SCA","DORA","NIST CSF 2.0"].map((c) => (
            <span key={c} className="text-[10px] px-2.5 py-1 rounded-full hairline bg-white/3 text-muted-foreground">{c}</span>
          ))}
        </div>
      </Section>

      {/* Business impact */}
      <Section id="impact" kicker="09 · Business impact" title="What it means for the bank.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { k: "₹2,400 Cr", v: "Fraud prevented (YTD)" },
            { k: "62%", v: "MTTD reduction vs SIEM-only" },
            { k: "18 hrs", v: "Analyst hours saved / wk" },
            { k: "3×", v: "Coverage vs legacy stack" },
          ].map((s) => (
            <div key={s.v} className="rounded-xl hairline glass px-4 py-4">
              <div className="text-lg sm:text-2xl font-bold text-gradient-cyber font-mono">{s.k}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 leading-tight">{s.v}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="relative z-10 px-4 sm:px-6 md:px-10 py-20 max-w-5xl mx-auto text-center">
        <div className="relative rounded-3xl hairline glass p-10 overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[600px] bg-gradient-to-b from-cyan-500/25 to-transparent blur-3xl" />
          <div className="relative">
            <FileBarChart2 className="h-8 w-8 mx-auto text-cyan-300" />
            <h3 className="mt-4 text-2xl md:text-3xl font-bold">See it correlate in real time.</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
              Launch the SentinelQ demo tenant with pre-loaded fraud scenarios and a working AI copilot.
            </p>
            <div className="mt-6 inline-flex flex-wrap gap-3 justify-center">
              <button onClick={ctaEnter} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold px-5 py-2.5 text-sm hover:brightness-110">
                <Zap className="h-4 w-4" /> Enter demo console
              </button>
              <Link to="/" className="text-xs px-4 py-2.5 rounded-lg hairline hover:bg-white/6">Back to home</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-4 sm:px-6 md:px-10 py-8 border-t border-white/6 flex flex-wrap items-center justify-between gap-4 text-[10px] text-muted-foreground/70">
        <div className="flex items-center gap-3"><Logo /> <span>© 2026 SentinelQ · Enterprise Banking Cybersecurity</span></div>
        <div className="flex gap-4"><Link to="/">Home</Link><Link to="/about">About</Link><span>Privacy</span><span>Security</span></div>
      </footer>
    </div>
  );
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="relative z-10 px-4 sm:px-6 md:px-10 py-16 md:py-20 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-2xl mb-8">
          <div className="text-[10px] uppercase tracking-widest text-cyan-300">{kicker}</div>
          <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
        </div>
        {children}
      </motion.div>
    </section>
  );
}
