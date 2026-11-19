import { type InventorySwitch, readInventorySwitches as readFrom } from '@shared/plan/inventory'
import { matchPlatform } from '../../domain/platformPatterns'
import type { Platform } from '../../domain/schema'

// Reading «Mi infraestructura» lives in the module the guides share with it; the catalog's platforms are the guides' own.
export {
  INVENTORY_STORAGE_KEY,
  type InventorySwitch,
  inventorySwitches,
  type LinkPorts,
  nameKey,
  TOPOLOGY_STORAGE_KEY,
  topologySwitches,
} from '@shared/plan/inventory'

/**
 * The switches «Mi infraestructura» keeps in this browser: its topology when there is one, otherwise the first
 * inventory. None when storage is blocked or holds something else.
 */
export function readInventorySwitches(): InventorySwitch[] {
  try {
    return readFrom(localStorage)
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
