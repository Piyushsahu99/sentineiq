import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    const authed = localStorage.getItem("sq_auth") === "1" && localStorage.getItem("sq_mfa") === "1" && !!localStorage.getItem("sq_role");
    nav({ to: authed ? "/dashboard" : "/auth/login", replace: true });
  }, [nav]);
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-xs text-muted-foreground animate-pulse">Initializing SentinelQ…</div>
    </div>
  );
}
