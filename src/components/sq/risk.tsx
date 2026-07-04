import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/mock/data";
import { severityColor } from "@/lib/mock/data";

export function SeverityDot({ severity, pulse = false, className }: { severity: Severity; pulse?: boolean; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", pulse && "pulse-ring", className)}
      style={{ backgroundColor: severityColor[severity], boxShadow: `0 0 12px ${severityColor[severity]}` }}
    />
  );
}

export function RiskBadge({ severity, label, className }: { severity: Severity; label?: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider hairline", className)}
      style={{
        color: severityColor[severity],
        backgroundColor: `color-mix(in oklab, ${severityColor[severity]} 15%, transparent)`,
        borderColor: `color-mix(in oklab, ${severityColor[severity]} 30%, transparent)`,
      }}
    >
      <SeverityDot severity={severity} />
      {label ?? severity}
    </span>
  );
}

export function RiskBar({ value, className }: { value: number; className?: string }) {
  const color = value >= 80 ? "var(--risk-critical)"
    : value >= 60 ? "var(--risk-high)"
    : value >= 40 ? "var(--risk-medium)"
    : value >= 20 ? "var(--risk-low)"
    : "var(--risk-info)";
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-white/5", className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 12px ${color}` }} />
    </div>
  );
}
