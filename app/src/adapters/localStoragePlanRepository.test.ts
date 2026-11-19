import { describe, expect, it } from 'vitest';
import type { NetworkPlan } from '@shared/plan';
import { createLocalStoragePlanRepository, PLAN_KEY } from './localStoragePlanRepository';
import { TOPOLOGY_KEY } from './localStorageInventoryRepository';
import type { Device, Link } from '../domain/types';

class MemoryStorage {
  data = new Map<string, string>();
  writes: string[] = [];
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes.push(key); this.data.set(key, value); }
}

const device = (id: string, overrides: Partial<Device> = {}): Device => ({
  id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...overrides,
});

// «Mi infraestructura»: a firewall, a core and two floor switches; the trunk of planta1 has ports and VLANs on the map.
const topology = {
  version: 2,
  equipos: [
    device('fw01', { tipo: 'firewall' }),
    device('inv-planta1', { nombre: 'planta1', ip: '192.168.99.11/24' }),
    device('inv-nucleo', { nombre: 'nucleo', ip: '192.168.99.2/24' }),
    device('inv-planta2', { nombre: 'planta2', ip: '192.168.99.12/24' }),
  ],
  enlaces: [
    { id: 'l1', a: { equipo: 'inv-nucleo' }, b: { equipo: 'fw01' }, tipo: 'datos' },
    { id: 'l2', a: { equipo: 'inv-planta1', puerto: 'gi1/0/48' }, b: { equipo: 'inv-nucleo', puerto: '1/1/49' }, tipo: 'troncal', vlans: '10, 99' },
    { id: 'l3', a: { equipo: 'inv-planta2' }, b: { equipo: 'inv-nucleo' }, tipo: 'datos' },
  ] satisfies Link[],
  grupos: [],
};

/**
 * A plan the guides' planner stored: the core is not the first switch it was given (custom order), a switch the
 * inventory no longer has stays hidden with its link and port, the link of planta1 keeps the planner's own ports
 * (the map shows its own), and there are fields neither the planner nor the map know.
 */
const realPlan = () => ({
  version: 1,
  notas: 'Red de la oficina de Madrid',
  vlans: [
    { id: 10, name: 'USUARIOS', purpose: 'users', subnet: '192.168.10.0/24', color: '#2b7' },
    { id: 20, name: 'VOZ', purpose: 'voice', subnet: '' },
    { id: 99, name: 'GESTION', purpose: 'management', subnet: '192.168.99.0/24' },
  ],
  switches: [
    { id: 'sw-3', deviceId: 'inv-nucleo', name: 'nucleo', platform: 'aruba-aoscx', mgmtIp: '192.168.99.2/24', gateway: '192.168.99.1', bridge: '' },
    { id: 'sw-1', deviceId: 'inv-planta1', name: 'planta1', platform: 'cisco-c1300', mgmtIp: '192.168.99.11/24', gateway: '192.168.99.1', bridge: '', rack: 'R2' },
    { id: 'sw-2', deviceId: 'inv-planta2', name: 'planta2', platform: 'mikrotik-routeros', mgmtIp: '192.168.99.12/24', gateway: '', bridge: 'bridge1' },
    { id: 'sw-9', deviceId: 'inv-retirado', name: 'viejo', platform: 'cisco-c1300', mgmtIp: '192.168.99.30/24', gateway: '', bridge: '' },
  ],
  links: [
    { id: 'ln-1', a: { switch: 'sw-3', interface: '1/1/1' }, b: { switch: 'sw-1', interface: 'gi1/0/1' }, nativeVlan: 99, label: 'troncal principal' },
    { id: 'ln-3', a: { switch: 'sw-1', interface: 'gi1/0/2' }, b: { switch: 'sw-9', interface: 'gi1/0/24' }, nativeVlan: 1 },
    { id: 'ln-2', a: { switch: 'sw-3', interface: '1/1/2' }, b: { switch: 'sw-2', interface: 'sfp-sfpplus1' }, nativeVlan: 1 },
  ],
  ports: [
    { id: 'pt-1', switch: 'sw-1', interface: 'gi1/0/5', vlan: 10 },
    { id: 'pt-2', switch: 'sw-9', interface: 'gi1/0/3', vlan: 20, description: 'teléfono de recepción' },
    { id: 'pt-3', switch: 'sw-2', interface: 'ether5', vlan: 20 },
  ],
});

const withStored = (plan: unknown = realPlan(), text = JSON.stringify(plan)) => {
  const storage = new MemoryStorage();
  storage.data.set(TOPOLOGY_KEY, JSON.stringify(topology));
  storage.data.set(PLAN_KEY, text);
  return storage;
};
const storedPlan = (storage: MemoryStorage) => JSON.parse(storage.data.get(PLAN_KEY) ?? 'null');
const renameVlan = (id: number, name: string) => (plan: NetworkPlan): NetworkPlan =>
  ({ ...plan, vlans: plan.vlans.map(vlan => (vlan.id === id ? { ...vlan, name } : vlan)) });

describe('localStorage plan repository', () => {
  it('uses the key of the guides planner', () => {
    expect(PLAN_KEY).toBe('switching-manual:plan');
  });

  it('loads the stored plan as the map shows it: inventory switches in the stored order, map ports and VLAN lists', async () => {
    const loaded = await createLocalStoragePlanRepository(withStored()).load();

    expect(loaded.problem).toBeUndefined();
    expect(loaded.plan.switches.map(item => item.id)).toEqual(['sw-3', 'sw-1', 'sw-2']);
    expect(loaded.hidden).toEqual(['viejo']);
    expect(loaded.plan.links.find(link => link.id === 'ln-1')).toMatchObject({ a: { interface: '1/1/49' }, b: { interface: 'gi1/0/48' } });
    expect([...loaded.mapVlans]).toEqual([['ln-1', '10, 99']]);
  });

  it('stores back a real plan identical except for the requested change (round trip)', async () => {
    const storage = withStored();

    await createLocalStoragePlanRepository(storage).apply(renameVlan(20, 'TELEFONIA'));

    const expected = realPlan();
    expected.vlans[1] = { ...expected.vlans[1], name: 'TELEFONIA' };
    expect(storedPlan(storage)).toEqual(expected);
    expect(storage.writes).toEqual([PLAN_KEY]);
  });

  it('keeps the planner own ports of a link when the change edits that link on the map', async () => {
    const storage = withStored();

    await createLocalStoragePlanRepository(storage).apply(plan => ({
      ...plan,
      links: plan.links.map(link => (link.id === 'ln-1' ? { ...link, nativeVlan: 10 } : link)),
    }));

    const expected = realPlan();
    expected.links[0] = { ...expected.links[0], nativeVlan: 10 };
    expect(storedPlan(storage)).toEqual(expected);
  });

  it('applies the change to what is stored right now, so a change saved by another tab survives', async () => {
    const storage = withStored();
    const map = createLocalStoragePlanRepository(storage);
    await map.load();

    await createLocalStoragePlanRepository(storage).apply(renameVlan(10, 'OFICINA'));
    await map.apply(renameVlan(20, 'TELEFONIA'));

    expect(storedPlan(storage).vlans.map((vlan: { name: string }) => vlan.name)).toEqual(['OFICINA', 'TELEFONIA', 'GESTION']);
  });

  it('stores the change on the stored plan when there is no inventory, and starts from an empty plan', async () => {
    const storage = new MemoryStorage();

    await createLocalStoragePlanRepository(storage).apply(plan => ({ ...plan, vlans: [{ id: 10, name: 'USUARIOS', purpose: 'users', subnet: '' }] }));

    expect(storedPlan(storage)).toEqual({ version: 1, vlans: [{ id: 10, name: 'USUARIOS', purpose: 'users', subnet: '' }], switches: [], links: [], ports: [] });
  });

  it('never writes over a stored plan it cannot read, and says so', async () => {
    const storage = withStored(undefined, '{"version":1,"vlans":"roto"');
    const repo = createLocalStoragePlanRepository(storage);

    await expect(repo.apply(renameVlan(10, 'X'))).rejects.toThrow('El plan de red guardado en este navegador no se puede leer; no se ha tocado.');
    expect(storage.data.get(PLAN_KEY)).toBe('{"version":1,"vlans":"roto"');
    expect(storage.writes).toEqual([]);
    expect((await repo.load()).problem).toBe('El plan de red guardado en este navegador no se puede leer; no se ha tocado.');

    const wrongShape = withStored({ ...realPlan(), vlans: 'roto' });
    await expect(createLocalStoragePlanRepository(wrongShape).apply(renameVlan(10, 'X'))).rejects.toThrow('no se puede leer');
    expect(wrongShape.writes).toEqual([]);
  });

  it('refuses a change that would leave a plan nobody could read, and writes nothing', async () => {
    const storage = withStored();
    const before = storage.data.get(PLAN_KEY);
    const repo = createLocalStoragePlanRepository(storage);

    await expect(repo.apply(plan => ({ ...plan, vlans: 'roto' } as unknown as NetworkPlan)))
      .rejects.toThrow('El cambio no se ha guardado: el plan de red quedaría ilegible.');
    expect(storage.data.get(PLAN_KEY)).toBe(before);
    expect(storage.writes).toEqual([]);
  });

  it('never writes over a plan of a newer version, and says so', async () => {
    const text = JSON.stringify({ ...realPlan(), version: 2 });
    const storage = withStored(undefined, text);
    const repo = createLocalStoragePlanRepository(storage);

    await expect(repo.apply(renameVlan(10, 'X'))).rejects.toThrow('El plan de red guardado en este navegador es de una versión más nueva; no se ha tocado.');
    expect(storage.data.get(PLAN_KEY)).toBe(text);
    expect(storage.writes).toEqual([]);
    expect((await repo.load()).problem).toBe('El plan de red guardado en este navegador es de una versión más nueva; no se ha tocado.');
  });
});
