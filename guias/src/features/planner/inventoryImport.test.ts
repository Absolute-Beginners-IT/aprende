import { catalog } from '../../content/catalog'
import {
  INVENTORY_STORAGE_KEY,
  inventorySwitches,
  platformFor,
  readInventorySwitches,
  TOPOLOGY_STORAGE_KEY,
  topologySwitches,
} from './inventoryImport'

const inventory = [
  { id: 'fw01', nombre: 'FW01', tipo: 'firewall', criticidad: 'Alta', monitorizado: true },
  {
    id: 'sw-planta',
    nombre: 'SW-PLANTA',
    tipo: 'switch',
    criticidad: 'Media',
    monitorizado: false,
    marca: 'Cisco',
    modelo: 'C1300-48P',
    uplinks: ['sw-core'],
  },
  {
    id: 'sw-core',
    nombre: 'SW-CORE',
    tipo: 'switch',
    criticidad: 'Alta',
    monitorizado: true,
    marca: 'HPE Aruba',
    modelo: '6300M',
    ip: '192.168.99.2/24',
    uplinks: ['fw01'],
  },
  {
    id: 'sw-viejo',
    nombre: 'SW-VIEJO',
    tipo: 'switch',
    criticidad: 'Baja',
    monitorizado: false,
    marca: 'HPE',
    modelo: '2530-24G',
  },
]

describe('inventorySwitches', () => {
  it('keeps only the switches and skips entries with an unexpected shape', () => {
    const names = inventorySwitches([...inventory, { nombre: 'sin id', tipo: 'switch' }, 'basura']).map((d) => d.nombre)
    expect(names).toEqual(['SW-PLANTA', 'SW-CORE', 'SW-VIEJO'])
  })

  it('keeps the location of a switch when the inventory has one', () => {
    const [device] = inventorySwitches([{ id: 'a', nombre: 'A', tipo: 'switch', ubicacion: 'CPD-Rack2' }])
    expect(device?.ubicacion).toBe('CPD-Rack2')
  })

  it('returns nothing when the stored inventory is not a list', () => {
    expect(inventorySwitches({ equipos: [] })).toEqual([])
  })

  it('reads the inventory that «Mi infraestructura» keeps in this browser, and survives broken JSON', () => {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory))
    expect(readInventorySwitches()).toHaveLength(3)
    localStorage.setItem(INVENTORY_STORAGE_KEY, '{roto')
    expect(readInventorySwitches()).toEqual([])
    localStorage.clear()
  })
})

describe('topologySwitches', () => {
  const device = (id: string, tipo = 'switch') => ({
    id,
    nombre: id.toUpperCase(),
    tipo,
    criticidad: 'Media',
    monitorizado: false,
  })
  const link = (id: string, a: string, b: string, tipo: string) => ({ id, a: { equipo: a }, b: { equipo: b }, tipo })
  const topology = {
    version: 2,
    equipos: [device('fw01', 'firewall'), device('core1'), device('core2'), device('p1')],
    enlaces: [
      link('1', 'core1', 'fw01', 'datos'),
      link('2', 'core1', 'core2', 'stack'),
      link('3', 'p1', 'core1', 'troncal'),
      link('4', 'p1', 'core1', 'lag'),
      link('5', 'p1', 'core2', 'gestion'),
      link('6', 'core2', 'fw01', 'wan'),
    ],
    grupos: [],
  }

  it('gives each switch what it hangs from through hierarchical links only, once each, as the old inventory did', () => {
    expect(topologySwitches(topology).map((d) => [d.id, d.uplinks])).toEqual([
      ['core1', ['fw01']],
      ['core2', ['fw01']],
      ['p1', ['core1']],
    ])
  })

  it('gives each switch the ports of the link to what it hangs from, own side and upstream side', () => {
    const withPorts = {
      ...topology,
      enlaces: [
        { id: '1', a: { equipo: 'core1' }, b: { equipo: 'fw01', puerto: 'port3' }, tipo: 'datos' },
        {
          id: '3',
          a: { equipo: 'p1', puerto: 'gi1/0/48' },
          b: { equipo: 'core1', puerto: ' 1/1/49 ' },
          tipo: 'troncal',
        },
        { id: '4', a: { equipo: 'p1', puerto: 'gi1/0/47' }, b: { equipo: 'core1', puerto: '1/1/50' }, tipo: 'lag' },
        { id: '6', a: { equipo: 'core2', puerto: '  ' }, b: { equipo: 'fw01', puerto: 7 }, tipo: 'wan' },
      ],
    }

    expect(topologySwitches(withPorts).map((d) => [d.id, d.uplinks, d.uplinkPorts])).toEqual([
      ['core1', ['fw01'], { fw01: { upstream: 'port3' } }],
      ['core2', ['fw01'], {}],
      // Two links to the same switch: the first one, as the planner keeps one link per pair.
      ['p1', ['core1'], { core1: { own: 'gi1/0/48', upstream: '1/1/49' } }],
    ])
  })

  it('gives no ports to the switches of the old inventory', () => {
    const [device] = inventorySwitches([
      { id: 'a', nombre: 'A', tipo: 'switch', uplinks: ['b'], uplinkPorts: { b: { own: 'x' } } },
    ])
    expect(device?.uplinks).toEqual(['b'])
    expect(device?.uplinkPorts).toBeUndefined()
  })

  it('returns nothing for another version or a document with an unexpected shape', () => {
    expect(topologySwitches({ ...topology, version: 3 })).toEqual([])
    expect(topologySwitches({ version: 2, equipos: {} })).toEqual([])
    expect(topologySwitches([device('core1')])).toEqual([])
  })

  it('reads the version 2 topology first and the old inventory only when there is none', () => {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory))
    expect(readInventorySwitches().map((d) => d.nombre)).toEqual(['SW-PLANTA', 'SW-CORE', 'SW-VIEJO'])
    localStorage.setItem(TOPOLOGY_STORAGE_KEY, JSON.stringify(topology))
    expect(readInventorySwitches().map((d) => d.nombre)).toEqual(['CORE1', 'CORE2', 'P1'])
    localStorage.setItem(TOPOLOGY_STORAGE_KEY, '{roto')
    expect(readInventorySwitches()).toEqual([])
    localStorage.clear()
  })
})

describe('platformFor brands', () => {
  it('recognises each brand of the manual and leaves other models for the user to choose', () => {
    const platformOf = (marca: string, modelo: string) => {
      const [device] = inventorySwitches([{ id: 'x', nombre: 'X', tipo: 'switch', marca, modelo }])
      return device ? platformFor(device, catalog.platforms) : undefined
    }

    expect(platformOf('Aruba', 'CX 6100')).toBe('aruba-aoscx')
    expect(platformOf('Cisco', 'Catalyst 1300-24P')).toBe('cisco-c1300')
    expect(platformOf('MikroTik', 'CRS317-1G-16S+RM')).toBe('mikrotik-routeros')
    expect(platformOf('Ruijie', 'RG-NBS3200-48GT4XS-P')).toBe('ruijie-reyee')
    expect(platformOf('Cisco', 'Catalyst 9200')).toBe('')
    expect(platformOf('HPE Aruba', '2930F')).toBe('')
  })
})

describe('platformFor', () => {
  it('tells the platform of a switch only among the platforms it is given', () => {
    const [aruba] = inventorySwitches([{ id: 'a', nombre: 'A', tipo: 'switch', marca: 'Aruba', modelo: 'CX 6100' }])
    if (!aruba) throw new Error('fixture')

    expect(platformFor(aruba, catalog.platforms)).toBe('aruba-aoscx')
    expect(
      platformFor(
        aruba,
        catalog.platforms.filter((item) => item.id !== 'aruba-aoscx'),
      ),
    ).toBe('')
  })
})
