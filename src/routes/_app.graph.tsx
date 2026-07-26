import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { useKnowledgeEdges } from "@/lib/live-queries";
import { User, CreditCard, Smartphone, Wifi, Coins, Store, Skull, Bug, MapPin, ShieldAlert, ShieldCheck, Radio, FileWarning } from "lucide-react";

export const Route = createFileRoute("/_app/graph")({
  ssr: false,
  component: GraphPage,
});

type NType = "Customer" | "Transaction" | "Device" | "Session" | "IP" | "Country" | "Merchant" | "Beneficiary" | "CyberEvent" | "IOC" | "Signal" | "Investigation";

const typeMeta: Record<NType, { color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  Customer:      { color: "var(--cyber-cyan)", Icon: User },
  Transaction:   { color: "#facc15", Icon: Coins },
  Device:        { color: "#a78bfa", Icon: Smartphone },
  Session:       { color: "#93c5fd", Icon: Radio },
  IP:            { color: "#f472b6", Icon: Wifi },
  Country:       { color: "#34d399", Icon: MapPin },
  Merchant:      { color: "#fb923c", Icon: Store },
  Beneficiary:   { color: "#60a5fa", Icon: CreditCard },
  CyberEvent:    { color: "#ef4444", Icon: Bug },
  IOC:           { color: "var(--risk-critical)", Icon: Skull },
  Signal:        { color: "#c084fc", Icon: ShieldAlert },
  Investigation: { color: "#22d3ee", Icon: FileWarning },
};

const ALL_TYPES = Object.keys(typeMeta) as NType[];

// Deterministic hash → angle
function hashAngle(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 360) * (Math.PI / 180);
}

function shortLabel(t: NType, id: string) {
  if (t === "IP" || t === "Country" || t === "Merchant") return id.split(":")[1] ?? id;
  if (t === "Signal") return id;
  return id.length > 10 ? id.slice(0, 8) : id;
}

function GraphPage() {
  const { data: edgesRaw = [], isLoading } = useKnowledgeEdges(300);
  const [filter, setFilter] = useState<Set<NType>>(new Set());
  const [sel, setSel] = useState<{ type: NType; id: string } | null>(null);

  const { nodes, edges, pos } = useMemo(() => {
    const nodeMap = new Map<string, { type: NType; id: string }>();
    const ekey = (e: any) => `${e.src_type}:${e.src_id}->${e.dst_type}:${e.dst_id}`;
    const seen = new Set<string>();
    const es: Array<{ from: string; to: string; weight: number }> = [];
    for (const e of edgesRaw) {
      const from = `${e.src_type}:${e.src_id}`;
      const to = `${e.dst_type}:${e.dst_id}`;
      nodeMap.set(from, { type: e.src_type as NType, id: e.src_id });
      nodeMap.set(to, { type: e.dst_type as NType, id: e.dst_id });
      const k = ekey(e);
      if (seen.has(k)) continue; seen.add(k);
      es.push({ from, to, weight: e.weight ?? 1 });
    }
    // radial layout: type-cluster ring, deterministic angle per id
    const typeOrder = ALL_TYPES;
    const p: Record<string, [number, number]> = {};
    const cx = 470, cy = 310;
    for (const [key, n] of nodeMap) {
      const ringIndex = typeOrder.indexOf(n.type);
      const r = 100 + ringIndex * 28;
      const a = hashAngle(key);
      p[key] = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
    return { nodes: Array.from(nodeMap.entries()).map(([k, v]) => ({ key: k, ...v })), edges: es, pos: p };
  }, [edgesRaw]);

  const highlighted = useMemo(() => {
    if (!sel) return new Set<string>();
    const key = `${sel.type}:${sel.id}`;
    const set = new Set<string>([key]);
    for (const e of edges) { if (e.from === key) set.add(e.to); if (e.to === key) set.add(e.from); }
    return set;
  }, [sel, edges]);

  const visible = (t: NType) => filter.size === 0 || filter.has(t);

  return (
    <div>
      <PageHeader
        title="Knowledge Graph"
        subtitle="Live entities + correlations written by the engine on every ingest — customers, transactions, devices, IPs, IOCs, signals, investigations."
        badge={<span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full hairline bg-emerald-500/10 text-emerald-300">{nodes.length} nodes · {edges.length} edges</span>}
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {ALL_TYPES.map((t) => {
          const active = filter.has(t);
          return (
            <button key={t} onClick={() => setFilter((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; })}
              className={`text-[11px] px-2 py-1 rounded-full hairline inline-flex items-center gap-1 transition ${active ? "bg-white/10" : "bg-white/3 text-muted-foreground hover:text-foreground"}`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: typeMeta[t].color, boxShadow: `0 0 6px ${typeMeta[t].color}` }} />
              {t}
            </button>
          );
        })}
        {filter.size > 0 && <button onClick={() => setFilter(new Set())} className="text-[11px] px-2 py-1 rounded-full text-cyan-300 hover:underline">Clear</button>}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 lg:col-span-9 p-2 overflow-hidden">
          <div className="relative bg-black/30 rounded-xl bg-grid">
            <svg viewBox="0 0 940 620" className="w-full h-[560px]">
              {edges.map((e, i) => {
                const p1 = pos[e.from]; const p2 = pos[e.to];
                if (!p1 || !p2) return null;
                const active = highlighted.size > 0 && highlighted.has(e.from) && highlighted.has(e.to);
                const [t1, id1] = e.from.split(":");
                const [t2, id2] = e.to.split(":");
                if (!visible(t1 as NType) || !visible(t2 as NType)) return null;
                return (
                  <line key={i} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]}
                    stroke={active ? "var(--cyber-cyan)" : "rgba(255,255,255,0.08)"}
                    strokeWidth={active ? 1.5 : Math.min(2, 0.4 + e.weight / 5)}
                    style={active ? { filter: "drop-shadow(0 0 4px var(--cyber-cyan))" } : undefined}
                  />
                );
              })}
              {nodes.filter((n) => visible(n.type)).map((n) => {
                const p = pos[n.key]; if (!p) return null;
                const meta = typeMeta[n.type];
                const active = highlighted.has(n.key);
                const isSel = sel && sel.type === n.type && sel.id === n.id;
                return (
                  <g key={n.key} transform={`translate(${p[0]},${p[1]})`} className="cursor-pointer" onClick={() => setSel({ type: n.type, id: n.id })}>
                    {isSel && <circle r={22} fill="none" stroke={meta.color} strokeWidth="1" opacity="0.6">
                      <animate attributeName="r" from="16" to="28" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.6" to="0" dur="1.6s" repeatCount="indefinite" />
                    </circle>}
                    <circle r={13} fill="rgba(20,25,45,0.9)" stroke={meta.color} strokeWidth={active ? 2 : 1}
                      style={active ? { filter: `drop-shadow(0 0 8px ${meta.color})` } : highlighted.size > 0 ? { opacity: 0.35 } : { opacity: 0.85 }} />
                    <foreignObject x={-7} y={-7} width={14} height={14}>
                      <div style={{ color: meta.color }}>
                        <meta.Icon className="h-[14px] w-[14px]" />
                      </div>
                    </foreignObject>
                    {active && <text y={26} textAnchor="middle" fontSize="9" fill="white" fontFamily="ui-monospace">{shortLabel(n.type, n.id)}</text>}
                  </g>
                );
              })}
            </svg>
            {nodes.length === 0 && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                {isLoading ? "Loading graph…" : "No graph edges yet — ingest a batch on /ingest and the engine will populate this view."}
              </div>
            )}
          </div>
        </GlassCard>

        <div className="col-span-12 lg:col-span-3 space-y-4">
          <GlassCard>
            <SectionHeader title="Selected Entity" />
            {sel ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl grid place-items-center hairline" style={{ color: typeMeta[sel.type].color, background: `color-mix(in oklab, ${typeMeta[sel.type].color} 15%, transparent)` }}>
                    {(() => { const I = typeMeta[sel.type].Icon; return <I className="h-5 w-5" />; })()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{shortLabel(sel.type, sel.id)}</div>
                    <div className="text-[11px] text-muted-foreground">{sel.type}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected ({Math.max(0, highlighted.size - 1)})</div>
                  <div className="max-h-72 overflow-y-auto scrollbar-thin">
                    {[...highlighted].filter((k) => k !== `${sel.type}:${sel.id}`).map((k) => {
                      const n = nodes.find((x) => x.key === k); if (!n) return null;
                      return (
                        <button key={k} onClick={() => setSel({ type: n.type, id: n.id })} className="w-full text-left rounded-md hairline bg-white/3 px-2 py-1.5 hover:bg-white/6 flex items-center gap-2 mb-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: typeMeta[n.type].color }} />
                          <span className="flex-1 truncate">{shortLabel(n.type, n.id)}</span>
                          <span className="text-[10px] text-muted-foreground">{n.type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Click a node to explore its connections.</div>
            )}
          </GlassCard>
          <GlassCard>
            <SectionHeader title="Edge summary" />
            <div className="text-xs space-y-1 font-mono">
              {Object.entries(edges.reduce<Record<string, number>>((acc, e) => {
                const [t1] = e.from.split(":"); const [t2] = e.to.split(":");
                const k = `${t1} → ${t2}`; acc[k] = (acc[k] ?? 0) + 1; return acc;
              }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
