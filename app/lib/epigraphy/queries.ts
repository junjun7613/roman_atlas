// SearchFilters describes the faceted query that the client-side search engine
// (local-search.ts) evaluates against the in-memory index. The original
// epigraphy-search project also had SPARQL query builders here for a Fuseki
// backend; roman_atlas's coordinate-mode search is fully client-side, so only
// the filter type and the small pure helper below are kept.

export type SearchFilters = {
  keyword?: string;
  placeUris?: string[];
  provinceUris?: string[];
  datingFrom?: number;
  datingTo?: number;
  socialStatuses?: string[];
  positionAbstracts?: string[];
  positionNormalizeds?: string[];
  benefactionTypes?: string[];
  objectTypes?: string[];
  relationshipTypes?: string[];
  communityTypes?: string[];
  // Deity/divinity names attested on the inscription, kept independent of the
  // person-name facets (a deity is its own element, not part of a person name).
  divinityTypes?: string[];
  // Normalized search keys (NOT raw display strings). When both nomen and
  // cognomen are set, the match is same-person: a single person on the
  // inscription must satisfy both.
  nomen?: string[];
  cognomen?: string[];
  limit?: number;
  offset?: number;
};

function nonEmpty<T>(arr: T[] | undefined): arr is T[] {
  return Array.isArray(arr) && arr.length > 0;
}

export function hasAnyFilter(f: SearchFilters): boolean {
  return (
    !!(f.keyword && f.keyword.trim()) ||
    nonEmpty(f.placeUris) ||
    nonEmpty(f.provinceUris) ||
    f.datingFrom !== undefined ||
    f.datingTo !== undefined ||
    nonEmpty(f.socialStatuses) ||
    nonEmpty(f.positionAbstracts) ||
    nonEmpty(f.positionNormalizeds) ||
    nonEmpty(f.benefactionTypes) ||
    nonEmpty(f.objectTypes) ||
    nonEmpty(f.relationshipTypes) ||
    nonEmpty(f.communityTypes) ||
    nonEmpty(f.divinityTypes) ||
    nonEmpty(f.nomen) ||
    nonEmpty(f.cognomen)
  );
}
