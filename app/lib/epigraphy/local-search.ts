import type { SearchFilters } from "./queries";

// One entry per person on the inscription, holding the set of normalized
// nomen/cognomen keys derived from that person. Same-person filtering
// (nomen AND cognomen on a single person) needs the pairing preserved.
export type PersonTuple = {
  nomen: string[];
  cognomen: string[];
};

// A benefaction cost paired with its benefaction type, so the stats panel can
// break cost aggregates down by type. Emitted by build-search-index.mjs only
// for benefactions whose cost_numeric parses to a finite number.
export type BenefactionCost = {
  type?: string;
  cost: number;
};

export type IndexRow = {
  id: string;
  place?: string;
  province?: string;
  text?: string;
  publication?: string;
  datingFrom?: number;
  datingTo?: number;
  lat?: number;
  lon?: number;
  socialStatuses: string[];
  positionAbstracts: string[];
  positionNormalizeds: string[];
  benefactionTypes: string[];
  objectTypes: string[];
  relationshipTypes: string[];
  communityTypes: string[];
  // Numeric-stats fields (not facets) for the client-side statistics panel.
  // Older indexes built before these were added won't carry them, so treat
  // them as optional and default to [] when consuming.
  ageAtDeath?: number[];
  divinityTypes?: string[];
  benefactionCosts?: BenefactionCost[];
  persons: string[];
  personTuples: PersonTuple[];
  careers: string[];
  benefactions: string[];
  relationships: string[];
  communities: string[];
  // External-database deep-links (EDCS, SIRAR, …) baked into the index from the
  // SPARQL endpoint. Absent on rows with no links and on older indexes.
  externalLinks?: ExternalLinkRow[];
};

// A single external-database link as stored in the index. `url` is ready to use;
// `id` is the database's own identifier (may be null).
export type ExternalLinkRow = {
  db: string;
  id: string | null;
  url: string;
};

export type IndexPlace = {
  label: string;
  province?: string;
  lat?: number;
  lon?: number;
};

export type NameVocab = {
  key: string;
  display: string;
  count: number;
};

export type FacetVocab = {
  province: string[];
  place: IndexPlace[];
  socialStatus: string[];
  positionAbstract: string[];
  positionNormalized: string[];
  benefactionType: string[];
  objectType: string[];
  relationshipType: string[];
  communityType: string[];
  divinityType: string[];
  nomen: NameVocab[];
  cognomen: NameVocab[];
};

export type InscriptionsBundle = {
  generatedAt: string;
  count: number;
  inscriptions: IndexRow[];
};

export type FacetsBundle = {
  generatedAt: string;
  // Number of inscriptions-<i>.json chunk files to load. Older indexes built
  // before chunking won't have this; the client falls back to a single file.
  chunkCount?: number;
  facets: FacetVocab;
};

// place URI is just the label in this dataset (no real URIs locally), so
// SearchPanel's URI-based filters (placeUris/provinceUris) carry the label.
// The TagMultiSelect option `value` is the label too, which keeps the
// surface unchanged when we wire it up.

function anyOverlap(a: string[], b: string[] | undefined): boolean {
  if (!b || b.length === 0) return true;
  const set = new Set(a.map((s) => s.toLowerCase()));
  for (const v of b) if (set.has(v.toLowerCase())) return true;
  return false;
}

function anyContains(haystack: string[], needles: string[] | undefined): boolean {
  if (!needles || needles.length === 0) return true;
  const lowered = haystack.map((s) => s.toLowerCase());
  for (const n of needles) {
    const nl = n.toLowerCase();
    if (lowered.some((h) => h.includes(nl))) return true;
  }
  return false;
}

export function matchesFilters(row: IndexRow, f: SearchFilters): boolean {
  if (f.placeUris && f.placeUris.length > 0) {
    if (!row.place || !f.placeUris.includes(row.place)) return false;
  }
  if (f.provinceUris && f.provinceUris.length > 0) {
    if (!row.province || !f.provinceUris.includes(row.province)) return false;
  }
  if (f.datingFrom !== undefined) {
    if (row.datingTo === undefined || row.datingTo < f.datingFrom) return false;
  }
  if (f.datingTo !== undefined) {
    if (row.datingFrom === undefined || row.datingFrom > f.datingTo) return false;
  }
  if (f.keyword && f.keyword.trim()) {
    const k = f.keyword.trim().toLowerCase();
    const hay = [
      row.id,
      row.text ?? "",
      row.place ?? "",
      row.province ?? "",
      row.publication ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(k)) return false;
  }
  if (!anyOverlap(row.socialStatuses, f.socialStatuses)) return false;
  if (!anyOverlap(row.positionAbstracts, f.positionAbstracts)) return false;
  if (!anyOverlap(row.positionNormalizeds, f.positionNormalizeds)) return false;
  if (!anyOverlap(row.benefactionTypes, f.benefactionTypes)) return false;
  if (!anyContains(row.objectTypes, f.objectTypes)) return false;
  if (!anyOverlap(row.relationshipTypes, f.relationshipTypes)) return false;
  if (!anyOverlap(row.communityTypes, f.communityTypes)) return false;
  if (!anyOverlap(row.divinityTypes ?? [], f.divinityTypes)) return false;

  // Nomen/cognomen filters are AND across facets, OR within a facet, and
  // require both clauses to be satisfied by the SAME person on the
  // inscription (not different people contributing separately).
  const wantNomen = f.nomen && f.nomen.length > 0;
  const wantCognomen = f.cognomen && f.cognomen.length > 0;
  if (wantNomen || wantCognomen) {
    const nomenSet = wantNomen ? new Set(f.nomen) : null;
    const cogSet = wantCognomen ? new Set(f.cognomen) : null;
    const ok = row.personTuples.some((p) => {
      const nomenOk =
        !nomenSet || p.nomen.some((k) => nomenSet.has(k));
      const cogOk = !cogSet || p.cognomen.some((k) => cogSet.has(k));
      return nomenOk && cogOk;
    });
    if (!ok) return false;
  }
  return true;
}

export function searchRows(rows: IndexRow[], f: SearchFilters): IndexRow[] {
  const out: IndexRow[] = [];
  for (const r of rows) if (matchesFilters(r, f)) out.push(r);
  // Stable order by EDCS-ID
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export type FacetKindLocal =
  | "province"
  | "place"
  | "socialStatus"
  | "positionAbstract"
  | "positionNormalized"
  | "benefactionType"
  | "objectType"
  | "relationshipType"
  | "communityType"
  | "divinityType"
  | "nomen"
  | "cognomen";

function omitFacet(f: SearchFilters, kind: FacetKindLocal): SearchFilters {
  const x: SearchFilters = { ...f };
  switch (kind) {
    case "province":
      delete x.provinceUris;
      break;
    case "place":
      delete x.placeUris;
      break;
    case "socialStatus":
      delete x.socialStatuses;
      break;
    case "positionAbstract":
      delete x.positionAbstracts;
      break;
    case "positionNormalized":
      delete x.positionNormalizeds;
      break;
    case "benefactionType":
      delete x.benefactionTypes;
      break;
    case "objectType":
      delete x.objectTypes;
      break;
    case "relationshipType":
      delete x.relationshipTypes;
      break;
    case "communityType":
      delete x.communityTypes;
      break;
    case "divinityType":
      delete x.divinityTypes;
      break;
    case "nomen":
      delete x.nomen;
      break;
    case "cognomen":
      delete x.cognomen;
      break;
  }
  return x;
}

function bumpField(
  counts: Map<string, number>,
  values: string[] | undefined,
): void {
  if (!values) return;
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
}

export function facetCounts(
  rows: IndexRow[],
  f: SearchFilters,
): Record<FacetKindLocal, Map<string, number>> {
  const result = {
    province: new Map<string, number>(),
    place: new Map<string, number>(),
    socialStatus: new Map<string, number>(),
    positionAbstract: new Map<string, number>(),
    positionNormalized: new Map<string, number>(),
    benefactionType: new Map<string, number>(),
    objectType: new Map<string, number>(),
    relationshipType: new Map<string, number>(),
    communityType: new Map<string, number>(),
    divinityType: new Map<string, number>(),
    nomen: new Map<string, number>(),
    cognomen: new Map<string, number>(),
  } satisfies Record<FacetKindLocal, Map<string, number>>;

  // Pre-compute the "without facet K" filtered set for each K. For 9 facets
  // over 56k rows this is ~500k row checks total — still well under 100ms
  // in V8 because matchesFilters bails early on cheap predicates.
  const KINDS: FacetKindLocal[] = [
    "province",
    "place",
    "socialStatus",
    "positionAbstract",
    "positionNormalized",
    "benefactionType",
    "objectType",
    "relationshipType",
    "communityType",
    "divinityType",
    "nomen",
    "cognomen",
  ];

  for (const kind of KINDS) {
    const sub = omitFacet(f, kind);
    const target = result[kind];
    for (const r of rows) {
      if (!matchesFilters(r, sub)) continue;
      switch (kind) {
        case "province":
          if (r.province) target.set(r.province, (target.get(r.province) ?? 0) + 1);
          break;
        case "place":
          if (r.place) target.set(r.place, (target.get(r.place) ?? 0) + 1);
          break;
        case "socialStatus":
          bumpField(target, r.socialStatuses);
          break;
        case "positionAbstract":
          bumpField(target, r.positionAbstracts);
          break;
        case "positionNormalized":
          bumpField(target, r.positionNormalizeds);
          break;
        case "benefactionType":
          bumpField(target, r.benefactionTypes);
          break;
        case "objectType":
          bumpField(target, r.objectTypes);
          break;
        case "relationshipType":
          bumpField(target, r.relationshipTypes);
          break;
        case "communityType":
          bumpField(target, r.communityTypes);
          break;
        case "divinityType":
          bumpField(target, r.divinityTypes);
          break;
        case "nomen": {
          // Count each distinct nomen key once per inscription.
          const seen = new Set<string>();
          for (const p of r.personTuples) for (const k of p.nomen) seen.add(k);
          for (const k of seen) target.set(k, (target.get(k) ?? 0) + 1);
          break;
        }
        case "cognomen": {
          const seen = new Set<string>();
          for (const p of r.personTuples) for (const k of p.cognomen) seen.add(k);
          for (const k of seen) target.set(k, (target.get(k) ?? 0) + 1);
          break;
        }
      }
    }
  }

  return result;
}
