export function Heatmap({ data, labelsX, labelsY }: { data: number[][]; labelsX?: string[]; labelsY?: string[] }) {
  const max = Math.max(...data.flat());
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <div className="min-w-[560px]">
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(${data[0].length}, minmax(0,1fr))` }}>
          <div />
          {labelsX?.map((l, i) => (
            <div key={i} className="text-[9px] text-muted-foreground text-center tabular-nums">{l}</div>
          ))}
        </div>
        {data.map((row, ri) => (
          <div key={ri} className="grid mt-1 items-center" style={{ gridTemplateColumns: `48px repeat(${row.length}, minmax(0,1fr))` }}>
            <div className="text-[10px] text-muted-foreground uppercase">{labelsY?.[ri]}</div>
            {row.map((v, ci) => {
              const a = v / max;
              const bg = a > 0.7 ? "var(--risk-critical)"
                : a > 0.5 ? "var(--risk-high)"
                : a > 0.3 ? "var(--risk-medium)"
                : a > 0.15 ? "var(--cyber-blue)"
                : "var(--muted)";
              return (
                <div
                  key={ci}
                  title={`${labelsY?.[ri] ?? ""} ${labelsX?.[ci] ?? ""} — ${v}`}
                  className="aspect-square rounded-[3px] mx-[1px] transition-transform hover:scale-125 hover:z-10 cursor-pointer"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${bg} ${20 + a*60}%, transparent)`,
                    boxShadow: a > 0.5 ? `0 0 6px ${bg}` : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
