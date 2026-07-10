'use client'

import { useMemo } from 'react'
import type { AtagText, AtagAnnotation } from '@/app/utils/sparql'

// Renders ATAG annotated epigraphic text the way the standalone
// viewer_epigraph.html does: line numbers pulled from "line" annotations, and
// inline styling for expansions, abbreviations, expanded forms, supplied text
// (wrapped in [ ... ]) and gaps.
//
// IMPORTANT — why per-character wrapping instead of nested spans:
// The viewer builds its markup by string-concatenation, opening a <span> at
// each annotation's start and closing it at its end. Annotations can OVERLAP
// (A = [0,5), B = [2,8) → the emitted HTML crosses tags: <A>..<B>..</A>..</B>),
// which the browser silently repairs but is impossible to express as a JSX
// tree. If we instead push onto a stack, an overlap corrupts the nesting and
// the text renders out of order — the bug reported here.
//
// The faithful, order-preserving equivalent is to give every character the set
// of annotation kinds covering it (exactly what annotMap holds per offset) and
// wrap the character in one span carrying all those classes. Adjacent
// characters with the same set are coalesced into one span. The supplied
// brackets [ ] are emitted once at the span's boundaries, matching the viewer.

type Props = {
  data: AtagText
}

const KIND_LABELS: Record<string, string> = {
  expan: '略語展開',
  abbr: '省略形',
  ex: '展開形',
  supplied: '補完',
  gap: '欠損',
}

// Order in which kinds are applied to a character's className, so repeated
// spans are visually consistent regardless of annotation insertion order.
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

export default function AnnotatedText({ data }: Props) {
  const { lines, lineCount } = useMemo(() => {
    const { content, annotations } = data

    const lineAnnotations = annotations
      .filter((a) => a.kind === 'line')
      .sort((a, b) => a.start - b.start)

    // For each offset, the non-line annotations covering it — the same map the
    // viewer builds.
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

    // Precompute, per character, the sorted list of kinds and the covering
    // annotations, so we can coalesce runs with an identical annotation set.
    const setKey = (annots: AtagAnnotation[]) =>
      annots
        .map((a) => a.kind)
        .sort((x, y) => KIND_ORDER.indexOf(x) - KIND_ORDER.indexOf(y))
        .join('|')

    const built: { n: string | null; segments: React.ReactNode[] }[] = []
    let keySeq = 0

    for (let li = 0; li < lineStarts.length; li++) {
      const start = lineStarts[li].start
      const end =
        li + 1 < lineStarts.length ? lineStarts[li + 1].start : content.length

      const segments: React.ReactNode[] = []
      let runStart = start
      let runKey: string | null = null
      let runAnnots: AtagAnnotation[] = []

      const flushRun = (runEnd: number) => {
        if (runStart >= runEnd) return
        // Build the run's text, converting newlines to spaces (within a line the
        // raw \n is display-only whitespace, as in the viewer).
        let textRun = ''
        for (let k = runStart; k < runEnd; k++) {
          const c = content[k]
          textRun += c === '\n' ? ' ' : c
        }

        if (runAnnots.length === 0) {
          segments.push(<span key={`t-${keySeq++}`}>{textRun}</span>)
        } else {
          // Supplied text is bracketed [ ... ], but the brackets belong to the
          // whole supplied SPAN, not to each run. A supplied range can be split
          // into several runs by overlapping expan/abbr/ex annotations, so emit
          // "[" only on the run that starts the supplied range and "]" only on
          // the run that ends it — otherwise every sub-run gets its own pair
          // ([Lucillae][ ][Aug]…) instead of one [Lucillae Aug(ustae) ].
          const supplied = runAnnots.find((a) => a.kind === 'supplied')
          const openBracket = supplied && runStart === supplied.start
          const closeBracket = supplied && runEnd === supplied.end
          const classes = runAnnots
            .map((a) => a.kind)
            .sort((x, y) => KIND_ORDER.indexOf(x) - KIND_ORDER.indexOf(y))
            .map((k) => `atag-${k}`)
            .join(' ')
          segments.push(
            <span
              key={`a-${keySeq++}`}
              className={`atag-annotation ${classes}`}
              title={labelFor(runAnnots)}
            >
              {openBracket ? '[' : ''}
              {textRun}
              {closeBracket ? ']' : ''}
            </span>,
          )
        }
      }

      for (let i = start; i < end; i++) {
        const annots = annotMap.get(i) ?? []
        const key = setKey(annots)
        if (runKey === null) {
          runKey = key
          runAnnots = annots
          runStart = i
        } else if (key !== runKey) {
          flushRun(i)
          runKey = key
          runAnnots = annots
          runStart = i
        }
      }
      flushRun(end)

      built.push({ n: lineStarts[li].n, segments })
    }

    return { lines: built, lineCount: lineAnnotations.length }
  }, [data])

  return (
    <div className="atag-text-viewer">
      <div className="atag-text-content">
        {lines.map((line, i) => (
          <div key={`line-${i}`} className="atag-text-line">
            {line.n != null && (
              <span className="atag-line-number">{line.n}</span>
            )}
            {line.segments}
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
