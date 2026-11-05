// Builds the offline package: the standalone guides and the toolkit files of the catalog, with their SHA-256 and a
// LEEME.txt, so they can be used at work without the website. The release workflow zips the folder.
// Usage (from the repo root, after «npm run build» in guias/ without VITE_SITE_NAV):
//   node site/scripts/paquete.mjs <version> [destination folder]
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarDescargas } from './descargas.mjs';

// Only a build made with VITE_SITE_NAV carries the website's links; its relative links break outside the website.
// The bar marks its current section: the same mark the CI and the deploy check.
const MARCA_BARRA_WEB = '"current":true';

function leeme({ version, herramientas }) {
  const fichas = herramientas.map((h) => [
    `${h.nombre} (${h.tipo})`,
    `  ${h.descripcion}`,
    h.requisitos && `  Requisitos: ${h.requisitos}`,
    h.uso && `  Uso: ${h.uso}`,
    h.aviso && `  Aviso: ${h.aviso}`,
    ...h.archivos.map((a) => `  - ${a.ruta}`),
  ].filter(Boolean).join('\n'));

  return [
    'Guía del administrador de sistemas junior: guías y herramientas sin conexión',
    `Versión: ${version}`,
    '',
    'GUÍAS',
    'Abre guias.html con doble clic en el navegador. No necesita internet ni servidor. Los datos que escribas en una',
    'guía se guardan solo en ese navegador. Las contraseñas y claves no se guardan nunca.',
    '',
    'HERRAMIENTAS',
    'Los scripts y plantillas están en la carpeta herramientas/.',
    '',
    fichas.join('\n\n'),
    '',
    'COMPROBAR QUE NO SE HA MODIFICADO NADA',
    'SHA256SUMS.txt tiene la huella SHA-256 de cada archivo.',
    '  En Linux o macOS: sha256sum -c SHA256SUMS.txt',
    '  En PowerShell: Get-FileHash .\\guias.html (y compara el resultado con su línea)',
    '',
    'Web: https://absolute-beginners-it.github.io/aprende/',
    'Código: https://github.com/Absolute-Beginners-IT/aprende',
    '',
  ].join('\n');
}

export function armarPaquete({ raiz, guias, destino, version }) {
  if (!existsSync(guias)) {
    throw new Error(`No existe ${guias}: compila antes las guías con «npm run build» en guias/.`);
  }
  if (readFileSync(guias, 'utf8').includes(MARCA_BARRA_WEB)) {
    throw new Error(`${guias} lleva la barra de la web: compila las guías sin VITE_SITE_NAV para el paquete.`);
  }

  // Built aside and swapped in at the end, so a broken catalog leaves the previous package as it was.
  const nuevo = `${destino}.nuevo`;
  rmSync(nuevo, { recursive: true, force: true });
  try {
    const herramientas = generarDescargas({ raiz, destinoArchivos: join(nuevo, 'herramientas'), prefijoRuta: 'herramientas/' });
    mkdirSync(nuevo, { recursive: true });
    copyFileSync(guias, join(nuevo, 'guias.html'));

    // Two tools may share a file: it is in the package once, so it is listed once.
    const rutas = [...new Set(['guias.html', ...herramientas.flatMap((h) => h.archivos.map((a) => a.ruta))])];
    const sumas = rutas.map((ruta) => `${createHash('sha256').update(readFileSync(join(nuevo, ruta))).digest('hex')}  ${ruta}`);
    writeFileSync(join(nuevo, 'SHA256SUMS.txt'), `${sumas.join('\n')}\n`);
    writeFileSync(join(nuevo, 'LEEME.txt'), leeme({ version, herramientas }));

    rmSync(destino, { recursive: true, force: true });
    renameSync(nuevo, destino);
    return { rutas };
  } catch (error) {
    rmSync(nuevo, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const [version, destino] = process.argv.slice(2);
  if (!version) {
    console.error('Uso: node site/scripts/paquete.mjs <versión> [carpeta de destino]');
    process.exit(1);
  }
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { rutas } = armarPaquete({
    raiz,
    guias: join(raiz, 'guias', 'dist', 'index.html'),
    destino: destino ?? join(raiz, 'dist', 'aprende-sin-conexion'),
    version,
  });
  console.log(`Paquete sin conexión ${version}: ${rutas.length} archivos.`);
}
