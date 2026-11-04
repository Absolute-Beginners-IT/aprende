import { catalog } from '../../content/catalog'
import { EMPTY_PLAN, type NetworkPlan, NetworkPlanSchema } from '../../domain/networkPlan'
import { type InventorySwitch, inventorySwitches } from './inventoryImport'
import { combineWithInventory, storeCombined } from './inventoryPlan'
import { twoSwitchPlan } from './planFixtures'

const devices = (items: object[]): InventorySwitch[] =>
  inventorySwitches(items.map((item) => ({ criticidad: 'Media', monitorizado: false, ...item })))

const coreAndFloor = devices([
  { id: 'fw01', nombre: 'FW01', tipo: 'firewall' },
  { id: 'inv-planta', nombre: 'planta1', tipo: 'switch', marca: 'Cisco', modelo: 'C1300-48P', uplinks: ['inv-core'] },
  {
    id: 'inv-core',
    nombre: ' NUCLEO ',
    tipo: 'switch',
    marca: 'HPE Aruba',
    modelo: '6300M',
    ip: '192.168.99.20/24',
    uplinks: ['fw01'],
  },
])

describe('combineWithInventory', () => {
  it('takes the switches and the links between them from the inventory, core first', () => {
    const { plan, hidden } = combineWithInventory(EMPTY_PLAN, coreAndFloor, catalog)

    expect(plan.switches).toEqual([
      {
        id: 'sw-1',
        deviceId: 'inv-core',
        name: 'NUCLEO',
        platform: 'aruba-aoscx',
        mgmtIp: '192.168.99.20/24',
        gateway: '',
        bridge: '',
      },
      {
        id: 'sw-2',
        deviceId: 'inv-planta',
        name: 'planta1',
        platform: 'cisco-c1300',
        mgmtIp: '',
        gateway: '',
        bridge: '',
      },
    ])
    expect(plan.links).toEqual([
      { id: 'ln-1', a: { switch: 'sw-1', interface: '' }, b: { switch: 'sw-2', interface: '' }, nativeVlan: 1 },
    ])
    expect(hidden).toEqual([])
  })

  it('matches a stored switch without device id by name once, keeping what only the plan knows', () => {
    const { plan } = combineWithInventory(twoSwitchPlan(), coreAndFloor, catalog)

    expect(plan.switches.map((item) => [item.id, item.deviceId, item.name, item.mgmtIp, item.gateway])).toEqual([
      ['sw-1', 'inv-core', 'NUCLEO', '192.168.99.20/24', '192.168.99.1'],
      ['sw-2', 'inv-planta', 'planta1', '', '192.168.99.1'],
    ])
    expect(plan.links).toEqual(twoSwitchPlan().links)
    expect(plan.ports).toEqual(twoSwitchPlan().ports)
    expect(plan.vlans).toEqual(twoSwitchPlan().vlans)
  })

  it('follows a renamed device by its id once it has been matched', () => {
    const matched = combineWithInventory(twoSwitchPlan(), coreAndFloor, catalog).plan
    const renamed = coreAndFloor.map((item) => (item.id === 'inv-planta' ? { ...item, nombre: 'SW-P1' } : item))

    const { plan, hidden } = combineWithInventory(matched, renamed, catalog)

    expect(plan.switches.find((item) => item.id === 'sw-2')?.name).toBe('SW-P1')
    expect(plan.ports).toEqual(twoSwitchPlan().ports)
    expect(hidden).toEqual([])
  })

  it('recovers a hidden switch by name when its device is created again with another id', () => {
    const sync = (stored: NetworkPlan, items: InventorySwitch[]) =>
      storeCombined(stored, combineWithInventory(stored, items, catalog).plan)
    const onlyCore = coreAndFloor.filter((item) => item.id !== 'inv-planta')
    const recreated = coreAndFloor.map((item) => (item.id === 'inv-planta' ? { ...item, id: 'inv-planta-2' } : item))

    const gone = sync(sync(twoSwitchPlan(), coreAndFloor), onlyCore)
    const { plan, hidden } = combineWithInventory(gone, recreated, catalog)

    expect(hidden).toEqual([])
    expect(plan.switches.find((item) => item.id === 'sw-2')?.deviceId).toBe('inv-planta-2')
    expect(plan.links).toEqual(twoSwitchPlan().links)
    expect(plan.ports).toEqual(twoSwitchPlan().ports)
  })

  it('keeps the model the user chose when brand and model match none of the manual', () => {
    const stored: NetworkPlan = {
      ...EMPTY_PLAN,
      switches: [{ id: 'sw-1', name: 'SW-VIEJO', platform: 'cisco-c1300', mgmtIp: '', gateway: '', bridge: '' }],
    }
    const viejo = devices([{ id: 'v', nombre: 'SW-VIEJO', tipo: 'switch', marca: 'HPE', modelo: '2530-24G' }])

    expect(combineWithInventory(stored, viejo, catalog).plan.switches[0]?.platform).toBe('cisco-c1300')
  })

  it('hides the switches the inventory does not have, with their links and ports, and names them', () => {
    const onlyCore = coreAndFloor.filter((item) => item.id !== 'inv-planta')

    const { plan, hidden } = combineWithInventory(twoSwitchPlan(), onlyCore, catalog)

    expect(plan.switches.map((item) => item.name)).toEqual(['NUCLEO'])
    expect(plan.links).toEqual([])
    expect(plan.ports).toEqual([])
    expect(hidden).toEqual(['planta1'])
  })

  it('keeps the ports of a link that disappears and comes back in the inventory', () => {
    const unlinked = coreAndFloor.map((item) => (item.id === 'inv-planta' ? { ...item, uplinks: [] } : item))
    const stored = twoSwitchPlan()

    const apart = combineWithInventory(stored, unlinked, catalog)
    expect(apart.plan.links).toEqual([])

    const back = combineWithInventory(storeCombined(stored, apart.plan), coreAndFloor, catalog)
    expect(back.plan.links).toEqual(stored.links)
  })
})

describe('storeCombined', () => {
  it('saves the edits and keeps what is hidden, so nothing is lost while the inventory changes', () => {
    const onlyCore = coreAndFloor.filter((item) => item.id !== 'inv-planta')
    const stored = twoSwitchPlan()
    const { plan } = combineWithInventory(stored, onlyCore, catalog)
    const edited = { ...plan, switches: plan.switches.map((item) => ({ ...item, gateway: '192.168.99.254' })) }

    const saved = storeCombined(stored, edited)

    expect(NetworkPlanSchema.parse(saved)).toEqual(saved)
    expect(saved.switches.map((item) => [item.id, item.gateway])).toEqual([
      ['sw-1', '192.168.99.254'],
      ['sw-2', '192.168.99.1'],
    ])
    expect(saved.links).toEqual(stored.links)
    expect(saved.ports).toEqual(stored.ports)
    expect(combineWithInventory(saved, coreAndFloor, catalog).plan.ports).toEqual(stored.ports)
  })

  it('does not bring back a port the user removed from a switch of the inventory', () => {
    const stored = twoSwitchPlan()
    const { plan } = combineWithInventory(stored, coreAndFloor, catalog)

    const saved = storeCombined(stored, { ...plan, ports: [] })

    expect(saved.ports).toEqual([])
  })

  it('gives new switches ids that no hidden switch uses', () => {
    const stored: NetworkPlan = {
      ...EMPTY_PLAN,
      switches: [{ id: 'sw-1', name: 'perdido', platform: '', mgmtIp: '', gateway: '', bridge: '' }],
    }

    const { plan } = combineWithInventory(stored, coreAndFloor, catalog)

    expect(plan.switches.map((item) => item.id)).toEqual(['sw-2', 'sw-3'])
    expect(storeCombined(stored, plan).switches.map((item) => item.id)).toEqual(['sw-2', 'sw-3', 'sw-1'])
  })
})
