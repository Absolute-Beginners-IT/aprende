import { describe, expect, it } from 'vitest';
import type { Device, Link, Topology } from './types';
import {
  arrangeByTiers, connectDevices, connectionsOf, editLink, edgeEnds, groupRefusal, linkRefusal, groupBoxes, levelFinder, layoutByTiers, layoutDevices, linkName, linkTypesIn, moveDevice, newDevice,
  edgeGeometry, peerSets, placeUnplaced, routeEdges, tierLabels, tierOf, TIERS, GRID, layoutPower, POWER_NODE, BAR_HEIGHT, type PowerLayout,
} from './infraMap';
import { fromInventoryV1, fromStoredTopology, powerFeedersOf, type DeviceV1 } from './topology';

const dev = (id: string, extra: Partial<DeviceV1> = {}): DeviceV1 => ({ id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...extra });
const plain = ({ uplinks: _, ...device }: DeviceV1): Device => device;
const v1 = (devices: DeviceV1[]) => fromInventoryV1(devices);
const link = (id: string, a: string, b: string, tipo: Link['tipo'] = 'datos'): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo });

describe('connectionsOf', () => {
  it('lists one connection per uplink to a device that exists', () => {
    const devices = [dev('fw'), dev('core', { uplinks: ['fw', 'gone'] }), dev('p1', { uplinks: ['core'] })];
    expect(connectionsOf(v1(devices))).toEqual([
      { id: 'core--fw', from: 'core', to: 'fw' },
      { id: 'p1--core', from: 'p1', to: 'core' },
    ]);
  });

  it('draws one line per link, several between the same pair included, whatever their type', () => {
    const topology = { equipos: [plain(dev('fw1')), plain(dev('fw2'))], enlaces: [link('h1', 'fw1', 'fw2', 'ha'), link('h2', 'fw1', 'fw2', 'ha')], grupos: [] };
    expect(connectionsOf(topology).map(c => c.id)).toEqual(['h1', 'h2']);
  });
});

describe('levelFinder', () => {
  it('counts how far a device hangs from one with no uplinks, ignoring missing devices and loops', () => {
    const levelOf = levelFinder(v1([dev('p1', { uplinks: ['core'] }), dev('core', { uplinks: ['fw', 'gone'] }), dev('fw'), dev('a', { uplinks: ['b'] }), dev('b', { uplinks: ['a'] })]));
    expect(['fw', 'core', 'p1'].map(levelOf)).toEqual([0, 1, 2]);
    expect(['a', 'b'].map(levelOf)).toEqual([2, 1]);
  });

  it('follows only hierarchical links: an HA pair or a stack stays on the same level', () => {
    const topology = { equipos: ['isp', 'fw1', 'fw2'].map(id => plain(dev(id))), enlaces: [link('1', 'fw1', 'isp', 'wan'), link('2', 'fw2', 'isp', 'wan'), link('3', 'fw1', 'fw2', 'ha'), link('4', 'fw2', 'fw1', 'stack')], grupos: [] };
    expect(['isp', 'fw1', 'fw2'].map(levelFinder(topology))).toEqual([0, 1, 1]);
  });
});

describe('layoutDevices', () => {
  it('keeps the position the user gave a device', () => {
    const positions = layoutDevices(v1([dev('fw', { posicion: { x: 500, y: 40 } })]));
    expect(positions.get('fw')).toEqual({ x: 500, y: 40 });
  });

  it('places the rest in rows by how far they hang from a device with no uplinks', () => {
    const positions = layoutDevices(v1([dev('p1', { uplinks: ['core'] }), dev('core', { uplinks: ['fw'] }), dev('fw'), dev('ap', { uplinks: ['p1'] })]));
    expect(positions.get('fw')?.y).toBe(0);
    expect(positions.get('core')?.y).toBe(GRID.row);
    expect(positions.get('p1')?.y).toBe(2 * GRID.row);
    expect(positions.get('ap')?.y).toBe(3 * GRID.row);
  });

  it('spreads devices of the same row apart and survives a loop of uplinks', () => {
    const positions = layoutDevices(v1([dev('a', { uplinks: ['b'] }), dev('b', { uplinks: ['a'] }), dev('c'), dev('d')]));
    const xs = ['c', 'd'].map(id => positions.get(id)?.x);
    expect(new Set(xs).size).toBe(2);
    expect(positions.size).toBe(4);
  });
});

describe('connectDevices', () => {
  const pair = (enlaces: Link[] = []): Topology => ({ equipos: [plain(dev('a')), plain(dev('b'))], enlaces, grupos: [] });

  it('makes no link when one of the devices is no longer stored', () => {
    expect(connectDevices(pair(), 'a', 'gone')).toBeNull();
    expect(connectDevices(pair(), 'gone', 'b', { tipo: 'energia' })).toBeNull();
  });

  it('makes a datos link from the dragged device to the one it now hangs from when nothing else is chosen', () => {
    expect(connectDevices(v1([dev('p1'), dev('core')]), 'p1', 'core')).toEqual({ a: { equipo: 'p1' }, b: { equipo: 'core' }, tipo: 'datos' });
  });

  it('makes the link with the chosen type, ports, speed and VLANs, leaving out empty fields', () => {
    expect(connectDevices(pair(), 'a', 'b', { tipo: 'troncal', puertoA: ' 49 ', puertoB: '1/1/48', velocidad: '10G', vlans: '10,20' })).toEqual({
      a: { equipo: 'a', puerto: '49' }, b: { equipo: 'b', puerto: '1/1/48' }, tipo: 'troncal', velocidad: '10G', vlans: '10,20',
    });
    expect(connectDevices(pair(), 'a', 'b', { tipo: 'ha', puertoA: '', puertoB: ' ', velocidad: '' })).toEqual({ a: { equipo: 'a' }, b: { equipo: 'b' }, tipo: 'ha' });
  });

  it('keeps VLANs only on troncal and lag links', () => {
    expect(connectDevices(pair(), 'a', 'b', { tipo: 'lag', vlans: '30' })?.vlans).toBe('30');
    expect(connectDevices(pair(), 'a', 'b', { tipo: 'datos', vlans: '30' })).toEqual({ a: { equipo: 'a' }, b: { equipo: 'b' }, tipo: 'datos' });
  });

  it('makes the dragged device hang from the target for every hierarchical type', () => {
    for (const tipo of ['datos', 'troncal', 'lag', 'wan', 'almacenamiento'] as const) {
      expect(connectDevices(pair(), 'a', 'b', { tipo })).toMatchObject({ a: { equipo: 'a' }, b: { equipo: 'b' }, tipo });
    }
  });

  it('refuses a hierarchical link opposite to one the pair already has, and the same device on both ends', () => {
    expect(linkRefusal(pair([link('x', 'b', 'a', 'troncal')]), 'a', 'b', 'datos')).toBe('sentido-contrario');
    expect(connectDevices(pair([link('x', 'b', 'a', 'troncal')]), 'a', 'b', { tipo: 'lag' })).toBeNull();
    expect(linkRefusal(pair(), 'a', 'a', 'ha')).toBe('mismo-equipo');
    expect(connectDevices(pair(), 'a', 'a')).toBeNull();
  });

  it('allows any other extra link between the same pair', () => {
    expect(linkRefusal(pair([link('x', 'a', 'b', 'datos')]), 'a', 'b', 'datos')).toBeNull();
    expect(connectDevices(pair([link('x', 'a', 'b', 'datos')]), 'a', 'b', { tipo: 'lag' })).toMatchObject({ tipo: 'lag' });
    expect(connectDevices(pair([link('x', 'b', 'a', 'datos')]), 'a', 'b', { tipo: 'ha' })).toMatchObject({ tipo: 'ha' });
    expect(connectDevices(pair([link('x', 'b', 'a', 'ha')]), 'a', 'b', { tipo: 'datos' })).toMatchObject({ tipo: 'datos' });
  });
});

describe('editLink', () => {
  it('keeps the id and the devices of the link and takes everything else from the draft', () => {
    const before: Link = { id: 'l1', a: { equipo: 'a', puerto: '1' }, b: { equipo: 'b' }, tipo: 'troncal', vlans: '10', notas: 'viejo' };
    expect(editLink(before, { tipo: 'lag', puertoA: '', puertoB: '24', velocidad: '20G', vlans: '10,20', notas: ' Dos cables ' })).toEqual({
      id: 'l1', a: { equipo: 'a' }, b: { equipo: 'b', puerto: '24' }, tipo: 'lag', velocidad: '20G', vlans: '10,20', notas: 'Dos cables',
    });
    expect(editLink(before, { tipo: 'ha', vlans: '10' })).toEqual({ id: 'l1', a: { equipo: 'a' }, b: { equipo: 'b' }, tipo: 'ha' });
  });

  it('checks the direction of an edited link against the other links only', () => {
    const topology: Topology = { equipos: [plain(dev('a')), plain(dev('b'))], enlaces: [link('x', 'b', 'a'), link('y', 'a', 'b', 'ha')], grupos: [] };
    expect(linkRefusal(topology, 'a', 'b', 'datos', 'y')).toBe('sentido-contrario');
    expect(linkRefusal(topology, 'b', 'a', 'troncal', 'x')).toBeNull();
  });
});

describe('groupRefusal', () => {
  it('names the first chosen device that is already in a group, and that group', () => {
    const grupo = { id: 'g', tipo: 'ha' as const, nombre: 'Par', miembros: ['b'] };
    const topology: Topology = { equipos: ['a', 'b', 'c'].map(id => plain(dev(id))), enlaces: [], grupos: [grupo] };
    expect(groupRefusal(topology, ['a', 'b', 'c'])).toEqual({ equipo: 'b', grupo });
    expect(groupRefusal(topology, ['a', 'c'])).toBeNull();
  });
});

describe('moveDevice', () => {
  it('stores the position in whole pixels', () => {
    expect(moveDevice(dev('core'), { x: 10.6, y: -3.2 }).posicion).toEqual({ x: 11, y: -3 });
  });
});

describe('placeUnplaced', () => {
  it('pins every device the map placed on its own to the spot it shows now', () => {
    const devices = [dev('fw', { posicion: { x: 500, y: 40 } }), dev('a'), dev('b')];
    const shown = layoutDevices(v1(devices));
    expect(placeUnplaced(v1(devices))).toEqual([dev('a', { posicion: shown.get('a') }), dev('b', { posicion: shown.get('b') })]);
    expect(shown.get('b')!.x - shown.get('a')!.x).toBeGreaterThanOrEqual(GRID.col);
  });
});

describe('moveDevice with a broken position', () => {
  it('ignores coordinates that are not numbers', () => {
    expect(moveDevice(dev('core', { posicion: { x: 5, y: 6 } }), { x: Number.NaN, y: 2 }).posicion).toEqual({ x: 5, y: 6 });
  });
});

describe('newDevice', () => {
  it('names a new device after its type with the first free number', () => {
    const created = newDevice('switch', 'Switch', [dev('switch-1', { nombre: 'Switch 1' })], { x: 0, y: 0 });
    expect(created).toEqual({ id: 'switch-2', nombre: 'Switch 2', tipo: 'switch', criticidad: 'Media', monitorizado: false, posicion: { x: 0, y: 0 } });
  });
});

// A small office as the learner would draw it: two firewalls in HA, a stack of core switches, two access switches with
// LAGs to both cores, a cluster of two hosts, a NAS and a UPS.
const office = (): Topology => {
  const d = (id: string, tipo: string): Device => ({ id, nombre: id.toUpperCase(), tipo, criticidad: 'Alta', monitorizado: true });
  return {
    equipos: [
      d('sai', 'sai'), d('nas', 'almacenamiento'), d('esx2', 'hipervisor'), d('esx1', 'hipervisor'), d('acc2', 'switch'), d('acc1', 'switch'),
      d('core2', 'switch'), d('core1', 'switch'), d('fw2', 'firewall'), d('fw1', 'firewall'), d('isp', 'internet'),
    ],
    enlaces: [
      link('w1', 'fw1', 'isp', 'wan'), link('w2', 'fw2', 'isp', 'wan'), link('h1', 'fw1', 'fw2', 'ha'), link('h2', 'fw1', 'fw2', 'ha'),
      link('c1', 'core1', 'fw1'), link('c2', 'core1', 'fw2'), link('c3', 'core2', 'fw1'), link('c4', 'core2', 'fw2'), link('s1', 'core1', 'core2', 'stack'),
      link('l1', 'acc1', 'core1', 'lag'), link('l2', 'acc1', 'core2', 'lag'), link('l3', 'acc2', 'core1', 'lag'), link('l4', 'acc2', 'core2', 'lag'),
      link('e1', 'esx1', 'core1'), link('e2', 'esx2', 'core2'), link('n1', 'esx1', 'nas', 'almacenamiento'), link('p1', 'sai', 'fw1', 'energia'),
    ],
    grupos: [{ id: 'cl', tipo: 'cluster', nombre: 'Clúster vSphere', miembros: ['esx1', 'esx2'] }],
  };
};

describe('layoutByTiers', () => {
  it('stacks the tiers from the operator down to power, whatever the links say', () => {
    const d = (id: string, tipo: string): Device => ({ id, nombre: id, tipo, criticidad: 'Media', monitorizado: false });
    const topology = {
      equipos: [d('ups', 'sai'), d('bk', 'backup'), d('srv', 'servidor'), d('prn', 'impresora'), d('odd', 'raro'), d('ap', 'wifi'), d('rt', 'router'), d('fw', 'firewall'), d('isp', 'internet')],
      enlaces: [link('x', 'isp', 'ups')], grupos: [],
    };
    const y = (id: string) => layoutByTiers(topology).get(id)!.y;
    expect(y('isp')).toBeLessThan(y('fw'));
    expect(y('fw')).toBe(y('rt'));
    expect(y('rt')).toBeLessThan(y('ap'));
    expect(y('ap')).toBeLessThan(y('srv'));
    expect([y('prn'), y('odd')]).toEqual([y('srv'), y('srv')]);
    expect(y('srv')).toBeLessThan(y('bk'));
    expect(y('bk')).toBeLessThan(y('ups'));
  });

  it('puts a device that hangs from another of its tier on a lower sub-row', () => {
    const y = (id: string) => layoutByTiers(office()).get(id)!.y;
    expect(y('core1')).toBe(y('core2'));
    expect(y('acc1')).toBe(y('core1') + GRID.row);
    expect(y('acc1')).toBe(y('acc2'));
    expect(y('fw1')).toBeLessThan(y('core1'));
    expect(y('esx1')).toBeGreaterThan(y('acc1'));
  });

  it('sets the members of a group and devices joined by HA or stack side by side', () => {
    const at = layoutByTiers(office());
    const x = (id: string) => at.get(id)!.x;
    expect(Math.abs(x('fw1') - x('fw2'))).toBe(GRID.col);
    expect(Math.abs(x('core1') - x('core2'))).toBe(GRID.col);
    expect(Math.abs(x('esx1') - x('esx2'))).toBe(GRID.col);
    const d = (id: string, nombre: string): Device => ({ id, nombre, tipo: 'firewall', criticidad: 'Media', monitorizado: false });
    // B sorts between A and C by name, but A and C are an HA pair: B never splits them.
    const pair = layoutByTiers({ equipos: [d('a', 'A'), d('b', 'B'), d('c', 'C')], enlaces: [link('h', 'a', 'c', 'ha')], grupos: [] });
    const [xa, xb, xc] = ['a', 'b', 'c'].map(id => pair.get(id)!.x);
    expect(Math.abs(xa - xc)).toBe(GRID.col);
    expect(xb < Math.min(xa, xc) || xb > Math.max(xa, xc)).toBe(true);
  });
});

describe('layoutDevices by tiers', () => {
  it('keeps every placed device where the user left it and places the others below them by tiers', () => {
    const topology = office();
    topology.equipos = topology.equipos.map(d => (d.id === 'fw1' ? { ...d, posicion: { x: 900, y: 600 } } : d));
    const positions = layoutDevices(topology);
    expect(positions.get('fw1')).toEqual({ x: 900, y: 600 });
    expect(positions.get('isp')!.y).toBeGreaterThan(600);
    expect(positions.get('fw2')!.y).toBeGreaterThan(positions.get('isp')!.y);
  });
});

describe('arrangeByTiers', () => {
  it('re-places every device by tiers, those the user placed included', () => {
    const topology = office();
    topology.equipos = topology.equipos.map(d => ({ ...d, posicion: { x: 7, y: 7 } }));
    const arranged = arrangeByTiers(topology);
    const tiers = layoutByTiers(topology);
    expect(arranged).toHaveLength(topology.equipos.length);
    for (const d of arranged) expect(d.posicion).toEqual(tiers.get(d.id));
    expect(arranged.find(d => d.id === 'nas')).toMatchObject({ nombre: 'NAS', tipo: 'almacenamiento' });
  });
});

describe('tierLabels', () => {
  it('names each tier that has devices at the left edge, at the height of its first row', () => {
    const topology = office();
    const positions = layoutByTiers(topology);
    const labels = tierLabels(topology.equipos, positions);
    expect(labels.map(l => l.nombre)).toEqual(['Operadora', 'Perímetro', 'Red', 'Servidores', 'Almacenamiento y copias', 'Energía']);
    const left = Math.min(...[...positions.values()].map(p => p.x));
    for (const l of labels) expect(l.x).toBeLessThan(left);
    expect(labels.find(l => l.nombre === 'Red')!.y).toBe(positions.get('core1')!.y);
  });
});

describe('edgeEnds', () => {
  const at = (positions: Record<string, { x: number; y: number }>) => (id: string) => positions[id];

  it('runs a hierarchical link from the top of the device that hangs to the bottom of the one above', () => {
    for (const tipo of ['datos', 'troncal', 'lag', 'wan', 'almacenamiento'] as const) {
      expect(edgeEnds(link('x', 'acc', 'core', tipo), at({ acc: { x: 0, y: 200 }, core: { x: 0, y: 0 } })))
        .toEqual({ source: 'acc', sourceHandle: 'top', target: 'core', targetHandle: 'bottom' });
    }
  });

  it('runs HA and stack links sideways from the left peer to the right one', () => {
    const positions = at({ fw1: { x: 300, y: 0 }, fw2: { x: 100, y: 0 } });
    expect(edgeEnds(link('x', 'fw1', 'fw2', 'ha'), positions)).toEqual({ source: 'fw2', sourceHandle: 'right', target: 'fw1', targetHandle: 'left' });
    expect(edgeEnds(link('x', 'fw2', 'fw1', 'stack'), positions)).toEqual({ source: 'fw2', sourceHandle: 'right', target: 'fw1', targetHandle: 'left' });
  });

  it('runs management and power links up from the lower device', () => {
    const positions = at({ sai: { x: 0, y: 900 }, fw: { x: 0, y: 100 } });
    expect(edgeEnds(link('x', 'fw', 'sai', 'energia'), positions)).toEqual({ source: 'sai', sourceHandle: 'top', target: 'fw', targetHandle: 'bottom' });
    expect(edgeEnds(link('x', 'sai', 'fw', 'gestion'), positions)).toEqual({ source: 'sai', sourceHandle: 'top', target: 'fw', targetHandle: 'bottom' });
  });
});

describe('routeEdges and edgeGeometry', () => {
  // Two firewalls over two cores over two access switches, each device joined to both devices of the row above.
  const grid: Record<string, { x: number; y: number }> = {
    fw1: { x: 0, y: 0 }, fw2: { x: 200, y: 0 }, core1: { x: 0, y: 130 }, core2: { x: 200, y: 130 }, acc1: { x: 0, y: 260 }, acc2: { x: 200, y: 260 },
  };
  const positionOf = (id: string) => grid[id];
  const SIZE = { width: 160, height: 64 };
  // What React Flow hands the edge: the middle of the side of each device the route names.
  const handle = (id: string, side: string) => {
    const p = grid[id];
    if (side === 'top') return { x: p.x + SIZE.width / 2, y: p.y };
    if (side === 'bottom') return { x: p.x + SIZE.width / 2, y: p.y + SIZE.height };
    if (side === 'left') return { x: p.x, y: p.y + SIZE.height / 2 };
    return { x: p.x + SIZE.width, y: p.y + SIZE.height / 2 };
  };
  const geometryOf = (links: Link[]) => {
    const routes = routeEdges(links, positionOf);
    return new Map(links.map(l => {
      const r = routes.get(l.id)!;
      const s = handle(r.source, r.sourceHandle);
      const t = handle(r.target, r.targetHandle);
      return [l.id, edgeGeometry({ sourceX: s.x, sourceY: s.y, targetX: t.x, targetY: t.y }, r)];
    }));
  };
  const meshed = [
    link('c11', 'core1', 'fw1'), link('c12', 'core1', 'fw2'), link('c21', 'core2', 'fw1'), link('c22', 'core2', 'fw2'),
    link('l11', 'acc1', 'core1', 'lag'), link('l12', 'acc1', 'core2', 'lag'), link('l21', 'acc2', 'core1', 'lag'), link('l22', 'acc2', 'core2', 'lag'),
  ];

  it('gives each link of a device its own spot on that side, ordered by where the device at the other end is', () => {
    const routes = routeEdges(meshed, positionOf);
    // CORE1 hangs from FW1 (left) and FW2 (right): two spots on its top, the left one for FW1.
    expect(routes.get('c11')!.sourceShift).toBeLessThan(routes.get('c12')!.sourceShift);
    // FW1 receives CORE1 (left) and CORE2 (right) on its bottom, in that order.
    expect(routes.get('c11')!.targetShift).toBeLessThan(routes.get('c21')!.targetShift);
  });

  it('draws the four links between two firewalls and two cores as four separate lines', () => {
    const geometry = geometryOf(meshed);
    const fwCore = ['c11', 'c12', 'c21', 'c22'].map(id => geometry.get(id)!);
    expect(new Set(fwCore.map(g => g.sourceX)).size).toBe(4);
    expect(new Set(fwCore.map(g => g.targetX)).size).toBe(4);
    // The two crossing links bend at different heights, so their horizontal stretches never lie on top of each other.
    const crossing = ['c12', 'c21'].map(id => geometry.get(id)!);
    expect(crossing[0].centerY).not.toBe(crossing[1].centerY);
    expect(new Set(fwCore.map(g => `${g.sourceX}|${g.targetX}|${g.centerY}`)).size).toBe(4);
  });

  it('keeps several links between the same pair apart, whichever way they go', () => {
    const geometry = geometryOf([link('h1', 'fw1', 'fw2', 'ha'), link('h2', 'fw2', 'fw1', 'ha'), link('d1', 'core1', 'fw1'), link('d2', 'core1', 'fw1', 'gestion')]);
    expect(geometry.get('h1')!.sourceY).not.toBe(geometry.get('h2')!.sourceY);
    expect(geometry.get('d1')!.sourceX).not.toBe(geometry.get('d2')!.sourceX);
    expect(geometry.get('d1')!.targetX).not.toBe(geometry.get('d2')!.targetX);
  });

  it('never puts the labels of two links in the same place', () => {
    const geometry = geometryOf(meshed);
    const labels = meshed.map(l => geometry.get(l.id)!.label);
    expect(new Set(labels.map(p => `${p.x}|${p.y}`)).size).toBe(meshed.length);
    // The labels of the two LAGs of one access switch never overlap either: they are at least one label high apart.
    const [a, b] = ['l11', 'l12'].map(id => geometry.get(id)!.label);
    expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(16);
  });
});

describe('linkName', () => {
  it('names a line after its two devices and its type', () => {
    const nameOf = (id: string) => id.toUpperCase();
    expect(linkName(link('x', 'fw1', 'fw2', 'ha'), nameOf)).toBe('FW1 – FW2: HA');
    expect(linkName(link('x', 'acc', 'core', 'lag'), nameOf)).toBe('ACC – CORE: LAG');
    expect(linkName(link('x', 'nas', 'esx', 'almacenamiento'), nameOf)).toBe('NAS – ESX: Almacenamiento');
    expect(linkName(link('x', 'sw', 'fw', 'gestion'), nameOf)).toBe('SW – FW: Gestión');
    expect(linkName(link('x', 'sai', 'fw', 'energia'), nameOf)).toBe('SAI – FW: Energía');
  });
});

describe('linkTypesIn', () => {
  it('lists the types of the lines on the map, in the usual order and once each', () => {
    expect(linkTypesIn(office())).toEqual(['datos', 'lag', 'ha', 'stack', 'wan', 'almacenamiento', 'energia']);
    expect(linkTypesIn({ ...office(), enlaces: [link('g', 'fw1', 'missing', 'gestion')] })).toEqual([]);
  });
});

describe('peerSets and groupBoxes', () => {
  it('boxes each group under its name, and HA or stack peers no group holds as «HA» or «Stack»', () => {
    expect(peerSets(office()).map(s => [s.nombre, [...s.miembros].sort()])).toEqual([
      ['Clúster vSphere', ['esx1', 'esx2']],
      ['HA', ['fw1', 'fw2']],
      ['Stack', ['core1', 'core2']],
    ]);
    const grouped = { ...office(), grupos: [...office().grupos, { id: 'par', tipo: 'ha' as const, nombre: 'Par FortiGate', miembros: ['fw1', 'fw2'] }] };
    expect(peerSets(grouped).map(s => s.nombre)).toEqual(['Clúster vSphere', 'Par FortiGate', 'Stack']);
  });

  it('draws each box around its members with room for its name', () => {
    const rects: Record<string, { x: number; y: number; width: number; height: number }> = {
      fw1: { x: 0, y: 100, width: 160, height: 60 }, fw2: { x: 200, y: 100, width: 160, height: 60 },
    };
    const boxes = groupBoxes({ ...office(), grupos: [] }, id => rects[id]);
    expect(boxes).toHaveLength(1);
    const [box] = boxes;
    expect(box.nombre).toBe('HA');
    expect(box.x).toBeLessThan(0);
    expect(box.y).toBeLessThan(100);
    expect(box.x + box.width).toBeGreaterThan(360);
    expect(box.y + box.height).toBeGreaterThan(160);
  });
});

describe('power links', () => {
  it('puts the regleta in the Energía tier, next to the SAI', () => {
    expect(TIERS[tierOf('regleta')].nombre).toBe('Energía');
    expect(tierOf('regleta')).toBe(tierOf('sai'));
  });

  it('stores no speed or VLANs on a power link, only the outlet and the power supply in the ports', () => {
    const topology: Topology = { equipos: [plain(dev('fw', { tipo: 'firewall' })), plain(dev('ups', { tipo: 'sai' }))], enlaces: [], grupos: [] };
    expect(connectDevices(topology, 'fw', 'ups', { tipo: 'energia', puertoA: 'Fuente 1', puertoB: '3', velocidad: '1G', vlans: '10' }))
      .toEqual({ a: { equipo: 'fw', puerto: 'Fuente 1' }, b: { equipo: 'ups', puerto: '3' }, tipo: 'energia' });
    expect(editLink({ ...link('p', 'fw', 'ups', 'datos'), velocidad: '1G' }, { tipo: 'energia', velocidad: '1G' })).toEqual(link('p', 'fw', 'ups', 'energia'));
  });

  it('keeps the speed of every other link type', () => {
    const topology: Topology = { equipos: [plain(dev('a')), plain(dev('b'))], enlaces: [], grupos: [] };
    expect(connectDevices(topology, 'a', 'b', { tipo: 'gestion', velocidad: '1G' })).toEqual({ a: { equipo: 'a' }, b: { equipo: 'b' }, tipo: 'gestion', velocidad: '1G' });
  });
});

// Slice 8: the «Energía» view, a single-line power diagram worked out from the links and never saved.
const rack = (enlaces: Link[], extra: Device[] = []): Topology => {
  const d = (id: string, tipo: string): Device => ({ id, nombre: id.toUpperCase(), tipo, criticidad: 'Media', monitorizado: false, posicion: { x: 900, y: 900 } });
  return {
    equipos: [d('sai1', 'sai'), d('sai2', 'sai'), d('pdua', 'regleta'), d('pdub', 'regleta'), d('fw1', 'firewall'), d('fw2', 'firewall'), d('sw1', 'switch'), d('srv', 'servidor'), d('nas', 'almacenamiento'), ...extra],
    enlaces, grupos: [],
  };
};
const power = (id: string, a: string, b: string): Link => link(id, a, b, 'energia');
/** PDU A behind SAI 1 feeds FW1 and SW1; PDU B behind SAI 2 feeds FW2; SRV has one cable to each PDU; the NAS has nothing. */
const rackLinks = () => [
  power('a1', 'pdua', 'sai1'), power('b2', 'sai2', 'pdub'),
  power('f1', 'fw1', 'pdua'), power('s1', 'pdua', 'sw1'), power('f2', 'fw2', 'pdub'),
  power('ra', 'srv', 'pdua'), power('rb', 'srv', 'pdub'), link('d1', 'sw1', 'fw1', 'datos'),
];
const barOf = (layout: PowerLayout, id: string) => layout.bars.find(b => b.id === id)!;
const centreOf = (layout: PowerLayout, id: string) => layout.positions.get(id)!.x + POWER_NODE.width / 2;

describe('powerFeedersOf', () => {
  it('lists once each the SAIs and regletas that feed a device straight away, whichever way the link was drawn', () => {
    const topology = rack([...rackLinks(), power('a1b', 'pdua', 'fw1'), power('x', 'fw1', 'sw1')]);
    expect(powerFeedersOf(topology, 'fw1')).toEqual(['pdua']);
    expect(powerFeedersOf(topology, 'srv')).toEqual(['pdua', 'pdub']);
    expect(powerFeedersOf(topology, 'pdua')).toEqual(['sai1']);
    expect(powerFeedersOf(topology, 'nas')).toEqual([]);
  });
});

describe('layoutPower', () => {
  it('puts the SAIs on top, the regleta bars below them and the devices they feed below the bars', () => {
    const layout = layoutPower(rack(rackLinks()));
    const saiYs = ['sai1', 'sai2'].map(id => layout.positions.get(id)!.y);
    const barYs = layout.bars.map(b => b.y);
    const deviceYs = ['fw1', 'fw2', 'sw1', 'srv'].map(id => layout.positions.get(id)!.y);
    expect(Math.max(...saiYs)).toBeLessThan(Math.min(...barYs));
    expect(Math.max(...barYs) + BAR_HEIGHT).toBeLessThan(Math.min(...deviceYs));
    expect(layout.bars.map(b => b.id).sort()).toEqual(['pdua', 'pdub']);
    expect(layout.positions.has('pdua')).toBe(false);
  });

  it('makes each bar span the devices it feeds', () => {
    const layout = layoutPower(rack(rackLinks()));
    for (const [bar, fed] of [['pdua', ['fw1', 'sw1']], ['pdub', ['fw2']]] as const) {
      const { x, width } = barOf(layout, bar);
      for (const id of fed) {
        const left = layout.positions.get(id)!.x;
        expect(x).toBeLessThanOrEqual(left);
        expect(x + width).toBeGreaterThanOrEqual(left + POWER_NODE.width);
      }
    }
  });

  it('places a device fed by two bars between them', () => {
    const layout = layoutPower(rack(rackLinks()));
    const [a, b] = [barOf(layout, 'pdua'), barOf(layout, 'pdub')];
    const [left, right] = a.x < b.x ? [a, b] : [b, a];
    const centre = centreOf(layout, 'srv');
    expect(left.x + left.width).toBeLessThan(centre);
    expect(right.x).toBeGreaterThan(centre);
    expect(left.y).toBe(right.y);
  });

  it('draws only short lines from each device to each feeding bar or SAI and from each bar to its SAI', () => {
    const layout = layoutPower(rack([...rackLinks(), power('direct', 'fw1', 'sai2')]));
    expect(layout.edges.map(e => [e.id, e.lower, e.upper]).sort()).toEqual([
      ['a1', 'pdua', 'sai1'], ['b2', 'pdub', 'sai2'], ['direct', 'fw1', 'sai2'], ['f1', 'fw1', 'pdua'], ['f2', 'fw2', 'pdub'],
      ['ra', 'srv', 'pdua'], ['rb', 'srv', 'pdub'], ['s1', 'sw1', 'pdua'],
    ]);
    // A line to a bar goes straight up, inside the bar.
    for (const e of layout.edges.filter(e => e.upper.startsWith('pdu'))) {
      expect(e.upperX).toBe(e.lowerX);
      const bar = barOf(layout, e.upper);
      expect(e.lowerX).toBeGreaterThan(bar.x);
      expect(e.lowerX).toBeLessThan(bar.x + bar.width);
    }
    // A cable straight to a SAI never runs under a bar.
    const direct = layout.edges.find(e => e.id === 'direct')!;
    for (const bar of layout.bars) expect(direct.lowerX < bar.x || direct.lowerX > bar.x + bar.width).toBe(true);
  });

  it('puts the devices with no power link on a row of their own below the others and names them', () => {
    const layout = layoutPower(rack(rackLinks()));
    expect(layout.unpowered).toEqual(['nas']);
    expect(layout.positions.get('nas')!.y).toBeGreaterThan(layout.positions.get('srv')!.y);
  });

  it('is worked out without touching the topology or the positions of the «Red» view', () => {
    const topology = rack(rackLinks());
    const copy = structuredClone(topology);
    const layout = layoutPower(topology);
    expect(topology).toEqual(copy);
    expect(topology.equipos.every(d => d.posicion?.x === 900 && d.posicion.y === 900)).toBe(true);
    expect(layout.positions.get('fw1')).not.toEqual({ x: 900, y: 900 });
  });

  it('draws the saved map of the user with no device on a bar and every power link once', () => {
    const topology = fromStoredTopology(USER_MAP);
    const layout = layoutPower(topology);
    const powerLinks = topology.enlaces.filter(l => l.tipo === 'energia').map(l => l.id).sort();
    expect(layout.edges.map(e => e.id).sort()).toEqual(powerLinks);
    expect(new Set(layout.edges.map(e => e.id)).size).toBe(layout.edges.length);
    expect(layout.unpowered).toEqual(['switch-1']);
    const NODE_HEIGHT = 70;
    const rects = [...layout.positions].map(([id, p]) => ({ id, x: p.x, y: p.y, width: POWER_NODE.width, height: NODE_HEIGHT }));
    const bars = layout.bars.map(b => ({ id: b.id, x: b.x, y: b.y, width: b.width, height: BAR_HEIGHT }));
    type Box = { id: string; x: number; y: number; width: number; height: number };
    const overlap = (r: Box, s: Box) => r.x < s.x + s.width && s.x < r.x + r.width && r.y < s.y + s.height && s.y < r.y + r.height;
    for (const r of rects) for (const b of bars) expect(overlap(r, b), `${r.id} on ${b.id}`).toBe(false);
    for (const r of rects) for (const s of rects) if (r.id < s.id) expect(overlap(r, s), `${r.id} on ${s.id}`).toBe(false);
    for (const b of bars) for (const c of bars) if (b.id < c.id) expect(overlap(b, c), `${b.id} on ${c.id}`).toBe(false);
    // Firewall 1 has one cable to Regleta (PDU) 1 and one straight to SAI 2, which never runs under a bar.
    const direct = layout.edges.find(e => e.id === 'firewall-1--sai-2')!;
    expect(direct.upper).toBe('sai-2');
    for (const b of bars) expect(direct.lowerX < b.x || direct.lowerX > b.x + b.width).toBe(true);
    for (const e of layout.edges.filter(e => e.upper.startsWith('regleta'))) expect(e.upperX).toBe(e.lowerX);
  });
});

// The map the user saved on 2026-11-11 (mi-infraestructura-2026-11-11.json), copied as it was.
const USER_MAP: unknown = {"version":2,"equipos":[{"id":"sai-1","nombre":"SAI 1","tipo":"sai","criticidad":"Media","monitorizado":false,"posicion":{"x":-106,"y":28}},{"id":"regleta-pdu-1","nombre":"Regleta (PDU) 1","tipo":"regleta","criticidad":"Media","monitorizado":false,"posicion":{"x":-42,"y":198}},{"id":"regleta-pdu-2","nombre":"Regleta (PDU) 2","tipo":"regleta","criticidad":"Media","monitorizado":false,"posicion":{"x":174,"y":194}},{"id":"sai-2","nombre":"SAI 2","tipo":"sai","criticidad":"Media","monitorizado":false,"posicion":{"x":158,"y":23}},{"id":"switch-1","nombre":"Switch 1","tipo":"switch","criticidad":"Media","monitorizado":false,"posicion":{"x":66,"y":864}},{"id":"firewall-1","nombre":"Firewall 1","tipo":"firewall","criticidad":"Media","monitorizado":false,"posicion":{"x":-164,"y":567}},{"id":"firewall-2","nombre":"Firewall 2","tipo":"firewall","criticidad":"Media","monitorizado":false,"posicion":{"x":180,"y":516}},{"id":"internet-operadora-1","nombre":"Internet / operadora 1","tipo":"internet","criticidad":"Media","monitorizado":false,"posicion":{"x":-52,"y":332}},{"id":"internet-operadora-2","nombre":"Internet / operadora 2","tipo":"internet","criticidad":"Media","monitorizado":false,"posicion":{"x":163,"y":330}}],"enlaces":[{"id":"regleta-pdu-1--sai-1","a":{"equipo":"regleta-pdu-1","puerto":"1"},"b":{"equipo":"sai-1","puerto":"1"},"tipo":"energia"},{"id":"regleta-pdu-1--sai-2","a":{"equipo":"regleta-pdu-1","puerto":"2"},"b":{"equipo":"sai-2","puerto":"1"},"tipo":"energia"},{"id":"regleta-pdu-2--sai-1","a":{"equipo":"regleta-pdu-2","puerto":"1"},"b":{"equipo":"sai-1","puerto":"2"},"tipo":"energia"},{"id":"regleta-pdu-2--sai-2","a":{"equipo":"regleta-pdu-2","puerto":"2"},"b":{"equipo":"sai-2","puerto":"2"},"tipo":"energia"},{"id":"internet-operadora-1--regleta-pdu-1","a":{"equipo":"internet-operadora-1","puerto":"1"},"b":{"equipo":"regleta-pdu-1","puerto":"1"},"tipo":"energia"},{"id":"internet-operadora-2--regleta-pdu-2","a":{"equipo":"internet-operadora-2","puerto":"1"},"b":{"equipo":"regleta-pdu-2","puerto":"1"},"tipo":"energia"},{"id":"firewall-1--internet-operadora-1","a":{"equipo":"firewall-1","puerto":"1/1/1"},"b":{"equipo":"internet-operadora-1","puerto":"1/1/1"},"tipo":"wan","velocidad":"10"},{"id":"firewall-1--internet-operadora-2","a":{"equipo":"firewall-1","puerto":"1/1/2"},"b":{"equipo":"internet-operadora-2","puerto":"1/1/1"},"tipo":"wan","velocidad":"10G"},{"id":"firewall-2--internet-operadora-1","a":{"equipo":"firewall-2","puerto":"1/1/2"},"b":{"equipo":"internet-operadora-1","puerto":"1/1/1"},"tipo":"wan","velocidad":"10G"},{"id":"firewall-2--internet-operadora-2","a":{"equipo":"firewall-2","puerto":"1/1/2"},"b":{"equipo":"internet-operadora-2","puerto":"1/1/2"},"tipo":"wan","velocidad":"10G"},{"id":"firewall-1--regleta-pdu-1","a":{"equipo":"firewall-1","puerto":"1"},"b":{"equipo":"regleta-pdu-1","puerto":"3"},"tipo":"energia"},{"id":"firewall-1--sai-2","a":{"equipo":"firewall-1","puerto":"2"},"b":{"equipo":"sai-2","puerto":"3"},"tipo":"energia"},{"id":"firewall-2--regleta-pdu-1","a":{"equipo":"firewall-2","puerto":"1"},"b":{"equipo":"regleta-pdu-1","puerto":"4"},"tipo":"energia"}],"grupos":[]};
