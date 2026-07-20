import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function GlassCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-4 sm:p-5 transition-all duration-300",
        "hover:border-white/15 hover:shadow-[0_24px_60px_-30px_color-mix(in_oklab,var(--cyber-blue)_45%,transparent)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] text-foreground/90 uppercase">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, badge }: { title: string; subtitle?: string; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 md:mb-8">
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
