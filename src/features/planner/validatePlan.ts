import type { Catalog } from '../../domain/buildCatalog'
import { inSubnet, type NetworkPlan, orderFromCore } from '../../domain/networkPlan'
import type { Param } from '../../domain/schema'
import { isCidr, isIpv4, validateParam } from '../../domain/validateParam'
import { INTERFACE_PARAM_IDS } from './resolveParam'

export type PlanSection = 'vlans' | 'switches' | 'links' | 'ports'

export interface PlanIssue {
  section: PlanSection
  message: string
}

const VLAN_NAME = /^[A-Za-z0-9_-]{1,32}$/

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

/** Everything that would make the generated guide wrong, in words the user can act on. */
export function validatePlan(plan: NetworkPlan, catalog: Catalog): PlanIssue[] {
  const issues: PlanIssue[] = []
  const add = (section: PlanSection, message: string) => issues.push({ section, message })
  const switchName = new Map(plan.switches.map((item) => [item.id, item.name.trim() || 'un switch sin nombre']))
  const nameOf = (id: string) => switchName.get(id) ?? 'un switch que ya no existe'

  if (plan.vlans.length === 0) add('vlans', 'Añade al menos una VLAN.')
  for (const id of findRepeated(plan.vlans.map((vlan) => vlan.id))) add('vlans', `La VLAN ${id} está repetida.`)
  for (const vlan of plan.vlans) {
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
    if (!catalog.platforms.some((platform) => platform.id === item.platform)) {
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

  for (const link of plan.links) {
    if (link.a.switch === link.b.switch) add('links', `Un enlace no puede unir ${nameOf(link.a.switch)} consigo mismo.`)
  }
  const vlanIds = new Set(plan.vlans.map((vlan) => vlan.id))
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
