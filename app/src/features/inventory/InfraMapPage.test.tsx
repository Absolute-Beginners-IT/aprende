// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { InfraMapPage } from './InfraMapPage';
import { mockReactFlow } from './reactFlowTestSetup';
import type { Link, Topology } from '../../domain/types';
import { fromInventoryV1, upstreamOf, type DeviceV1 } from '../../domain/topology';
import { createMemoryInventoryRepository } from '../../adapters/memoryInventoryRepository';

mockReactFlow();
afterEach(cleanup);

type Repo = ReturnType<typeof createMemoryInventoryRepository>;
const memoryRepository = (initial: DeviceV1[] | Topology = []) => createMemoryInventoryRepository(Array.isArray(initial) ? fromInventoryV1(initial) : initial);
const stored = (repo: Repo, id: string) => repo.topology.equipos.find(d => d.id === id);
const hangsFrom = (repo: Repo, id: string) => upstreamOf(repo.topology.enlaces, id);
const link = (id: string, a: string, b: string, tipo: Link['tipo']): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo });

const network = (): DeviceV1[] => [
  { id: 'fw01', nombre: 'FW01', tipo: 'firewall', criticidad: 'Alta', monitorizado: true, marca: 'Fortinet', modelo: 'FortiGate 60F' },
  { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: false, uplinks: ['fw01'] },
];

const ficha = () => within(screen.getByRole('complementary', { name: 'Ficha del equipo' }));
const openFicha = async (name: string) => {
  fireEvent.click(await screen.findByText(name, { selector: '.infra-node__name' }));
  return ficha();
};

describe('InfraMapPage', () => {
  it('draws every device as a node with its name, type and brand, joined by its uplinks', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(network())} />);
    expect(await screen.findByText('CORE', { selector: '.infra-node__name' })).toBeTruthy();
    expect(screen.getByText('FW01', { selector: '.infra-node__name' })).toBeTruthy();
    expect(screen.getByText('Fortinet FortiGate 60F')).toBeTruthy();
    expect(container.querySelector('.infra-node.fam-net')?.textContent).toContain('Switch');
    expect(container.querySelectorAll('.react-flow__edge')).toHaveLength(1);
  });

  it('tells the learner the map is stored only in this browser', () => {
    render(<InfraMapPage repository={memoryRepository()} />);
    expect(screen.getByText(/solo en este navegador/)).toBeTruthy();
  });

  it('invites to add a device when the inventory is empty', async () => {
    render(<InfraMapPage repository={memoryRepository()} />);
    expect(await screen.findByText(/Tu mapa está vacío/)).toBeTruthy();
  });

  it('shows the gaps and how to use the map while nothing is selected', async () => {
    render(<InfraMapPage repository={memoryRepository(network())} />);
    const aside = within(screen.getByRole('complementary', { name: 'Qué te falta' }));
    expect(await aside.findByText(/No hay ningún sistema de copias de seguridad/)).toBeTruthy();
    expect(aside.getAllByText('Urgente').length).toBeGreaterThan(0);
    expect(aside.getByText(/Arrastra un equipo/)).toBeTruthy();
  });

  it('opens the ficha of the clicked device with its connections, gaps and planner link', async () => {
    render(<InfraMapPage repository={memoryRepository(network())} />);
    const f = await openFicha('CORE');
    expect((f.getByLabelText('Nombre') as HTMLInputElement).value).toBe('CORE');
    expect((f.getByLabelText('Tipo') as HTMLSelectElement).value).toBe('switch');
    expect(f.getByText('FW01')).toBeTruthy();
    expect(f.getByText(/CORE no está monitorizado/)).toBeTruthy();
    expect(f.getByRole('link', { name: 'Planificar VLAN y puertos' }).getAttribute('href')).toBe('./guias/#/plan');
  });

  it('shows the monitoring configuration for the brand of the selected device', async () => {
    render(<InfraMapPage repository={memoryRepository(network())} />);
    const f = await openFicha('FW01');
    expect(f.getByText('FortiGate (FortiOS 7.4, 7.6 y 8.0) · SNMPv3')).toBeTruthy();
    expect(f.queryByRole('link', { name: 'Planificar VLAN y puertos' })).toBeNull();
  });

  it('lists the guides of a covered switch, grouped, opening each one with the device filled in', async () => {
    const access: DeviceV1 = { id: 'sw acceso/1', nombre: 'ACCESO', tipo: 'switch', criticidad: 'Media', monitorizado: false, marca: 'HPE Aruba', modelo: '6100 24G' };
    render(<InfraMapPage repository={memoryRepository([...network(), access])} />);
    const f = await openFicha('ACCESO');
    const section = within(f.getByRole('region', { name: 'Guías para este equipo' }));
    expect(section.getByRole('heading', { level: 3, name: 'Guías para este equipo' })).toBeTruthy();
    expect(section.getByText('Para tu Aruba CX 6100, con sus datos ya puestos:')).toBeTruthy();
    expect(section.getByText('Puesta en marcha y acceso')).toBeTruthy();
    expect(section.getByText('Seguridad y resiliencia')).toBeTruthy();
    const backup = section.getByRole('link', { name: 'Guardar una copia de la configuración' });
    expect(backup.getAttribute('href')).toBe('./guias/#/p/aruba-aoscx/config-backup?equipo=sw%20acceso%2F1');
    const links = section.getAllByRole('link');
    expect(links).toHaveLength(19);
    for (const link of links) expect(link.getAttribute('href')).toMatch(/\?equipo=sw%20acceso%2F1$/);
    expect(f.getByRole('link', { name: 'Planificar VLAN y puertos' })).toBeTruthy();
  });

  it('tells which models the guides cover when the switch has no known brand and model', async () => {
    render(<InfraMapPage repository={memoryRepository(network())} />);
    const section = within((await openFicha('CORE')).getByRole('region', { name: 'Guías para este equipo' }));
    expect(section.getByText('Indica la marca y el modelo para ver sus guías. Las guías cubren: Aruba CX 6100, Cisco Catalyst 1300, MikroTik CRS317 y Ruijie NBS3200.')).toBeTruthy();
    expect(section.queryAllByRole('link')).toHaveLength(0);
  });

  it('links the guides of a FortiGate firewall from its ficha', async () => {
    render(<InfraMapPage repository={memoryRepository(network())} />);
    const section = within((await openFicha('FW01')).getByRole('region', { name: 'Guías para este equipo' }));
    expect(section.getByRole('link', { name: 'Sincronizar la hora con NTP' }).getAttribute('href')).toBe('./guias/#/p/fortinet-fortigate/ntp-client?equipo=fw01');
  });

  it('says the guides for other device types come later', async () => {
    const devices: DeviceV1[] = [...network(), { id: 'srv01', nombre: 'SRV01', tipo: 'servidor', criticidad: 'Media', monitorizado: false, uplinks: ['core'] }];
    render(<InfraMapPage repository={memoryRepository(devices)} />);
    const section = within((await openFicha('SRV01')).getByRole('region', { name: 'Guías para este equipo' }));
    expect(section.getByText('Las guías de este tipo de equipo llegarán más adelante.')).toBeTruthy();
    expect(section.queryAllByRole('link')).toHaveLength(0);
  });

  it('renames a device from its ficha and keeps its id, so its connections stay', async () => {
    const repo = memoryRepository(network());
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('FW01');
    const name = f.getByLabelText('Nombre');
    fireEvent.change(name, { target: { value: 'FW-Sede' } });
    fireEvent.blur(name);
    expect((await screen.findByRole('status')).textContent).toBe('FW-Sede actualizado.');
    expect(stored(repo, 'fw01')?.nombre).toBe('FW-Sede');
    expect(hangsFrom(repo, 'core')).toEqual(['fw01']);
    expect(await screen.findByText('FW-Sede', { selector: '.infra-node__name' })).toBeTruthy();
  });

  it('saves the other fields of the ficha', async () => {
    const repo = memoryRepository(network());
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('CORE');
    fireEvent.change(f.getByLabelText('Marca'), { target: { value: 'HPE Aruba' } });
    fireEvent.blur(f.getByLabelText('Marca'));
    await screen.findByRole('status');
    fireEvent.change(f.getByLabelText('IP'), { target: { value: '10.0.0.2' } });
    fireEvent.blur(f.getByLabelText('IP'));
    fireEvent.change(f.getByLabelText('Criticidad'), { target: { value: 'Baja' } });
    fireEvent.click(f.getByLabelText('Monitorizado'));
    await screen.findByText(/^HPE Aruba AOS-S/);
    await waitFor(() => expect(stored(repo, 'core')?.monitorizado).toBe(true));
    expect(stored(repo, 'core')).toMatchObject({ marca: 'HPE Aruba', ip: '10.0.0.2', criticidad: 'Baja', monitorizado: true });
    expect(hangsFrom(repo, 'core')).toEqual(['fw01']);
  });

  it('adds a device of the type chosen in the palette and opens its ficha', async () => {
    const repo = memoryRepository(network());
    render(<InfraMapPage repository={repo} />);
    await screen.findByText('CORE', { selector: '.infra-node__name' });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir Switch' }));
    expect(await screen.findByText('Switch 1', { selector: '.infra-node__name' })).toBeTruthy();
    expect(stored(repo, 'switch-1')).toMatchObject({ nombre: 'Switch 1', tipo: 'switch' });
    expect(stored(repo, 'switch-1')?.posicion).toBeTruthy();
    expect((ficha().getByLabelText('Nombre') as HTMLInputElement).value).toBe('Switch 1');
  });

  it('removes a connection from the ficha', async () => {
    const repo = memoryRepository(network());
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('FW01');
    fireEvent.click(f.getByRole('button', { name: 'Quitar la conexión con CORE' }));
    expect((await screen.findByRole('status')).textContent).toBe('Conexión entre FW01 y CORE quitada.');
    expect(repo.topology.enlaces).toEqual([]);
  });

  it('deletes a device and the uplinks that pointed to it', async () => {
    const repo = memoryRepository(network());
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('FW01');
    fireEvent.click(f.getByRole('button', { name: 'Borrar equipo' }));
    expect((await screen.findByRole('status')).textContent).toBe('FW01 borrado.');
    expect(stored(repo, 'fw01')).toBeUndefined();
    expect(repo.topology.enlaces).toEqual([]);
    await waitFor(() => expect(screen.queryByText('FW01', { selector: '.infra-node__name' })).toBeNull());
    expect(screen.getByRole('complementary', { name: 'Qué te falta' })).toBeTruthy();
  });

  it('reports a storage failure instead of failing silently', async () => {
    const repo = memoryRepository(network());
    repo.apply = async () => { throw new Error('QuotaExceededError'); };
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('CORE');
    fireEvent.change(f.getByLabelText('Nombre'), { target: { value: 'CORE-01' } });
    fireEvent.blur(f.getByLabelText('Nombre'));
    expect((await screen.findByRole('status')).textContent).toBe('No se ha podido guardar en este navegador: QuotaExceededError');
    expect(stored(repo, 'core')?.nombre).toBe('CORE');
  });

  it('keeps every other device in its place when the first device of an old inventory is moved', async () => {
    const repo = memoryRepository([
      { id: 'fw01', nombre: 'FW01', tipo: 'firewall', criticidad: 'Alta', monitorizado: true },
      { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true, uplinks: ['fw01'] },
      { id: 'acc1', nombre: 'ACC1', tipo: 'switch', criticidad: 'Media', monitorizado: false, uplinks: ['core'] },
      { id: 'esx01', nombre: 'ESX01', tipo: 'hipervisor', criticidad: 'Alta', monitorizado: true, uplinks: ['core'] },
    ]);
    const { container } = render(<InfraMapPage repository={repo} />);
    fireEvent.click(await screen.findByText('ACC1', { selector: '.infra-node__name' }));
    fireEvent.keyDown(container.querySelector('.react-flow__node[data-id="acc1"]') as HTMLElement, { key: 'ArrowRight' });

    await waitFor(() => expect(stored(repo, 'acc1')?.posicion).toBeTruthy());
    expect(stored(repo, 'esx01')?.posicion).toEqual({ x: 190, y: 220 });
    expect(stored(repo, 'fw01')?.posicion).toEqual({ x: 0, y: 0 });
    expect(stored(repo, 'acc1')?.posicion).not.toEqual({ x: 190, y: 220 });
  });

  it('leaves every stored device as it was when a move cannot be saved', async () => {
    const original: DeviceV1[] = [
      { id: 'fw01', nombre: 'FW01', tipo: 'firewall', criticidad: 'Alta', monitorizado: true },
      { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true, uplinks: ['fw01'] },
      { id: 'acc1', nombre: 'ACC1', tipo: 'switch', criticidad: 'Media', monitorizado: false, uplinks: ['core'] },
    ];
    const repo = memoryRepository(original);
    const before = repo.topology;
    // The browser storage is full: a move must not be left half saved.
    repo.apply = async () => { throw new Error('QuotaExceededError'); };
    const { container } = render(<InfraMapPage repository={repo} />);
    fireEvent.click(await screen.findByText('ACC1', { selector: '.infra-node__name' }));
    fireEvent.keyDown(container.querySelector('.react-flow__node[data-id="acc1"]') as HTMLElement, { key: 'ArrowRight' });

    expect((await screen.findByRole('status')).textContent).toBe('No se ha podido guardar en este navegador: QuotaExceededError');
    expect(repo.topology).toEqual(before);
  });

  it('removes a device and the uplinks that pointed to it together or not at all', async () => {
    const original: DeviceV1[] = [
      { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true },
      { id: 'acc1', nombre: 'ACC1', tipo: 'switch', criticidad: 'Media', monitorizado: false, uplinks: ['core'] },
      { id: 'acc2', nombre: 'ACC2', tipo: 'switch', criticidad: 'Media', monitorizado: false, uplinks: ['core'] },
    ];
    const repo = memoryRepository(original);
    const before = repo.topology;
    repo.apply = async () => { throw new Error('QuotaExceededError'); };
    render(<InfraMapPage repository={repo} />);
    fireEvent.click((await openFicha('CORE')).getByRole('button', { name: 'Borrar equipo' }));

    expect((await screen.findByRole('status')).textContent).toBe('No se ha podido guardar en este navegador: QuotaExceededError');
    expect(repo.topology).toEqual(before);
  });

  it('removes connections with a single write of every device that changes', async () => {
    const repo = memoryRepository(network());
    let writes = 0;
    const apply = repo.apply;
    repo.apply = change => { writes++; return apply(change); };
    render(<InfraMapPage repository={repo} />);
    fireEvent.click((await openFicha('CORE')).getByRole('button', { name: /Quitar/ }));

    await waitFor(() => expect(hangsFrom(repo, 'core')).toEqual([]));
    expect(writes).toBe(1);
  });

  it('draws one line per link, two links between the same pair of firewalls included', async () => {
    const [fw1, fw2] = fromInventoryV1([{ id: 'fw1', nombre: 'FW1', tipo: 'firewall', criticidad: 'Alta', monitorizado: true }, { id: 'fw2', nombre: 'FW2', tipo: 'firewall', criticidad: 'Alta', monitorizado: true }]).equipos;
    const { container } = render(<InfraMapPage repository={memoryRepository({ equipos: [fw1, fw2], enlaces: [link('h1', 'fw1', 'fw2', 'ha'), link('h2', 'fw2', 'fw1', 'ha')], grupos: [] })} />);
    await screen.findByText('FW1', { selector: '.infra-node__name' });
    await waitFor(() => expect(container.querySelectorAll('.react-flow__edge')).toHaveLength(2));
  });

  it('lists every link of the device in its ficha and removes only the one chosen', async () => {
    const [fw1, fw2] = fromInventoryV1([{ id: 'fw1', nombre: 'FW1', tipo: 'firewall', criticidad: 'Alta', monitorizado: true }, { id: 'fw2', nombre: 'FW2', tipo: 'firewall', criticidad: 'Alta', monitorizado: true }]).equipos;
    const repo = memoryRepository({ equipos: [fw1, fw2], enlaces: [link('h1', 'fw1', 'fw2', 'ha'), link('h2', 'fw2', 'fw1', 'ha')], grupos: [] });
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('FW1');
    const buttons = f.getAllByRole('button', { name: 'Quitar la conexión con FW2' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect((await screen.findByRole('status')).textContent).toBe('Conexión entre FW1 y FW2 quitada.');
    expect(repo.topology.enlaces.map(l => l.id)).toEqual(['h1']);
  });

  it('removes a device with its links and takes it out of its groups in one write', async () => {
    const [fw1, fw2] = fromInventoryV1([{ id: 'fw1', nombre: 'FW1', tipo: 'firewall', criticidad: 'Alta', monitorizado: true }, { id: 'fw2', nombre: 'FW2', tipo: 'firewall', criticidad: 'Alta', monitorizado: true }]).equipos;
    const repo = memoryRepository({ equipos: [fw1, fw2], enlaces: [link('h1', 'fw1', 'fw2', 'ha')], grupos: [{ id: 'par', tipo: 'ha', nombre: 'Par', miembros: ['fw1', 'fw2'] }] });
    let writes = 0;
    const apply = repo.apply;
    repo.apply = change => { writes++; return apply(change); };
    render(<InfraMapPage repository={repo} />);
    fireEvent.click((await openFicha('FW1')).getByRole('button', { name: 'Borrar equipo' }));
    expect((await screen.findByRole('status')).textContent).toBe('FW1 borrado.');
    expect(repo.topology).toEqual({ equipos: [fw2], enlaces: [], grupos: [{ id: 'par', tipo: 'ha', nombre: 'Par', miembros: ['fw2'] }] });
    expect(writes).toBe(1);
  });
});
