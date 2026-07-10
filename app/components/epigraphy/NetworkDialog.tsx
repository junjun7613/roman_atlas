"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type { IndexRow } from "@/app/lib/epigraphy/local-search";
import {
  buildEdcsUrl,
  queryAtagText,
  type InscriptionNetworkData,
  type AtagText,
} from "@/app/utils/sparql";

const InscriptionNetwork = dynamic(
  () => import("@/app/components/InscriptionNetwork"),
  { ssr: false },
);

const AnnotatedText = dynamic(
  () => import("./AnnotatedText"),
  { ssr: false },
);

import ResizableSplit from "./ResizableSplit";

type Props = {
  row: IndexRow;
  networkData: InscriptionNetworkData[];
  loading: boolean;
  onClose: () => void;
};

// Full-screen modal that shows the inscription text alongside its network
// graph, so the two can be read together. Replaces the old inline-in-panel
// network box for better visibility.
export default function NetworkDialog({
  row,
  networkData,
  loading,
  onClose,
}: Props) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Fetch the ATAG annotated text for this inscription. Many EDCS ids have no
  // ex:Text record, in which case this stays null and we fall back to the
  // plain index text below.
  const [atag, setAtag] = useState<AtagText | null>(null);
  const [atagLoading, setAtagLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setAtagLoading(true);
    setAtag(null);
    queryAtagText(row.id).then((result) => {
      if (!cancelled) {
        setAtag(result);
        setAtagLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  // Split orientation: side-by-side on desktop (≥768px), stacked on narrow
  // screens. Track the viewport so the divider drags along the right axis.
  const [horizontal, setHorizontal] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setHorizontal(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const edcsUrl = buildEdcsUrl(row.id);

  const dialog = (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Network for ${row.id}`}
    >
      <div
        className="flex flex-col w-full max-w-7xl h-[88vh] bg-card rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span>Network view</span>
            <a
              href={edcsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline"
            >
              {row.id}
            </a>
            {!loading && (
              <span className="text-xs text-muted-foreground">
                (related node data: {networkData.length})
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body: text | network. Drag the divider to resize; side-by-side on
            desktop, stacked on narrow screens. */}
        <ResizableSplit
          direction={horizontal ? "horizontal" : "vertical"}
          initialFirstPct={horizontal ? 33 : 40}
          minFirstPct={15}
          maxFirstPct={85}
          className="flex-1 min-h-0"
          first={
            /* Text + metadata */
            <div className="h-full overflow-y-auto p-4 flex flex-col gap-3">
              <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Findspot</dt>
                <dd>{row.place ?? "—"}</dd>
                <dt className="text-muted-foreground">Province</dt>
                <dd>{row.province ?? "—"}</dd>
                <dt className="text-muted-foreground">Date</dt>
                <dd>
                  {row.datingFrom != null || row.datingTo != null
                    ? `${row.datingFrom ?? "?"} – ${row.datingTo ?? "?"}`
                    : "—"}
                </dd>
              </dl>

              {atag ? (
                // ATAG annotated text: line numbers + epigraphic markup,
                // matching the standalone viewer_epigraph.html.
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="text-xs text-muted-foreground mb-1">
                    Annotated text
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto bg-muted p-3 rounded">
                    <AnnotatedText data={atag} />
                  </div>
                </div>
              ) : atagLoading ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="text-xs text-muted-foreground mb-1">
                    Inscription text
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Loading annotated text…
                  </p>
                </div>
              ) : row.text ? (
                // No ATAG record for this inscription — fall back to the plain
                // text carried in the search index.
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="text-xs text-muted-foreground mb-1">
                    Inscription text
                  </div>
                  <pre className="whitespace-pre-wrap font-serif text-sm bg-muted p-3 rounded overflow-y-auto flex-1 min-h-0">
                    {row.text}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No inscription text available
                </p>
              )}
            </div>
          }
          second={
            /* Network graph */
            <div className="h-full min-h-0 p-3">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Loading network…
                  </p>
                </div>
              ) : (
                <InscriptionNetwork
                  edcsId={row.id}
                  networkData={networkData}
                  onClose={onClose}
                  variant="dialog"
                />
              )}
            </div>
          }
        />
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
