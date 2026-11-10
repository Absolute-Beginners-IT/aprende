import { GROUP_TYPES, LINK_TYPES, type Device, type DeviceGroup, type Link, type LinkType, type Topology } from './types';

// The topology of «Mi infraestructura»: devices, links of their own between them and groups of devices.
// The first version of the inventory only had `uplinks` on each device; it is read here and turned into links.

/** A device as the first version of the inventory stored it, and as the CSV still describes it: with the ids it hangs from. */
export type DeviceV1 = Device & { uplinks?: string[] };

/** A link about to be stored: it gets its id when the change is applied. */
export type NewLink = Omit<Link, 'id'>;

/** One change to the topology, applied and stored as a whole: removals first, then saves and new links. */
export interface TopologyChange {
  /** Devices saved as given: a known one keeps its place, a new one goes last. */
  saveDevices?: Device[];
  /** Devices removed together with their links and their place in every group. */
  removeDevices?: string[];
  addLinks?: NewLink[];
  removeLinks?: string[];
}

export const emptyTopology = (): Topology => ({ equipos: [], enlaces: [], grupos: [] });

// For these types `b` is what `a` hangs from: levels and deployment order follow them. The others join peers or carry
// power and management, with no side above the other.
const HIERARCHICAL: ReadonlySet<LinkType> = new Set<LinkType>(['datos', 'troncal', 'lag', 'wan', 'almacenamiento']);

export const isHierarchical = (link: Pick<Link, 'tipo'>) => HIERARCHICAL.has(link.tipo);

const unique = (ids: string[]) => [...new Set(ids)];

/** The devices `id` hangs from through hierarchical links, once each, whether or not they are still in the inventory. */
export const upstreamOf = (enlaces: Link[], id: string) => unique(enlaces.filter(l => isHierarchical(l) && l.a.equipo === id).map(l => l.b.equipo));

/** The devices that hang from `id` through hierarchical links, once each. */
export const downstreamOf = (enlaces: Link[], id: string) => unique(enlaces.filter(l => isHierarchical(l) && l.b.equipo === id).map(l => l.a.equipo));

/** The id of a new link from `a` to `b`: named after its ends, with the first free number when that name is taken. */
export function nextLinkId(taken: ReadonlySet<string>, a: string, b: string): string {
  const base = `${a}--${b}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** `enlaces` followed by `added`, each new link with an id no other link has. */
function withNewLinks(enlaces: Link[], added: NewLink[]): Link[] {
  const taken = new Set(enlaces.map(l => l.id));
  return [...enlaces, ...added.map(l => {
    const id = nextLinkId(taken, l.a.equipo, l.b.equipo);
    taken.add(id);
    return { id, ...l };
  })];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string';
const isDevice = (v: unknown): v is Device => isRecord(v) && isText(v.id);
const isEnd = (v: unknown) => isRecord(v) && isText(v.equipo);
const isLink = (v: unknown): v is Link => isRecord(v) && isText(v.id) && isEnd(v.a) && isEnd(v.b) && (LINK_TYPES as readonly unknown[]).includes(v.tipo);
const isGroup = (v: unknown): v is DeviceGroup => isRecord(v) && isText(v.id) && isText(v.nombre)
  && (GROUP_TYPES as readonly unknown[]).includes(v.tipo) && Array.isArray(v.miembros) && v.miembros.every(isText);

/**
 * The topology of a first-version inventory (a list of devices with `uplinks`): each uplink becomes a `datos` link from
 * the device to the one it hangs from. Repeated uplinks are dropped; uplinks to devices not in the list are kept, so
 * the analysis can still report them. Anything that is not a list of devices reads as an empty topology.
 */
export function fromInventoryV1(raw: unknown): Topology {
  if (!Array.isArray(raw)) return emptyTopology();
  const equipos: Device[] = [];
  const links: NewLink[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isDevice(item)) continue;
    const { uplinks, ...device } = item as DeviceV1;
    equipos.push(device);
    for (const to of Array.isArray(uplinks) ? uplinks.filter(isText) : []) {
      const pair = JSON.stringify([device.id, to]);
      if (seen.has(pair)) continue;
      seen.add(pair);
      links.push({ a: { equipo: device.id }, b: { equipo: to }, tipo: 'datos' });
    }
  }
  return { equipos, enlaces: withNewLinks([], links), grupos: [] };
}

/** The topology of a stored version 2 document; another version or foreign data reads as empty, malformed entries are left out. */
export function fromStoredTopology(raw: unknown): Topology {
  if (!isRecord(raw) || raw.version !== 2 || !Array.isArray(raw.equipos) || !Array.isArray(raw.enlaces) || !Array.isArray(raw.grupos)) return emptyTopology();
  return { equipos: raw.equipos.filter(isDevice), enlaces: raw.enlaces.filter(isLink), grupos: raw.grupos.filter(isGroup) };
}

/** The topology with `change` applied; `topology` itself is left untouched. */
export function applyTopologyChange(topology: Topology, change: TopologyChange): Topology {
  const removed = new Set(change.removeDevices ?? []);
  const droppedLinks = new Set(change.removeLinks ?? []);
  const incoming = new Map((change.saveDevices ?? []).map(d => [d.id, d]));
  const kept = topology.equipos.filter(d => !removed.has(d.id));
  const known = new Set(kept.map(d => d.id));
  return {
    equipos: [...kept.map(d => incoming.get(d.id) ?? d), ...[...incoming.values()].filter(d => !known.has(d.id))],
    enlaces: withNewLinks(
      topology.enlaces.filter(l => !droppedLinks.has(l.id) && !removed.has(l.a.equipo) && !removed.has(l.b.equipo)),
      change.addLinks ?? [],
    ),
    grupos: topology.grupos.map(g => (g.miembros.some(m => removed.has(m)) ? { ...g, miembros: g.miembros.filter(m => !removed.has(m)) } : g)),
  };
}

/**
 * The change that stores `rows` (devices of a CSV import) over `topology`. An overwritten device keeps its place on the
 * map; what it hangs from becomes exactly what its row says: hierarchical links still listed keep their type, the rest
 * go, and new targets get a `datos` link. Links that do not make it hang from anything are left as they are.
 */
export function importInventoryV1(topology: Topology, rows: DeviceV1[]): TopologyChange {
  const existing = new Map(topology.equipos.map(d => [d.id, d]));
  const saveDevices: Device[] = [];
  const removeLinks: string[] = [];
  const addLinks: NewLink[] = [];
  for (const { uplinks, ...device } of rows) {
    const posicion = existing.get(device.id)?.posicion;
    saveDevices.push(posicion ? { ...device, posicion } : device);
    const targets = unique(uplinks ?? []);
    const current = topology.enlaces.filter(l => isHierarchical(l) && l.a.equipo === device.id);
    removeLinks.push(...current.filter(l => !targets.includes(l.b.equipo)).map(l => l.id));
    for (const to of targets) {
      if (!current.some(l => l.b.equipo === to)) addLinks.push({ a: { equipo: device.id }, b: { equipo: to }, tipo: 'datos' });
    }
  }
  return { saveDevices, removeLinks, addLinks };
}
