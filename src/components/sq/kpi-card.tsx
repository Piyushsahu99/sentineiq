import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { GlassCard } from "./glass-card";
import { cn } from "@/lib/utils";

export function CountUp({ to, format = (n: number) => n.toLocaleString(), duration = 1.2, className }: { to: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => format(Math.round(v)));
  useEffect(() => {
    const controls = animate(mv, to, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [to, duration, mv]);
  return <motion.span className={className}>{rounded}</motion.span>;
}

export function KpiCard({
  label, value, unit, delta, icon, gradient = "from-cyan-400/20 to-blue-500/20", accent = "var(--cyber-blue)", format,
}: {
  label: string;
  value: number;
  unit?: string;
  delta?: number;
  icon?: ReactNode;
  gradient?: string;
  accent?: string;
  format?: (n: number) => string;
}) {
  const deltaUp = (delta ?? 0) >= 0;
  return (
    <GlassCard className="relative overflow-hidden group p-4">
      <div className={cn("pointer-events-none absolute -top-20 -right-16 h-36 w-36 rounded-full bg-gradient-to-br opacity-25 blur-3xl transition-opacity group-hover:opacity-45", gradient)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium truncate">
            {label}
          </div>
          <div className="mt-1.5 font-semibold text-xl md:text-2xl leading-none tracking-tight text-foreground font-mono">
            <CountUp to={value} format={format} />
            {unit && <span className="text-xs text-muted-foreground ml-1 font-sans font-normal">{unit}</span>}
          </div>
          {delta !== undefined && (
            <div className={cn(
              "mt-2 inline-flex items-center gap-1 text-[10px] font-medium",
              deltaUp ? "text-emerald-400/90" : "text-rose-400/90",
            )}>
              <span className="text-[8px]">{deltaUp ? "▲" : "▼"}</span>
              <span className="font-mono">{Math.abs(delta)}%</span>
              <span className="text-muted-foreground/70 font-normal">7d</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0 opacity-90" style={{ color: accent, background: `color-mix(in oklab, ${accent} 12%, transparent)` }}>
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}


