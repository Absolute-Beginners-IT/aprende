import { z } from 'zod'
import type { Catalog } from '../../domain/buildCatalog'
import type { NetworkPlan, PlanLink, PlanSwitch } from '../../domain/networkPlan'
import { matchPlatform } from '../../domain/platformPatterns'
import { nextId } from './usePlan'

/**
 * Where the website's «Mi infraestructura» (app/src/adapters/localStorageInventoryRepository.ts) keeps its inventory.
 * The app and these guides are served from the same origin, so they share the browser's storage.
 */
export const INVENTORY_STORAGE_KEY = 'mapa-infra:inventario'

// Only the fields the planner and the runbooks use; keys stay in Spanish because they mirror the inventory.
const InventoryDeviceSchema = z.object({
  id: z.string().min(1),
  nombre: z.string(),
  tipo: z.string(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  firmware: z.string().optional(),
  ip: z.string().optional(),
  ubicacion: z.string().optional(),
  uplinks: z.array(z.string()).optional(),
})

export type InventorySwitch = z.infer<typeof InventoryDeviceSchema>

/** The switches of an inventory read from untrusted JSON; entries with another shape are left out. */
export function inventorySwitches(raw: unknown): InventorySwitch[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const parsed = InventoryDeviceSchema.safeParse(item)
    return parsed.success && parsed.data.tipo === 'switch' && parsed.data.nombre.trim() ? [parsed.data] : []
  })
}

/** The switches of the inventory kept in this browser; none when storage is blocked or holds something else. */
export function readInventorySwitches(): InventorySwitch[] {
  try {
    return inventorySwitches(JSON.parse(localStorage.getItem(INVENTORY_STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

/** The platform whose runbooks fit this switch's brand and model, among `platforms`; '' when none does. */
export function platformFor(device: InventorySwitch, platforms: readonly { id: string }[]): string {
  const text = [device.marca, device.modelo, device.firmware].filter(Boolean).join(' ')
  return matchPlatform(
    text,
    platforms.map((platform) => platform.id),
  )
}

export interface InventoryImport {
  plan: NetworkPlan
  /** Names of the switches added to the plan. */
  added: string[]
  /** Added switches whose model is not one of the manual's: the user picks it. */
  unknownModel: string[]
  /** Links added for connections between two switches. */
  links: number
}

const nameKey = (name: string) => name.trim().toLowerCase()

/**
 * Adds the inventory's switches the plan does not have yet (same name, ignoring case) and a link for each
 * connection between two switches. Ports are not in the inventory, so the links leave them for the user.
 */
export function addInventorySwitches(plan: NetworkPlan, devices: InventorySwitch[], catalog: Catalog): InventoryImport {
  const deviceIds = new Set(devices.map((device) => device.id))
  const hangsFromSwitch = (device: InventorySwitch) => (device.uplinks ?? []).some((id) => deviceIds.has(id))
  // Switches that hang from no other switch go first, so an empty plan starts at the core.
  const ordered = [...devices].sort((a, b) => Number(hangsFromSwitch(a)) - Number(hangsFromSwitch(b)))

  const switches: PlanSwitch[] = [...plan.switches]
  const known = new Set(switches.map((item) => nameKey(item.name)))
  const added: string[] = []
  const unknownModel: string[] = []
  for (const device of ordered) {
    const name = device.nombre.trim()
    if (known.has(nameKey(name))) continue
    known.add(nameKey(name))
    const platform = platformFor(device, catalog.platforms)
    switches.push({
      id: nextId('sw', switches),
      name,
      platform,
      mgmtIp: device.ip?.trim() ?? '',
      gateway: '',
      bridge: '',
    })
    added.push(name)
    if (!platform) unknownModel.push(name)
  }

  const switchId = new Map(switches.map((item) => [nameKey(item.name), item.id]))
  const deviceName = new Map(devices.map((device) => [device.id, device.nombre]))
  const links: PlanLink[] = [...plan.links]
  const linked = (x: string, y: string) =>
    links.some((link) => (link.a.switch === x && link.b.switch === y) || (link.a.switch === y && link.b.switch === x))
  for (const device of ordered) {
    for (const uplink of device.uplinks ?? []) {
      const parentName = deviceName.get(uplink)
      const child = switchId.get(nameKey(device.nombre))
      const parent = parentName === undefined ? undefined : switchId.get(nameKey(parentName))
      if (!child || !parent || child === parent || linked(child, parent)) continue
      links.push({
        id: nextId('ln', links),
        a: { switch: parent, interface: '' },
        b: { switch: child, interface: '' },
        nativeVlan: 1,
      })
    }
  }

  return { plan: { ...plan, switches, links }, added, unknownModel, links: links.length - plan.links.length }
}
