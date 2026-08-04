import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function GlassCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-xl p-4 sm:p-5 transition-colors duration-200",
        "hover:border-white/12",
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
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="min-w-0 flex items-center gap-2.5">
        <span aria-hidden className="h-3.5 w-[2px] rounded-full bg-primary/70 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold tracking-tight text-foreground truncate">{title}</h2>
          {description && <p className="text-[11px] text-muted-foreground truncate">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, badge }: { title: string; subtitle?: string; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 md:mb-6 pb-4 border-b border-white/6">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-1 max-w-xl leading-snug line-clamp-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
