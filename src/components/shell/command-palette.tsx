import { useEffect } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, GitBranch, FileSearch2, Coins, Radar, Globe2, Atom, Users, Brain, Network, Bell, FileBarChart2, Settings2, Sparkles } from "lucide-react";

const routes = [
  { to: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard, group: "Navigate" },
  { to: "/correlation", label: "Correlation Engine", icon: GitBranch, group: "Navigate" },
  { to: "/investigations", label: "AI Investigations", icon: FileSearch2, group: "Navigate" },
  { to: "/alerts", label: "Alert Center", icon: Bell, group: "Navigate" },
  { to: "/transactions", label: "Transaction Analytics", icon: Coins, group: "Navigate" },
  { to: "/telemetry", label: "Cyber Telemetry", icon: Radar, group: "Navigate" },
  { to: "/threat-intel", label: "Threat Intelligence", icon: Globe2, group: "Navigate" },
  { to: "/quantum", label: "Quantum Risk", icon: Atom, group: "Navigate" },
  { to: "/behavior", label: "Customer Behaviour", icon: Users, group: "Navigate" },
  { to: "/explainable-ai", label: "Explainable AI", icon: Brain, group: "Navigate" },
  { to: "/graph", label: "Knowledge Graph", icon: Network, group: "Navigate" },
  { to: "/reports", label: "Reports", icon: FileBarChart2, group: "Navigate" },
  { to: "/settings", label: "Settings", icon: Settings2, group: "Navigate" },
] as const;

const actions = [
  { label: "Ask AI Copilot: Why was TX-880120 blocked?", icon: Sparkles },
  { label: "Ask AI Copilot: Summarize today's attack", icon: Sparkles },
  { label: "Ask AI Copilot: Generate exec incident report", icon: Sparkles },
];

export function CommandPalette({ open, onOpenChange, onCopilot }: { open: boolean; onOpenChange: (v: boolean) => void; onCopilot: (seed?: string) => void }) {
  const nav = useNavigate();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, alerts, customers, IPs, hashes…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {routes.map((r) => (
            <CommandItem key={r.to} onSelect={() => { nav({ to: r.to }); onOpenChange(false); }}>
              <r.icon className="mr-2 h-4 w-4 text-cyan-300" />
              {r.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="AI Copilot">
          {actions.map((a) => (
            <CommandItem key={a.label} onSelect={() => { onCopilot(a.label.replace("Ask AI Copilot: ", "")); onOpenChange(false); }}>
              <a.icon className="mr-2 h-4 w-4 text-violet-300" />
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
