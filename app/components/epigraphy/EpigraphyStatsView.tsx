"use client";

import { useState } from "react";
import type { EpigraphyStats, FrequencyEntry } from "@/app/lib/epigraphy/local-stats";

// Graphical statistics view, mirroring the main Roman Atlas control panel:
// inner tabs (Age / Names / Benefactions / Divinities / Distribution), KPI
// cards, horizontal percentage bars, and SVG pie charts. Pure markup + inline
// SVG — no charting library.

type Tab = "age" | "names" | "benefaction" | "divinity" | "distribution";

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

// ── Horizontal bar list ───────────────────────────────────────────────────
function BarList({
  entries,
  limit = 20,
  color = "bg-blue-500",
  track = "bg-blue-100 dark:bg-blue-950",
}: {
  entries: FrequencyEntry[];
  limit?: number;
  color?: string;
  track?: string;
}) {
  if (entries.length === 0)
    return <p className="text-xs text-muted-foreground">No data</p>;
  const top = entries.slice(0, limit);
  const total = entries.reduce((s, e) => s + e.count, 0);
  const max = top.reduce((m, e) => Math.max(m, e.count), 0);
  return (
    <div className="space-y-2">
      {top.map((e) => {
        const pct = total > 0 ? (e.count / total) * 100 : 0;
        const barPct = max > 0 ? (e.count / max) * 100 : 0;
        const label = e.value.split("/").pop() || e.value;
        return (
          <div
            key={e.value}
            className="py-1.5 px-2 rounded-md bg-muted"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-foreground truncate">
                {label}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                {e.count} ({pct.toFixed(1)}%)
              </span>
            </div>
            <div
              className={`relative w-full h-2 rounded-full overflow-hidden ${track}`}
            >
              <div
                className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${color}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────
function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="p-3 bg-muted rounded-lg">
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground">
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── SVG pie + legend ───────────────────────────────────────────────────────
function Pie({
  entries,
  colors = PIE_COLORS,
}: {
  entries: FrequencyEntry[];
  colors?: string[];
}) {
  if (entries.length === 0)
    return <p className="text-xs text-muted-foreground">No data</p>;
  const total = entries.reduce((s, e) => s + e.count, 0);
  let angle = 0;
  const slices = entries.map((e, i) => {
    const frac = total > 0 ? e.count / total : 0;
    const start = angle;
    const end = angle + frac * 360;
    angle = end;
    const sr = (start * Math.PI) / 180;
    const er = (end * Math.PI) / 180;
    const x1 = 100 + 90 * Math.cos(sr);
    const y1 = 100 + 90 * Math.sin(sr);
    const x2 = 100 + 90 * Math.cos(er);
    const y2 = 100 + 90 * Math.sin(er);
    const large = frac > 0.5 ? 1 : 0;
    // A single full-circle slice can't be drawn with one arc; use a circle.
    const d =
      frac >= 0.999
        ? null
        : `M 100 100 L ${x1} ${y1} A 90 90 0 ${large} 1 ${x2} ${y2} Z`;
    return { e, i, d, frac };
  });
  return (
    <div className="flex gap-3 items-center">
      <svg
        width="120"
        height="120"
        viewBox="0 0 200 200"
        className="shrink-0 -rotate-90"
      >
        {slices.map(({ e, i, d }) =>
          d === null ? (
            <circle key={e.value} cx="100" cy="100" r="90" fill={colors[i % colors.length]} />
          ) : (
            <path
              key={e.value}
              d={d}
              fill={colors[i % colors.length]}
              stroke="#fff"
              strokeWidth="2"
            />
          ),
        )}
      </svg>
      <ul className="flex-1 space-y-1 min-w-0">
        {slices.map(({ e, i, frac }) => (
          <li key={e.value} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: colors[i % colors.length] }}
              />
              <span className="text-xs text-foreground truncate">
                {e.value}
              </span>
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
              {e.count} ({(frac * 100).toFixed(1)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-muted-foreground mb-2">
      {children}
    </h4>
  );
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "age", label: "Age" },
  { key: "names", label: "Names" },
  { key: "benefaction", label: "Benefactions" },
  { key: "divinity", label: "Divinities" },
  { key: "distribution", label: "Distribution" },
];

export default function EpigraphyStatsView({ stats }: { stats: EpigraphyStats }) {
  const [tab, setTab] = useState<Tab>("age");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-muted-foreground">
        Statistics based on the current {stats.totalInscriptions} inscriptions
      </p>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border -mx-0.5 px-0.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors -mb-px border-b-2 " +
              (tab === t.key
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      {tab === "age" && (
        <div className="flex flex-col gap-3">
          {stats.age ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Kpi
                  label="Average age at death"
                  value={`${stats.age.averageAge.toFixed(1)} yrs`}
                  sub={`${stats.age.count}`}
                />
                <Kpi
                  label="Share under age 10"
                  value={`${stats.age.under10Percentage.toFixed(1)}%`}
                  sub={`${stats.age.under10Count}`}
                />
              </div>
              <div>
                <SectionTitle>Age distribution</SectionTitle>
                <BarList
                  entries={stats.age.histogram.map((h) => ({
                    value: h.bucket,
                    count: h.count,
                  }))}
                  limit={20}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No age data</p>
          )}
        </div>
      )}

      {tab === "names" && (
        <div className="flex flex-col gap-4">
          <div>
            <SectionTitle>
              Family name (nomen){" "}
              <span className="text-muted-foreground font-normal">
                ({stats.nomen.length})
              </span>
            </SectionTitle>
            <BarList entries={stats.nomen} />
          </div>
          <div>
            <SectionTitle>
              Personal name (cognomen){" "}
              <span className="text-muted-foreground font-normal">
                ({stats.cognomen.length})
              </span>
            </SectionTitle>
            <BarList entries={stats.cognomen} color="bg-indigo-500" track="bg-indigo-100 dark:bg-indigo-950" />
          </div>
          {stats.socialStatus.length > 0 && (
            <div>
              <SectionTitle>Social status</SectionTitle>
              <BarList entries={stats.socialStatus} color="bg-amber-500" track="bg-amber-100 dark:bg-amber-950" />
            </div>
          )}
        </div>
      )}

      {tab === "benefaction" && (
        <div className="flex flex-col gap-4">
          {stats.cost && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                Benefaction cost summary
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <Field label="Count" value={stats.cost.count.toLocaleString()} />
                <Field label="Average" value={Math.round(stats.cost.avg).toLocaleString()} />
                <Field label="Total" value={stats.cost.total.toLocaleString()} />
                <Field label="Min" value={stats.cost.min.toLocaleString()} />
                <Field label="Max" value={stats.cost.max.toLocaleString()} />
              </div>
            </div>
          )}
          <div>
            <SectionTitle>
              Benefaction type{" "}
              <span className="text-muted-foreground font-normal">
                ({stats.benefactionType.length})
              </span>
            </SectionTitle>
            <Pie entries={stats.benefactionType.slice(0, 8)} />
          </div>
          {stats.objectType.length > 0 && (
            <div>
              <SectionTitle>
                Benefaction object type{" "}
                <span className="text-muted-foreground font-normal">
                  ({stats.objectType.length})
                </span>
              </SectionTitle>
              <Pie
                entries={stats.objectType.slice(0, 8)}
                colors={[
                  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
                  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
                ]}
              />
            </div>
          )}
          {stats.cost && stats.cost.byType.length > 0 && (
            <div>
              <SectionTitle>Cost by type (average)</SectionTitle>
              <BarList
                entries={stats.cost.byType.map((t) => ({
                  value: `${t.type} (avg ${Math.round(t.avg).toLocaleString()})`,
                  count: t.count,
                }))}
                color="bg-emerald-500"
                track="bg-emerald-100 dark:bg-emerald-950"
              />
            </div>
          )}
        </div>
      )}

      {tab === "divinity" && (
        <div>
          <SectionTitle>
            Divinity type{" "}
            <span className="text-muted-foreground font-normal">
              ({stats.divinityType.length})
            </span>
          </SectionTitle>
          <BarList
            entries={stats.divinityType}
            color="bg-green-500"
            track="bg-green-100 dark:bg-green-950"
          />
        </div>
      )}

      {tab === "distribution" && (
        <div className="flex flex-col gap-4">
          <div>
            <SectionTitle>
              Province{" "}
              <span className="text-muted-foreground font-normal">
                ({stats.province.length})
              </span>
            </SectionTitle>
            <BarList entries={stats.province} color="bg-sky-500" track="bg-sky-100 dark:bg-sky-950" />
          </div>
          <div>
            <SectionTitle>
              Findspot{" "}
              <span className="text-muted-foreground font-normal">
                ({stats.place.length})
              </span>
            </SectionTitle>
            <BarList entries={stats.place} color="bg-teal-500" track="bg-teal-100 dark:bg-teal-950" />
          </div>
          {stats.datingHistogram.length > 0 && (
            <div>
              <SectionTitle>Date distribution</SectionTitle>
              <BarList
                entries={stats.datingHistogram.map((h) => ({
                  value: h.bucket,
                  count: h.count,
                }))}
                color="bg-rose-500"
                track="bg-rose-100 dark:bg-rose-950"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-emerald-700/70 dark:text-emerald-400/70">{label}</span>
      <span className="font-semibold tabular-nums text-emerald-900 dark:text-emerald-200">
        {value}
      </span>
    </div>
  );
}
