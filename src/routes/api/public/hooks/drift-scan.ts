// Scheduled drift check for the RF correlation model.
// Called by pg_cron; authenticated with the project publishable/anon key.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/drift-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace("Bearer ", "");
        const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!key || !expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runDriftScanCore } = await import("@/lib/drift-core.server");
        const report = await runDriftScanCore(supabaseAdmin, 7, true);
        return new Response(
          JSON.stringify({
            ok: true,
            status: report.status,
            retrain_recommended: report.retrain_recommended,
            overall_psi: report.overall_psi,
            prediction_psi: report.prediction_psi,
            sample_size: report.sample_size,
            retrain: report.retrain,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
