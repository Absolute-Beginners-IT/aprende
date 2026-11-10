import { figures } from '../content/figures'
import type { Figure } from '../domain/schema'

/** The drawing of a step, read out by its description; the SVG comes from the repository's own content files. */
export function StepFigure({ figure }: { figure: Figure }) {
  const svg = figures[figure.id]
  if (!svg) return null
  return (
    <figure className="step-figure">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG from content/figures, inlined to follow the theme. */}
      <div className="step-figure__img" role="img" aria-label={figure.alt} dangerouslySetInnerHTML={{ __html: svg }} />
      {figure.caption && <figcaption>{figure.caption}</figcaption>}
    </figure>
  )
}
