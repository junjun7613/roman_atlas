// Unified single-color SVG glyphs for the Pleiades place categories. Each
// entry is the inner markup of a 24×24 viewBox, drawn with currentColor so the
// marker can tint it (white on a colored pin). Keep these as simple, legible
// line/solid symbols — a coherent icon set rather than mixed emoji.
//
// Paths use stroke-based line art at strokeWidth 2 unless a filled glyph reads
// better at small sizes. `fill="none"` shapes inherit stroke=currentColor;
// solid shapes set fill="currentColor".

export type PlaceIconKey =
  | "settlement"
  | "villa"
  | "fort"
  | "temple"
  | "station"
  | "archaeological"
  | "cemetery"
  | "sanctuary"
  | "bridge"
  | "aqueduct"
  | "church"
  | "bath"
  | "quarry"
  | "port"
  | "theater"
  | "amphitheatre";

// Inner SVG for each category (24×24 viewBox, currentColor).
export const PLACE_ICON_PATHS: Record<PlaceIconKey, string> = {
  // City / settlement — cluster of buildings.
  settlement:
    '<path fill="currentColor" d="M3 21V9l5-3 5 3v3h8v9H3Zm2-2h6v-8.8L8 8.3 5 10.2V19Zm8 0h6v-5h-6v5Z"/>',
  // Villa — house with pitched roof.
  villa:
    '<path fill="currentColor" d="M12 4 3 11h2v8h5v-5h4v5h5v-8h2L12 4Z"/>',
  // Fort — castle wall with crenellations.
  fort:
    '<path fill="currentColor" d="M4 21V8h2V5h2v3h2V5h2v3h2V5h2v3h2v13h-5v-4h-4v4H4Z"/>',
  // Temple — classical pediment over columns.
  temple:
    '<path fill="currentColor" d="M12 3 3 8v2h18V8L12 3ZM5 11v7H4v2h16v-2h-1v-7h-2v7h-2v-7h-2v7h-2v-7H7v7H5v-7Z"/>',
  // Station — milestone / signpost.
  station:
    '<path fill="currentColor" d="M11 21v-7H6V4h11l-2 3 2 3h-4v4h5v2h-5v5h-2Z"/>',
  // Archaeological site — broken column.
  archaeological:
    '<path fill="currentColor" d="M9 3h6l-.5 4h-5L9 3Zm.3 6h5.4l-.4 4H9.7l-.4-4Zm.5 6h4.4l-.5 6H10.3l-.5-6Z"/>',
  // Cemetery — gravestone with cross.
  cemetery:
    '<path fill="currentColor" d="M8 22V10a4 4 0 0 1 8 0v12H8Zm3-9h2v-2h2V9h-2V7h-2v2H9v2h2v2Z"/>',
  // Sanctuary — flame / sacred fire.
  sanctuary:
    '<path fill="currentColor" d="M12 2c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1 .5-2 1.5 2 1.5 3.5 1.5 5a4 4 0 0 1-8 0c0-4 3-6 4-10Z"/>',
  // Bridge — arched span.
  bridge:
    '<path fill="none" stroke="currentColor" stroke-width="2" d="M3 16h18M5 16v-3M19 16v-3M3 16a9 9 0 0 1 18 0M12 16v4"/>',
  // Aqueduct — water drop.
  aqueduct:
    '<path fill="currentColor" d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z"/>',
  // Church — building with cross.
  church:
    '<path fill="currentColor" d="M11 2h2v3h3v2h-3v3l5 3v9h-4v-4h-4v4H6v-9l5-3V7H8V5h3V2Z"/>',
  // Bath — wavy water lines.
  bath:
    '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M3 9c2 0 2 2 4.5 2S9 9 12 9s3 2 4.5 2S19 9 21 9M3 14c2 0 2 2 4.5 2S9 14 12 14s3 2 4.5 2S19 14 21 14"/>',
  // Quarry — pickaxe.
  quarry:
    '<path fill="currentColor" d="M3 6c5-4 13-4 18 0-3 0-5 1-7 2l5 13-2 1-6-12c-2 1-4 1-8-4Z"/>',
  // Port — anchor.
  port:
    '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 6v13M9 6a3 3 0 0 1 6 0M7 11H5M5 11c0 5 3 8 7 8s7-3 7-8M19 11h-2"/><circle cx="12" cy="4" r="1.5" fill="currentColor"/>',
  // Theater — comedy mask.
  theater:
    '<path fill="currentColor" d="M4 5h16v6a8 8 0 0 1-16 0V5Zm4 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-7 5a4 4 0 0 0 6 0H9Z"/>',
  // Amphitheatre — colosseum arches.
  amphitheatre:
    '<path fill="none" stroke="currentColor" stroke-width="2" d="M3 10a9 5 0 0 1 18 0v4a9 5 0 0 1-18 0v-4ZM3 10h18M8 7v10M16 7v10M12 6v12"/>',
};

// Build a Leaflet divIcon HTML string: a teardrop pin in the category color
// with the white glyph centered in its head.
export function placePinHtml(color: string, iconKey: PlaceIconKey): string {
  const glyph = PLACE_ICON_PATHS[iconKey];
  // Pin: a 28×36 SVG with a circular head and pointed tip, plus the glyph
  // rendered white inside the head.
  return `<div style="width:28px;height:36px">
    <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.8 0 1 5.8 1 13c0 9 13 23 13 23s13-14 13-23C27 5.8 21.2 0 14 0Z"
        fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <g transform="translate(5 4) scale(0.75)" color="#fff" stroke-linejoin="round">${glyph}</g>
    </svg>
  </div>`;
}

// Inline legend glyph (no pin): the bare SVG symbol on a colored chip. Used in
// the layer control so the legend matches the map markers.
export function placeLegendHtml(color: string, iconKey: PlaceIconKey): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="color:${color}" stroke-linejoin="round">${PLACE_ICON_PATHS[iconKey]}</svg>`;
}
