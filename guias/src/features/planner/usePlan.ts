import { EMPTY_PLAN, type NetworkPlan, PLAN_STORAGE_KEY, parsePlan } from '@shared/plan/networkPlan'
import { useStoredState } from '../../lib/useStoredState'

export { nextId, PLAN_STORAGE_KEY, parsePlan } from '@shared/plan/networkPlan'

/** The plan being edited, kept in this browser. A stored plan with the wrong shape starts again empty. */
export function usePlan(): [NetworkPlan, (plan: NetworkPlan) => void] {
  const [stored, setPlan] = useStoredState<unknown>(PLAN_STORAGE_KEY, EMPTY_PLAN)
  return [parsePlan(stored) ?? EMPTY_PLAN, setPlan]
}
