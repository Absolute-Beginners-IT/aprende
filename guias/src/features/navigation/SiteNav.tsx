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

/**
 * Top bar of the website that embeds the manual; the standalone file is built without it.
 * The first link is the website's home page: the brand on the left points to it.
 * `currentId` overrides the section marked at build time, for pages that belong to another section.
 */
export function SiteNav({ links, currentId }: { links: SiteLink[]; currentId?: string }) {
  return (
    <div className="site-bar">
      <a className="site-bar__brand" href={links[0]?.href}>
        <span aria-hidden="true">&gt;_</span> sysadmin junior
      </a>
      <nav className="site-bar__nav" aria-label="Secciones de la web">
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
    </div>
  )
}
