import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBar, RiskBadge } from "@/components/sq/risk";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useTransactions } from "@/lib/live-queries";
import { supabase } from "@/integrations/supabase/client";
import { correlateTransaction } from "@/lib/correlation.functions";
import { seedDeterministic } from "@/lib/seed.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/transactions")({
  ssr: false,
  component: TxPage,
});

type Sev = "critical" | "high" | "medium" | "low" | "info";
const sev = (r: number): Sev => r >= 80 ? "critical" : r >= 60 ? "high" : r >= 40 ? "medium" : r >= 20 ? "low" : "info";

function TxPage() {
  const { data: txs = [] } = useTransactions(60);
  const correlate = useServerFn(correlateTransaction);
  const seed = useServerFn(seedDeterministic);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function seedHighRisk() {
    setSeeding(true);
    try {
      const res = await seed({ data: { scenario: "high_risk" } });
      const target = res.transactions?.[0];
      if (!target) throw new Error("Seed returned no transaction");
      toast.success(`Seeded deterministic scenario · correlating tx…`);
      const c = await correlate({ data: { transactionId: target.id } });
      toast.success(`Deterministic run: composite ${c.composite} (expected ${res.expected_high_risk_composite})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally { setSeeding(false); }
  }

  async function simulate() {
    setBusy(true);
    try {
      const { data: cust } = await supabase.from("customers").select("id").limit(1).maybeSingle();
      if (!cust) { toast.error("No customer seeded"); return; }
      const amount = Math.round(20000 + Math.random() * 30000);
      const country = ["RU", "NG", "AE"][Math.floor(Math.random() * 3)];
      const { data: inserted, error } = await supabase.from("transactions").insert({
        customer_id: cust.id, amount, currency: "USD",
        channel: Math.random() > 0.5 ? "wire" : "crypto",
        merchant: "Unknown beneficiary",
        country, status: "pending",
      }).select("id").single();
      if (error || !inserted) throw error ?? new Error("Insert failed");
      toast.success(`Transaction inserted, correlating…`);
      const res = await correlate({ data: { transactionId: inserted.id } });
      toast.success(`Correlation done: risk ${res.composite}${res.blocked ? " — BLOCKED" : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally { setBusy(false); }
  }

  const totalUsd = txs.reduce((s, t) => s + Number(t.amount), 0);
  const flagged = txs.filter((t) => (t.risk_score ?? 0) >= 60).length;
  const blocked = txs.filter((t) => t.status === "blocked").length;

  return (
    <div>
      <PageHeader
        title="Transaction Analytics"
        subtitle="Live transactions from Supabase — insert one below and watch the Correlation Engine score it in real time."
        actions={
          <button disabled={busy} onClick={simulate} className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold hover:brightness-110 disabled:opacity-60">
            {busy ? "Correlating…" : "Simulate suspicious transaction"}
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total volume" value={`$${totalUsd.toLocaleString()}`} />
        <StatCard label="Transactions" value={txs.length.toString()} />
        <StatCard label="Flagged" value={flagged.toString()} accent="text-amber-300" />
        <StatCard label="Blocked" value={blocked.toString()} accent="text-rose-300" />
      </div>

      <GlassCard>
        <SectionHeader title="Recent transactions" description="Ordered by newest first · realtime updates via Supabase" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/6">
                <th className="text-left py-2">Time</th>
                <th className="text-left">Amount</th>
                <th className="text-left">Channel</th>
                <th className="text-left">Merchant</th>
                <th className="text-left">Country</th>
                <th className="text-left">Status</th>
                <th className="text-left">Risk</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t, i) => {
                const risk = t.risk_score ?? 0;
                return (
                  <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="border-b border-white/4 hover:bg-white/3">
                    <td className="py-2 text-[11px] text-muted-foreground font-mono">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</td>
                    <td className="font-mono">{t.currency} {Number(t.amount).toLocaleString()}</td>
                    <td>{t.channel}</td>
                    <td className="text-muted-foreground">{t.merchant ?? "—"}</td>
                    <td>{t.country ?? "—"}</td>
                    <td><span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${t.status === "blocked" ? "bg-rose-500/20 text-rose-300" : t.status === "pending" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}`}>{t.status}</span></td>
                    <td className="w-40"><div className="flex items-center gap-2"><RiskBar value={risk} className="max-w-[100px]" /><RiskBadge severity={sev(risk)} /></div></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

function StatCard({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <GlassCard>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-mono mt-1 ${accent}`}>{value}</div>
    </GlassCard>
  );
}
