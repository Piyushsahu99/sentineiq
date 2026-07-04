import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { nav({ to: "/auth/login", replace: true }); return; }
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).limit(1).maybeSingle();
      nav({ to: r?.role ? "/dashboard" : "/auth/role-select", replace: true });
    })();
  }, [nav]);
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-xs text-muted-foreground animate-pulse">Initializing SentinelQ…</div>
    </div>
  );
}
