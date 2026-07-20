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
      <div className={cn("absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition-opacity group-hover:opacity-70", gradient)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            {label}
          </div>
          <div className="mt-2 font-semibold text-2xl md:text-[28px] leading-none tracking-tight text-foreground font-mono">
            <CountUp to={value} format={format} />
            {unit && <span className="text-sm text-muted-foreground ml-1 font-sans font-normal">{unit}</span>}
          </div>
          {delta !== undefined && (
            <div className={cn(
              "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium hairline",
              deltaUp
                ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                : "text-rose-300 bg-rose-500/10 border-rose-500/20",
            )}>
              <span className="text-[9px]">{deltaUp ? "▲" : "▼"}</span>
              <span className="font-mono">{Math.abs(delta)}%</span>
              <span className="text-muted-foreground/80 font-normal ml-0.5">7d</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-xl grid place-items-center hairline shrink-0" style={{ color: accent, background: `color-mix(in oklab, ${accent} 14%, transparent)` }}>
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

