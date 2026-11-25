"use client";

import { useState } from "react";
import { queryEntityHistory, type EntityVersion } from "@/app/utils/sparql";

type Props = {
  edcsId: string;
  // URI of the selected node / relationship edge as shown in the graph.
  uri: string;
  // claude graph the graph's values were read from (InscriptionNetworkData
  // latest_graph) — marks the version that is on screen.
  currentGraph?: string;
};

// Every version of the selected entity across all extraction runs, loaded on
// demand. The network shows one run and the newest version within it; this
// lets the reader check what the other runs / earlier versions said. Fields
// that differ from the on-screen version are highlighted.
//
// Mount with key={uri} so the state resets when the selection changes.
export default function EntityHistory({ edcsId, uri, currentGraph }: Props) {
  const [versions, setVersions] = useState<EntityVersion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    queryEntityHistory(edcsId, uri)
      .then(setVersions)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  if (!versions) {
    return (
      <div className="mt-2 shrink-0 text-xs">
        <button
          onClick={load}
          disabled={loading}
          className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {loading ? "Loading history…" : "Show history (all runs / versions)"}
        </button>
        {error && <p className="mt-1 text-destructive">Failed to load history: {error}</p>}
      </div>
    );
  }

  const isCurrent = (v: EntityVersion) => v.graph === currentGraph && v.uri === uri;
  const current = versions.find(isCurrent);
  const currentValues = new Map(
    (current?.fields ?? []).map((f) => [f.property, f.values.join("\u0000")]),
  );
  const differs = (property: string, values: string[]) =>
    current !== undefined && currentValues.get(property) !== values.join("\u0000");
  const runs = new Set(versions.map((v) => v.graph)).size;

  return (
    <div className="mt-2 shrink-0 max-h-[40%] overflow-y-auto border border-border rounded p-2 text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold">
          History — {versions.length} version{versions.length === 1 ? "" : "s"} in {runs} run
          {runs === 1 ? "" : "s"}
        </span>
        <button
          onClick={() => setVersions(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          Hide
        </button>
      </div>
      {versions.length === 0 && (
        <p className="text-muted-foreground">No versions found for this entity.</p>
      )}
      <ol className="flex flex-col gap-2">
        {versions.map((v) => (
          <li
            key={`${v.graph}|${v.uri}`}
            className={`rounded p-2 ${isCurrent(v) ? "bg-primary/10 border border-primary" : "bg-muted"}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
              <span className="font-semibold">Run {v.runDate}</span>
              <span className="font-mono">{v.uri.split("/").pop()}</span>
              {v.actType && (
                <span className="text-muted-foreground">
                  {v.actType}
                  {v.actTime ? ` · ${v.actTime.slice(0, 16).replace("T", " ")}` : ""}
                </span>
              )}
              {v.revisionOf && (
                <span className="text-muted-foreground">
                  revises {v.revisionOf.split("/").pop()}
                </span>
              )}
              {isCurrent(v) && (
                <span className="ml-auto rounded bg-primary px-1.5 text-primary-foreground">
                  shown
                </span>
              )}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-2">
              {v.fields.map((f) => (
                <div key={f.property} className="contents">
                  <dt className="text-muted-foreground">{f.property}</dt>
                  <dd
                    className={`break-words ${
                      !isCurrent(v) && differs(f.property, f.values)
                        ? "bg-yellow-200/70 dark:bg-yellow-500/30 rounded px-0.5"
                        : ""
                    }`}
                  >
                    {f.values.join(" | ")}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}
