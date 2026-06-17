"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TagOption = {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
};

type Props = {
  options: TagOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyHint?: string;
};

export default function TagMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "選択…",
  emptyHint,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setOpen((v) => !v)}
        className="min-h-[32px] px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 cursor-pointer flex flex-wrap gap-1 items-center"
      >
        {selected.length === 0 ? (
          <span className="text-zinc-400">{placeholder}</span>
        ) : (
          selected.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded"
            >
              <span className="max-w-[160px] truncate">
                {labelByValue.get(v) ?? v}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(selected.filter((x) => x !== v));
                }}
                className="hover:text-red-600"
                aria-label="削除"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-auto bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded shadow-lg">
          <div className="p-2 sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="絞り込み…"
              className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
              autoFocus
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-1 text-xs text-zinc-500 hover:text-red-600"
              >
                すべてクリア ({selected.length})
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-zinc-500">
              {emptyHint ?? "該当なし"}
            </div>
          ) : (
            <ul>
              {filtered.map((o) => {
                const isSelected = selected.includes(o.value);
                const isDisabled = !!o.disabled && !isSelected;
                return (
                  <li key={o.value}>
                    <label
                      className={
                        "flex items-center gap-2 px-2 py-1 text-sm " +
                        (isDisabled
                          ? "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer")
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggle(o.value)}
                      />
                      <span className="truncate flex-1">{o.label}</span>
                      {o.count !== undefined && (
                        <span className="text-xs text-zinc-500 tabular-nums">
                          {o.count}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
