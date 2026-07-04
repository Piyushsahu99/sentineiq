import { motion } from "framer-motion";

export function ProgressRing({
  value, size = 120, stroke = 10, label, sublabel, color = "var(--cyber-blue)",
}: {
  value: number; size?: number; stroke?: number; label?: string; sublabel?: string; color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${color}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--cyber-cyan)" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="color-mix(in oklab, white 8%, transparent)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          stroke={`url(#ring-${color})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold font-mono">{value}<span className="text-sm text-muted-foreground">%</span></div>
        {label && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>}
      </div>
      {sublabel && <div className="text-xs text-muted-foreground mt-2">{sublabel}</div>}
    </div>
  );
}
