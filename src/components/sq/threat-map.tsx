import { countryCoords } from "@/lib/mock/data";
import { useMemo } from "react";

// Very lightweight equirectangular projection for pulsing threat dots.
// Uses a stylized SVG rectangle as the world backdrop with faint continents.
export function ThreatMap({ points, className }: { points: { country: string; count: number; severity: "critical"|"high"|"medium"|"low"|"info" }[]; className?: string }) {
  const w = 800, h = 380;
  const proj = (lon: number, lat: number) => [((lon + 180) / 360) * w, ((90 - lat) / 180) * h] as [number, number];

  const dots = useMemo(() => points.map((p) => {
    const coords = countryCoords[p.country] ?? [0, 0];
    const [x, y] = proj(coords[0], coords[1]);
    return { ...p, x, y };
  }), [points]);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className}>
      <defs>
        <radialGradient id="glow-c" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--risk-critical)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--risk-critical)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-h" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--risk-high)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--risk-high)" stopOpacity="0" />
        </radialGradient>
        <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.6" fill="rgba(120,180,255,0.18)" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#dots)" />
      {/* Stylised continent blobs — abstract shapes for aesthetic backdrop */}
      <g fill="rgba(120,180,255,0.06)" stroke="rgba(120,180,255,0.18)" strokeWidth="0.5">
        {/* North America */}
        <path d="M60,80 Q100,60 180,80 Q220,110 210,150 Q170,180 130,175 Q90,160 70,130 Z" />
        {/* South America */}
        <path d="M200,190 Q230,180 240,220 Q235,280 210,310 Q190,290 195,240 Z" />
        {/* Europe */}
        <path d="M370,80 Q410,70 440,90 Q450,120 420,130 Q390,120 375,105 Z" />
        {/* Africa */}
        <path d="M400,140 Q440,140 450,180 Q450,240 420,275 Q395,255 395,200 Z" />
        {/* Asia */}
        <path d="M460,80 Q560,60 650,90 Q680,130 640,160 Q560,170 480,140 Z" />
        {/* Australia */}
        <path d="M640,240 Q690,235 710,255 Q705,280 670,285 Q640,275 635,255 Z" />
      </g>
      {/* Grid */}
      <g stroke="rgba(255,255,255,0.04)">
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} y1={h*f} x2={w} y2={h*f} />)}
        {[0.25, 0.5, 0.75].map((f) => <line key={"v"+f} x1={w*f} y1={0} x2={w*f} y2={h} />)}
      </g>
      {/* Pulsing threats */}
      {dots.map((d, i) => {
        const color = d.severity === "critical" ? "var(--risk-critical)"
          : d.severity === "high" ? "var(--risk-high)"
          : d.severity === "medium" ? "var(--risk-medium)"
          : "var(--cyber-cyan)";
        return (
          <g key={i} transform={`translate(${d.x},${d.y})`}>
            <circle r={16} fill={`url(#glow-${d.severity === "critical" ? "c" : "h"})`}>
              <animate attributeName="r" from="6" to="20" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.8" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r={3} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
            <text x={6} y={-6} fontSize="9" fill="white" opacity="0.7" fontFamily="ui-monospace">{d.country} · {d.count}</text>
          </g>
        );
      })}
    </svg>
  );
}
