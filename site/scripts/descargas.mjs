// Copies the toolkit files listed in toolkit/catalogo.json into the site and records their SHA-256,
// so the "Herramientas" page offers exactly the bytes it publishes. Hashes are never written by hand.
// Usage (from the repo root): node site/scripts/descargas.mjs
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolves a catalog path inside toolkit/, rejecting anything that would read outside it. */
function rutaSegura(toolkit, ruta) {
  const destino = normalize(join(toolkit, ruta));
  const fuera = isAbsolute(ruta) || /^[A-Za-z]:/.test(ruta) || relative(toolkit, destino).split(sep)[0] === '..';
  if (fuera) throw new Error(`La ruta ${ruta} del catálogo sale de toolkit/.`);
  return destino;
}

export function generarDescargas({ raiz, destinoArchivos, destinoDatos }) {
  const toolkit = join(raiz, 'toolkit');
  const catalogo = JSON.parse(readFileSync(join(toolkit, 'catalogo.json'), 'utf8'));

  // Validate every entry first: a broken catalog must not leave a half-written download folder.
  const planes = catalogo.map(h => ({
    ...h,
    archivos: h.archivos.map(ruta => {
      const origen = rutaSegura(toolkit, ruta);
      if (!existsSync(origen)) throw new Error(`El catálogo lista toolkit/${ruta}, que no existe.`);
      return { ruta: ruta.replaceAll('\\', '/'), origen };
    }),
  }));

  const datos = planes.map(h => ({
    ...h,
    archivos: h.archivos.map(({ ruta, origen }) => {
      const destino = join(destinoArchivos, ruta);
      mkdirSync(dirname(destino), { recursive: true });
      copyFileSync(origen, destino);
      const contenido = readFileSync(origen);
      return {
        nombre: basename(ruta),
        ruta: `herramientas/descargas/${ruta}`,
        sha256: createHash('sha256').update(contenido).digest('hex'),
        bytes: contenido.length,
      };
    }),
  }));

  mkdirSync(dirname(destinoDatos), { recursive: true });
  writeFileSync(destinoDatos, JSON.stringify(datos, null, 2));
  return datos;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const site = join(dirname(fileURLToPath(import.meta.url)), '..');
  const datos = generarDescargas({
    raiz: join(site, '..'),
    destinoArchivos: join(site, 'static', 'herramientas', 'descargas'),
    destinoDatos: join(site, 'data', 'herramientas.json'),
  });
  console.log(`Descargas generadas: ${datos.reduce((n, h) => n + h.archivos.length, 0)} archivos de ${datos.length} herramientas.`);
}
