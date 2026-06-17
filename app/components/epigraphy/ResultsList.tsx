"use client";

import type { InscriptionResult } from "@/app/lib/epigraphy/types";

type Props = {
  results: InscriptionResult[];
  selectedEdcsId: string | null;
  onSelect: (edcsId: string) => void;
  emptyMessage?: string;
};

function Cell({ value }: { value?: string }) {
  if (!value) return <span className="text-zinc-400">—</span>;
  const parts = value.split(" | ").filter(Boolean);
  if (parts.length <= 1) {
    return <span className="whitespace-pre-wrap break-words">{value}</span>;
  }
  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {parts.map((p, i) => (
        <li key={i} className="whitespace-pre-wrap break-words">
          {p}
        </li>
      ))}
    </ul>
  );
}

export default function ResultsList({
  results,
  selectedEdcsId,
  onSelect,
  emptyMessage,
}: Props) {
  if (results.length === 0) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        {emptyMessage ?? "条件を指定して「検索」を押してください"}
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="text-xs border-collapse min-w-full">
        <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 z-10">
          <tr>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold">
              EDCS-ID
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold">
              発見地
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold">
              属州
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold">
              年代
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold">
              Literature
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold min-w-[180px]">
              人物
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold min-w-[180px]">
              経歴
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold min-w-[200px]">
              恵与（タイプ／対象）
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold min-w-[180px]">
              関係性
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold min-w-[140px]">
              コミュニティ
            </th>
            <th className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-left font-semibold min-w-[240px]">
              碑文テキスト
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            const active = r.edcsId === selectedEdcsId;
            const dating =
              r.datingFrom || r.datingTo
                ? `${r.datingFrom ?? "?"} – ${r.datingTo ?? "?"}`
                : "";
            return (
              <tr
                key={`${r.edcsId}-${idx}`}
                onClick={() => onSelect(r.edcsId)}
                className={
                  "align-top cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 " +
                  (active ? "bg-blue-50 dark:bg-blue-950" : "")
                }
              >
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 font-mono whitespace-nowrap">
                  {r.edcsId}
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1">
                  {r.placeLabel ?? "—"}
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1">
                  {r.provinceLabel ?? "—"}
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1 whitespace-nowrap">
                  {dating || "—"}
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1">
                  <Cell value={r.publication} />
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1">
                  <Cell value={r.persons} />
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1">
                  <Cell value={r.careers} />
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1">
                  <Cell value={r.benefactions} />
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1">
                  <Cell value={r.relationships} />
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1">
                  <Cell value={r.communities} />
                </td>
                <td className="border border-zinc-300 dark:border-zinc-700 px-2 py-1">
                  {r.text ? (
                    <pre className="whitespace-pre-wrap font-serif text-xs">
                      {r.text}
                    </pre>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
