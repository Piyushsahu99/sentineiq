// Correlation engine — thin RPC wrapper around the shared core engine
// (src/lib/correlation-core.server.ts). Both this on-demand path and the
// batch ingest path share one source of truth.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ transactionId: z.string().uuid() });

export const correlateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden: analyst role required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { scoreAndPersist } = await import("@/lib/correlation-core.server");

    const result = await scoreAndPersist(supabaseAdmin, data.transactionId);

    // Per-user check history (Profile → Checking history).
    const { data: tx } = await supabaseAdmin.from("transactions").select("id, currency, amount, merchant, country").eq("id", data.transactionId).maybeSingle();
    if (tx) {
      await supabaseAdmin.from("tx_check_history").insert({
        user_id: context.userId,
        transaction_id: tx.id,
        verdict: result.status === "blocked" ? "blocked" : result.status === "pending" ? "flagged" : "clean",
        risk_score: result.composite,
        signals: result.signals.map((s) => ({ id: s.id, kind: s.kind, name: s.name, weight: s.weight })),
        currency: tx.currency,
        amount_local: tx.amount,
        merchant: tx.merchant,
        country: tx.country,
      });
    }

    return {
      composite: result.composite,
      calibrated: result.calibrated,
      band: result.band,
      contributors: result.signals,
      blocked: result.status === "blocked",
      dominant_kind: result.dominant_kind,
      suppressed: result.suppressed,
      escalations: result.escalations,
      risk_breakdown: result.risk_breakdown,
      investigation_id: result.investigation_id,
    };
  });


// ---------- Proactive scan: no transaction required ----------
export const runProactiveScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const [{ data: telem }, { data: iocs }] = await Promise.all([
      supabaseAdmin.from("cyber_telemetry").select("*").gte("created_at", since).limit(200),
      supabaseAdmin.from("iocs").select("*").limit(20),
    ]);
    const critical = (telem ?? []).filter((t: any) => t.severity === "critical");
    const evidence = critical.slice(0, 10).map((t: any) => ({ source: t.source, ref_id: t.id, ts: t.created_at, note: t.message }));
    if (critical.length === 0) return { created: 0, message: "No critical telemetry in the last 15 minutes" };

    const severity = critical.length >= 3 ? "critical" : "high";
    const composite = Math.min(99, 30 + critical.length * 5);
    const explanation = {
      signals: [{
        id: "cyber.proactive_sweep", kind: "cyber", name: `${critical.length} critical cyber events in 15 min window`,
        weight: 20 + critical.length * 2, confidence: 88, evidence,
      }, ...(iocs?.length ? [{
        id: "cyber.ioc_context", kind: "cyber", name: `${iocs.length} IOCs active in tenant`, weight: 8, confidence: 75,
        evidence: (iocs ?? []).slice(0, 3).map((i: any) => ({ source: "iocs", ref_id: i.id, note: `${i.type} ${i.value}` })),
      }] : [])],
      composite, calibrated_confidence: 86,
      kind_weights: { fraud: 0, cyber: 30, xcorr: 0, quantum: 0 },
      dominant_kind: "cyber", suppressed: [],
    };

    const { data: inv } = await supabaseAdmin.from("ai_investigations").insert({
      transaction_id: null, customer_id: null,
      title: `Proactive cyber alert · ${critical.length} critical events (last 15 min)`,
      confidence: 90, calibrated_confidence: 86,
      attack_type: "Cyber-first: proactive detection",
      business_impact: 0,
      root_cause: `${critical.length} critical telemetry events in 15-minute window`,
      evidence, explanation, risk_factors: critical.slice(0, 5).map((t: any) => t.message),
      recommended_actions: ["Sweep endpoints", "Correlate with IAM", "Notify SOC lead"],
      compliance: ["DORA incident report"],
      status: "open",
      band: composite >= 85 ? "Block" : composite >= 70 ? "High Risk" : "Pending Review",
    }).select("id").single();

    await supabaseAdmin.from("alerts").insert({
      transaction_id: null, customer_id: null, investigation_id: inv?.id,
      severity, title: `Proactive: ${critical.length} critical cyber events (last 15 min)`,
      source: "proactive-scan", status: "open",
      sla_minutes: severity === "critical" ? 15 : 30,
    });

    return { created: 1, investigation_id: inv?.id, critical: critical.length };
  });


// ---------- Analyst feedback (false-positive loop) ----------
const FeedbackInput = z.object({
  investigationId: z.string().uuid().optional(),
  signalId: z.string().max(120).optional(),
  verdict: z.enum(["true_positive", "false_positive", "benign"]),
  notes: z.string().max(500).optional(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => FeedbackInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let customerId: string | null = null;
    if (data.investigationId) {
      const { data: inv } = await supabaseAdmin.from("ai_investigations").select("customer_id").eq("id", data.investigationId).maybeSingle();
      customerId = inv?.customer_id ?? null;
    }

    await supabaseAdmin.from("analyst_feedback").insert({
      investigation_id: data.investigationId ?? null,
      signal_id: data.signalId ?? null,
      verdict: data.verdict,
      notes: data.notes ?? null,
      analyst_id: context.userId,
    });

    // Auto-suppression: 3 false-positives on same signal → suppress 7d
    if (data.verdict === "false_positive" && data.signalId) {
      const { data: fps } = await supabaseAdmin
        .from("analyst_feedback").select("id")
        .eq("signal_id", data.signalId).eq("verdict", "false_positive");
      if ((fps?.length ?? 0) >= 3) {
        await supabaseAdmin.from("suppressions").upsert({
          signal_id: data.signalId,
          customer_id: customerId,
          weight_multiplier: 0.3,
          expires_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
          created_by: context.userId,
        }, { onConflict: "signal_id,customer_id" });
      }
    }

    return { ok: true };
  });
