import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const authed = localStorage.getItem("sq_auth") === "1" && localStorage.getItem("sq_mfa") === "1" && !!localStorage.getItem("sq_role");
      throw redirect({ to: authed ? "/dashboard" : "/auth/login" });
    }
  },
  component: () => null,
});
