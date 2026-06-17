// Client-side aggregate statistics over a set of IndexRow records.
//
// In coordinate-mode the inscriptions carry no Pleiades ID, so the existing
// SPARQL statistics functions (which scope by pleiadesIds[]) can't be reused.
// Instead we compute everything in-memory from the filtered/region-selected
// rows. The index build was extended to carry ageAtDeath / divinityTypes /
// benefactionCosts precisely so these aggregates are possible offline.
//
// Output shapes mirror the existing roman_atlas stat types where practical, so
// the info panel can render them with familiar UI.

import type { IndexRow } from "./local-search";

export type AgeAtDeathStats = {
  averageAge: number;
  count: number; // number of recorded ages (persons, not inscriptions)
  under10Count: number;
  under10Percentage: number;
  // Coarse histogram buckets for a simple bar chart.
  histogram: Array<{ bucket: string; count: number }>;
};

export type FrequencyEntry = { value: string; count: number };

export type CostStats = {
  // Overall, across every recorded benefaction cost.
  count: number;
  avg: number;
  total: number;
  min: number;
  max: number;
  // Broken down by benefaction type.
  byType: Array<{
    type: string;
    count: number;
    avg: number;
    total: number;
    min: number;
    max: number;
  }>;
};

export type DatingHistogramEntry = { bucket: string; count: number };

export type EpigraphyStats = {
  totalInscriptions: number;
  age: AgeAtDeathStats | null;
  nomen: FrequencyEntry[];
  cognomen: FrequencyEntry[];
  socialStatus: FrequencyEntry[];
  benefactionType: FrequencyEntry[];
  objectType: FrequencyEntry[];
  divinityType: FrequencyEntry[];
  province: FrequencyEntry[];
  place: FrequencyEntry[];
  cost: CostStats | null;
  datingHistogram: DatingHistogramEntry[];
};

const AGE_BUCKETS: Array<[string, (n: number) => boolean]> = [
  ["0–9", (n) => n < 10],
  ["10–19", (n) => n >= 10 && n < 20],
  ["20–29", (n) => n >= 20 && n < 30],
  ["30–39", (n) => n >= 30 && n < 40],
  ["40–49", (n) => n >= 40 && n < 50],
  ["50–59", (n) => n >= 50 && n < 60],
  ["60–69", (n) => n >= 60 && n < 70],
  ["70+", (n) => n >= 70],
];

function ageStats(rows: IndexRow[]): AgeAtDeathStats | null {
  const ages: number[] = [];
  for (const r of rows) {
    if (r.ageAtDeath) for (const a of r.ageAtDeath) if (Number.isFinite(a)) ages.push(a);
  }
  if (ages.length === 0) return null;
  const sum = ages.reduce((s, a) => s + a, 0);
  const under10 = ages.filter((a) => a < 10).length;
  const histogram = AGE_BUCKETS.map(([bucket, test]) => ({
    bucket,
    count: ages.filter(test).length,
  }));
  return {
    averageAge: sum / ages.length,
    count: ages.length,
    under10Count: under10,
    under10Percentage: (under10 / ages.length) * 100,
    histogram,
  };
}

// Generic per-inscription frequency: each distinct value in a row's array is
// counted once for that inscription, then summed across inscriptions and
// sorted by descending count.
function frequency(
  rows: IndexRow[],
  pick: (r: IndexRow) => string[] | undefined,
  limit?: number,
): FrequencyEntry[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const vals = pick(r);
    if (!vals || vals.length === 0) continue;
    const seen = new Set<string>();
    for (const v of vals) {
      if (!v) continue;
      seen.add(v);
    }
    for (const v of seen) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const out = Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return limit ? out.slice(0, limit) : out;
}

function nameFrequency(
  rows: IndexRow[],
  pick: (p: { nomen: string[]; cognomen: string[] }) => string[],
  limit?: number,
): FrequencyEntry[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const seen = new Set<string>();
    for (const p of r.personTuples) for (const k of pick(p)) if (k) seen.add(k);
    for (const k of seen) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out = Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return limit ? out.slice(0, limit) : out;
}

function summarize(values: number[]) {
  const count = values.length;
  const total = values.reduce((s, v) => s + v, 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { count, total, avg: total / count, min, max };
}

function costStats(rows: IndexRow[]): CostStats | null {
  const all: number[] = [];
  const byType = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.benefactionCosts) continue;
    for (const bc of r.benefactionCosts) {
      if (!Number.isFinite(bc.cost)) continue;
      all.push(bc.cost);
      const t = bc.type || "(unknown)";
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(bc.cost);
    }
  }
  if (all.length === 0) return null;
  const overall = summarize(all);
  const perType = Array.from(byType.entries())
    .map(([type, values]) => ({ type, ...summarize(values) }))
    .sort((a, b) => b.total - a.total);
  return { ...overall, byType: perType };
}

const DATING_BUCKET_SIZE = 100; // years

function datingHistogram(rows: IndexRow[]): DatingHistogramEntry[] {
  // Bucket each inscription by the midpoint of its dating range, in
  // 100-year bins. Inscriptions without dating are skipped.
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (r.datingFrom == null && r.datingTo == null) continue;
    const from = r.datingFrom ?? r.datingTo!;
    const to = r.datingTo ?? r.datingFrom!;
    const mid = (from + to) / 2;
    const bin = Math.floor(mid / DATING_BUCKET_SIZE) * DATING_BUCKET_SIZE;
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bin, count]) => ({
      bucket: `${bin} – ${bin + DATING_BUCKET_SIZE - 1}`,
      count,
    }));
}

export function computeStats(rows: IndexRow[]): EpigraphyStats {
  return {
    totalInscriptions: rows.length,
    age: ageStats(rows),
    nomen: nameFrequency(rows, (p) => p.nomen, 30),
    cognomen: nameFrequency(rows, (p) => p.cognomen, 30),
    socialStatus: frequency(rows, (r) => r.socialStatuses),
    benefactionType: frequency(rows, (r) => r.benefactionTypes),
    objectType: frequency(rows, (r) => r.objectTypes, 30),
    divinityType: frequency(rows, (r) => r.divinityTypes),
    province: frequency(rows, (r) => (r.province ? [r.province] : undefined)),
    place: frequency(rows, (r) => (r.place ? [r.place] : undefined), 30),
    cost: costStats(rows),
    datingHistogram: datingHistogram(rows),
  };
}
