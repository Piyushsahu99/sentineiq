import { createFileRoute, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar, MobileSidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { CopilotDock } from "@/components/shell/copilot-dock";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const nav = useNavigate();
  const [cmd, setCmd] = useState(false);
  const [copilot, setCopilot] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { nav({ to: "/auth/login", replace: true }); return; }
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).limit(1).maybeSingle();
      if (!r?.role) { nav({ to: "/auth/role-select", replace: true }); return; }
      setChecked(true);
    })();
  }, [nav]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT","TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "?") { e.preventDefault(); setCmd(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!checked) {
    return <div className="min-h-screen grid place-items-center bg-background"><div className="text-xs text-muted-foreground animate-pulse">Loading…</div></div>;
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onCommand={() => setCmd(true)} onCopilot={() => { setSeed(null); setCopilot(true); }} />
        <main className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: "easeOut" }} className="p-6 md:p-8 max-w-[1600px] mx-auto">
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
