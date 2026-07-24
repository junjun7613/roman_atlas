// Shared formatting for feeding an inscription's scholarly literature into the
// RAG context. Used by both the client (single-inscription mode, in
// EpigraphyRagPanel) and the server (multi-inscription mode, in the
// /api/rag/chat-by-edcs route), so the [REF-N] token scheme and deep links stay
// identical across both paths.

import type { LiteratureReference } from "@/app/utils/sparql";
import { openEditionBase, openEditionLink } from "./openedition";

// A resolved reference link the model can cite via its [REF-N] token.
export interface RefLink {
  url: string;
  label: string;
}

// Relation-type local names → readable labels for the literature passed to RAG.
const REL_TYPE_LABELS: Record<string, string> = {
  transcription: "transcription",
  translation: "translation",
  contentDescription: "content description",
  detailedAnalysis: "detailed analysis",
  dating: "dating",
  provenance: "provenance",
  citationOnly: "citation only",
  discovererPublisher: "discoverer/publisher",
  textualCriticism: "textual criticism",
  crossCorpusIdentification: "cross-corpus identification",
  figureReference: "figure reference",
};

// Caps that keep the literature block bounded regardless of how many
// inscriptions are in scope. In multi-inscription mode the RAG context already
// holds up to 20 inscriptions; without caps their combined literature could
// dwarf the inscription text and blow up the prompt. Excerpts are the main
// driver of size, so we cap per-work excerpts most tightly.
export const MAX_WORKS_PER_INSCRIPTION = 6;
export const MAX_EXCERPTS_PER_WORK = 8;
export const MAX_EXCERPT_CHARS = 600;

// Formats one inscription's literature references into a plain-text block for
// the RAG context, plus a map of [REF-N] tokens → deep links. `tokenOffset`
// lets a caller number tokens continuously across several inscriptions (so the
// second inscription's first work is [REF-<offset+1>], not another [REF-1]).
//
// Each citing work gets a stable [REF-N] token the model is told to cite. The
// token's link is the work's most specific OpenEdition anchor: the paragraph or
// footnote of its first positioned excerpt, else the work's base URL, else its
// raw source URL. The client later turns the tokens the model emitted back into
// clickable links.
//
// Returns the block, the token→link map, and the next free token index so a
// caller formatting several inscriptions can thread it through.
export function formatLiteratureForRag(
  refs: LiteratureReference[],
  tokenOffset = 0,
): {
  context: string;
  refLinks: Record<string, RefLink>;
  nextToken: number;
} {
  const refLinks: Record<string, RefLink> = {};
  if (refs.length === 0) {
    return { context: "", refLinks, nextToken: tokenOffset };
  }

  let token = tokenOffset;
  const cappedRefs = refs.slice(0, MAX_WORKS_PER_INSCRIPTION);
  const blocks = cappedRefs.map((ref) => {
    token += 1;
    const tok = `REF-${token}`;
    const header = [
      ref.title,
      ref.creator,
      ref.containerTitle ? `in: ${ref.containerTitle}` : null,
      ref.pages ? `pp. ${ref.pages}` : null,
    ]
      .filter(Boolean)
      .join(" / ");

    // Pick the deepest available link for this work: first excerpt with a
    // resolvable OpenEdition position, else the base page, else the source.
    let url: string | undefined;
    for (const ex of ref.excerpts) {
      const deep = openEditionLink(ref.source, ex);
      if (deep) {
        url = deep;
        break;
      }
    }
    if (!url) url = openEditionBase(ref.source) ?? ref.source;
    if (url) {
      refLinks[tok] = { url, label: header || ref.title || tok };
    }

    const excerpts = ref.excerpts
      .slice(0, MAX_EXCERPTS_PER_WORK)
      .map((ex) => {
        const label = REL_TYPE_LABELS[ex.relType] ?? ex.relType;
        const ref_ = ex.rawRef ? ` (${ex.rawRef})` : "";
        const text =
          ex.text.length > MAX_EXCERPT_CHARS
            ? ex.text.slice(0, MAX_EXCERPT_CHARS) + "…"
            : ex.text;
        return `  - [${label}]${ref_} ${text}`;
      })
      .join("\n");

    return `[${tok}] Work: ${header || "(no bibliographic info)"}\n${excerpts}`;
  });

  return { context: blocks.join("\n\n"), refLinks, nextToken: token };
}
