// The «VLAN» field of a link on the map of «Mi infraestructura» is free text, such as "10, 20, 30-32". This reads it
// as a list of VLAN ids, with messages the learner can act on.

const MIN_VLAN = 1
const MAX_VLAN = 4094

export type VlanListResult = { ok: true; ids: number[] } | { ok: false; error: string }

const outOfRange = (id: number) => `La VLAN ${id} no existe: los números de VLAN van del ${MIN_VLAN} al ${MAX_VLAN}.`

/** The VLAN ids of a list such as "10, 20, 30-32", sorted and once each; an empty text is an empty list. */
export function parseVlanList(text: string): VlanListResult {
  const tokens = text
    .replace(/\s*-\s*/g, '-')
    .split(/[\s,;]+/)
    .filter(Boolean)
  const ids = new Set<number>()
  for (const token of tokens) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(token)
    if (!match) {
      return {
        ok: false,
        error: `«${token}» no es un número de VLAN. Escribe números del ${MIN_VLAN} al ${MAX_VLAN} separados por comas, por ejemplo 10, 20, 30-32.`,
      }
    }
    const start = Number(match[1])
    const end = match[2] === undefined ? start : Number(match[2])
    for (const id of [start, end]) if (id < MIN_VLAN || id > MAX_VLAN) return { ok: false, error: outOfRange(id) }
    if (end < start) {
      return {
        ok: false,
        error: `El rango ${start}-${end} está al revés: escribe primero el número menor (${end}-${start}).`,
      }
    }
    for (let id = start; id <= end; id += 1) ids.add(id)
  }
  return { ok: true, ids: [...ids].sort((a, b) => a - b) }
}

/**
 * The VLANs a trunk carries: those of its list on the map when it has a valid, non-empty one, otherwise all of
 * `planVlans`, as before the map had lists. A list that cannot be read changes nothing (validatePlan reports it).
 */
export function trunkVlans(listText: string | undefined, planVlans: number[]): number[] {
  const parsed = listText === undefined ? undefined : parseVlanList(listText)
  return parsed?.ok && parsed.ids.length > 0 ? parsed.ids : planVlans
}
