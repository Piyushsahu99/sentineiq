import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Send, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const suggestions = [
  "Why was this transaction blocked?",
  "Summarize this attack",
  "Show attack timeline",
  "Recommend actions",
  "Explain this risk to executives",
  "Generate incident report",
];

type Msg = { role: "user" | "ai"; content: string; ts: number };

function synthesize(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("why") && p.includes("block")) {
    return [
      "**Transaction TX-880120 was blocked** because SentinelQ correlated 7 concurrent signals:",
      "1. Login from a **new unenrolled Windows 11 device** anchored to a commercial VPN in NL.",
      "2. **RedLine info-stealer** was quarantined on that endpoint 4 minutes before the transfer.",
      "3. **Self-service password reset** completed inside the malware execution window.",
      "4. **New beneficiary** (NL22 INGB 0007…) with no prior relationship — high-risk MCC.",
      "5. Amount **€482,000** is **34× the customer's 90-day median**.",
      "6. Beneficiary IBAN is present on the **Europol EMPACT mule-account feed** (FIN7-Wire-24Q4).",
      "7. Behaviour baseline delta = 0.91 (score 94 / 100).",
      "",
      "**Verdict:** BLOCK — auto-mitigation revoked the session, held the payment, and opened SOC-90218.",
    ].join("\n");
  }
  if (p.includes("summarize") || p.includes("summary")) {
    return "Coordinated **Account Takeover → Authorized Push Payment** fraud against a Wealth Management customer. Cyber vector: RedLine infostealer + VPN. Fraud vector: new beneficiary + oversized wire. Correlated by SentinelQ AI (score 94, confidence 97). Attributed to **FIN7-Wire-24Q4** campaign. Financial impact averted: **€482,000**. Kill-chain compressed to 11 minutes.";
  }
  if (p.includes("timeline")) {
    return "1. Login (T+0)  →  2. New Device (T+62s)  →  3. VPN Anchor (T+2m25s)  →  4. Endpoint Malware (T+4m20s)  →  5. Password Reset (T+6m20s)  →  6. New Beneficiary (T+8m40s)  →  7. Large Transaction (T+10m20s)  →  8. TI Match (T+10m40s)  →  9. AI Decision: BLOCK (T+11m).";
  }
  if (p.includes("recommend") || p.includes("action")) {
    return [
      "**Recommended actions:**",
      "• Force-revoke all sessions for customer C-88214 and re-enrol MFA.",
      "• Isolate Win11-Fresh endpoint via EDR; collect memory + prefetch.",
      "• File **SAR** with FIU citing FIN7 campaign attribution.",
      "• Add IBAN NL22INGB0007… to internal deny-list; propagate to peer banks via FS-ISAC.",
      "• Update fraud model: velocity feature for password-reset → new-beneficiary within 10 min.",
    ].join("\n");
  }
  if (p.includes("executive") || p.includes("explain")) {
    return "In plain terms: an attacker installed malware on a customer's PC, stole credentials, and tried to move €482K to a known mule account. SentinelQ correlated the cyber event with the payment behaviour in real time and stopped the transaction before it settled. No customer loss. This is the fifth similar case this month — recommend an exec briefing on FIN7-linked APP fraud.";
  }
  if (p.includes("report")) {
    return "Draft incident report generated (SOC-90218). Sections: Executive Summary · Kill Chain · Correlation Evidence · Financial Impact · Regulatory (PSD2, DORA) · Attribution (FIN7) · Recommended Controls. Open the **Reports** page to preview and export as PDF.";
  }
  return "Analyzed. SentinelQ has 42 critical signals in scope right now. Ask about a specific transaction, customer, or attack and I'll correlate telemetry across cyber + fraud + threat intel + quantum in real time.";
}

export function CopilotDock({ open, onOpenChange, seedPrompt }: { open: boolean; onOpenChange: (v: boolean) => void; seedPrompt?: string | null }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", content: "I'm your **SentinelQ Copilot**. I can explain any decision, correlate signals, and draft reports. Try one of the prompts below.", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seedPrompt && open) send(seedPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPrompt, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function send(text: string) {
    if (!text.trim()) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, ts: Date.now() }]);
    setThinking(true);
    const full = synthesize(text);
    let acc = "";
    setMessages((m) => [...m, { role: "ai", content: "", ts: Date.now() }]);
    let i = 0;
    const iv = setInterval(() => {
      acc = full.slice(0, i);
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { ...c[c.length - 1], content: acc };
        return c;
      });
      i += 6;
      if (i > full.length + 6) {
        clearInterval(iv);
        setThinking(false);
      }
    }, 18);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => onOpenChange(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-2xl grid place-items-center glass-strong hover:scale-105 transition",
          "bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/15",
        )}
        aria-label="Open AI Copilot"
      >
        <Sparkles className="h-6 w-6 text-cyan-200" />
        <span className="absolute inset-0 rounded-2xl pulse-ring" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 220 }}
            className="fixed right-4 bottom-24 top-20 w-[400px] max-w-[calc(100vw-2rem)] z-40 glass-strong rounded-2xl flex flex-col overflow-hidden border border-white/10"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/6 bg-gradient-to-r from-cyan-500/10 to-violet-500/10">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl grid place-items-center bg-gradient-to-br from-cyan-400 to-violet-500">
                  <Sparkles className="h-4 w-4 text-black" />
                </div>
                <div>
                  <div className="text-sm font-semibold">SentinelQ Copilot</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online · Grounded on your tenant
                  </div>
                </div>
              </div>
              <button onClick={() => onOpenChange(false)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/6">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "hairline bg-white/3 rounded-tl-sm",
                  )}>
                    {m.content.split("\n").map((line, j) => {
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <div key={j}>
                          {parts.map((p, k) =>
                            p.startsWith("**") ? <b key={k} className="text-cyan-200">{p.slice(2,-2)}</b> : <span key={k}>{p}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Correlating signals across 8 data planes…
                </div>
              )}
            </div>

            <div className="p-3 border-t border-white/6 space-y-2">
              <div className="flex flex-wrap gap-1">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-[11px] px-2 py-1 rounded-full hairline text-muted-foreground hover:text-foreground hover:bg-white/6">
                    {s}
                  </button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask SentinelQ anything…"
                  className="flex-1 bg-white/5 hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/40"
                />
                <button type="submit" className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 grid place-items-center text-black">
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <ShieldAlert className="h-3 w-3" /> Copilot output is explainable and cited from your telemetry.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
