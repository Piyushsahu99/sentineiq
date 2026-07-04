// AI Copilot — grounded on live Supabase data, calls Lovable AI Gateway (Gemini).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ prompt: z.string().min(1).max(2000) });

export const askCopilot = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { answer: "AI Gateway is not configured. Set LOVABLE_API_KEY to enable the Copilot." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Build grounded context from live tenant data
    const [alerts, invs, txs, telem] = await Promise.all([
      supabaseAdmin.from("alerts").select("severity, title, status, created_at").order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("ai_investigations").select("title, confidence, attack_type, business_impact, root_cause, risk_factors, recommended_actions").order("created_at", { ascending: false }).limit(3),
      supabaseAdmin.from("transactions").select("amount, currency, channel, country, status, risk_score, created_at").order("created_at", { ascending: false }).limit(15),
      supabaseAdmin.from("cyber_telemetry").select("source, severity, message, created_at").order("created_at", { ascending: false }).limit(15),
    ]);

    const context = {
      recent_alerts: alerts.data ?? [],
      top_investigations: invs.data ?? [],
      recent_transactions: txs.data ?? [],
      recent_telemetry: telem.data ?? [],
    };

    const system = `You are SentinelQ Copilot, an AI security analyst for a bank's SOC and fraud team. You are grounded on the tenant's live data provided in JSON. Answer concisely (<= 250 words) using markdown. Cite specific data points from the context. Use **bold** for key facts and bullet points for actions. Never fabricate transaction IDs, customer names, or amounts not in the context.`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "system", content: `LIVE TENANT DATA:\n${JSON.stringify(context)}` },
        { role: "user", content: data.prompt },
      ],
      temperature: 0.4,
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      if (resp.status === 429) return { answer: "Rate limit exceeded. Please retry in a moment." };
      if (resp.status === 402) return { answer: "AI credits exhausted. Add credits in Lovable settings to continue." };
      return { answer: `Copilot error (${resp.status}). ${text.slice(0, 200)}` };
    }
    const json = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const answer = json.choices?.[0]?.message?.content ?? "No response.";
    return { answer };
  });
