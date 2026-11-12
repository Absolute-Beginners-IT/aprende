// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { InfraMapPage } from './InfraMapPage';
import { mockReactFlow } from './reactFlowTestSetup';
import type { Device, Link, Topology } from '../../domain/types';
import { fromInventoryV1, upstreamOf, type DeviceV1 } from '../../domain/topology';
import { createMemoryInventoryRepository } from '../../adapters/memoryInventoryRepository';
import { arrangeByTiers, layoutDevices } from '../../domain/infraMap';

mockReactFlow();
afterEach(() => { cleanup(); localStorage.clear(); });

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
    const shown = layoutDevices(repo.topology);
    const { container } = render(<InfraMapPage repository={repo} />);
    fireEvent.click(await screen.findByText('ACC1', { selector: '.infra-node__name' }));
    fireEvent.keyDown(container.querySelector('.react-flow__node[data-id="acc1"]') as HTMLElement, { key: 'ArrowRight' });

    await waitFor(() => expect(stored(repo, 'acc1')?.posicion).toBeTruthy());
    expect(stored(repo, 'esx01')?.posicion).toEqual(shown.get('esx01'));
    expect(stored(repo, 'fw01')?.posicion).toEqual(shown.get('fw01'));
    expect(stored(repo, 'core')?.posicion).toEqual(shown.get('core'));
    expect(stored(repo, 'acc1')?.posicion).not.toEqual(shown.get('acc1'));
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

// Two firewalls in HA with two HA links, a stack of two cores, an access switch with a 10G LAG, a host in a cluster,
// a UPS with a power line and a management line.
const drawing = (): Topology => {
  const d = (id: string, tipo: string, posicion?: { x: number; y: number }): Device => ({ id, nombre: id.toUpperCase(), tipo, criticidad: 'Alta', monitorizado: true, ...(posicion ? { posicion } : {}) });
  return {
    equipos: [d('fw1', 'firewall', { x: 900, y: 900 }), d('fw2', 'firewall'), d('core1', 'switch'), d('core2', 'switch'), d('acc1', 'switch'), d('esx1', 'hipervisor'), d('sai', 'sai')],
    enlaces: [
      link('h1', 'fw1', 'fw2', 'ha'), link('h2', 'fw2', 'fw1', 'ha'), link('s1', 'core1', 'core2', 'stack'),
      link('c1', 'core1', 'fw1', 'datos'), { ...link('l1', 'acc1', 'core1', 'lag'), velocidad: '10G' }, link('e1', 'esx1', 'core2', 'datos'),
      link('p1', 'sai', 'fw1', 'energia'), link('g1', 'core1', 'acc1', 'gestion'),
    ],
    grupos: [{ id: 'cl', tipo: 'cluster', nombre: 'Clúster', miembros: ['esx1'] }],
  };
};
const edgesOf = (container: HTMLElement) => container.querySelectorAll('.react-flow__edge');

describe('InfraMapPage drawing', () => {
  it('names every line «A – B: tipo», two HA lines between the same firewalls included', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(drawing())} />);
    await waitFor(() => expect(edgesOf(container)).toHaveLength(7));
    expect(container.querySelectorAll('[aria-label="FW1 – FW2: HA"], [aria-label="FW2 – FW1: HA"]')).toHaveLength(2);
    expect(container.querySelector('[aria-label="ACC1 – CORE1: LAG"]')).toBeTruthy();
    expect(container.querySelector('.react-flow__edge.infra-edge--stack')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Energía' }));
    await waitFor(() => expect(container.querySelector('[aria-label="SAI – FW1: Energía"]')).toBeTruthy());
  });

  it('shows the speed and «LAG» on the line of a LAG', async () => {
    render(<InfraMapPage repository={memoryRepository(drawing())} />);
    expect(await screen.findByText('LAG · 10G')).toBeTruthy();
  });

  it('draws a labelled box around each group and each HA or stack pair, and names the tiers', async () => {
    render(<InfraMapPage repository={memoryRepository(drawing())} />);
    expect(await screen.findByRole('group', { name: 'HA: FW1, FW2' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Stack: CORE1, CORE2' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Clúster: ESX1' })).toBeTruthy();
    for (const tier of ['Perímetro', 'Red', 'Servidores', 'Energía']) expect(screen.getByText(tier, { selector: '.infra-tier' })).toBeTruthy();
  });

  it('lists in the legend only the link types on the map', async () => {
    render(<InfraMapPage repository={memoryRepository(drawing())} />);
    const legend = within(await screen.findByRole('region', { name: 'Leyenda del mapa' }));
    expect(legend.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Datos', 'LAG', 'HA', 'Stack', 'Gestión']);
  });

  it('hides management lines with their toggle and remembers it in this browser', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(drawing())} />);
    await waitFor(() => expect(edgesOf(container)).toHaveLength(7));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar las líneas de gestión' }));
    await waitFor(() => expect(edgesOf(container)).toHaveLength(6));
    expect(container.querySelector('.react-flow__edge.infra-edge--gestion')).toBeNull();
    cleanup();

    const again = render(<InfraMapPage repository={memoryRepository(drawing())} />);
    await screen.findByText('FW1', { selector: '.infra-node__name' });
    await waitFor(() => expect(edgesOf(again.container)).toHaveLength(6));
    expect((screen.getByRole('checkbox', { name: 'Mostrar las líneas de gestión' }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar las líneas de gestión' }));
    await waitFor(() => expect(edgesOf(again.container)).toHaveLength(7));
  });

  it('keeps showing every line when the browser storage cannot be read', async () => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('SecurityError'); };
    try {
      const { container } = render(<InfraMapPage repository={memoryRepository(drawing())} />);
      await waitFor(() => expect(edgesOf(container)).toHaveLength(7));
      expect(screen.getByRole('tab', { name: 'Red' }).getAttribute('aria-selected')).toBe('true');
    } finally { Storage.prototype.getItem = getItem; }
  });

  it('places every device by tiers in one write only after confirming', async () => {
    const repo = memoryRepository(drawing());
    const before = repo.topology;
    let writes = 0;
    const apply = repo.apply;
    repo.apply = change => { writes++; return apply(change); };
    render(<InfraMapPage repository={repo} />);
    await screen.findByText('FW1', { selector: '.infra-node__name' });

    fireEvent.click(screen.getByRole('button', { name: 'Colocar por capas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(writes).toBe(0);
    expect(repo.topology).toBe(before);

    fireEvent.click(screen.getByRole('button', { name: 'Colocar por capas' }));
    expect(screen.getByText(/se perderá la posición que hayas dado/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, colocar por capas' }));
    expect((await screen.findByRole('status')).textContent).toBe('Equipos colocados por capas.');
    expect(writes).toBe(1);
    expect(repo.topology.equipos).toEqual(arrangeByTiers(before));
    expect(repo.topology.enlaces).toEqual(before.enlaces);
    expect(repo.topology.grupos).toEqual(before.grupos);
  });

  it('writes nothing just by drawing the map', async () => {
    const repo = memoryRepository(drawing());
    let writes = 0;
    const apply = repo.apply;
    repo.apply = change => { writes++; return apply(change); };
    const { container } = render(<InfraMapPage repository={repo} />);
    await waitFor(() => expect(edgesOf(container)).toHaveLength(7));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar las líneas de gestión' }));
    await waitFor(() => expect(edgesOf(container)).toHaveLength(6));
    expect(writes).toBe(0);
  });
});

// Slice 3: links and groups edited from the map. A drag between two dots is not simulated in jsdom; clicking one dot
// and then the other is React Flow's own click-to-connect, which reaches the same `onConnect`.
const counted = (repo: Repo) => {
  const writes = { count: 0 };
  const apply = repo.apply;
  repo.apply = change => { writes.count++; return apply(change); };
  return writes;
};
const dot = (container: HTMLElement, id: string, side: 'top' | 'bottom') => container.querySelector(`.react-flow__node[data-id="${id}"] .react-flow__handle-${side}`) as HTMLElement;
/** Joins `from` to `to` as a drag from the top dot of `from` to the bottom dot of `to` would. */
const join = async (container: HTMLElement, from: string, to: string) => {
  // jsdom has no layout: with nothing found under the pointer, React Flow checks the clicked dot itself.
  if (!document.elementFromPoint) document.elementFromPoint = () => null;
  await waitFor(() => expect(dot(container, from, 'top')).toBeTruthy());
  fireEvent.click(dot(container, from, 'top'));
  fireEvent.click(dot(container, to, 'bottom'));
};
const linkForm = () => within(screen.getByRole('complementary', { name: 'Nuevo enlace' }));
const linkFicha = () => within(screen.getByRole('complementary', { name: 'Ficha del enlace' }));
const editing = (): Topology => {
  const d = (id: string, tipo: string): Device => ({ id, nombre: id.toUpperCase(), tipo, criticidad: 'Alta', monitorizado: true });
  return { equipos: [d('fw1', 'firewall'), d('fw2', 'firewall'), d('core', 'switch'), d('acc', 'switch')], enlaces: [link('c1', 'core', 'fw1', 'datos')], grupos: [] };
};
const coreLine = (container: HTMLElement) => container.querySelector('[aria-label="CORE – FW1: Datos"]') as HTMLElement;

describe('InfraMapPage link editing', () => {
  it('asks for the link before saving it and saves the chosen type, ports, speed and VLANs in one write', async () => {
    const repo = memoryRepository(editing());
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await join(container, 'acc', 'core');

    const form = linkForm();
    expect(writes.count).toBe(0);
    expect((form.getByLabelText('Tipo de enlace') as HTMLSelectElement).value).toBe('datos');
    expect(form.queryByLabelText('VLAN')).toBeNull();
    fireEvent.change(form.getByLabelText('Tipo de enlace'), { target: { value: 'troncal' } });
    fireEvent.change(form.getByLabelText('Puerto en ACC'), { target: { value: '49' } });
    fireEvent.change(form.getByLabelText('Puerto en CORE'), { target: { value: '1/1/48' } });
    fireEvent.change(form.getByLabelText('Velocidad'), { target: { value: '10G' } });
    fireEvent.change(form.getByLabelText('VLAN'), { target: { value: '10,20' } });
    fireEvent.click(form.getByRole('button', { name: 'Crear enlace' }));

    expect((await screen.findByRole('status')).textContent).toBe('Enlace Troncal creado entre ACC y CORE.');
    expect(writes.count).toBe(1);
    expect(repo.topology.enlaces[1]).toEqual({ id: 'acc--core', a: { equipo: 'acc', puerto: '49' }, b: { equipo: 'core', puerto: '1/1/48' }, tipo: 'troncal', velocidad: '10G', vlans: '10,20' });
    expect(screen.queryByRole('complementary', { name: 'Nuevo enlace' })).toBeNull();
  });

  it('saves nothing when the new link is cancelled, with the button or with Escape', async () => {
    const repo = memoryRepository(editing());
    const before = repo.topology;
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await join(container, 'acc', 'core');
    fireEvent.click(linkForm().getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('complementary', { name: 'Nuevo enlace' })).toBeNull();

    await join(container, 'acc', 'core');
    fireEvent.keyDown(linkForm().getByLabelText('Velocidad'), { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Nuevo enlace' })).toBeNull();
    expect(writes.count).toBe(0);
    expect(repo.topology).toBe(before);
  });

  it('moves the focus into the new link form and labels every field', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(editing())} />);
    await join(container, 'acc', 'core');
    const form = linkForm();
    await waitFor(() => expect(document.activeElement).toBe(form.getByLabelText('Tipo de enlace')));
    for (const label of ['Puerto en ACC', 'Puerto en CORE', 'Velocidad']) expect(form.getByLabelText(label).tagName).toBe('INPUT');
  });

  it('makes the dragged device hang from the target for a hierarchical type', async () => {
    const repo = memoryRepository(editing());
    const { container } = render(<InfraMapPage repository={repo} />);
    await join(container, 'acc', 'core');
    expect(linkForm().getByText('ACC cuelga de CORE.')).toBeTruthy();
    fireEvent.change(linkForm().getByLabelText('Tipo de enlace'), { target: { value: 'lag' } });
    fireEvent.click(linkForm().getByRole('button', { name: 'Crear enlace' }));
    await screen.findByRole('status');
    expect(hangsFrom(repo, 'acc')).toEqual(['core']);
  });

  it('refuses a hierarchical link opposite to one the pair already has, with a message, and saves nothing', async () => {
    const repo = memoryRepository(editing());
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await join(container, 'fw1', 'core');
    fireEvent.click(linkForm().getByRole('button', { name: 'Crear enlace' }));
    expect(linkForm().getByRole('alert').textContent).toBe('CORE ya cuelga de FW1: FW1 no puede colgar también de CORE.');
    expect(writes.count).toBe(0);
  });

  it('allows extra links of other types, or in the same direction, between the same pair', async () => {
    const repo = memoryRepository(editing());
    const { container } = render(<InfraMapPage repository={repo} />);
    await join(container, 'fw1', 'core');
    fireEvent.change(linkForm().getByLabelText('Tipo de enlace'), { target: { value: 'gestion' } });
    fireEvent.click(linkForm().getByRole('button', { name: 'Crear enlace' }));
    expect((await screen.findByRole('status')).textContent).toBe('Enlace Gestión creado entre FW1 y CORE.');

    await join(container, 'core', 'fw1');
    fireEvent.click(linkForm().getByRole('button', { name: 'Crear enlace' }));
    await waitFor(() => expect(repo.topology.enlaces).toHaveLength(3));
    expect(repo.topology.enlaces.map(l => [l.a.equipo, l.b.equipo, l.tipo])).toEqual([['core', 'fw1', 'datos'], ['fw1', 'core', 'gestion'], ['core', 'fw1', 'datos']]);
  });

  it('opens the ficha of a selected line and saves its changes in one write', async () => {
    const repo = memoryRepository(editing());
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await waitFor(() => expect(coreLine(container)).toBeTruthy());
    fireEvent.click(coreLine(container));

    const f = linkFicha();
    expect(f.getByText('CORE – FW1')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(f.getByLabelText('Tipo de enlace')));
    fireEvent.change(f.getByLabelText('Tipo de enlace'), { target: { value: 'lag' } });
    fireEvent.change(f.getByLabelText('Puerto en CORE'), { target: { value: '1/1/49-50' } });
    fireEvent.change(f.getByLabelText('Velocidad'), { target: { value: '20G' } });
    fireEvent.change(f.getByLabelText('VLAN'), { target: { value: '1-100' } });
    fireEvent.change(f.getByLabelText('Notas'), { target: { value: 'Dos cables' } });
    fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));

    expect((await screen.findByRole('status')).textContent).toBe('Enlace entre CORE y FW1 actualizado.');
    expect(writes.count).toBe(1);
    expect(repo.topology.enlaces).toEqual([{ id: 'c1', a: { equipo: 'core', puerto: '1/1/49-50' }, b: { equipo: 'fw1' }, tipo: 'lag', velocidad: '20G', vlans: '1-100', notas: 'Dos cables' }]);
  });

  it('removes the link from its ficha with «Quitar enlace»', async () => {
    const repo = memoryRepository(editing());
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await waitFor(() => expect(coreLine(container)).toBeTruthy());
    fireEvent.click(coreLine(container));
    fireEvent.click(linkFicha().getByRole('button', { name: 'Quitar enlace' }));
    expect((await screen.findByRole('status')).textContent).toBe('Conexión entre CORE y FW1 quitada.');
    expect(repo.topology.enlaces).toEqual([]);
    expect(writes.count).toBe(1);
    expect(screen.queryByRole('complementary', { name: 'Ficha del enlace' })).toBeNull();
  });

  it('closes the ficha of the line with Escape and saves nothing', async () => {
    const repo = memoryRepository(editing());
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await waitFor(() => expect(coreLine(container)).toBeTruthy());
    fireEvent.click(coreLine(container));
    fireEvent.change(linkFicha().getByLabelText('Velocidad'), { target: { value: '1G' } });
    fireEvent.keyDown(linkFicha().getByLabelText('Velocidad'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Ficha del enlace' })).toBeNull());
    expect(writes.count).toBe(0);
  });
});

/** Selects several devices as a click on each with Ctrl held down does. */
const pick = async (container: HTMLElement, ids: string[]) => {
  await waitFor(() => expect(container.querySelector(`.react-flow__node[data-id="${ids[0]}"]`)).toBeTruthy());
  fireEvent.keyDown(document, { key: 'Control' });
  for (const id of ids) fireEvent.click(container.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement, { ctrlKey: true });
  fireEvent.keyUp(document, { key: 'Control' });
};
const selection = () => within(screen.getByRole('complementary', { name: 'Equipos seleccionados' }));

describe('InfraMapPage groups', () => {
  it('groups the selected devices with a type and a name in one write', async () => {
    const repo = memoryRepository(editing());
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await pick(container, ['fw1', 'fw2']);
    fireEvent.click(selection().getByRole('button', { name: 'Agrupar' }));
    await waitFor(() => expect(document.activeElement).toBe(selection().getByLabelText('Tipo de grupo')));
    fireEvent.change(selection().getByLabelText('Tipo de grupo'), { target: { value: 'ha' } });
    fireEvent.change(selection().getByLabelText('Nombre del grupo'), { target: { value: 'Par de firewalls' } });
    fireEvent.click(selection().getByRole('button', { name: 'Crear grupo' }));

    expect((await screen.findByRole('status')).textContent).toBe('Grupo Par de firewalls creado.');
    expect(writes.count).toBe(1);
    expect(repo.topology.grupos).toEqual([{ id: 'grupo-1', tipo: 'ha', nombre: 'Par de firewalls', miembros: ['fw1', 'fw2'] }]);
    expect(await screen.findByRole('group', { name: 'Par de firewalls: FW1, FW2' })).toBeTruthy();
  });

  it('refuses to group a device that is already in a group, naming it', async () => {
    const repo = memoryRepository({ ...editing(), grupos: [{ id: 'g', tipo: 'stack', nombre: 'Núcleo', miembros: ['core'] }] });
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await pick(container, ['acc', 'core']);
    fireEvent.click(selection().getByRole('button', { name: 'Agrupar' }));
    fireEvent.change(selection().getByLabelText('Nombre del grupo'), { target: { value: 'Acceso' } });
    fireEvent.click(selection().getByRole('button', { name: 'Crear grupo' }));
    expect(selection().getByRole('alert').textContent).toBe('No se puede agrupar: CORE ya está en el grupo Núcleo.');
    expect(writes.count).toBe(0);
  });

  it('still opens the ficha of one device clicked without Ctrl after selecting several', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(editing())} />);
    await pick(container, ['fw1', 'fw2']);
    expect(selection().getAllByRole('listitem').map(li => li.textContent)).toEqual(['FW1', 'FW2']);
    fireEvent.click(container.querySelector('.react-flow__node[data-id="core"]') as HTMLElement);
    expect((ficha().getByLabelText('Nombre') as HTMLInputElement).value).toBe('CORE');
  });

  it('cancels the group form with Escape and saves nothing', async () => {
    const repo = memoryRepository(editing());
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await pick(container, ['fw1', 'fw2']);
    fireEvent.click(selection().getByRole('button', { name: 'Agrupar' }));
    fireEvent.keyDown(selection().getByLabelText('Nombre del grupo'), { key: 'Escape' });
    expect(selection().queryByLabelText('Nombre del grupo')).toBeNull();
    expect(selection().getByRole('button', { name: 'Agrupar' })).toBeTruthy();
    expect(writes.count).toBe(0);
  });

  it('shows the group in the device ficha and takes the device out of it in one write', async () => {
    const repo = memoryRepository({ ...editing(), grupos: [{ id: 'g', tipo: 'cluster', nombre: 'Granja', miembros: ['fw1', 'fw2', 'core'] }] });
    const writes = counted(repo);
    render(<InfraMapPage repository={repo} />);
    const f = await openFicha('FW2');
    expect(f.getByText('Granja (Clúster)')).toBeTruthy();
    fireEvent.click(f.getByRole('button', { name: 'Sacar del grupo' }));
    expect((await screen.findByRole('status')).textContent).toBe('FW2 ha salido del grupo Granja.');
    expect(repo.topology.grupos).toEqual([{ id: 'g', tipo: 'cluster', nombre: 'Granja', miembros: ['fw1', 'core'] }]);
    expect(writes.count).toBe(1);
  });

  it('undoes the whole group from the device ficha in one write', async () => {
    const repo = memoryRepository({ ...editing(), grupos: [{ id: 'g', tipo: 'ha', nombre: 'Par', miembros: ['fw1', 'fw2'] }] });
    const writes = counted(repo);
    render(<InfraMapPage repository={repo} />);
    fireEvent.click((await openFicha('FW1')).getByRole('button', { name: 'Deshacer el grupo' }));
    expect((await screen.findByRole('status')).textContent).toBe('Grupo Par deshecho.');
    expect(repo.topology.grupos).toEqual([]);
    expect(repo.topology.equipos).toEqual(editing().equipos);
    expect(writes.count).toBe(1);
  });
});

// Slice 6: power links carry an outlet and a power supply instead of network data.
const powered = (enlaces: Link[] = []): Topology => {
  const d = (id: string, tipo: string): Device => ({ id, nombre: id.toUpperCase(), tipo, criticidad: 'Alta', monitorizado: true });
  return { equipos: [d('fw1', 'firewall'), d('core', 'switch'), d('ups', 'sai'), d('pdu', 'regleta')], enlaces, grupos: [] };
};

describe('InfraMapPage power links', () => {
  it('offers the regleta in the palette', async () => {
    render(<InfraMapPage repository={memoryRepository(powered())} />);
    expect(await screen.findByRole('button', { name: 'Añadir Regleta (PDU)' })).toBeTruthy();
  });

  it('asks for the outlet and the power supply instead of ports, speed and VLANs, and stores them in the right ends', async () => {
    const repo = memoryRepository(powered());
    const { container } = render(<InfraMapPage repository={repo} />);
    await join(container, 'fw1', 'ups');
    const form = linkForm();
    fireEvent.change(form.getByLabelText('Tipo de enlace'), { target: { value: 'energia' } });
    expect(form.getByText('FW1 se alimenta de UPS.')).toBeTruthy();
    for (const label of ['Puerto en FW1', 'Puerto en UPS', 'Velocidad', 'VLAN']) expect(form.queryByLabelText(label)).toBeNull();
    fireEvent.change(form.getByLabelText('Toma en UPS'), { target: { value: '3' } });
    fireEvent.change(form.getByLabelText('Fuente de alimentación en FW1'), { target: { value: 'Fuente 1' } });
    fireEvent.click(form.getByRole('button', { name: 'Crear enlace' }));
    await screen.findByRole('status');
    expect(repo.topology.enlaces).toEqual([{ id: 'fw1--ups', a: { equipo: 'fw1', puerto: 'Fuente 1' }, b: { equipo: 'ups', puerto: '3' }, tipo: 'energia' }]);
  });

  it('stores the outlet on the SAI end when the SAI was dragged onto the device', async () => {
    const repo = memoryRepository(powered());
    const { container } = render(<InfraMapPage repository={repo} />);
    await join(container, 'ups', 'fw1');
    const form = linkForm();
    fireEvent.change(form.getByLabelText('Tipo de enlace'), { target: { value: 'energia' } });
    expect(form.getByText('FW1 se alimenta de UPS.')).toBeTruthy();
    fireEvent.change(form.getByLabelText('Toma en UPS'), { target: { value: '3' } });
    fireEvent.change(form.getByLabelText('Fuente de alimentación en FW1'), { target: { value: 'Fuente 2' } });
    fireEvent.click(form.getByRole('button', { name: 'Crear enlace' }));
    await screen.findByRole('status');
    expect(repo.topology.enlaces).toEqual([{ id: 'ups--fw1', a: { equipo: 'ups', puerto: '3' }, b: { equipo: 'fw1', puerto: 'Fuente 2' }, tipo: 'energia' }]);
  });

  it('says the device is fed by the regleta, by the SAI between a SAI and a regleta, and by nobody between two other devices', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(powered())} />);
    await join(container, 'pdu', 'core');
    fireEvent.change(linkForm().getByLabelText('Tipo de enlace'), { target: { value: 'energia' } });
    expect(linkForm().getByText('CORE se alimenta de PDU.')).toBeTruthy();
    fireEvent.click(linkForm().getByRole('button', { name: 'Cancelar' }));
    await join(container, 'pdu', 'ups');
    fireEvent.change(linkForm().getByLabelText('Tipo de enlace'), { target: { value: 'energia' } });
    expect(linkForm().getByText('PDU se alimenta de UPS.')).toBeTruthy();
    fireEvent.click(linkForm().getByRole('button', { name: 'Cancelar' }));
    await join(container, 'core', 'fw1');
    fireEvent.change(linkForm().getByLabelText('Tipo de enlace'), { target: { value: 'energia' } });
    expect(linkForm().getByText('CORE y FW1 quedan unidos por un cable de energía, sin que uno alimente al otro.')).toBeTruthy();
  });

  it('shows the outlet and the power supply in the ficha of a power line and on the line itself', async () => {
    const repo = memoryRepository(powered([{ id: 'p1', a: { equipo: 'fw1', puerto: 'Fuente 1' }, b: { equipo: 'ups', puerto: '3' }, tipo: 'energia' }]));
    const { container } = render(<InfraMapPage repository={repo} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Energía' }));
    expect(await screen.findByText('Toma 3 · Fuente 1')).toBeTruthy();
    fireEvent.click(container.querySelector('[aria-label="FW1 – UPS: Energía"]') as HTMLElement);
    const f = linkFicha();
    expect(f.getByText('FW1 se alimenta de UPS.')).toBeTruthy();
    expect(f.queryByLabelText('Velocidad')).toBeNull();
    expect((f.getByLabelText('Toma en UPS') as HTMLInputElement).value).toBe('3');
    fireEvent.change(f.getByLabelText('Fuente de alimentación en FW1'), { target: { value: 'Fuente 2' } });
    fireEvent.click(f.getByRole('button', { name: 'Guardar enlace' }));
    await screen.findByRole('status');
    expect(repo.topology.enlaces).toEqual([{ id: 'p1', a: { equipo: 'fw1', puerto: 'Fuente 2' }, b: { equipo: 'ups', puerto: '3' }, tipo: 'energia' }]);
  });
});

// Slice 8: two views of the same inventory. «Red» draws no power lines and shows what feeds each device; «Energía»
// draws only power, as a single-line diagram with the regletas as bars.
const rackRoom = (): Topology => {
  const d = (id: string, nombre: string, tipo: string): Device => ({ id, nombre, tipo, criticidad: 'Alta', monitorizado: true, posicion: { x: 300, y: 300 } });
  return {
    equipos: [d('sai1', 'SAI 1', 'sai'), d('sai2', 'SAI 2', 'sai'), d('pdu1', 'Regleta (PDU) 1', 'regleta'), d('fw1', 'FW1', 'firewall'), d('fw2', 'FW2', 'firewall'), d('core', 'CORE', 'switch')],
    enlaces: [
      link('p-s1', 'pdu1', 'sai1', 'energia'), link('fw1-p', 'fw1', 'pdu1', 'energia'), link('fw1-s2', 'fw1', 'sai2', 'energia'),
      link('fw2-p', 'fw2', 'pdu1', 'energia'), link('c1', 'core', 'fw1', 'datos'), link('c2', 'core', 'fw2', 'datos'),
    ],
    grupos: [],
  };
};
const tab = (name: string) => screen.getByRole('tab', { name });
const badgeOf = (container: HTMLElement, id: string) => container.querySelector(`.react-flow__node[data-id="${id}"] .infra-node__power`);
const toEnergy = async () => fireEvent.click(await screen.findByRole('tab', { name: 'Energía' }));

describe('InfraMapPage views', () => {
  it('switches between «Red» and «Energía» with tabs and remembers the choice in this browser', async () => {
    render(<InfraMapPage repository={memoryRepository(rackRoom())} />);
    expect(await screen.findByRole('tablist', { name: 'Vista del mapa' })).toBeTruthy();
    expect(tab('Red').getAttribute('aria-selected')).toBe('true');
    expect(tab('Energía').getAttribute('aria-selected')).toBe('false');
    fireEvent.click(tab('Energía'));
    expect(tab('Energía').getAttribute('aria-selected')).toBe('true');
    cleanup();

    render(<InfraMapPage repository={memoryRepository(rackRoom())} />);
    expect((await screen.findByRole('tab', { name: 'Energía' })).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab('Energía'), { key: 'ArrowLeft' });
    expect(tab('Red').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Red'));
  });

  it('changes no stored data when switching views', async () => {
    const repo = memoryRepository(rackRoom());
    const before = repo.topology;
    const writes = counted(repo);
    const { container } = render(<InfraMapPage repository={repo} />);
    await screen.findByText('FW1', { selector: '.infra-node__name' });
    await toEnergy();
    await waitFor(() => expect(container.querySelector('.react-flow__node-regletaBar')).toBeTruthy());
    fireEvent.click(tab('Red'));
    await waitFor(() => expect(container.querySelector('.react-flow__node-regletaBar')).toBeNull());
    expect(writes.count).toBe(0);
    expect(repo.topology).toBe(before);
  });

  it('draws no power lines in «Red»', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(rackRoom())} />);
    await waitFor(() => expect(edgesOf(container)).toHaveLength(2));
    expect(container.querySelector('.react-flow__edge.infra-edge--energia')).toBeNull();
  });

  it('shows in «Red» what feeds each device, in the warning colour when it has a single feed', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(rackRoom())} />);
    await waitFor(() => expect(badgeOf(container, 'fw1')).toBeTruthy());
    expect(badgeOf(container, 'fw1')!.textContent).toBe('⚡ Regleta (PDU) 1 · SAI 2');
    expect(badgeOf(container, 'fw1')!.classList.contains('is-single')).toBe(false);
    expect(badgeOf(container, 'fw2')!.textContent).toBe('⚡ Regleta (PDU) 1');
    expect(badgeOf(container, 'fw2')!.classList.contains('is-single')).toBe(true);
    expect(badgeOf(container, 'core')).toBeNull();
  });

  it('shows no power badge on SAIs and regletas', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(rackRoom())} />);
    await waitFor(() => expect(badgeOf(container, 'fw1')).toBeTruthy());
    for (const id of ['sai1', 'sai2', 'pdu1']) expect(badgeOf(container, id)).toBeNull();
  });

  it('offers no «Energía» toggle in the legend of «Red», only the management one', async () => {
    render(<InfraMapPage repository={memoryRepository(drawing())} />);
    await screen.findByRole('region', { name: 'Leyenda del mapa' });
    expect(screen.queryByRole('checkbox', { name: 'Mostrar las líneas de energía' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Mostrar las líneas de gestión' })).toBeTruthy();
  });

  it('draws only power in «Energía»: the regletas as bars, one line per power link and no network lines', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(rackRoom())} />);
    await toEnergy();
    await waitFor(() => expect(edgesOf(container)).toHaveLength(4));
    expect(container.querySelectorAll('.react-flow__edge.infra-edge--energia')).toHaveLength(4);
    expect(container.querySelector('[aria-label="CORE – FW1: Datos"]')).toBeNull();
    expect(container.querySelector('.react-flow__node-regletaBar[data-id="pdu1"]')?.textContent).toContain('Regleta (PDU) 1');
    expect(container.querySelector('.react-flow__node-device[data-id="pdu1"]')).toBeNull();
    expect(badgeOf(container, 'fw1')).toBeNull();
    expect(screen.getByText('Sin enlaces de energía: CORE.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Colocar por capas' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Leyenda del mapa' })?.querySelector('input')).toBeFalsy();
  });

  it('offers only the energía link type when joining two devices in «Energía»', async () => {
    const repo = memoryRepository(rackRoom());
    const { container } = render(<InfraMapPage repository={repo} />);
    await toEnergy();
    await join(container, 'core', 'sai2');
    const form = linkForm();
    const select = form.getByLabelText('Tipo de enlace') as HTMLSelectElement;
    expect([...select.options].map(o => o.textContent)).toEqual(['Energía']);
    expect(select.value).toBe('energia');
    expect(form.getByText('CORE se alimenta de SAI 2.')).toBeTruthy();
    fireEvent.change(form.getByLabelText('Toma en SAI 2'), { target: { value: '4' } });
    fireEvent.click(form.getByRole('button', { name: 'Crear enlace' }));
    await screen.findByRole('status');
    expect(repo.topology.enlaces.at(-1)).toEqual({ id: 'core--sai2', a: { equipo: 'core' }, b: { equipo: 'sai2', puerto: '4' }, tipo: 'energia' });
  });

  it('opens the ficha of a power line clicked in «Energía»', async () => {
    const { container } = render(<InfraMapPage repository={memoryRepository(rackRoom())} />);
    await toEnergy();
    await waitFor(() => expect(container.querySelector('[aria-label="FW2 – Regleta (PDU) 1: Energía"]')).toBeTruthy());
    fireEvent.click(container.querySelector('[aria-label="FW2 – Regleta (PDU) 1: Energía"]') as HTMLElement);
    const f = linkFicha();
    expect(f.getByText('FW2 se alimenta de Regleta (PDU) 1.')).toBeTruthy();
    expect(f.getByLabelText('Toma en Regleta (PDU) 1')).toBeTruthy();
  });

  it('shows the same «Qué te falta» in both views', async () => {
    render(<InfraMapPage repository={memoryRepository(rackRoom())} />);
    const gaps = async () => (await screen.findByRole('complementary', { name: 'Qué te falta' })).textContent;
    const red = await gaps();
    expect(red).toMatch(/SAI 1/);
    await toEnergy();
    expect(await gaps()).toBe(red);
  });
});
