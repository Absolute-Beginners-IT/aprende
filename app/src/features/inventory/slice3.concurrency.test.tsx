// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { InfraMapPage } from './InfraMapPage';
import { mockReactFlow } from './reactFlowTestSetup';
import { createLocalStorageInventoryRepository, TOPOLOGY_KEY } from '../../adapters/localStorageInventoryRepository';
import { createLocalStoragePlanRepository, PLAN_KEY } from '../../adapters/localStoragePlanRepository';
import type { Device, Link, Topology } from '../../domain/types';
import { topologyDocument } from '../../domain/topology';

mockReactFlow();
afterEach(() => { cleanup(); localStorage.clear(); });

class MemoryStorage {
  data = new Map<string, string>(); writes = 0;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.data.set(key, value); }
}
const device = (id: string, nombre: string, tipo: string, extra: Partial<Device> = {}): Device => ({ id, nombre, tipo, criticidad: 'Alta', monitorizado: false, ...extra });
const link = (id: string, a: string, b: string, tipo: Link['tipo'], extra: Partial<Link> = {}): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo, ...extra });
const office = (): Topology => ({
  equipos: [device('fw01', 'FW01', 'firewall', { marca: 'Fortinet' }), device('core', 'CORE', 'switch'), device('planta1', 'PLANTA1', 'switch')],
  enlaces: [link('l1', 'core', 'fw01', 'datos'), link('l2', 'planta1', 'core', 'troncal')], grupos: [],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storedPlan = (): any => ({
  version: 1, extra: { a: [1, 2] },
  vlans: [{ id: 10, name: 'USUARIOS', purpose: 'users', subnet: '192.168.10.0/24', x: 1 }, { id: 99, name: 'GESTION', purpose: 'management', subnet: '' }],
  switches: [
    { id: 'sw-2', deviceId: 'planta1', name: 'PLANTA1', platform: 'cisco-c1300', mgmtIp: '', gateway: '', bridge: '', rack: 'R2' },
    { id: 'sw-1', deviceId: 'core', name: 'CORE', platform: 'aruba-aoscx', mgmtIp: '', gateway: '', bridge: '' },
    { id: 'sw-9', deviceId: 'viejo', name: 'VIEJO', platform: 'cisco-c1300', mgmtIp: '', gateway: '', bridge: '' },
  ],
  links: [{ id: 'ln-1', a: { switch: 'sw-1', interface: '1/1/1' }, b: { switch: 'sw-2', interface: 'gi1/0/1', y: 2 }, nativeVlan: 1, z: 3 }],
  ports: [{ id: 'pt-1', switch: 'sw-9', interface: 'gi1/0/3', vlan: 10 }, { id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/5', vlan: 10, description: 'impresora' }],
});
const setup = (topology: Topology = office(), plan: unknown = storedPlan()) => {
  const storage = new MemoryStorage();
  storage.data.set(TOPOLOGY_KEY, JSON.stringify(topologyDocument(topology)));
  if (plan !== undefined) storage.data.set(PLAN_KEY, typeof plan === 'string' ? plan : JSON.stringify(plan));
  const utils = render(<InfraMapPage repository={createLocalStorageInventoryRepository(storage)} planRepository={createLocalStoragePlanRepository(storage)} />);
  return { storage, ...utils };
};
const planIn = (s: MemoryStorage) => JSON.parse(s.data.get(PLAN_KEY) ?? 'null');
const ficha = () => within(screen.getByRole('complementary', { name: 'Ficha del equipo' }));
const openSwitch = async (name: string, tab?: string) => {
  fireEvent.click(await screen.findByText(name, { selector: '.infra-node__name' }));
  if (tab) fireEvent.click(ficha().getByRole('tab', { name: tab }));
  return ficha();
};
const tick = () => new Promise(r => setTimeout(r, 0));

describe('S3 switch tabs', () => {
  it('non-switch keeps the whole old ficha, no tabs', async () => {
    setup();
    const p = await openSwitch('FW01');
    expect(p.queryByRole('tablist')).toBeNull();
    expect(p.getByLabelText('Nombre')).toBeTruthy();
    expect(p.getByRole('heading', { name: 'Conexiones' })).toBeTruthy();
    expect(p.getByRole('heading', { name: 'Grupo' })).toBeTruthy();
    expect(p.getByRole('button', { name: 'Borrar equipo' })).toBeTruthy();
  });
  it('switch ficha keeps criticidad/monitorizado, guides only in Guías', async () => {
    setup();
    const p = await openSwitch('PLANTA1');
    expect(p.getByLabelText('Criticidad')).toBeTruthy();
    expect(p.getByLabelText('Monitorizado')).toBeTruthy();
    expect(p.queryByRole('region', { name: 'Guías para este equipo' })).toBeNull();
    fireEvent.click(p.getByRole('tab', { name: 'Guías' }));
    expect(p.getByRole('region', { name: 'Guías para este equipo' })).toBeTruthy();
  });
});

describe('S4/S5 two writers on ports', () => {
  it('port VLAN change of a port another writer removed meanwhile: refused, storage byte-identical', async () => {
    const { storage } = setup();
    const p = await openSwitch('PLANTA1', 'Puertos y VLAN');
    const sel = await p.findByLabelText('VLAN del puerto gi1/0/5');
    const other = storedPlan(); other.ports = [other.ports[0]];
    storage.data.set(PLAN_KEY, JSON.stringify(other));
    const before = storage.data.get(PLAN_KEY); const w = storage.writes;
    fireEvent.change(sel, { target: { value: '99' } });
    expect(await p.findByText(/Ese puerto ya no está en el plan/)).toBeTruthy();
    expect(storage.data.get(PLAN_KEY)).toBe(before);
    expect(storage.writes).toBe(w);
  });
  it('port add keeps a VLAN, a switch field and a native VLAN another writer stored meanwhile', async () => {
    const { storage } = setup();
    const p = await openSwitch('PLANTA1', 'Puertos y VLAN');
    await p.findByRole('form', { name: 'Nuevo puerto de acceso' });
    const other = storedPlan();
    other.vlans.push({ id: 30, name: 'CAMARAS', purpose: 'cameras', subnet: '' });
    other.switches[0] = { ...other.switches[0], gateway: '10.0.0.1' };
    other.links[0] = { ...other.links[0], nativeVlan: 99 };
    storage.data.set(PLAN_KEY, JSON.stringify(other));
    const f = within(p.getByRole('form', { name: 'Nuevo puerto de acceso' }));
    fireEvent.change(f.getByLabelText('Puerto'), { target: { value: 'gi1/0/9' } });
    fireEvent.click(f.getByRole('button', { name: 'Añadir puerto' }));
    await waitFor(() => expect(planIn(storage).ports).toHaveLength(3));
    const saved = planIn(storage);
    const { ports, ...rest } = saved; const { ports: op, ...orest } = other;
    expect(rest).toEqual(orest);
    expect(ports.slice(0, 2)).toEqual(op);
    expect(ports[2]).toEqual({ id: 'pt-3', switch: 'sw-2', interface: 'gi1/0/9', vlan: 10 });
  });
  it('port with the same name another writer added meanwhile is refused, storage unchanged', async () => {
    const { storage } = setup();
    const p = await openSwitch('PLANTA1', 'Puertos y VLAN');
    await p.findByRole('form', { name: 'Nuevo puerto de acceso' });
    const other = storedPlan(); other.ports.push({ id: 'pt-3', switch: 'sw-2', interface: 'gi1/0/9', vlan: 99 });
    storage.data.set(PLAN_KEY, JSON.stringify(other)); const before = storage.data.get(PLAN_KEY);
    const f = within(p.getByRole('form', { name: 'Nuevo puerto de acceso' }));
    fireEvent.change(f.getByLabelText('Puerto'), { target: { value: 'GI1/0/9' } });
    fireEvent.click(f.getByRole('button', { name: 'Añadir puerto' }));
    expect(await p.findByText(/ya está en la lista/)).toBeTruthy();
    await tick();
    expect(storage.data.get(PLAN_KEY)).toBe(before);
  });
  it('newer stored plan: no port form, nothing written', async () => {
    const { storage } = setup(office(), { ...storedPlan(), version: 2 });
    const p = await openSwitch('PLANTA1', 'Puertos y VLAN');
    expect(await p.findByText(/Mientras tanto, el plan de red no se puede cambiar/)).toBeTruthy();
    expect(p.queryByRole('form', { name: 'Nuevo puerto de acceso' })).toBeNull();
    expect(storage.writes).toBe(0);
  });
  it('a plan becoming newer after load: add refused, storage byte-identical', async () => {
    const { storage } = setup();
    const p = await openSwitch('PLANTA1', 'Puertos y VLAN');
    await p.findByRole('form', { name: 'Nuevo puerto de acceso' });
    storage.data.set(PLAN_KEY, '{"version":3}'); const w = storage.writes;
    const f = within(p.getByRole('form', { name: 'Nuevo puerto de acceso' }));
    fireEvent.change(f.getByLabelText('Puerto'), { target: { value: 'gi1/0/9' } });
    fireEvent.click(f.getByRole('button', { name: 'Añadir puerto' }));
    expect(await p.findByText(/No se ha guardado/)).toBeTruthy();
    expect(storage.data.get(PLAN_KEY)).toBe('{"version":3}');
    expect(storage.writes).toBe(w);
  });
});

const trunk = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[aria-label="PLANTA1 – CORE: Troncal"]')).toBeTruthy());
  fireEvent.click(container.querySelector('[aria-label="PLANTA1 – CORE: Troncal"]') as HTMLElement);
  return within(screen.getByRole('complementary', { name: 'Ficha del enlace' }));
};

describe('S3/S6 link panel', () => {
  it('native VLAN saved only in the plan link, keeps hidden switch, order and unknown fields', async () => {
    const { storage, container } = setup();
    const f = await trunk(container);
    const native = await f.findByLabelText('VLAN nativa') as HTMLInputElement;
    await waitFor(() => expect(native.value).toBe('1'));
    fireEvent.change(f.getByLabelText('VLAN permitidas'), { target: { value: '10' } });
    fireEvent.change(native, { target: { value: '99' } });
    fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));
    await waitFor(() => expect(planIn(storage).links[0].nativeVlan).toBe(99));
    const exp = storedPlan(); exp.links[0].nativeVlan = 99;
    expect(planIn(storage)).toEqual(exp);
    const topo = storage.data.get(TOPOLOGY_KEY) ?? '';
    expect(topo).not.toMatch(/nativ/i);
    expect(JSON.parse(topo).enlaces[1].vlans).toBe('10');
  });
  it('legacy invalid list on a trunk: the link is not saved until fixed; message actionable', async () => {
    const topo = office(); topo.enlaces[1] = link('l2', 'planta1', 'core', 'troncal', { vlans: 'todas' });
    const { storage, container } = setup(topo);
    const f = await trunk(container);
    expect(f.getByText(/«todas» no es un número de VLAN/)).toBeTruthy();
    const before = storage.data.get(TOPOLOGY_KEY);
    fireEvent.change(f.getByLabelText('Notas'), { target: { value: 'hola' } });
    fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));
    await tick();
    expect(storage.data.get(TOPOLOGY_KEY)).toBe(before);
  });
  it('unreadable plan: link ficha shows why and writes no plan', async () => {
    const { storage, container } = setup(office(), '{ roto');
    const f = await trunk(container);
    expect(await f.findByText(/no se puede leer; no se ha tocado/)).toBeTruthy();
    expect(f.queryByLabelText('VLAN nativa')).toBeNull();
    fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));
    await tick();
    expect(storage.data.get(PLAN_KEY)).toBe('{ roto');
  });
});
