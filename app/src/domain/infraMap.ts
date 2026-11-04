import type { Device, Position } from './types';
import { slugify } from './inventoryCsv';

// The map of «Mi infraestructura» edits the inventory itself: a connection is an uplink of a device
// (the device it hangs from) and the place on the map is the optional `posicion`.

/** Room each device gets when the map places it: columns apart and rows apart. */
export const GRID = { col: 190, row: 110 } as const;

export interface Connection { id: string; from: string; to: string }

/** One connection per uplink whose target is still in the inventory. */
export function connectionsOf(devices: Device[]): Connection[] {
  const ids = new Set(devices.map(d => d.id));
  return devices.flatMap(d => (d.uplinks ?? []).filter(to => ids.has(to)).map(to => ({ id: `${d.id}->${to}`, from: d.id, to })));
}

/**
 * How far a device hangs from a device with no uplinks to devices in the inventory: 0 is the edge of the network.
 * Worked out on demand and remembered; the map uses it for its rows and the deployment plan for its order.
 */
export function levelFinder(devices: Device[]): (id: string) => number {
  const byId = new Map(devices.map(d => [d.id, d]));
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const levelOf = (id: string): number => {
    const known = level.get(id);
    if (known !== undefined) return known;
    // A loop of uplinks has no top: the device found again counts as the start of its branch.
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = (byId.get(id)?.uplinks ?? []).filter(p => byId.has(p));
    const value = parents.length ? 1 + Math.max(...parents.map(levelOf)) : 0;
    visiting.delete(id);
    level.set(id, value);
    return value;
  };
  return levelOf;
}

/**
 * Where each device goes: its own `posicion` when it has one; otherwise a row by how far it hangs from a device
 * with no uplinks (the edge of the network goes on top), spread by name within the row.
 */
export function layoutDevices(devices: Device[]): Map<string, Position> {
  const levelOf = levelFinder(devices);
  const positions = new Map<string, Position>();
  const rows = new Map<number, Device[]>();
  for (const d of devices) {
    if (d.posicion) positions.set(d.id, d.posicion);
    else rows.set(levelOf(d.id), [...(rows.get(levelOf(d.id)) ?? []), d]);
  }
  for (const [row, members] of rows) {
    [...members].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .forEach((d, index) => positions.set(d.id, { x: index * GRID.col, y: row * GRID.row }));
  }
  return positions;
}

/** `from` now hangs from `to`; null when it is the same device or both are already joined either way. */
export function connectDevices(from: Device, to: Device): Device | null {
  if (from.id === to.id || from.uplinks?.includes(to.id) || to.uplinks?.includes(from.id)) return null;
  return { ...from, uplinks: [...(from.uplinks ?? []), to.id] };
}

/** Removes the connection between two devices, whichever holds it; returns only the devices that changed. */
export function disconnectDevices(devices: Device[], a: string, b: string): Device[] {
  return devices.flatMap(d => {
    const other = d.id === a ? b : d.id === b ? a : undefined;
    if (other === undefined || !d.uplinks?.includes(other)) return [];
    return [{ ...d, uplinks: d.uplinks.filter(u => u !== other) }];
  });
}

/** The devices whose uplinks pointed to a device being removed, without that uplink. */
export function withoutDevice(devices: Device[], id: string): Device[] {
  return devices.filter(d => d.id !== id && d.uplinks?.includes(id)).map(d => ({ ...d, uplinks: d.uplinks!.filter(u => u !== id) }));
}

const whole = (position: Position): Position => ({ x: Math.round(position.x), y: Math.round(position.y) });
const isPlace = (position: Position) => Number.isFinite(position.x) && Number.isFinite(position.y);

/** The device in its new place; a position that is not a pair of numbers leaves it where it was. */
export function moveDevice(device: Device, position: Position): Device {
  return isPlace(position) ? { ...device, posicion: whole(position) } : device;
}

/**
 * The devices the map placed on its own, pinned to the spot they show now. Saved together with the first move,
 * so placing one device by hand never makes the others reflow onto it.
 */
export function placeUnplaced(devices: Device[]): Device[] {
  const positions = layoutDevices(devices);
  return devices.filter(d => !d.posicion).map(d => ({ ...d, posicion: whole(positions.get(d.id)!) }));
}

/** A device of a type dropped on the map, named after the type with the first number not in use. */
export function newDevice(tipo: string, typeName: string, devices: Device[], position: Position): Device {
  const names = new Set(devices.map(d => d.nombre.toLowerCase()));
  const ids = new Set(devices.map(d => d.id));
  let n = 1;
  while (names.has(`${typeName} ${n}`.toLowerCase()) || ids.has(slugify(`${typeName} ${n}`))) n++;
  const nombre = `${typeName} ${n}`;
  return { id: slugify(nombre), nombre, tipo, criticidad: 'Media', monitorizado: false, posicion: whole(isPlace(position) ? position : { x: 0, y: 0 }) };
}
