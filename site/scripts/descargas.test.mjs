// Run with: node --test "site/scripts/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarDescargas } from './descargas.mjs';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function repoDePrueba(catalogo, archivos) {
  const raiz = mkdtempSync(join(tmpdir(), 'descargas-'));
  mkdirSync(join(raiz, 'toolkit'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(dirname(join(raiz, 'toolkit', ruta)), { recursive: true });
    writeFileSync(join(raiz, 'toolkit', ruta), contenido);
  }
  writeFileSync(join(raiz, 'toolkit', 'catalogo.json'), JSON.stringify(catalogo));
  return raiz;
}

const opciones = (raiz) => ({
  raiz,
  destinoArchivos: join(raiz, 'site', 'static', 'herramientas', 'descargas'),
  destinoDatos: join(raiz, 'site', 'data', 'herramientas.json'),
});

test('copies every listed file and records its SHA-256, size and download path', () => {
  const raiz = repoDePrueba(
    [{ id: 'descubrir', nombre: 'Descubrir la red', archivos: ['00-Descubrimiento/Descubrir-Red.ps1'] }],
    { '00-Descubrimiento/Descubrir-Red.ps1': '\uFEFFparam($Prefijo)\r\n' },
  );
  try {
    generarDescargas(opciones(raiz));
    const original = readFileSync(join(raiz, 'toolkit', '00-Descubrimiento', 'Descubrir-Red.ps1'));
    const copia = readFileSync(join(raiz, 'site', 'static', 'herramientas', 'descargas', '00-Descubrimiento', 'Descubrir-Red.ps1'));
    assert.deepEqual(copia, original);
    const datos = JSON.parse(readFileSync(join(raiz, 'site', 'data', 'herramientas.json'), 'utf8'));
    assert.deepEqual(datos, [{
      id: 'descubrir',
      nombre: 'Descubrir la red',
      archivos: [{
        nombre: 'Descubrir-Red.ps1',
        ruta: 'herramientas/descargas/00-Descubrimiento/Descubrir-Red.ps1',
        sha256: sha256(original),
        bytes: original.length,
      }],
    }]);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('fails without writing anything when a listed file does not exist', () => {
  const raiz = repoDePrueba([{ id: 'x', nombre: 'X', archivos: ['falta.ps1'] }], {});
  try {
    assert.throws(() => generarDescargas(opciones(raiz)), { message: 'El catálogo lista toolkit/falta.ps1, que no existe.' });
    assert.equal(existsSync(join(raiz, 'site', 'data', 'herramientas.json')), false);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('fails without writing anything when a listed path is a folder, not a file', () => {
  const raiz = repoDePrueba([{ id: 'x', nombre: 'X', archivos: ['06-Runbooks'] }], { '06-Runbooks/Plantilla-MOP.md': '# MOP' });
  try {
    assert.throws(() => generarDescargas(opciones(raiz)), { message: 'El catálogo lista toolkit/06-Runbooks, que no es un archivo.' });
    assert.equal(existsSync(join(raiz, 'site', 'data', 'herramientas.json')), false);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('refuses repeated tool ids, which are used as page anchors', () => {
  const raiz = repoDePrueba(
    [{ id: 'mop', nombre: 'A', archivos: ['a.md'] }, { id: 'mop', nombre: 'B', archivos: ['b.md'] }],
    { 'a.md': 'a', 'b.md': 'b' },
  );
  try {
    assert.throws(() => generarDescargas(opciones(raiz)), { message: 'El id mop está repetido en el catálogo.' });
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('removes downloads left over from tools no longer in the catalog', () => {
  const raiz = repoDePrueba([{ id: 'mop', nombre: 'MOP', archivos: ['06-Runbooks/Plantilla-MOP.md'] }], { '06-Runbooks/Plantilla-MOP.md': '# MOP' });
  const sobrante = join(raiz, 'site', 'static', 'herramientas', 'descargas', 'viejo', 'Retirado.ps1');
  try {
    mkdirSync(dirname(sobrante), { recursive: true });
    writeFileSync(sobrante, 'ya no está en el catálogo');
    generarDescargas(opciones(raiz));
    assert.equal(existsSync(sobrante), false);
    assert.equal(existsSync(join(raiz, 'site', 'static', 'herramientas', 'descargas', '06-Runbooks', 'Plantilla-MOP.md')), true);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test('refuses paths that leave the toolkit folder', () => {
  for (const ruta of ['../secreto.txt', 'a/../../secreto.txt', '/etc/passwd', 'C:\\Windows\\win.ini']) {
    const raiz = repoDePrueba([{ id: 'x', nombre: 'X', archivos: [ruta] }], {});
    try {
      assert.throws(() => generarDescargas(opciones(raiz)), { message: `La ruta ${ruta} del catálogo sale de toolkit/.` });
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  }
});

test('the real catalog only lists files that exist and describes each tool', () => {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const catalogo = JSON.parse(readFileSync(join(raiz, 'toolkit', 'catalogo.json'), 'utf8'));
  assert.ok(catalogo.length > 0);
  assert.equal(new Set(catalogo.map(h => h.id)).size, catalogo.length, 'ids repetidos');
  for (const h of catalogo) {
    for (const campo of ['id', 'nombre', 'tipo', 'descripcion', 'requisitos']) assert.ok(h[campo]?.trim(), `${campo} de ${h.id}`);
    for (const archivo of h.archivos) assert.ok(existsSync(join(raiz, 'toolkit', archivo)), `toolkit/${archivo}`);
  }
});
