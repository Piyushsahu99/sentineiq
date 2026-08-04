// Scheduled retraining for the RF correlation model.
// Called by pg_cron after the drift scan; authenticated with the project key.
// Drift thresholds are validated inside the workflow — a stable model is a no-op.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/retrain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace("Bearer ", "");
        const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!key || !expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        let days = 7;
        let force = false;
        try {
          const body = (await request.json()) as { days?: number; force?: boolean };
          if (typeof body?.days === "number" && body.days >= 1 && body.days <= 90) days = Math.floor(body.days);
          force = body?.force === true;
        } catch { /* empty body is fine */ }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runRetrainingWorkflow } = await import("@/lib/retrain-core.server");
        const r = await runRetrainingWorkflow(supabaseAdmin, { days, force, trigger: "cron" });
        return new Response(
          JSON.stringify({
            ok: true,
            stage: r.stage,
            promoted: r.promoted,
            accepted: r.accepted,
            version: r.version,
            parent_version: r.parent_version,
            drift_status: r.drift.status,
            labeled_rows: r.labeled_rows,
            reason: r.reason,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
