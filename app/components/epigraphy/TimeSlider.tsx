"use client";

/**
 * A single-year time slider for the epigraphy map. When enabled, the parent
 * filters inscriptions to those whose dating range contains the selected year
 * (datingFrom <= year <= datingTo). Inscriptions without dating are excluded
 * while the filter is on. An ON/OFF toggle expresses the "show all years"
 * state, since a single-value slider can't otherwise represent "no filter".
 */

export type TimeSliderProps = {
  /** Inclusive lower bound of the slider (negative = BC). */
  min: number;
  /** Inclusive upper bound of the slider. */
  max: number;
  /** Currently selected year. */
  year: number;
  /** Whether the year filter is active. */
  enabled: boolean;
  onYearChange: (year: number) => void;
  onEnabledChange: (enabled: boolean) => void;
};

function formatYear(y: number): string {
  if (y < 0) return `${-y} BC`;
  if (y === 0) return "1 BC/AD"; // there is no year 0; show a neutral label
  return `AD ${y}`;
}

export default function TimeSlider({
  min,
  max,
  year,
  enabled,
  onYearChange,
  onEnabledChange,
}: TimeSliderProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5 text-xs font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="accent-primary"
          />
          Time filter
        </label>
        <span
          className={
            "font-mono text-sm tabular-nums " +
            (enabled ? "text-primary font-semibold" : "text-muted-foreground")
          }
        >
          {formatYear(year)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={year}
        disabled={!enabled}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className="w-full accent-primary disabled:opacity-40"
        aria-label="Year"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{formatYear(min)}</span>
        <span>{formatYear(max)}</span>
      </div>
    </div>
  );
}
