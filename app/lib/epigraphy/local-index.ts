"use client";

import type {
  FacetsBundle,
  IndexRow,
  InscriptionsBundle,
} from "./local-search";

type LoadState = {
  inscriptions?: IndexRow[];
  facets?: FacetsBundle["facets"];
  promise?: Promise<{ inscriptions: IndexRow[]; facets: FacetsBundle["facets"] }>;
};

const state: LoadState = {};

export function loadLocalIndex(): Promise<{
  inscriptions: IndexRow[];
  facets: FacetsBundle["facets"];
}> {
  if (state.inscriptions && state.facets) {
    return Promise.resolve({
      inscriptions: state.inscriptions,
      facets: state.facets,
    });
  }
  if (state.promise) return state.promise;
  state.promise = (async () => {
    // facets.json is small; use its generatedAt as a cache-bust token so the
    // large inscriptions.json doesn't get served from a stale browser cache.
    const facRes = await fetch("/data/index/facets.json", {
      cache: "no-cache",
    });
    if (!facRes.ok) {
      throw new Error(`facets fetch failed: ${facRes.status}`);
    }
    const fac = (await facRes.json()) as FacetsBundle;
    const v = encodeURIComponent(fac.generatedAt);
    // The index is split into inscriptions-<i>.json chunks. Load them all in
    // parallel.
    const chunkCount = Math.max(1, fac.chunkCount ?? 1);
    const bundles = await Promise.all(
      Array.from({ length: chunkCount }, async (_, i) => {
        const res = await fetch(`/data/index/inscriptions-${i}.json?v=${v}`);
        if (!res.ok) {
          throw new Error(`inscriptions chunk ${i} fetch failed: ${res.status}`);
        }
        return (await res.json()) as InscriptionsBundle;
      }),
    );
    // Defensive dedup by id in case the index is regenerated while a tab is
    // open and the browser somehow stitches two copies, or in case the
    // server-side index ever ships duplicates.
    const seen = new Set<string>();
    const deduped: IndexRow[] = [];
    for (const bundle of bundles) {
      for (const r of bundle.inscriptions) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        deduped.push(r);
      }
    }
    state.inscriptions = deduped;
    state.facets = fac.facets;
    return { inscriptions: state.inscriptions, facets: state.facets };
  })();
  return state.promise;
}
