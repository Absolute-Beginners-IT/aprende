import { THEMES, useTheme } from '../../lib/useTheme'
import { THEME_LABELS } from './ThemeToggle'

export interface SiteLink {
  /** Section id from the website's content/navegacion.json. */
  id?: string
  label: string
  href: string
  current?: boolean
}

/** The links in VITE_SITE_NAV, or none when the variable is missing or is not a list of { label, href }. */
export function readSiteNav(raw: string | undefined): SiteLink[] {
  if (!raw) return []
  try {
    const links: unknown = JSON.parse(raw)
    if (!Array.isArray(links)) return []
    const valid = links.every(
      (link) => typeof link?.label === 'string' && typeof link?.href === 'string' && link.label && link.href,
    )
    return valid ? (links as SiteLink[]) : []
  } catch {
    return []
  }
}

function SectionLinks({ links, currentId, label }: { links: SiteLink[]; currentId?: string; label: string }) {
  return (
    <nav className="site-bar__nav" aria-label={label}>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          aria-current={(currentId ? link.id === currentId : link.current) ? 'page' : undefined}
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}

/** The website's theme button: same look and wording as on its other pages, same choice for the whole website. */
function SiteThemeButton() {
  const [theme, setTheme] = useTheme()
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'system'
  return (
    <button
      type="button"
      className="site-bar__theme"
      aria-label={`Tema: ${THEME_LABELS[theme]}. Cambiar a ${THEME_LABELS[next]}`}
      onClick={() => setTheme(next)}
    >
      Tema: {THEME_LABELS[theme]}
    </button>
  )
}

/**
 * Top bar of the website that embeds the manual; the standalone file is built without it.
 * It mirrors the bar of the website's other pages (brand, sections folded in a menu on narrow screens, theme button)
 * so that moving between sections does not make it jump.
 * The first link is the website's home page: the brand on the left points to it.
 * `currentId` overrides the section marked at build time, for pages that belong to another section.
 */
export function SiteNav({ links, currentId }: { links: SiteLink[]; currentId?: string }) {
  return (
    <header className="site-bar">
      <a className="site-bar__brand" href={links[0]?.href}>
        <span aria-hidden="true">&gt;_</span> sysadmin junior
      </a>
      <SectionLinks links={links} currentId={currentId} label="Secciones de la web" />
      <details className="site-bar__menu">
        <summary>Menú</summary>
        <SectionLinks links={links} currentId={currentId} label="Menú de secciones" />
      </details>
      <SiteThemeButton />
    </header>
  )
}
