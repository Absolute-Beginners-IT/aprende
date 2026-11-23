import { type NetworkPlan, orderFromCore, type PlanLink } from './networkPlan'
import { parseVlanList, trunkVlans } from './vlanList'

// Which VLANs reach each switch over the links of the plan, read with the same rule the guides use for the allowed
// VLANs of a trunk (trunkVlans): a gap is a VLAN a switch has access ports in that a link on its way to the core does
// not carry. `linkVlans` is the «VLAN» field of the map for each plan link, by link id (CombinedPlan.mapVlans).

/** VLAN 1 exists on every switch from the factory, so a list may name it although the plan does not. */
const FACTORY_VLAN = 1

/**
 * The VLANs a plan link carries: its list on the map plus its native VLAN when the list is valid and not empty;
 * otherwise every VLAN of the plan, as the guides allow on a trunk with no list.
 */
export function carriedVlans(
  link: PlanLink,
  planVlans: number[],
  linkVlans: ReadonlyMap<string, string> = new Map(),
): Set<number> {
  const listed = trunkVlans(linkVlans.get(link.id), planVlans)
  // trunkVlans hands back `planVlans` itself when the link has no usable list.
  return listed === planVlans ? new Set(planVlans) : new Set([...listed, link.nativeVlan])
}

/** A VLAN that does not get through `link` to reach the access ports of `switches` (plan switch ids, nearest first). */
export interface VlanGap {
  vlan: number
  link: string
  switches: string[]
  /** Access ports in `vlan` of those switches. */
  ports: number
}

/**
 * Every gap of the plan: for each switch with access ports in a VLAN of the plan, each link on its way to the core
 * (the first switch, along the order the guide configures them in, see orderFromCore) that does not carry that VLAN.
 * One entry per link and VLAN, in the order of the links and then of the VLANs.
 */
export function vlanGaps(plan: NetworkPlan, linkVlans: ReadonlyMap<string, string> = new Map()): VlanGap[] {
  const planVlans = plan.vlans.map((vlan) => vlan.id)
  const known = new Set(planVlans)
  const { parent } = orderFromCore(plan)
  const linkBetween = (x: string, y: string) =>
    plan.links.find(
      (link) => (link.a.switch === x && link.b.switch === y) || (link.a.switch === y && link.b.switch === x),
    )
  const found = new Map<string, VlanGap>()
  for (const item of plan.switches) {
    const counts = new Map<number, number>()
    for (const port of plan.ports) {
      if (port.switch === item.id && known.has(port.vlan)) counts.set(port.vlan, (counts.get(port.vlan) ?? 0) + 1)
    }
    for (const [vlan, ports] of counts) {
      for (let current = item.id, up = parent.get(current); up !== undefined; current = up, up = parent.get(up)) {
        const link = linkBetween(current, up)
        if (!link || carriedVlans(link, planVlans, linkVlans).has(vlan)) continue
        const key = `${link.id}\u0000${vlan}`
        const gap = found.get(key) ?? { vlan, link: link.id, switches: [], ports: 0 }
        gap.switches.push(item.id)
        gap.ports += ports
        found.set(key, gap)
      }
    }
  }
  const linkOrder = new Map(plan.links.map((link, index) => [link.id, index]))
  return [...found.values()].sort(
    (x, y) => (linkOrder.get(x.link) ?? 0) - (linkOrder.get(y.link) ?? 0) || x.vlan - y.vlan,
  )
}

/** The VLANs a link's list on the map names that the plan does not have (VLAN 1 aside), by plan link, in link order. */
export function unknownListedVlans(
  plan: NetworkPlan,
  linkVlans: ReadonlyMap<string, string> = new Map(),
): { link: string; vlans: number[] }[] {
  const known = new Set(plan.vlans.map((vlan) => vlan.id))
  return plan.links.flatMap((link) => {
    const list = parseVlanList(linkVlans.get(link.id) ?? '')
    const vlans = list.ok ? list.ids.filter((id) => id !== FACTORY_VLAN && !known.has(id)) : []
    return vlans.length > 0 ? [{ link: link.id, vlans }] : []
  })
}

/**
 * Appends `vlan` to a list such as "10, 20-22" in the format parseVlanList reads. The text stays as it was when it
 * already has it, or when it is empty: an empty list carries every VLAN, and adding one would leave out the rest.
 */
export function addToVlanList(text: string, vlan: number): string {
  const list = parseVlanList(text)
  if (!list.ok) throw new Error(list.error)
  if (list.ids.length === 0 || list.ids.includes(vlan)) return text
  return `${text.trim()}, ${vlan}`
}
