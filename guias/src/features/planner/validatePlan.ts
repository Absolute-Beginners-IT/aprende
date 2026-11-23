import { unknownListedVlans, vlanGaps } from '@shared/plan/vlanGaps'
import { parseVlanList } from '@shared/plan/vlanList'
import type { Catalog } from '../../domain/buildCatalog'
import { inSubnet, type NetworkPlan, orderFromCore } from '../../domain/networkPlan'
import type { Param } from '../../domain/schema'
import { isCidr, isIpv4, validateParam } from '../../domain/validateParam'
import { switchPlatforms } from './inventoryImport'
import { INTERFACE_PARAM_IDS } from './resolveParam'

export type PlanSection = 'vlans' | 'switches' | 'links' | 'ports'

export interface PlanIssue {
  section: PlanSection
  message: string
}

const VLAN_NAME = /^[A-Za-z0-9_-]{1,32}$/
const isVlanId = (id: number) => Number.isInteger(id) && id >= 1 && id <= 4094

/** The param a brand's access-port runbook uses for the port, which carries that brand's naming format. */
export function interfaceParam(catalog: Catalog, platform: string): Param | undefined {
  const procedure = catalog.procedures.find((item) => item.platform === platform && item.task === 'port-access')
  return procedure?.params.find((param) => INTERFACE_PARAM_IDS.includes(param.id))
}

function findRepeated<T>(items: T[]): Set<T> {
  const seen = new Set<T>()
  const repeated = new Set<T>()
  for (const item of items) (seen.has(item) ? repeated : seen).add(item)
  return repeated
}

/** Names as a Spanish list: «A», «A y B», «A, B y C». */
const listOf = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : (names[0] ?? '')

const switchNames = (plan: NetworkPlan) => {
  const switchName = new Map(plan.switches.map((item) => [item.id, item.name.trim() || 'un switch sin nombre']))
  return { switchName, nameOf: (id: string) => switchName.get(id) ?? 'un switch que ya no existe' }
}

/**
 * What the user should know but does not stop the guide: a «VLAN» field on the map of «Mi infraestructura» that
 * cannot be read (the guide then allows every plan VLAN on that trunk, as with no field), that names VLANs the
 * plan does not have, or that leaves out a VLAN with access ports beyond that trunk (a gap, as the map flags it).
 * `linkVlans` holds that field for each link, by link id (see CombinedPlan.mapVlans).
 */
export function planWarnings(plan: NetworkPlan, linkVlans: ReadonlyMap<string, string> = new Map()): PlanIssue[] {
  const { nameOf } = switchNames(plan)
  const unknown = new Map(unknownListedVlans(plan, linkVlans).map((item) => [item.link, item.vlans]))
  const listWarnings = plan.links.flatMap((link) => {
    const field = `El campo VLAN del enlace entre ${nameOf(link.a.switch)} y ${nameOf(link.b.switch)} en Mi infraestructura`
    const list = parseVlanList(linkVlans.get(link.id) ?? '')
    if (!list.ok)
      return [{ section: 'links' as const, message: `${field} no es válido: ${list.error} Corrígelo en el mapa.` }]
    const vlans = unknown.get(link.id)
    if (!vlans) return []
    const named =
      vlans.length > 1
        ? `las VLAN ${vlans.slice(0, -1).join(', ')} y ${vlans[vlans.length - 1]}, que no están en el plan: créalas o quítalas`
        : `la VLAN ${vlans[0]}, que no está en el plan: créala o quítala`
    return [{ section: 'links' as const, message: `${field} deja pasar ${named} de la troncal en el mapa.` }]
  })
  const gapWarnings = vlanGaps(plan, linkVlans).flatMap((gap) => {
    const link = plan.links.find((item) => item.id === gap.link)
    if (!link) return []
    const ports = gap.ports === 1 ? '1 puerto de acceso' : `${gap.ports} puertos de acceso`
    const field = `el campo VLAN del enlace entre ${nameOf(link.a.switch)} y ${nameOf(link.b.switch)} en Mi infraestructura`
    return [
      {
        section: 'links' as const,
        message: `La VLAN ${gap.vlan} no llega a ${listOf(gap.switches.map(nameOf))} (${ports}): ${field} no la deja pasar. Añádela a la troncal en el mapa.`,
      },
    ]
  })
  return [...listWarnings, ...gapWarnings]
}

/**
 * Everything that would make the generated guide wrong, in words the user can act on. What only deserves a warning
 * is in planWarnings.
 */
export function validatePlan(plan: NetworkPlan, catalog: Catalog): PlanIssue[] {
  const issues: PlanIssue[] = []
  const add = (section: PlanSection, message: string) => issues.push({ section, message })
  const { switchName, nameOf } = switchNames(plan)

  // Only a hand-edited file can repeat an id, but a repeated switch id silently drops a switch from the guide.
  const idChecks: [PlanSection, string, { id: string }[]][] = [
    ['switches', 'switches', plan.switches],
    ['links', 'enlaces', plan.links],
    ['ports', 'puertos', plan.ports],
  ]
  for (const [section, noun, items] of idChecks) {
    for (const id of findRepeated(items.map((item) => item.id))) {
      add(section, `El archivo del plan tiene dos ${noun} con el mismo identificador (${id}).`)
    }
  }

  if (plan.vlans.length === 0) add('vlans', 'Añade al menos una VLAN.')
  for (const id of findRepeated(plan.vlans.map((vlan) => vlan.id))) add('vlans', `La VLAN ${id} está repetida.`)
  for (const vlan of plan.vlans) {
    if (!isVlanId(vlan.id)) add('vlans', `La VLAN ${vlan.id} no es válida: el ID va de 1 a 4094.`)
    if (!VLAN_NAME.test(vlan.name)) {
      add(
        'vlans',
        `El nombre de la VLAN ${vlan.id} solo admite letras sin tildes, números, guion y guion bajo (máximo 32).`,
      )
    }
    if (vlan.subnet.trim() && !isCidr(vlan.subnet.trim())) {
      add('vlans', `La red de la VLAN ${vlan.id} tiene que ir con prefijo, por ejemplo 192.168.10.0/24.`)
    }
  }
  const management = plan.vlans.filter((vlan) => vlan.purpose === 'management')
  if (plan.vlans.length > 0 && management.length === 0) add('vlans', 'Marca una VLAN con el propósito Gestión.')
  if (management.length > 1) add('vlans', 'Solo puede haber una VLAN de gestión.')
  const managementSubnet = management.length === 1 ? management[0]?.subnet.trim() : undefined

  if (plan.switches.length === 0) add('switches', 'Añade al menos un switch.')
  for (const name of findRepeated(plan.switches.map((item) => item.name.trim()))) {
    add('switches', `Hay dos switches llamados ${name}.`)
  }
  const addressOwner = new Map<string, string>()
  for (const item of plan.switches) {
    const name = nameOf(item.id)
    if (!switchPlatforms(catalog).some((platform) => platform.id === item.platform)) {
      add('switches', `Elige el modelo de ${name} entre los del manual.`)
    }
    const mgmtIp = item.mgmtIp.trim()
    if (!isCidr(mgmtIp)) {
      add('switches', `La IP de gestión de ${name} tiene que llevar prefijo, por ejemplo 192.168.99.11/24.`)
    } else {
      const address = mgmtIp.split('/')[0] ?? ''
      const owner = addressOwner.get(address)
      if (owner !== undefined) add('switches', `${owner} y ${name} tienen la misma IP de gestión (${address}).`)
      else addressOwner.set(address, name)
      if (managementSubnet && isCidr(managementSubnet) && !inSubnet(address, managementSubnet)) {
        add('switches', `La IP de gestión de ${name} no está en la red de la VLAN de gestión (${managementSubnet}).`)
      }
    }
    if (item.gateway.trim() && !isIpv4(item.gateway.trim())) {
      add('switches', `La puerta de enlace de ${name} no es una IPv4 válida.`)
    }
  }

  const used: { section: PlanSection; switch: string; interface: string }[] = [
    ...plan.links.flatMap((link) => [
      { section: 'links' as const, ...link.a },
      { section: 'links' as const, ...link.b },
    ]),
    ...plan.ports.map((port) => ({ section: 'ports' as const, switch: port.switch, interface: port.interface })),
  ]
  for (const use of used) {
    const owner = plan.switches.find((item) => item.id === use.switch)
    if (!owner) {
      add(use.section, `El puerto ${use.interface} apunta a un switch que ya no existe.`)
      continue
    }
    const param = interfaceParam(catalog, owner.platform)
    const error = param && validateParam(param, use.interface)
    if (error) add(use.section, `Puerto ${use.interface.trim() || '(vacío)'} de ${nameOf(owner.id)}: ${error}`)
  }
  const portKeys = used.map((use) => `${use.switch}\u0000${use.interface.trim()}`)
  for (const key of findRepeated(portKeys)) {
    const [id = '', iface] = key.split('\u0000')
    if (switchName.has(id) && iface) add('ports', `El puerto ${iface} de ${nameOf(id)} está usado dos veces.`)
  }

  const vlanIds = new Set(plan.vlans.map((vlan) => vlan.id))
  for (const link of plan.links) {
    if (link.a.switch === link.b.switch) add('links', `Un enlace no puede unir ${nameOf(link.a.switch)} consigo mismo.`)
    if (!isVlanId(link.nativeVlan)) {
      add(
        'links',
        `La VLAN nativa del enlace entre ${nameOf(link.a.switch)} y ${nameOf(link.b.switch)} tiene que ir de 1 a 4094.`,
      )
    } else if (link.nativeVlan !== 1 && !vlanIds.has(link.nativeVlan)) {
      // VLAN 1 exists on every switch from the factory; any other native VLAN has to be created by the plan.
      add(
        'links',
        `La VLAN nativa ${link.nativeVlan} del enlace entre ${nameOf(link.a.switch)} y ${nameOf(link.b.switch)} no está en el plan: usa la 1 o una VLAN del plan.`,
      )
    }
  }
  for (const port of plan.ports) {
    if (!vlanIds.has(port.vlan)) {
      add(
        'ports',
        `El puerto ${port.interface} de ${nameOf(port.switch)} usa la VLAN ${port.vlan}, que no está en el plan.`,
      )
    }
  }

  const [core] = plan.switches
  if (core) {
    const { parent } = orderFromCore(plan)
    for (const item of plan.switches.slice(1)) {
      if (!parent.has(item.id)) {
        add('links', `${nameOf(item.id)} no tiene enlace con ${nameOf(core.id)}: la VLAN de gestión no le llegaría.`)
      }
    }
  }
  return issues
}
