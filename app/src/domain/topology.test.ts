import { describe, expect, it } from 'vitest';
import type { Device, Link, Topology } from './types';
import {
  applyTopologyChange, downstreamOf, emptyTopology, fromInventoryV1, fromStoredTopology, importInventoryV1,
  isHierarchical, nextLinkId, upstreamOf, type DeviceV1,
} from './topology';
import { parseInventoryCsv, toInventoryCsv } from './inventoryCsv';
import { deploymentPlan } from './deploymentPlan';
import { content } from '../content';

const dev = (id: string, extra: Partial<DeviceV1> = {}): DeviceV1 => ({ id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...extra });
const plain = (id: string, extra: Partial<Device> = {}): Device => ({ id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...extra });
const link = (id: string, a: string, b: string, tipo: Link['tipo'] = 'datos'): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo });

describe('fromInventoryV1', () => {
  it('turns each uplink into a datos link from the device to what it hangs from, and drops uplinks from the devices', () => {
    const topology = fromInventoryV1([dev('fw'), dev('core', { uplinks: ['fw'] }), dev('p1', { uplinks: ['core', 'fw'] })]);
    expect(topology.equipos).toEqual([plain('fw'), plain('core'), plain('p1')]);
    expect(topology.enlaces).toEqual([link('core--fw', 'core', 'fw'), link('p1--core', 'p1', 'core'), link('p1--fw', 'p1', 'fw')]);
    expect(topology.grupos).toEqual([]);
  });

  it('drops repeated uplinks and keeps uplinks to devices that are not in the inventory', () => {
    const topology = fromInventoryV1([dev('core', { uplinks: ['fw', 'fw', 'gone'] }), dev('fw')]);
    expect(topology.enlaces).toEqual([link('core--fw', 'core', 'fw'), link('core--gone', 'core', 'gone')]);
  });

  it('gives a link a numbered id when the plain one is already taken', () => {
    const topology = fromInventoryV1([dev('a--b', { uplinks: ['c'] }), dev('a', { uplinks: ['b--c'] })]);
    expect(topology.enlaces.map(l => l.id)).toEqual(['a--b--c', 'a--b--c-2']);
  });

  it('reads anything that is not a list of devices as an empty topology', () => {
    expect(fromInventoryV1({ a: 1 })).toEqual(emptyTopology());
    expect(fromInventoryV1(null)).toEqual(emptyTopology());
    expect(fromInventoryV1([null, 'x', 3])).toEqual(emptyTopology());
  });
});

describe('fromStoredTopology', () => {
  it('reads a version 2 document', () => {
    const stored = { version: 2, equipos: [plain('fw')], enlaces: [link('x', 'fw', 'isp', 'wan')], grupos: [{ id: 'g', tipo: 'ha', nombre: 'Par', miembros: ['fw'] }] };
    expect(fromStoredTopology(stored)).toEqual({ equipos: stored.equipos, enlaces: stored.enlaces, grupos: stored.grupos });
  });

  it('reads foreign data, another version or a v1 list as an empty topology', () => {
    expect(fromStoredTopology({ version: 3, equipos: [], enlaces: [], grupos: [] })).toEqual(emptyTopology());
    expect(fromStoredTopology({ version: 2, equipos: {} })).toEqual(emptyTopology());
    expect(fromStoredTopology([plain('fw')])).toEqual(emptyTopology());
    expect(fromStoredTopology('texto')).toEqual(emptyTopology());
  });

  it('leaves out links and groups with an unexpected shape', () => {
    const stored = { version: 2, equipos: [plain('fw')], enlaces: [link('ok', 'fw', 'isp'), { id: 'x', a: 'fw', b: 'isp', tipo: 'datos' }, link('t', 'fw', 'isp', 'cable' as Link['tipo'])], grupos: [{ id: 'g', tipo: 'otro', nombre: 'G', miembros: [] }] };
    expect(fromStoredTopology(stored)).toEqual({ equipos: [plain('fw')], enlaces: [link('ok', 'fw', 'isp')], grupos: [] });
  });
});

describe('hierarchy', () => {
  it('counts datos, troncal, lag, wan and almacenamiento as hierarchical, and ha, stack, gestion and energia as not', () => {
    const hierarchical = (['datos', 'troncal', 'lag', 'wan', 'almacenamiento', 'ha', 'stack', 'gestion', 'energia'] as const).filter(tipo => isHierarchical({ tipo }));
    expect(hierarchical).toEqual(['datos', 'troncal', 'lag', 'wan', 'almacenamiento']);
  });

  it('tells what a device hangs from and what hangs from it, through hierarchical links only and once each', () => {
    const enlaces = [link('1', 'core', 'fw1'), link('2', 'core', 'fw1', 'lag'), link('3', 'core', 'core2', 'stack'), link('4', 'p1', 'core', 'troncal'), link('5', 'core', 'gone')];
    expect(upstreamOf(enlaces, 'core')).toEqual(['fw1', 'gone']);
    expect(downstreamOf(enlaces, 'core')).toEqual(['p1']);
    expect(upstreamOf(enlaces, 'core2')).toEqual([]);
  });
});

describe('nextLinkId', () => {
  it('names a link after its ends, numbered when the name is taken', () => {
    expect(nextLinkId(new Set(), 'p1', 'core')).toBe('p1--core');
    expect(nextLinkId(new Set(['p1--core', 'p1--core-2']), 'p1', 'core')).toBe('p1--core-3');
  });
});

describe('applyTopologyChange', () => {
  const base = (): Topology => ({
    equipos: [plain('fw1'), plain('fw2'), plain('core')],
    enlaces: [link('core--fw1', 'core', 'fw1'), link('fw1--fw2', 'fw1', 'fw2', 'ha'), link('core--fw2', 'core', 'fw2')],
    grupos: [{ id: 'par', tipo: 'ha', nombre: 'Par de firewalls', miembros: ['fw1', 'fw2'] }],
  });

  it('removes a device together with its links and takes it out of every group', () => {
    const next = applyTopologyChange(base(), { removeDevices: ['fw1'] });
    expect(next.equipos.map(d => d.id)).toEqual(['fw2', 'core']);
    expect(next.enlaces.map(l => l.id)).toEqual(['core--fw2']);
    expect(next.grupos).toEqual([{ id: 'par', tipo: 'ha', nombre: 'Par de firewalls', miembros: ['fw2'] }]);
  });

  it('saves devices in their place, puts new ones last and leaves the input untouched', () => {
    const before = base();
    const next = applyTopologyChange(before, { saveDevices: [plain('new'), plain('fw2', { monitorizado: true })] });
    expect(next.equipos).toEqual([plain('fw1'), plain('fw2', { monitorizado: true }), plain('core'), plain('new')]);
    expect(before).toEqual(base());
  });

  it('adds links with ids of their own and removes links by id', () => {
    const next = applyTopologyChange(base(), { addLinks: [{ a: { equipo: 'core' }, b: { equipo: 'fw1' }, tipo: 'lag' }], removeLinks: ['fw1--fw2'] });
    expect(next.enlaces.map(l => [l.id, l.tipo])).toEqual([['core--fw1', 'datos'], ['core--fw2', 'datos'], ['core--fw1-2', 'lag']]);
  });
});

describe('importInventoryV1', () => {
  it('keeps the place of overwritten devices and replaces what they hang from with the rows, keeping link types', () => {
    const current: Topology = {
      equipos: [plain('fw'), plain('core', { posicion: { x: 4, y: 5 } }), plain('old')],
      enlaces: [link('core--fw', 'core', 'fw', 'troncal'), link('core--old', 'core', 'old'), link('core--fw2', 'core', 'fw2', 'ha'), link('p1--core', 'p1', 'core')],
      grupos: [],
    };
    const change = importInventoryV1(current, [dev('core', { uplinks: ['fw', 'nuevo'] }), dev('p2', { uplinks: ['core'] })]);
    const next = applyTopologyChange(current, change);
    expect(next.equipos.find(d => d.id === 'core')).toEqual(plain('core', { posicion: { x: 4, y: 5 } }));
    expect(next.enlaces.map(l => [l.id, l.tipo])).toEqual([
      ['core--fw', 'troncal'], ['core--fw2', 'ha'], ['p1--core', 'datos'], ['core--nuevo', 'datos'], ['p2--core', 'datos'],
    ]);
  });

  it('stores what a device hangs from in the order of its row, even when the row reorders links it already had', () => {
    const current = fromInventoryV1([dev('a'), dev('b'), dev('c'), dev('x', { uplinks: ['a', 'b'] })]);
    const next = applyTopologyChange(current, importInventoryV1(current, [dev('x', { uplinks: ['c', 'b', 'a'] })]));
    expect(upstreamOf(next.enlaces, 'x')).toEqual(['c', 'b', 'a']);
    expect(new Set(next.enlaces.map(l => l.id)).size).toBe(next.enlaces.length);
  });

  it('keeps the type, ports, speed, VLANs and notes of the links a reordering import keeps', () => {
    const trunk: Link = { id: 'x--a', a: { equipo: 'x', puerto: '49' }, b: { equipo: 'a', puerto: '1/1/1' }, tipo: 'troncal', velocidad: '10G', vlans: '10,20', notas: 'fibra' };
    const lag: Link = { id: 'x--b', a: { equipo: 'x', puerto: '50' }, b: { equipo: 'b', puerto: '1/1/2' }, tipo: 'lag' };
    const current: Topology = { equipos: ['a', 'b', 'x'].map(id => plain(id)), enlaces: [trunk, lag, link('x--b-ha', 'x', 'b', 'ha')], grupos: [] };
    const next = applyTopologyChange(current, importInventoryV1(current, [dev('x', { uplinks: ['b', 'a'] })]));
    expect(upstreamOf(next.enlaces, 'x')).toEqual(['b', 'a']);
    const withoutId = ({ id: _, ...rest }: Link) => rest;
    expect(next.enlaces.map(withoutId)).toEqual(expect.arrayContaining([withoutId(trunk), withoutId(lag)]));
    expect(next.enlaces.find(l => l.tipo === 'ha')?.id).toBe('x--b-ha');
    expect(next.enlaces).toHaveLength(3);
    expect(new Set(next.enlaces.map(l => l.id)).size).toBe(3);
  });

  it('writes the row order back to the CSV and the deployment plan after a re-import, as the first inventory did', () => {
    const first = parseInventoryCsv('Nombre;Tipo;Uplink\r\nCORE1;switch;\r\nCORE2;switch;\r\nACC1;switch;core1');
    let topology = applyTopologyChange(emptyTopology(), importInventoryV1(emptyTopology(), first));
    topology = applyTopologyChange(topology, importInventoryV1(topology, parseInventoryCsv('Nombre;Tipo;Uplink\r\nACC1;switch;core2,core1')));
    expect(toInventoryCsv(topology).split('\r\n')[3]).toBe('ACC1;switch;;;;;;Media;core2,core1;;;;No;');
    expect(deploymentPlan(topology, content, './guias/').find(p => p.id === 'acc1')?.cuelgaDe).toEqual(['CORE2', 'CORE1']);
  });
});
