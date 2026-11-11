// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InventoryPage } from './InventoryPage';
import type { Link, Topology } from '../../domain/types';
import { fromInventoryV1, upstreamOf, type DeviceV1 } from '../../domain/topology';
import { createMemoryInventoryRepository } from '../../adapters/memoryInventoryRepository';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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

  it('lists in «Qué te falta» the gaps of groups and links, naming the group or the device', async () => {
    const dev = (id: string, tipo: string): DeviceV1 => ({ id, nombre: id.toUpperCase(), tipo, criticidad: 'Media', monitorizado: true });
    const topology = fromInventoryV1([dev('fw1', 'firewall'), dev('fw2', 'firewall'), dev('core', 'switch')]);
    const enlaces: Link[] = [
      { id: '1', a: { equipo: 'core', puerto: '1/1/49' }, b: { equipo: 'fw1' }, tipo: 'troncal' },
      { id: '2', a: { equipo: 'core', puerto: '1/1/49' }, b: { equipo: 'fw2' }, tipo: 'troncal' },
    ];
    render(<InventoryPage repository={createMemoryInventoryRepository({ ...topology, enlaces, grupos: [{ id: 'grupo-1', tipo: 'ha', nombre: 'Par FortiGate', miembros: ['fw1', 'fw2'] }] })} />);
    expect(await screen.findByText('El grupo HA «Par FortiGate» no tiene ningún enlace HA entre sus equipos.')).toBeTruthy();
    expect(screen.getByText('CORE usa el puerto «1/1/49» en 2 enlaces.')).toBeTruthy();
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

  describe('schema as JSON', () => {
    const fw = (id: string) => ({ id, nombre: id.toUpperCase(), tipo: 'firewall', criticidad: 'Alta' as const, monitorizado: true });
    const schema: Topology = {
      equipos: [fw('fw1'), fw('fw2')],
      enlaces: [{ id: 'fw1--fw2', a: { equipo: 'fw1', puerto: 'ha1' }, b: { equipo: 'fw2', puerto: 'ha1' }, tipo: 'ha' }],
      grupos: [{ id: 'grupo-1', tipo: 'ha', nombre: 'Par FortiGate', miembros: ['fw1', 'fw2'] }],
    };
    /** Captures what a download link would save: the file name and the content of the blob behind it. */
    const captureDownloads = () => {
      const blobs: Blob[] = [];
      const names: string[] = [];
      URL.createObjectURL = (blob: Blob) => { blobs.push(blob); return `blob:${blobs.length}`; };
      URL.revokeObjectURL = () => {};
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
      return { blobs, names };
    };
    const chooseFile = (text: string) =>
      fireEvent.change(screen.getByLabelText('Importar el esquema (JSON)'), { target: { files: [new File([text], 'mi-infraestructura.json', { type: 'application/json' })] } });
    /** A memory repository that records every write it receives. */
    const counted = (initial: Topology) => {
      const repo = createMemoryInventoryRepository(initial);
      const apply = repo.apply.bind(repo);
      const writes: unknown[] = [];
      repo.apply = async change => { writes.push(change); await apply(change); };
      return { repo, writes };
    };

    it('downloads the whole schema as mi-infraestructura.json, version 2', async () => {
      const downloads = captureDownloads();
      render(<InventoryPage repository={createMemoryInventoryRepository(schema)} />);
      await screen.findByText('Tus equipos (2)');
      fireEvent.click(screen.getByRole('button', { name: 'Exportar el esquema (JSON)' }));
      expect(downloads.names).toEqual(['mi-infraestructura.json']);
      expect(JSON.parse(await downloads.blobs[0].text())).toEqual({ version: 2, ...schema });
    });

    it('still downloads the CSV export as before, next to the JSON one', async () => {
      const downloads = captureDownloads();
      render(<InventoryPage repository={memoryRepository([
        { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true },
        { id: 'acc', nombre: 'ACC', tipo: 'switch', criticidad: 'Media', monitorizado: false, uplinks: ['core'] },
      ])} />);
      await screen.findByText('Tus equipos (2)');
      fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
      expect(downloads.names[0]).toMatch(/^inventario_\d{4}-\d{2}-\d{2}\.csv$/);
      expect((await downloads.blobs[0].text()).split('\r\n')[1]).toBe('ACC;switch;;;;;;Media;core;;;;No;');
    });

    it.each([
      ['text that is not JSON', '{roto', 'No se ha podido importar: el archivo no es un JSON válido.'],
      ['a foreign document', JSON.stringify([{ id: 'fw1' }]), 'No se ha podido importar: el archivo no es un esquema de Mi infraestructura (versión 2).'],
      ['a schema with no devices', JSON.stringify({ version: 2, equipos: [], enlaces: [], grupos: [] }), 'No se ha podido importar: el esquema no tiene ningún equipo.'],
    ])('shows an error for %s and saves nothing', async (_, text, error) => {
      const { repo, writes } = counted(fromInventoryV1([{ id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true }]));
      render(<InventoryPage repository={repo} />);
      await screen.findByText('Tus equipos (1)');
      chooseFile(text);
      expect((await screen.findByRole('status')).textContent).toBe(error);
      expect(screen.queryByRole('group', { name: 'Confirmar la importación del esquema' })).toBeNull();
      expect(writes).toEqual([]);
    });

    it('asks before replacing, naming what goes and what comes in', async () => {
      const { repo, writes } = counted(fromInventoryV1([
        { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true },
        { id: 'acc', nombre: 'ACC', tipo: 'switch', criticidad: 'Media', monitorizado: false },
        { id: 'srv', nombre: 'SRV', tipo: 'servidor', criticidad: 'Media', monitorizado: false },
      ]));
      render(<InventoryPage repository={repo} />);
      await screen.findByText('Tus equipos (3)');
      chooseFile(JSON.stringify({ version: 2, ...schema, enlaces: [...schema.enlaces, { ...schema.enlaces[0], id: 'fw1--fw2-2' }] }));
      const confirm = await screen.findByRole('group', { name: 'Confirmar la importación del esquema' });
      expect(confirm.textContent).toContain('Sustituye tus 3 equipos por 2 equipos, 2 enlaces y 1 grupo.');
      expect(writes).toEqual([]);
    });

    it('replaces the whole topology in one write when the learner confirms', async () => {
      const { repo, writes } = counted(fromInventoryV1([{ id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true, uplinks: ['gone'] }]));
      render(<InventoryPage repository={repo} />);
      await screen.findByText('Tus equipos (1)');
      chooseFile(JSON.stringify({ version: 2, ...schema }));
      fireEvent.click(await screen.findByRole('button', { name: 'Sí, sustituir' }));
      expect(await screen.findByText('Esquema importado: 2 equipos, 1 enlace y 1 grupo.')).toBeTruthy();
      expect(writes).toHaveLength(1);
      expect(repo.topology).toEqual(schema);
      expect(await screen.findByText('Tus equipos (2)')).toBeTruthy();
    });

    it('saves nothing when the learner cancels the import', async () => {
      const initial = fromInventoryV1([{ id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Alta', monitorizado: true }]);
      const { repo, writes } = counted(initial);
      render(<InventoryPage repository={repo} />);
      await screen.findByText('Tus equipos (1)');
      chooseFile(JSON.stringify({ version: 2, ...schema }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('group', { name: 'Confirmar la importación del esquema' })).toBeNull();
      expect(writes).toEqual([]);
      expect(repo.topology).toEqual(initial);
    });

    it('explains what the CSV and the JSON schema carry, and where link types, ports and groups are edited', async () => {
      render(<InventoryPage repository={memoryRepository()} />);
      expect(await screen.findByText(/El esquema JSON lleva todo/)).toBeTruthy();
      expect(screen.getByText(/El tipo de enlace, los puertos y los grupos se cambian en el mapa/)).toBeTruthy();
    });
  });
});
