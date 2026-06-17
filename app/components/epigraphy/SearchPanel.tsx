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
      nomen,
      cognomen,
    ],
  );

  // Push working filters up so the parent can recompute counts on the
  // local index without waiting for the "検索" button.
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
    "px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800";

  return (
    <div className="flex flex-col gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">検索条件</h2>
        {!vocab && (
          <span className="text-xs text-zinc-500">インデックス読込中…</span>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span>全文／キーワード</span>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="碑文テキスト・地名・EDCS-ID"
          className={selectCls}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </label>

      <details open className="text-sm">
        <summary className="cursor-pointer font-medium">場所・年代</summary>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">属州 (province)</span>
            <TagMultiSelect
              options={decorate(provinces, facetCounts?.province, provinceUris)}
              selected={provinceUris}
              onChange={setProvinceUris}
              placeholder="(指定なし)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">
              発見地 (findspot)
              {provinceUris.length > 0 && (
                <span className="ml-1 text-zinc-400">
                  ({filteredPlaces.length}件)
                </span>
              )}
            </span>
            <TagMultiSelect
              options={decorate(filteredPlaces, facetCounts?.place, placeUris)}
              selected={placeUris}
              onChange={setPlaceUris}
              placeholder="(指定なし)"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">年代 from</span>
              <input
                type="number"
                value={datingFrom}
                onChange={(e) => setDatingFrom(e.target.value)}
                placeholder="-50"
                className={selectCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">年代 to</span>
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
        <summary className="cursor-pointer font-medium">人物属性</summary>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">
              nomen
              {nomen.length > 0 && cognomen.length > 0 && (
                <span className="ml-1 text-zinc-400">
                  (同一人物が両方を満たす)
                </span>
              )}
            </span>
            <NameAutocompleteInput
              vocab={vocab?.nomen ?? []}
              selected={nomen}
              onChange={setNomen}
              counts={facetCounts?.nomen}
              placeholder="入力して候補から選択… (例: Iulius)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">cognomen</span>
            <NameAutocompleteInput
              vocab={vocab?.cognomen ?? []}
              selected={cognomen}
              onChange={setCognomen}
              counts={facetCounts?.cognomen}
              placeholder="入力して候補から選択… (例: Caesar)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">社会的地位</span>
            <TagMultiSelect
              options={decorate(
                socialStatusOpts,
                facetCounts?.socialStatus,
                socialStatuses,
              )}
              selected={socialStatuses}
              onChange={setSocialStatuses}
              placeholder="(指定なし)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">職位 (抽象形)</span>
            <TagMultiSelect
              options={decorate(
                positionOpts,
                facetCounts?.positionAbstract,
                positionAbstracts,
              )}
              selected={positionAbstracts}
              onChange={setPositionAbstracts}
              placeholder="(指定なし)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">職位 (正規化形)</span>
            <TagMultiSelect
              options={decorate(
                positionNormalizedOpts,
                facetCounts?.positionNormalized,
                positionNormalizeds,
              )}
              selected={positionNormalizeds}
              onChange={setPositionNormalizeds}
              placeholder="(指定なし)"
            />
          </div>
        </div>
      </details>

      <details open className="text-sm">
        <summary className="cursor-pointer font-medium">
          恵与・関係性・コミュニティ
        </summary>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">恵与タイプ</span>
            <TagMultiSelect
              options={decorate(
                benefTypeOpts,
                facetCounts?.benefactionType,
                benefactionTypes,
              )}
              selected={benefactionTypes}
              onChange={setBenefactionTypes}
              placeholder="(指定なし)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">
              恵与対象タイプ（部分一致 OR）
            </span>
            <TagMultiSelect
              options={decorate(
                objectTypeOpts,
                facetCounts?.objectType,
                objectTypes,
              )}
              selected={objectTypes}
              onChange={setObjectTypes}
              placeholder="(指定なし)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">関係タイプ</span>
            <TagMultiSelect
              options={decorate(
                relTypeOpts,
                facetCounts?.relationshipType,
                relationshipTypes,
              )}
              selected={relationshipTypes}
              onChange={setRelationshipTypes}
              placeholder="(指定なし)"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">コミュニティタイプ</span>
            <TagMultiSelect
              options={decorate(
                commTypeOpts,
                facetCounts?.communityType,
                communityTypes,
              )}
              selected={communityTypes}
              onChange={setCommunityTypes}
              placeholder="(指定なし)"
            />
          </div>
        </div>
      </details>

      <div className="flex gap-2 pt-2">
        <button
          onClick={submit}
          disabled={loading || !vocab}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white rounded text-sm font-medium"
        >
          {loading ? "検索中..." : "検索"}
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded text-sm"
        >
          リセット
        </button>
      </div>
    </div>
  );
}
