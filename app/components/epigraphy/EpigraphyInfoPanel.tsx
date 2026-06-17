"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { IndexRow } from "@/app/lib/epigraphy/local-search";
import { computeStats } from "@/app/lib/epigraphy/local-stats";
import EpigraphyStatsView from "./EpigraphyStatsView";
import {
  queryInscriptionNetwork,
  type InscriptionNetworkData,
} from "@/app/utils/sparql";

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
};

type Section = "card" | "stats";

export default function EpigraphyInfoPanel({
  rows,
  selectedEdcsId,
  onClose,
}: Props) {
  const [section, setSection] = useState<Section>("card");
  // When set, the network dialog is open for this EDCS id.
  const [networkOpen, setNetworkOpen] = useState(false);
  const [networkData, setNetworkData] = useState<InscriptionNetworkData[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedEdcsId) ?? null,
    [rows, selectedEdcsId],
  );

  const stats = useMemo(() => computeStats(rows), [rows]);

  // Reset the network view whenever the selection changes.
  useEffect(() => {
    setNetworkOpen(false);
    setNetworkData([]);
  }, [selectedEdcsId]);

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

  const edcsUrl = selectedRow
    ? `https://db.edcs.eu/epigr/edcs_id.php?s_sprache=en&p_edcs_id=${encodeURIComponent(
        selectedRow.id,
      )}`
    : "#";

  return (
    <>
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setSection("card")}
            className={
              "px-3 py-1 rounded " +
              (section === "card"
                ? "bg-blue-600 text-white"
                : "border border-zinc-300 dark:border-zinc-700")
            }
          >
            詳細
          </button>
          <button
            onClick={() => setSection("stats")}
            className={
              "px-3 py-1 rounded " +
              (section === "stats"
                ? "bg-blue-600 text-white"
                : "border border-zinc-300 dark:border-zinc-700")
            }
          >
            統計 ({stats.totalInscriptions})
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-700 text-lg font-bold"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {section === "card" && (
          <>
            {!selectedRow ? (
              <p className="text-sm text-zinc-500">
                テーブルまたは地図で碑文を選択してください
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <a
                    href={edcsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-600 hover:underline"
                  >
                    {selectedRow.id}
                  </a>
                </div>

                <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">発見地</dt>
                  <dd>{selectedRow.place ?? "—"}</dd>
                  <dt className="text-zinc-500">属州</dt>
                  <dd>{selectedRow.province ?? "—"}</dd>
                  <dt className="text-zinc-500">年代</dt>
                  <dd>
                    {selectedRow.datingFrom != null ||
                    selectedRow.datingTo != null
                      ? `${selectedRow.datingFrom ?? "?"} – ${
                          selectedRow.datingTo ?? "?"
                        }`
                      : "—"}
                  </dd>
                  <dt className="text-zinc-500">Literature</dt>
                  <dd>{selectedRow.publication ?? "—"}</dd>
                  {selectedRow.lat != null && selectedRow.lon != null && (
                    <>
                      <dt className="text-zinc-500">座標</dt>
                      <dd className="tabular-nums">
                        {selectedRow.lat.toFixed(4)},{" "}
                        {selectedRow.lon.toFixed(4)}
                      </dd>
                    </>
                  )}
                </dl>

                {selectedRow.text && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">碑文テキスト</div>
                    <pre className="whitespace-pre-wrap font-serif text-sm bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                      {selectedRow.text}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <Stat label="人物" n={selectedRow.persons.length} />
                  <Stat label="経歴" n={selectedRow.careers.length} />
                  <Stat label="恵与" n={selectedRow.benefactions.length} />
                  <Stat label="関係" n={selectedRow.relationships.length} />
                </div>

                <ListBlock title="人物" items={selectedRow.persons} />
                <ListBlock title="経歴" items={selectedRow.careers} />
                <ListBlock title="恵与" items={selectedRow.benefactions} />
                <ListBlock title="関係性" items={selectedRow.relationships} />
                <ListBlock title="コミュニティ" items={selectedRow.communities} />

                <div>
                  <button
                    onClick={openNetwork}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    ネットワークを表示
                  </button>
                </div>
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
    <div className="bg-zinc-50 dark:bg-zinc-800 rounded p-1.5">
      <div className="text-base font-semibold tabular-nums">{n}</div>
      <div className="text-zinc-500">{label}</div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">
        {title} <span className="text-xs text-zinc-400">({items.length})</span>
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
