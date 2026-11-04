import { catalog } from '../../content/catalog'
import { INVENTORY_STORAGE_KEY, inventorySwitches, platformFor, readInventorySwitches } from './inventoryImport'

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
