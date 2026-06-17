"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type { IndexRow } from "@/app/lib/epigraphy/local-search";
import type { InscriptionNetworkData } from "@/app/utils/sparql";

const InscriptionNetwork = dynamic(
  () => import("@/app/components/InscriptionNetwork"),
  { ssr: false },
);

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

  const edcsUrl = `https://db.edcs.eu/epigr/edcs_id.php?s_sprache=en&p_edcs_id=${encodeURIComponent(
    row.id,
  )}`;

  const dialog = (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Network for ${row.id}`}
    >
      <div
        className="flex flex-col w-full max-w-7xl h-[88vh] bg-white dark:bg-zinc-900 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span>ネットワーク表示</span>
            <a
              href={edcsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 hover:underline"
            >
              {row.id}
            </a>
            {!loading && (
              <span className="text-xs text-zinc-400">
                (ノード関連データ: {networkData.length})
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 text-2xl leading-none font-bold"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* Body: text (left) | network (right) */}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Left: inscription text + metadata */}
          <div className="md:w-1/3 w-full md:h-full h-2/5 overflow-y-auto p-4 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
            <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-zinc-500">発見地</dt>
              <dd>{row.place ?? "—"}</dd>
              <dt className="text-zinc-500">属州</dt>
              <dd>{row.province ?? "—"}</dd>
              <dt className="text-zinc-500">年代</dt>
              <dd>
                {row.datingFrom != null || row.datingTo != null
                  ? `${row.datingFrom ?? "?"} – ${row.datingTo ?? "?"}`
                  : "—"}
              </dd>
            </dl>

            {row.text ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="text-xs text-zinc-500 mb-1">碑文テキスト</div>
                <pre className="whitespace-pre-wrap font-serif text-sm bg-zinc-50 dark:bg-zinc-800 p-3 rounded overflow-y-auto flex-1 min-h-0">
                  {row.text}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">碑文テキストはありません</p>
            )}
          </div>

          {/* Right: network graph */}
          <div className="md:w-2/3 w-full md:h-full h-3/5 min-h-0 p-3">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-zinc-500">
                  ネットワークを読み込み中…
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
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
