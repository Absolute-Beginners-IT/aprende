// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InventoryPage } from './InventoryPage';
import type { Device } from '../../domain/types';
import type { InventoryRepository } from '../../ports/InventoryRepository';

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
    expect(repo.devices.get('fw01')?.monitorizado).toBe(true);
    expect(await screen.findByText('Tus equipos (3)')).toBeTruthy();
  });

  it('shows the gap analysis for the imported inventory', async () => {
    render(<InventoryPage repository={memoryRepository()} />);
    await importCsv('Nombre;Tipo\nCORE;switch');
    expect(await screen.findByText(/No hay ningún firewall registrado/)).toBeTruthy();
  });

  it('shows an error instead of failing silently when the browser storage cannot save', async () => {
    const repo = memoryRepository();
    repo.save = async () => { throw new Error('QuotaExceededError'); };
    render(<InventoryPage repository={repo} />);
    expect(await importCsv('Nombre;Tipo\nFW01;firewall')).toBe('No se ha podido guardar en este navegador: QuotaExceededError');
  });

  it('shows an error when the saved inventory cannot be read', async () => {
    const repo = memoryRepository();
    repo.list = async () => { throw new Error('SecurityError'); };
    render(<InventoryPage repository={repo} />);
    expect((await screen.findByRole('status')).textContent).toBe('No se ha podido leer el inventario guardado: SecurityError');
  });
});
