import { describe, expect, it } from 'vitest';
import type { Device } from './types';
import { connectDevices, connectionsOf, disconnectDevices, layoutDevices, moveDevice, newDevice, placeUnplaced, withoutDevice, GRID } from './infraMap';

const dev = (id: string, extra: Partial<Device> = {}): Device => ({ id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...extra });

describe('connectionsOf', () => {
  it('lists one connection per uplink to a device that exists', () => {
    const devices = [dev('fw'), dev('core', { uplinks: ['fw', 'gone'] }), dev('p1', { uplinks: ['core'] })];
    expect(connectionsOf(devices)).toEqual([
      { id: 'core->fw', from: 'core', to: 'fw' },
      { id: 'p1->core', from: 'p1', to: 'core' },
    ]);
  });
});

describe('layoutDevices', () => {
  it('keeps the position the user gave a device', () => {
    const positions = layoutDevices([dev('fw', { posicion: { x: 500, y: 40 } })]);
    expect(positions.get('fw')).toEqual({ x: 500, y: 40 });
  });

  it('places the rest in rows by how far they hang from a device with no uplinks', () => {
    const positions = layoutDevices([dev('p1', { uplinks: ['core'] }), dev('core', { uplinks: ['fw'] }), dev('fw'), dev('ap', { uplinks: ['p1'] })]);
    expect(positions.get('fw')?.y).toBe(0);
    expect(positions.get('core')?.y).toBe(GRID.row);
    expect(positions.get('p1')?.y).toBe(2 * GRID.row);
    expect(positions.get('ap')?.y).toBe(3 * GRID.row);
  });

  it('spreads devices of the same row apart and survives a loop of uplinks', () => {
    const positions = layoutDevices([dev('a', { uplinks: ['b'] }), dev('b', { uplinks: ['a'] }), dev('c'), dev('d')]);
    const xs = ['c', 'd'].map(id => positions.get(id)?.x);
    expect(new Set(xs).size).toBe(2);
    expect(positions.size).toBe(4);
  });
});

describe('connectDevices', () => {
  it('adds the target to the uplinks of the source', () => {
    expect(connectDevices(dev('p1'), dev('core'))?.uplinks).toEqual(['core']);
  });

  it('does nothing for the same device or devices already joined in either direction', () => {
    expect(connectDevices(dev('core'), dev('core'))).toBeNull();
    expect(connectDevices(dev('p1', { uplinks: ['core'] }), dev('core'))).toBeNull();
    expect(connectDevices(dev('core'), dev('p1', { uplinks: ['core'] }))).toBeNull();
  });
});

describe('disconnectDevices', () => {
  it('removes the link whichever device holds it and returns only the devices that changed', () => {
    const devices = [dev('core'), dev('p1', { uplinks: ['core', 'fw'] }), dev('fw')];
    expect(disconnectDevices(devices, 'core', 'p1')).toEqual([dev('p1', { uplinks: ['fw'] })]);
  });
});

describe('withoutDevice', () => {
  it('drops the uplinks that pointed to a removed device', () => {
    const devices = [dev('core'), dev('p1', { uplinks: ['core'] }), dev('p2', { uplinks: ['p1'] })];
    expect(withoutDevice(devices, 'core')).toEqual([dev('p1', { uplinks: [] })]);
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
    expect(placeUnplaced(devices)).toEqual([dev('a', { posicion: { x: 0, y: 0 } }), dev('b', { posicion: { x: GRID.col, y: 0 } })]);
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
