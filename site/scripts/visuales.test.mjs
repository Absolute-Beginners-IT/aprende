// Run with: node --test "site/scripts/*.test.mjs"
// The route's explanatory visuals read their steps from site/data/visuales/. These tests keep that data truthful:
// the packet only changes where a device really changes it, and a network only grows from one stage to the next.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sitio = join(dirname(fileURLToPath(import.meta.url)), '..');
const datos = join(sitio, 'data', 'visuales');
const todos = (carpeta) => readdirSync(join(datos, carpeta)).filter((f) => f.endsWith('.json'))
  .map((f) => [basename(f, '.json'), JSON.parse(readFileSync(join(datos, carpeta, f), 'utf8'))]);
const enlace = (a, b) => [a, b].sort().join('-');
const recorridos = todos('recorridos');
const evoluciones = todos('evoluciones');

test('there are walkthroughs for the web request, tracert and SSH, and stage stories for modules 1 and 2', () => {
  assert.deepEqual(recorridos.map(([n]) => n).sort(), ['ssh', 'tracert', 'web']);
  assert.deepEqual(evoluciones.map(([n]) => n).sort(), ['mascara-ip', 'permisos-linux', 'red-oficina', 'servidor-windows']);
});

for (const [nombre, { nodos, cables, pasos, pantalla }] of recorridos) {
  test(`${nombre}: the packet walks the drawn cables, one device after another`, () => {
    const tendidos = new Set(cables.map((c) => enlace(c.a, c.b)));
    for (const c of cables) assert.ok(nodos[c.a] && nodos[c.b], `cable ${c.a}-${c.b} joins an unknown device`);
    assert.equal(pasos[0].desde, undefined, 'the first step starts on a device, without travelling');
    pasos.forEach((paso, i) => {
      assert.ok(nodos[paso.en], `step ${i + 1}: unknown device ${paso.en}`);
      assert.ok(['pregunta', 'respuesta'].includes(paso.tipo), `step ${i + 1}: unknown kind ${paso.tipo}`);
      for (const campo of ['fase', 'cambio', 'hace', 'porque']) assert.ok(paso[campo]?.trim(), `step ${i + 1}: missing ${campo}`);
      if (i === 0) return;
      assert.equal(paso.desde, pasos[i - 1].en, `step ${i + 1} must leave from where step ${i} arrived`);
      assert.ok(tendidos.has(enlace(paso.desde, paso.en)), `step ${i + 1}: no cable between ${paso.desde} and ${paso.en}`);
    });
  });

  test(`${nombre}: the packet name changes exactly where the step says the device changed it`, () => {
    for (let i = 1; i < pasos.length; i++) {
      const antes = pasos[i - 1].paquete;
      const ahora = pasos[i].paquete;
      const cambia = new Set(pasos[i].cambia ?? []);
      assert.equal(ahora.nombre !== antes.nombre, cambia.has('nombre'), `step ${i + 1}: name changed ${ahora.nombre !== antes.nombre}, declared ${cambia.has('nombre')}`);
      if (!cambia.has('nombre')) {
        assert.equal(ahora.origen !== antes.origen, cambia.has('origen'), `step ${i + 1}: source changed ${ahora.origen !== antes.origen}, declared ${cambia.has('origen')}`);
        assert.equal(ahora.destino !== antes.destino, cambia.has('destino'), `step ${i + 1}: destination changed ${ahora.destino !== antes.destino}, declared ${cambia.has('destino')}`);
      }
      if (pasos[i].cambio === 'Sin cambios') assert.equal(cambia.size, 0, `step ${i + 1} says nothing changed`);
    }
  });

  test(`${nombre}: a switch never changes the packet, and only a device that does NAT translates addresses`, () => {
    for (const [i, paso] of pasos.entries()) {
      const cambia = paso.cambia ?? [];
      if (nodos[paso.en].rol === 'switch') assert.deepEqual(cambia, [], `step ${i + 1}: the switch changed the packet`);
      if (!cambia.includes('nombre') && cambia.some((c) => c === 'origen' || c === 'destino')) {
        assert.equal(nodos[paso.en].nat, true, `step ${i + 1}: ${paso.en} does not do NAT`);
      }
    }
  });

  test(`${nombre}: the screen never shows more lines than it has room for`, () => {
    if (!pantalla) return;
    for (const [i, estado] of [pantalla.inicial, ...pasos.map((p) => p.pantalla)].entries()) {
      if (estado?.lineas) assert.ok(estado.lineas.length <= pantalla.lineas, `screen state ${i}: ${estado.lineas.length} lines`);
    }
  });
}

for (const [nombre, { elementos, etapas }] of evoluciones) {
  test(`${nombre}: the drawing only grows from one stage to the next`, () => {
    const conocidos = new Set(elementos);
    const dibujo = readFileSync(join(sitio, 'layouts', 'partials', 'visuales', `${nombre}.html`), 'utf8');
    for (const id of elementos) assert.ok(dibujo.includes(`data-elemento="${id}"`), `the drawing has no element ${id}`);
    etapas.forEach((etapa, i) => {
      assert.ok(etapa.titulo?.trim() && etapa.porque?.trim(), `stage ${i + 1}: missing title or reason`);
      for (const id of etapa.muestra) assert.ok(conocidos.has(id), `stage ${i + 1}: unknown element ${id}`);
      if (i > 0) for (const id of etapas[i - 1].muestra) assert.ok(etapa.muestra.includes(id), `stage ${i + 1} hides ${id}`);
    });
  });
}

test('every visual used in the route has its data', () => {
  const ruta = join(sitio, 'content', 'ruta');
  const usados = [];
  for (const modulo of readdirSync(ruta, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(join(ruta, modulo.name)).filter((x) => x.endsWith('.md'))) {
      const texto = readFileSync(join(ruta, modulo.name, f), 'utf8');
      for (const [, tipo, datos] of texto.matchAll(/\{\{<\s*(recorrido|evolucion)\s+datos="([^"]+)"\s*>\}\}/g)) usados.push([tipo, datos]);
    }
  }
  assert.ok(usados.length >= 7, `only ${usados.length} visuals found in the route`);
  for (const [tipo, nombre] of usados) {
    assert.ok(existsSync(join(datos, tipo === 'recorrido' ? 'recorridos' : 'evoluciones', `${nombre}.json`)), `${tipo} ${nombre} has no data`);
  }
});
