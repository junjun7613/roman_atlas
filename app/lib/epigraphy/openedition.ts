// Deep-link helpers for OpenEdition Books. Their text pages anchor each
// paragraph as <span class="paranumber" id="para-N"> and each footnote as
// <a id="ftnN"> (both verified against books.openedition.org), so:
//   body mention → "#para-<startParagraph>"
//   note mention → "#ftn<noteNumber>"
//
// Shared by the 文献 tab (EpigraphyInfoPanel) and the RAG panel so both link to
// the exact spot in a publication the same way.

import type { LiteratureExcerpt } from "@/app/utils/sparql";

// Returns the OpenEdition base URL (no fragment) if `source` is an OpenEdition
// URL, else undefined.
export function openEditionBase(source: string | undefined): string | undefined {
  if (!source) return undefined;
  if (!/(?:^|\.)openedition\.org\//.test(source)) return undefined;
  return source.split("#")[0];
}

// Deep link to a body paragraph: "#para-N".
export function openEditionParagraphLink(
  source: string | undefined,
  paragraph: number | undefined,
): string | undefined {
  const base = openEditionBase(source);
  if (!base || paragraph == null) return undefined;
  return `${base}#para-${paragraph}`;
}

// Deep link to a footnote: "#ftnN".
export function openEditionFootnoteLink(
  source: string | undefined,
  noteNumber: number | undefined,
): string | undefined {
  const base = openEditionBase(source);
  if (!base || noteNumber == null) return undefined;
  return `${base}#ftn${noteNumber}`;
}

// Builds a deep link to the exact spot for one excerpt: a footnote anchor for
// note mentions, else the body paragraph anchor. Returns undefined when the
// source is not an OpenEdition URL or the relevant position number is missing.
export function openEditionLink(
  source: string | undefined,
  ex: LiteratureExcerpt,
): string | undefined {
  if (ex.locationType === "note") {
    return openEditionFootnoteLink(source, ex.noteNumber);
  }
  return openEditionParagraphLink(source, ex.startParagraph);
}
