"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InscriptionResult } from "@/app/lib/epigraphy/types";
import EpigraphyOverlays, {
  OVERLAY_DEFAULTS,
  OVERLAY_GROUPS,
  type OverlayKey,
  type OverlayVisibility,
  type PlaceSearchEntry,
} from "./EpigraphyOverlays";

type Cluster = {
  key: string;
  lat: number;
  lon: number;
  label: string;
  rows: InscriptionResult[];
};

type Props = {
  // Rows to plot. Each row carries its own lat/lon (from the index), so the
  // map clusters by the inscription's own coordinate — no place-label lookup.
  results: InscriptionResult[];
  onSelect: (edcsId: string) => void;
  // Called when the user draws a rectangle/circle. Receives the subset of
  // `results` whose coordinates fall inside the shape, or null when the
  // selection is cleared (so the parent can fall back to the full set).
  onRegionFilter: (rows: InscriptionResult[] | null) => void;
};

type Mode = "markers" | "heatmap" | "hidden";

function clusterIcon(count: number): L.DivIcon {
  const size = count === 1 ? 26 : count < 5 ? 30 : count < 20 ? 36 : 44;
  const color =
    count === 1
      ? "#2563eb"
      : count < 5
        ? "#1d4ed8"
        : count < 20
          ? "#1e3a8a"
          : "#0f172a";
  const html = `<div style="
    width:${size}px;height:${size}px;border-radius:50%;
    background:${color};color:#fff;
    display:flex;align-items:center;justify-content:center;
    font:600 ${count >= 100 ? 11 : 12}px/1 system-ui,sans-serif;
    box-shadow:0 1px 4px rgba(0,0,0,.35);
    border:2px solid #fff;
  ">${count}</div>`;
  return L.divIcon({
    html,
    className: "epigraphy-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// leaflet.heat doesn't ship react bindings, so wrap it as a tiny helper that
// hooks into the parent map via useMap().
function HeatLayer({
  points,
  maxIntensity,
}: {
  points: Array<[number, number, number]>;
  maxIntensity: number;
}) {
  const map = useMap();
  useEffect(() => {
    const scaled = points.map(
      ([lat, lon, c]) =>
        [lat, lon, Math.log2((c ?? 1) + 1)] as [number, number, number],
    );
    const maxScaled = Math.log2((maxIntensity || 1) + 1);
    const layer = (
      L as unknown as {
        heatLayer: (
          latlngs: Array<[number, number, number]>,
          options?: Record<string, unknown>,
        ) => L.Layer;
      }
    ).heatLayer(scaled, {
      radius: 28,
      blur: 14,
      minOpacity: 0.55,
      maxZoom: 11,
      max: Math.max(0.5, maxScaled * 0.3),
      gradient: {
        0.0: "#1e3a8a",
        0.2: "#3b82f6",
        0.4: "#22d3ee",
        0.6: "#facc15",
        0.8: "#f97316",
        1.0: "#ef4444",
      },
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, maxIntensity]);
  return null;
}

// Region-selection overlay. Drawing is done with native Leaflet drag handlers
// (mirroring the existing LeafletMap.tsx pattern) rather than leaflet-draw to
// avoid a new dependency. When a shape is finished we compute the subset of
// `results` whose coordinates fall inside it and hand it back to the parent.
function RegionSelect({
  results,
  active,
  shape,
  onRegionFilter,
  onDrawn,
}: {
  results: InscriptionResult[];
  active: boolean;
  shape: "rectangle" | "circle";
  onRegionFilter: (rows: InscriptionResult[] | null) => void;
  onDrawn: () => void;
}) {
  const map = useMap();
  // Keep the latest results in a ref so the draw handlers (bound once per
  // activation) always filter against the current set.
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const layerRef = useRef<L.Rectangle | L.Circle | null>(null);

  useEffect(() => {
    if (!active) return;

    // Disable map dragging while drawing so the gesture creates a shape.
    map.dragging.disable();
    const container = map.getContainer();
    const prevCursor = container.style.cursor;
    container.style.cursor = "crosshair";

    let start: L.LatLng | null = null;
    let temp: L.Rectangle | L.Circle | null = null;

    function clearTemp() {
      if (temp) {
        map.removeLayer(temp);
        temp = null;
      }
    }

    function onDown(e: L.LeafletMouseEvent) {
      start = e.latlng;
      clearTemp();
    }

    function onMove(e: L.LeafletMouseEvent) {
      if (!start) return;
      clearTemp();
      if (shape === "rectangle") {
        temp = L.rectangle(L.latLngBounds(start, e.latlng), {
          color: "#2563eb",
          weight: 2,
          fillOpacity: 0.1,
        }).addTo(map);
      } else {
        const radius = start.distanceTo(e.latlng);
        temp = L.circle(start, {
          radius,
          color: "#2563eb",
          weight: 2,
          fillOpacity: 0.1,
        }).addTo(map);
      }
    }

    function onUp(e: L.LeafletMouseEvent) {
      if (!start) return;
      const rows = resultsRef.current;
      let inside: InscriptionResult[];
      if (shape === "rectangle") {
        const bounds = L.latLngBounds(start, e.latlng);
        inside = rows.filter(
          (r) =>
            r.lat != null &&
            r.lon != null &&
            bounds.contains(L.latLng(r.lat, r.lon)),
        );
      } else {
        const center = start;
        const radius = center.distanceTo(e.latlng);
        inside = rows.filter(
          (r) =>
            r.lat != null &&
            r.lon != null &&
            center.distanceTo(L.latLng(r.lat, r.lon)) <= radius,
        );
      }

      // Persist the final shape as a static overlay so the user sees their
      // selection. Replace any prior persisted shape.
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      if (temp) {
        layerRef.current = temp;
        temp = null; // ownership transferred; don't let cleanup remove it
      }

      start = null;
      onRegionFilter(inside.length > 0 ? inside : []);
      onDrawn(); // turn drawing mode off
    }

    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);

    return () => {
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
      clearTemp();
      map.dragging.enable();
      container.style.cursor = prevCursor;
    };
  }, [map, active, shape, onRegionFilter, onDrawn]);

  // Expose a way to clear the persisted shape from the parent via a custom
  // event on the map container.
  useEffect(() => {
    const container = map.getContainer();
    function clear() {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    }
    container.addEventListener("epigraphy:clear-region", clear);
    return () =>
      container.removeEventListener("epigraphy:clear-region", clear);
  }, [map]);

  return null;
}

export default function EpigraphyMapView({
  results,
  onSelect,
  onRegionFilter,
}: Props) {
  const [mode, setMode] = useState<Mode>("markers");
  const [drawing, setDrawing] = useState<null | "rectangle" | "circle">(null);
  const [overlays, setOverlays] = useState<OverlayVisibility>(OVERLAY_DEFAULTS);
  const [showLayers, setShowLayers] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Pleiades place search. `placeIndex` is filled once the overlays load; the
  // query filters it; `focusPlace` is the chosen entry handed back down to the
  // overlay layer to fly to and open.
  const placeIndexRef = useRef<PlaceSearchEntry[]>([]);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSearchEntry[]>([]);
  const [showPlaceResults, setShowPlaceResults] = useState(false);
  const [focusPlace, setFocusPlace] = useState<PlaceSearchEntry | null>(null);

  const handleSearchIndex = useCallback((places: PlaceSearchEntry[]) => {
    placeIndexRef.current = places;
  }, []);

  function runPlaceSearch(q: string) {
    setPlaceQuery(q);
    const needle = q.trim().toLowerCase();
    if (!needle) {
      setPlaceResults([]);
      setShowPlaceResults(false);
      return;
    }
    const matches = placeIndexRef.current.filter((p) =>
      [p.title, p.description, p.typeName]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
    matches.sort((a, b) => {
      const at = a.title.toLowerCase().includes(needle) ? 0 : 1;
      const bt = b.title.toLowerCase().includes(needle) ? 0 : 1;
      if (at !== bt) return at - bt;
      return a.title.localeCompare(b.title);
    });
    setPlaceResults(matches.slice(0, 50));
    setShowPlaceResults(true);
  }

  function selectPlace(p: PlaceSearchEntry) {
    // Switch the place's layer on (the overlay layer flies + opens once the
    // cluster is on the map). Re-set focusPlace even if it's the same entry by
    // clearing first, so re-selecting always re-triggers the fly effect.
    setOverlays((v) => (v[p.layerKey] ? v : { ...v, [p.layerKey]: true }));
    setFocusPlace(null);
    // Defer so the cleared focus commits before the new one.
    requestAnimationFrame(() => setFocusPlace(p));
    setShowPlaceResults(false);
  }

  const toggleOverlay = (key: OverlayKey) =>
    setOverlays((v) => ({ ...v, [key]: !v[key] }));

  const setGroup = (keys: OverlayKey[], on: boolean) =>
    setOverlays((v) => {
      const next = { ...v };
      for (const k of keys) next[k] = on;
      return next;
    });

  // The map lives inside resizable/toggleable panes, so its container can
  // change size at any time. Leaflet only recomputes tile/marker positions on
  // invalidateSize(), so watch the wrapper and nudge the map whenever it
  // resizes (debounced to the next animation frame).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        mapRef.current?.invalidateSize();
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const clusters = useMemo<Cluster[]>(() => {
    const buckets = new Map<string, Cluster>();
    const seenInCluster = new Map<string, Set<string>>();
    for (const r of results) {
      if (r.lat == null || r.lon == null) continue;
      const key = `${r.lat.toFixed(5)},${r.lon.toFixed(5)}`;
      let cluster = buckets.get(key);
      let seen = seenInCluster.get(key);
      if (!cluster) {
        cluster = {
          key,
          lat: r.lat,
          lon: r.lon,
          label: r.placeLabel ?? "(Unknown)",
          rows: [],
        };
        buckets.set(key, cluster);
        seen = new Set();
        seenInCluster.set(key, seen);
      }
      if (seen!.has(r.edcsId)) continue;
      seen!.add(r.edcsId);
      cluster.rows.push(r);
    }
    return Array.from(buckets.values()).sort(
      (a, b) => b.rows.length - a.rows.length,
    );
  }, [results]);

  const heatPoints = useMemo<Array<[number, number, number]>>(
    () => clusters.map((c) => [c.lat, c.lon, c.rows.length]),
    [clusters],
  );
  const heatMax = useMemo(
    () => clusters.reduce((m, c) => Math.max(m, c.rows.length), 0),
    [clusters],
  );

  const center: [number, number] =
    clusters.length > 0 ? [clusters[0].lat, clusters[0].lon] : [41.9, 12.5];

  function clearRegion() {
    setDrawing(null);
    onRegionFilter(null);
    mapRef.current
      ?.getContainer()
      .dispatchEvent(new Event("epigraphy:clear-region"));
  }

  const toolBtn = (label: string, on: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className={
        "px-2 py-0.5 rounded " +
        (on
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted")
      }
    >
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      {/* Pleiades place search (top-left, offset right of the zoom control) */}
      <div className="absolute top-2 left-12 z-[1000]" style={{ width: 260 }}>
        <div className="relative">
          <input
            type="text"
            value={placeQuery}
            onChange={(e) => runPlaceSearch(e.target.value)}
            onFocus={() => {
              if (placeResults.length > 0) setShowPlaceResults(true);
            }}
            placeholder="Search places (name, type, description)…"
            className="w-full px-2.5 py-1.5 pr-7 text-sm rounded border border-input bg-card shadow focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {placeQuery && (
            <button
              onClick={() => runPlaceSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
              title="Clear"
            >
              ✕
            </button>
          )}
          {showPlaceResults && (
            <div className="absolute mt-1 w-full bg-popover rounded shadow-xl border border-border max-h-72 overflow-y-auto">
              {placeResults.length === 0 ? (
                <div className="px-2.5 py-2 text-xs text-muted-foreground">
                  No matching places
                </div>
              ) : (
                placeResults.map((p, idx) => (
                  <button
                    key={`${p.layerKey}:${p.id}:${idx}`}
                    onClick={() => selectPlace(p)}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-accent border-b border-border last:border-b-0"
                  >
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {p.typeName}
                      {p.description ? ` · ${p.description}` : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1 items-end">
        <div className="flex gap-1 text-xs bg-card border border-border rounded shadow p-1">
          {toolBtn("Markers", mode === "markers", () => setMode("markers"))}
          {toolBtn("Heatmap", mode === "heatmap", () =>
            setMode("heatmap"),
          )}
          {toolBtn("Hide", mode === "hidden", () => setMode("hidden"))}
        </div>
        <div className="flex gap-1 text-xs bg-card border border-border rounded shadow p-1">
          {toolBtn("□ Rectangle", drawing === "rectangle", () =>
            setDrawing((d) => (d === "rectangle" ? null : "rectangle")),
          )}
          {toolBtn("○ Circle", drawing === "circle", () =>
            setDrawing((d) => (d === "circle" ? null : "circle")),
          )}
          {toolBtn("Clear selection", false, clearRegion)}
        </div>
        {drawing && (
          <div className="text-[11px] bg-primary text-primary-foreground rounded px-2 py-0.5 shadow">
            Drag on the map to select a region
          </div>
        )}

        <div className="text-xs bg-card border border-border rounded shadow">
          <button
            onClick={() => setShowLayers((v) => !v)}
            className="w-full px-2 py-1 flex items-center justify-between gap-2 font-medium"
          >
            <span>Map layers</span>
            <span className="text-muted-foreground">{showLayers ? "▲" : "▼"}</span>
          </button>
          {showLayers && (
            <div className="border-t border-border p-1.5 max-h-[60vh] overflow-y-auto flex flex-col gap-2 w-44">
              {OVERLAY_GROUPS.map((g) => {
                const keys = g.items.map((i) => i.key);
                const allOn = keys.every((k) => overlays[k]);
                return (
                  <div key={g.group}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-muted-foreground">
                        {g.group}
                      </span>
                      <button
                        onClick={() => setGroup(keys, !allOn)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {allOn ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="flex flex-col gap-0.5 pl-0.5">
                      {g.items.map((m) => (
                        <label
                          key={m.key}
                          className="flex items-center gap-1.5 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={overlays[m.key]}
                            onChange={() => toggleOverlay(m.key)}
                          />
                          {m.iconHtml ? (
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 shrink-0"
                              dangerouslySetInnerHTML={{ __html: m.iconHtml }}
                            />
                          ) : (
                            <span
                              className="inline-block w-3 h-2 rounded-sm shrink-0 border border-black/10"
                              style={{ background: m.swatch }}
                            />
                          )}
                          <span>{m.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={4}
        style={{ height: "100%", width: "100%" }}
        ref={(m) => {
          mapRef.current = m;
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <EpigraphyOverlays
          visibility={overlays}
          onSearchIndex={handleSearchIndex}
          focusPlace={focusPlace}
        />

        <RegionSelect
          results={results}
          active={drawing !== null}
          shape={drawing ?? "rectangle"}
          onRegionFilter={onRegionFilter}
          onDrawn={() => setDrawing(null)}
        />

        {mode === "markers" &&
          clusters.map((c) => (
            <Marker
              key={c.key}
              position={[c.lat, c.lon]}
              icon={clusterIcon(c.rows.length)}
            >
              <Popup maxHeight={260}>
                <div className="text-sm" style={{ minWidth: 220 }}>
                  <div className="font-semibold">{c.label}</div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {c.rows.length} inscriptions
                    </span>
                    <button
                      onClick={() => onRegionFilter(c.rows)}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Filter by this place
                    </button>
                  </div>
                  <ul className="text-xs space-y-0.5 max-h-48 overflow-auto">
                    {c.rows.map((r, idx) => (
                      <li key={`${r.edcsId}-${idx}`}>
                        <button
                          onClick={() => onSelect(r.edcsId)}
                          className="text-primary hover:underline font-mono"
                        >
                          {r.edcsId}
                        </button>
                        {(r.datingFrom || r.datingTo) && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({r.datingFrom ?? "?"}–{r.datingTo ?? "?"})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </Popup>
            </Marker>
          ))}

        {mode === "heatmap" && heatPoints.length > 0 && (
          <HeatLayer points={heatPoints} maxIntensity={heatMax} />
        )}
      </MapContainer>
    </div>
  );
}
