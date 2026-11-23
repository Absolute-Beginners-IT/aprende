import { catalog } from '../../content/catalog'
import type { NetworkPlan } from '../../domain/networkPlan'
import { twoSwitchPlan } from './planFixtures'
import { planWarnings, validatePlan } from './validatePlan'

const threeSwitchPlan = (): NetworkPlan => {
  const plan = twoSwitchPlan()
  plan.switches.push({
    ...(plan.switches[1] as NetworkPlan['switches'][number]),
    id: 'sw-3',
    name: 'planta2',
    mgmtIp: '192.168.99.4/24',
  })
  plan.links.push({
    id: 'ln-2',
    a: { switch: 'sw-2', interface: 'gi1/0/47' },
    b: { switch: 'sw-3', interface: 'gi1/0/48' },
    nativeVlan: 1,
  })
  plan.ports.push({ id: 'pt-3', switch: 'sw-3', interface: 'gi1/0/5', vlan: 10 })
  return plan
}

describe('planWarnings VLAN gaps', () => {
  it('no gap for no list, empty list, whitespace list, invalid list', () => {
    const plan = twoSwitchPlan()
    expect(planWarnings(plan)).toEqual([])
    expect(planWarnings(plan, new Map([['ln-1', '']]))).toEqual([])
    expect(planWarnings(plan, new Map([['ln-1', '   ']]))).toEqual([])
    const invalid = planWarnings(plan, new Map([['ln-1', 'todas']]))
    expect(invalid).toHaveLength(1)
    expect(invalid[0]?.message).toMatch(/no es válido/)
  })

  it('native VLAN counts as carried', () => {
    const plan = twoSwitchPlan()
    const link = plan.links[0] as NetworkPlan['links'][number]
    link.nativeVlan = 10
    expect(planWarnings(plan, new Map([['ln-1', '20']]))).toEqual([])
  })

  it('unknown-VLAN warning and gap warning both appear, list warnings first', () => {
    const msgs = planWarnings(twoSwitchPlan(), new Map([['ln-1', '20, 50']])).map((w) => w.message)
    expect(msgs).toEqual([
      'El campo VLAN del enlace entre nucleo y planta1 en Mi infraestructura deja pasar la VLAN 50, que no está en el plan: créala o quítala de la troncal en el mapa.',
      'La VLAN 10 no llega a planta1 (1 puerto de acceso): el campo VLAN del enlace entre nucleo y planta1 en Mi infraestructura no la deja pasar. Añádela a la troncal en el mapa.',
    ])
  })

  it('a gap two hops away names both switches with «y»', () => {
    const msgs = planWarnings(threeSwitchPlan(), new Map([['ln-1', '20']])).map((w) => w.message)
    expect(msgs).toEqual([
      'La VLAN 10 no llega a planta1 y planta2 (2 puertos de acceso): el campo VLAN del enlace entre nucleo y planta1 en Mi infraestructura no la deja pasar. Añádela a la troncal en el mapa.',
    ])
  })

  it('gap warnings are warnings, not validatePlan errors', () => {
    const plan = twoSwitchPlan()
    expect(validatePlan(plan, catalog)).toEqual([])
  })
})
