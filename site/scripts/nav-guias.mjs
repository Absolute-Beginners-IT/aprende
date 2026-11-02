// Prints the website navigation (content/navegacion.json) as the VITE_SITE_NAV the switching guides expect,
// with every link relative to where the guides are served (/app/guias/).
// Usage (from the repo root): VITE_SITE_NAV="$(node site/scripts/nav-guias.mjs)" npm run build
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `ruta` is relative to the site root; the guides live two levels down, in app/guias/. */
function desdeGuias(ruta) {
  if (ruta === 'app/guias/') return './';
  if (ruta.startsWith('app/')) return `../${ruta.slice('app/'.length)}`;
  return `../../${ruta}`;
}

export function navegacionParaGuias(navegacion) {
  return navegacion.map(e => ({ label: e.nombre, href: desdeGuias(e.ruta), ...(e.id === 'guias' ? { current: true } : {}) }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const navegacion = JSON.parse(readFileSync(join(raiz, 'content', 'navegacion.json'), 'utf8'));
  process.stdout.write(JSON.stringify(navegacionParaGuias(navegacion)));
}
