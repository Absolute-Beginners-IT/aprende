import type { Catalog } from '../../domain/buildCatalog'
import type { NetworkPlan, PlanLink, PlanSwitch } from '../../domain/networkPlan'
import { type InventorySwitch, nameKey, platformFor } from './inventoryImport'
import { nextId } from './usePlan'

export interface CombinedPlan {
  /** The plan as the planner shows and checks it: switches and links are the inventory's. */
  plan: NetworkPlan
  /** Names of stored switches the inventory does not have; they stay stored, out of sight. */
  hidden: string[]
  /** Ids of the shown switches whose model follows from their brand and model in the inventory. */
  deducedModels: Set<string>
}

const samePair = (link: PlanLink, x: string, y: string) =>
  (link.a.switch === x && link.b.switch === y) || (link.a.switch === y && link.b.switch === x)

/**
 * The plan seen through «Mi infraestructura»: one switch per inventory switch, with its name and management
 * address, and one link per connection between two of them. What only the plan knows (gateway, bridge, the ports
 * of each link, native VLAN, access ports and VLANs) is kept from the stored plan. A stored switch is found by its
 * device id or, the first time, by its name.
 */
export function combineWithInventory(stored: NetworkPlan, devices: InventorySwitch[], catalog: Catalog): CombinedPlan {
  const byDevice = new Map<string, PlanSwitch>()
  const used = new Set<string>()
  for (const device of devices) {
    const own = stored.switches.find((item) => item.deviceId === device.id && !used.has(item.id))
    if (own) {
      byDevice.set(device.id, own)
      used.add(own.id)
    }
  }
  for (const device of devices) {
    if (byDevice.has(device.id)) continue
    const named = stored.switches.find(
      (item) => item.deviceId === undefined && !used.has(item.id) && nameKey(item.name) === nameKey(device.nombre),
    )
    if (named) {
      byDevice.set(device.id, named)
      used.add(named.id)
    }
  }

  // New switches take ids no stored switch uses, hidden ones included, so saving never merges two of them.
  const taken: { id: string }[] = [...stored.switches]
  const deviceIds = new Set(devices.map((device) => device.id))
  const hangsFromSwitch = (device: InventorySwitch) => (device.uplinks ?? []).some((id) => deviceIds.has(id))
  const fresh = devices
    .filter((device) => !byDevice.has(device.id))
    .sort((a, b) => Number(hangsFromSwitch(a)) - Number(hangsFromSwitch(b)))
  for (const device of fresh) {
    const id = nextId('sw', taken)
    taken.push({ id })
    byDevice.set(device.id, { id, name: '', platform: '', mgmtIp: '', gateway: '', bridge: '' })
  }

  const deducedModels = new Set<string>()
  const fromDevice = (device: InventorySwitch): PlanSwitch => {
    const base = byDevice.get(device.id) as PlanSwitch
    const deduced = platformFor(device, catalog.platforms)
    if (deduced) deducedModels.add(base.id)
    return {
      ...base,
      deviceId: device.id,
      name: device.nombre.trim(),
      platform: deduced || base.platform,
      mgmtIp: device.ip?.trim() ?? '',
    }
  }
  // Stored order first, so the core the user picked stays the core; new switches follow, core first.
  const storedOrder = new Map(stored.switches.map((item, index) => [item.id, index]))
  const matched = devices
    .filter((device) => storedOrder.has((byDevice.get(device.id) as PlanSwitch).id))
    .sort(
      (a, b) =>
        (storedOrder.get((byDevice.get(a.id) as PlanSwitch).id) ?? 0) -
        (storedOrder.get((byDevice.get(b.id) as PlanSwitch).id) ?? 0),
    )
  const switches = [...matched, ...fresh].map(fromDevice)
  const switchOf = (deviceId: string) => byDevice.get(deviceId)?.id

  const links: PlanLink[] = []
  const takenLinks: { id: string }[] = [...stored.links]
  for (const device of devices) {
    for (const uplink of device.uplinks ?? []) {
      const child = switchOf(device.id)
      const parent = deviceIds.has(uplink) ? switchOf(uplink) : undefined
      if (!child || !parent || child === parent || links.some((link) => samePair(link, child, parent))) continue
      const kept = stored.links.find((link) => samePair(link, child, parent))
      if (kept) {
        links.push(kept)
        continue
      }
      const id = nextId('ln', takenLinks)
      takenLinks.push({ id })
      links.push({ id, a: { switch: parent, interface: '' }, b: { switch: child, interface: '' }, nativeVlan: 1 })
    }
  }
  // Stored links keep their place, so the list does not jump around when the inventory changes.
  const linkOrder = new Map(stored.links.map((link, index) => [link.id, index]))
  links.sort((a, b) => (linkOrder.get(a.id) ?? Infinity) - (linkOrder.get(b.id) ?? Infinity))

  const shown = new Set(switches.map((item) => item.id))
  return {
    plan: { ...stored, switches, links, ports: stored.ports.filter((port) => shown.has(port.switch)) },
    hidden: stored.switches.filter((item) => !shown.has(item.id)).map((item) => item.name.trim() || item.id),
    deducedModels,
  }
}

/**
 * The plan to store after the user edits a combined one: the edits, plus the switches, links and ports that were
 * out of sight. A port removed from a shown switch stays removed; hidden ones come back with their switch.
 */
export function storeCombined(stored: NetworkPlan, combined: NetworkPlan): NetworkPlan {
  const shownSwitches = new Set(combined.switches.map((item) => item.id))
  const shownLinks = new Set(combined.links.map((link) => link.id))
  return {
    ...combined,
    switches: [...combined.switches, ...stored.switches.filter((item) => !shownSwitches.has(item.id))],
    links: [...combined.links, ...stored.links.filter((link) => !shownLinks.has(link.id))],
    ports: [...combined.ports, ...stored.ports.filter((port) => !shownSwitches.has(port.switch))],
  }
}
