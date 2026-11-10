import { describe, expect, it } from 'vitest';
import type { Device, Link } from './types';
import { connectDevices, connectionsOf, levelFinder, layoutDevices, moveDevice, newDevice, placeUnplaced, GRID } from './infraMap';
import { fromInventoryV1, type DeviceV1 } from './topology';

const dev = (id: string, extra: Partial<DeviceV1> = {}): DeviceV1 => ({ id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...extra });
const plain = ({ uplinks: _, ...device }: DeviceV1): Device => device;
const v1 = (devices: DeviceV1[]) => fromInventoryV1(devices);
const link = (id: string, a: string, b: string, tipo: Link['tipo'] = 'datos'): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo });

describe('connectionsOf', () => {
  it('lists one connection per uplink to a device that exists', () => {
    const devices = [dev('fw'), dev('core', { uplinks: ['fw', 'gone'] }), dev('p1', { uplinks: ['core'] })];
    expect(connectionsOf(v1(devices))).toEqual([
      { id: 'core--fw', from: 'core', to: 'fw' },
      { id: 'p1--core', from: 'p1', to: 'core' },
    ]);
  });

  it('draws one line per link, several between the same pair included, whatever their type', () => {
    const topology = { equipos: [plain(dev('fw1')), plain(dev('fw2'))], enlaces: [link('h1', 'fw1', 'fw2', 'ha'), link('h2', 'fw1', 'fw2', 'ha')], grupos: [] };
    expect(connectionsOf(topology).map(c => c.id)).toEqual(['h1', 'h2']);
  });
});

describe('levelFinder', () => {
  it('counts how far a device hangs from one with no uplinks, ignoring missing devices and loops', () => {
    const levelOf = levelFinder(v1([dev('p1', { uplinks: ['core'] }), dev('core', { uplinks: ['fw', 'gone'] }), dev('fw'), dev('a', { uplinks: ['b'] }), dev('b', { uplinks: ['a'] })]));
    expect(['fw', 'core', 'p1'].map(levelOf)).toEqual([0, 1, 2]);
    expect(['a', 'b'].map(levelOf)).toEqual([2, 1]);
  });

  it('follows only hierarchical links: an HA pair or a stack stays on the same level', () => {
    const topology = { equipos: ['isp', 'fw1', 'fw2'].map(id => plain(dev(id))), enlaces: [link('1', 'fw1', 'isp', 'wan'), link('2', 'fw2', 'isp', 'wan'), link('3', 'fw1', 'fw2', 'ha'), link('4', 'fw2', 'fw1', 'stack')], grupos: [] };
    expect(['isp', 'fw1', 'fw2'].map(levelFinder(topology))).toEqual([0, 1, 1]);
  });
});

describe('layoutDevices', () => {
  it('keeps the position the user gave a device', () => {
    const positions = layoutDevices(v1([dev('fw', { posicion: { x: 500, y: 40 } })]));
    expect(positions.get('fw')).toEqual({ x: 500, y: 40 });
  });

  it('places the rest in rows by how far they hang from a device with no uplinks', () => {
    const positions = layoutDevices(v1([dev('p1', { uplinks: ['core'] }), dev('core', { uplinks: ['fw'] }), dev('fw'), dev('ap', { uplinks: ['p1'] })]));
    expect(positions.get('fw')?.y).toBe(0);
    expect(positions.get('core')?.y).toBe(GRID.row);
    expect(positions.get('p1')?.y).toBe(2 * GRID.row);
    expect(positions.get('ap')?.y).toBe(3 * GRID.row);
  });

  it('spreads devices of the same row apart and survives a loop of uplinks', () => {
    const positions = layoutDevices(v1([dev('a', { uplinks: ['b'] }), dev('b', { uplinks: ['a'] }), dev('c'), dev('d')]));
    const xs = ['c', 'd'].map(id => positions.get(id)?.x);
    expect(new Set(xs).size).toBe(2);
    expect(positions.size).toBe(4);
  });
});

describe('connectDevices', () => {
  it('makes a datos link from the dragged device to the one it now hangs from', () => {
    expect(connectDevices(v1([dev('p1'), dev('core')]), 'p1', 'core')).toEqual({ a: { equipo: 'p1' }, b: { equipo: 'core' }, tipo: 'datos' });
  });

  it('does nothing for the same device or devices already joined in either direction', () => {
    expect(connectDevices(v1([dev('core')]), 'core', 'core')).toBeNull();
    expect(connectDevices(v1([dev('p1', { uplinks: ['core'] }), dev('core')]), 'p1', 'core')).toBeNull();
    expect(connectDevices(v1([dev('core'), dev('p1', { uplinks: ['core'] })]), 'core', 'p1')).toBeNull();
  });

  it('refuses a pair joined by any hierarchical link, and joins a pair that only has a link with no hierarchy', () => {
    const topology = (tipo: Link['tipo']) => ({ equipos: [plain(dev('a')), plain(dev('b'))], enlaces: [link('x', 'b', 'a', tipo)], grupos: [] });
    expect(connectDevices(topology('troncal'), 'a', 'b')).toBeNull();
    expect(connectDevices(topology('lag'), 'a', 'b')).toBeNull();
    expect(connectDevices(topology('ha'), 'a', 'b')).toEqual({ a: { equipo: 'a' }, b: { equipo: 'b' }, tipo: 'datos' });
  });
});

describe('moveDevice', () => {
  it('stores the position in whole pixels', () => {
    expect(moveDevice(dev('core'), { x: 10.6, y: -3.2 }).posicion).toEqual({ x: 11, y: -3 });
  });
});

describe('placeUnplaced', () => {
  it('pins every device the map placed on its own to the spot it shows now', () => {
    const devices = [dev('fw', { posicion: { x: 500, y: 40 } }), dev('a'), dev('b')];
    expect(placeUnplaced(v1(devices))).toEqual([dev('a', { posicion: { x: 0, y: 0 } }), dev('b', { posicion: { x: GRID.col, y: 0 } })]);
  });
});

describe('moveDevice with a broken position', () => {
  it('ignores coordinates that are not numbers', () => {
    expect(moveDevice(dev('core', { posicion: { x: 5, y: 6 } }), { x: Number.NaN, y: 2 }).posicion).toEqual({ x: 5, y: 6 });
  });
});

describe('newDevice', () => {
  it('names a new device after its type with the first free number', () => {
    const created = newDevice('switch', 'Switch', [dev('switch-1', { nombre: 'Switch 1' })], { x: 0, y: 0 });
    expect(created).toEqual({ id: 'switch-2', nombre: 'Switch 2', tipo: 'switch', criticidad: 'Media', monitorizado: false, posicion: { x: 0, y: 0 } });
  });
});
