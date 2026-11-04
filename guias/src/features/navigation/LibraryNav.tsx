import { useEffect, useId, useState } from 'react'
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
  /** Brands whose tasks are shown. */
  open: Set<string>
  onToggle: (platform: string) => void
}

function DeviceTypeGroup({ type, catalog, route, open, onToggle }: DeviceTypeGroupProps) {
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
              <div className="library-nav__row">
                {/* The name opens the brand's sheet; this button only folds or unfolds its tasks. */}
                <button
                  type="button"
                  className="library-nav__fold"
                  aria-expanded={open.has(platform.id)}
                  aria-label={`Tareas de ${platform.name}`}
                  onClick={() => onToggle(platform.id)}
                />
                <a
                  className="library-nav__brand"
                  href={platformHref(platform.id)}
                  aria-current={onSheet(platform.id) ? 'page' : undefined}
                >
                  {platform.name}
                </a>
              </div>
              {open.has(platform.id) && (
                <TaskNav
                  catalog={catalog}
                  platform={platform.id}
                  task={route.name === 'runbook' && route.platform === platform.id ? route.task : undefined}
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
  // The brand in use opens on its own (not on the fundamentals pages); the user folds or unfolds any brand after that.
  const expanded = onFundamentals ? undefined : activePlatform
  const [open, setOpen] = useState(() => new Set(expanded ? [expanded] : []))
  useEffect(() => {
    if (expanded) setOpen((current) => (current.has(expanded) ? current : new Set(current).add(expanded)))
  }, [expanded])
  const toggle = (platform: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(platform)) next.add(platform)
      return next
    })

  return (
    <nav className="library-nav" aria-label="Biblioteca">
      {DEVICE_TYPES.map((type) => (
        <DeviceTypeGroup key={type} type={type} catalog={catalog} route={route} open={open} onToggle={toggle} />
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
