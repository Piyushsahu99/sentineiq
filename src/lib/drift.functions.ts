// Model drift monitoring RPCs — feature + prediction drift for the RF
// correlation model, with retraining alerts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WindowInput = z.object({ days: z.number().int().min(1).max(90).default(7) });

/** Live drift report over the last N days of scored transactions. */
export const getDriftReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => WindowInput.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden: analyst role required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeDrift, BASELINE_SIZE } = await import("@/lib/ml/rf-drift.server");

    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: snaps } = await supabaseAdmin
      .from("model_feature_snapshots")
      .select("features, rf_probability, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    const report = computeDrift((snaps ?? []) as any);
    const { data: history } = await supabaseAdmin
      .from("model_drift_reports")
      .select("id, created_at, overall_psi, prediction_psi, status, sample_size, retrain_recommended")
      .order("created_at", { ascending: false })
      .limit(10);

    return { ...report, window_days: data.days, baseline_size: BASELINE_SIZE, history: history ?? [] };
  });

/** Run a drift check, persist the report, and raise an alert when retraining is needed. */
export const runDriftScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => WindowInput.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden: analyst role required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runDriftScanCore } = await import("@/lib/drift-core.server");
    return runDriftScanCore(supabaseAdmin, data.days);
  });
