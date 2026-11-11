import { z } from 'zod'
import { matchPlatform } from '../../domain/platformPatterns'
import type { Platform } from '../../domain/schema'

/**
 * Where the website's «Mi infraestructura» (app/src/adapters/localStorageInventoryRepository.ts) keeps its topology:
 * `{ version: 2, equipos, enlaces, grupos }`. The app and these guides are served from the same origin, so they share
 * the browser's storage.
 */
export const TOPOLOGY_STORAGE_KEY = 'mapa-infra:topologia'

/** Where the first version of «Mi infraestructura» kept its inventory: read only while there is no topology. */
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

// Link types whose `b` end is what the `a` end hangs from; mirrors `isHierarchical` in app/src/domain/topology.ts.
const HIERARCHICAL_LINK_TYPES = new Set(['datos', 'troncal', 'lag', 'wan', 'almacenamiento'])

const TopologySchema = z.object({
  version: z.literal(2),
  equipos: z.array(z.unknown()),
  enlaces: z.array(z.unknown()),
})

const TopologyLinkSchema = z.object({
  a: z.object({ equipo: z.string() }),
  b: z.object({ equipo: z.string() }),
  tipo: z.string(),
})

/**
 * The switches of a stored topology, read from untrusted JSON. Each one gets `uplinks`, the devices it hangs from
 * through hierarchical links, so the planner joins switches exactly as it did with the first inventory.
 */
export function topologySwitches(raw: unknown): InventorySwitch[] {
  const parsed = TopologySchema.safeParse(raw)
  if (!parsed.success) return []
  const uplinks = new Map<string, string[]>()
  for (const item of parsed.data.enlaces) {
    const link = TopologyLinkSchema.safeParse(item)
    if (!link.success || !HIERARCHICAL_LINK_TYPES.has(link.data.tipo)) continue
    const from = uplinks.get(link.data.a.equipo) ?? []
    if (!from.includes(link.data.b.equipo)) uplinks.set(link.data.a.equipo, [...from, link.data.b.equipo])
  }
  const devices = parsed.data.equipos.map((item) => {
    const device = InventoryDeviceSchema.omit({ uplinks: true }).safeParse(item)
    return device.success ? { ...device.data, uplinks: uplinks.get(device.data.id) ?? [] } : item
  })
  return inventorySwitches(devices)
}

/**
 * The switches «Mi infraestructura» keeps in this browser: its topology when there is one, otherwise the first
 * inventory. None when storage is blocked or holds something else.
 */
export function readInventorySwitches(): InventorySwitch[] {
  try {
    const topology = localStorage.getItem(TOPOLOGY_STORAGE_KEY)
    if (topology !== null) return topologySwitches(JSON.parse(topology))
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

/** The platforms the planner works with: a plan describes switches, so firewalls and other devices stay out. */
export const switchPlatforms = (catalog: { platforms: readonly Platform[] }) =>
  catalog.platforms.filter((platform) => platform.deviceType === 'switch')

/** Two switch names are the same one when they differ only in case or surrounding spaces. */
export const nameKey = (name: string) => name.trim().toLowerCase()
