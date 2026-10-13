import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Catalog } from '../../domain/buildCatalog'
import type { Route } from '../../lib/useHashRoute'
import { CommandPalette } from './CommandPalette'
import { PlatformTabs } from './PlatformTabs'
import { buildSearchIndex, type RunbookHit } from './searchIndex'
import { TaskNav } from './TaskNav'

interface AppShellProps {
  catalog: Catalog
  route: Route
  activePlatform: string
  recents: RunbookHit[]
  children: ReactNode
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)

/** Fixed frame around every page: brands on top, the brand's tasks on the side. */
export function AppShell({ catalog, route, activePlatform, recents, children }: AppShellProps) {
  const sidebarId = useId()
  const searchButton = useRef<HTMLButtonElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const search = useMemo(() => buildSearchIndex(catalog), [catalog])
  const task = route.name === 'runbook' ? route.task : undefined
  const location = route.name === 'runbook' ? `${route.platform}/${route.task}` : route.name

  // On narrow screens the sidebar covers the page, so it closes once the user has picked something.
  useEffect(() => setSidebarOpen(false), [location, activePlatform])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      // "/" only counts as a shortcut when the user is not writing a value somewhere.
      const slash = event.key === '/' && !isTypingTarget(event.target)
      if (!shortcut && !slash) return
      event.preventDefault()
      setSearchOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const closeSearch = () => {
    setSearchOpen(false)
    searchButton.current?.focus()
  }

  return (
    <div className="shell">
      <header className="shell__header">
        <a className="shell__title" href="#/">
          Manual de Switching
        </a>
        <PlatformTabs catalog={catalog} activePlatform={activePlatform} task={task} />
        <button ref={searchButton} type="button" className="shell__search" onClick={() => setSearchOpen(true)}>
          Buscar <kbd>Ctrl K</kbd>
        </button>
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
      {searchOpen && <CommandPalette search={search} recents={recents} onClose={closeSearch} />}
    </div>
  )
}
