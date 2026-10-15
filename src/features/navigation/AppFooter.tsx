import type { Catalog } from '../../domain/buildCatalog'
import { type Theme, useTheme } from '../../lib/useTheme'

const THEME_LABELS: Record<Theme, string> = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' }

/** The most recent review date across runbooks and brand sheets, as an ISO date. */
const latestReview = (catalog: Catalog) =>
  [...catalog.procedures, ...catalog.platforms]
    .map((item) => item.status.reviewed)
    .sort()
    .at(-1)

export function AppFooter({ catalog }: { catalog: Catalog }) {
  const [theme, setTheme] = useTheme()

  return (
    <footer className="shell__footer">
      <span>Versión {__APP_VERSION__}</span>
      <span>Contenido revisado hasta {latestReview(catalog)}</span>
      <label className="theme-picker">
        Tema
        <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
          {Object.entries(THEME_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </footer>
  )
}
