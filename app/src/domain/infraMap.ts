import { LINK_TYPES, type Device, type DeviceGroup, type Link, type LinkType, type Position, type Topology } from './types';
import { slugify } from './inventoryCsv';
import {
  LINK_TYPE_NAMES, groupOf, isHierarchical, isPeerLink, isPowerSupplier, powerFeedersOf, powerSourceOf, upstreamOf, type NewLink, type PowerRole,
} from './topology';

// The map of «Mi infraestructura» edits the topology itself: one line per link, the devices by tiers (what kind of
// device it is) and, inside a tier, by hierarchical links (what each device hangs from). The place on the map is the
// optional `posicion` of each device.

/** Room each device gets when the map places it: columns apart and rows apart. */
export const GRID = { col: 200, row: 130 } as const;
/** Extra room between two runs of peers on a row, and between two tiers, so their boxes never touch. */
const UNIT_GAP = 50;
const TIER_GAP = 50;
/** Room left of the leftmost device for the tier names. */
const LABEL_ROOM = 190;
/** Room a group box leaves around its members, with its name on top. */
const BOX_PADDING = { side: 14, top: 30, bottom: 14 } as const;
/** Spots where lines attach on the top and bottom of a device, and on its sides: distance apart and the most they spread. */
const SLOT_STEP = 22;
const SLOT_SPAN = 120;
const SIDE_SLOT_STEP = 10;
const SIDE_SLOT_SPAN = 40;
/** Heights at which vertical lines between the same two rows bend, and the band that counts as the same rows. */
const BEND_STEP = 8;
const BEND_SPAN = 40;
const BAND = 20;
/** How far above the source end a label sits, and how much higher each next label on the same side goes. */
const LABEL_LIFT = 14;
const LABEL_STEP = 18;

export interface Connection { id: string; from: string; to: string }

/** The links whose two devices are in the inventory: the lines the map draws. */
export function drawnLinks({ equipos, enlaces }: Topology): Link[] {
  const ids = new Set(equipos.map(d => d.id));
  return enlaces.filter(l => ids.has(l.a.equipo) && ids.has(l.b.equipo));
}

/** One connection per link whose two devices are in the inventory: `from` is its `a` end, `to` its `b` end. */
export function connectionsOf(topology: Topology): Connection[] {
  return drawnLinks(topology).map(l => ({ id: l.id, from: l.a.equipo, to: l.b.equipo }));
}

/**
 * How far a device hangs, through hierarchical links, from a device that hangs from nothing in the inventory: 0 is the
 * edge of the network. Worked out on demand and remembered; the map uses it for the sub-rows of a tier and the
 * deployment plan for its order.
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

/** A band of the map, top to bottom, and the device types it holds. */
export interface Tier { id: string; nombre: string; tipos: readonly string[] }

export const TIERS: readonly Tier[] = [
  { id: 'operadora', nombre: 'Operadora', tipos: ['internet'] },
  { id: 'perimetro', nombre: 'Perímetro', tipos: ['firewall', 'router'] },
  { id: 'red', nombre: 'Red', tipos: ['switch', 'wifi'] },
  { id: 'servidores', nombre: 'Servidores', tipos: ['hipervisor', 'servidor', 'vm', 'impresora', 'otro'] },
  { id: 'almacenamiento', nombre: 'Almacenamiento y copias', tipos: ['almacenamiento', 'backup'] },
  { id: 'energia', nombre: 'Energía', tipos: ['sai', 'regleta'] },
];
const SERVERS_TIER = TIERS.findIndex(t => t.id === 'servidores');

/** The index of the tier of a device type; an unknown type counts as «otro», a server. */
export function tierOf(tipo: string): number {
  const index = TIERS.findIndex(t => t.tipos.includes(tipo));
  return index < 0 ? SERVERS_TIER : index;
}

/** Devices that work as one and are drawn together, inside a box with `nombre` on top. */
export interface PeerSet { id: string; nombre: string; miembros: string[] }

/** Union-find over device ids: `join` puts two devices in the same set, `find` names the set of a device. */
function disjointSets() {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const up = parent.get(id) ?? id;
    if (up === id) return id;
    const root = find(up);
    parent.set(id, root);
    return root;
  };
  const join = (a: string, b: string) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(ra, rb);
  };
  return { find, join };
}

/**
 * Every group with members on the map, under its name, and then each run of devices joined by HA or stack links
 * that no group already holds together, named «HA» (or «Stack» when only stack links join them).
 */
export function peerSets({ equipos, enlaces, grupos }: Topology): PeerSet[] {
  const known = new Set(equipos.map(d => d.id));
  const groups = grupos.map(g => ({ id: `grupo:${g.id}`, nombre: g.nombre, miembros: [...new Set(g.miembros.filter(m => known.has(m)))] }))
    .filter(g => g.miembros.length > 0);
  const together = (a: string, b: string) => grupos.some(g => g.miembros.includes(a) && g.miembros.includes(b));
  const loose = enlaces.filter(l => isPeerLink(l) && l.a.equipo !== l.b.equipo && known.has(l.a.equipo) && known.has(l.b.equipo)
    && !together(l.a.equipo, l.b.equipo));
  const sets = disjointSets();
  for (const l of loose) sets.join(l.a.equipo, l.b.equipo);
  const runs = new Map<string, { miembros: string[]; ha: boolean }>();
  for (const l of loose) {
    const run = runs.get(sets.find(l.a.equipo)) ?? { miembros: [], ha: false };
    for (const id of [l.a.equipo, l.b.equipo]) if (!run.miembros.includes(id)) run.miembros.push(id);
    run.ha ||= l.tipo === 'ha';
    runs.set(sets.find(l.a.equipo), run);
  }
  const pairs = [...runs.values()].map(r => ({ id: `${r.ha ? 'ha' : 'stack'}:${[...r.miembros].sort().join('+')}`, nombre: r.ha ? 'HA' : 'Stack', miembros: r.miembros }));
  return [...groups, ...pairs];
}

const byName = (a: Device, b: Device) => a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id);

/**
 * Where each device goes when the map places them all by tiers, ignoring any `posicion`. Tiers go top to bottom
 * (see `TIERS`); inside a tier, a device that hangs from another device of the same tier goes on a lower sub-row.
 * Peers (a group, an HA pair, a stack) sit side by side on the lowest sub-row of their members. Each row is centred
 * and its runs ordered under the devices they hang from, so lines cross as little as possible.
 */
export function layoutByTiers(topology: Topology): Map<string, Position> {
  const { equipos, enlaces } = topology;
  const peers = disjointSets();
  for (const set of peerSets(topology)) for (const id of set.miembros) peers.join(set.miembros[0], id);
  const positions = new Map<string, Position>();
  // Average left edge of the devices a run hangs from that are already placed; a run that hangs from none goes last.
  const anchor = (run: Device[]) => {
    const xs = run.flatMap(d => upstreamOf(enlaces, d.id)).flatMap(id => positions.get(id)?.x ?? []);
    return xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : Number.POSITIVE_INFINITY;
  };
  const placeRow = (runs: Device[][], y: number) => {
    const ordered = runs.map(run => ({ run, key: anchor(run) })).sort((a, b) => (a.key - b.key) || byName(a.run[0], b.run[0])).map(r => r.run);
    const count = ordered.reduce((sum, run) => sum + run.length, 0);
    let x = -Math.round(((count - 1) * GRID.col + (ordered.length - 1) * UNIT_GAP) / 2);
    for (const run of ordered) {
      for (const d of run) { positions.set(d.id, { x, y }); x += GRID.col; }
      x += UNIT_GAP;
    }
  };
  let y = 0;
  TIERS.forEach((_, tier) => {
    const members = equipos.filter(d => tierOf(d.tipo) === tier);
    if (!members.length) return;
    // Sub-rows follow only the hierarchical links between devices of this tier.
    const levelOf = levelFinder({ ...topology, equipos: members });
    const runs = new Map<string, Device[]>();
    for (const d of members) runs.set(peers.find(d.id), [...(runs.get(peers.find(d.id)) ?? []), d]);
    const rows = new Map<number, Device[][]>();
    for (const run of runs.values()) {
      const row = Math.max(...run.map(d => levelOf(d.id)));
      rows.set(row, [...(rows.get(row) ?? []), [...run].sort(byName)]);
    }
    const order = [...rows.keys()].sort((a, b) => a - b);
    order.forEach((row, index) => placeRow(rows.get(row)!, y + index * GRID.row));
    y += order.length * GRID.row + TIER_GAP;
  });
  return positions;
}

const whole = (position: Position): Position => ({ x: Math.round(position.x), y: Math.round(position.y) });
const isPlace = (position: Position | undefined): position is Position => !!position && Number.isFinite(position.x) && Number.isFinite(position.y);

/**
 * Where each device goes: its own `posicion` when it has one; the others by tiers (see `layoutByTiers`), below the
 * devices the user placed so they never land on top of them.
 */
export function layoutDevices(topology: Topology): Map<string, Position> {
  const positions = new Map<string, Position>();
  const unplaced: Device[] = [];
  for (const d of topology.equipos) {
    if (d.posicion) positions.set(d.id, d.posicion);
    else unplaced.push(d);
  }
  if (!unplaced.length) return positions;
  const placedYs = [...positions.values()].filter(isPlace).map(p => p.y);
  const below = placedYs.length ? Math.max(...placedYs) + GRID.row + TIER_GAP : 0;
  for (const [id, p] of layoutByTiers({ ...topology, equipos: unplaced })) positions.set(id, { x: p.x, y: p.y + below });
  return positions;
}

/** Every device with the place the tier layout gives it, those placed by the user included: «Colocar por capas». */
export function arrangeByTiers(topology: Topology): Device[] {
  const positions = layoutByTiers(topology);
  return topology.equipos.map(d => ({ ...d, posicion: whole(positions.get(d.id)!) }));
}

/** The name of each tier that has devices, at the left edge of the map and at the height of its topmost device. */
export function tierLabels(equipos: Device[], positions: Map<string, Position>): { id: string; nombre: string; x: number; y: number }[] {
  const placed = equipos.filter(d => isPlace(positions.get(d.id)));
  if (!placed.length) return [];
  const left = Math.min(...placed.map(d => positions.get(d.id)!.x)) - LABEL_ROOM;
  return TIERS.flatMap((tier, index) => {
    const ys = placed.filter(d => tierOf(d.tipo) === index).map(d => positions.get(d.id)!.y);
    return ys.length ? [{ id: tier.id, nombre: tier.nombre, x: left, y: Math.min(...ys) }] : [];
  });
}

export interface Rect { x: number; y: number; width: number; height: number }
export interface GroupBox extends Rect { id: string; nombre: string; miembros: string[] }

/** A box around the members of each peer set (see `peerSets`), with room on top for its name. */
export function groupBoxes(topology: Topology, rectOf: (id: string) => Rect | undefined): GroupBox[] {
  return peerSets(topology).flatMap(set => {
    const rects = set.miembros.flatMap(id => rectOf(id) ?? []);
    if (!rects.length) return [];
    const left = Math.min(...rects.map(r => r.x)) - BOX_PADDING.side;
    const top = Math.min(...rects.map(r => r.y)) - BOX_PADDING.top;
    const right = Math.max(...rects.map(r => r.x + r.width)) + BOX_PADDING.side;
    const bottom = Math.max(...rects.map(r => r.y + r.height)) + BOX_PADDING.bottom;
    return [{ ...set, x: left, y: top, width: right - left, height: bottom - top }];
  });
}

export type Side = 'top' | 'bottom' | 'left' | 'right';
export interface EdgeEnds { source: string; sourceHandle: Side; target: string; targetHandle: Side }

/**
 * Where the line of a link starts and ends. A hierarchical link leaves the top of the device that hangs (`a`) and
 * enters the bottom of the one above (`b`); HA and stack run sideways from the left peer to the right one;
 * management and power go up from the lower device to the higher one.
 */
export function edgeEnds(link: Link, positionOf: (id: string) => Position | undefined): EdgeEnds {
  const [a, b] = [link.a.equipo, link.b.equipo];
  if (isHierarchical(link)) return { source: a, sourceHandle: 'top', target: b, targetHandle: 'bottom' };
  const pa = positionOf(a) ?? { x: 0, y: 0 };
  const pb = positionOf(b) ?? { x: 0, y: 0 };
  if (isPeerLink(link)) {
    const [left, right] = pa.x <= pb.x ? [a, b] : [b, a];
    return { source: left, sourceHandle: 'right', target: right, targetHandle: 'left' };
  }
  const [lower, upper] = pa.y >= pb.y ? [a, b] : [b, a];
  return { source: lower, sourceHandle: 'top', target: upper, targetHandle: 'bottom' };
}

/**
 * The ends of a line plus where it attaches: `sourceShift` and `targetShift` move each end along its side (x for top
 * and bottom, y for left and right), `bend` moves the middle stretch of a vertical line up or down, and `sourceSlot`
 * is the place of the line among those leaving the same side of its source.
 */
export interface Route extends EdgeEnds { sourceShift: number; targetShift: number; bend: number; sourceSlot: number }

/** `count` spots spread evenly around the middle of a side, at most `step` apart and within `span`. */
const spots = (count: number, step: number, span: number) => {
  const gap = count > 1 ? Math.min(step, span / (count - 1)) : 0;
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * gap);
};

/**
 * Where every line attaches. The lines on one side of a device each get their own spot, ordered by where the device
 * at the other end is (left to right on top and bottom, top to bottom on the sides), so a line to a device on the
 * right leaves from the right and two links between the same pair never share a spot. Vertical lines between the
 * same two rows bend at different heights, so the middle stretches of crossing lines never lie on top of each other.
 */
export function routeEdges(enlaces: Link[], positionOf: (id: string) => Position | undefined): Map<string, Route> {
  const at = (id: string) => positionOf(id) ?? { x: 0, y: 0 };
  const ends = enlaces.map((link, index) => ({ link, index, ...edgeEnds(link, positionOf) }));
  const routes = new Map<string, Route>(ends.map(({ link, index: _, ...e }) => [link.id, { ...e, sourceShift: 0, targetShift: 0, bend: 0, sourceSlot: 0 }]));
  // Every end of a line on one side of a device: which line, which end and the device at the other end.
  const sides = new Map<string, { id: string; end: 'source' | 'target'; other: string; index: number; vertical: boolean }[]>();
  for (const e of ends) {
    for (const [end, device, side, other] of [['source', e.source, e.sourceHandle, e.target], ['target', e.target, e.targetHandle, e.source]] as const) {
      const key = JSON.stringify([device, side]);
      sides.set(key, [...(sides.get(key) ?? []), { id: e.link.id, end, other, index: e.index, vertical: side === 'top' || side === 'bottom' }]);
    }
  }
  for (const attached of sides.values()) {
    const vertical = attached[0].vertical;
    const along = (id: string) => (vertical ? at(id).x : at(id).y);
    const ordered = [...attached].sort((a, b) => (along(a.other) - along(b.other)) || (a.index - b.index));
    const shifts = vertical ? spots(ordered.length, SLOT_STEP, SLOT_SPAN) : spots(ordered.length, SIDE_SLOT_STEP, SIDE_SLOT_SPAN);
    ordered.forEach((a, i) => {
      const route = routes.get(a.id)!;
      if (a.end === 'source') { route.sourceShift = shifts[i]; route.sourceSlot = i; } else route.targetShift = shifts[i];
    });
  }
  // Vertical lines whose middles fall in the same band between two rows each get their own height to bend at,
  // ordered by where they arrive so lines that run side by side keep their order.
  const bands = new Map<number, Route[]>();
  for (const route of routes.values()) {
    if (route.sourceHandle !== 'top') continue;
    const key = Math.round((at(route.source).y + at(route.target).y) / 2 / BAND);
    bands.set(key, [...(bands.get(key) ?? []), route]);
  }
  for (const band of bands.values()) {
    const arrival = (r: Route) => at(r.target).x + r.targetShift;
    const heights = spots(band.length, BEND_STEP, BEND_SPAN);
    [...band].sort((a, b) => arrival(a) - arrival(b)).forEach((route, i) => { route.bend = heights[i]; });
  }
  return routes;
}

export interface EdgeGeometry {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
  /** Height of the middle stretch of a vertical line. */
  centerY?: number;
  /** Where the label of the line goes: by its source end, one label higher for each line before it on that side. */
  label: Position;
}

/** The points of a line once its route is applied to the handle positions React Flow gives. */
export function edgeGeometry(handles: { sourceX: number; sourceY: number; targetX: number; targetY: number }, route: Route): EdgeGeometry {
  const lift = LABEL_LIFT + route.sourceSlot * LABEL_STEP;
  if (route.sourceHandle === 'top' || route.sourceHandle === 'bottom') {
    const sourceX = handles.sourceX + route.sourceShift;
    return {
      sourceX, sourceY: handles.sourceY, targetX: handles.targetX + route.targetShift, targetY: handles.targetY,
      centerY: (handles.sourceY + handles.targetY) / 2 + route.bend,
      label: { x: sourceX, y: handles.sourceY - lift },
    };
  }
  const sourceY = handles.sourceY + route.sourceShift;
  return {
    sourceX: handles.sourceX, sourceY, targetX: handles.targetX, targetY: handles.targetY + route.targetShift,
    label: { x: (handles.sourceX + handles.targetX) / 2, y: sourceY - lift },
  };
}

/** The accessible name of a line: «A – B: tipo». */
export const linkName = (link: Link, nameOf: (id: string) => string) => `${nameOf(link.a.equipo)} – ${nameOf(link.b.equipo)}: ${LINK_TYPE_NAMES[link.tipo]}`;

/**
 * The outlet and the power supply of a power link as its line shows them, the outlet first: «Toma 3 · Fuente 1». A
 * value that already starts with its word («Fuente 1») is shown as it is. Empty when neither is set.
 */
export function powerLabel(link: Pick<Link, 'a' | 'b'>, roles: { a: PowerRole; b: PowerRole }): string {
  const named = (role: PowerRole, value: string) => {
    const word = role === 'toma' ? 'Toma' : 'Fuente';
    return value.toLowerCase().startsWith(word.toLowerCase()) ? value : `${word} ${value}`;
  };
  return (['a', 'b'] as const).filter(side => link[side].puerto?.trim())
    .sort((x, y) => Number(roles[x] !== 'toma') - Number(roles[y] !== 'toma'))
    .map(side => named(roles[side], link[side].puerto!.trim())).join(' · ');
}

/** Width of every device in the «Energía» view, so its short lines land exactly where the layout puts them. */
export const POWER_NODE = { width: 170 } as const;
/** Height of a regleta bar in the «Energía» view. */
export const BAR_HEIGHT = 14;
/** «Energía» view: room per device, between the devices of two bars, top of the bars, between lanes and down to the devices. */
const POWER_COL = 200;
const POWER_SEGMENT_GAP = 60;
const POWER_BAR_TOP = 170;
const POWER_LANE = 40;
const POWER_DEVICE_GAP = 70;
/** Room between the devices on power and the row of devices with no power link. */
const POWER_UNPOWERED_GAP = 130;
/** Height at which lines that go up to a SAI turn sideways: below the SAIs and above the bars. */
const POWER_BEND_Y = 125;
/** How far a bar reaches past the spot where a line meets it, and the spacing of the lines on top of a device or a bar. */
const POWER_PAD = 12;
const POWER_ATTACH_STEP = 48;
const POWER_BAR_ATTACH_STEP = 40;

/** A regleta drawn as a horizontal bar: `x`, `y` is its top-left corner. */
export interface PowerBar { id: string; x: number; y: number; width: number }
/**
 * The line of a power link: from the top of `lower` (the device fed, or a regleta) at `lowerX` up to the bottom of
 * `upper` (what feeds it) at `upperX`, turning sideways at `bendY` when the two x differ.
 */
export interface PowerEdge { id: string; lower: string; upper: string; lowerX: number; upperX: number; bendY: number }
/**
 * The «Energía» view: where each SAI and device goes (by id), the regletas as bars, one line per power link, and the
 * devices with no power link, which go on a row of their own at the bottom so they can still be joined.
 */
export interface PowerLayout { positions: Map<string, Position>; bars: PowerBar[]; edges: PowerEdge[]; unpowered: string[] }

/**
 * The «Energía» view as a single-line power diagram, worked out from the power links alone and never saved: SAIs on
 * top, each regleta below as a bar spanning the devices it feeds, and those devices below the bars. Each bar sits next
 * to the bar it shares most devices with; a device fed by two bars sits between them, and a device with a cable
 * straight to a SAI sits at the end of its bar, so every line goes straight up without running under another bar.
 * Bars that would overlap (several devices shared by the same two bars) go on separate lanes. Devices with no power
 * link at all go on a row of their own below and are listed in `unpowered`. The `posicion` of each device is never
 * read or changed.
 */
export function layoutPower(topology: Topology): PowerLayout {
  const cables = drawnLinks(topology).filter(l => l.tipo === 'energia' && l.a.equipo !== l.b.equipo);
  const wired = new Set(cables.flatMap(l => [l.a.equipo, l.b.equipo]));
  const sorted = [...topology.equipos].sort(byName);
  const sais = sorted.filter(d => d.tipo === 'sai').map(d => d.id);
  const regletas = sorted.filter(d => d.tipo === 'regleta').map(d => d.id);
  const loads = sorted.filter(d => !isPowerSupplier(d.tipo) && wired.has(d.id)).map(d => d.id);
  const unpowered = topology.equipos.filter(d => !isPowerSupplier(d.tipo) && !wired.has(d.id)).map(d => d.id);
  const sourceOf = new Map(cables.map(l => [l.id, powerSourceOf(topology, l)]));
  const other = (l: Link, id: string) => (l.a.equipo === id ? l.b.equipo : l.a.equipo);
  const feeders = new Map(loads.map(id => [id, powerFeedersOf(topology, id)]));
  const width = POWER_NODE.width;

  // Bars in a row, each next to the one it shares most devices with, so shared devices can sit between them.
  const sharing = (r1: string, r2: string) => loads.filter(id => feeders.get(id)!.includes(r1) && feeders.get(id)!.includes(r2)).length;
  const barOrder: string[] = [];
  const pending = [...regletas];
  while (pending.length) {
    const last = barOrder[barOrder.length - 1];
    let best = 0;
    if (last) pending.forEach((r, i) => { if (sharing(last, r) > sharing(last, pending[best])) best = i; });
    barOrder.push(...pending.splice(best, 1));
  }
  const barIndex = new Map(barOrder.map((r, i) => [r, i]));
  const barsOf = (id: string) => feeders.get(id)!.filter(f => barIndex.has(f)).sort((a, b) => barIndex.get(a)! - barIndex.get(b)!);
  const saisOf = (id: string) => feeders.get(id)!.filter(f => sais.includes(f)).sort((a, b) => sais.indexOf(a) - sais.indexOf(b));
  // Left to right on top of a device: a device with one bar and a SAI leaves the SAI on its free left side; a device
  // between bars meets its first bar on the left, then its SAIs, then the next bars.
  const feederOrder = (id: string) => {
    const [first, ...rest] = barsOf(id);
    if (!first) return saisOf(id);
    return rest.length ? [first, ...saisOf(id), ...rest] : [...saisOf(id), first];
  };

  // One slot per device: for each bar, the devices with a SAI too, then the ones it alone feeds, then the ones shared
  // with a later bar; last, the devices fed straight by a SAI or by nobody.
  const xs = new Map<string, number>();
  const reserved = new Map<string, number>();
  let x = 0;
  const place = (id: string) => { xs.set(id, x); x += POWER_COL; };
  for (const r of barOrder) {
    const mine = loads.filter(id => barsOf(id)[0] === r);
    if (!mine.length) { reserved.set(r, x); x += POWER_COL; }
    const second = (id: string) => barIndex.get(barsOf(id)[1]) ?? -1;
    mine.filter(id => barsOf(id).length === 1 && feeders.get(id)!.length > 1).forEach(place);
    mine.filter(id => feeders.get(id)!.length === 1).forEach(place);
    mine.filter(id => barsOf(id).length > 1).sort((a, b) => second(a) - second(b)).forEach(place);
    x += POWER_SEGMENT_GAP;
  }
  const firstSai = (id: string) => (saisOf(id).length ? sais.indexOf(saisOf(id)[0]) : sais.length);
  loads.filter(id => !barsOf(id).length).sort((a, b) => firstSai(a) - firstSai(b)).forEach(place);

  // Where each feeding cable leaves the top of its device, and how far each bar has to reach to meet its cables.
  const attach = new Map<string, number>();
  const extents = new Map<string, { from: number; to: number }>();
  const stretch = (r: string, from: number, to: number) => {
    const e = extents.get(r);
    extents.set(r, e ? { from: Math.min(e.from, from), to: Math.max(e.to, to) } : { from, to });
  };
  for (const id of loads) {
    const order = feederOrder(id);
    const mine = cables.filter(l => (l.a.equipo === id || l.b.equipo === id) && sourceOf.get(l.id) === other(l, id))
      .sort((a, b) => order.indexOf(other(a, id)) - order.indexOf(other(b, id)));
    const shifts = spots(mine.length, POWER_ATTACH_STEP, width - 2 * POWER_PAD);
    const left = xs.get(id)!;
    mine.forEach((l, i) => {
      const at = left + width / 2 + shifts[i];
      attach.set(l.id, at);
      // The first cable's bar reaches the left edge of the device and the last one's its right edge.
      if (barIndex.has(other(l, id))) stretch(other(l, id), i === 0 ? left : at - POWER_PAD, i === mine.length - 1 ? left + width : at + POWER_PAD);
    });
  }
  for (const [r, at] of reserved) stretch(r, at, at + width);

  // Lanes: a bar goes on the lowest lane where it overlaps no other bar.
  const laneOf = new Map<string, number>();
  const laneEnds: number[] = [];
  for (const r of [...barOrder].sort((a, b) => extents.get(a)!.from - extents.get(b)!.from)) {
    const { from, to } = extents.get(r)!;
    let lane = laneEnds.findIndex(end => end + POWER_PAD <= from);
    if (lane < 0) lane = laneEnds.push(to) - 1;
    else laneEnds[lane] = to;
    laneOf.set(r, lane);
  }
  const lanes = Math.max(1, laneEnds.length);
  const deviceY = POWER_BAR_TOP + (lanes - 1) * POWER_LANE + BAR_HEIGHT + POWER_DEVICE_GAP;
  const bars: PowerBar[] = barOrder.map(r => {
    const { from, to } = extents.get(r)!;
    return { id: r, x: Math.round(from), y: POWER_BAR_TOP + (lanes - 1 - laneOf.get(r)!) * POWER_LANE, width: Math.round(to - from) };
  });
  const barById = new Map(bars.map(b => [b.id, b]));
  const positions = new Map<string, Position>(loads.map(id => [id, { x: xs.get(id)!, y: deviceY }]));
  const unpoweredY = deviceY + (loads.length ? POWER_UNPOWERED_GAP : 0);
  sorted.filter(d => unpowered.includes(d.id)).forEach((d, i) => positions.set(d.id, { x: i * POWER_COL, y: unpoweredY }));
  const centre = (id: string) => {
    const bar = barById.get(id);
    if (bar) return bar.x + bar.width / 2;
    const p = positions.get(id);
    return p ? p.x + width / 2 : undefined;
  };

  // SAIs on top, each over the middle of what it feeds, never on top of each other.
  const wish = sais.map(s => {
    const targets = cables.filter(l => sourceOf.get(l.id) === s).flatMap(l => attach.get(l.id) ?? centre(other(l, s)) ?? []);
    return { s, x: targets.length ? targets.reduce((sum, t) => sum + t, 0) / targets.length - width / 2 : Number.POSITIVE_INFINITY };
  }).sort((a, b) => a.x - b.x);
  let next = Number.NEGATIVE_INFINITY;
  for (const { s, x: wanted } of wish) {
    const at = Math.round(Number.isFinite(wanted) ? Math.max(wanted, next) : Number.isFinite(next) ? next : 0);
    positions.set(s, { x: at, y: 0 });
    next = at + POWER_COL;
  }

  // The lines: a device's cable goes straight up into its bar; cables up to a SAI each get their own spot on the bar
  // or device below and on the SAI, and their own height to turn sideways.
  const ends = cables.map(l => {
    const source = sourceOf.get(l.id);
    const [lower, upper] = source ? [other(l, source), source] : [l.a.equipo, l.b.equipo];
    return { id: l.id, lower, upper };
  });
  const lowerX = new Map<string, number>();
  for (const e of ends) {
    const bar = barById.get(e.lower);
    if (attach.has(e.id)) lowerX.set(e.id, attach.get(e.id)!);
    else if (bar) {
      const up = ends.filter(o => o.lower === e.lower && !attach.has(o.id)).sort((a, b) => (centre(a.upper) ?? 0) - (centre(b.upper) ?? 0));
      const shifts = spots(up.length, POWER_BAR_ATTACH_STEP, Math.max(0, bar.width - 2 * POWER_PAD));
      lowerX.set(e.id, bar.x + bar.width / 2 + shifts[up.indexOf(e)]);
    } else lowerX.set(e.id, centre(e.lower) ?? 0);
  }
  const upperX = new Map<string, number>();
  for (const e of ends) {
    if (barById.has(e.upper) && attach.has(e.id)) { upperX.set(e.id, lowerX.get(e.id)!); continue; }
    const arriving = ends.filter(o => o.upper === e.upper && !(barById.has(o.upper) && attach.has(o.id)))
      .sort((a, b) => lowerX.get(a.id)! - lowerX.get(b.id)!);
    const shifts = spots(arriving.length, SLOT_STEP, SLOT_SPAN);
    upperX.set(e.id, (centre(e.upper) ?? 0) + shifts[arriving.indexOf(e)]);
  }
  const turning = ends.filter(e => upperX.get(e.id) !== lowerX.get(e.id)).sort((a, b) => upperX.get(a.id)! - upperX.get(b.id)!);
  const heights = spots(turning.length, BEND_STEP, BEND_SPAN);
  const edges: PowerEdge[] = ends.map(e => ({
    ...e, lowerX: lowerX.get(e.id)!, upperX: upperX.get(e.id)!,
    bendY: turning.includes(e) ? POWER_BEND_Y + heights[turning.indexOf(e)] : deviceY - POWER_DEVICE_GAP / 2,
  }));
  return { positions, bars, edges, unpowered };
}

/** The link types of the lines on the map, once each, in the order of `LINK_TYPES`. */
export function linkTypesIn(topology: Topology): LinkType[] {
  const present = new Set(drawnLinks(topology).map(l => l.tipo));
  return LINK_TYPES.filter(t => present.has(t));
}

/** What the learner fills in for a link: its type and, as typed, the port on each side, the speed, VLANs and notes. */
export interface LinkDraft { tipo: LinkType; puertoA?: string; puertoB?: string; velocidad?: string; vlans?: string; notas?: string }

/** Only trunks and LAGs carry a list of VLANs. */
export const carriesVlans = (tipo: LinkType) => tipo === 'troncal' || tipo === 'lag';

/** A power cable carries no network data: no network ports, speed or VLANs; its ports hold the outlet and the power supply. */
export const carriesNetworkData = (tipo: LinkType) => tipo !== 'energia';

/** Why a link cannot be made: both ends on one device, or a hierarchical link opposite to one the pair already has. */
export type LinkRefusal = 'mismo-equipo' | 'sentido-contrario';

/**
 * Why a link of type `tipo` from `from` to `to` cannot be made, or null when it can. A hierarchical link makes `from`
 * hang from `to`, so it is refused when `to` already hangs from `from`; any other extra link between the pair is fine.
 * `ignore` leaves one link out of the check: the link being edited.
 */
export function linkRefusal({ enlaces }: Topology, from: string, to: string, tipo: LinkType, ignore?: string): LinkRefusal | null {
  if (from === to) return 'mismo-equipo';
  const opposite = isHierarchical({ tipo }) && enlaces.some(l => l.id !== ignore && isHierarchical(l) && l.a.equipo === to && l.b.equipo === from);
  return opposite ? 'sentido-contrario' : null;
}

const filled = (text?: string) => text?.trim() || undefined;
const end = (equipo: string, puerto?: string) => (filled(puerto) ? { equipo, puerto: filled(puerto) } : { equipo });

/** The fields of a link as the draft gives them: empty texts left out, VLANs only on trunks and LAGs, no speed on power links. */
function linkData(from: string, to: string, { tipo, puertoA, puertoB, velocidad, vlans, notas }: LinkDraft): NewLink {
  const link: NewLink = { a: end(from, puertoA), b: end(to, puertoB), tipo };
  if (carriesNetworkData(tipo) && filled(velocidad)) link.velocidad = filled(velocidad);
  if (carriesVlans(tipo) && filled(vlans)) link.vlans = filled(vlans);
  if (filled(notas)) link.notas = filled(notas);
  return link;
}

/**
 * The link the learner drew from `from` to `to`, with what the form says (a `datos` link when nothing is chosen):
 * `from` is its `a` end, so for hierarchical types it hangs from `to`. Null when `linkRefusal` refuses it.
 */
export function connectDevices(topology: Topology, from: string, to: string, draft: LinkDraft = { tipo: 'datos' }): NewLink | null {
  return linkRefusal(topology, from, to, draft.tipo) ? null : linkData(from, to, draft);
}

/** `link` with what the ficha says: the same id and devices, everything else from the draft. */
export function editLink(link: Link, draft: LinkDraft): Link {
  return { id: link.id, ...linkData(link.a.equipo, link.b.equipo, draft) };
}

/** The draft that shows `link` as it is stored. */
export const draftOf = (link: Link): LinkDraft => ({
  tipo: link.tipo, puertoA: link.a.puerto ?? '', puertoB: link.b.puerto ?? '', velocidad: link.velocidad ?? '', vlans: link.vlans ?? '', notas: link.notas ?? '',
});

/** The first of `ids` that already belongs to a group, with that group; null when none does, so they can be grouped. */
export function groupRefusal({ grupos }: Topology, ids: string[]): { equipo: string; grupo: DeviceGroup } | null {
  for (const equipo of ids) {
    const grupo = groupOf(grupos, equipo);
    if (grupo) return { equipo, grupo };
  }
  return null;
}

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
