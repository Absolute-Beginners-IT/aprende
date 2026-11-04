import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Catalog } from '../../domain/buildCatalog'
import { fundamentalsHref, planHref, type Route } from '../../lib/useHashRoute'
import { PrototypeNotice } from '../../ui/PrototypeNotice'
import { FundamentalsNav } from '../fundamentals/FundamentalsNav'
import { AppFooter } from './AppFooter'
import { CommandPalette } from './CommandPalette'
import { LibraryNav } from './LibraryNav'
import { PlatformTabs } from './PlatformTabs'
import { readSiteNav, SiteNav } from './SiteNav'
import { buildSearchIndex, type RunbookHit, runbookSearchHit } from './searchIndex'
import { TaskNav } from './TaskNav'
import { ThemeToggle } from './ThemeToggle'

interface AppShellProps {
  catalog: Catalog
  route: Route
  activePlatform: string
  recents: RunbookHit[]
  children: ReactNode
}

const INFRA_SECTION = 'infra'

/** Same tabs as the app's «Mi infraestructura» (map, list, deployment plan), so the planner reads as part of that section. */
function InfraTabs({ inventoryHref }: { inventoryHref: string }) {
  return (
    <nav className="infra-tabs" aria-label="Mi infraestructura">
      <a href={inventoryHref}>Mapa</a>
      <a href={`${inventoryHref}/lista`}>Lista</a>
      <a href={planHref} aria-current="page">
        Red y VLAN
      </a>
      <a href={`${inventoryHref}/plan`}>Plan de despliegue</a>
    </nav>
  )
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)

/**
 * Fixed frame around every page. On its own: brands on top, the brand's tasks on the side. Inside the website: the
 * website's bar on top and the library tree on the side, so the guides read as one more section of the website.
 */
export function AppShell({ catalog, route, activePlatform, recents, children }: AppShellProps) {
  const sidebarId = useId()
  const searchButton = useRef<HTMLButtonElement>(null)
  const mainContent = useRef<HTMLElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const search = useMemo(() => buildSearchIndex(catalog), [catalog])
  const task = route.name === 'runbook' ? route.task : undefined
  const onFundamentals = route.name === 'fundamentals' || route.name === 'fundamental'
  // Pages about every brand at once leave all brand tabs unselected.
  const acrossBrands = onFundamentals || route.name === 'status' || route.name === 'plan'
  const article = route.name === 'fundamental' ? route.article : undefined
  const pageKey = route.name === 'runbook' ? `${route.platform}/${route.task}` : article ? `f/${article}` : route.name

  // On narrow screens the sidebar covers the page, so it closes once the user has picked something.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the page and brand are the triggers, not inputs.
  useEffect(() => setSidebarOpen(false), [pageKey, activePlatform])

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

  // Set only when the manual is built inside a larger website; the standalone file has no site to navigate.
  const siteLinks = readSiteNav(import.meta.env.VITE_SITE_NAV)
  // On the website the planner is the second tab of «Mi infraestructura», next to the app's inventory.
  const inventoryHref = siteLinks.find((link) => link.id === INFRA_SECTION)?.href
  const plannerInSite = inventoryHref !== undefined

  const embedded = siteLinks.length > 0
  // «Red y VLAN» belongs to «Mi infraestructura», not to the library: no tree and no library toolbar there.
  const libraryFrame = embedded && route.name !== 'plan'
  // Inside the website the browser tab is named after its section; the offline file keeps the manual's name.
  useEffect(() => {
    if (embedded) document.title = `${route.name === 'plan' ? 'Red y VLAN' : 'Guías'} · sysadmin junior`
  }, [embedded, route.name])

  const searchButtonElement = (
    <button ref={searchButton} type="button" className="shell__search" onClick={() => setSearchOpen(true)}>
      Buscar <kbd>Ctrl K</kbd>
    </button>
  )
  const sidebarToggle = (label: string) => (
    <button
      type="button"
      className="shell__toggle"
      aria-expanded={sidebarOpen}
      aria-controls={sidebarId}
      onClick={() => setSidebarOpen(!sidebarOpen)}
    >
      {label}
    </button>
  )
  const main = (
    <main ref={mainContent} className="shell__main" tabIndex={-1}>
      {libraryFrame && (
        <div className="shell__toolbar">
          {sidebarToggle('Guías')}
          {searchButtonElement}
        </div>
      )}
      {plannerInSite && route.name === 'plan' && <InfraTabs inventoryHref={inventoryHref} />}
      {children}
    </main>
  )

  const sidebar = (navigation: ReactNode) => (
    <aside id={sidebarId} className={sidebarOpen ? 'shell__sidebar shell__sidebar--open' : 'shell__sidebar'}>
      {navigation}
    </aside>
  )

  let frame: ReactNode
  if (libraryFrame) {
    frame = (
      <div className="shell__body">
        {sidebar(<LibraryNav catalog={catalog} route={route} activePlatform={activePlatform} />)}
        {main}
      </div>
    )
  } else if (embedded) {
    frame = <div className="shell__body shell__body--full">{main}</div>
  } else {
    frame = (
      <>
        <header className="shell__header">
          <a className="shell__title" href="#/">
            Manual de Switching
          </a>
          <nav className="brand-tabs brand-tabs--fixed" aria-label="Herramientas">
            <a href={fundamentalsHref()} aria-current={onFundamentals ? 'page' : undefined}>
              Fundamentos
            </a>
            <a href={planHref} aria-current={route.name === 'plan' ? 'page' : undefined}>
              Planificador de red
            </a>
          </nav>
          <PlatformTabs catalog={catalog} activePlatform={acrossBrands ? '' : activePlatform} task={task} />
          {searchButtonElement}
          <ThemeToggle />
          {sidebarToggle('Tareas')}
        </header>
        <div className="shell__body">
          {sidebar(
            onFundamentals ? (
              <FundamentalsNav articles={catalog.fundamentals} article={article} />
            ) : (
              <TaskNav catalog={catalog} platform={activePlatform} task={task} onSheet={route.name === 'platform'} />
            ),
          )}
          {main}
        </div>
      </>
    )
  }

  return (
    <div className={embedded ? 'shell shell--site' : 'shell'}>
      {/* A button, not an anchor: the hash is the route, so "#content" would navigate away. */}
      <button type="button" className="skip-link" onClick={() => mainContent.current?.focus()}>
        Saltar al contenido
      </button>
      <PrototypeNotice aboutHref={embedded ? `${siteLinks[0]?.href ?? ''}que-es-esto/` : undefined} />
      {embedded && (
        <SiteNav links={siteLinks} currentId={plannerInSite && route.name === 'plan' ? INFRA_SECTION : undefined} />
      )}
      {frame}
      <AppFooter catalog={catalog} />
      {searchOpen && <CommandPalette search={search} recents={recents.map(runbookSearchHit)} onClose={closeSearch} />}
    </div>
  )
}
