// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { InfraMapPage } from './InfraMapPage';
import { mockReactFlow } from './reactFlowTestSetup';
import { createLocalStorageInventoryRepository, TOPOLOGY_KEY } from '../../adapters/localStorageInventoryRepository';
import { createLocalStoragePlanRepository, PLAN_KEY } from '../../adapters/localStoragePlanRepository';
import { analyzeInventory } from '../../domain/inventoryAnalysis';
import type { Device, Link, Topology } from '../../domain/types';
import { topologyDocument } from '../../domain/topology';

mockReactFlow();
afterEach(() => { cleanup(); localStorage.clear(); });

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

const device = (id: string, nombre: string, tipo: string, extra: Partial<Device> = {}): Device =>
  ({ id, nombre, tipo, criticidad: 'Alta', monitorizado: false, ...extra });
const link = (id: string, a: string, b: string, tipo: Link['tipo'], extra: Partial<Link> = {}): Link =>
  ({ id, a: { equipo: a }, b: { equipo: b }, tipo, ...extra });

// A firewall (the gateway of VLAN 10) over the core; a floor switch on a trunk that only lets VLAN 10 through, with a
// server and a regleta that feeds it.
const office = (trunk: Partial<Link> = { vlans: '10', a: { equipo: 'planta1', puerto: 'gi1/0/48' }, b: { equipo: 'core', puerto: '1/1/1' } }): Topology => ({
  equipos: [
    device('fw01', 'FW01', 'firewall', { ip: '192.168.10.1' }), device('core', 'CORE', 'switch'), device('planta1', 'PLANTA1', 'switch', { ip: '192.168.99.3' }),
    device('srv', 'SRV', 'servidor'), device('pdu', 'PDU1', 'regleta'),
  ],
  enlaces: [link('l1', 'core', 'fw01', 'datos'), link('l2', 'planta1', 'core', 'troncal', trunk), link('l3', 'srv', 'planta1', 'datos'), link('l4', 'planta1', 'pdu', 'energia')],
  grupos: [],
});

const storedPlan = () => ({
  version: 1,
  vlans: [
    { id: 10, name: 'USUARIOS', purpose: 'users', subnet: '192.168.10.0/24' },
    { id: 30, name: 'CAMARAS', purpose: 'cameras', subnet: '' },
    { id: 99, name: 'GESTION', purpose: 'management', subnet: '192.168.99.0/24' },
  ],
  switches: [
    { id: 'sw-1', deviceId: 'core', name: 'CORE', platform: 'aruba-aoscx', mgmtIp: '', gateway: '', bridge: '' },
    { id: 'sw-2', deviceId: 'planta1', name: 'PLANTA1', platform: 'cisco-c1300', mgmtIp: '', gateway: '', bridge: '' },
  ],
  links: [{ id: 'ln-1', a: { switch: 'sw-1', interface: '1/1/1' }, b: { switch: 'sw-2', interface: 'gi1/0/48' }, nativeVlan: 1 }],
  ports: [
    { id: 'pt-1', switch: 'sw-2', interface: 'gi1/0/1', vlan: 30 },
    { id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/2', vlan: 30 },
    { id: 'pt-3', switch: 'sw-2', interface: 'gi1/0/3', vlan: 10 },
  ],
});

const setup = (topology: Topology = office()) => {
  const storage = new MemoryStorage();
  storage.data.set(TOPOLOGY_KEY, JSON.stringify(topologyDocument(topology)));
  storage.data.set(PLAN_KEY, JSON.stringify(storedPlan()));
  const utils = render(<InfraMapPage repository={createLocalStorageInventoryRepository(storage)} planRepository={createLocalStoragePlanRepository(storage)} />);
  return { storage, ...utils };
};
const column = () => within(screen.getByRole('region', { name: 'Paleta de equipos' }));
const openLayers = async () => {
  await screen.findByText('CORE', { selector: '.infra-node__name' });
  fireEvent.click(column().getByRole('tab', { name: 'Capas' }));
  return within(await column().findByRole('list', { name: 'Capas' }));
};
const vlanButton = async (name: string) => (await openLayers()).findByRole('button', { name });
const edge = (container: HTMLElement, label: string) => container.querySelector(`.react-flow__edge[aria-label="${label}"]`) as HTMLElement;
const node = (name: string) => screen.getByText(name, { selector: '.infra-node__name' }).closest('.infra-node') as HTMLElement;
const network = () => within(screen.getByRole('complementary', { name: 'Red y VLAN' }));
const openWarnings = () => { fireEvent.click(network().getByRole('tab', { name: /^Avisos/ })); return within(network().getByRole('region', { name: 'VLAN en las troncales' })); };

describe('left column «Formas» / «Capas»', () => {
  it('has the tabs «Formas» and «Capas», moved with the arrow keys, and «Formas» keeps the library', async () => {
    setup();
    const tabs = within(column().getByRole('tablist', { name: 'Biblioteca y capas' }));
    expect(tabs.getAllByRole('tab').map(t => t.textContent)).toEqual(['Formas', 'Capas']);
    expect(column().getByRole('searchbox', { name: 'Buscar equipos y formas' })).toBeTruthy();
    fireEvent.keyDown(tabs.getByRole('tab', { name: 'Formas' }), { key: 'ArrowRight' });
    expect(tabs.getByRole('tab', { name: 'Capas' }).getAttribute('aria-selected')).toBe('true');
    expect(column().queryByRole('searchbox')).toBeNull();
    fireEvent.keyDown(tabs.getByRole('tab', { name: 'Capas' }), { key: 'Home' });
    // Back in «Formas», search and folding work as before.
    fireEvent.change(column().getByRole('searchbox', { name: 'Buscar equipos y formas' }), { target: { value: 'regle' } });
    expect(column().getByRole('button', { name: 'Añadir Regleta (PDU)' })).toBeTruthy();
    fireEvent.change(column().getByRole('searchbox', { name: 'Buscar equipos y formas' }), { target: { value: '' } });
    fireEvent.click(column().getByRole('button', { name: 'Energía', expanded: true }));
    expect(column().queryByRole('button', { name: 'Añadir Regleta (PDU)' })).toBeNull();
  });

  it('lists the cabling, each plan VLAN with its colour, summary, gaps and eye, and the overlays', async () => {
    setup();
    const list = await openLayers();
    expect(list.getByRole('button', { name: /Cableado físico/, pressed: true })).toBeTruthy();
    const users = await list.findByRole('button', { name: 'VLAN 10 USUARIOS' });
    expect(users.textContent).toContain('2 switches · 1 troncal');
    expect((users.querySelector('.infra-layer__swatch') as HTMLElement).style.background).toBe('rgb(59, 130, 246)');
    const cameras = list.getByRole('button', { name: 'VLAN 30 CAMARAS' });
    // VLAN 30 has access ports on PLANTA1 but its trunk only lets 10 through: one gap.
    expect(cameras.textContent).toContain('1 switch · 0 troncales');
    expect(cameras.textContent).toContain('⚠ 1 hueco');
    expect(list.getByRole('button', { name: 'Ocultar la VLAN 10' })).toBeTruthy();
    const overlays = within(column().getByRole('group', { name: 'Sobre el mapa' }));
    expect(overlays.getAllByRole('checkbox').map(c => (c as HTMLInputElement).checked)).toEqual([true, false, false]);
  });
});

describe('picking a VLAN', () => {
  it('lights the lines that carry it and the devices that use it, tags them and dims the rest', async () => {
    const { storage, container } = setup();
    const before = [storage.data.get(PLAN_KEY), storage.data.get(TOPOLOGY_KEY)];
    fireEvent.click(await vlanButton('VLAN 10 USUARIOS'));
    await waitFor(() => expect(edge(container, 'PLANTA1 – CORE: Troncal').classList.contains('is-lit')).toBe(true));
    expect(edge(container, 'CORE – FW01: Datos').classList.contains('is-dim')).toBe(true);
    // While a VLAN is picked only its own gaps are flagged: VLAN 30's gap on this trunk waits until 30 is picked.
    expect(edge(container, 'PLANTA1 – CORE: Troncal').classList.contains('has-gap')).toBe(false);
    expect(edge(container, 'SRV – PLANTA1: Datos').classList.contains('is-dim')).toBe(true);
    expect(node('FW01').classList.contains('is-lit')).toBe(true);
    expect(within(node('FW01')).getByText('Puerta de enlace')).toBeTruthy();
    expect(within(node('PLANTA1')).getByText('1 puerto de acceso')).toBeTruthy();
    expect(node('CORE').classList.contains('is-lit')).toBe(true);
    expect(node('SRV').classList.contains('is-dim')).toBe(true);

    fireEvent.click(column().getByRole('button', { name: 'VLAN 30 CAMARAS' }));
    await waitFor(() => expect(edge(container, 'PLANTA1 – CORE: Troncal').classList.contains('is-dim')).toBe(true));
    expect(edge(container, 'PLANTA1 – CORE: Troncal').classList.contains('has-gap')).toBe(true);
    expect(within(node('PLANTA1')).getByText('2 puertos de acceso')).toBeTruthy();
    expect(node('CORE').classList.contains('is-dim')).toBe(true);

    fireEvent.click(column().getByRole('button', { name: /Cableado físico/ }));
    await waitFor(() => expect(container.querySelector('.infra-node.is-lit, .infra-node.is-dim')).toBeNull());
    // A view choice: remembered in this browser, never written to the plan or the inventory.
    expect(JSON.parse(localStorage.getItem('mapa-infra:capas') ?? '{}')).toMatchObject({ tab: 'capas', picked: null });
    expect([storage.data.get(PLAN_KEY), storage.data.get(TOPOLOGY_KEY)]).toEqual(before);
  });

  it('hides the gap flags of a VLAN with its eye, and turns the power badges, IP and ports labels on and off', async () => {
    const { container } = setup();
    await vlanButton('VLAN 30 CAMARAS');
    await waitFor(() => expect(within(node('PLANTA1')).getByText('⚠ La VLAN 30 no llega')).toBeTruthy());
    fireEvent.click(column().getByRole('button', { name: 'Ocultar la VLAN 30' }));
    await waitFor(() => expect(container.querySelector('.infra-node__flag')).toBeNull());
    expect((column().getByRole('button', { name: 'VLAN 30 CAMARAS' }) as HTMLButtonElement).disabled).toBe(true);
    expect(JSON.parse(localStorage.getItem('mapa-infra:capas') ?? '{}').hidden).toEqual([30]);

    expect(container.querySelector('.infra-node__power')).toBeTruthy();
    fireEvent.click(column().getByRole('checkbox', { name: 'Insignias de energía' }));
    await waitFor(() => expect(container.querySelector('.infra-node__power')).toBeNull());
    fireEvent.click(column().getByRole('checkbox', { name: 'Etiquetas de IP' }));
    expect(await screen.findByText('192.168.99.3', { selector: '.infra-node__ip' })).toBeTruthy();
    fireEvent.click(column().getByRole('checkbox', { name: 'Etiquetas de puertos' }));
    expect(await screen.findByText('gi1/0/48 – 1/1/1')).toBeTruthy();
  });
});

describe('VLAN gaps', () => {
  it('flags the trunk and the switch on the map and lists the gap in «Avisos» with its fix', async () => {
    const { container } = setup();
    await screen.findByText('CORE', { selector: '.infra-node__name' });
    await waitFor(() => expect(edge(container, 'PLANTA1 – CORE: Troncal').classList.contains('has-gap')).toBe(true));
    expect(screen.getByText('⚠ Falta la VLAN 30')).toBeTruthy();
    expect(within(node('PLANTA1')).getByText('⚠ La VLAN 30 no llega')).toBeTruthy();
    const findings = analyzeInventory(office(), new Date());
    expect(screen.getByRole('button', { name: `Comprobar red (${findings.length + 1} avisos)` })).toBeTruthy();
    const warnings = openWarnings();
    expect(warnings.getByText('La VLAN 30 no llega a PLANTA1 (2 puertos de acceso): la troncal entre CORE y PLANTA1 no la deja pasar.')).toBeTruthy();
    expect(warnings.getByRole('button', { name: 'Añadir 30 a la troncal' })).toBeTruthy();
    // The inventory findings stay in «Avisos», as before.
    expect(network().getByRole('region', { name: 'Qué te falta' })).toBeTruthy();
  });

  it('«Añadir N a la troncal» writes only that link\'s VLAN field and never touches the plan', async () => {
    const { storage } = setup();
    await screen.findByText('CORE', { selector: '.infra-node__name' });
    const plan = storage.data.get(PLAN_KEY);
    const topology = JSON.parse(storage.data.get(TOPOLOGY_KEY)!);
    const warnings = openWarnings();
    fireEvent.click(await warnings.findByRole('button', { name: 'Añadir 30 a la troncal' }));
    await waitFor(() => expect(JSON.parse(storage.data.get(TOPOLOGY_KEY)!).enlaces[1].vlans).toBe('10, 30'));
    topology.enlaces[1].vlans = '10, 30';
    expect(JSON.parse(storage.data.get(TOPOLOGY_KEY)!)).toEqual(topology);
    expect(storage.data.get(PLAN_KEY)).toBe(plan);
    expect(await screen.findByText('VLAN 30 añadida a la troncal entre PLANTA1 y CORE.')).toBeTruthy();
    await waitFor(() => expect(network().queryByRole('region', { name: 'VLAN en las troncales' })).toBeNull());
  });

  it('never finds a gap through a trunk with no VLAN list', async () => {
    const { container } = setup(office({ vlans: undefined }));
    expect(await vlanButton('VLAN 30 CAMARAS')).toBeTruthy();
    expect(column().getByRole('button', { name: 'VLAN 30 CAMARAS' }).textContent).not.toContain('hueco');
    expect(container.querySelector('.has-gap, .infra-node__flag')).toBeNull();
    const findings = analyzeInventory(office({ vlans: undefined }), new Date());
    expect(screen.getByRole('button', { name: `Comprobar red (${findings.length} avisos)` })).toBeTruthy();
    fireEvent.click(network().getByRole('tab', { name: /^Avisos/ }));
    expect(network().queryByRole('region', { name: 'VLAN en las troncales' })).toBeNull();
  });

  it('warns about a list naming VLANs the plan lacks and two links of a pair whose lists disagree', async () => {
    const topology = office({ vlans: '10, 30, 40' });
    topology.enlaces.push(link('l5', 'planta1', 'core', 'lag', { vlans: '10' }));
    setup(topology);
    await screen.findByText('CORE', { selector: '.infra-node__name' });
    const warnings = openWarnings();
    expect(await warnings.findByText('La troncal entre CORE y PLANTA1 deja pasar la VLAN 40, que no está en el plan: créala en la pestaña «VLAN» o quítala de la troncal.')).toBeTruthy();
    expect(warnings.getByText('Hay 2 enlaces entre CORE y PLANTA1 con VLAN distintas (10, 30, 40 / 10): los comandos usan solo el primero, el de las VLAN 10, 30, 40.')).toBeTruthy();
    expect(warnings.queryByRole('button')).toBeNull();
  });
});
