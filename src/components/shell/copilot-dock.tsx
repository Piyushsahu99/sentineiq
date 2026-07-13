import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, Send, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { askCopilot } from "@/lib/copilot.functions";
import { usePrefs, formatMoney } from "@/lib/currency";

const buildSuggestions = (wireExample: string) => [
  "Summarize today's critical alerts",
  `Why was the ${wireExample} wire blocked?`,
  "Recommend actions for the top investigation",
  "Draft an executive summary of tonight's incidents",
  "Which customers are trending high-risk?",
  "Generate a SOC incident report",
];

type Msg = { role: "user" | "ai"; content: string; ts: number };

export function CopilotDock({ open, onOpenChange, seedPrompt }: { open: boolean; onOpenChange: (v: boolean) => void; seedPrompt?: string | null }) {
  const ask = useServerFn(askCopilot);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", content: "I'm your **SentinelQ Copilot**, grounded on this tenant's live telemetry, transactions, and investigations. Ask me anything.", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, ts: Date.now() }]);
    setThinking(true);
    try {
      const res = await ask({ data: { prompt: text } });
      setMessages((m) => [...m, { role: "ai", content: res.answer, ts: Date.now() }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Copilot request failed.";
      setMessages((m) => [...m, { role: "ai", content: `⚠️ ${msg}`, ts: Date.now() }]);
    } finally { setThinking(false); }
  }

  useEffect(() => {
    if (seedPrompt && open) send(seedPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPrompt, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  return (
    <>
      <button
        onClick={() => onOpenChange(!open)}
        className={cn("fixed bottom-6 right-6 z-40 h-14 w-14 rounded-2xl grid place-items-center glass-strong hover:scale-105 transition","bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/15")}
        aria-label="Open AI Copilot"
      >
        <Sparkles className="h-6 w-6 text-cyan-200" />
        <span className="absolute inset-0 rounded-2xl pulse-ring" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: 420, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 420, opacity: 0 }}
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
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Gemini · Grounded on your tenant
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
                  <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                    m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "hairline bg-white/3 rounded-tl-sm")}>
                    {m.content.split("\n").map((line, j) => {
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <div key={j}>
                          {parts.map((p, k) => p.startsWith("**") ? <b key={k} className="text-cyan-200">{p.slice(2,-2)}</b> : <span key={k}>{p}</span>)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Correlating signals across live tenant data…
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
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask SentinelQ anything…"
                  className="flex-1 bg-white/5 hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400/40" />
                <button type="submit" className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 grid place-items-center text-black">
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <ShieldAlert className="h-3 w-3" /> Copilot answers are grounded on live tenant data.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
