import { useId } from 'react'
import { fundamentalsHref, runbookHref, statusHref } from '../../lib/useHashRoute'
import type { RunbookHit } from '../navigation/searchIndex'

/** The runbooks opened most recently, newest first; nothing until the user opens one. */
export function RecentRunbooks({ recents }: { recents: RunbookHit[] }) {
  const recentsId = useId()
  if (recents.length === 0) return null

  return (
    <section className="section">
      <h2 id={recentsId}>Recientes</h2>
      <ul className="recents" aria-labelledby={recentsId}>
        {recents.map((hit) => (
          <li key={`${hit.platform}/${hit.task}`}>
            <a href={runbookHref(hit.platform, hit.task)}>
              <strong>{hit.title}</strong> <span>{hit.platformName}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HomePage({ recents }: { recents: RunbookHit[] }) {
  return (
    <div>
      <header className="page-header">
        <h1>Manual de Switching</h1>
        <p className="lead">
          Elige la marca arriba y la tarea en el lateral, o busca con Ctrl K. Cada guía incluye riesgos, verificación y
          vuelta atrás.
        </p>
        <p>
          ¿Empiezas de cero? Lee primero los <a href={fundamentalsHref()}>fundamentos</a>: qué es un switch, cómo se
          gestiona y qué marcas hay.
        </p>
        <p>
          Consulta en el <a href={statusHref}>estado del contenido</a> qué guías están contrastadas y cuáles faltan por
          probar.
        </p>
      </header>
      <RecentRunbooks recents={recents} />
    </div>
  )
}
