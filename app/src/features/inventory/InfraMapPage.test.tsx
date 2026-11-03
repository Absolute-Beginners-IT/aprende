// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { InfraMapPage } from './InfraMapPage';
import { mockReactFlow } from './reactFlowTestSetup';
import type { Device } from '../../domain/types';
import type { InventoryRepository } from '../../ports/InventoryRepository';

mockReactFlow();
afterEach(cleanup);

function memoryRepository(initial: Device[] = []): InventoryRepository & { devices: Map<string, Device> } {
  const devices = new Map(initial.map(d => [d.id, d]));
  return {
    devices,
    async list() { return [...devices.values()]; },
    async save(d) { devices.set(d.id, d); },
    async remove(id) { devices.delete(id); },
  };
}

const network = (): Device[] => [
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

  it('renames a device from its ficha and keeps its id, so its connections stay', async () => {
    const repo = memoryRepository(network());
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('FW01');
    const name = f.getByLabelText('Nombre');
    fireEvent.change(name, { target: { value: 'FW-Sede' } });
    fireEvent.blur(name);
    expect((await screen.findByRole('status')).textContent).toBe('FW-Sede actualizado.');
    expect(repo.devices.get('fw01')?.nombre).toBe('FW-Sede');
    expect(repo.devices.get('core')?.uplinks).toEqual(['fw01']);
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
    await waitFor(() => expect(repo.devices.get('core')?.monitorizado).toBe(true));
    expect(repo.devices.get('core')).toMatchObject({ marca: 'HPE Aruba', ip: '10.0.0.2', criticidad: 'Baja', monitorizado: true, uplinks: ['fw01'] });
  });

  it('adds a device of the type chosen in the palette and opens its ficha', async () => {
    const repo = memoryRepository(network());
    render(<InfraMapPage repository={repo} />);
    await screen.findByText('CORE', { selector: '.infra-node__name' });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir Switch' }));
    expect(await screen.findByText('Switch 1', { selector: '.infra-node__name' })).toBeTruthy();
    expect(repo.devices.get('switch-1')).toMatchObject({ nombre: 'Switch 1', tipo: 'switch' });
    expect(repo.devices.get('switch-1')?.posicion).toBeTruthy();
    expect((ficha().getByLabelText('Nombre') as HTMLInputElement).value).toBe('Switch 1');
  });

  it('removes a connection from the ficha', async () => {
    const repo = memoryRepository(network());
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('FW01');
    fireEvent.click(f.getByRole('button', { name: 'Quitar la conexión con CORE' }));
    expect((await screen.findByRole('status')).textContent).toBe('Conexión entre FW01 y CORE quitada.');
    expect(repo.devices.get('core')?.uplinks).toEqual([]);
  });

  it('deletes a device and the uplinks that pointed to it', async () => {
    const repo = memoryRepository(network());
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('FW01');
    fireEvent.click(f.getByRole('button', { name: 'Borrar equipo' }));
    expect((await screen.findByRole('status')).textContent).toBe('FW01 borrado.');
    expect(repo.devices.has('fw01')).toBe(false);
    expect(repo.devices.get('core')?.uplinks).toEqual([]);
    await waitFor(() => expect(screen.queryByText('FW01', { selector: '.infra-node__name' })).toBeNull());
    expect(screen.getByRole('complementary', { name: 'Qué te falta' })).toBeTruthy();
  });

  it('reports a storage failure instead of failing silently', async () => {
    const repo = memoryRepository(network());
    repo.save = async () => { throw new Error('QuotaExceededError'); };
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('CORE');
    fireEvent.change(f.getByLabelText('Nombre'), { target: { value: 'CORE-01' } });
    fireEvent.blur(f.getByLabelText('Nombre'));
    expect((await screen.findByRole('status')).textContent).toBe('No se ha podido guardar en este navegador: QuotaExceededError');
    expect(repo.devices.get('core')?.nombre).toBe('CORE');
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

    await waitFor(() => expect(repo.devices.get('acc1')?.posicion).toBeTruthy());
    expect(repo.devices.get('esx01')?.posicion).toEqual({ x: 190, y: 220 });
    expect(repo.devices.get('fw01')?.posicion).toEqual({ x: 0, y: 0 });
    expect(repo.devices.get('acc1')?.posicion).not.toEqual({ x: 190, y: 220 });
  });
});
