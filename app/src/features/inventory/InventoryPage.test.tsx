// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InventoryPage } from './InventoryPage';
import type { Link } from '../../domain/types';
import { fromInventoryV1, upstreamOf, type DeviceV1 } from '../../domain/topology';
import { createMemoryInventoryRepository } from '../../adapters/memoryInventoryRepository';

afterEach(cleanup);

type Repo = ReturnType<typeof createMemoryInventoryRepository>;
const memoryRepository = (initial: DeviceV1[] = []) => createMemoryInventoryRepository(fromInventoryV1(initial));
const stored = (repo: Repo, id: string) => repo.topology.equipos.find(d => d.id === id);
const hangsFrom = (repo: Repo, id: string) => upstreamOf(repo.topology.enlaces, id);

const importCsv = async (csv: string) => {
  fireEvent.change(screen.getByLabelText('CSV del inventario'), { target: { value: csv } });
  fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
  return (await screen.findByRole('status')).textContent;
};

describe('InventoryPage', () => {
  it('tells the learner the inventory stays in the browser and starts empty', async () => {
    render(<InventoryPage repository={memoryRepository()} />);
    expect(screen.getByText(/solo en este navegador/)).toBeTruthy();
    expect(await screen.findByText('Todavía no has añadido ningún equipo.')).toBeTruthy();
  });

  it('reports new and updated devices when an import overwrites existing ones', async () => {
    const repo = memoryRepository();
    render(<InventoryPage repository={repo} />);
    expect(await importCsv('Nombre;Tipo\nFW01;firewall\nCORE;switch')).toBe('2 equipos importados (nuevos: 2, actualizados: 0).');
    expect(await screen.findByText('Tus equipos (2)')).toBeTruthy();

    expect(await importCsv('Nombre;Tipo;Monitorizado\nFW01;firewall;Sí\nESX01;hipervisor;No'))
      .toBe('2 equipos importados (nuevos: 1, actualizados: 1). Los equipos que ya existían se han sobrescrito con los datos del CSV.');
    expect(stored(repo, 'fw01')?.monitorizado).toBe(true);
    expect(await screen.findByText('Tus equipos (3)')).toBeTruthy();
  });

  it('keeps the place on the map of a device that a CSV import overwrites', async () => {
    const repo = memoryRepository([{ id: 'fw01', nombre: 'FW01', tipo: 'firewall', criticidad: 'Alta', monitorizado: false, posicion: { x: 40, y: 120 } }]);
    render(<InventoryPage repository={repo} />);
    expect(await screen.findByText('Tus equipos (1)')).toBeTruthy();
    await importCsv('Nombre;Tipo;Monitorizado\nFW01;firewall;Sí');
    expect(stored(repo, 'fw01')).toMatchObject({ monitorizado: true, posicion: { x: 40, y: 120 } });
  });

  it('combines rows that resolve to the same device and says so instead of over-counting', async () => {
    const repo = memoryRepository();
    render(<InventoryPage repository={repo} />);
    expect(await importCsv('Nombre;Tipo;Monitorizado\nFW01;firewall;No\nfw01;firewall;Sí\nCORE;switch;No'))
      .toBe('2 equipos importados (nuevos: 2, actualizados: 0). 1 fila repetida por nombre se ha combinado: se conserva la última.');
    expect(repo.topology.equipos).toHaveLength(2);
    expect(stored(repo, 'fw01')?.monitorizado).toBe(true);
  });

  it('saves the brand and model from the form and shows the configuration for that brand', async () => {
    const repo = memoryRepository();
    render(<InventoryPage repository={repo} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'FW01' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'firewall' } });
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Fortinet' } });
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'FortiGate 60F' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(await screen.findByText('FortiGate (FortiOS 7.4, 7.6 y 8.0) · SNMPv3')).toBeTruthy();
    expect(screen.getByText(/config system snmp sysinfo/)).toBeTruthy();
    expect(screen.getByText(/Fortinet FortiGate 60F/)).toBeTruthy();
    expect(stored(repo, 'fw01')).toMatchObject({ marca: 'Fortinet', modelo: 'FortiGate 60F' });
  });

  it('shows the configuration for imported devices and nothing for unknown brands', async () => {
    render(<InventoryPage repository={memoryRepository()} />);
    await importCsv('Nombre;Tipo;Marca;Modelo\nCORE;switch;HPE Aruba;6300M\nSRV;servidor;Genérica;X1');
    expect(await screen.findByText('HPE Aruba AOS-CX · SNMPv3')).toBeTruthy();
    expect(screen.getAllByText(/· SNMPv3|· API|· Redfish/)).toHaveLength(1);
  });

  it('shows the gap analysis for the imported inventory', async () => {
    render(<InventoryPage repository={memoryRepository()} />);
    await importCsv('Nombre;Tipo\nCORE;switch');
    expect(await screen.findByText(/No hay ningún firewall registrado/)).toBeTruthy();
  });

  it('deletes a device together with the connections that pointed to it, in one write', async () => {
    const repo = memoryRepository([
      { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: false },
      { id: 'p1', nombre: 'P1', tipo: 'switch', criticidad: 'Media', monitorizado: false, uplinks: ['core'] },
    ]);
    render(<InventoryPage repository={repo} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar CORE' }));

    expect(await screen.findByText('CORE borrado.')).toBeTruthy();
    expect(repo.topology.equipos.map(d => d.id)).toEqual(['p1']);
    expect(hangsFrom(repo, 'p1')).toEqual([]);
    expect(screen.queryByText(/conectado a/)).toBeNull();
  });

  it('shows an error instead of failing silently when the browser storage cannot save', async () => {
    const repo = memoryRepository();
    repo.apply = async () => { throw new Error('QuotaExceededError'); };
    render(<InventoryPage repository={repo} />);
    expect(await importCsv('Nombre;Tipo\nFW01;firewall')).toBe('No se ha podido guardar en este navegador: QuotaExceededError');
  });

  it('stores a whole import in one write, or nothing when the storage fails, and keeps the CSV for a retry', async () => {
    const repo = memoryRepository();
    let writes = 0;
    repo.apply = async () => { writes++; throw new Error('QuotaExceededError'); };
    render(<InventoryPage repository={repo} />);
    expect(await importCsv('Nombre;Tipo\nFW01;firewall\nCORE;switch')).toBe('No se ha podido guardar en este navegador: QuotaExceededError');
    expect(writes).toBe(1);
    expect(repo.topology.equipos).toEqual([]);
    expect((screen.getByLabelText('CSV del inventario') as HTMLTextAreaElement).value).toBe('Nombre;Tipo\nFW01;firewall\nCORE;switch');
  });

  it('turns the Uplink column of an import into links and shows what each device is connected to', async () => {
    const repo = memoryRepository();
    render(<InventoryPage repository={repo} />);
    await importCsv('Nombre;Tipo;Uplink\nFW01;firewall;\nCORE;switch;FW01\nACC;switch;CORE|FALTA');
    expect(repo.topology.enlaces.map(l => [l.a.equipo, l.b.equipo, l.tipo])).toEqual([['core', 'fw01', 'datos'], ['acc', 'core', 'datos'], ['acc', 'falta', 'datos']]);
    expect(await screen.findByText(/· conectado a FW01$/)).toBeTruthy();
    expect(screen.getByText(/· conectado a CORE, falta$/)).toBeTruthy();
    expect(screen.getByText('ACC depende de «falta», que no está en el inventario.')).toBeTruthy();
  });

  it('shows what a device is connected to in the order of the last CSV imported, even when it only reorders it', async () => {
    render(<InventoryPage repository={memoryRepository()} />);
    await importCsv('Nombre;Tipo;Uplink\r\nCORE1;switch;\r\nCORE2;switch;\r\nACC1;switch;core1');
    expect(await screen.findByText(/· conectado a CORE1$/)).toBeTruthy();
    await importCsv('Nombre;Tipo;Uplink\r\nACC1;switch;core2,core1');
    expect(await screen.findByText(/· conectado a CORE2, CORE1$/)).toBeTruthy();
  });

  it('adds a device connected to the one chosen in the form as a datos link', async () => {
    const repo = memoryRepository([{ id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true }]);
    render(<InventoryPage repository={repo} />);
    await screen.findByText('Tus equipos (1)');
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'ACC1' } });
    fireEvent.change(screen.getByLabelText('Conectado a'), { target: { value: 'core' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(await screen.findByText(/· conectado a CORE$/)).toBeTruthy();
    expect(repo.topology.enlaces).toEqual([{ id: 'acc1--core', a: { equipo: 'acc1' }, b: { equipo: 'core' }, tipo: 'datos' } satisfies Link]);
  });

  it('shows an error when the saved inventory cannot be read', async () => {
    const repo = memoryRepository();
    repo.load = async () => { throw new Error('SecurityError'); };
    render(<InventoryPage repository={repo} />);
    expect((await screen.findByRole('status')).textContent).toBe('No se ha podido leer el inventario guardado: SecurityError');
  });

  it('links each switch to the network planner, where its VLANs and ports are designed', async () => {
    render(<InventoryPage repository={memoryRepository([
      { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true },
      { id: 'fw01', nombre: 'FW01', tipo: 'firewall', criticidad: 'Alta', monitorizado: true },
    ])} />);
    const links = await screen.findAllByRole('link', { name: 'Planificar VLAN y puertos' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('./guias/#/plan');
  });
});
