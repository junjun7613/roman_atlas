"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import SearchPanel from "@/app/components/epigraphy/SearchPanel";
import ResultsList from "@/app/components/epigraphy/ResultsList";
import ResizableSplit from "@/app/components/epigraphy/ResizableSplit";
import type { SearchFilters } from "@/app/lib/epigraphy/queries";
import type { InscriptionResult } from "@/app/lib/epigraphy/types";
import {
  facetCounts as computeFacetCounts,
  searchRows,
  type FacetVocab,
  type IndexRow,
} from "@/app/lib/epigraphy/local-search";
import { loadLocalIndex } from "@/app/lib/epigraphy/local-index";
import { rowsToCsv, downloadCsv } from "@/app/lib/epigraphy/csv";

const EpigraphyMapView = dynamic(
  () => import("@/app/components/epigraphy/EpigraphyMapView"),
  { ssr: false },
);
const EpigraphyInfoPanel = dynamic(
  () => import("@/app/components/epigraphy/EpigraphyInfoPanel"),
  { ssr: false },
);

const PAGE_SIZE = 50;

function rowToResult(r: IndexRow): InscriptionResult {
  return {
    inscriptionUri: r.id,
    edcsId: r.id,
    placeLabel: r.place,
    provinceLabel: r.province,
    lat: r.lat,
    lon: r.lon,
    datingFrom: r.datingFrom != null ? String(r.datingFrom) : undefined,
    datingTo: r.datingTo != null ? String(r.datingTo) : undefined,
    text: r.text,
    publication: r.publication,
    persons: r.persons.join(" | ") || undefined,
    careers: r.careers.join(" | ") || undefined,
    benefactions: r.benefactions.join(" | ") || undefined,
    relationships: r.relationships.join(" | ") || undefined,
    communities: r.communities.join(" | ") || undefined,
  };
}

export default function EpigraphyPage() {
  const [allRows, setAllRows] = useState<IndexRow[]>([]);
  const [vocab, setVocab] = useState<FacetVocab | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexErr, setIndexErr] = useState<string | null>(null);

  const [pendingFilters, setPendingFilters] = useState<SearchFilters>({});
  const [committedFilters, setCommittedFilters] =
    useState<SearchFilters | null>(null);
  // EDCS-IDs inside the drawn region, or null when no region is active. We
  // store IDs (not rows) so the set stays valid as `matched` changes.
  const [regionIds, setRegionIds] = useState<Set<string> | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  // Per-panel visibility. The three content panels (map / table / info) can be
  // shown/hidden independently; the resizable splits collapse around whatever
  // is hidden so the survivors fill the freed space.
  const [showMap, setShowMap] = useState(true);
  const [showTable, setShowTable] = useState(true);
  const [showInfo, setShowInfo] = useState(true);

  // Load local index once at startup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { inscriptions, facets } = await loadLocalIndex();
        if (cancelled) return;
        setAllRows(inscriptions);
        setVocab(facets);
      } catch (e) {
        if (!cancelled) setIndexErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setIndexLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live facet counts off the working (pending) filters.
  const liveFacetCounts = useMemo(() => {
    if (allRows.length === 0) return null;
    return computeFacetCounts(allRows, pendingFilters);
  }, [allRows, pendingFilters]);

  // Committed search result set.
  const matched = useMemo<IndexRow[]>(() => {
    if (!committedFilters || allRows.length === 0) return [];
    return searchRows(allRows, committedFilters);
  }, [allRows, committedFilters]);

  // Effective rows = matched narrowed to the drawn region (if any). Drives the
  // table, map, info panel, and statistics simultaneously.
  const effectiveRows = useMemo<IndexRow[]>(() => {
    if (!regionIds) return matched;
    return matched.filter((r) => regionIds.has(r.id));
  }, [matched, regionIds]);

  const effectiveResults = useMemo(
    () => effectiveRows.map(rowToResult),
    [effectiveRows],
  );

  const visibleResults = useMemo(
    () => effectiveResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [effectiveResults, page],
  );

  // Map plots the full search result set (matched), so the user can draw a
  // region across everything; region selection then narrows `effectiveRows`.
  const mappableResults = useMemo(
    () => matched.map(rowToResult).filter((r) => r.lat != null && r.lon != null),
    [matched],
  );

  function handleSearch(f: SearchFilters) {
    setCommittedFilters(f);
    setRegionIds(null);
    setPage(0);
    setSelected(null);
  }

  const handleRegionFilter = useCallback(
    (rows: InscriptionResult[] | null) => {
      setRegionIds(rows ? new Set(rows.map((r) => r.edcsId)) : null);
      setPage(0);
      setSelected(null);
    },
    [],
  );

  function changePage(nextPage: number) {
    if (nextPage < 0) return;
    if (nextPage * PAGE_SIZE >= effectiveResults.length) return;
    setPage(nextPage);
  }

  const totalCount = committedFilters ? effectiveResults.length : null;

  const sidebarPane = (
    <aside className="h-full overflow-y-auto p-3 border-r border-zinc-200 dark:border-zinc-800">
      <SearchPanel
        onSearch={handleSearch}
        loading={indexLoading}
        vocab={vocab}
        facetCounts={liveFacetCounts}
        onFiltersChange={setPendingFilters}
      />
    </aside>
  );

  const statusBar = (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm shrink-0">
      <div className="flex items-center gap-3">
        {totalCount !== null ? (
          <>
            <span>
              <span className="font-semibold">{totalCount}</span> 件
              {regionIds && (
                <>
                  <span className="ml-1 text-blue-600">（絞り込み中）</span>
                  <button
                    onClick={() => handleRegionFilter(null)}
                    className="ml-1 text-xs text-blue-600 hover:underline"
                  >
                    解除
                  </button>
                </>
              )}
            </span>
            {totalCount > 0 && (
              <span className="text-zinc-500 text-xs">
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, totalCount)} 件目
              </span>
            )}
          </>
        ) : indexLoading ? (
          <span className="text-zinc-500">
            インデックスを読み込んでいます…
          </span>
        ) : (
          <span className="text-zinc-500">
            検索条件を指定して「検索」を押してください
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        {effectiveResults.length > 0 && (
          <button
            onClick={() =>
              downloadCsv(
                `epigraphy-search-${effectiveResults.length}.csv`,
                rowsToCsv(effectiveResults),
              )
            }
            className="px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            CSV ({effectiveResults.length})
          </button>
        )}
        {totalCount !== null && totalCount > PAGE_SIZE && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page === 0}
              className="px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded disabled:opacity-40"
            >
              ← 前
            </button>
            <span className="px-1">
              {page + 1} / {Math.ceil(totalCount / PAGE_SIZE)}
            </span>
            <button
              onClick={() => changePage(page + 1)}
              disabled={(page + 1) * PAGE_SIZE >= totalCount}
              className="px-2 py-1 border border-zinc-300 dark:border-zinc-700 rounded disabled:opacity-40"
            >
              次 →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // The map is always shown — even before a search — so users can browse
  // reference overlays (Pleiades places, roads/rivers) and use place search.
  // Before a search `mappableResults` is empty, so no inscription markers draw.
  const mapPane = (
    <div className="h-full w-full">
      <EpigraphyMapView
        results={mappableResults}
        onSelect={setSelected}
        onRegionFilter={handleRegionFilter}
      />
    </div>
  );

  const tablePane = (
    <div className="h-full w-full overflow-hidden min-h-0">
      <ResultsList
        results={visibleResults}
        selectedEdcsId={selected}
        onSelect={setSelected}
        emptyMessage={
          totalCount === null
            ? indexLoading
              ? "インデックスを読み込み中…"
              : undefined
            : totalCount === 0
              ? regionIds
                ? "選択領域内に該当する碑文はありません"
                : "該当する碑文は見つかりませんでした"
              : undefined
        }
      />
    </div>
  );

  // Center column = map over table. If exactly one is shown, the split
  // collapses to that pane; if neither is shown, a hint takes its place.
  const centerColumn =
    !showMap && !showTable ? (
      <div className="h-full flex items-center justify-center text-sm text-zinc-400 p-4 text-center">
        「地図」または「表」を表示してください
      </div>
    ) : (
      <ResizableSplit
        direction="vertical"
        only={!showMap ? "second" : !showTable ? "first" : null}
        initialFirstPct={45}
        minFirstPct={15}
        maxFirstPct={85}
        first={mapPane}
        second={tablePane}
      />
    );

  const centerPane = (
    <section className="h-full flex flex-col min-h-0 border-r border-zinc-200 dark:border-zinc-800">
      {statusBar}
      <div className="flex-1 min-h-0">{centerColumn}</div>
    </section>
  );

  const infoPane = (
    <aside className="h-full min-h-0 overflow-hidden">
      {committedFilters ? (
        <EpigraphyInfoPanel
          rows={effectiveRows}
          selectedEdcsId={selected}
          onClose={() => setSelected(null)}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-zinc-400 p-4 text-center">
          検索後、碑文を選択すると詳細・ネットワーク・統計が表示されます
        </div>
      )}
    </aside>
  );

  // Content area (right of the sidebar) = center column beside the info panel.
  const contentArea = (
    <ResizableSplit
      direction="horizontal"
      only={!showInfo ? "first" : null}
      initialFirstPct={68}
      minFirstPct={30}
      maxFirstPct={88}
      first={centerPane}
      second={infoPane}
    />
  );

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">
            Roman Atlas — 碑文検索（座標ベース実験モード）
          </h1>
          <p className="text-[11px] text-zinc-500">
            静的インデックスでクライアントサイド検索／座標から直接マッピング
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-400 mr-1">表示:</span>
          <PanelToggle
            label="検索"
            on={showSidebar}
            onClick={() => setShowSidebar((v) => !v)}
          />
          <PanelToggle
            label="地図"
            on={showMap}
            onClick={() => setShowMap((v) => !v)}
          />
          <PanelToggle
            label="表"
            on={showTable}
            onClick={() => setShowTable((v) => !v)}
          />
          <PanelToggle
            label="情報"
            on={showInfo}
            onClick={() => setShowInfo((v) => !v)}
          />
        </div>
      </header>

      {indexErr && (
        <div className="p-3 text-xs text-red-600 bg-red-50 dark:bg-red-950">
          インデックス読込失敗: {indexErr}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <ResizableSplit
          direction="horizontal"
          only={showSidebar ? null : "second"}
          initialFirstPct={20}
          minFirstPct={12}
          maxFirstPct={45}
          first={sidebarPane}
          second={contentArea}
        />
      </div>
    </div>
  );
}

function PanelToggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={
        "text-xs px-2 py-1 rounded border transition-colors " +
        (on
          ? "bg-blue-600 text-white border-blue-600"
          : "border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")
      }
    >
      {label}
    </button>
  );
}
