// AI Correlation Engine — computes composite risk and creates investigation + alert.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ transactionId: z.string().uuid() });

type Contributor = { name: string; weight: number };

export const correlateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden: analyst role required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


    const { data: tx, error: txErr } = await supabaseAdmin.from("transactions").select("*").eq("id", data.transactionId).maybeSingle();
    if (txErr || !tx) throw new Error("Transaction not found");

    const { data: cust } = await supabaseAdmin.from("customers").select("*").eq("id", tx.customer_id).maybeSingle();
    const { data: recentTelem } = await supabaseAdmin.from("cyber_telemetry")
      .select("severity, message, created_at").order("created_at", { ascending: false }).limit(20);
    const { data: iocHits } = await supabaseAdmin.from("iocs").select("value").limit(5);

    const contributors: Contributor[] = [];
    const amt = Number(tx.amount);
    const baseline = cust?.risk_baseline ?? 20;

    if (amt > 10000) contributors.push({ name: `Amount high ($${amt.toLocaleString()})`, weight: Math.min(25, Math.round(amt / 2000)) });
    if (tx.country && !["US","GB","DE","FR","JP","IN"].includes(tx.country)) contributors.push({ name: `High-risk geography (${tx.country})`, weight: 15 });
    if (tx.channel === "crypto") contributors.push({ name: "Crypto channel", weight: 12 });
    if (tx.channel === "wire" && amt > 5000) contributors.push({ name: "Large wire transfer", weight: 10 });
    if (cust && baseline > 40) contributors.push({ name: `Customer risk baseline ${baseline}`, weight: 8 });

    const criticalTelem = (recentTelem ?? []).filter((t) => t.severity === "critical").length;
    const highTelem = (recentTelem ?? []).filter((t) => t.severity === "high").length;
    if (criticalTelem > 0) contributors.push({ name: `${criticalTelem} critical telemetry events`, weight: 12 });
    if (highTelem > 2) contributors.push({ name: `${highTelem} high telemetry events`, weight: 8 });

    const hour = new Date(tx.created_at).getUTCHours();
    if (hour < 6 || hour > 22) contributors.push({ name: `Off-hours activity (${hour}:00 UTC)`, weight: 7 });

    // Deterministic: fire when tenant has any IOCs and the tx destination is a known high-risk geo.
    if ((iocHits?.length ?? 0) > 0 && tx.country && ["RU","NG","AE","IR","CN"].includes(tx.country)) {
      contributors.push({ name: "Related IOC observed in tenant", weight: 10 });
    }

    const composite = Math.min(99, contributors.reduce((s, c) => s + c.weight, 0) + Math.round(baseline / 5));

    await supabaseAdmin.from("risk_scores").insert({
      transaction_id: tx.id, customer_id: tx.customer_id, composite, contributors,
    });

    await supabaseAdmin.from("transactions").update({
      risk_score: composite,
      status: composite >= 80 ? "blocked" : composite >= 60 ? "pending" : "approved",
    }).eq("id", tx.id);

    if (composite >= 60) {
      const severity = composite >= 85 ? "critical" : composite >= 70 ? "high" : "medium";
      const title = composite >= 85
        ? `${cust?.full_name ?? "Customer"} — $${amt.toLocaleString()} ${tx.channel} to ${tx.country ?? "unknown"} BLOCKED`
        : `${cust?.full_name ?? "Customer"} — $${amt.toLocaleString()} ${tx.channel} flagged (risk ${composite})`;

      const { data: inv } = await supabaseAdmin.from("ai_investigations").insert({
        transaction_id: tx.id, customer_id: tx.customer_id,
        title: `Risk ${composite}: ${tx.channel} to ${tx.country ?? "unknown"}`,
        confidence: Math.min(99, composite + 3),
        attack_type: composite >= 85 ? "Suspected Account Takeover / APP fraud" : "Anomalous transaction",
        business_impact: amt,
        root_cause: `Composite risk ${composite} derived from ${contributors.length} signals across cyber telemetry, geography, channel, and customer baseline.`,
        evidence: contributors.map((c) => ({ ts: new Date().toISOString(), source: "correlation", event: c.name, weight: c.weight })),
        risk_factors: contributors.map((c) => c.name),
        recommended_actions: composite >= 85
          ? ["Freeze account for 24h", "Force credential reset", "Notify customer via secondary channel", "File SAR"]
          : ["Manual analyst review", "Enrich with device history", "Contact customer for confirmation"],
        compliance: composite >= 85 ? ["PSD2 SCA review", "AML SAR filing", "DORA incident report"] : ["Manual review"],
        status: "open",
      }).select("id").single();

      await supabaseAdmin.from("alerts").insert({
        transaction_id: tx.id, customer_id: tx.customer_id, investigation_id: inv?.id,
        severity, title, source: "correlation-engine", status: "open", sla_minutes: severity === "critical" ? 15 : 60,
      });

      await supabaseAdmin.from("notifications").insert({
        title: severity === "critical" ? "Critical alert" : "New alert",
        body: title, severity,
      });
    }

    return { composite, contributors, blocked: composite >= 80 };
  });
