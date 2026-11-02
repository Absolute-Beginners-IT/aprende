import navegacion from '@content/navegacion.json';
import { ThemeToggle } from '../theme/ThemeToggle';

export type Section = 'inicio' | 'aprender' | 'mapa' | 'infra' | 'guias' | 'herramientas';

/**
 * The website's sections come from content/navegacion.json, shared with the site and the guides.
 * `ruta` is relative to the site root; the app is served at app/, so its own views are hash links,
 * the guides are ./guias/ and everything else is one level up.
 */
function hrefFromApp(ruta: string): string {
  if (ruta.startsWith('app/#')) return ruta.slice('app/'.length);
  if (ruta.startsWith('app/')) return `./${ruta.slice('app/'.length)}`;
  return `../${ruta}`;
}

function Links({ current }: { current: Section }) {
  return (
    <nav className="nav" aria-label="Secciones">
      {navegacion.map(e => (
        <a key={e.id} href={hrefFromApp(e.ruta)} aria-current={e.id === current ? 'page' : undefined}>{e.nombre}</a>
      ))}
    </nav>
  );
}

/** The website's top bar: brand, the sections (folded in a menu on narrow screens) and the theme button. */
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
