import type { Catalog } from '../../domain/buildCatalog'
import { platformHref } from '../../lib/useHashRoute'

export function HomePage({ catalog }: { catalog: Catalog }) {
  return (
    <div>
      <header className="page-header">
        <h1>Manual de Switching</h1>
        <p className="lead">Elegí el equipo y después la tarea. Cada guía incluye riesgos, verificación y vuelta atrás.</p>
      </header>
      <ul className="cards">
        {catalog.platforms.map((platform) => {
          const guides = catalog.procedures.filter((procedure) => procedure.platform === platform.id).length
          return (
            <li key={platform.id}>
              <a className="card" href={platformHref(platform.id)}>
                <strong>{platform.name}</strong>
                <span>
                  {platform.vendor} · {platform.os}
                </span>
                <span className="muted">{guides === 1 ? '1 guía' : `${guides} guías`}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
