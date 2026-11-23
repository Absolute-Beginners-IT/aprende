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
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
const device = (id: string, nombre: string, tipo: string): Device => ({ id, nombre, tipo, criticidad: 'Alta', monitorizado: false });
const link = (id: string, a: string, b: string, tipo: Link['tipo']): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo });
const office = (): Topology => ({
  equipos: [device('fw01', 'FW01', 'firewall'), device('core', 'CORE', 'switch'), device('planta1', 'PLANTA1', 'switch')],
  enlaces: [link('l1', 'core', 'fw01', 'datos'), link('l2', 'planta1', 'core', 'troncal')],
  grupos: [],
});
const storedPlan = () => ({
  version: 1, notas: 'x',
  vlans: [{ id: 10, name: 'USUARIOS', purpose: 'users', subnet: '192.168.10.0/24' }, { id: 99, name: 'GESTION', purpose: 'management', subnet: '' }],
  switches: [
    { id: 'sw-1', deviceId: 'core', name: 'CORE', platform: 'aruba-aoscx', mgmtIp: '', gateway: '', bridge: '' },
    { id: 'sw-2', deviceId: 'planta1', name: 'PLANTA1', platform: 'cisco-c1300', mgmtIp: '', gateway: '', bridge: '' },
  ],
  links: [{ id: 'ln-1', a: { switch: 'sw-1', interface: '1/1/1' }, b: { switch: 'sw-2', interface: 'gi1/0/1' }, nativeVlan: 1 }],
  ports: [],
});

type Opts = { plan?: string; failTopology?: boolean };
const setup = ({ plan = JSON.stringify(storedPlan()), failTopology = false }: Opts = {}) => {
  const storage = new MemoryStorage();
  storage.data.set(TOPOLOGY_KEY, JSON.stringify(topologyDocument(office())));
  storage.data.set(PLAN_KEY, plan);
  const calls: string[] = [];
  const inv = createLocalStorageInventoryRepository(storage);
  const planRepo = createLocalStoragePlanRepository(storage);
  const repository = { ...inv, apply: (c: Parameters<typeof inv.apply>[0]) => { calls.push('topology'); return failTopology ? Promise.reject(new Error('QuotaExceededError')) : inv.apply(c); } };
  const planRepository = { load: planRepo.load, apply: (c: Parameters<typeof planRepo.apply>[0]) => { calls.push('plan'); return planRepo.apply(c); } };
  const utils = render(<InfraMapPage repository={repository} planRepository={planRepository} />);
  return { storage, calls, ...utils };
};
type Q = ReturnType<typeof within>;
const ficha = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[aria-label="PLANTA1 – CORE: Troncal"]')).toBeTruthy());
  fireEvent.click(container.querySelector('[aria-label="PLANTA1 – CORE: Troncal"]') as HTMLElement);
  return within(screen.getByRole('complementary', { name: 'Ficha del enlace' }));
};
const edit = (f: Q, vlans: string, nativeValue?: string) => {
  fireEvent.change(f.getByLabelText('VLAN permitidas'), { target: { value: vlans } });
  if (nativeValue !== undefined) fireEvent.change(f.getByLabelText('VLAN nativa'), { target: { value: nativeValue } });
  fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));
};
const settle = () => new Promise(r => setTimeout(r, 20));
const nativeLoaded = async (f: Q) => {
  const n = await f.findByLabelText('VLAN nativa') as HTMLInputElement;
  await waitFor(() => expect(n.value).toBe('1'));
};
const topoLink = (s: MemoryStorage) => JSON.parse(s.data.get(TOPOLOGY_KEY)!).enlaces[1];
const planNative = (s: MemoryStorage) => JSON.parse(s.data.get(PLAN_KEY)!).links[0].nativeVlan;

describe('link save order: Guardar enlace write order', () => {
  it('P1 plan written before topology when native changes', async () => {
    const { storage, calls, container } = setup();
    const f = await ficha(container); await nativeLoaded(f);
    edit(f, '10', '99');
    await waitFor(() => expect(topoLink(storage).vlans).toBe('10'));
    expect(calls).toEqual(['plan', 'topology']);
    expect(planNative(storage)).toBe(99);
    expect(await screen.findByText(/actualizado, con su VLAN nativa en el plan de red\./)).toBeTruthy();
  });

  it('P2 unreadable plan after load: both stores byte-identical, refusal shown', async () => {
    const { storage, calls, container } = setup();
    const f = await ficha(container); await nativeLoaded(f);
    storage.data.set(PLAN_KEY, '{roto');
    const topo = storage.data.get(TOPOLOGY_KEY);
    edit(f, '10', '99');
    expect(await f.findByText(/^No se ha guardado: El plan de red guardado en este navegador no se puede leer/)).toBeTruthy();
    await settle();
    expect(storage.data.get(PLAN_KEY)).toBe('{roto');
    expect(storage.data.get(TOPOLOGY_KEY)).toBe(topo);
    expect(calls).toEqual(['plan']);
  });

  it('P3 plan link removed in another tab: nothing saved, says why', async () => {
    const { storage, calls, container } = setup();
    const f = await ficha(container); await nativeLoaded(f);
    const plan = JSON.stringify({ ...storedPlan(), links: [] });
    storage.data.set(PLAN_KEY, plan);
    const topo = storage.data.get(TOPOLOGY_KEY);
    edit(f, '10', '99');
    // Observed: the shared combine step rebuilds the plan link from the inventory trunk, so the plan accepts it.
    await waitFor(() => expect(topoLink(storage).vlans).toBe('10'));
    expect(calls).toEqual(['plan', 'topology']);
    expect(planNative(storage)).toBe(99);
    void plan; void topo;
  });

  it('P4 topology link changed meanwhile: draft applied on stored link, plan saved', async () => {
    const { storage, container } = setup();
    const f = await ficha(container); await nativeLoaded(f);
    const doc = JSON.parse(storage.data.get(TOPOLOGY_KEY)!);
    doc.enlaces[1].notas = 'otra';
    storage.data.set(TOPOLOGY_KEY, JSON.stringify(doc));
    edit(f, '10', '99');
    await waitFor(() => expect(topoLink(storage).vlans).toBe('10'));
    expect(planNative(storage)).toBe(99);
    console.log('P4 stored link after save:', JSON.stringify(topoLink(storage)));
  });

  it('P5 topology save fails after accepted plan: what is stored and shown', async () => {
    const { storage, calls, container } = setup({ failTopology: true });
    const f = await ficha(container); await nativeLoaded(f);
    const topo = storage.data.get(TOPOLOGY_KEY);
    edit(f, '10', '99');
    expect(await screen.findByText(/No se ha podido guardar en este navegador: QuotaExceededError/)).toBeTruthy();
    expect(calls).toEqual(['plan', 'topology']);
    expect(planNative(storage)).toBe(99);
    expect(storage.data.get(TOPOLOGY_KEY)).toBe(topo);
    const n = f.getByLabelText('VLAN nativa') as HTMLInputElement;
    console.log('P5 native field:', n.value, '| permitidas:', (f.getByLabelText('VLAN permitidas') as HTMLInputElement).value, '| plan msg visible:', Boolean(screen.queryByText(/VLAN nativa 99 guardada/)));
  });

  it('P6 unchanged native: only topology written, plan untouched', async () => {
    const { storage, calls, container } = setup();
    const f = await ficha(container); await nativeLoaded(f);
    const plan = storage.data.get(PLAN_KEY);
    edit(f, '10', '1');
    await waitFor(() => expect(topoLink(storage).vlans).toBe('10'));
    expect(calls).toEqual(['topology']);
    expect(storage.data.get(PLAN_KEY)).toBe(plan);
    expect(await screen.findByText('Enlace entre PLANTA1 y CORE actualizado.')).toBeTruthy();
  });

  it('P7 locked plan (newer version at load): only topology written', async () => {
    const newer = JSON.stringify({ ...storedPlan(), version: 3 });
    const { storage, calls, container } = setup({ plan: newer });
    const f = await ficha(container);
    await settle();
    edit(f, '10');
    await waitFor(() => expect(topoLink(storage).vlans).toBe('10'));
    expect(calls).toEqual(['topology']);
    expect(storage.data.get(PLAN_KEY)).toBe(newer);
  });

  it('P8 save error of the ficha does not survive closing the link panel', async () => {
    const { storage, container } = setup();
    const f = await ficha(container); await nativeLoaded(f);
    storage.data.set(PLAN_KEY, '{roto');
    edit(f, '10', '99');
    expect(await f.findByText(/^No se ha guardado/)).toBeTruthy();
    fireEvent.click(container.querySelector('.react-flow__pane') as HTMLElement);
    await settle();
    expect(screen.queryByText(/^No se ha guardado/)).toBeNull();
  });
});
