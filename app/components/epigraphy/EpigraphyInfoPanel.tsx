"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { IndexRow } from "@/app/lib/epigraphy/local-search";
import { computeStats } from "@/app/lib/epigraphy/local-stats";
import EpigraphyStatsView from "./EpigraphyStatsView";
import EpigraphyRagPanel from "./EpigraphyRagPanel";
import {
  queryInscriptionNetwork,
  queryLiteratureReferences,
  type InscriptionNetworkData,
  type LiteratureReference,
  type LiteratureExcerpt,
} from "@/app/utils/sparql";
import {
  buildEdcsUrl,
  externalLinksFor,
} from "@/app/lib/epigraphy/external-links";
import {
  openEditionLink,
  openEditionParagraphLink,
} from "@/app/lib/epigraphy/openedition";

// OpenEdition lazily loads images, so the browser may settle on the anchor
// before upstream content gains height — landing short of the target. Nothing we
// can fix from our link, so we tell the user how to recover. Appended to the
// deep-link tooltips.
const OPENEDITION_SCROLL_NOTE =
  "\n* If the position is off after the page loads, reload or click the link again.";

// Human-readable labels for the literature relation types (the local name after
// "rel_" in the ns: vocabulary).
const REL_TYPE_LABELS: Record<string, string> = {
  transcription: "transcription",
  translation: "translation",
  contentDescription: "content description",
  detailedAnalysis: "detailed analysis",
  dating: "dating",
  provenance: "provenance",
  citationOnly: "citation only",
  discovererPublisher: "discoverer/publisher",
  textualCriticism: "textual criticism",
  crossCorpusIdentification: "cross-corpus identification",
  figureReference: "figure reference",
};

function relTypeLabel(relType: string): string {
  return REL_TYPE_LABELS[relType] ?? relType;
}

// Formats where in the publication an excerpt's mention occurs, distinguishing
// body (running text, by paragraph) from footnotes (by note number):
//   body:  "§8" / "§159–161"
//   note:  "n. 7"
// Returns "" when no position is known.
function formatLocation(ex: LiteratureExcerpt): string {
  if (ex.locationType === "note" && ex.noteNumber != null) {
    return `n. ${ex.noteNumber}`;
  }
  if (ex.startParagraph != null) {
    if (ex.endParagraph != null && ex.endParagraph !== ex.startParagraph) {
      return `§${ex.startParagraph}–${ex.endParagraph}`;
    }
    return `§${ex.startParagraph}`;
  }
  // Fallbacks: known location kind but no precise number.
  if (ex.locationType === "note") return "note";
  if (ex.locationType === "body") return "body";
  return "";
}

// The network is shown in a modal dialog (text + graph side by side) rather
// than inline in this panel, for better visibility.
const NetworkDialog = dynamic(() => import("./NetworkDialog"), { ssr: false });

type Props = {
  // The current effective row set (search- and region-filtered). Drives the
  // statistics section.
  rows: IndexRow[];
  // The currently selected inscription, looked up within `rows` to render the
  // card and to drive the network query.
  selectedEdcsId: string | null;
  onClose: () => void;
  // Select an inscription by id — used by the RAG panel to jump to a cited
  // inscription within the current result set.
  onSelectInscription?: (edcsId: string) => void;
};

type Section = "card" | "refs" | "stats" | "rag";

export default function EpigraphyInfoPanel({
  rows,
  selectedEdcsId,
  onClose,
  onSelectInscription,
}: Props) {
  const [section, setSection] = useState<Section>("card");
  // When set, the network dialog is open for this EDCS id.
  const [networkOpen, setNetworkOpen] = useState(false);
  const [networkData, setNetworkData] = useState<InscriptionNetworkData[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  // Literature references for the selected inscription. Loaded lazily when the
  // "Literature" tab is first opened for a given selection.
  const [refs, setRefs] = useState<LiteratureReference[]>([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsLoadedFor, setRefsLoadedFor] = useState<string | null>(null);
  // Selected citation-relation types to filter the Literature tab by. Empty = show all.
  const [relFilter, setRelFilter] = useState<Set<string>>(new Set());
  // Filter excerpts by where they occur: all, body (running text), or note
  // (footnote). Lets the user separate in-text discussion from footnote cites.
  const [locFilter, setLocFilter] = useState<"all" | "body" | "note">("all");

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedEdcsId) ?? null,
    [rows, selectedEdcsId],
  );

  const stats = useMemo(() => computeStats(rows), [rows]);

  // EDCS ids of the current result set — the search scope for RAG.
  const edcsIds = useMemo(() => rows.map((r) => r.id), [rows]);

  // Reset the network and literature views whenever the selection changes.
  useEffect(() => {
    setNetworkOpen(false);
    setNetworkData([]);
    setRefs([]);
    setRefsLoadedFor(null);
    setRelFilter(new Set());
    setLocFilter("all");
  }, [selectedEdcsId]);

  // Counts of body- vs note-located excerpts across all loaded references —
  // drives the body/note filter buttons.
  const locCounts = useMemo(() => {
    let body = 0;
    let note = 0;
    for (const ref of refs) {
      for (const ex of ref.excerpts) {
        if (ex.locationType === "note") note++;
        else if (ex.locationType === "body") body++;
      }
    }
    return { body, note, all: body + note };
  }, [refs]);

  // Available citation-relation types, counted within the current location
  // filter so the relation chips reflect what the body/note choice will show.
  const relTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ref of refs) {
      for (const ex of ref.excerpts) {
        if (locFilter !== "all" && ex.locationType !== locFilter) continue;
        counts.set(ex.relType, (counts.get(ex.relType) ?? 0) + 1);
      }
    }
    return counts;
  }, [refs, locFilter]);

  // References with their excerpts narrowed by both the location filter and the
  // selected relation types. Documents left with no matching excerpts are
  // dropped. Empty relation filter = all relations.
  const filteredRefs = useMemo(() => {
    if (locFilter === "all" && relFilter.size === 0) return refs;
    return refs
      .map((ref) => ({
        ...ref,
        excerpts: ref.excerpts.filter(
          (ex) =>
            (locFilter === "all" || ex.locationType === locFilter) &&
            (relFilter.size === 0 || relFilter.has(ex.relType)),
        ),
      }))
      .filter((ref) => ref.excerpts.length > 0);
  }, [refs, relFilter, locFilter]);

  function toggleRelFilter(relType: string) {
    setRelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(relType)) next.delete(relType);
      else next.add(relType);
      return next;
    });
  }

  // Lazily load literature references when the Literature tab is active for a
  // selection we haven't fetched yet.
  useEffect(() => {
    if (section !== "refs" || !selectedEdcsId) return;
    if (refsLoadedFor === selectedEdcsId) return;
    let cancelled = false;
    setRefsLoading(true);
    queryLiteratureReferences(selectedEdcsId)
      .then((data) => {
        if (cancelled) return;
        setRefs(data);
        setRefsLoadedFor(selectedEdcsId);
      })
      .catch((e) => {
        console.error("literature references load failed", e);
        if (!cancelled) setRefs([]);
      })
      .finally(() => {
        if (!cancelled) setRefsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, selectedEdcsId, refsLoadedFor]);

  async function openNetwork() {
    if (!selectedEdcsId) return;
    setNetworkOpen(true);
    setNetworkLoading(true);
    try {
      const data = await queryInscriptionNetwork(selectedEdcsId);
      setNetworkData(data);
    } catch (e) {
      console.error("network load failed", e);
      setNetworkData([]);
    } finally {
      setNetworkLoading(false);
    }
  }

  // External database deep-links for the selected inscription, baked into the
  // index from the SPARQL endpoint (EDCS, SIRAR, …). New databases appear
  // automatically (see app/lib/epigraphy/external-links.ts).
  const externalLinks = selectedRow ? externalLinksFor(selectedRow) : [];
  // The ID heading links to the first external database, preferring EDCS;
  // falls back to a built EDCS URL for older indexes without baked-in links.
  const headingUrl = selectedRow
    ? (externalLinks.find((l) => l.name === "EDCS") ?? externalLinks[0])?.url ??
      buildEdcsUrl(selectedRow.id)
    : "#";

  return (
    <>
    <div className="flex flex-col h-full min-h-0 bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setSection("card")}
            className={
              "px-3 py-1 rounded " +
              (section === "card"
                ? "bg-primary text-primary-foreground"
                : "border border-border")
            }
          >
            Details
          </button>
          <button
            onClick={() => setSection("refs")}
            className={
              "px-3 py-1 rounded " +
              (section === "refs"
                ? "bg-primary text-primary-foreground"
                : "border border-border")
            }
          >
            Literature
          </button>
          <button
            onClick={() => setSection("stats")}
            className={
              "px-3 py-1 rounded " +
              (section === "stats"
                ? "bg-primary text-primary-foreground"
                : "border border-border")
            }
          >
            Stats ({stats.totalInscriptions})
          </button>
          <button
            onClick={() => setSection("rag")}
            className={
              "px-3 py-1 rounded " +
              (section === "rag"
                ? "bg-primary text-primary-foreground"
                : "border border-border")
            }
          >
            AI
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg font-bold"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* The RAG panel stays mounted across tab switches so its conversation
          history survives — only an explicit "Clear history" resets it. We
          toggle visibility with CSS instead of unmounting. */}
      <div className={section === "rag" ? "flex-1 min-h-0" : "hidden"}>
        <EpigraphyRagPanel
          edcsIds={edcsIds}
          selectedEdcsId={selectedEdcsId}
          selectedPlace={selectedRow?.place ?? null}
          onInscriptionClick={onSelectInscription}
        />
      </div>

      <div
        className={
          section === "rag"
            ? "hidden"
            : "flex-1 overflow-y-auto p-3 min-h-0"
        }
      >
        {section === "card" && (
          <>
            {!selectedRow ? (
              <p className="text-sm text-muted-foreground">
                Select an inscription from the table or map
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <a
                    href={headingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary hover:underline"
                  >
                    {selectedRow.id}
                  </a>
                </div>

                <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Findspot</dt>
                  <dd>{selectedRow.place ?? "—"}</dd>
                  <dt className="text-muted-foreground">Province</dt>
                  <dd>{selectedRow.province ?? "—"}</dd>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd>
                    {selectedRow.datingFrom != null ||
                    selectedRow.datingTo != null
                      ? `${selectedRow.datingFrom ?? "?"} – ${
                          selectedRow.datingTo ?? "?"
                        }`
                      : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Literature</dt>
                  <dd>{selectedRow.publication ?? "—"}</dd>
                  {selectedRow.lat != null && selectedRow.lon != null && (
                    <>
                      <dt className="text-muted-foreground">Coordinates</dt>
                      <dd className="tabular-nums">
                        {selectedRow.lat.toFixed(4)},{" "}
                        {selectedRow.lon.toFixed(4)}
                      </dd>
                    </>
                  )}
                </dl>

                {externalLinks.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      External databases
                    </div>
                    <ul className="flex flex-col gap-1">
                      {externalLinks.map((link) => (
                        <li key={link.key}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={
                              link.id
                                ? `${link.description} — ${link.id}`
                                : link.description
                            }
                            className="text-sm text-primary hover:underline"
                          >
                            {link.name}
                            {link.id && (
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {link.id}
                              </span>
                            )}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedRow.text && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Inscription text</div>
                    <pre className="whitespace-pre-wrap font-serif text-sm bg-muted p-2 rounded">
                      {selectedRow.text}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <Stat label="Persons" n={selectedRow.persons.length} />
                  <Stat label="Career" n={selectedRow.careers.length} />
                  <Stat label="Benefactions" n={selectedRow.benefactions.length} />
                  <Stat label="Relations" n={selectedRow.relationships.length} />
                </div>

                <ListBlock title="Persons" items={selectedRow.persons} />
                <ListBlock title="Career" items={selectedRow.careers} />
                <ListBlock title="Benefactions" items={selectedRow.benefactions} />
                <ListBlock title="Relationships" items={selectedRow.relationships} />
                <ListBlock title="Communities" items={selectedRow.communities} />
                {/* Deities are an element of the inscription independent of the
                    person list (deity names are not folded into person names). */}
                <ListBlock title="Deities" items={selectedRow.divinityTypes ?? []} />

                <div>
                  <button
                    onClick={openNetwork}
                    className="px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded"
                  >
                    Show network
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {section === "refs" && (
          <>
            {!selectedRow ? (
              <p className="text-sm text-muted-foreground">
                Select an inscription from the table or map
              </p>
            ) : refsLoading ? (
              <p className="text-sm text-muted-foreground">Loading literature…</p>
            ) : refs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No literature is recorded for this inscription.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-xs text-muted-foreground">
                  Scholarly works citing this inscription ({filteredRefs.length}
                  {(relFilter.size > 0 || locFilter !== "all") &&
                    ` / ${refs.length}`}
                  )
                </div>

                {/* Filter by where the mention occurs: body vs footnote. Only
                    shown when the data carries the distinction. */}
                {locCounts.all > 0 &&
                  (locCounts.body > 0 || locCounts.note > 0) && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        Filter by mention location
                      </span>
                      <div className="flex gap-1">
                        {(
                          [
                            ["all", `All (${locCounts.all})`],
                            ["body", `Body (${locCounts.body})`],
                            ["note", `Notes (${locCounts.note})`],
                          ] as const
                        ).map(([key, label]) => (
                          <button
                            key={key}
                            onClick={() => setLocFilter(key)}
                            aria-pressed={locFilter === key}
                            className={
                              "text-[11px] px-2 py-0.5 rounded-full border transition-colors " +
                              (locFilter === key
                                ? "bg-foreground text-background border-foreground"
                                : "border-border text-muted-foreground hover:border-muted-foreground")
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Filter by citation relation. Each chip toggles a relation
                    type; no chips selected = show all. */}
                {relTypeCounts.size > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        Filter by citation relation
                      </span>
                      {relFilter.size > 0 && (
                        <button
                          onClick={() => setRelFilter(new Set())}
                          className="text-[11px] text-primary hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(relTypeCounts.entries())
                        .sort((a, b) => b[1] - a[1])
                        .map(([relType, count]) => {
                          const active = relFilter.has(relType);
                          return (
                            <button
                              key={relType}
                              onClick={() => toggleRelFilter(relType)}
                              aria-pressed={active}
                              className={
                                "text-[11px] px-2 py-0.5 rounded-full border transition-colors " +
                                (active
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-muted-foreground hover:border-primary/60")
                              }
                            >
                              {relTypeLabel(relType)} ({count})
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {filteredRefs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No works match the selected citation relations.
                  </p>
                ) : (
                  filteredRefs.map((ref, i) => (
                    <ReferenceBlock key={ref.uri || i} reference={ref} />
                  ))
                )}
              </div>
            )}
          </>
        )}

        {section === "stats" && <EpigraphyStatsView stats={stats} />}
      </div>
    </div>

    {networkOpen && selectedRow && (
      <NetworkDialog
        row={selectedRow}
        networkData={networkData}
        loading={networkLoading}
        onClose={() => setNetworkOpen(false)}
      />
    )}
    </>
  );
}

function Stat({ label, n }: { label: string; n: number }) {
  return (
    <div className="bg-muted rounded p-1.5">
      <div className="text-base font-semibold tabular-nums">{n}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

// Renders one citing research publication: a bibliographic header (title,
// author, containing volume, pages, link), followed by the excerpts in which
// that work discusses the inscription — each tagged with its citation relation
// (transcription / translation / dating …) and the raw corpus reference it used.
function ReferenceBlock({ reference }: { reference: LiteratureReference }) {
  const { title, creator, containerTitle, pages, source, doi, excerpts } =
    reference;
  // Build the external link: prefer an explicit source URL, else a DOI URL.
  const link = source || (doi ? `https://doi.org/${doi}` : undefined);
  const hasHeader = title || creator || containerTitle;

  return (
    <div className="border border-border rounded p-2">
      {hasHeader ? (
        <div className="mb-2">
          <div className="text-sm font-semibold leading-snug">
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {title || "(untitled)"}
              </a>
            ) : (
              title || "(untitled)"
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {[
              creator,
              containerTitle ? `in: ${containerTitle}` : null,
              pages ? `pp. ${pages}` : null,
            ]
              .filter(Boolean)
              .join(" / ")}
            {doi && (
              <>
                {" "}
                <span className="text-muted-foreground">
                  DOI:{" "}
                  <a
                    href={`https://doi.org/${doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {doi}
                  </a>
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground mb-2">(no bibliographic info)</div>
      )}

      <div className="text-[11px] text-muted-foreground mb-1">
        Citations ({excerpts.length})
      </div>
      {excerpts.length === 0 ? (
        <div className="text-xs text-muted-foreground">No excerpts</div>
      ) : (
        <div className="flex flex-col gap-2">
          {excerpts.map((ex, i) => {
            const posLabel = formatLocation(ex);
            const posLink = openEditionLink(source, ex);
            const isNote = ex.locationType === "note";
            return (
            <div key={i}>
              <div className="flex items-center flex-wrap gap-1.5 mb-1">
                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {relTypeLabel(ex.relType)}
                </span>
                {/* Body vs footnote indicator — the core of the body/note
                    distinction the data now records. */}
                {ex.locationType && (
                  <span
                    className={
                      "text-[10px] px-1.5 py-0.5 rounded " +
                      (isNote
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200")
                    }
                  >
                    {isNote ? "note" : "body"}
                  </span>
                )}
                {ex.rawRef && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {ex.rawRef}
                  </span>
                )}
                {posLabel &&
                  (posLink ? (
                    <a
                      href={posLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-primary hover:bg-muted/70"
                      title={
                        (isNote
                          ? "Open this footnote on OpenEdition"
                          : "Open this paragraph on OpenEdition") +
                        OPENEDITION_SCROLL_NOTE
                      }
                    >
                      {posLabel} ↗
                    </a>
                  ) : (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                      title="Position in the publication"
                    >
                      {posLabel}
                    </span>
                  ))}
                {/* For footnotes, the body paragraph the note is attached to —
                    clickable to open that paragraph on OpenEdition. */}
                {isNote &&
                  ex.noteParentParagraph != null &&
                  (() => {
                    const parentLink = openEditionParagraphLink(
                      source,
                      ex.noteParentParagraph,
                    );
                    const label = `§${ex.noteParentParagraph}`;
                    return parentLink ? (
                      <a
                        href={parentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-primary hover:bg-muted/70"
                        title={"Open the parent paragraph on OpenEdition" + OPENEDITION_SCROLL_NOTE}
                      >
                        （{label} ↗）
                      </a>
                    ) : (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        title="Body paragraph the footnote is attached to"
                      >
                        （{label}）
                      </span>
                    );
                  })()}
              </div>
              <p className="text-sm whitespace-pre-wrap font-serif leading-relaxed">
                {ex.text}
              </p>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">
        {title} <span className="text-xs text-muted-foreground">({items.length})</span>
      </summary>
      <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
        {items.map((it, i) => (
          <li key={i} className="break-words">
            {it}
          </li>
        ))}
      </ul>
    </details>
  );
}
