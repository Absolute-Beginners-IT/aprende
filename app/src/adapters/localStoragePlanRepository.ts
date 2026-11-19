import {
  combineWithInventory, EMPTY_PLAN, PLAN_STORAGE_KEY, readInventorySwitches, readStoredPlan, storeCombined,
  STORED_PLAN_REFUSALS, type CombinedPlan, type NetworkPlan,
} from '@shared/plan';
import type { PlanRepository } from '../ports/PlanRepository';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The guides' planner keeps the plan here; the map reads and writes the same document, it never copies it. */
export const PLAN_KEY = PLAN_STORAGE_KEY;

// The map has no catalog of platforms: the model a switch has in the plan stays, and the guides deduce it as before.
const keepStoredPlatform = () => '';

const asCombined = (plan: NetworkPlan): CombinedPlan =>
  ({ plan, hidden: [], deducedModels: new Set(), duplicates: [], mapPorts: new Set(), mapVlans: new Map() });

export function createLocalStoragePlanRepository(storage: KeyValueStorage): PlanRepository {
  // With switches in «Mi infraestructura», they and their connections come from there, exactly as in the planner.
  const combine = (stored: NetworkPlan): CombinedPlan | undefined => {
    const devices = readInventorySwitches(storage);
    return devices.length > 0 ? combineWithInventory(stored, devices, keepStoredPlatform) : undefined;
  };

  return {
    async load() {
      const read = readStoredPlan(storage.getItem(PLAN_KEY));
      if (!read.ok) return { ...(combine(EMPTY_PLAN) ?? asCombined(EMPTY_PLAN)), problem: STORED_PLAN_REFUSALS[read.reason] };
      return combine(read.plan) ?? asCombined(read.plan);
    },
    async apply(change) {
      // What is stored now, not what was loaded: a change saved meanwhile by the planner or another tab survives.
      const read = readStoredPlan(storage.getItem(PLAN_KEY));
      if (!read.ok) throw new Error(STORED_PLAN_REFUSALS[read.reason]);
      const combined = combine(read.plan);
      // Same store-back as the planner's edits: hidden switches, their links and ports, the switch order and the
      // planner's own ports where the map shows its ports are kept. One setItem, so a refused write changes nothing.
      const saved = combined
        ? storeCombined(read.plan, change(combined.plan), combined.mapPorts)
        : change(read.plan);
      // A change that would leave a plan nobody can read (the planner would fall back to an empty one) is refused.
      const text = JSON.stringify(saved);
      if (!readStoredPlan(text).ok) throw new Error('El cambio no se ha guardado: el plan de red quedaría ilegible.');
      storage.setItem(PLAN_KEY, text);
    },
  };
}
