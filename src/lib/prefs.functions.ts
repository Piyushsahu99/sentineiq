// Server functions for reading/updating tenant preferences (region, bank,
// currency). Also exposes a helper to fetch the current user's transaction
// checking history.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const UpdateInput = z.object({
  region: z.string().min(2).max(4),
  currency: z.string().min(3).max(4),
  bank: z.string().min(2).max(80),
});

export const updateProfilePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => UpdateInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ region: data.region, currency: data.currency, bank: data.bank })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyCheckHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tx_check_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
