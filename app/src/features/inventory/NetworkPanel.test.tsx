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
