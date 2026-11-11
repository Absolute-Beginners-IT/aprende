import { catalog } from '../../content/catalog'
import { EMPTY_PLAN, type NetworkPlan, NetworkPlanSchema } from '../../domain/networkPlan'
import { buildPlanGuide } from './buildPlanGuide'
import { type InventorySwitch, inventorySwitches } from './inventoryImport'
import { combineWithInventory, discardHidden, storeCombined } from './inventoryPlan'
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

describe('ports from the map of Mi infraestructura', () => {
  const withMapPorts = (ports: { own?: string; upstream?: string }) =>
    coreAndFloor.map((item) => (item.id === 'inv-planta' ? { ...item, uplinkPorts: { 'inv-core': ports } } : item))

  it('fills each side of a new link with the port of its switch on the map', () => {
    const { plan, mapPorts } = combineWithInventory(
      EMPTY_PLAN,
      withMapPorts({ own: 'gi1/0/48', upstream: '1/1/49' }),
      catalog,
    )

    // A new link has the upstream switch (NUCLEO, sw-1) on side a.
    expect(plan.links).toEqual([
      {
        id: 'ln-1',
        a: { switch: 'sw-1', interface: '1/1/49' },
        b: { switch: 'sw-2', interface: 'gi1/0/48' },
        nativeVlan: 1,
      },
    ])
    expect([...mapPorts].sort()).toEqual(['ln-1:a', 'ln-1:b'])
  })

  it('fills the right side of a stored link whatever its order', () => {
    const stored = twoSwitchPlan()
    const link = stored.links[0]
    if (!link) throw new Error('fixture')
    // The floor switch on side a this time.
    stored.links[0] = {
      ...link,
      a: { switch: 'sw-2', interface: 'gi1/0/1' },
      b: { switch: 'sw-1', interface: '1/1/1' },
    }

    const { plan, mapPorts } = combineWithInventory(stored, withMapPorts({ own: 'gi1/0/48' }), catalog)

    expect(plan.links[0]).toEqual({
      id: 'ln-1',
      a: { switch: 'sw-2', interface: 'gi1/0/48' },
      b: { switch: 'sw-1', interface: '1/1/1' },
      nativeVlan: 1,
    })
    expect([...mapPorts]).toEqual(['ln-1:a'])
  })

  it('keeps the planner value of a side the map gives no port, and of every side without map ports', () => {
    const upstreamOnly = combineWithInventory(twoSwitchPlan(), withMapPorts({ upstream: '1/1/52' }), catalog)
    expect(upstreamOnly.plan.links[0]?.a.interface).toBe('1/1/52')
    expect(upstreamOnly.plan.links[0]?.b.interface).toBe('gi1/0/48')
    expect([...upstreamOnly.mapPorts]).toEqual(['ln-1:a'])

    const none = combineWithInventory(twoSwitchPlan(), coreAndFloor, catalog)
    expect(none.plan.links).toEqual(twoSwitchPlan().links)
    expect(none.mapPorts.size).toBe(0)
  })

  it('stores the planner own value, not the map port, so it comes back when the map port goes', () => {
    const stored = twoSwitchPlan()
    const { plan, mapPorts } = combineWithInventory(stored, withMapPorts({ own: 'gi1/0/1' }), catalog)
    const edited = {
      ...plan,
      links: plan.links.map((link) => ({ ...link, a: { ...link.a, interface: '1/1/50' }, nativeVlan: 99 })),
    }

    const saved = storeCombined(stored, edited, mapPorts)

    expect(saved.links).toEqual([
      {
        id: 'ln-1',
        a: { switch: 'sw-1', interface: '1/1/50' },
        b: { switch: 'sw-2', interface: 'gi1/0/48' },
        nativeVlan: 99,
      },
    ])
    expect(combineWithInventory(saved, coreAndFloor, catalog).plan.links[0]?.b.interface).toBe('gi1/0/48')
  })

  it('stores a new link with empty ports where the map fills them', () => {
    const { plan, mapPorts } = combineWithInventory(EMPTY_PLAN, withMapPorts({ own: 'gi1/0/48' }), catalog)

    expect(storeCombined(EMPTY_PLAN, plan, mapPorts).links).toEqual([
      { id: 'ln-1', a: { switch: 'sw-1', interface: '' }, b: { switch: 'sw-2', interface: '' }, nativeVlan: 1 },
    ])
  })

  it('builds the runbooks with the port set on the map', () => {
    const { plan } = combineWithInventory(twoSwitchPlan(), withMapPorts({ own: 'gi1/0/24' }), catalog)

    const floor = buildPlanGuide(plan, catalog).find((guide) => guide.plannedSwitch.id === 'sw-2')
    const trunk = floor?.steps.find((step) => step.key === 'trunk-ln-1')
    expect(trunk?.title).toBe('Enlace con NUCLEO: gi1/0/24 en trunk')
    expect(trunk?.values).toMatchObject({ interfaceId: 'gi1/0/24' })
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

describe('advisories of the first delivery', () => {
  const onlyCore = coreAndFloor.filter((item) => item.id !== 'inv-planta')
  const sync = (stored: NetworkPlan, items: InventorySwitch[]) =>
    storeCombined(stored, combineWithInventory(stored, items, catalog).plan)

  it('keeps every port and link in its place while its switch is hidden and comes back', () => {
    const stored: NetworkPlan = {
      ...twoSwitchPlan(),
      ports: [
        { id: 'pt-1', switch: 'sw-2', interface: 'gi1/0/5', vlan: 10 },
        { id: 'pt-2', switch: 'sw-1', interface: '1/1/5', vlan: 10 },
        { id: 'pt-3', switch: 'sw-2', interface: 'gi1/0/6', vlan: 20 },
      ],
    }

    const hidden = sync(sync(stored, coreAndFloor), onlyCore)
    expect(hidden.ports.map((port) => port.id)).toEqual(['pt-1', 'pt-2', 'pt-3'])
    expect(hidden.links.map((link) => link.id)).toEqual(['ln-1'])

    const back = combineWithInventory(hidden, coreAndFloor, catalog).plan
    expect(back.ports.map((port) => port.id)).toEqual(['pt-1', 'pt-2', 'pt-3'])
  })

  it('gives a new port another id when the one it took belongs to a hidden switch', () => {
    const stored = sync(twoSwitchPlan(), coreAndFloor)
    const { plan } = combineWithInventory(stored, onlyCore, catalog)
    // The port editor only sees the shown ports, so it can pick the id of a hidden one.
    const added = { ...plan, ports: [...plan.ports, { id: 'pt-1', switch: 'sw-1', interface: '1/1/7', vlan: 10 }] }

    const saved = storeCombined(stored, added)

    expect(saved.ports[0]).toEqual({ id: 'pt-1', switch: 'sw-2', interface: 'gi1/0/5', vlan: 10 })
    expect(saved.ports[1]).toMatchObject({ switch: 'sw-1', interface: '1/1/7', vlan: 10 })
    expect(new Set(saved.ports.map((port) => port.id)).size).toBe(2)
  })

  it('discards the hidden switches with their links and ports, and keeps the shown ones', () => {
    const stored = sync(twoSwitchPlan(), coreAndFloor)
    const { plan } = combineWithInventory(stored, onlyCore, catalog)

    const kept = discardHidden(stored, plan)

    expect(kept.switches.map((item) => item.id)).toEqual(['sw-1'])
    expect(kept.links).toEqual([])
    expect(kept.ports).toEqual([])
    expect(kept.vlans).toEqual(twoSwitchPlan().vlans)
    expect(combineWithInventory(kept, onlyCore, catalog).hidden).toEqual([])
  })

  it('names a hidden switch without a name in words, not by its internal id', () => {
    const stored: NetworkPlan = {
      ...EMPTY_PLAN,
      switches: [{ id: 'sw-7', name: '  ', platform: '', mgmtIp: '', gateway: '', bridge: '' }],
    }

    expect(combineWithInventory(stored, onlyCore, catalog).hidden).toEqual(['un switch sin nombre'])
  })

  it('matches no stored switch by a name two inventory switches share, and reports the name', () => {
    const twins = devices([
      { id: 'a', nombre: 'planta1', tipo: 'switch', marca: 'Cisco', modelo: 'C1300-24P' },
      { id: 'b', nombre: 'PLANTA1 ', tipo: 'switch', marca: 'Cisco', modelo: 'C1300-48P' },
    ])

    const { plan, hidden, duplicates } = combineWithInventory(twoSwitchPlan(), twins, catalog)

    expect(plan.switches.map((item) => [item.deviceId, item.gateway])).toEqual([
      ['a', ''],
      ['b', ''],
    ])
    // planta1 is in the inventory, twice: only nucleo is really missing.
    expect(hidden).toEqual(['nucleo'])
    expect(duplicates).toEqual(['planta1'])
  })

  it('keeps the switches of a shared name when the hidden ones are discarded', () => {
    const twins = devices([
      { id: 'a', nombre: 'planta1', tipo: 'switch' },
      { id: 'b', nombre: 'PLANTA1', tipo: 'switch' },
    ])
    const stored = twoSwitchPlan()
    const { plan, duplicates } = combineWithInventory(stored, twins, catalog)

    const kept = discardHidden(stored, plan, duplicates)

    expect(kept.switches.map((item) => item.name)).toContain('planta1')
    expect(kept.switches.map((item) => item.name)).not.toContain('nucleo')
    expect(kept.ports).toEqual(stored.ports)
  })
})
