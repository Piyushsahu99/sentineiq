import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { graph, type GNode } from "@/lib/mock/data";
import { User, CreditCard, Smartphone, Wifi, Coins, Store, Skull, Bug, MapPin, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_app/graph")({
  component: GraphPage,
});

const typeMeta: Record<GNode["type"], { color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  Customer: { color: "var(--cyber-cyan)", Icon: User },
  Account: { color: "#60a5fa", Icon: CreditCard },
  Device: { color: "#a78bfa", Icon: Smartphone },
  IP: { color: "#f472b6", Icon: Wifi },
  Transaction: { color: "#facc15", Icon: Coins },
  Merchant: { color: "#fb923c", Icon: Store },
  Actor: { color: "var(--risk-critical)", Icon: Skull },
  Malware: { color: "#ef4444", Icon: Bug },
  Location: { color: "#34d399", Icon: MapPin },
  VPN: { color: "#93c5fd", Icon: ShieldAlert },
};

// Fixed layout for a clean look — deterministic positions per node id.
const layout: Record<string, [number, number]> = {
  c1: [420, 220], a1: [420, 340], d1: [220, 260], d2: [620, 260],
  ip1: [720, 180], ip2: [140, 200], v1: [820, 140], l1: [120, 320], l2: [820, 80],
  t1: [420, 460], t2: [280, 460], m1: [560, 540], act1: [720, 540], mw1: [720, 380],
};

function GraphPage() {
  const [sel, setSel] = useState<GNode>(graph.nodes[0]);
  const [filter, setFilter] = useState<Set<GNode["type"]>>(new Set());

  const highlighted = useMemo(() => {
    const set = new Set<string>([sel.id]);
    graph.edges.forEach((e) => { if (e.from === sel.id) set.add(e.to); if (e.to === sel.id) set.add(e.from); });
    return set;
  }, [sel]);

  const visible = (n: GNode) => filter.size === 0 || filter.has(n.type);

  return (
    <div>
      <PageHeader
        title="Knowledge Graph"
        subtitle="Entities and relationships across customers, devices, IPs, transactions, threat actors, malware, and infrastructure."
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(Object.keys(typeMeta) as GNode["type"][]).map((t) => {
          const active = filter.has(t);
          return (
            <button
              key={t}
              onClick={() => setFilter((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; })}
              className={`text-[11px] px-2 py-1 rounded-full hairline inline-flex items-center gap-1 transition ${active ? "bg-white/10" : "bg-white/3 text-muted-foreground hover:text-foreground"}`}
            >
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
              {graph.edges.map((e, i) => {
                const [x1, y1] = layout[e.from]; const [x2, y2] = layout[e.to];
                const active = highlighted.has(e.from) && highlighted.has(e.to);
                return (
                  <g key={i}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={active ? "var(--cyber-cyan)" : "rgba(255,255,255,0.12)"}
                      strokeWidth={active ? 1.5 : 1}
                      style={active ? { filter: "drop-shadow(0 0 4px var(--cyber-cyan))" } : undefined}
                    />
                    {e.label && active && (
                      <text x={(x1+x2)/2} y={(y1+y2)/2 - 4} fontSize="9" fill="rgba(255,255,255,0.7)" textAnchor="middle" fontFamily="ui-monospace">{e.label}</text>
                    )}
                  </g>
                );
              })}
              {graph.nodes.filter(visible).map((n) => {
                const [x, y] = layout[n.id];
                const meta = typeMeta[n.type];
                const active = highlighted.has(n.id);
                const isSel = sel.id === n.id;
                return (
                  <g key={n.id} transform={`translate(${x},${y})`} className="cursor-pointer" onClick={() => setSel(n)}>
                    {isSel && <circle r={26} fill="none" stroke={meta.color} strokeWidth="1" opacity="0.5">
                      <animate attributeName="r" from="20" to="32" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.6" to="0" dur="1.6s" repeatCount="indefinite" />
                    </circle>}
                    <circle r={18} fill="rgba(20,25,45,0.85)" stroke={meta.color} strokeWidth={active ? 2 : 1}
                      style={active ? { filter: `drop-shadow(0 0 8px ${meta.color})` } : { opacity: 0.6 }} />
                    <foreignObject x={-9} y={-9} width={18} height={18}>
                      <div style={{ color: meta.color }}>
                        <meta.Icon className="h-[18px] w-[18px]" />
                      </div>
                    </foreignObject>
                    <text y={34} textAnchor="middle" fontSize="10" fill={active ? "white" : "rgba(255,255,255,0.5)"}>{n.label}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </GlassCard>

        <div className="col-span-12 lg:col-span-3 space-y-4">
          <GlassCard>
            <SectionHeader title="Selected Entity" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl grid place-items-center hairline" style={{ color: typeMeta[sel.type].color, background: `color-mix(in oklab, ${typeMeta[sel.type].color} 15%, transparent)` }}>
                {(() => { const I = typeMeta[sel.type].Icon; return <I className="h-5 w-5" />; })()}
              </div>
              <div>
                <div className="text-sm font-semibold">{sel.label}</div>
                <div className="text-[11px] text-muted-foreground">{sel.type} · {sel.id}</div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected ({highlighted.size - 1})</div>
              {[...highlighted].filter((id) => id !== sel.id).map((id) => {
                const n = graph.nodes.find((x) => x.id === id)!;
                return (
                  <button key={id} onClick={() => setSel(n)} className="w-full text-left rounded-md hairline bg-white/3 px-2 py-1.5 hover:bg-white/6 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: typeMeta[n.type].color }} />
                    <span className="flex-1 truncate">{n.label}</span>
                    <span className="text-[10px] text-muted-foreground">{n.type}</span>
                  </button>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
