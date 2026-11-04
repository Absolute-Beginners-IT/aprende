import { z } from 'zod'
import { matchPlatform } from '../../domain/platformPatterns'

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

/** Two switch names are the same one when they differ only in case or surrounding spaces. */
export const nameKey = (name: string) => name.trim().toLowerCase()
