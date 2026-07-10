"use client";

import type { InscriptionResult } from "@/app/lib/epigraphy/types";

type Props = {
  results: InscriptionResult[];
  selectedEdcsId: string | null;
  onSelect: (edcsId: string) => void;
  emptyMessage?: string;
};

function Cell({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
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
      <div className="p-4 text-sm text-muted-foreground">
        {emptyMessage ?? "Set filters and press \"Search\""}
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="text-xs border-collapse min-w-full">
        <thead className="sticky top-0 bg-muted z-10">
          <tr>
            <th className="border border-border px-2 py-1 text-left font-semibold">
              EDCS-ID
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold">
              Findspot
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold">
              Province
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold">
              Date
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold">
              Literature
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold min-w-[180px]">
              Persons
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold min-w-[180px]">
              Career
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold min-w-[200px]">
              Benefaction (type / object)
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold min-w-[180px]">
              Relationships
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold min-w-[140px]">
              Community
            </th>
            <th className="border border-border px-2 py-1 text-left font-semibold min-w-[240px]">
              Inscription text
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
                  "align-top cursor-pointer hover:bg-muted " +
                  (active ? "bg-accent" : "")
                }
              >
                <td className="border border-border px-2 py-1 font-mono whitespace-nowrap">
                  {r.edcsId}
                </td>
                <td className="border border-border px-2 py-1">
                  {r.placeLabel ?? "—"}
                </td>
                <td className="border border-border px-2 py-1">
                  {r.provinceLabel ?? "—"}
                </td>
                <td className="border border-border px-2 py-1 whitespace-nowrap">
                  {dating || "—"}
                </td>
                <td className="border border-border px-2 py-1">
                  <Cell value={r.publication} />
                </td>
                <td className="border border-border px-2 py-1">
                  <Cell value={r.persons} />
                </td>
                <td className="border border-border px-2 py-1">
                  <Cell value={r.careers} />
                </td>
                <td className="border border-border px-2 py-1">
                  <Cell value={r.benefactions} />
                </td>
                <td className="border border-border px-2 py-1">
                  <Cell value={r.relationships} />
                </td>
                <td className="border border-border px-2 py-1">
                  <Cell value={r.communities} />
                </td>
                <td className="border border-border px-2 py-1">
                  {r.text ? (
                    <pre className="whitespace-pre-wrap font-serif text-xs">
                      {r.text}
                    </pre>
                  ) : (
                    <span className="text-muted-foreground">—</span>
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
