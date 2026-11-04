import { catalog } from '../../content/catalog'
import { EMPTY_PLAN } from '../../domain/networkPlan'
import {
  addInventorySwitches,
  INVENTORY_STORAGE_KEY,
  inventorySwitches,
  platformFor,
  readInventorySwitches,
} from './inventoryImport'
import { twoSwitchPlan } from './planFixtures'

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

describe('addInventorySwitches', () => {
  it('starts an empty plan at the switch that hangs from no other switch, with its model and IP', () => {
    const result = addInventorySwitches(EMPTY_PLAN, inventorySwitches(inventory), catalog)

    expect(result.plan.switches).toEqual([
      { id: 'sw-1', name: 'SW-CORE', platform: 'aruba-aoscx', mgmtIp: '192.168.99.2/24', gateway: '', bridge: '' },
      { id: 'sw-2', name: 'SW-VIEJO', platform: '', mgmtIp: '', gateway: '', bridge: '' },
      { id: 'sw-3', name: 'SW-PLANTA', platform: 'cisco-c1300', mgmtIp: '', gateway: '', bridge: '' },
    ])
    expect(result.added).toEqual(['SW-CORE', 'SW-VIEJO', 'SW-PLANTA'])
    expect(result.unknownModel).toEqual(['SW-VIEJO'])
  })

  it('turns each connection between two switches into a link whose ports are left for the user', () => {
    const result = addInventorySwitches(EMPTY_PLAN, inventorySwitches(inventory), catalog)

    expect(result.plan.links).toEqual([
      { id: 'ln-1', a: { switch: 'sw-1', interface: '' }, b: { switch: 'sw-3', interface: '' }, nativeVlan: 1 },
    ])
    expect(result.links).toBe(1)
  })

  it('leaves the switches and links the plan already has, matching names without case', () => {
    const plan = twoSwitchPlan()
    const devices = inventorySwitches([
      {
        id: 'nucleo',
        nombre: 'NUCLEO',
        tipo: 'switch',
        criticidad: 'Alta',
        monitorizado: true,
        marca: 'Cisco',
        modelo: 'C1300',
      },
      {
        id: 'planta1',
        nombre: 'planta1',
        tipo: 'switch',
        criticidad: 'Media',
        monitorizado: true,
        uplinks: ['nucleo'],
      },
    ])

    const result = addInventorySwitches(plan, devices, catalog)

    expect(result.plan).toEqual(plan)
    expect(result.added).toEqual([])
    expect(result.links).toBe(0)
  })

  it('recognises each brand of the manual and leaves other models for the user to choose', () => {
    const platformOf = (marca: string, modelo: string) =>
      addInventorySwitches(
        EMPTY_PLAN,
        inventorySwitches([
          { id: 'x', nombre: 'X', tipo: 'switch', criticidad: 'Media', monitorizado: false, marca, modelo },
        ]),
        catalog,
      ).plan.switches[0]?.platform

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
