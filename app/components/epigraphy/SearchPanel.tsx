"use client";

import { useEffect, useMemo, useState } from "react";
import type { SearchFilters } from "@/app/lib/epigraphy/queries";
import type { FacetVocab, IndexPlace } from "@/app/lib/epigraphy/local-search";
import TagMultiSelect, { type TagOption } from "./TagMultiSelect";
import NameAutocompleteInput from "./NameAutocompleteInput";

type PlaceOption = TagOption & { provinceUri?: string };

type Props = {
  onSearch: (f: SearchFilters) => void;
  loading: boolean;
  // Static facet vocab from the local index (sorted, unique values).
  vocab: FacetVocab | null;
  // Per-facet { value -> count } for the *current* filters, used to grey out
  // 0-result options and show counts in the dropdown. Computed in the parent
  // because it depends on the full inscription list.
  facetCounts: Record<string, Map<string, number>> | null;
  // Optional: the parent can ask us to keep its working filters in sync.
  onFiltersChange?: (f: SearchFilters) => void;
};

export default function SearchPanel({
  onSearch,
  loading,
  vocab,
  facetCounts,
  onFiltersChange,
}: Props) {
  const [keyword, setKeyword] = useState("");
  const [placeUris, setPlaceUris] = useState<string[]>([]);
  const [provinceUris, setProvinceUris] = useState<string[]>([]);
  const [datingFrom, setDatingFrom] = useState("");
  const [datingTo, setDatingTo] = useState("");
  const [socialStatuses, setSocialStatuses] = useState<string[]>([]);
  const [positionAbstracts, setPositionAbstracts] = useState<string[]>([]);
  const [positionNormalizeds, setPositionNormalizeds] = useState<string[]>([]);
  const [benefactionTypes, setBenefactionTypes] = useState<string[]>([]);
  const [objectTypes, setObjectTypes] = useState<string[]>([]);
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]);
  const [communityTypes, setCommunityTypes] = useState<string[]>([]);
  const [divinityTypes, setDivinityTypes] = useState<string[]>([]);
  const [nomen, setNomen] = useState<string[]>([]);
  const [cognomen, setCognomen] = useState<string[]>([]);

  const places: PlaceOption[] = useMemo(() => {
    if (!vocab) return [];
    return vocab.place.map((p: IndexPlace) => ({
      value: p.label,
      label: p.label,
      provinceUri: p.province,
    }));
  }, [vocab]);

  const provinces: TagOption[] = useMemo(() => {
    if (!vocab) return [];
    return vocab.province.map((v) => ({ value: v, label: v }));
  }, [vocab]);

  const toOpts = (xs: string[] | undefined): TagOption[] =>
    (xs ?? []).map((v) => ({ value: v, label: v }));

  const socialStatusOpts = useMemo(() => toOpts(vocab?.socialStatus), [vocab]);
  const positionOpts = useMemo(() => toOpts(vocab?.positionAbstract), [vocab]);
  const positionNormalizedOpts = useMemo(
    () => toOpts(vocab?.positionNormalized),
    [vocab],
  );
  const benefTypeOpts = useMemo(() => toOpts(vocab?.benefactionType), [vocab]);
  const objectTypeOpts = useMemo(() => toOpts(vocab?.objectType), [vocab]);
  const relTypeOpts = useMemo(() => toOpts(vocab?.relationshipType), [vocab]);
  const commTypeOpts = useMemo(() => toOpts(vocab?.communityType), [vocab]);
  const divinityTypeOpts = useMemo(() => toOpts(vocab?.divinityType), [vocab]);

  function submit() {
    onSearch(currentFilters);
  }

  function reset() {
    setKeyword("");
    setPlaceUris([]);
    setProvinceUris([]);
    setDatingFrom("");
    setDatingTo("");
    setSocialStatuses([]);
    setPositionAbstracts([]);
    setPositionNormalizeds([]);
    setBenefactionTypes([]);
    setObjectTypes([]);
    setRelationshipTypes([]);
    setCommunityTypes([]);
    setDivinityTypes([]);
    setNomen([]);
    setCognomen([]);
  }

  const currentFilters = useMemo<SearchFilters>(
    () => ({
      keyword: keyword || undefined,
      placeUris: placeUris.length > 0 ? placeUris : undefined,
      provinceUris: provinceUris.length > 0 ? provinceUris : undefined,
      datingFrom: datingFrom ? Number(datingFrom) : undefined,
      datingTo: datingTo ? Number(datingTo) : undefined,
      socialStatuses: socialStatuses.length > 0 ? socialStatuses : undefined,
      positionAbstracts:
        positionAbstracts.length > 0 ? positionAbstracts : undefined,
      positionNormalizeds:
        positionNormalizeds.length > 0 ? positionNormalizeds : undefined,
      benefactionTypes:
        benefactionTypes.length > 0 ? benefactionTypes : undefined,
      objectTypes: objectTypes.length > 0 ? objectTypes : undefined,
      relationshipTypes:
        relationshipTypes.length > 0 ? relationshipTypes : undefined,
      communityTypes: communityTypes.length > 0 ? communityTypes : undefined,
      divinityTypes: divinityTypes.length > 0 ? divinityTypes : undefined,
      nomen: nomen.length > 0 ? nomen : undefined,
      cognomen: cognomen.length > 0 ? cognomen : undefined,
    }),
    [
      keyword,
      placeUris,
      provinceUris,
      datingFrom,
      datingTo,
      socialStatuses,
      positionAbstracts,
      positionNormalizeds,
      benefactionTypes,
      objectTypes,
      relationshipTypes,
      communityTypes,
      divinityTypes,
      nomen,
      cognomen,
    ],
  );

  // Push working filters up so the parent can recompute counts on the
  // local index without waiting for the "Search" button.
  useEffect(() => {
    onFiltersChange?.(currentFilters);
  }, [currentFilters, onFiltersChange]);

  function decorate<T extends TagOption>(
    base: T[],
    counts: Map<string, number> | undefined,
    selected: string[],
  ): T[] {
    if (!counts) return base;
    const selSet = new Set(selected);
    return base.map((o) => {
      const c = counts.get(o.value);
      const disabled = !selSet.has(o.value) && (c === undefined || c === 0);
      return { ...o, count: c ?? 0, disabled };
    });
  }

  const filteredPlaces = useMemo(() => {
    if (provinceUris.length === 0) return places;
    const set = new Set(provinceUris);
    return places.filter(
      (p) => p.provinceUri !== undefined && set.has(p.provinceUri),
    );
  }, [places, provinceUris]);

  // When province selection shrinks, drop place selections that no longer fit.
  useEffect(() => {
    if (provinceUris.length === 0) return;
    const validUris = new Set(filteredPlaces.map((p) => p.value));
    const next = placeUris.filter((u) => validUris.has(u));
    if (next.length !== placeUris.length) setPlaceUris(next);
  }, [provinceUris, filteredPlaces, placeUris]);

  const selectCls =
    "px-2 py-1.5 text-sm border border-border rounded bg-card";

  return (
    <div className="flex flex-col gap-3 p-4 border border-border rounded-lg bg-card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Search filters</h2>
        {!vocab && (
          <span className="text-xs text-muted-foreground">Loading index…</span>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span>Full text / keyword</span>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Inscription text, place, EDCS-ID"
          className={selectCls}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </label>

      <details open className="text-sm">
        <summary className="cursor-pointer font-medium">Place & date</summary>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Province</span>
            <TagMultiSelect
              options={decorate(provinces, facetCounts?.province, provinceUris)}
              selected={provinceUris}
              onChange={setProvinceUris}
              placeholder="(any)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Findspot
              {provinceUris.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({filteredPlaces.length})
                </span>
              )}
            </span>
            <TagMultiSelect
              options={decorate(filteredPlaces, facetCounts?.place, placeUris)}
              selected={placeUris}
              onChange={setPlaceUris}
              placeholder="(any)"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Date from</span>
              <input
                type="number"
                value={datingFrom}
                onChange={(e) => setDatingFrom(e.target.value)}
                placeholder="-50"
                className={selectCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Date to</span>
              <input
                type="number"
                value={datingTo}
                onChange={(e) => setDatingTo(e.target.value)}
                placeholder="200"
                className={selectCls}
              />
            </label>
          </div>
        </div>
      </details>

      <details open className="text-sm">
        <summary className="cursor-pointer font-medium">Person attributes</summary>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              nomen
              {nomen.length > 0 && cognomen.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  (same person must match both)
                </span>
              )}
            </span>
            <NameAutocompleteInput
              vocab={vocab?.nomen ?? []}
              selected={nomen}
              onChange={setNomen}
              counts={facetCounts?.nomen}
              placeholder="Type to select from suggestions… (e.g. Iulius)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">cognomen</span>
            <NameAutocompleteInput
              vocab={vocab?.cognomen ?? []}
              selected={cognomen}
              onChange={setCognomen}
              counts={facetCounts?.cognomen}
              placeholder="Type to select from suggestions… (e.g. Caesar)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Social status</span>
            <TagMultiSelect
              options={decorate(
                socialStatusOpts,
                facetCounts?.socialStatus,
                socialStatuses,
              )}
              selected={socialStatuses}
              onChange={setSocialStatuses}
              placeholder="(any)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Position (abstract)</span>
            <TagMultiSelect
              options={decorate(
                positionOpts,
                facetCounts?.positionAbstract,
                positionAbstracts,
              )}
              selected={positionAbstracts}
              onChange={setPositionAbstracts}
              placeholder="(any)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Position (normalized)</span>
            <TagMultiSelect
              options={decorate(
                positionNormalizedOpts,
                facetCounts?.positionNormalized,
                positionNormalizeds,
              )}
              selected={positionNormalizeds}
              onChange={setPositionNormalizeds}
              placeholder="(any)"
            />
          </div>
        </div>
      </details>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">
          Benefaction, relationship & community
        </summary>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Benefaction type</span>
            <TagMultiSelect
              options={decorate(
                benefTypeOpts,
                facetCounts?.benefactionType,
                benefactionTypes,
              )}
              selected={benefactionTypes}
              onChange={setBenefactionTypes}
              placeholder="(any)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Benefaction object type (partial match, OR)
            </span>
            <TagMultiSelect
              options={decorate(
                objectTypeOpts,
                facetCounts?.objectType,
                objectTypes,
              )}
              selected={objectTypes}
              onChange={setObjectTypes}
              placeholder="(any)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Relationship type</span>
            <TagMultiSelect
              options={decorate(
                relTypeOpts,
                facetCounts?.relationshipType,
                relationshipTypes,
              )}
              selected={relationshipTypes}
              onChange={setRelationshipTypes}
              placeholder="(any)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Community type</span>
            <TagMultiSelect
              options={decorate(
                commTypeOpts,
                facetCounts?.communityType,
                communityTypes,
              )}
              selected={communityTypes}
              onChange={setCommunityTypes}
              placeholder="(any)"
            />
          </div>
        </div>
      </details>

      {/* Deities are an inscription element independent of persons, so they get
          their own top-level group rather than sitting under person attributes. */}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Deity</summary>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col gap-1">
            <TagMultiSelect
              options={decorate(
                divinityTypeOpts,
                facetCounts?.divinityType,
                divinityTypes,
              )}
              selected={divinityTypes}
              onChange={setDivinityTypes}
              placeholder="(any)"
            />
          </div>
        </div>
      </details>

      <div className="flex gap-2 pt-2">
        <button
          onClick={submit}
          disabled={loading || !vocab}
          className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded text-sm font-medium"
        >
          {loading ? "Searching..." : "Search"}
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 border border-border rounded text-sm"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
