// Retraining workflow RPCs — drift-gated model refresh, version registry,
// promotion and rollback for the Random Forest correlation model.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RetrainInput = z.object({
  days: z.number().int().min(1).max(90).default(7),
  force: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

const VersionInput = z.object({ version: z.string().min(1).max(64) });

async function assertAnalyst(context: any) {
  const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
  if (!isAnalyst) throw new Error("Forbidden: analyst role required");
}

/** Registry of model versions + the currently active one. */
export const getModelVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAnalyst(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { BASE_MODEL_VERSION } = await import("@/lib/ml/rf-active.server");
    const { data } = await supabaseAdmin
      .from("model_versions")
      .select("id, version, parent_version, status, trigger, sample_size, holdout_size, positive_labels, metrics, gate, accepted, notes, feature_weights, activated_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    const versions = data ?? [];
    const active = versions.find((v: any) => v.status === "active") ?? null;
    return { versions, active, base_version: BASE_MODEL_VERSION };
  });

/** Run the full retraining workflow: drift gate → fit → validate → promote. */
export const runRetraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => RetrainInput.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    await assertAnalyst(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runRetrainingWorkflow } = await import("@/lib/retrain-core.server");
    return runRetrainingWorkflow(supabaseAdmin, {
      days: data.days, force: data.force, dryRun: data.dryRun,
      trigger: "manual", userId: context.userId,
    });
  });

/** Promote a stored version (or roll back by activating an older one). */
export const activateModelVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => VersionInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAnalyst(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setActiveVersion, rollbackToBase } = await import("@/lib/retrain-core.server");
    const { BASE_MODEL_VERSION } = await import("@/lib/ml/rf-active.server");
    return data.version === BASE_MODEL_VERSION
      ? rollbackToBase(supabaseAdmin)
      : setActiveVersion(supabaseAdmin, data.version);
  });
