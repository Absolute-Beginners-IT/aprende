import { GROUP_TYPES, LINK_TYPES, type Device, type DeviceGroup, type GroupType, type Link, type LinkType, type Topology } from './types';

// The topology of «Mi infraestructura»: devices, links of their own between them and groups of devices.
// The first version of the inventory only had `uplinks` on each device; it is read here and turned into links.

/** A device as the first version of the inventory stored it, and as the CSV still describes it: with the ids it hangs from. */
export type DeviceV1 = Device & { uplinks?: string[] };

/** A link about to be stored: it gets its id when the change is applied. */
export type NewLink = Omit<Link, 'id'>;

/** A group about to be stored: it gets its id when the change is applied. */
export type NewGroup = Omit<DeviceGroup, 'id'>;

/** One change to the topology, applied and stored as a whole: removals first, then saves, updates and new entries. */
export interface TopologyChange {
  /** The whole topology stored instead of the current one, before the rest of the change (a JSON import). */
  replace?: Topology;
  /** Devices saved as given: a known one keeps its place, a new one goes last. */
  saveDevices?: Device[];
  /** Devices removed together with their links and their place in every group. */
  removeDevices?: string[];
  addLinks?: NewLink[];
  removeLinks?: string[];
  /** Links stored again as given, in their place; an id that is not stored is ignored. */
  updateLinks?: Link[];
  addGroups?: NewGroup[];
  /** Groups stored again as given, in their place; an id that is not stored is ignored. */
  saveGroups?: DeviceGroup[];
  removeGroups?: string[];
}

export const emptyTopology = (): Topology => ({ equipos: [], enlaces: [], grupos: [] });

// For these types `b` is what `a` hangs from: levels and deployment order follow them. The others join peers or carry
// power and management, with no side above the other.
const HIERARCHICAL: ReadonlySet<LinkType> = new Set<LinkType>(['datos', 'troncal', 'lag', 'wan', 'almacenamiento']);

export const isHierarchical = (link: Pick<Link, 'tipo'>) => HIERARCHICAL.has(link.tipo);

/** Links that join peers working as one, side by side: an HA pair or a stack. */
export const isPeerLink = (link: Pick<Link, 'tipo'>) => link.tipo === 'ha' || link.tipo === 'stack';

/** What a power link end is: the outlet of the SAI or regleta that feeds it («toma»), or a power supply of the device fed. */
export type PowerRole = 'toma' | 'fuente';

// How strongly each device type feeds the others over a power link: the SAI feeds the regleta, the regleta the rest.
const POWER_RANK: Record<string, number> = { sai: 2, regleta: 1 };
const powerRank = (tipo?: string) => (tipo ? POWER_RANK[tipo] ?? 0 : 0);

/** Whether a device type gives power to what is plugged into it: a SAI or a regleta. */
export const isPowerSupplier = (tipo?: string) => powerRank(tipo) > 0;

/**
 * The end of a power link that feeds the other, from the types of its two devices (not from `a`/`b`): the SAI or the
 * regleta, the SAI when the other end is a regleta. Null when both ends are of the same kind.
 */
export function powerSourceSide(tipoA?: string, tipoB?: string): 'a' | 'b' | null {
  const [ra, rb] = [powerRank(tipoA), powerRank(tipoB)];
  return ra > rb ? 'a' : rb > ra ? 'b' : null;
}

/** What each end of a power link is: the feeding end and any SAI or regleta with no clear source are outlets. */
export function powerEndRoles(tipoA?: string, tipoB?: string): { a: PowerRole; b: PowerRole } {
  const side = powerSourceSide(tipoA, tipoB);
  const role = (end: 'a' | 'b', tipo?: string): PowerRole => (side ? (side === end ? 'toma' : 'fuente') : isPowerSupplier(tipo) ? 'toma' : 'fuente');
  return { a: role('a', tipoA), b: role('b', tipoB) };
}

/** The device that feeds the other over an `energia` link (see `powerSourceSide`); null for other links or with no source. */
export function powerSourceOf({ equipos }: Topology, link: Link): string | null {
  if (link.tipo !== 'energia') return null;
  const tipoOf = (id: string) => equipos.find(d => d.id === id)?.tipo;
  const side = powerSourceSide(tipoOf(link.a.equipo), tipoOf(link.b.equipo));
  return side ? link[side].equipo : null;
}

/** The SAIs and regletas of the inventory that feed `id` straight away over a power link, once each, in link order. */
export function powerFeedersOf(topology: Topology, id: string): string[] {
  const known = new Set(topology.equipos.map(d => d.id));
  const feeders = topology.enlaces.filter(l => l.a.equipo !== l.b.equipo && (l.a.equipo === id || l.b.equipo === id))
    .map(l => powerSourceOf(topology, l)).filter((source): source is string => !!source && source !== id && known.has(source));
  return [...new Set(feeders)];
}

/** The name of each link type as the learner reads it on the map and its legend. */
export const LINK_TYPE_NAMES: Record<LinkType, string> = {
  datos: 'Datos', troncal: 'Troncal', lag: 'LAG', ha: 'HA', stack: 'Stack', wan: 'WAN', almacenamiento: 'Almacenamiento', gestion: 'Gestión', energia: 'Energía',
};

/** The name of each group type as the learner reads it in the forms and the ficha. */
export const GROUP_TYPE_NAMES: Record<GroupType, string> = { ha: 'HA', stack: 'Stack', cluster: 'Clúster' };

/** The group `id` belongs to; a device is in one group at most. */
export const groupOf = (grupos: DeviceGroup[], id: string) => grupos.find(g => g.miembros.includes(id));

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

/** The document stored and exported as JSON: `{ version: 2, equipos, enlaces, grupos }`. */
export const topologyDocument = (topology: Topology) => ({ version: 2 as const, equipos: topology.equipos, enlaces: topology.enlaces, grupos: topology.grupos });

/** Why a JSON file cannot be imported: it is not JSON, it is not a version 2 document, or it has no devices. */
export type TopologyDocumentRefusal = 'ilegible' | 'ajeno' | 'vacio';

/** The topology in the text of an exported JSON document, read with the same rules as what is stored. */
export function readTopologyDocument(text: string): { ok: true; topology: Topology } | { ok: false; reason: TopologyDocumentRefusal } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, reason: 'ilegible' }; }
  if (!isRecord(raw) || raw.version !== 2 || !Array.isArray(raw.equipos) || !Array.isArray(raw.enlaces) || !Array.isArray(raw.grupos)) return { ok: false, reason: 'ajeno' };
  const topology = fromStoredTopology(raw);
  return topology.equipos.length ? { ok: true, topology } : { ok: false, reason: 'vacio' };
}

/** The topology with `change` applied; `topology` itself is left untouched. */
export function applyTopologyChange(current: Topology, change: TopologyChange): Topology {
  const topology = change.replace ?? current;
  const removed = new Set(change.removeDevices ?? []);
  const droppedLinks = new Set(change.removeLinks ?? []);
  const incoming = new Map((change.saveDevices ?? []).map(d => [d.id, d]));
  const kept = topology.equipos.filter(d => !removed.has(d.id));
  const known = new Set(kept.map(d => d.id));
  const updatedLinks = new Map((change.updateLinks ?? []).map(l => [l.id, l]));
  const droppedGroups = new Set(change.removeGroups ?? []);
  const savedGroups = new Map((change.saveGroups ?? []).map(g => [g.id, g]));
  const grupos = topology.grupos.filter(g => !droppedGroups.has(g.id)).map(g => savedGroups.get(g.id) ?? g);
  return {
    equipos: [...kept.map(d => incoming.get(d.id) ?? d), ...[...incoming.values()].filter(d => !known.has(d.id))],
    enlaces: withNewLinks(
      topology.enlaces.filter(l => !droppedLinks.has(l.id) && !removed.has(l.a.equipo) && !removed.has(l.b.equipo)).map(l => updatedLinks.get(l.id) ?? l),
      change.addLinks ?? [],
    ),
    grupos: withNewGroups(grupos, change.addGroups ?? [])
      .map(g => (g.miembros.some(m => removed.has(m)) ? { ...g, miembros: g.miembros.filter(m => !removed.has(m)) } : g)),
  };
}

/** `grupos` followed by `added`, each new group with the first free id `grupo-N`. */
function withNewGroups(grupos: DeviceGroup[], added: NewGroup[]): DeviceGroup[] {
  const taken = new Set(grupos.map(g => g.id));
  return [...grupos, ...added.map(g => {
    let n = 1;
    while (taken.has(`grupo-${n}`)) n++;
    const id = `grupo-${n}`;
    taken.add(id);
    return { id, ...g };
  })];
}

/**
 * The change that stores `rows` (devices of a CSV import) over `topology`. An overwritten device keeps its place on the
 * map; what it hangs from becomes exactly what its row says, in the row's order: hierarchical links still listed keep
 * their type, ports, speed, VLANs and notes, the rest go, and new targets get a `datos` link. Links that do not make it
 * hang from anything are left as they are.
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
    const newLink = (to: string): NewLink => ({ a: { equipo: device.id }, b: { equipo: to }, tipo: 'datos' });
    const kept = unique(current.map(l => l.b.equipo)).filter(to => targets.includes(to));
    const added = targets.filter(to => !kept.includes(to));
    if ([...kept, ...added].every((to, i) => to === targets[i])) {
      // The links it keeps are already in the row's order: leave them where they are and append the new ones.
      removeLinks.push(...current.filter(l => !targets.includes(l.b.equipo)).map(l => l.id));
      addLinks.push(...added.map(newLink));
    } else {
      // The row reorders them: store its hierarchical links again in the row's order, each kept one with all its data.
      removeLinks.push(...current.map(l => l.id));
      for (const to of targets) {
        const same = current.filter(l => l.b.equipo === to);
        addLinks.push(...(same.length ? same.map(({ id: _, ...data }) => data) : [newLink(to)]));
      }
    }
  }
  return { saveDevices, removeLinks, addLinks };
}
