// External-database deep-links for an inscription.
//
// Links are baked into the search index at build time from the SPARQL endpoint
// (see scripts/build-search-index.mjs), each carrying a ready-to-use URL, the
// database name, and that database's own id. New databases require no code
// change here — they flow through automatically once present in the data.
//
// Optional display metadata (a friendlier name / description per database) can
// be added in DB_METADATA below; databases without an entry fall back to the
// raw name from the data.

import type { ExternalLinkRow, IndexRow } from "./local-search";

export type ExternalLink = {
  // Stable key for React lists.
  key: string;
  // Display name shown in the link list.
  name: string;
  // Longer label for the link title/tooltip.
  description: string;
  // The database's own identifier (may be null).
  id: string | null;
  // Ready-to-use target URL.
  url: string;
};

// Optional per-database display metadata, keyed by the database name as it
// appears in the data. Anything not listed falls back to the raw name.
const DB_METADATA: Record<string, { name?: string; description: string }> = {
  EDCS: { description: "Epigraphik-Datenbank Clauss/Slaby" },
  SIRAR: {
    description:
      "Sociedad, Imagen y Representación del poder en la Roma Antigua",
  },
};

// Builds the URL to an inscription page on EDCS from a stored "EDCS-08600983"
// identifier. Retained for callers that only have an EDCS id and no baked-in
// link (the SPARQL detail query and the network dialog).
export function buildEdcsUrl(identifier: string): string {
  const numericId = identifier.replace(/^EDCS-/i, "");
  return `https://edcs.hist.uzh.ch/en/search?edcs-id=${encodeURIComponent(
    numericId,
  )}`;
}

function toExternalLink(link: ExternalLinkRow, index: number): ExternalLink {
  const meta = DB_METADATA[link.db];
  return {
    key: `${link.db}-${link.id ?? index}`,
    name: meta?.name ?? link.db,
    description: meta?.description ?? link.db,
    id: link.id,
    url: link.url,
  };
}

// Resolves the external-database links baked into a row into ready-to-render
// links. Returns [] when the row carries none.
export function externalLinksFor(row: IndexRow): ExternalLink[] {
  return (row.externalLinks ?? []).map(toExternalLink);
}
