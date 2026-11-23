import {
  EMPTY_PLAN,
  type NetworkPlan,
  nextId,
  PLAN_STORAGE_KEY,
  readStoredPlan,
  type StoredPlanRefusal,
} from '@shared/plan/networkPlan'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export { nextId, PLAN_STORAGE_KEY, parsePlan } from '@shared/plan/networkPlan'

/** The stored text; undefined when the browser blocks storage (private mode, blocked site data). */
function readText(): string | null | undefined {
  try {
    return localStorage.getItem(PLAN_STORAGE_KEY)
  } catch {
    return undefined
  }
}

export interface StoredPlan {
  /** The stored plan; the empty one while nothing is stored or while it must be left alone (`refusal`). */
  plan: NetworkPlan
  /** Why the stored plan must not be written over: `update` then writes nothing. */
  refusal?: StoredPlanRefusal
  /** Applies `change` to the plan stored right now, never to an older copy, and stores the result. */
  update: (change: (current: NetworkPlan) => NetworkPlan) => void
  /** Stores `plan` in place of whatever is stored, even a plan that cannot be read: only after the user confirms. */
  replace: (plan: NetworkPlan) => void
  /** Why the last change was not stored (see PlanConflictError); cleared by the next change applied. */
  conflict?: string
}

/**
 * A change that cannot be applied to what is stored now without dropping what another writer stored meanwhile, such
 * as a VLAN the map added in another tab with the id the planner is adding. `update` stores nothing and says why.
 */
export class PlanConflictError extends Error {}

/**
 * The plan being edited, kept in this browser and shared with the map of «Mi infraestructura», which may write it
 * from another tab: a change stored there shows up here, and every change is applied to what is stored at that
 * moment. A stored plan that cannot be read, or that a later version wrote, is never written over by a change.
 */
export function usePlan(): StoredPlan {
  const [text, setText] = useState<string | null>(() => readText() ?? null)
  const [conflict, setConflict] = useState<string>()
  // With storage blocked, the plan lives only here: changes apply to this copy.
  const latest = useRef(text)
  latest.current = text

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      // A null key means another tab cleared the whole storage.
      if (event.key !== null && event.key !== PLAN_STORAGE_KEY) return
      const fresh = readText()
      if (fresh !== undefined) setText(fresh)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const write = useCallback((plan: NetworkPlan) => {
    const next = JSON.stringify(plan)
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, next)
    } catch {
      // Private mode or a full quota: the planner keeps working without persistence.
    }
    latest.current = next
    setText(next)
  }, [])

  const update = useCallback(
    (change: (current: NetworkPlan) => NetworkPlan) => {
      const fresh = readText()
      const current = fresh === undefined ? latest.current : fresh
      const read = readStoredPlan(current)
      if (!read.ok) {
        setText(current)
        return
      }
      let next: NetworkPlan
      try {
        next = change(read.plan)
      } catch (error) {
        if (!(error instanceof PlanConflictError)) throw error
        // What the other writer stored stays, and the planner shows it.
        setConflict(error.message)
        setText(current)
        return
      }
      // Nothing changed: the stored text stays byte for byte as it is, and a conflict being shown stays shown.
      if (JSON.stringify(next) === JSON.stringify(read.plan)) {
        setText(current)
        return
      }
      setConflict(undefined)
      write(next)
    },
    [write],
  )

  const read = useMemo(() => readStoredPlan(text), [text])
  return read.ok
    ? { plan: read.plan, update, replace: write, conflict }
    : { plan: EMPTY_PLAN, refusal: read.reason, update, replace: write, conflict }
}

const COLLECTIONS = ['vlans', 'switches', 'links', 'ports'] as const
// Nothing points at a link or a port, so one that clashes with another writer's can take a free id; a VLAN or a
// switch that clashes refuses the edit (see sameIdConflict).
const FREE_ID_PREFIX: Partial<Record<(typeof COLLECTIONS)[number], string>> = { links: 'ln', ports: 'pt' }

const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)

/**
 * Why an item the edit adds cannot take the id another writer gave to its own item meanwhile. A VLAN id is the VLAN
 * itself and links and ports point at a switch id, so neither can take a free id: the edit is refused instead.
 */
function sameIdConflict(item: { id: string | number; name?: unknown }): PlanConflictError {
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : String(item.id)
  const what = typeof item.id === 'number' ? `la VLAN ${item.id} (${name})` : `el switch ${name}`
  const kept = typeof item.id === 'number' ? 'esa' : 'ese'
  return new PlanConflictError(
    `En otra pestaña se ha añadido ${what} mientras escribías aquí: se queda ${kept} y tu cambio no se ha guardado.`,
  )
}

/**
 * The items of `current` with only what the edit from `base` to `next` changed: items it removed go, items it
 * changed or added take their edited form, and items it did not touch stay as `current` has them (another writer
 * may have changed or removed them). When the edit reorders the items, its order wins and the items another writer
 * added go last; otherwise `current`'s order stays and the edit's new items go last.
 */
function rebaseList<T extends { id: string | number }>(base: T[], next: T[], current: T[], prefix?: string): T[] {
  if (same(base, next)) return current
  const baseById = new Map(base.map((item) => [item.id, item]))
  const nextById = new Map(next.map((item) => [item.id, item]))
  const currentIds = new Set(current.map((item) => item.id))
  const touched = (item: T) => !baseById.has(item.id) || !same(baseById.get(item.id), item)

  // A new item whose id another writer took meanwhile gets a free one, so neither replaces the other.
  const taken = [...new Set([...current, ...next].map((item) => String(item.id)))].map((id) => ({ id }))
  const added = next
    .filter((item) => !baseById.has(item.id))
    .map((item) => {
      const theirs = currentIds.has(item.id) ? current.find((own) => own.id === item.id) : undefined
      if (theirs === undefined || same(theirs, item)) return item
      if (!prefix) throw sameIdConflict(theirs)
      const id = nextId(prefix, taken)
      taken.push({ id })
      return { ...item, id }
    })
  const addedById = new Map(added.map((item) => [item.id, item]))

  // An item of the current plan the edit saw: removed, in its edited form, or as the current plan has it.
  const fromCurrent = (item: T): T[] => {
    if (!baseById.has(item.id)) return [addedById.get(item.id) ?? item]
    const edited = nextById.get(item.id)
    if (!edited) return []
    return [touched(edited) ? edited : item]
  }
  const sharedOrder = (items: T[]) =>
    items.filter((item) => baseById.has(item.id) && nextById.has(item.id)).map((item) => item.id)
  const fresh = added.filter((item) => !currentIds.has(item.id))
  // The id each item of `next` ends up with (a new one may have been given a free id).
  const finalIds = next.map((item) =>
    baseById.has(item.id) ? item.id : added[next.filter((n) => !baseById.has(n.id)).indexOf(item)]?.id,
  )
  // Each new item goes right before the item that follows it in the edit, so a row whose id is being typed stays in
  // place; one added at the end of the edit goes last, after anything another writer added.
  const placeFresh = (items: T[]): T[] => {
    const out = [...items]
    for (const item of [...fresh].reverse()) {
      const at = finalIds.indexOf(item.id)
      let insertAt = out.length
      for (let i = at + 1; i < finalIds.length; i += 1) {
        const found = out.findIndex((own) => own.id === finalIds[i])
        if (found >= 0) {
          insertAt = found
          break
        }
      }
      out.splice(insertAt, 0, item)
    }
    return out
  }

  if (same(sharedOrder(base), sharedOrder(next))) return placeFresh(current.flatMap(fromCurrent))
  const currentById = new Map(current.map((item) => [item.id, item]))
  const inEditOrder = next.flatMap((item): T[] => {
    if (!baseById.has(item.id)) return []
    if (touched(item)) return [item]
    const own = currentById.get(item.id)
    return own ? [own] : []
  })
  const theirs = current.filter((item) => !baseById.has(item.id)).map((item) => addedById.get(item.id) ?? item)
  return placeFresh([...inEditOrder, ...theirs])
}

/**
 * The plan `current` with only the edit that turned `base` (the plan the planner showed) into `next`: what another
 * writer stored meanwhile, such as a VLAN the map added in another tab, is kept.
 */
export function rebasePlan(base: NetworkPlan, next: NetworkPlan, current: NetworkPlan): NetworkPlan {
  const result: Record<string, unknown> = { ...current }
  for (const key of Object.keys(next)) {
    if ((COLLECTIONS as readonly string[]).includes(key)) continue
    const value = (next as Record<string, unknown>)[key]
    if (!same(value, (base as Record<string, unknown>)[key])) result[key] = value
  }
  for (const key of COLLECTIONS) {
    result[key] = rebaseList<{ id: string | number }>(base[key], next[key], current[key], FREE_ID_PREFIX[key])
  }
  return result as NetworkPlan
}
