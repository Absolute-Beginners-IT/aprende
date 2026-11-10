import type { CSSProperties } from 'react'
import { figures } from '../content/figures'
import type { Figure } from '../domain/schema'

/** Share of the drawing's own width a figure may take: its text stays close to the size it has on a real screen. */
const SCALE = 0.8

/** The width a figure may grow to, from the width of its SVG viewBox, or undefined if the viewBox cannot be read. */
function maxWidth(svg: string): string | undefined {
  const width = Number(/viewBox="\s*[\d.]+\s+[\d.]+\s+([\d.]+)/.exec(svg)?.[1])
  return width > 0 ? `${Math.round(width * SCALE)}px` : undefined
}

/** The drawing of a step, read out by its description; the SVG comes from the repository's own content files. */
export function StepFigure({ figure }: { figure: Figure }) {
  const svg = figures[figure.id]
  if (!svg) return null
  const width = maxWidth(svg)
  const style = width ? ({ '--ancho-figura': width } as CSSProperties) : undefined
  return (
    <figure className="step-figure">
      <div
        className="step-figure__img"
        role="img"
        aria-label={figure.alt}
        style={style}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG from content/figures, inlined to follow the theme.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {figure.caption && <figcaption>{figure.caption}</figcaption>}
    </figure>
  )
}
