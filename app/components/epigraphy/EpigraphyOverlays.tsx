"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { placePinHtml, placeLegendHtml, type PlaceIconKey } from "./placeIcons";

// Reference-layer overlays carried over from the main Roman Atlas map. The
// hierarchy mirrors the original control panel: a "Roads & Rivers" group of
// line layers, and a "Places" group of the 16 Pleiades place types (settlement,
// villa, fort, temple, …). Each layer is fetched once, built into a Leaflet
// layer, and added/removed as the parent toggles it. Inscription markers stay
// the primary layer; these sit underneath as geographic context.
//
// (Custom-only place types — Residences, Forums — come from the SPARQL
// endpoint in the full app and are omitted in this static index mode.)

// ── Route (line) layers ──────────────────────────────────────────────────
const ROUTE_LAYERS = [
  { key: "mainRoad", label: "Main road", match: "Main Road", color: "#FF8C00", weight: 3, opacity: 0.85 },
  { key: "secondaryRoad", label: "Secondary road", match: "Secondary Road", color: "#FFA500", weight: 2, opacity: 0.7 },
  { key: "seaLane", label: "Sea lane", match: "Sea Lane", color: "#06b6d4", weight: 2, opacity: 0.75 },
  { key: "river", label: "River", match: "River", color: "#1d4ed8", weight: 2, opacity: 0.8 },
] as const;

// ── Pleiades place (point) layers — the full 16-type set ─────────────────
// `match` lists every placeTypes value mapped to this layer (mirrors the
// original LeafletMap typeConfigs, including the fort-2 / temple-2 aliases).
// `key` doubles as the SVG icon key (see placeIcons.ts). Colors are toned down
// from the original palette so the white glyph stays legible on the pin.
const PLACE_LAYERS = [
  { key: "settlement", label: "City / settlement", color: "#B8860B", match: ["settlement"] },
  { key: "villa", label: "Villa", color: "#2e8b57", match: ["villa"] },
  { key: "fort", label: "Fort", color: "#c81e1e", match: ["fort", "fort-2"] },
  { key: "temple", label: "Temple", color: "#800080", match: ["temple", "temple-2"] },
  { key: "station", label: "Station", color: "#d97706", match: ["station"] },
  { key: "archaeological", label: "Archaeological site", color: "#92400e", match: ["archaeological-site"] },
  { key: "cemetery", label: "Cemetery", color: "#525252", match: ["cemetery"] },
  { key: "sanctuary", label: "Sanctuary", color: "#be185d", match: ["sanctuary"] },
  { key: "bridge", label: "Bridge", color: "#6b7280", match: ["bridge"] },
  { key: "aqueduct", label: "Aqueduct", color: "#0e7490", match: ["aqueduct"] },
  { key: "church", label: "Church", color: "#9d174d", match: ["church"] },
  { key: "bath", label: "Bath", color: "#0891b2", match: ["bath"] },
  { key: "quarry", label: "Quarry", color: "#b45309", match: ["quarry"] },
  { key: "port", label: "Port", color: "#1e3a8a", match: ["port"] },
  { key: "theater", label: "Theater", color: "#ea580c", match: ["theater"] },
  { key: "amphitheatre", label: "Amphitheatre", color: "#b91c1c", match: ["amphitheatre"] },
] as const;

type RouteKey = (typeof ROUTE_LAYERS)[number]["key"];
type PlaceKey = (typeof PLACE_LAYERS)[number]["key"];
export type OverlayKey = RouteKey | PlaceKey;

export type OverlayVisibility = Record<OverlayKey, boolean>;

// A searchable Pleiades place, surfaced to the parent for the place search box.
// Carries the layer key (so the parent can switch that overlay on) plus the
// live Leaflet marker and its cluster, so a selection can fly the map there and
// open the popup. `lat`/`lon` drive the flyTo; the marker handles the popup.
export type PlaceSearchEntry = {
  id: string;
  title: string;
  description: string;
  typeName: string;
  layerKey: PlaceKey;
  lat: number;
  lon: number;
  marker: L.Marker;
  cluster: L.LayerGroup;
};

// Grouped metadata for building the control UI hierarchy. Route layers show a
// colored line swatch; place layers carry `iconHtml` — the bare SVG glyph in
// the category color — so the legend matches the map markers.
export const OVERLAY_GROUPS: Array<{
  group: string;
  items: Array<{ key: OverlayKey; label: string; swatch: string; iconHtml?: string }>;
}> = [
  {
    group: "Roads & rivers",
    items: ROUTE_LAYERS.map((r) => ({ key: r.key, label: r.label, swatch: r.color })),
  },
  {
    group: "Places (Pleiades)",
    items: PLACE_LAYERS.map((p) => ({
      key: p.key,
      label: p.label,
      swatch: p.color,
      iconHtml: placeLegendHtml(p.color, p.key as PlaceIconKey),
    })),
  },
];

export const OVERLAY_KEYS: OverlayKey[] = [
  ...ROUTE_LAYERS.map((r) => r.key),
  ...PLACE_LAYERS.map((p) => p.key),
];

export const OVERLAY_DEFAULTS: OverlayVisibility = OVERLAY_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: false }),
  {} as OverlayVisibility,
);

type RouteFeature = {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: { name?: string; type?: string; _id?: string };
};

function routesUrl() {
  return process.env.NEXT_PUBLIC_ROUTES_URL
    ? "/api/data/routes"
    : "/route-segments-all.ndjson";
}

function placesUrl() {
  return process.env.NEXT_PUBLIC_PLACES_URL
    ? "/api/data/places"
    : "/pleiades-places-filtered-expanded-with-dates.json";
}

function routePopup(p: RouteFeature["properties"]): string {
  const id = p._id;
  return (
    `<div style="padding:6px"><strong>${p.name ?? "(Unnamed)"}</strong>` +
    `<div style="color:#666;font-size:12px">Type: ${p.type ?? "?"}</div>` +
    (id
      ? `<a href="https://itiner-e.org/route-segment/${id}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-size:12px">Open in Itiner-e →</a>`
      : "") +
    `</div>`
  );
}

export default function EpigraphyOverlays({
  visibility,
  onSearchIndex,
  focusPlace,
}: {
  visibility: OverlayVisibility;
  // Called once the Pleiades places finish loading, with the full searchable
  // set. The parent owns the search UI; this just hands it the data.
  onSearchIndex?: (places: PlaceSearchEntry[]) => void;
  // A place the parent wants centred + popped. We watch this together with
  // `visibility` so we can wait until the place's layer is actually on the map
  // (the parent switches it on by flipping `visibility`) before flying there.
  focusPlace?: PlaceSearchEntry | null;
}) {
  const map = useMap();
  // Built layers, keyed by OverlayKey. Absent until the relevant fetch resolves.
  const layersRef = useRef<Partial<Record<OverlayKey, L.Layer>>>({});
  // Latest requested visibility, so async fetches apply the current state.
  const visRef = useRef(visibility);
  visRef.current = visibility;

  // Apply a layer's desired on/off state against the map.
  function sync(key: OverlayKey) {
    const layer = layersRef.current[key];
    if (!layer) return;
    const want = visRef.current[key];
    const on = map.hasLayer(layer);
    if (want && !on) map.addLayer(layer);
    else if (!want && on) map.removeLayer(layer);
  }

  // Fetch routes once, split into the line layers by `properties.type`.
  useEffect(() => {
    let cancelled = false;
    fetch(routesUrl())
      .then((r) => r.text())
      .then((text) => {
        if (cancelled) return;
        const features: RouteFeature[] = [];
        for (const line of text.trim().split("\n")) {
          try {
            const f = JSON.parse(line);
            if (f && f.properties) features.push(f);
          } catch {
            /* skip malformed line */
          }
        }
        for (const cfg of ROUTE_LAYERS) {
          const subset = features.filter((f) => f.properties?.type === cfg.match);
          if (subset.length === 0) continue;
          const layer = L.geoJSON(
            { type: "FeatureCollection", features: subset } as never,
            {
              style: { color: cfg.color, weight: cfg.weight, opacity: cfg.opacity },
              onEachFeature: (feature, lyr) =>
                lyr.bindPopup(routePopup((feature as RouteFeature).properties)),
            },
          );
          layersRef.current[cfg.key] = layer;
          sync(cfg.key);
        }
      })
      .catch((e) => console.error("overlay routes load failed", e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Fetch Pleiades places once, bucket into all 16 type layers (clustered).
  useEffect(() => {
    let cancelled = false;
    fetch(placesUrl())
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const places: Array<{
          id?: string | number;
          title?: string;
          description?: string;
          placeTypes?: string[];
          reprPoint?: [number, number];
        }> = data["@graph"] ?? [];

        const searchIndex: PlaceSearchEntry[] = [];

        for (const cfg of PLACE_LAYERS) {
          const matchSet = new Set<string>(cfg.match);
          const features = places
            .filter(
              (p) =>
                p.reprPoint &&
                (p.placeTypes ?? []).some((t) => matchSet.has(t)),
            )
            .map((p) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: p.reprPoint! },
              properties: {
                id: p.id != null ? String(p.id) : "",
                title: p.title ?? "Unnamed",
                description: p.description ?? "",
                uri: p.id ? `https://pleiades.stoa.org/places/${p.id}` : "",
              },
            }));
          if (features.length === 0) continue;

          const icon = L.divIcon({
            className: "epigraphy-place-marker",
            // Teardrop pin in the category color with a white SVG glyph in its
            // head — a consistent icon set across all 16 categories.
            html: placePinHtml(cfg.color, cfg.key as PlaceIconKey),
            iconSize: [28, 36],
            iconAnchor: [14, 36],
            popupAnchor: [0, -32],
          });

          const cluster = (
            L as unknown as {
              markerClusterGroup: (o?: Record<string, unknown>) => L.LayerGroup;
            }
          ).markerClusterGroup({
            maxClusterRadius: 50,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
          });

          const geo = L.geoJSON(
            { type: "FeatureCollection", features } as never,
            {
              pointToLayer: (feature, latlng) => {
                const t = (feature as { properties?: { title?: string } })
                  .properties?.title;
                // Native title attr → hover tooltip with the place name.
                return L.marker(latlng, {
                  icon,
                  title: t && t !== "Unnamed" ? t : undefined,
                });
              },
              onEachFeature: (feature, lyr) => {
                const props = (
                  feature as {
                    properties: {
                      id: string;
                      title: string;
                      description: string;
                      uri: string;
                    };
                  }
                ).properties;
                // Record this marker in the search index (skip unnamed places —
                // they can't be searched by name meaningfully).
                if (props.title && props.title !== "Unnamed") {
                  const ll = (lyr as L.Marker).getLatLng();
                  searchIndex.push({
                    id: props.id || `${cfg.key}-${ll.lat},${ll.lng}`,
                    title: props.title,
                    description: props.description,
                    typeName: cfg.label,
                    layerKey: cfg.key,
                    lat: ll.lat,
                    lon: ll.lng,
                    marker: lyr as L.Marker,
                    cluster,
                  });
                }
                lyr.bindPopup(
                  `<div style="padding:6px"><strong>${props.title}</strong>` +
                    `<div style="color:#666;font-size:11px">${cfg.label}</div>` +
                    (props.description
                      ? `<div style="color:#666;font-size:12px">${props.description}</div>`
                      : "") +
                    (props.uri
                      ? `<a href="${props.uri}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-size:12px">Open in Pleiades →</a>`
                      : "") +
                    `</div>`,
                );
              },
            },
          );
          geo.eachLayer((l) => cluster.addLayer(l));

          layersRef.current[cfg.key] = cluster;
          sync(cfg.key);
        }

        // Hand the assembled search index up to the parent (sorted by name).
        searchIndex.sort((a, b) => a.title.localeCompare(b.title));
        onSearchIndex?.(searchIndex);
      })
      .catch((e) => console.error("overlay places load failed", e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // React to visibility changes for already-built layers.
  useEffect(() => {
    (Object.keys(layersRef.current) as OverlayKey[]).forEach(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibility]);

  // Fly to and open a place chosen from the search box. The parent first flips
  // the place's layer on via `visibility`; the sync effect above (same [visibility]
  // dep, declared earlier so it runs first) adds the cluster to the map. Here we
  // confirm the cluster is present, fly there, expand the cluster, and pop it.
  useEffect(() => {
    if (!focusPlace) return;
    const cluster = focusPlace.cluster;
    // Layer not on the map yet (visibility toggle hasn't propagated) — wait for
    // the next render where it will be.
    if (!map.hasLayer(cluster)) return;

    map.flyTo([focusPlace.lat, focusPlace.lon], Math.max(map.getZoom(), 10), {
      duration: 1,
    });
    const open = () => {
      const zoomToShow = (
        cluster as unknown as {
          zoomToShowLayer?: (l: L.Layer, cb: () => void) => void;
        }
      ).zoomToShowLayer;
      if (typeof zoomToShow === "function") {
        zoomToShow.call(cluster, focusPlace.marker, () => {
          focusPlace.marker.openPopup();
        });
      } else {
        focusPlace.marker.openPopup();
      }
    };
    map.once("moveend", open);
    return () => {
      map.off("moveend", open);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPlace, visibility]);

  // Remove layers on unmount so they don't leak across map remounts.
  useEffect(() => {
    return () => {
      Object.values(layersRef.current).forEach((layer) => {
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      });
    };
  }, [map]);

  return null;
}
