import { carriedVlans, parseVlanList, trunkVlans, unknownListedVlans, vlanGaps, type CombinedPlan, type PlanLink } from '@shared/plan';
import type { Link, Topology } from '../../domain/types';
import { isHierarchical } from '../../domain/topology';
import { carriesVlans, drawnLinks } from '../../domain/infraMap';
import { gatewayHint, vlanColor } from './vlanCatalogue';

// The VLAN layers of the map («Capas») and the VLAN warnings of «Avisos», worked out from the stored plan as the map
// reads it (combined with the inventory) and the links of the inventory. Nothing here writes anything.

/** The switches of the inventory in the order the plan sees them (inventorySwitches in shared/plan). */
const switchesOf = (topology: Topology) => topology.equipos.filter(d => d.tipo === 'switch' && d.nombre.trim());

/**
 * The link of the inventory that stands for the plan's link between devices `x` and `y`: the first hierarchical link
 * from the first of the two (in inventory order) that hangs from the other, exactly as combineWithInventory picks it.
 */
function inventoryLinkBetween(topology: Topology, x: string, y: string): Link | undefined {
  const uplink = (child: string, parent: string) => topology.enlaces.find(l => isHierarchical(l) && l.a.equipo === child && l.b.equipo === parent);
  for (const device of switchesOf(topology)) {
    const link = device.id === x ? uplink(x, y) : device.id === y ? uplink(y, x) : undefined;
    if (link) return link;
  }
  return undefined;
}

/** The inventory link of each plan link, by plan link id; plan links the inventory does not join are left out. */
export function inventoryLinksOfPlan(topology: Topology, combined: Pick<CombinedPlan, 'plan'>): Map<string, Link> {
  const deviceOf = new Map(combined.plan.switches.map(s => [s.id, s.deviceId]));
  const found = new Map<string, Link>();
  for (const link of combined.plan.links) {
    const [x, y] = [deviceOf.get(link.a.switch), deviceOf.get(link.b.switch)];
    const stands = x && y ? inventoryLinkBetween(topology, x, y) : undefined;
    if (stands) found.set(link.id, stands);
  }
  return found;
}

const ipNumber = (address: string) => {
  const parts = address.trim().split('/')[0].split('.');
  return parts.length === 4 && parts.every(p => /^\d+$/.test(p) && Number(p) <= 255) ? parts.reduce((n, p) => n * 256 + Number(p), 0) : undefined;
};
const inSubnet = (address: string, subnet: string) => {
  const [network, prefix] = subnet.trim().split('/');
  const [ip, base] = [ipNumber(address), ipNumber(network ?? '')];
  if (ip === undefined || base === undefined || !/^\d+$/.test(prefix ?? '')) return false;
  const size = 2 ** (32 - Number(prefix));
  return Math.floor(ip / size) === Math.floor(base / size);
};

/** One VLAN of the plan as a layer of the map. */
export interface VlanLayer {
  id: number;
  name: string;
  color: string;
  /** Lines of the map that carry it. */
  links: ReadonlySet<string>;
  /** Devices that use it: the ends of those lines, switches with access ports in it and its gateway. */
  devices: ReadonlySet<string>;
  /** Access ports in this VLAN, by device id. */
  accessPorts: ReadonlyMap<string, number>;
  /** Devices whose address is this VLAN's gateway: the first address of its network or a switch's gateway in it. */
  gateways: ReadonlySet<string>;
  switches: number;
  trunks: number;
  gaps: number;
}

/** The plan as the layers read it; `mapVlans` are the «VLAN» fields of the map's links, by plan link id. */
type PlanView = Pick<CombinedPlan, 'plan' | 'mapVlans'>;

/** Each VLAN of the plan as a layer, in catalogue order, with the colour the catalogue gives it. */
export function vlanLayers(topology: Topology, combined: PlanView): VlanLayer[] {
  const { plan, mapVlans } = combined;
  const planVlans = plan.vlans.map(v => v.id);
  const planLinkOf = new Map<string, PlanLink>();
  for (const [planId, link] of inventoryLinksOfPlan(topology, combined)) {
    const planLink = plan.links.find(l => l.id === planId);
    if (planLink) planLinkOf.set(link.id, planLink);
  }
  const lines = drawnLinks(topology).filter(l => l.tipo !== 'energia');
  // A plan link carries what the guides allow on it; any other trunk or LAG of the map, what its own list says.
  const carried = new Map(lines.map(l => {
    const planLink = planLinkOf.get(l.id);
    if (planLink) return [l.id, carriedVlans(planLink, planVlans, mapVlans)];
    return [l.id, new Set(carriesVlans(l.tipo) ? trunkVlans(l.vlans, planVlans) : [])];
  }));
  const deviceOf = new Map(plan.switches.map(s => [s.id, s.deviceId]));
  const gaps = vlanGaps(plan, mapVlans);
  const byId = new Map(topology.equipos.map(d => [d.id, d]));

  return plan.vlans.map((vlan, index) => {
    const links = new Set(lines.filter(l => carried.get(l.id)?.has(vlan.id)).map(l => l.id));
    const accessPorts = new Map<string, number>();
    for (const port of plan.ports) {
      const device = deviceOf.get(port.switch);
      if (port.vlan === vlan.id && device) accessPorts.set(device, (accessPorts.get(device) ?? 0) + 1);
    }
    const subnet = vlan.subnet.trim();
    const addresses = new Set([gatewayHint(subnet), ...plan.switches.map(s => s.gateway.trim()).filter(g => subnet && inSubnet(g, subnet))].filter(Boolean));
    const gateways = new Set(topology.equipos.filter(d => d.ip && addresses.has(d.ip.trim().split('/')[0])).map(d => d.id));
    const devices = new Set([...lines.filter(l => links.has(l.id)).flatMap(l => [l.a.equipo, l.b.equipo]), ...accessPorts.keys(), ...gateways]);
    return {
      id: vlan.id, name: vlan.name, color: vlanColor(index), links, devices, accessPorts, gateways,
      switches: [...devices].filter(id => byId.get(id)?.tipo === 'switch').length,
      trunks: links.size,
      gaps: gaps.filter(g => g.vlan === vlan.id).length,
    };
  });
}

/** A warning about the VLANs of the trunks, for «Avisos» and the map. */
export interface VlanWarning {
  key: string;
  message: string;
  /** The VLAN that does not get through, for a gap. */
  vlan?: number;
  /** The line of the map it is about, if any. */
  linkId?: string;
  /** The switches it is about: for a gap, those whose access ports the VLAN does not reach. */
  deviceIds: string[];
  /** For a gap: add `vlan` to the «VLAN» field of the line `linkId`. */
  fix?: { linkId: string; vlan: number };
}

const listOf = (ids: number[]) => (ids.length > 1 ? `${ids.slice(0, -1).join(', ')} y ${ids[ids.length - 1]}` : String(ids[0]));
const portsText = (n: number) => (n === 1 ? '1 puerto de acceso' : `${n} puertos de acceso`);
/** What a line carries for the comparison of two lines of a pair: its list when it has a usable one, otherwise all. */
const listKey = (l: Link) => {
  const list = carriesVlans(l.tipo) ? parseVlanList(l.vlans ?? '') : undefined;
  return list?.ok && list.ids.length > 0 ? list.ids.join(', ') : 'todas';
};

/**
 * The VLAN warnings of the network: gaps (a VLAN with access ports on a switch that a trunk on its way to the core
 * does not carry), VLANs a trunk's list names that the plan does not have, and two lines between the same pair of
 * switches whose lists disagree (the commands use the first one, as the plan keeps one link per pair).
 */
export function vlanWarnings(topology: Topology, combined: PlanView, nameOf: (id: string) => string): VlanWarning[] {
  const { plan, mapVlans } = combined;
  const links = inventoryLinksOfPlan(topology, combined);
  const deviceOf = new Map(plan.switches.map(s => [s.id, s.deviceId]));
  const switchName = (id: string) => plan.switches.find(s => s.id === id)?.name || id;
  const between = (planLink: string) => {
    const link = plan.links.find(l => l.id === planLink);
    return link ? `${switchName(link.a.switch)} y ${switchName(link.b.switch)}` : '';
  };
  const warnings: VlanWarning[] = [];
  for (const gap of vlanGaps(plan, mapVlans)) {
    const line = links.get(gap.link);
    const names = gap.switches.map(switchName);
    const where = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
    warnings.push({
      key: `gap:${gap.link}:${gap.vlan}`,
      message: `La VLAN ${gap.vlan} no llega a ${where} (${portsText(gap.ports)}): la troncal entre ${between(gap.link)} no la deja pasar.`,
      vlan: gap.vlan,
      linkId: line?.id,
      deviceIds: gap.switches.flatMap(id => deviceOf.get(id) ?? []),
      fix: line && carriesVlans(line.tipo) ? { linkId: line.id, vlan: gap.vlan } : undefined,
    });
  }
  for (const { link, vlans } of unknownListedVlans(plan, mapVlans)) {
    const named = vlans.length > 1
      ? `las VLAN ${listOf(vlans)}, que no están en el plan: créalas en la pestaña «VLAN» o quítalas de la troncal.`
      : `la VLAN ${vlans[0]}, que no está en el plan: créala en la pestaña «VLAN» o quítala de la troncal.`;
    warnings.push({
      key: `unknown:${link}`,
      message: `La troncal entre ${between(link)} deja pasar ${named}`,
      linkId: links.get(link)?.id,
      deviceIds: [],
    });
  }
  // Lines between two switches that could stand for the plan's link of that pair: the first one does.
  const switchIds = new Set(switchesOf(topology).map(d => d.id));
  const pairs = new Map<string, Link[]>();
  for (const l of drawnLinks(topology)) {
    if (!isHierarchical(l) || !switchIds.has(l.a.equipo) || !switchIds.has(l.b.equipo) || l.a.equipo === l.b.equipo) continue;
    const key = [l.a.equipo, l.b.equipo].sort().join('\u0000');
    pairs.set(key, [...(pairs.get(key) ?? []), l]);
  }
  for (const [key, group] of pairs) {
    const lists = [...new Set(group.map(listKey))];
    if (lists.length < 2) continue;
    const [x, y] = key.split('\u0000');
    const first = inventoryLinkBetween(topology, x, y) ?? group[0];
    warnings.push({
      key: `pair:${key}`,
      message: `Hay ${group.length} enlaces entre ${nameOf(x)} y ${nameOf(y)} con VLAN distintas (${lists.join(' / ')}): los comandos usan solo el primero, el de ${listKey(first) === 'todas' ? 'todas las VLAN' : `las VLAN ${listKey(first)}`}.`,
      linkId: first.id,
      deviceIds: [x, y],
    });
  }
  return warnings;
}
