import { z } from 'zod'

// The planner document (`switching-manual:plan`), shared by the guides' planner and the map of «Mi infraestructura».
// Every object is loose: a field one of them does not know (written by the other, by a later version or by hand) is
// kept as it is when the plan is read and stored again, never dropped.

export const VLAN_PURPOSES = ['users', 'voice', 'servers', 'guests', 'cameras', 'management', 'iot', 'other'] as const

// Range is checked by validatePlan, so a half-typed ID never makes the stored plan unreadable.
const vlanId = z.number().int()

// Fields stay loose strings: the planner checks them with messages the user can act on (validatePlan),
// while this schema only guards the shape of a stored or imported plan.
export const PlanVlanSchema = z.looseObject({
  id: vlanId,
  name: z.string(),
  purpose: z.enum(VLAN_PURPOSES),
  subnet: z.string().default(''),
})

export const PlanSwitchSchema = z.looseObject({
  id: z.string().min(1),
  /** Id of the device in «Mi infraestructura» this switch is; absent for a switch that only the plan knows. */
  deviceId: z.string().optional(),
  name: z.string(),
  /** Id of a platform of the catalog. */
  platform: z.string(),
  /** Management address with its prefix, such as 192.168.99.2/24. */
  mgmtIp: z.string().default(''),
  gateway: z.string().default(''),
  /** Bridge that holds the ports, for brands that model VLANs on a bridge (MikroTik). */
  bridge: z.string().default(''),
})

const EndpointSchema = z.looseObject({ switch: z.string(), interface: z.string() })

export const PlanLinkSchema = z.looseObject({
  id: z.string().min(1),
  a: EndpointSchema,
  b: EndpointSchema,
  // One value for the whole link, so both ends can never disagree.
  nativeVlan: vlanId.default(1),
})

export const PlanPortSchema = z.looseObject({
  id: z.string().min(1),
  switch: z.string(),
  interface: z.string(),
  vlan: vlanId,
})

export const NetworkPlanSchema = z.looseObject({
  version: z.literal(1),
  vlans: z.array(PlanVlanSchema),
  /** The first switch is the core: the guide starts there and works outwards. */
  switches: z.array(PlanSwitchSchema),
  links: z.array(PlanLinkSchema),
  ports: z.array(PlanPortSchema),
})

export type VlanPurpose = (typeof VLAN_PURPOSES)[number]
export type PlanVlan = z.infer<typeof PlanVlanSchema>
export type PlanSwitch = z.infer<typeof PlanSwitchSchema>
export type PlanLink = z.infer<typeof PlanLinkSchema>
export type PlanPort = z.infer<typeof PlanPortSchema>
export type NetworkPlan = z.infer<typeof NetworkPlanSchema>

export const EMPTY_PLAN: NetworkPlan = { version: 1, vlans: [], switches: [], links: [], ports: [] }

/** Where both the guides' planner and the map keep the plan in this browser. */
export const PLAN_STORAGE_KEY = 'switching-manual:plan'

/** Reads a plan from untrusted JSON (storage or an imported file); null when it does not have the right shape. */
export function parsePlan(value: unknown): NetworkPlan | null {
  const result = NetworkPlanSchema.safeParse(value)
  return result.success ? result.data : null
}

/** Why a stored plan must not be written over: it cannot be read, or a later version wrote it. */
export type StoredPlanRefusal = 'unreadable' | 'newer'

export const STORED_PLAN_REFUSALS: Record<StoredPlanRefusal, string> = {
  unreadable: 'El plan de red guardado en este navegador no se puede leer; no se ha tocado.',
  newer: 'El plan de red guardado en este navegador es de una versión más nueva; no se ha tocado.',
}

/** The plan in the stored text: the empty plan when nothing is stored, a refusal when it must be left alone. */
export function readStoredPlan(
  text: string | null,
): { ok: true; plan: NetworkPlan } | { ok: false; reason: StoredPlanRefusal } {
  if (text === null) return { ok: true, plan: EMPTY_PLAN }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  const version = typeof raw === 'object' && raw !== null ? (raw as { version?: unknown }).version : undefined
  if (typeof version === 'number' && version > 1) return { ok: false, reason: 'newer' }
  const plan = parsePlan(raw)
  return plan ? { ok: true, plan } : { ok: false, reason: 'unreadable' }
}

/** A short id not used yet by any item of the list, such as sw-3. */
export function nextId(prefix: string, items: { id: string }[]): string {
  const taken = new Set(items.map((item) => item.id))
  let number = items.length + 1
  while (taken.has(`${prefix}-${number}`)) number += 1
  return `${prefix}-${number}`
}

/** Switch ids in the order they are configured: breadth-first from the first switch, unreachable ones last. */
export function orderFromCore(plan: NetworkPlan): { order: string[]; parent: Map<string, string> } {
  const known = new Set(plan.switches.map((item) => item.id))
  const parent = new Map<string, string>()
  const [core] = plan.switches
  const order: string[] = []
  if (!core) return { order, parent }

  const seen = new Set([core.id])
  const queue = [core.id]
  while (queue.length > 0) {
    const current = queue.shift() as string
    order.push(current)
    for (const link of plan.links) {
      const peer = link.a.switch === current ? link.b.switch : link.b.switch === current ? link.a.switch : undefined
      if (peer === undefined || seen.has(peer) || !known.has(peer)) continue
      seen.add(peer)
      parent.set(peer, current)
      queue.push(peer)
    }
  }
  for (const item of plan.switches) if (!seen.has(item.id)) order.push(item.id)
  return { order, parent }
}
