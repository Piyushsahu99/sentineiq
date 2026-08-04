// Runtime access to the active adaptive model version.
// Server-only. Reads the newest `active` row from model_versions and caches it
// briefly so scoring stays fast; falls back to the frozen base model when no
// retrained version is live.

import type { Overlay } from "./rf-retrain.server";

export type ActiveModel = { version: string; overlay: Overlay | null };

export const BASE_MODEL_VERSION = "rf-1.0.0";
const TTL_MS = 60_000;

let cache: { at: number; value: ActiveModel } | null = null;

export function invalidateActiveModel() {
  cache = null;
}

export async function loadActiveModel(supabaseAdmin: any): Promise<ActiveModel> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: ActiveModel = { version: BASE_MODEL_VERSION, overlay: null };
  try {
    const { data } = await supabaseAdmin
      .from("model_versions")
      .select("version, calibration, feature_weights")
      .eq("status", "active")
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.version) {
      const cal = (data.calibration ?? {}) as any;
      value = {
        version: data.version,
        overlay: {
          a: Number(cal.a ?? 1),
          b: Number(cal.b ?? 0),
          iso: { x: cal.iso?.x ?? [], y: cal.iso?.y ?? [] },
          weights: Array.isArray(data.feature_weights) ? (data.feature_weights as any) : [],
        },
      };
    }
  } catch {
    /* scoring must never fail because the registry is unreachable */
  }
  cache = { at: Date.now(), value };
  return value;
}
