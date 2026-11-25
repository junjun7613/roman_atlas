"use client";

import type {
  AssessmentAct,
  AssessmentStatus,
  InscriptionAssessment,
} from "@/app/utils/sparql";

// Read-only display of the himiko assessment layer (see queryAssessment).

const STATUS_LABEL: Record<string, string> = {
  llm_judged: "LLM-judged",
  unassessed: "Unassessed",
};

const pill =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap";

function statusClass(status: string) {
  return status === "unassessed"
    ? "border-border bg-muted text-muted-foreground"
    : "border-emerald-300 bg-emerald-50 text-emerald-800";
}

const STALE_CLASS = "border-amber-300 bg-amber-50 text-amber-800";

function label(status: string) {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

function formatDate(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function ActDetails({ act }: { act: AssessmentAct }) {
  const rows: [string, string | undefined][] = [
    ["Type", act.type],
    ["Outcome", act.outcome],
    ["Judges", act.agents.join(", ") || undefined],
    ["Date", formatDate(act.date)],
    ["Criterion", act.criterion],
  ];
  return (
    <div className={act.current ? "" : "opacity-70"}>
      <div className="mb-1 flex items-center gap-1.5 font-semibold">
        {act.current ? "Current assessment" : "Superseded assessment"}
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

// Header badge for the inscription: status (+ outcome) and a stale marker,
// with the assessment act(s) in a hover/focus popover.
export function InscriptionAssessmentBadge({
  assessment,
  loading,
}: {
  assessment: InscriptionAssessment | null;
  loading: boolean;
}) {
  if (loading) {
    return <span className={`${pill} border-border text-muted-foreground`}>Assessment…</span>;
  }
  const st = assessment?.inscription;
  if (!st) return null;

  const currentAct = assessment.acts.find((a) => a.current);
  const hasDetails = assessment.acts.length > 0;

  return (
    <span className="group relative inline-flex items-center gap-1" tabIndex={hasDetails ? 0 : -1}>
      <span className={`${pill} ${statusClass(st.status)}`}>
        {label(st.status)}
        {st.status !== "unassessed" && currentAct?.outcome && (
          <span className="font-normal opacity-80">· {currentAct.outcome}</span>
        )}
      </span>
      {st.stale && (
        <span className={`${pill} ${STALE_CLASS}`} title={`Previously ${label(st.stale)}; that judgement no longer applies`}>
          Stale: {label(st.stale)}
        </span>
      )}
      {hasDetails && (
        <span
          role="tooltip"
          className="invisible absolute left-0 top-full z-10 mt-1 w-80 rounded border border-border bg-card p-3 text-[11px] font-normal text-foreground shadow-lg group-hover:visible group-focus:visible flex flex-col gap-2"
        >
          {assessment.acts.map((a) => (
            <ActDetails key={a.uri} act={a} />
          ))}
        </span>
      )}
    </span>
  );
}

// Small status line for the selected node / relationship edge. Entities only
// carry a status once their inscription has been through an assessment run,
// so a missing record renders nothing (the header badge already says
// "Unassessed").
export function EntityAssessmentBadge({ status }: { status?: AssessmentStatus }) {
  if (!status) return null;
  return (
    <div className="mt-2 shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
      Assessment:
      <span className={`${pill} ${statusClass(status.status)}`}>{label(status.status)}</span>
      {status.stale && (
        <span className={`${pill} ${STALE_CLASS}`}>Stale: {label(status.stale)}</span>
      )}
    </div>
  );
}
