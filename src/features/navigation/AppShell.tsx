import { type ReactNode, useEffect, useId, useState } from 'react'
import type { Catalog } from '../../domain/buildCatalog'
import type { Route } from '../../lib/useHashRoute'
import { PlatformTabs } from './PlatformTabs'
import { TaskNav } from './TaskNav'

interface AppShellProps {
  catalog: Catalog
  route: Route
  activePlatform: string
  children: ReactNode
}

/** Fixed frame around every page: brands on top, the brand's tasks on the side. */
export function AppShell({ catalog, route, activePlatform, children }: AppShellProps) {
  const sidebarId = useId()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const task = route.name === 'runbook' ? route.task : undefined
  const location = route.name === 'runbook' ? `${route.platform}/${route.task}` : route.name

  // On narrow screens the sidebar covers the page, so it closes once the user has picked something.
  useEffect(() => setSidebarOpen(false), [location, activePlatform])

  return (
    <div className="shell">
      <header className="shell__header">
        <a className="shell__title" href="#/">
          Manual de Switching
        </a>
        <PlatformTabs catalog={catalog} activePlatform={activePlatform} task={task} />
        <button
          type="button"
          className="shell__toggle"
          aria-expanded={sidebarOpen}
          aria-controls={sidebarId}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          Tareas
        </button>
      </header>
      <div className="shell__body">
        <aside id={sidebarId} className={sidebarOpen ? 'shell__sidebar shell__sidebar--open' : 'shell__sidebar'}>
          <TaskNav catalog={catalog} platform={activePlatform} task={task} onSheet={route.name === 'platform'} />
        </aside>
        <main className="shell__main">{children}</main>
      </div>
    </div>
  )
}
