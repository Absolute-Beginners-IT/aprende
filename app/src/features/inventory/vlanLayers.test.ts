import { describe, expect, it } from 'vitest';
import type { NetworkPlan } from '@shared/plan';
import type { Device, Link, Topology } from '../../domain/types';
import { inventoryLinksOfPlan, vlanLayers, vlanWarnings } from './vlanLayers';

const device = (id: string, tipo: string, ip?: string): Device =>
  ({ id, nombre: id.toUpperCase(), tipo, criticidad: 'Media', monitorizado: false, ...(ip && { ip }) });
const link = (id: string, a: string, b: string, tipo: Link['tipo'], vlans?: string): Link =>
  ({ id, a: { equipo: a }, b: { equipo: b }, tipo, ...(vlans !== undefined && { vlans }) });

// A firewall over the core; dist hangs from the core by two trunks; floor hangs from dist.
const topology = (): Topology => ({
  equipos: [device('fw', 'firewall', '192.168.10.1'), device('core', 'switch'), device('dist', 'switch'), device('floor', 'switch'), device('srv', 'servidor')],
  enlaces: [
    link('l0', 'core', 'fw', 'datos'),
    link('l1', 'dist', 'core', 'troncal', '10'),
    link('l1b', 'dist', 'core', 'lag', '10, 30'),
    link('l2', 'floor', 'dist', 'troncal'),
    link('l3', 'srv', 'floor', 'datos'),
  ],
  grupos: [],
});

const plan = (): NetworkPlan => ({
  version: 1,
  vlans: [
    { id: 10, name: 'USUARIOS', purpose: 'users', subnet: '192.168.10.0/24' },
    { id: 30, name: 'CAMARAS', purpose: 'cameras', subnet: '' },
  ],
  switches: ['core', 'dist', 'floor'].map(id => ({ id: `sw-${id}`, deviceId: id, name: id.toUpperCase(), platform: '', mgmtIp: '', gateway: '', bridge: '' })),
  links: [
    { id: 'ln-1', a: { switch: 'sw-core', interface: '' }, b: { switch: 'sw-dist', interface: '' }, nativeVlan: 1 },
    { id: 'ln-2', a: { switch: 'sw-dist', interface: '' }, b: { switch: 'sw-floor', interface: '' }, nativeVlan: 1 },
  ],
  ports: [
    { id: 'pt-1', switch: 'sw-floor', interface: 'gi1', vlan: 30 },
    { id: 'pt-2', switch: 'sw-floor', interface: 'gi2', vlan: 30 },
    { id: 'pt-3', switch: 'sw-dist', interface: 'gi3', vlan: 10 },
  ],
});
// What the plan repository reads: the first trunk of the pair gives the list, as combineWithInventory does.
const combined = () => ({ plan: plan(), mapVlans: new Map([['ln-1', '10']]) });
const nameOf = (id: string) => id.toUpperCase();

describe('inventoryLinksOfPlan', () => {
  it('maps each plan link to the first line of its pair, the one the plan reads', () => {
    const links = inventoryLinksOfPlan(topology(), combined());
    expect(links.get('ln-1')?.id).toBe('l1');
    expect(links.get('ln-2')?.id).toBe('l2');
  });
});

describe('vlanLayers', () => {
  it('lights the lines that carry each VLAN and the devices that use it, with its access ports and gateway', () => {
    const [users, cameras] = vlanLayers(topology(), combined());
    // l1 carries 10 (its list), l2 every VLAN (no list), l1b its own list; l0 and l3 are not trunks.
    expect([...users.links].sort()).toEqual(['l1', 'l1b', 'l2']);
    expect([...users.gateways]).toEqual(['fw']);
    expect([...users.devices].sort()).toEqual(['core', 'dist', 'floor', 'fw']);
    expect(Object.fromEntries(users.accessPorts)).toEqual({ dist: 1 });
    expect(users).toMatchObject({ id: 10, color: '#3b82f6', switches: 3, trunks: 3, gaps: 0 });

    expect([...cameras.links].sort()).toEqual(['l1b', 'l2']);
    expect(Object.fromEntries(cameras.accessPorts)).toEqual({ floor: 2 });
    expect(cameras).toMatchObject({ id: 30, switches: 3, trunks: 2, gaps: 1 });
  });

  it('lights every trunk for every VLAN when no trunk has a list, as before the lists', () => {
    const t = topology();
    t.enlaces = t.enlaces.map(l => ({ ...l, vlans: undefined }));
    const layers = vlanLayers(t, { plan: plan(), mapVlans: new Map() });
    expect(layers.map(l => [...l.links].sort())).toEqual([['l1', 'l1b', 'l2'], ['l1', 'l1b', 'l2']]);
    expect(layers.map(l => l.gaps)).toEqual([0, 0]);
  });
});

describe('vlanWarnings', () => {
  it('reports a gap with its fix on the line the plan reads, a VLAN the plan lacks and two lines of a pair that disagree', () => {
    const c = combined();
    c.mapVlans.set('ln-2', '10, 40');
    const t = topology();
    t.enlaces = t.enlaces.map(l => (l.id === 'l2' ? { ...l, vlans: '10, 40' } : l));
    const warnings = vlanWarnings(t, c, nameOf);
    expect(warnings).toEqual([
      {
        key: 'gap:ln-1:30', vlan: 30, linkId: 'l1', deviceIds: ['floor'], fix: { linkId: 'l1', vlan: 30 },
        message: 'La VLAN 30 no llega a FLOOR (2 puertos de acceso): la troncal entre CORE y DIST no la deja pasar.',
      },
      {
        key: 'gap:ln-2:30', vlan: 30, linkId: 'l2', deviceIds: ['floor'], fix: { linkId: 'l2', vlan: 30 },
        message: 'La VLAN 30 no llega a FLOOR (2 puertos de acceso): la troncal entre DIST y FLOOR no la deja pasar.',
      },
      {
        key: 'unknown:ln-2', linkId: 'l2', deviceIds: [],
        message: 'La troncal entre DIST y FLOOR deja pasar la VLAN 40, que no está en el plan: créala en la pestaña «VLAN» o quítala de la troncal.',
      },
      {
        key: 'pair:core\u0000dist', linkId: 'l1', deviceIds: ['core', 'dist'],
        message: 'Hay 2 enlaces entre CORE y DIST con VLAN distintas (10 / 10, 30): los comandos usan solo el primero, el de las VLAN 10.',
      },
    ]);
  });

  it('has nothing to say when no trunk has a list', () => {
    const t = topology();
    t.enlaces = t.enlaces.map(l => ({ ...l, vlans: undefined }));
    expect(vlanWarnings(t, { plan: plan(), mapVlans: new Map() }, nameOf)).toEqual([]);
  });
});
