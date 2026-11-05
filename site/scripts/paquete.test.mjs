// Run with: node --test "site/scripts/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { armarPaquete } from './paquete.mjs';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const CATALOGO = [
  {
    id: 'descubrir',
    nombre: 'Descubrir la red',
    tipo: 'Script de PowerShell',
    descripcion: 'Busca los equipos activos de una subred.',
    requisitos: 'PowerShell 5.1 o 7.',
    uso: '.\\Descubrir-Red.ps1 -Prefijo 192.168.1',
    aviso: 'Úsalo solo con autorización.',
    archivos: ['00-Descubrimiento/Descubrir-Red.ps1'],
  },
  { id: 'inventario', nombre: 'Plantilla de inventario', tipo: 'Plantilla CSV', descripcion: 'La lista de equipos.', requisitos: 'Excel.', archivos: ['01-Inventario/inventario.csv'] },
  // Shares its file with the inventory template, as two real tools do: the file is listed once in SHA256SUMS.txt.
  { id: 'otra', nombre: 'Otra', tipo: 'Guía', descripcion: 'Usa la misma plantilla.', archivos: ['01-Inventario/inventario.csv'] },
];

function repoDePrueba() {
  const raiz = mkdtempSync(join(tmpdir(), 'paquete-'));
  const archivos = { '00-Descubrimiento/Descubrir-Red.ps1': '﻿param($Prefijo)\r\n', '01-Inventario/inventario.csv': 'nombre;tipo\r\n' };
  for (const [ruta, contenido] of Object.entries(archivos)) {
    mkdirSync(dirname(join(raiz, 'toolkit', ruta)), { recursive: true });
    writeFileSync(join(raiz, 'toolkit', ruta), contenido);
  }
  writeFileSync(join(raiz, 'toolkit', 'catalogo.json'), JSON.stringify(CATALOGO));
  mkdirSync(join(raiz, 'guias', 'dist'), { recursive: true });
  writeFileSync(join(raiz, 'guias', 'dist', 'index.html'), '<!doctype html><title>Guías</title>');
  return raiz;
}

const opciones = (raiz) => ({
  raiz,
  guias: join(raiz, 'guias', 'dist', 'index.html'),
  destino: join(raiz, 'dist', 'aprende-sin-conexion'),
  version: 'sin-conexion-2026-11-05',
});

function conRepo(prueba) {
  const raiz = repoDePrueba();
  try {
    prueba(raiz);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
}

test('puts the standalone guides and every catalog tool in the package, byte for byte', () => conRepo((raiz) => {
  const { destino } = opciones(raiz);
  armarPaquete(opciones(raiz));

  assert.deepEqual(readFileSync(join(destino, 'guias.html')), readFileSync(join(raiz, 'guias', 'dist', 'index.html')));
  for (const ruta of ['00-Descubrimiento/Descubrir-Red.ps1', '01-Inventario/inventario.csv']) {
    assert.deepEqual(readFileSync(join(destino, 'herramientas', ruta)), readFileSync(join(raiz, 'toolkit', ruta)));
  }
  assert.deepEqual(readdirSync(destino).sort(), ['LEEME.txt', 'SHA256SUMS.txt', 'guias.html', 'herramientas']);
}));

test('lists the SHA-256 of every file in the format sha256sum -c reads', () => conRepo((raiz) => {
  const { destino } = opciones(raiz);
  armarPaquete(opciones(raiz));

  const lineas = readFileSync(join(destino, 'SHA256SUMS.txt'), 'utf8').trimEnd().split('\n');
  const esperado = ['guias.html', 'herramientas/00-Descubrimiento/Descubrir-Red.ps1', 'herramientas/01-Inventario/inventario.csv']
    .map((ruta) => `${sha256(readFileSync(join(destino, ruta)))}  ${ruta}`);
  assert.deepEqual(lineas, esperado);
}));

test('explains in LEEME.txt how to open the guides and what each tool does, with the version', () => conRepo((raiz) => {
  const { destino } = opciones(raiz);
  armarPaquete(opciones(raiz));

  const leeme = readFileSync(join(destino, 'LEEME.txt'), 'utf8');
  for (const texto of [
    'Versión: sin-conexion-2026-11-05',
    'guias.html',
    'Descubrir la red (Script de PowerShell)',
    'Busca los equipos activos de una subred.',
    'Uso: .\\Descubrir-Red.ps1 -Prefijo 192.168.1',
    'Aviso: Úsalo solo con autorización.',
    'herramientas/00-Descubrimiento/Descubrir-Red.ps1',
    'Plantilla de inventario (Plantilla CSV)',
    'sha256sum -c SHA256SUMS.txt',
  ]) {
    assert.ok(leeme.includes(texto), `LEEME.txt should include «${texto}»`);
  }
  assert.ok(!leeme.includes('Uso: undefined'), 'a tool without usage must not print an empty line');
}));

test('starts from an empty folder, so nothing from an older package stays', () => conRepo((raiz) => {
  const { destino } = opciones(raiz);
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, 'viejo.txt'), 'de otro paquete');

  armarPaquete(opciones(raiz));

  assert.equal(existsSync(join(destino, 'viejo.txt')), false);
}));

test('fails with a clear message when the guides have not been built', () => conRepo((raiz) => {
  rmSync(join(raiz, 'guias', 'dist'), { recursive: true });

  assert.throws(() => armarPaquete(opciones(raiz)), {
    message: /No existe .*index\.html: compila antes las guías con «npm run build» en guias\/\./,
  });
}));

test('builds the guides of the package without the website bar, whatever sections it has', () => conRepo((raiz) => {
  // The website bar marks its current section; the CI and the deploy check the same mark.
  writeFileSync(join(raiz, 'guias', 'dist', 'index.html'), '<script>const nav=[{"id":"inicio","href":"../../"},{"id":"guias","href":"./","current":true}]</script>');

  assert.throws(() => armarPaquete(opciones(raiz)), {
    message: /lleva la barra de la web/,
  });
}));

test('keeps the previous package when the catalog is broken', () => conRepo((raiz) => {
  const { destino } = opciones(raiz);
  armarPaquete(opciones(raiz));
  const antes = readFileSync(join(destino, 'SHA256SUMS.txt'));
  writeFileSync(join(raiz, 'toolkit', 'catalogo.json'), JSON.stringify([{ id: 'x', nombre: 'X', tipo: 'Guía', descripcion: 'Falta.', archivos: ['no-existe.md'] }]));

  assert.throws(() => armarPaquete(opciones(raiz)), { message: 'El catálogo lista toolkit/no-existe.md, que no existe.' });
  assert.deepEqual(readFileSync(join(destino, 'SHA256SUMS.txt')), antes);
  assert.ok(existsSync(join(destino, 'guias.html')));
}));
