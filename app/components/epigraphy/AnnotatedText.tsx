'use client'

import { useMemo } from 'react'
import type { AtagText, AtagAnnotation } from '@/app/utils/sparql'

// Renders ATAG annotated epigraphic text the way the standalone
// viewer_epigraph.html does: line numbers pulled from "line" annotations, and
// inline styling for expansions, abbreviations, expanded forms, supplied text
// (wrapped in [ ... ]) and gaps.
//
// IMPORTANT — why PER-CHARACTER wrapping:
// Two constraints force one <span> per character (rather than one per run of
// identically-annotated characters):
//   1. Annotations can OVERLAP (A = [0,5), B = [2,8) → the emitted HTML would
//      cross tags), which is impossible to express as a JSX tree; giving each
//      character the *set* of kinds covering it sidesteps nesting entirely.
//   2. The text↔node highlight (from linkings) needs to light up an ARBITRARY
//      character range, so every character must be individually addressable via
//      data-offset and independently class-toggleable.
// Adjacent characters with the same annotation set still look continuous — the
// per-character split is invisible except that supplied brackets [ ] are drawn
// once at the range's boundary characters, matching the viewer.

type Props = {
  data: AtagText
  // Character offsets to highlight (the range(s) linked to the currently
  // active network node). null / empty → nothing highlighted.
  highlightOffsets?: Set<number> | null
}

const KIND_LABELS: Record<string, string> = {
  expan: '略語展開',
  abbr: '省略形',
  ex: '展開形',
  supplied: '補完',
  gap: '欠損',
}

// Order in which kinds are applied to a character's className, so repeated
// characters render consistently regardless of annotation insertion order.
const KIND_ORDER = ['expan', 'abbr', 'ex', 'supplied', 'gap']

function labelFor(annots: AtagAnnotation[]): string {
  return annots
    .map((a) => {
      let l = KIND_LABELS[a.kind] ?? a.kind
      if (a.annotText) l += `: ${a.annotText}`
      return l
    })
    .join(', ')
}

export default function AnnotatedText({ data, highlightOffsets }: Props) {
  // Structure only depends on the data — the per-character annotation sets and
  // line grouping. Highlighting is applied at render time (below) so hovering /
  // clicking a node doesn't rebuild this.
  const { lines, lineCount } = useMemo(() => {
    const { content, annotations } = data

    const lineAnnotations = annotations
      .filter((a) => a.kind === 'line')
      .sort((a, b) => a.start - b.start)

    // For each offset, the non-line annotations covering it.
    const annotMap = new Map<number, AtagAnnotation[]>()
    for (const annot of annotations) {
      if (annot.kind === 'line') continue
      for (let i = annot.start; i < annot.end; i++) {
        const list = annotMap.get(i) ?? []
        list.push(annot)
        annotMap.set(i, list)
      }
    }

    // Group characters into lines. A line starts at each "line" annotation's
    // start offset; text before the first line annotation forms an implicit
    // leading line with no number.
    type LineData = { n: string | null; start: number }
    const lineStarts: LineData[] = lineAnnotations.map((a) => ({
      n: a.n,
      start: a.start,
    }))
    if (lineStarts.length === 0 || lineStarts[0].start > 0) {
      lineStarts.unshift({ n: null, start: 0 })
    }

    // Per line, the list of characters with everything the highlight/render
    // step needs: the offset, the display char, the annotation classes, the
    // covering annotations (for the title), and whether a supplied bracket
    // opens/closes at this character.
    type CharCell = {
      offset: number
      display: string
      classes: string
      title: string
      openBracket: boolean
      closeBracket: boolean
    }

    const built: { n: string | null; cells: CharCell[] }[] = []

    for (let li = 0; li < lineStarts.length; li++) {
      const start = lineStarts[li].start
      const end =
        li + 1 < lineStarts.length ? lineStarts[li + 1].start : content.length

      const cells: CharCell[] = []
      for (let i = start; i < end; i++) {
        const annots = annotMap.get(i) ?? []
        // Within a line, newlines are display-only whitespace.
        const c = content[i]
        const display = c === '\n' ? ' ' : c

        const sorted = [...annots].sort(
          (x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind),
        )
        const classes = sorted.map((a) => `atag-${a.kind}`).join(' ')

        // Supplied brackets belong to the whole supplied span, drawn once at its
        // first / last character (viewer parity: [Lucillae Aug(ustae) ]).
        const supplied = annots.find((a) => a.kind === 'supplied')

        cells.push({
          offset: i,
          display,
          classes,
          title: annots.length ? labelFor(sorted) : '',
          openBracket: !!supplied && i === supplied.start,
          closeBracket: !!supplied && i === supplied.end - 1,
        })
      }
      built.push({ n: lineStarts[li].n, cells })
    }

    return { lines: built, lineCount: lineAnnotations.length }
  }, [data])

  const hasHighlight = !!highlightOffsets && highlightOffsets.size > 0

  return (
    <div className="atag-text-viewer">
      <div className="atag-text-content">
        {lines.map((line, i) => (
          <div key={`line-${i}`} className="atag-text-line">
            {line.n != null && (
              <span className="atag-line-number">{line.n}</span>
            )}
            {line.cells.map((cell) => {
              const highlighted =
                hasHighlight && highlightOffsets!.has(cell.offset)
              const className = [
                'atag-char',
                cell.classes,
                highlighted ? 'atag-linked-highlight' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <span
                  key={cell.offset}
                  className={className}
                  data-offset={cell.offset}
                  title={cell.title || undefined}
                >
                  {cell.openBracket ? '[' : ''}
                  {cell.display}
                  {cell.closeBracket ? ']' : ''}
                </span>
              )
            })}
          </div>
        ))}
      </div>

      <div className="atag-stats">
        <span>
          <span className="font-semibold">文字数:</span> {data.content.length}
        </span>
        <span>
          <span className="font-semibold">アノテーション数:</span>{' '}
          {data.annotations.length}
        </span>
        <span>
          <span className="font-semibold">行数:</span> {lineCount}
        </span>
      </div>

      <div className="atag-legend">
        <span className="atag-legend-item">
          <span className="atag-legend-color atag-line">1</span> 行番号
        </span>
        <span className="atag-legend-item">
          <span className="atag-legend-color atag-expan" /> 略語展開
        </span>
        <span className="atag-legend-item">
          <span className="atag-legend-color atag-abbr">D</span> 省略形
        </span>
        <span className="atag-legend-item">
          <span className="atag-legend-color atag-supplied">[ ]</span> 補完
        </span>
        <span className="atag-legend-item">
          <span className="atag-legend-color atag-gap">[---]</span> 欠損
        </span>
      </div>
    </div>
  )
}
