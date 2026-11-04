import type { Catalog } from '../../domain/buildCatalog'
import { DEVICE_TYPES, type DeviceType } from '../../domain/schema'
import { fundamentalsHref, platformHref, statusHref } from '../../lib/useHashRoute'
import { DEVICE_TYPE_LABELS } from '../labels'
import type { RunbookHit } from '../navigation/searchIndex'
import { RecentRunbooks } from './HomePage'

const count = (amount: number, one: string, many: string) => `${amount} ${amount === 1 ? one : many}`

function DeviceTypeCard({ type, catalog }: { type: DeviceType; catalog: Catalog }) {
  const platforms = catalog.platforms.filter((platform) => platform.deviceType === type)
  const guidesOf = (platform: string) => catalog.procedures.filter((item) => item.platform === platform)
  const tasks = new Set(platforms.flatMap((platform) => guidesOf(platform.id).map((item) => item.task)))

  if (platforms.length === 0) {
    return (
      <li className="library-card library-card--soon">
        <h2>{DEVICE_TYPE_LABELS[type]}</h2>
        <p className="library-card__meta">Próximamente</p>
      </li>
    )
  }

  return (
    <li className="library-card">
      <h2>{DEVICE_TYPE_LABELS[type]}</h2>
      <p className="library-card__meta">
        {count(platforms.length, 'marca', 'marcas')} · {count(tasks.size, 'tarea', 'tareas')}
      </p>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none. */}
      <ul role="list">
        {platforms.map((platform) => (
          <li key={platform.id}>
            <a href={platformHref(platform.id)}>
              <strong>{platform.name}</strong> <span>{count(guidesOf(platform.id).length, 'guía', 'guías')}</span>
            </a>
          </li>
        ))}
      </ul>
    </li>
  )
}

/** Home page of the guides inside the website: the library by device type. */
export function LibraryHome({ catalog, recents }: { catalog: Catalog; recents: RunbookHit[] }) {
  return (
    <div>
      <header className="page-header">
        <h1>Guías</h1>
        <p className="lead">
          Procedimientos para configurar paso a paso cada elemento de una infraestructura, con sus riesgos, cómo
          verificarlo y cómo volver atrás. Ábrelos desde la ficha de un equipo en «Mi infraestructura» y se rellenarán
          con sus valores.
        </p>
      </header>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none. */}
      <ul role="list" className="library-cards" aria-label="Tipos de equipo">
        {DEVICE_TYPES.map((type) => (
          <DeviceTypeCard key={type} type={type} catalog={catalog} />
        ))}
      </ul>
      <RecentRunbooks recents={recents} />
      <p>
        ¿Empiezas de cero? Lee primero los <a href={fundamentalsHref()}>fundamentos</a>: qué es un switch, cómo se
        gestiona y qué marcas hay.
      </p>
      <p>
        Consulta en el <a href={statusHref}>estado del contenido</a> qué guías están contrastadas y cuáles faltan por
        probar.
      </p>
    </div>
  )
}
