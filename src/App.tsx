import { catalog } from './content/catalog'
import { HomePage } from './features/catalog/HomePage'
import { PlatformPage } from './features/catalog/PlatformPage'
import { RunbookPage } from './features/procedure/RunbookPage'
import { platformHref, type Route, useHashRoute } from './lib/useHashRoute'

function NotFound() {
  return (
    <div>
      <p>No encontramos esa página.</p>
      <a href="#/">Volver al inicio</a>
    </div>
  )
}

function Page({ route }: { route: Route }) {
  if (route.name === 'home') return <HomePage catalog={catalog} />
  if (route.name === 'not-found') return <NotFound />

  const platform = catalog.platforms.find((item) => item.id === route.platform)
  if (!platform) return <NotFound />
  if (route.name === 'platform') return <PlatformPage catalog={catalog} platform={platform} />

  const concept = catalog.concepts.find((item) => item.id === route.task)
  const procedure = catalog.procedures.find((item) => item.platform === platform.id && item.task === route.task)
  if (!concept || !procedure) return <NotFound />

  // The key resets per-runbook state when the user moves between runbooks.
  return (
    <RunbookPage key={`${platform.id}/${concept.id}`} platform={platform} concept={concept} procedure={procedure} />
  )
}

export function App() {
  const route = useHashRoute()
  const platform = 'platform' in route ? catalog.platforms.find((item) => item.id === route.platform) : undefined

  return (
    <div className="app">
      {route.name !== 'home' && (
        <nav className="breadcrumb" aria-label="Ruta">
          <a href="#/">Inicio</a>
          {platform && route.name === 'runbook' && <a href={platformHref(platform.id)}>{platform.name}</a>}
        </nav>
      )}
      <main>
        <Page route={route} />
      </main>
    </div>
  )
}
