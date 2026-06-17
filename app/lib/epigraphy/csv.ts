import type { InscriptionResult } from "./types";

const COLUMNS: Array<{ key: keyof InscriptionResult | "dating"; label: string }> = [
  { key: "edcsId", label: "EDCS-ID" },
  { key: "placeLabel", label: "発見地" },
  { key: "provinceLabel", label: "属州" },
  { key: "dating", label: "年代" },
  { key: "publication", label: "Literature" },
  { key: "persons", label: "人物" },
  { key: "careers", label: "経歴" },
  { key: "benefactions", label: "恵与" },
  { key: "relationships", label: "関係性" },
  { key: "communities", label: "コミュニティ" },
  { key: "text", label: "碑文テキスト" },
  { key: "inscriptionUri", label: "Inscription URI" },
];

function escapeCsvCell(value: string | undefined): string {
  if (value == null) return "";
  // Normalize the GROUP_CONCAT separator into something nicer for CSV cells.
  const normalized = value.replace(/ \| /g, "; ");
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function rowsToCsv(rows: InscriptionResult[]): string {
  const header = COLUMNS.map((c) => c.label).join(",");
  const lines = rows.map((r) =>
    COLUMNS.map((c) => {
      if (c.key === "dating") {
        if (!r.datingFrom && !r.datingTo) return "";
        return escapeCsvCell(`${r.datingFrom ?? "?"}–${r.datingTo ?? "?"}`);
      }
      return escapeCsvCell(r[c.key] as string | undefined);
    }).join(","),
  );
  // Prepend BOM so Excel opens UTF-8 correctly.
  return "﻿" + [header, ...lines].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
