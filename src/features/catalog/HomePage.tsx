import { useId } from 'react'
import { fundamentalsHref, runbookHref } from '../../lib/useHashRoute'
import type { RunbookHit } from '../navigation/searchIndex'

export function HomePage({ recents }: { recents: RunbookHit[] }) {
  const recentsId = useId()

  return (
    <div>
      <header className="page-header">
        <h1>Manual de Switching</h1>
        <p className="lead">
          Elegí la marca arriba y la tarea en el lateral, o buscá con Ctrl K. Cada guía incluye riesgos, verificación y
          vuelta atrás.
        </p>
        <p>
          ¿Empezás de cero? Leé primero los <a href={fundamentalsHref()}>fundamentos</a>: qué es un switch, cómo se
          gestiona y qué marcas hay.
        </p>
      </header>
      {recents.length > 0 && (
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
      )}
    </div>
  )
}
