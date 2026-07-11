import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Command, Search, Sparkles, Sun, Moon, LogOut, User2, Settings2, Menu } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { session } from "@/lib/session";
import { toast } from "sonner";
import { SeverityDot } from "@/components/sq/risk";
import type { Severity } from "@/lib/mock/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

const initialNotifs = [
  { id: 1, title: "Critical: SWIFT MT103 auto-blocked", detail: "€482,000 to NL22INGB… — Correlated (score 94)", severity: "critical" as Severity, ts: Date.now() - 60_000 },
  { id: 2, title: "APT beacon detected on core-banking segment", detail: "EDR — 3 endpoints affected", severity: "high" as Severity, ts: Date.now() - 6 * 60_000 },
  { id: 3, title: "MFA fatigue on treasury desk", detail: "8 push requests in 90s", severity: "high" as Severity, ts: Date.now() - 22 * 60_000 },
  { id: 4, title: "Threat feed updated: FIN7-Wire-24Q4", detail: "142 new IOCs ingested", severity: "info" as Severity, ts: Date.now() - 45 * 60_000 },
  { id: 5, title: "Quantum policy review due", detail: "RSA-2048 deprecation window in 30d", severity: "medium" as Severity, ts: Date.now() - 3 * 3600_000 },
];

export function Topbar({ onCommand, onCopilot, onMenu }: { onCommand: () => void; onCopilot: () => void; onMenu?: () => void }) {
  const nav = useNavigate();
  const [notifs, setNotifs] = useState(initialNotifs);
  const [live, setLive] = useState(true);
  const [, tick] = useState(0);
  useEffect(() => session.subscribe(() => tick((n) => n + 1)), []);


  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const titles = ["New TI match: mule IBAN NL22…","Anomalous burst on API /transfer","EDR quarantine: RedLine variant","Impossible travel VIP customer"];
      setNotifs((prev) => [{
        id: Date.now(),
        title: titles[Math.floor(Math.random()*titles.length)],
        detail: "Auto-triaged by SentinelQ AI",
        severity: (["critical","high","medium","info"] as const)[Math.floor(Math.random()*4)],
        ts: Date.now(),
      }, ...prev].slice(0, 20));
    }, 12_000);
    return () => clearInterval(id);
  }, [live]);

  return (
    <div className="sticky top-0 z-30 h-16 border-b border-white/6 bg-background/60 backdrop-blur-xl">
      <div className="h-full flex items-center gap-2 sm:gap-3 px-3 sm:px-6">
        {onMenu && (
          <button
            onClick={onMenu}
            aria-label="Open navigation"
            className="md:hidden h-9 w-9 shrink-0 grid place-items-center rounded-lg hairline hover:bg-white/6"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onCommand}
          className="group flex min-w-0 items-center gap-2 rounded-lg hairline bg-white/3 hover:bg-white/6 px-3 py-1.5 text-sm text-muted-foreground w-full max-w-sm transition"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 min-w-0 truncate text-left">
            <span className="hidden sm:inline">Search alerts, customers, IPs, IOCs…</span>
            <span className="sm:hidden">Search…</span>
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            <Command className="h-3 w-3" /> K
          </kbd>
        </button>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          Live · 8.9M tx/day
        </div>

        <button
          onClick={onCopilot}
          className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hairline bg-gradient-to-r from-cyan-500/10 to-violet-500/10 hover:from-cyan-500/20 hover:to-violet-500/20 transition"
        >
          <Sparkles className="h-4 w-4 text-cyan-300" />
          <span>AI Copilot</span>
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button aria-label="Notifications" className="relative h-9 w-9 grid place-items-center rounded-lg hairline hover:bg-white/6">
              <Bell className="h-4 w-4" />
              {notifs.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_var(--risk-critical)]" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 p-0 glass-strong border-white/8">
            <div className="flex items-center justify-between p-3 border-b border-white/6">
              <div>
                <div className="text-sm font-semibold">Notifications</div>
                <div className="text-[10px] text-muted-foreground">{notifs.length} active · grouped by severity</div>
              </div>
              <button onClick={() => setLive((v) => !v)} className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                {live ? "Pause" : "Resume"}
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto scrollbar-thin">
              <AnimatePresence initial={false}>
                {notifs.map((n) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-3 p-3 border-b border-white/4 hover:bg-white/3 cursor-pointer"
                  >
                    <SeverityDot severity={n.severity} pulse={n.severity === "critical"} className="mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{n.detail}</div>
                      <div className="text-[10px] text-muted-foreground/70 mt-1">{formatDistanceToNow(n.ts, { addSuffix: true })}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </PopoverContent>
        </Popover>

        <button
          className="hidden sm:grid h-9 w-9 place-items-center rounded-lg hairline hover:bg-white/6"
          onClick={() => toast.info("Theme locked to dark for enterprise consistency.")}
          aria-label="Toggle theme"
        >
          <Moon className="h-4 w-4" />
          <Sun className="h-0 w-0" />
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button className="flex shrink-0 items-center gap-2 rounded-lg hairline bg-white/3 hover:bg-white/6 pl-1 pr-2 sm:pr-3 py-1">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-cyan-400 to-violet-500 grid place-items-center text-[11px] font-bold text-black">
                {session.getEmail().slice(0,2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-xs font-semibold max-w-[120px] truncate">{session.getEmail().split("@")[0]}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{session.getRole() ?? "SOC"}</div>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 glass-strong border-white/8">
            <div className="text-xs text-muted-foreground px-1 pb-2 border-b border-white/6">{session.getEmail()}</div>
            <button onClick={() => nav({ to: "/profile" })} className="w-full mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/6"><User2 className="h-4 w-4" />Profile</button>
            <button onClick={() => nav({ to: "/settings" })} className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/6"><Settings2 className="h-4 w-4" />Settings</button>

            <div className="border-t border-white/6 my-2" />
            <button
              onClick={async () => { await session.signOut(); nav({ to: "/auth/login" }); }}
              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-rose-300 hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" />Sign out
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
