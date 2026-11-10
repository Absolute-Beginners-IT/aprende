import type { Device, Position, Topology } from './types';
import { slugify } from './inventoryCsv';
import { isHierarchical, upstreamOf, type NewLink } from './topology';

// The map of «Mi infraestructura» edits the topology itself: one line per link, the rows by hierarchical links
// (what each device hangs from) and the place on the map is the optional `posicion` of each device.

/** Room each device gets when the map places it: columns apart and rows apart. */
export const GRID = { col: 190, row: 110 } as const;

export interface Connection { id: string; from: string; to: string }

/** One connection per link whose two devices are in the inventory: `from` is its `a` end, `to` its `b` end. */
export function connectionsOf({ equipos, enlaces }: Topology): Connection[] {
  const ids = new Set(equipos.map(d => d.id));
  return enlaces.filter(l => ids.has(l.a.equipo) && ids.has(l.b.equipo)).map(l => ({ id: l.id, from: l.a.equipo, to: l.b.equipo }));
}

/**
 * How far a device hangs, through hierarchical links, from a device that hangs from nothing in the inventory: 0 is the
 * edge of the network. Worked out on demand and remembered; the map uses it for its rows and the deployment plan for its order.
 */
export function levelFinder({ equipos, enlaces }: Topology): (id: string) => number {
  const known = new Set(equipos.map(d => d.id));
  const parentsOf = new Map(equipos.map(d => [d.id, upstreamOf(enlaces, d.id).filter(p => known.has(p))]));
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const levelOf = (id: string): number => {
    const found = level.get(id);
    if (found !== undefined) return found;
    // A loop of links has no top: the device found again counts as the start of its branch.
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = parentsOf.get(id) ?? [];
    const value = parents.length ? 1 + Math.max(...parents.map(levelOf)) : 0;
    visiting.delete(id);
    level.set(id, value);
    return value;
  };
  return levelOf;
}

/**
 * Where each device goes: its own `posicion` when it has one; otherwise a row by how far it hangs from a device
 * that hangs from nothing (the edge of the network goes on top), spread by name within the row.
 */
export function layoutDevices(topology: Topology): Map<string, Position> {
  const levelOf = levelFinder(topology);
  const positions = new Map<string, Position>();
  const rows = new Map<number, Device[]>();
  for (const d of topology.equipos) {
    if (d.posicion) positions.set(d.id, d.posicion);
    else rows.set(levelOf(d.id), [...(rows.get(levelOf(d.id)) ?? []), d]);
  }
  for (const [row, members] of rows) {
    [...members].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .forEach((d, index) => positions.set(d.id, { x: index * GRID.col, y: row * GRID.row }));
  }
  return positions;
}

/**
 * The link that makes `from` hang from `to`, a `datos` one; null when it is the same device or the pair is already
 * joined by a hierarchical link either way. A link with no hierarchy (HA, stack...) does not stop it.
 */
export function connectDevices({ enlaces }: Topology, from: string, to: string): NewLink | null {
  const joined = enlaces.some(l => isHierarchical(l)
    && ((l.a.equipo === from && l.b.equipo === to) || (l.a.equipo === to && l.b.equipo === from)));
  if (from === to || joined) return null;
  return { a: { equipo: from }, b: { equipo: to }, tipo: 'datos' };
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
export function placeUnplaced(topology: Topology): Device[] {
  const positions = layoutDevices(topology);
  return topology.equipos.filter(d => !d.posicion).map(d => ({ ...d, posicion: whole(positions.get(d.id)!) }));
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
