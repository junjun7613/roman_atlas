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
  placeholder = "Select…",
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
        className="min-h-[32px] px-2 py-1 text-sm border border-border rounded bg-card cursor-pointer flex flex-wrap gap-1 items-center"
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          selected.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded"
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
                className="hover:text-destructive"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-auto bg-popover border border-border rounded shadow-lg">
          <div className="p-2 sticky top-0 bg-popover border-b border-border">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="w-full px-2 py-1 text-sm border border-border rounded bg-card"
              autoFocus
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-1 text-xs text-muted-foreground hover:text-destructive"
              >
                Clear all ({selected.length})
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">
              {emptyHint ?? "No matches"}
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
                          ? "text-muted-foreground cursor-not-allowed"
                          : "hover:bg-muted cursor-pointer")
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
                        <span className="text-xs text-muted-foreground tabular-nums">
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
