// Run with: node --test "site/scripts/*.test.mjs"
// The route's explanatory visuals read their steps from site/data/visuales/. These tests keep that data truthful:
// the packet only changes where a device really changes it, and the network only grows from one stage to the next.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const datos = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'visuales');
const leer = (nombre) => JSON.parse(readFileSync(join(datos, nombre), 'utf8'));
const enlace = (a, b) => [a, b].sort().join('-');

test('the web request walks the drawn cables, one device after another', () => {
  const { nodos, enlaces, pasos } = leer('recorrido-web.json');
  const cables = new Set(enlaces.map(([a, b]) => enlace(a, b)));
  assert.equal(pasos[0].desde, undefined, 'the first step starts on a device, without travelling');
  pasos.forEach((paso, i) => {
    assert.ok(nodos[paso.en], `step ${i + 1}: unknown device ${paso.en}`);
    assert.ok(['pregunta', 'respuesta'].includes(paso.tipo), `step ${i + 1}: unknown kind ${paso.tipo}`);
    for (const campo of ['fase', 'cambio', 'hace', 'porque']) assert.ok(paso[campo]?.trim(), `step ${i + 1}: missing ${campo}`);
    if (i === 0) return;
    assert.equal(paso.desde, pasos[i - 1].en, `step ${i + 1} must leave from where step ${i} arrived`);
    assert.ok(cables.has(enlace(paso.desde, paso.en)), `step ${i + 1}: no cable between ${paso.desde} and ${paso.en}`);
  });
});

test('the packet name changes exactly where the step says the device changed it', () => {
  const { pasos } = leer('recorrido-web.json');
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

test('a switch never changes the packet, and only the router translates addresses (NAT)', () => {
  const { pasos } = leer('recorrido-web.json');
  for (const [i, paso] of pasos.entries()) {
    if (paso.en === 'switch') assert.deepEqual(paso.cambia ?? [], [], `step ${i + 1}: the switch changed the packet`);
    const nat = (paso.cambia ?? []).filter((c) => c === 'origen' || c === 'destino');
    if (nat.length && !(paso.cambia ?? []).includes('nombre')) assert.equal(paso.en, 'router', `step ${i + 1}: only the router does NAT`);
  }
});

test('the office network only grows from one stage to the next', () => {
  const { elementos, etapas } = leer('evolucion-red.json');
  const conocidos = new Set(elementos);
  etapas.forEach((etapa, i) => {
    assert.ok(etapa.titulo?.trim() && etapa.porque?.trim(), `stage ${i + 1}: missing title or reason`);
    for (const id of etapa.muestra) assert.ok(conocidos.has(id), `stage ${i + 1}: unknown element ${id}`);
    if (i > 0) for (const id of etapas[i - 1].muestra) assert.ok(etapa.muestra.includes(id), `stage ${i + 1} hides ${id}`);
  });
});
