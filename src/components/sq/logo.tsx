import { cn } from "@/lib/utils";

export function Logo({ className, showWord = true }: { className?: string; showWord?: boolean }) {
  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      <div className="relative h-8 w-8 grid place-items-center rounded-xl glass-strong">
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--cyber-cyan)" />
              <stop offset="100%" stopColor="var(--cyber-violet)" />
            </linearGradient>
          </defs>
          <path d="M12 2 L20 5 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V5 Z" fill="none" stroke="url(#lg1)" strokeWidth="1.6" />
          <path d="M12 7 V17 M8 12 H16" stroke="url(#lg1)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="absolute -inset-0.5 rounded-xl blur-md bg-gradient-to-br from-cyan-400/20 to-violet-500/20 -z-10" />
      </div>
      {showWord && (
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-tight">Sentinel<span className="text-gradient-cyber">Q</span></div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">Bank Cyber AI</div>
        </div>
      )}
    </div>
  );
}
