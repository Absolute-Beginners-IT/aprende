import type { CombinedPlan, NetworkPlan } from '@shared/plan';

/** The planner document as the map shows it, and why it cannot be changed from the map when it cannot. */
export interface LoadedPlan extends CombinedPlan {
  /** Set when the stored plan is unreadable or of a newer version: the map shows it and never writes over it. */
  problem?: string;
}

/**
 * One change to the plan as the map shows it (combined with the inventory). It is applied to what is stored at the
 * moment of writing, so it must only touch what it changes: `plan => ({ ...plan, vlans: [...plan.vlans, vlan] })`.
 */
export type PlanChange = (plan: NetworkPlan) => NetworkPlan;

/**
 * Storage port for the planner document (`switching-manual:plan`) that the guides' planner also reads and writes.
 * Writes go through the module shared with the planner, so whatever the map does not show is kept as it was.
 */
export interface PlanRepository {
  load(): Promise<LoadedPlan>;
  /** Re-reads what is stored right now, applies only `change` and stores the result as one write. */
  apply(change: PlanChange): Promise<void>;
}
