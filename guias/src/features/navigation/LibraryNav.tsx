import { useId } from 'react'
import type { Catalog } from '../../domain/buildCatalog'
import { DEVICE_TYPES, type DeviceType } from '../../domain/schema'
import { fundamentalsHref, platformHref, type Route, statusHref } from '../../lib/useHashRoute'
import { FundamentalsNav } from '../fundamentals/FundamentalsNav'
import { DEVICE_TYPE_LABELS } from '../labels'
import { TaskNav } from './TaskNav'

interface LibraryNavProps {
  catalog: Catalog
  route: Route
  /** Brand whose tasks are listed: the one in the address, or the last one used. */
  activePlatform: string
}

interface DeviceTypeGroupProps {
  type: DeviceType
  catalog: Catalog
  route: Route
  /** Brand shown open, with its tasks; none on the fundamentals pages. */
  expanded?: string
}

function DeviceTypeGroup({ type, catalog, route, expanded }: DeviceTypeGroupProps) {
  const headingId = useId()
  const platforms = catalog.platforms.filter((platform) => platform.deviceType === type)
  const onSheet = (platform: string) => route.name === 'platform' && route.platform === platform

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset groups form controls; this groups links by device type.
    <div role="group" className="library-nav__type" aria-labelledby={headingId}>
      <p id={headingId} className="library-nav__heading">
        {DEVICE_TYPE_LABELS[type]}
      </p>
      {platforms.length === 0 ? (
        <p className="library-nav__soon">Próximamente</p>
      ) : (
        // biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none.
        <ul role="list">
          {platforms.map((platform) => (
            <li key={platform.id}>
              <a
                className={
                  platform.id === expanded ? 'library-nav__brand library-nav__brand--open' : 'library-nav__brand'
                }
                href={platformHref(platform.id)}
                aria-current={onSheet(platform.id) ? 'page' : undefined}
              >
                {platform.name}
              </a>
              {platform.id === expanded && (
                <TaskNav
                  catalog={catalog}
                  platform={platform.id}
                  task={route.name === 'runbook' ? route.task : undefined}
                  onSheet={onSheet(platform.id)}
                  withSheet={false}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Sidebar of the guides inside the website: the library by device type, then brand, then task. */
export function LibraryNav({ catalog, route, activePlatform }: LibraryNavProps) {
  const article = route.name === 'fundamental' ? route.article : undefined
  const onFundamentals = route.name === 'fundamentals' || article !== undefined
  // Only one branch of the tree is open at a time: on the fundamentals pages it is theirs.
  const expanded = onFundamentals ? undefined : activePlatform

  return (
    <nav className="library-nav" aria-label="Biblioteca">
      {DEVICE_TYPES.map((type) => (
        <DeviceTypeGroup key={type} type={type} catalog={catalog} route={route} expanded={expanded} />
      ))}
      <div className="library-nav__more">
        <a
          className="library-nav__brand"
          href={fundamentalsHref()}
          aria-current={route.name === 'fundamentals' ? 'page' : undefined}
        >
          Fundamentos
        </a>
        {onFundamentals && <FundamentalsNav articles={catalog.fundamentals} article={article} nested />}
        <a className="library-nav__brand" href={statusHref} aria-current={route.name === 'status' ? 'page' : undefined}>
          Estado del contenido
        </a>
      </div>
    </nav>
  )
}
