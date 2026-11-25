"use client";

import type {
  AssessmentAct,
  AssessmentStatus,
  InscriptionAssessment,
} from "@/app/utils/sparql";

// Read-only display of the himiko assessment layer (see queryAssessment).
//
// Labels and definitions are copied from hmk_ontology
// ontology/hmk_owl/himiko_interpretation.ttl (rdfs:label @ja / rdfs:comment):
// they are not loaded into Fuseki, so they cannot be queried. Keep in sync
// when the vocabulary changes. Two separate axes (spec v1.1 §2.3):
//   status  — how far the current value has been checked
//   outcome — what the judges said about it

type Term = { label: string; comment: string; className: string };

const STATUS: Record<string, Term> = {
  unassessed: {
    label: "未評価",
    comment: "現在の値に対して有効な評価がない。",
    className: "border-border bg-muted text-muted-foreground",
  },
  llm_judged: {
    label: "LLM判定済み",
    comment: "現在の値が、指定されたすべての LLM judge によって判定されている。",
    className: "border-sky-300 bg-sky-50 text-sky-800",
  },
  human_reviewed: {
    label: "人手確認済み",
    comment: "現在の値を人が確認し、判定を記録している。",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  human_corrected: {
    label: "人手校訂済み",
    comment: "現在の値が人の校訂によって入力されたものである。",
    className: "border-violet-300 bg-violet-50 text-violet-800",
  },
};

// Most severe first (major_incorrect > … > no_finding).
const OUTCOME: Record<string, Term> = {
  major_incorrect: {
    label: "重大・誤り",
    comment: "重大とした judge がすべて「誤り」と判定した。",
    className: "border-red-300 bg-red-50 text-red-800",
  },
  major_mixed: {
    label: "重大・判定が混在",
    comment: "2 つ以上の judge が重大としたが、判定の種類 (誤り・判断不能・抜け) が分かれた。",
    className: "border-orange-300 bg-orange-50 text-orange-800",
  },
  major_omission: {
    label: "重大・抜け",
    comment: "重大とした judge がすべて「抜けている」と判定した。",
    className: "border-orange-300 bg-orange-50 text-orange-800",
  },
  major_uncertain: {
    label: "重大・判断不能",
    comment: "重大とした judge がすべて「判断できない」と判定した。誤りとは限らない。",
    className: "border-amber-300 bg-amber-50 text-amber-800",
  },
  major_single: {
    label: "重大・1 judge のみ",
    comment: "重大とした judge が 1 つだけだった。",
    className: "border-amber-300 bg-amber-50 text-amber-800",
  },
  minor: {
    label: "軽微",
    comment: "軽微 (minor) な指摘のみがあった。",
    className: "border-yellow-300 bg-yellow-50 text-yellow-800",
  },
  no_finding: {
    label: "指摘なし",
    comment: "どの judge も問題を報告しなかった。正しいと確認したことを意味しない。",
    className: "border-border bg-muted text-muted-foreground",
  },
};

const STALE_CLASS = "border-amber-300 bg-amber-50 text-amber-800";
const FALLBACK_CLASS = "border-border bg-muted text-muted-foreground";

const pill =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap";

const statusTerm = (s: string) => STATUS[s];
const statusLabel = (s: string) => statusTerm(s)?.label ?? s.replace(/_/g, " ");
const outcomeLabel = (o: string) => OUTCOME[o]?.label ?? o.replace(/_/g, " ");

function StatusPill({ status }: { status: string }) {
  const t = statusTerm(status);
  return (
    <span className={`${pill} ${t?.className ?? FALLBACK_CLASS}`} title={t?.comment}>
      {statusLabel(status)}
    </span>
  );
}

function OutcomePill({ outcome }: { outcome: string }) {
  const t = OUTCOME[outcome];
  return (
    <span className={`${pill} ${t?.className ?? FALLBACK_CLASS}`} title={t?.comment}>
      判定: {outcomeLabel(outcome)}
    </span>
  );
}

function StalePill({ stale }: { stale: string }) {
  return (
    <span
      className={`${pill} ${STALE_CLASS}`}
      title={`評価後に値が変わったため失効した評価状態（${statusLabel(stale)}）`}
    >
      失効: {statusLabel(stale)}
    </span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function ActDetails({ act }: { act: AssessmentAct }) {
  const rows: [string, string | undefined][] = [
    ["種類", act.type],
    ["判定結果", act.judgeOutcome && outcomeLabel(act.judgeOutcome)],
    ["区分", act.tier],
    ["Judge", act.agents.join(", ") || undefined],
    ["日時", formatDate(act.date)],
    ["基準", act.criterion],
  ];
  return (
    <div className={act.current ? "" : "opacity-70"}>
      <div className="mb-1 font-semibold">
        {act.current ? "有効な評価" : "失効した評価"}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

// Header badge for the inscription: status, judge outcome and a stale marker,
// with the assessment act(s) in a hover/focus popover.
export function InscriptionAssessmentBadge({
  assessment,
  loading,
}: {
  assessment: InscriptionAssessment | null;
  loading: boolean;
}) {
  if (loading) {
    return <span className={`${pill} border-border text-muted-foreground`}>評価状態…</span>;
  }
  const st = assessment?.inscription;
  if (!st) return null;
  const hasDetails = assessment.acts.length > 0;

  return (
    <span className="group relative inline-flex items-center gap-1" tabIndex={hasDetails ? 0 : -1}>
      <StatusPill status={st.status} />
      {st.outcome && <OutcomePill outcome={st.outcome} />}
      {st.stale && <StalePill stale={st.stale} />}
      {hasDetails && (
        <span
          role="tooltip"
          className="invisible absolute left-0 top-full z-10 mt-1 w-80 rounded border border-border bg-card p-3 text-[11px] font-normal text-foreground shadow-lg group-hover:visible group-focus:visible flex flex-col gap-2"
        >
          {assessment.acts.map((a) => (
            <ActDetails key={a.uri} act={a} />
          ))}
          {st.outcome === "no_finding" && (
            <p className="text-muted-foreground">
              「指摘なし」は正しいと確認したことを意味しません。
            </p>
          )}
        </span>
      )}
    </span>
  );
}

// Status line for the selected node / relationship edge. Entities only carry
// a status once their inscription has been assessed, so a missing record
// renders nothing (the header badge already says 未評価).
export function EntityAssessmentBadge({ status }: { status?: AssessmentStatus }) {
  if (!status) return null;
  return (
    <div className="mt-2 shrink-0 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      評価:
      <StatusPill status={status.status} />
      {status.outcome && <OutcomePill outcome={status.outcome} />}
      {status.stale && <StalePill stale={status.stale} />}
    </div>
  );
}
