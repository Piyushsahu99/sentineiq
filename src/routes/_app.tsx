import { createFileRoute, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { CopilotDock } from "@/components/shell/copilot-dock";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const authed = localStorage.getItem("sq_auth") === "1" && localStorage.getItem("sq_mfa") === "1" && !!localStorage.getItem("sq_role");
      if (!authed) throw redirect({ to: "/auth/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const [cmd, setCmd] = useState(false);
  const [copilot, setCopilot] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT","TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "?") { e.preventDefault(); setCmd(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          onCommand={() => setCmd(true)}
          onCopilot={() => { setSeed(null); setCopilot(true); }}
        />
        <main className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="p-6 md:p-8 max-w-[1600px] mx-auto"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette open={cmd} onOpenChange={setCmd} onCopilot={(s) => { setSeed(s ?? null); setCopilot(true); }} />
      <CopilotDock open={copilot} onOpenChange={setCopilot} seedPrompt={seed} />
    </div>
  );
}
