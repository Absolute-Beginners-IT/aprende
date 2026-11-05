import type { Catalog } from '../../domain/buildCatalog'
import type { NetworkPlan, PlanLink, PlanSwitch } from '../../domain/networkPlan'
import { type InventorySwitch, nameKey, platformFor, switchPlatforms } from './inventoryImport'
import { nextId } from './usePlan'

export interface CombinedPlan {
  /** The plan as the planner shows and checks it: switches and links are the inventory's. */
  plan: NetworkPlan
  /** Names of stored switches the inventory does not have; they stay stored, out of sight. */
  hidden: string[]
  /** Ids of the shown switches whose model follows from their brand and model in the inventory. */
  deducedModels: Set<string>
  /** Names that two or more inventory switches share: no stored switch is matched by them. */
  duplicates: string[]
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
  // A switch whose device is gone (deleted and created again, with a new id) is matched by name like a new one.
  const present = new Set(devices.map((device) => device.id))
  const free = (item: PlanSwitch) => item.deviceId === undefined || !present.has(item.deviceId)
  // A name two inventory switches share would hand one stored switch's data to either of them: no match by it.
  const namesSeen = new Map<string, string>()
  const duplicates: string[] = []
  for (const device of devices) {
    const key = nameKey(device.nombre)
    const first = namesSeen.get(key)
    if (first === undefined) namesSeen.set(key, device.nombre.trim())
    else if (!duplicates.includes(first)) duplicates.push(first)
  }
  const shared = new Set(duplicates.map(nameKey))
  for (const device of devices) {
    if (byDevice.has(device.id) || shared.has(nameKey(device.nombre))) continue
    const named = stored.switches.find(
      (item) => free(item) && !used.has(item.id) && nameKey(item.name) === nameKey(device.nombre),
    )
    if (named) {
      byDevice.set(device.id, named)
      used.add(named.id)
    }
  }

  // New switches take ids no stored switch uses, hidden ones included, so saving never merges two of them.
  const taken: { id: string }[] = [...stored.switches]
  const deviceIds = present
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
    const deduced = platformFor(device, switchPlatforms(catalog))
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
    hidden: stored.switches
      .filter((item) => !shown.has(item.id))
      .map((item) => item.name.trim() || 'un switch sin nombre'),
    deducedModels,
    duplicates,
  }
}

/**
 * Items in their stored order: a shown item in its edited form, a hidden one as stored (when `keepHidden` says so),
 * and items that are new at the end. Saving then never moves a port or a link just because it was out of sight.
 * The editors only see the shown items, so a new one may carry the id of a hidden one: it gets a free id instead
 * of replacing it.
 */
function inStoredOrder<T extends { id: string }>(
  stored: T[],
  shown: T[],
  keepHidden: (item: T) => boolean,
  prefix: string,
): T[] {
  const hiddenIds = new Set(stored.filter(keepHidden).map((item) => item.id))
  const taken: { id: string }[] = [...stored, ...shown]
  const unclashed = shown.map((item) => {
    if (!hiddenIds.has(item.id)) return item
    const id = nextId(prefix, taken)
    taken.push({ id })
    return { ...item, id }
  })
  const edited = new Map(unclashed.map((item) => [item.id, item]))
  const placed = stored.flatMap((item) => {
    if (hiddenIds.has(item.id)) return [item]
    const current = edited.get(item.id)
    return current ? [current] : []
  })
  const placedIds = new Set(placed.map((item) => item.id))
  return [...placed, ...unclashed.filter((item) => !placedIds.has(item.id))]
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
    // The shown order decides the core; hidden switches have no place in it, so they go last.
    switches: [...combined.switches, ...stored.switches.filter((item) => !shownSwitches.has(item.id))],
    links: inStoredOrder(stored.links, combined.links, (link) => !shownLinks.has(link.id), 'ln'),
    ports: inStoredOrder(stored.ports, combined.ports, (port) => !shownSwitches.has(port.switch), 'pt'),
  }
}

/**
 * The plan to store when the user discards the hidden switches: they go, with their links and ports. Links between
 * two shown switches stay even if the inventory no longer connects them, so their ports come back with the connection.
 */
export function discardHidden(stored: NetworkPlan, combined: NetworkPlan): NetworkPlan {
  const saved = storeCombined(stored, combined)
  const shown = new Set(combined.switches.map((item) => item.id))
  return {
    ...saved,
    switches: saved.switches.filter((item) => shown.has(item.id)),
    links: saved.links.filter((link) => shown.has(link.a.switch) && shown.has(link.b.switch)),
    ports: saved.ports.filter((port) => shown.has(port.switch)),
  }
}
