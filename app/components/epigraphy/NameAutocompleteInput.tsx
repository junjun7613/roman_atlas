"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NameVocab } from "@/app/lib/epigraphy/local-search";
import { normalizeName } from "@/app/lib/epigraphy/name-normalize";

type Props = {
  // Full vocabulary for this facet (pre-sorted by descending count from the
  // build script). The component treats this list as immutable.
  vocab: NameVocab[];
  // Selected normalized keys. The parent stores keys (not display strings)
  // because that's what `SearchFilters.nomen/cognomen` expect.
  selected: string[];
  onChange: (keys: string[]) => void;
  // Optional live counts per key under the current other-facet filters.
  // When provided, the dropdown shows these (disabling 0-count options) so
  // the user can see which choices still have hits.
  counts?: Map<string, number>;
  placeholder?: string;
};

const MAX_SUGGESTIONS = 30;

export default function NameAutocompleteInput({
  vocab,
  selected,
  onChange,
  counts,
  placeholder,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const displayByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vocab) m.set(v.key, v.display);
    return m;
  }, [vocab]);

  const suggestions = useMemo(() => {
    const normQ = normalizeName(query);
    if (!normQ) return [];
    const selSet = new Set(selected);
    const out: NameVocab[] = [];
    for (const v of vocab) {
      if (selSet.has(v.key)) continue;
      if (!v.key.includes(normQ)) continue;
      // If we have live counts, skip 0-count options (other filters exclude them).
      if (counts && (counts.get(v.key) ?? 0) === 0) continue;
      out.push(v);
      if (out.length >= MAX_SUGGESTIONS) break;
    }
    return out;
  }, [vocab, query, selected, counts]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function add(key: string) {
    if (selected.includes(key)) return;
    onChange([...selected, key]);
    setQuery("");
    setOpen(false);
  }

  function remove(key: string) {
    onChange(selected.filter((k) => k !== key));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = suggestions[highlight];
      if (pick) add(pick.key);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded"
            >
              <span className="max-w-[160px] truncate">
                {displayByKey.get(k) ?? k}
              </span>
              <button
                type="button"
                onClick={() => remove(k)}
                className="hover:text-red-600"
                aria-label="削除"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "入力して候補から選択…"}
        className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-72 overflow-auto bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow-lg">
          {suggestions.map((s, i) => {
            const liveCount = counts ? counts.get(s.key) : undefined;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(s.key);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={
                    "w-full text-left px-2 py-1 text-sm flex items-center gap-2 " +
                    (i === highlight
                      ? "bg-blue-100 dark:bg-blue-900"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
                  }
                >
                  <span className="truncate flex-1">{s.display}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {liveCount ?? s.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && query && suggestions.length === 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow-lg p-2 text-xs text-zinc-500">
          該当なし
        </div>
      )}
    </div>
  );
}
