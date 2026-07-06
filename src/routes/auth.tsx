import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Logo } from "@/components/sq/logo";

export const Route = createFileRoute("/auth")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-aurora">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background/80" />

      {/* Animated scanning line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[ticker_6s_linear_infinite] opacity-60" />

      <header className="relative z-10 px-4 sm:px-8 py-5 sm:py-6 flex items-center justify-between gap-3">
        <Logo />
        <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Global SOC · All regions operational
        </div>
      </header>

      <main className="relative z-10 min-h-[calc(100vh-160px)] grid place-items-center px-4 py-8 sm:py-12">
        <Outlet />
      </main>

      <footer className="relative z-10 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] text-muted-foreground/70">
        <div>© 2026 SentinelQ · Enterprise Banking Cybersecurity</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>SOC 2 Type II</span>
          <span>ISO 27001</span>
          <span>PCI DSS 4.0</span>
          <span>PSD2 / DORA</span>
        </div>
      </footer>
    </div>
  );
}
