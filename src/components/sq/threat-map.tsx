// Global threat map — OpenStreetMap tiles via Leaflet.
// Renders one pulsing CircleMarker per country, sized/coloured by severity.
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { countryCoords } from "@/lib/mock/data";
import { useEffect } from "react";

type Sev = "critical" | "high" | "medium" | "low" | "info";
type Point = { country: string; count: number; severity: Sev };

const sevColor: Record<Sev, string> = {
  critical: "#ff2d55",
  high: "#ff9500",
  medium: "#ffcc00",
  low: "#34d399",
  info: "#38bdf8",
};

function Resizer() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export function ThreatMap({ points, className }: { points: Point[]; className?: string }) {
  return (
    <div
      className={className}
      style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#0b1220" }}
    >
      <MapContainer
        center={[20, 10]}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        worldCopyJump
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: "#0b1220" }}
        attributionControl
      >
        <Resizer />
        {/* Free, no-key CartoDB dark tiles (built on OSM data) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={["a", "b", "c", "d"]}
        />
        {points.map((p, i) => {
          const coord = countryCoords[p.country];
          if (!coord) return null;
          const [lon, lat] = coord;
          const color = sevColor[p.severity];
          const radius = Math.min(28, 6 + Math.log2(Math.max(2, p.count)) * 3);
          return (
            <CircleMarker
              key={`${p.country}-${i}`}
              center={[lat, lon]}
              radius={radius}
              pathOptions={{
                color,
                weight: 1.5,
                fillColor: color,
                fillOpacity: 0.35,
              }}
            >
              <Tooltip direction="top" opacity={0.95}>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                  <b>{p.country}</b> · {p.severity} · {p.count.toLocaleString()} events
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
