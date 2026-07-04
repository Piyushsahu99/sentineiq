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
    <GlassCard className="relative overflow-hidden group">
      <div className={cn("absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition-opacity group-hover:opacity-60", gradient)} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </div>
          <div className="mt-2 font-bold text-2xl md:text-3xl tracking-tight text-foreground font-mono">
            <CountUp to={value} format={format} />
            {unit && <span className="text-sm text-muted-foreground ml-1 font-sans font-normal">{unit}</span>}
          </div>
          {delta !== undefined && (
            <div className={cn("mt-2 text-[11px] font-medium inline-flex items-center gap-1", deltaUp ? "text-emerald-400" : "text-rose-400")}>
              <span>{deltaUp ? "▲" : "▼"}</span>
              <span>{Math.abs(delta)}%</span>
              <span className="text-muted-foreground font-normal">vs 7d</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-xl grid place-items-center hairline" style={{ color: accent, background: `color-mix(in oklab, ${accent} 12%, transparent)` }}>
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
