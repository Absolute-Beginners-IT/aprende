// Run with: node --test "site/scripts/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { navegacionParaGuias } from './nav-guias.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const navegacion = JSON.parse(readFileSync(join(raiz, 'content', 'navegacion.json'), 'utf8'));

test('turns the shared navigation into links relative to /app/guias/, with the guides marked as current', () => {
  assert.deepEqual(navegacionParaGuias(navegacion), [
    { id: 'inicio', label: 'Inicio', href: '../../' },
    { id: 'aprender', label: 'Aprender', href: '../../aprender/' },
    { id: 'infra', label: 'Mi infraestructura', href: '../#mi-infraestructura' },
    { id: 'guias', label: 'Guías', href: './', current: true },
    { id: 'herramientas', label: 'Herramientas', href: '../../herramientas/' },
  ]);
});

test('the shared navigation has unique ids, starts at the home page and names every entry', () => {
  assert.equal(new Set(navegacion.map(e => e.id)).size, navegacion.length);
  assert.equal(navegacion[0].ruta, '', 'the first entry is the home page (the brand links to it)');
  for (const e of navegacion) assert.ok(e.nombre?.trim() && typeof e.ruta === 'string', e.id);
  assert.ok(navegacion.some(e => e.id === 'guias'), 'the guides need their own entry to be marked as current');
  assert.ok(navegacion.some(e => e.id === 'infra'), 'the network planner of the guides is shown under «Mi infraestructura»');
});

test('the guides keep the files the landing page counts (procedures per brand and named platforms)', () => {
  const contenido = join(raiz, 'guias', 'src', 'content');
  const marcas = readdirSync(join(contenido, 'procedures'), { withFileTypes: true }).filter(d => d.isDirectory());
  assert.ok(marcas.length > 0, 'guias/src/content/procedures/<marca>/');
  for (const m of marcas) assert.ok(readdirSync(join(contenido, 'procedures', m.name)).some(f => f.endsWith('.yaml')), m.name);
  const plataformas = readdirSync(join(contenido, 'platforms')).filter(f => f.endsWith('.yaml'));
  assert.ok(plataformas.length > 0);
  for (const p of plataformas) assert.match(readFileSync(join(contenido, 'platforms', p), 'utf8'), /^name: .+$/m, p);
});
