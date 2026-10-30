import { ThemeToggle } from '../theme/ThemeToggle';

export type Section = 'inicio' | 'aprender' | 'mapa' | 'infra' | 'guias' | 'herramientas';

// Same six entries as the site (site/layouts/partials/nav.html) and the guides, in the same order.
// Relative links: the app is served under the site (/app/), so ../ is the site and ./guias/ the guides.
const ITEMS: [Section, string, string][] = [
  ['inicio', 'Inicio', '../'],
  ['aprender', 'Aprender', '../aprender/'],
  ['mapa', 'Mapa', '#mapa'],
  ['infra', 'Mi infraestructura', '#mi-infraestructura'],
  ['guias', 'Guías', './guias/'],
  ['herramientas', 'Herramientas', '../herramientas/'],
];

function Links({ current }: { current: Section }) {
  return (
    <nav className="nav" aria-label="Secciones">
      {ITEMS.map(([id, label, href]) => (
        <a key={id} href={href} aria-current={id === current ? 'page' : undefined}>{label}</a>
      ))}
    </nav>
  );
}

/** The website's top bar: brand, the six sections (folded in a menu on narrow screens) and the theme button. */
export function SiteNav({ current }: { current: Section }) {
  return (
    <header className="top">
      <a className="brand" href="../" title="Guía del administrador de sistemas junior"><span className="brand__mark">&gt;_</span> sysadmin junior</a>
      <Links current={current} />
      <details className="menu">
        <summary>Menú</summary>
        <Links current={current} />
      </details>
      <ThemeToggle />
    </header>
  );
}
