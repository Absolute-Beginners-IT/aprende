import { type CombinedPlan, combineWithInventory as combine } from '@shared/plan/combine'
import type { NetworkPlan } from '@shared/plan/networkPlan'
import type { Catalog } from '../../domain/buildCatalog'
import { type InventorySwitch, platformFor, switchPlatforms } from './inventoryImport'

// Combining the plan with «Mi infraestructura» and storing it back live in the module the guides share with the map.
export {
  type CombinedPlan,
  discardHidden,
  mapPortKey,
  storeCombined,
  withoutNewSharedNames,
} from '@shared/plan/combine'

/** The plan seen through «Mi infraestructura», each switch's model deduced among the catalog's switch platforms. */
export function combineWithInventory(stored: NetworkPlan, devices: InventorySwitch[], catalog: Catalog): CombinedPlan {
  const platforms = switchPlatforms(catalog)
  return combine(stored, devices, (device) => platformFor(device, platforms))
}
