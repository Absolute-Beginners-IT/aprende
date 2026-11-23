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
import { PLANNER_URL } from '../../config';

mockReactFlow();
afterEach(() => { cleanup(); localStorage.clear(); });

class MemoryStorage {
  data = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.data.set(key, value); }
}

const device = (id: string, nombre: string, tipo: string, extra: Partial<Device> = {}): Device =>
  ({ id, nombre, tipo, criticidad: 'Alta', monitorizado: false, ...extra });
const link = (id: string, a: string, b: string, tipo: Link['tipo']): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo });

// A firewall, a core and a floor switch hanging from it.
const office = (): Topology => ({
  equipos: [device('fw01', 'FW01', 'firewall'), device('core', 'CORE', 'switch'), device('planta1', 'PLANTA1', 'switch')],
  enlaces: [link('l1', 'core', 'fw01', 'datos'), link('l2', 'planta1', 'core', 'troncal')],
  grupos: [],
});

// What the guides' planner stored: fields neither the planner nor the map know, and a switch the inventory lacks.
const storedPlan = () => ({
  version: 1,
  notas: 'Oficina de Madrid',
  vlans: [
    { id: 10, name: 'USUARIOS', purpose: 'users', subnet: '192.168.10.0/24', color: '#2b7' },
    { id: 99, name: 'GESTION', purpose: 'management', subnet: '192.168.99.0/24' },
  ],
  switches: [
    { id: 'sw-1', deviceId: 'core', name: 'CORE', platform: 'aruba-aoscx', mgmtIp: '', gateway: '', bridge: '' },
    { id: 'sw-2', deviceId: 'planta1', name: 'PLANTA1', platform: 'cisco-c1300', mgmtIp: '', gateway: '', bridge: '', rack: 'R2' },
    { id: 'sw-9', deviceId: 'viejo', name: 'VIEJO', platform: 'cisco-c1300', mgmtIp: '', gateway: '', bridge: '' },
  ],
  links: [{ id: 'ln-1', a: { switch: 'sw-1', interface: '1/1/1' }, b: { switch: 'sw-2', interface: 'gi1/0/1' }, nativeVlan: 1 }],
  ports: [{ id: 'pt-1', switch: 'sw-9', interface: 'gi1/0/3', vlan: 10, description: 'recepción' }],
});

const setup = (topology: Topology = office(), plan: unknown = storedPlan()) => {
  const storage = new MemoryStorage();
  storage.data.set(TOPOLOGY_KEY, JSON.stringify(topologyDocument(topology)));
  if (plan !== undefined) storage.data.set(PLAN_KEY, typeof plan === 'string' ? plan : JSON.stringify(plan));
  const utils = render(<InfraMapPage repository={createLocalStorageInventoryRepository(storage)} planRepository={createLocalStoragePlanRepository(storage)} />);
  return { storage, ...utils };
};
const planIn = (storage: MemoryStorage) => JSON.parse(storage.data.get(PLAN_KEY) ?? 'null');
const panel = () => within(screen.getByRole('complementary', { name: 'Red y VLAN' }));
const vlanTable = async () => within(await panel().findByRole('table', { name: 'VLAN del plan' }));
const vlanForm = () => within(screen.getByRole('form'));
const fill = (fields: Record<string, string>) => {
  for (const [label, value] of Object.entries(fields)) fireEvent.change(vlanForm().getByLabelText(label), { target: { value } });
};
const save = () => fireEvent.click(vlanForm().getByRole('button', { name: 'Guardar VLAN' }));
const alertText = async () => (await panel().findByRole('alert')).textContent;

describe('map editor shell', () => {
  it('shows «Red y VLAN» with its three tabs while nothing is selected, and returns to it after a ficha', async () => {
    const { container } = setup();
    const p = panel();
    expect(p.getByRole('heading', { name: 'Red y VLAN' })).toBeTruthy();
    expect(p.getByText('Lo que vale para todos los switches. Pulsa un equipo o un enlace para configurarlo.')).toBeTruthy();
    const tabs = within(p.getByRole('tablist', { name: 'Configuración de la red' })).getAllByRole('tab').map(t => t.textContent);
    expect(tabs).toEqual(['VLAN', 'Direccionamiento', expect.stringMatching(/^Avisos/)]);

    fireEvent.click(await screen.findByText('CORE', { selector: '.infra-node__name' }));
    expect(screen.getByRole('complementary', { name: 'Ficha del equipo' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Red y VLAN' })).toBeNull();
    fireEvent.click(container.querySelector('.react-flow__pane') as HTMLElement);
    expect(await screen.findByRole('complementary', { name: 'Red y VLAN' })).toBeTruthy();
  });

  it('moves between the panel tabs with the arrow keys', async () => {
    setup();
    const tab = (name: RegExp) => panel().getByRole('tab', { name });
    expect(tab(/^VLAN$/).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(/^VLAN$/), { key: 'ArrowRight' });
    expect(tab(/^Direccionamiento$/).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(/^Direccionamiento$/));
    fireEvent.keyDown(tab(/^Direccionamiento$/), { key: 'End' });
    expect(tab(/^Avisos/).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(/^Avisos/), { key: 'ArrowRight' });
    expect(tab(/^VLAN$/).getAttribute('aria-selected')).toBe('true');
  });

  it('has zoom and fit buttons in the toolbar, and draws the grid and a minimap', async () => {
    const { container } = setup();
    await screen.findByText('CORE', { selector: '.infra-node__name' });
    for (const name of ['Alejar', 'Acercar', 'Ver todo el mapa']) fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByText(/^\d+ %$/)).toBeTruthy();
    expect(container.querySelector('.react-flow__background')).toBeTruthy();
    expect(container.querySelector('.react-flow__minimap')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Obtener comandos' }).getAttribute('href')).toBe(PLANNER_URL);
  });

  it('«Comprobar red» counts the gaps and opens «Avisos», with the same content as «Qué te falta»', async () => {
    setup();
    await screen.findByText('CORE', { selector: '.infra-node__name' });
    const findings = analyzeInventory(office(), new Date());
    expect(findings.length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByText('CORE', { selector: '.infra-node__name' }));
    const check = screen.getByRole('button', { name: new RegExp(`^Comprobar red \\(${findings.length} avisos\\)$`) });
    fireEvent.click(check);
    const p = panel();
    expect(p.getByRole('tab', { name: /^Avisos/ }).getAttribute('aria-selected')).toBe('true');
    const gaps = within(p.getByRole('region', { name: 'Qué te falta' }));
    expect(gaps.getAllByRole('listitem').map(li => li.textContent?.replace(/^(Urgente|Pendiente|Dato) /, ''))).toEqual(findings.map(f => f.mensaje));
    expect(p.getByText(/Arrastra un equipo/)).toBeTruthy();
  });

  it('filters the library by name and still adds devices with a click or a drop', async () => {
    const { storage } = setup();
    await screen.findByText('CORE', { selector: '.infra-node__name' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar equipos y formas' }), { target: { value: 'regle' } });
    expect(screen.getByRole('button', { name: 'Añadir Regleta (PDU)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Añadir Switch' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir Regleta (PDU)' }));
    expect(await screen.findByText('Regleta (PDU) 1', { selector: '.infra-node__name' })).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar equipos y formas' }), { target: { value: '' } });
    const canvas = screen.getByRole('region', { name: 'Mapa de tu infraestructura' });
    const dataTransfer = { getData: (t: string) => (t === 'application/x-mapa-infra-tipo' ? 'servidor' : ''), types: ['application/x-mapa-infra-tipo'] };
    fireEvent.drop(canvas, { dataTransfer, clientX: 100, clientY: 100 });
    await waitFor(() => expect(JSON.parse(storage.data.get(TOPOLOGY_KEY)!).equipos.some((d: Device) => d.tipo === 'servidor')).toBe(true));
  });

  it('collapses and opens a family of the library', async () => {
    setup();
    const family = screen.getByRole('button', { name: 'Energía', expanded: true });
    fireEvent.click(family);
    expect(screen.getByRole('button', { name: 'Energía', expanded: false })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Añadir Regleta (PDU)' })).toBeNull();
  });
});


describe('VLAN catalogue', () => {
  it('lists the stored VLANs with colour, id, name, purpose and network', async () => {
    setup();
    const rows = (await vlanTable()).getAllByRole('row').slice(1);
    expect(rows.map(r => r.textContent)).toEqual([
      expect.stringContaining('10USUARIOSUsuarios192.168.10.0/24'),
      expect.stringContaining('99GESTIONGestión192.168.99.0/24'),
    ]);
    expect(rows[0].querySelector('.vlan-swatch')).toBeTruthy();
  });

  it('adds a VLAN through the repository, keeping unknown fields, hidden switches and a VLAN another tab added meanwhile', async () => {
    const { storage } = setup();
    await vlanTable();
    // Another tab of the guides' planner adds VLAN 50 after the map loaded the plan.
    const other = planIn(storage);
    storage.data.set(PLAN_KEY, JSON.stringify({ ...other, vlans: [...other.vlans, { id: 50, name: 'IOT', purpose: 'iot', subnet: '' }] }));
    fireEvent.click(panel().getByRole('button', { name: 'Añadir VLAN' }));
    fill({ ID: '20', Nombre: 'VOZ', 'Red (opcional)': '192.168.20.0/24' });
    fireEvent.change(vlanForm().getByLabelText('Propósito'), { target: { value: 'voice' } });
    save();
    await waitFor(() => expect(planIn(storage).vlans.map((v: { id: number }) => v.id)).toEqual([10, 99, 50, 20]));
    const plan = planIn(storage);
    expect(plan.vlans[3]).toEqual({ id: 20, name: 'VOZ', purpose: 'voice', subnet: '192.168.20.0/24' });
    expect(plan.notas).toBe('Oficina de Madrid');
    expect(plan.vlans[0].color).toBe('#2b7');
    expect(plan.switches.map((s: { id: string }) => s.id)).toEqual(['sw-1', 'sw-2', 'sw-9']);
    expect(plan.switches[1].rack).toBe('R2');
    expect(plan.ports).toEqual(storedPlan().ports);
    expect(await (await vlanTable()).findByText('VOZ')).toBeTruthy();
  });

  it('edits a VLAN, keeping the fields the map does not show', async () => {
    const { storage } = setup();
    fireEvent.click((await vlanTable()).getByRole('button', { name: 'Editar la VLAN 10' }));
    expect((vlanForm().getByLabelText('Nombre') as HTMLInputElement).value).toBe('USUARIOS');
    fill({ ID: '11', Nombre: 'PUESTOS' });
    save();
    await waitFor(() => expect(planIn(storage).vlans[0]).toEqual({ id: 11, name: 'PUESTOS', purpose: 'users', subnet: '192.168.10.0/24', color: '#2b7' }));
    expect(planIn(storage).vlans[1]).toEqual(storedPlan().vlans[1]);
  });

  it('removes a VLAN and keeps the rest of the plan', async () => {
    const { storage } = setup();
    fireEvent.click((await vlanTable()).getByRole('button', { name: 'Quitar la VLAN 10' }));
    await waitFor(() => expect(planIn(storage).vlans).toEqual([storedPlan().vlans[1]]));
    const { vlans: _v, ...rest } = planIn(storage);
    const { vlans: _w, ...before } = storedPlan();
    expect(rest).toEqual(before);
  });

  it('explains what is wrong in the form and saves nothing', async () => {
    const { storage } = setup();
    await vlanTable();
    const before = storage.data.get(PLAN_KEY);
    const tryAdd = async (fields: Record<string, string>, purpose: string, message: string) => {
      fireEvent.click(panel().getByRole('button', { name: 'Añadir VLAN' }));
      fill(fields);
      fireEvent.change(vlanForm().getByLabelText('Propósito'), { target: { value: purpose } });
      save();
      expect(within(screen.getByRole('form')).getByRole('alert').textContent).toContain(message);
      fireEvent.click(vlanForm().getByRole('button', { name: 'Cancelar' }));
    };
    await tryAdd({ ID: '5000', Nombre: 'X', 'Red (opcional)': '' }, 'users', 'El ID de la VLAN va de 1 a 4094.');
    await tryAdd({ ID: '10', Nombre: 'X', 'Red (opcional)': '' }, 'users', 'Ya hay una VLAN con el ID 10.');
    await tryAdd({ ID: '20', Nombre: 'Voz IP', 'Red (opcional)': '' }, 'users', 'El nombre solo admite letras sin tildes, números, guion y guion bajo (máximo 32).');
    await tryAdd({ ID: '20', Nombre: 'VOZ', 'Red (opcional)': '192.168.20.0' }, 'users', 'La red tiene que ir con prefijo, por ejemplo 192.168.10.0/24.');
    await tryAdd({ ID: '20', Nombre: 'GESTION2', 'Red (opcional)': '' }, 'management', 'Solo puede haber una VLAN de gestión.');
    expect(storage.data.get(PLAN_KEY)).toBe(before);
  });

  it('applies a template of the planner', async () => {
    const { storage } = setup(office(), { ...storedPlan(), vlans: [] });
    await panel().findByRole('button', { name: 'Añadir VLAN' });
    fireEvent.click(panel().getByText('Plantillas'));
    fireEvent.click(panel().getByRole('button', { name: 'Oficina pequeña' }));
    await waitFor(() => expect(planIn(storage).vlans).toEqual([
      { id: 10, name: 'USUARIOS', purpose: 'users', subnet: '192.168.10.0/24' },
      { id: 40, name: 'INVITADOS', purpose: 'guests', subnet: '192.168.40.0/24' },
      { id: 99, name: 'GESTION', purpose: 'management', subnet: '192.168.99.0/24' },
    ]));
  });

  it('never writes over a stored plan it cannot read, and says why', async () => {
    const { storage } = setup(office(), '{ esto no es un plan');
    const text = await alertText();
    expect(text).toContain('El plan de red guardado en este navegador no se puede leer; no se ha tocado.');
    expect((panel().getByRole('button', { name: 'Añadir VLAN' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(panel().getByRole('tab', { name: /^Avisos/ }));
    expect(panel().getAllByText(/no se puede leer/).length).toBeGreaterThan(0);
    fireEvent.click(panel().getByRole('tab', { name: /^Direccionamiento$/ }));
    expect((panel().getByLabelText('Switch núcleo') as HTMLSelectElement).disabled).toBe(true);
    expect(storage.data.get(PLAN_KEY)).toBe('{ esto no es un plan');
    expect(storage.writes).toBe(0);
  });
});

describe('addressing', () => {
  it('makes the chosen switch the core and keeps everything else', async () => {
    const { storage } = setup();
    fireEvent.click(panel().getByRole('tab', { name: /^Direccionamiento$/ }));
    const core = await panel().findByLabelText('Switch núcleo') as HTMLSelectElement;
    await waitFor(() => expect(core.value).toBe('sw-1'));
    fireEvent.change(core, { target: { value: 'sw-2' } });
    await waitFor(() => expect(planIn(storage).switches.map((s: { id: string }) => s.id)).toEqual(['sw-2', 'sw-1', 'sw-9']));
    const { switches, ...rest } = planIn(storage);
    const { switches: before, ...restBefore } = storedPlan();
    expect(rest).toEqual(restBefore);
    expect(switches[0]).toEqual(before[1]);
  });

  it('shows each VLAN network with its suggested gateway', async () => {
    setup();
    fireEvent.click(panel().getByRole('tab', { name: /^Direccionamiento$/ }));
    const table = within(await panel().findByRole('table', { name: 'Direccionamiento de las VLAN' }));
    expect(table.getAllByRole('row').slice(1).map(r => r.textContent)).toEqual([
      '10 · USUARIOS192.168.10.0/24192.168.10.1',
      '99 · GESTION192.168.99.0/24192.168.99.1',
    ]);
  });

  it('says there are no switches yet and how to add one', async () => {
    setup({ equipos: [device('fw01', 'FW01', 'firewall')], enlaces: [], grupos: [] }, undefined);
    fireEvent.click(panel().getByRole('tab', { name: /^Direccionamiento$/ }));
    expect(await panel().findByText(/No hay ningún switch en tu inventario/)).toBeTruthy();
    expect(panel().queryByLabelText('Switch núcleo')).toBeNull();
  });

  it('shows a load failure as the panel error, never crashing', async () => {
    const storage = new MemoryStorage();
    const failing = { load: () => Promise.reject(new Error('SecurityError')), apply: () => Promise.reject(new Error('SecurityError')) };
    render(<InfraMapPage repository={createLocalStorageInventoryRepository(storage)} planRepository={failing} />);
    expect(await alertText()).toContain('No se ha podido leer el plan de red: SecurityError');
  });
});

describe('VLAN catalogue and other tabs', () => {
  it('editing one field of a VLAN keeps what another tab changed in the others', async () => {
    const { storage } = setup();
    fireEvent.click((await vlanTable()).getByRole('button', { name: 'Editar la VLAN 10' }));
    const p = planIn(storage);
    storage.data.set(PLAN_KEY, JSON.stringify({ ...p, vlans: p.vlans.map((v: { id: number }) => (v.id === 10 ? { ...v, name: 'OFICINA' } : v)) }));
    fill({ 'Red (opcional)': '10.10.0.0/24' });
    save();
    await waitFor(() => expect(planIn(storage).vlans[0]).toMatchObject({ id: 10, name: 'OFICINA', subnet: '10.10.0.0/24', color: '#2b7' }));
  });

  it('shows a VLAN another tab added as soon as that tab saves it', async () => {
    const { storage } = setup();
    await vlanTable();
    const p = planIn(storage);
    storage.data.set(PLAN_KEY, JSON.stringify({ ...p, vlans: [...p.vlans, { id: 50, name: 'CAMARAS', purpose: 'cameras', subnet: '' }] }));
    window.dispatchEvent(new StorageEvent('storage', { key: PLAN_KEY }));
    expect(await (await vlanTable()).findByText('CAMARAS')).toBeTruthy();
  });
});

describe('reading the plan', () => {
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(ok => { resolve = ok; });
    return { promise, resolve };
  };
  const planOf = (vlans: { id: number; name: string }[]) => ({
    plan: { version: 1 as const, vlans: vlans.map(v => ({ ...v, purpose: 'users' as const, subnet: '' })), switches: [], links: [], ports: [] },
    hidden: [], deducedModels: new Set<string>(), duplicates: [], mapPorts: new Set<string>(), mapVlans: new Map<string, string>(),
  });

  it('clears the read error once a later read succeeds', async () => {
    const storage = new MemoryStorage();
    const real = createLocalStoragePlanRepository(storage);
    storage.data.set(PLAN_KEY, JSON.stringify(storedPlan()));
    let calls = 0;
    const flaky = { load: () => (++calls === 1 ? Promise.reject(new Error('SecurityError')) : real.load()), apply: real.apply };
    render(<InfraMapPage repository={createLocalStorageInventoryRepository(storage)} planRepository={flaky} />);
    expect(await alertText()).toContain('No se ha podido leer el plan de red: SecurityError');
    window.dispatchEvent(new StorageEvent('storage', { key: PLAN_KEY }));
    expect(await (await vlanTable()).findByText('USUARIOS')).toBeTruthy();
    expect(panel().queryByText(/No se ha podido leer el plan de red/)).toBeNull();
    expect((panel().getByRole('button', { name: 'Añadir VLAN' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('ignores a read that finishes after a newer one', async () => {
    const storage = new MemoryStorage();
    const loads: ReturnType<typeof deferred<ReturnType<typeof planOf>>>[] = [];
    const slow = { load: () => { const d = deferred<ReturnType<typeof planOf>>(); loads.push(d); return d.promise; }, apply: () => Promise.resolve() };
    render(<InfraMapPage repository={createLocalStorageInventoryRepository(storage)} planRepository={slow} />);
    await screen.findByRole('complementary', { name: 'Red y VLAN' });
    await new Promise(r => setTimeout(r, 0));
    const before = loads.length;
    window.dispatchEvent(new StorageEvent('storage', { key: PLAN_KEY }));
    await waitFor(() => expect(loads.length).toBe(before + 1));
    // The newest read finishes first; every older one finishes later with an older plan.
    loads[loads.length - 1].resolve(planOf([{ id: 20, name: 'NUEVA' }]));
    expect(await (await vlanTable()).findByText('NUEVA')).toBeTruthy();
    for (const old of loads.slice(0, -1)) old.resolve(planOf([{ id: 10, name: 'VIEJA' }]));
    await new Promise(r => setTimeout(r, 0));
    expect((await vlanTable()).queryByText('VIEJA')).toBeNull();
    expect((await vlanTable()).getByText('NUEVA')).toBeTruthy();
  });
});

describe('library search', () => {
  it('leaves the folded families as they were while a search shows every match', async () => {
    setup();
    const search = screen.getByRole('searchbox', { name: 'Buscar equipos y formas' });
    fireEvent.change(search, { target: { value: 'regle' } });
    const family = screen.getByRole('button', { name: 'Energía', expanded: true });
    expect((family as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(family);
    expect(screen.getByRole('button', { name: 'Añadir Regleta (PDU)' })).toBeTruthy();
    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Energía', expanded: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Añadir Regleta (PDU)' })).toBeTruthy();
  });
});

const switchPanel = () => within(screen.getByRole('complementary', { name: 'Ficha del equipo' }));
const openSwitch = async (name: string, tab?: string) => {
  fireEvent.click(await screen.findByText(name, { selector: '.infra-node__name' }));
  if (tab) fireEvent.click(switchPanel().getByRole('tab', { name: tab }));
  return switchPanel();
};
const portsTable = async () => within(await switchPanel().findByRole('table', { name: /^Puertos de acceso de / }));
const portForm = () => within(switchPanel().getByRole('form', { name: 'Nuevo puerto de acceso' }));

describe('switch selected', () => {
  it('has the tabs «Ficha», «Puertos y VLAN», «Guías» and «Comandos», moved with the arrow keys', async () => {
    setup();
    const p = await openSwitch('CORE');
    const tabs = within(p.getByRole('tablist', { name: 'Configuración del switch' })).getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Ficha', 'Puertos y VLAN', 'Guías', 'Comandos']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    // «Ficha» keeps every field of the device.
    expect((p.getByLabelText('Nombre') as HTMLInputElement).value).toBe('CORE');
    expect(p.getByRole('heading', { name: 'Conexiones' })).toBeTruthy();
    expect(p.getByRole('button', { name: 'Borrar equipo' })).toBeTruthy();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(p.getByRole('tab', { name: 'Puertos y VLAN' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(p.getByRole('tab', { name: 'Puertos y VLAN' }));
    fireEvent.keyDown(p.getByRole('tab', { name: 'Puertos y VLAN' }), { key: 'End' });
    expect(p.getByRole('tab', { name: 'Comandos' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(p.getByRole('tab', { name: 'Comandos' }), { key: 'Home' });
    expect(p.getByRole('tab', { name: 'Ficha' }).getAttribute('aria-selected')).toBe('true');
  });

  it('shows the guides in «Guías» and the way to the commands in «Comandos»', async () => {
    setup();
    const p = await openSwitch('CORE', 'Guías');
    expect(p.getByRole('region', { name: 'Guías para este equipo' })).toBeTruthy();
    fireEvent.click(p.getByRole('tab', { name: 'Comandos' }));
    expect(p.getByText(/Los comandos de cada switch salen del plan de red/)).toBeTruthy();
    expect(p.getByRole('link', { name: 'Planificar VLAN y puertos' }).getAttribute('href')).toBe(PLANNER_URL);
  });

  it('lists the access ports of the switch with their VLAN and its links to other switches', async () => {
    setup(office(), { ...storedPlan(), ports: [...storedPlan().ports, { id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/5', vlan: 10 }] });
    await openSwitch('PLANTA1', 'Puertos y VLAN');
    const rows = (await portsTable()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('gi1/0/5');
    expect((within(rows[0]).getByLabelText('VLAN del puerto gi1/0/5') as HTMLSelectElement).value).toBe('10');
    expect(switchPanel().getByText(/gi1\/0\/1 → CORE/)).toBeTruthy();
  });

  it('adds an access port through the repository, keeping everything else exactly', async () => {
    const { storage } = setup();
    await openSwitch('PLANTA1', 'Puertos y VLAN');
    await switchPanel().findByRole('form', { name: 'Nuevo puerto de acceso' });
    fireEvent.change(portForm().getByLabelText('Puerto'), { target: { value: ' gi1/0/7 ' } });
    fireEvent.change(portForm().getByLabelText('VLAN'), { target: { value: '99' } });
    fireEvent.click(portForm().getByRole('button', { name: 'Añadir puerto' }));
    await waitFor(() => expect(planIn(storage).ports).toHaveLength(2));
    const { ports, ...rest } = planIn(storage);
    const { ports: before, ...restBefore } = storedPlan();
    expect(ports).toEqual([...before, { id: 'pt-3', switch: 'sw-2', interface: 'gi1/0/7', vlan: 99 }]);
    expect(rest).toEqual(restBefore);
    expect(await (await portsTable()).findByText('gi1/0/7')).toBeTruthy();
  });

  it('refuses a port without a name or already in the list, and saves nothing', async () => {
    const { storage } = setup(office(), { ...storedPlan(), ports: [...storedPlan().ports, { id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/5', vlan: 10 }] });
    await openSwitch('PLANTA1', 'Puertos y VLAN');
    await portsTable();
    const before = storage.data.get(PLAN_KEY);
    fireEvent.click(portForm().getByRole('button', { name: 'Añadir puerto' }));
    expect(portForm().getByRole('alert').textContent).toBe('Escribe el puerto, por ejemplo gi1/0/5.');
    fireEvent.change(portForm().getByLabelText('Puerto'), { target: { value: 'GI1/0/5' } });
    fireEvent.click(portForm().getByRole('button', { name: 'Añadir puerto' }));
    expect(portForm().getByRole('alert').textContent).toBe('El puerto GI1/0/5 ya está en la lista: cambia su VLAN en la tabla.');
    await new Promise(r => setTimeout(r, 0));
    expect(storage.data.get(PLAN_KEY)).toBe(before);
  });

  it('changes the VLAN of a port and removes a port, touching only that port', async () => {
    const extra = { id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/5', vlan: 10, description: 'impresora' };
    const { storage } = setup(office(), { ...storedPlan(), ports: [...storedPlan().ports, extra] });
    await openSwitch('PLANTA1', 'Puertos y VLAN');
    fireEvent.change((await portsTable()).getByLabelText('VLAN del puerto gi1/0/5'), { target: { value: '99' } });
    await waitFor(() => expect(planIn(storage).ports[1]).toEqual({ ...extra, vlan: 99 }));
    expect(planIn(storage).ports[0]).toEqual(storedPlan().ports[0]);
    fireEvent.click((await portsTable()).getByRole('button', { name: 'Quitar el puerto gi1/0/5' }));
    await waitFor(() => expect(planIn(storage).ports).toEqual(storedPlan().ports));
    const { ports: _p, ...rest } = planIn(storage);
    const { ports: _q, ...restBefore } = storedPlan();
    expect(rest).toEqual(restBefore);
  });

  it('stores a switch the plan does not have yet the way the planner does when it gets its first port', async () => {
    const topology = office();
    topology.equipos.push(device('planta2', 'PLANTA2', 'switch'));
    topology.enlaces.push(link('l3', 'planta2', 'core', 'troncal'));
    const { storage } = setup(topology);
    await openSwitch('PLANTA2', 'Puertos y VLAN');
    await switchPanel().findByRole('form', { name: 'Nuevo puerto de acceso' });
    fireEvent.change(portForm().getByLabelText('Puerto'), { target: { value: '5' } });
    fireEvent.click(portForm().getByRole('button', { name: 'Añadir puerto' }));
    await waitFor(() => expect(planIn(storage).ports).toHaveLength(2));
    const plan = planIn(storage);
    expect(plan.switches.map((s: { id: string }) => s.id)).toEqual(['sw-1', 'sw-2', 'sw-4', 'sw-9']);
    expect(plan.switches[2]).toEqual({ id: 'sw-4', deviceId: 'planta2', name: 'PLANTA2', platform: '', mgmtIp: '', gateway: '', bridge: '' });
    expect(plan.ports[1]).toEqual({ id: 'pt-3', switch: 'sw-4', interface: '5', vlan: 10 });
    expect(plan.switches[1].rack).toBe('R2');
  });

  it('never writes over a stored plan it cannot read', async () => {
    const { storage } = setup(office(), '{ esto no es un plan');
    await openSwitch('PLANTA1', 'Puertos y VLAN');
    expect(await switchPanel().findByText(/no se puede leer; no se ha tocado/)).toBeTruthy();
    expect(switchPanel().queryByRole('form', { name: 'Nuevo puerto de acceso' })).toBeNull();
    expect(storage.data.get(PLAN_KEY)).toBe('{ esto no es un plan');
    expect(storage.writes).toBe(0);
  });
});

const trunkFicha = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('[aria-label="PLANTA1 – CORE: Troncal"]')).toBeTruthy());
  fireEvent.click(container.querySelector('[aria-label="PLANTA1 – CORE: Troncal"]') as HTMLElement);
  return within(screen.getByRole('complementary', { name: 'Ficha del enlace' }));
};
const topologyIn = (storage: MemoryStorage) => JSON.parse(storage.data.get(TOPOLOGY_KEY) ?? 'null');

describe('link selected', () => {
  it('validates the allowed VLANs as they are typed and saves no invalid list', async () => {
    const { storage, container } = setup();
    const f = await trunkFicha(container);
    expect(f.getByText('Vacío: pasan todas las VLAN del plan.')).toBeTruthy();
    const before = storage.data.get(TOPOLOGY_KEY);
    fireEvent.change(f.getByLabelText('VLAN permitidas'), { target: { value: '10-5' } });
    expect(f.getByText('El rango 10-5 está al revés: escribe primero el número menor (5-10).')).toBeTruthy();
    expect(f.getByLabelText('VLAN permitidas').getAttribute('aria-invalid')).toBe('true');
    fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));
    await new Promise(r => setTimeout(r, 0));
    expect(storage.data.get(TOPOLOGY_KEY)).toBe(before);

    fireEvent.change(f.getByLabelText('VLAN permitidas'), { target: { value: '10, 99' } });
    expect(f.queryByText(/está al revés/)).toBeNull();
    expect(f.getByText('Solo pasan estas VLAN y la VLAN nativa.')).toBeTruthy();
    fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));
    await waitFor(() => expect(topologyIn(storage).enlaces[1].vlans).toBe('10, 99'));
  });

  it('shows the native VLAN of the trunk from the plan and saves a new one there, keeping the rest', async () => {
    const { storage, container } = setup();
    const f = await trunkFicha(container);
    const native = await f.findByLabelText('VLAN nativa') as HTMLInputElement;
    await waitFor(() => expect(native.value).toBe('1'));
    fireEvent.change(native, { target: { value: '99' } });
    fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));
    await waitFor(() => expect(planIn(storage).links[0].nativeVlan).toBe(99));
    const { links, ...rest } = planIn(storage);
    const { links: before, ...restBefore } = storedPlan();
    expect(links).toEqual([{ ...before[0], nativeVlan: 99 }]);
    expect(rest).toEqual(restBefore);
  });

  it('refuses a native VLAN out of range and saves nothing', async () => {
    const { storage, container } = setup();
    const f = await trunkFicha(container);
    const native = await f.findByLabelText('VLAN nativa');
    const plan = storage.data.get(PLAN_KEY);
    const topology = storage.data.get(TOPOLOGY_KEY);
    fireEvent.change(native, { target: { value: '5000' } });
    expect(f.getByText('La VLAN nativa va del 1 al 4094.')).toBeTruthy();
    fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));
    await new Promise(r => setTimeout(r, 0));
    expect(storage.data.get(PLAN_KEY)).toBe(plan);
    expect(storage.data.get(TOPOLOGY_KEY)).toBe(topology);
  });

  it('offers no VLAN fields on a link that does not carry VLANs', async () => {
    const { container } = setup();
    await waitFor(() => expect(container.querySelector('[aria-label="CORE – FW01: Datos"]')).toBeTruthy());
    fireEvent.click(container.querySelector('[aria-label="CORE – FW01: Datos"]') as HTMLElement);
    const f = within(screen.getByRole('complementary', { name: 'Ficha del enlace' }));
    expect(f.queryByLabelText('VLAN permitidas')).toBeNull();
    expect(f.queryByLabelText('VLAN nativa')).toBeNull();
    expect(f.getByLabelText('Velocidad')).toBeTruthy();
  });
});
