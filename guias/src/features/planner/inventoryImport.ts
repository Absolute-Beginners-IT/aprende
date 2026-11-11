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

/** The ports of a link set on the map of «Mi infraestructura»: this switch's side and the upstream side. */
export interface LinkPorts {
  own?: string
  upstream?: string
}

export type InventorySwitch = z.infer<typeof InventoryDeviceSchema> & {
  /** Ports of the link to each device in `uplinks`, by that device's id. Only a stored topology carries them. */
  uplinkPorts?: Record<string, LinkPorts>
}

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

// A port that is not text is left out, not the whole link: the switches stay joined as they are on the map.
const TopologyEndSchema = z.object({ equipo: z.string(), puerto: z.unknown().optional() })

const TopologyLinkSchema = z.object({
  a: TopologyEndSchema,
  b: TopologyEndSchema,
  tipo: z.string(),
})

const portOf = (end: z.infer<typeof TopologyEndSchema>) =>
  typeof end.puerto === 'string' && end.puerto.trim() ? end.puerto.trim() : undefined

/**
 * The switches of a stored topology, read from untrusted JSON. Each one gets `uplinks`, the devices it hangs from
 * through hierarchical links, so the planner joins switches exactly as it did with the first inventory, and
 * `uplinkPorts`, the ports set on the map for each of them. When two links join the same pair, the first one gives
 * the ports, as the planner keeps one link per pair.
 */
export function topologySwitches(raw: unknown): InventorySwitch[] {
  const parsed = TopologySchema.safeParse(raw)
  if (!parsed.success) return []
  const uplinks = new Map<string, string[]>()
  const ports = new Map<string, Record<string, LinkPorts>>()
  for (const item of parsed.data.enlaces) {
    const link = TopologyLinkSchema.safeParse(item)
    if (!link.success || !HIERARCHICAL_LINK_TYPES.has(link.data.tipo)) continue
    const { a, b } = link.data
    const from = uplinks.get(a.equipo) ?? []
    if (from.includes(b.equipo)) continue
    uplinks.set(a.equipo, [...from, b.equipo])
    const own = portOf(a)
    const upstream = portOf(b)
    ports.set(a.equipo, {
      ...ports.get(a.equipo),
      [b.equipo]: { ...(own && { own }), ...(upstream && { upstream }) },
    })
  }
  const devices = parsed.data.equipos.map((item) => {
    const device = InventoryDeviceSchema.omit({ uplinks: true }).safeParse(item)
    return device.success ? { ...device.data, uplinks: uplinks.get(device.data.id) ?? [] } : item
  })
  return inventorySwitches(devices).map((device) => ({ ...device, uplinkPorts: portsWithAny(ports.get(device.id)) }))
}

/** Only the upstream devices with a port on the map, so a link without ports reads as it did before. */
function portsWithAny(ports: Record<string, LinkPorts> | undefined): Record<string, LinkPorts> {
  return Object.fromEntries(Object.entries(ports ?? {}).filter(([, value]) => value.own || value.upstream))
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
