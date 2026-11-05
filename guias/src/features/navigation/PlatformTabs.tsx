import type { Catalog } from '../../domain/buildCatalog'
import { platformHref, runbookHref } from '../../lib/useHashRoute'

interface PlatformTabsProps {
  catalog: Catalog
  activePlatform: string
  /** Task currently open, if any, so that switching brand keeps the user on it. */
  task?: string
}

export function PlatformTabs({ catalog, activePlatform, task }: PlatformTabsProps) {
  const hasTask = (platform: string) =>
    catalog.procedures.some((procedure) => procedure.platform === platform && procedure.task === task)

  // Brands of the same kind of device as the one open: a firewall is not an alternative to a switch.
  const deviceType = catalog.platforms.find((platform) => platform.id === activePlatform)?.deviceType
  const platforms = catalog.platforms.filter((platform) => !deviceType || platform.deviceType === deviceType)

  return (
    <nav className="brand-tabs" aria-label="Marcas">
      {platforms.map((platform) => (
        <a
          key={platform.id}
          href={task && hasTask(platform.id) ? runbookHref(platform.id, task) : platformHref(platform.id)}
          aria-current={platform.id === activePlatform ? 'page' : undefined}
        >
          {platform.name}
        </a>
      ))}
    </nav>
  )
}
