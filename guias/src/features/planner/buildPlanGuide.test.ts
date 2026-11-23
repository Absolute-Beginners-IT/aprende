import { catalog } from '../../content/catalog'
import { buildPlanGuide, compressVlanList, PLAN_TASKS, type SwitchGuide } from './buildPlanGuide'
import { twoSwitchPlan } from './planFixtures'
import { RESOLVED_PARAM_IDS, USER_PARAM_IDS } from './resolveParam'

const stepSummary = (step: { procedure: { task: string }; values: Record<string, string> }) => [
  step.procedure.task,
  step.values,
]

describe('buildPlanGuide', () => {
  it('orders the switches from the first one outwards', () => {
    const plan = twoSwitchPlan()
    // planta2 is listed before planta1 but hangs from it, so it is configured after it.
    plan.switches.splice(1, 0, {
      id: 'sw-3',
      name: 'planta2',
      platform: 'cisco-c1300',
      mgmtIp: '192.168.99.4/24',
      gateway: '192.168.99.1',
      bridge: '',
    })
    plan.links.push({
      id: 'ln-2',
      a: { switch: 'sw-2', interface: 'gi1/0/47' },
      b: { switch: 'sw-3', interface: 'gi1/0/48' },
      nativeVlan: 1,
    })

    expect(buildPlanGuide(plan, catalog).map((guide) => guide.plannedSwitch.name)).toEqual([
      'nucleo',
      'planta1',
      'planta2',
    ])
  })

  it('configures the link towards the core before the links further out', () => {
    const plan = twoSwitchPlan()
    plan.switches.push({
      id: 'sw-3',
      name: 'planta2',
      platform: 'cisco-c1300',
      mgmtIp: '192.168.99.4/24',
      gateway: '192.168.99.1',
      bridge: '',
    })
    plan.links.unshift({
      id: 'ln-2',
      a: { switch: 'sw-2', interface: 'gi1/0/47' },
      b: { switch: 'sw-3', interface: 'gi1/0/48' },
      nativeVlan: 1,
    })

    const floor = buildPlanGuide(plan, catalog)[1]
    const trunks = floor?.steps.filter((step) => step.procedure.task === 'port-trunk').map((step) => step.title)

    expect(trunks).toEqual(['Enlace con nucleo: gi1/0/48 en trunk', 'Enlace con planta2: gi1/0/47 en trunk'])
  })

  it('builds the steps of the core in a safe order with its values filled', () => {
    const [core] = buildPlanGuide(twoSwitchPlan(), catalog)

    expect(core?.steps.map(stepSummary)).toEqual([
      ['vlan-create', { vlanId: '10', vlanName: 'USUARIOS', checkpointName: 'antes-vlan-10' }],
      ['vlan-create', { vlanId: '20', vlanName: 'VOZ', checkpointName: 'antes-vlan-20' }],
      ['vlan-create', { vlanId: '99', vlanName: 'GESTION', checkpointName: 'antes-vlan-99' }],
      [
        'port-trunk',
        {
          interfaceId: '1/1/49',
          nativeVlanId: '1',
          allowedVlans: '1,10,20,99',
          checkpointName: 'antes-trunk-1-1-49',
          minutes: '10',
        },
      ],
      [
        'mgmt-ip',
        {
          vlanId: '99',
          ipCidr: '192.168.99.2/24',
          gateway: '192.168.99.1',
          checkpointName: 'antes-ip-gestion',
          minutes: '10',
        },
      ],
    ])
  })

  it('maps the values to the param names of each brand and leaves the current state to the user', () => {
    const [, floor] = buildPlanGuide(twoSwitchPlan(), catalog)
    const byTask = (task: string) => floor?.steps.filter((step) => step.procedure.task === task) ?? []

    expect(byTask('port-trunk')[0]?.values).toMatchObject({ interfaceId: 'gi1/0/48', allowedVlans: '1,10,20,99' })
    expect(byTask('mgmt-ip')[0]?.values).toMatchObject({ ipAddress: '192.168.99.3', mask: '255.255.255.0' })
    const [access] = byTask('port-access')
    expect(access?.values).toEqual({ interfaceId: 'gi1/0/5', vlanId: '10' })
    expect(access?.pending.map((param) => param.id)).toEqual(['previousVlanId'])
    expect(access?.title).toBe('Puerto gi1/0/5 en la VLAN 10 (USUARIOS)')
  })

  it('tags the links while creating each VLAN on brands whose VLAN runbook does it', () => {
    const plan = twoSwitchPlan()
    const floor = plan.switches[1]
    const link = plan.links[0]
    if (!floor || !link) throw new Error('fixture')
    floor.platform = 'mikrotik-routeros'
    floor.bridge = 'bridge1'
    link.b.interface = 'sfp-sfpplus1'
    plan.ports = []

    const [, guide] = buildPlanGuide(plan, catalog)

    expect(guide?.steps.map((step) => step.procedure.task)).toEqual([
      'vlan-create',
      'vlan-create',
      'vlan-create',
      'mgmt-ip',
    ])
    expect(guide?.steps[0]?.values).toMatchObject({ bridgeName: 'bridge1', trunkPorts: 'sfp-sfpplus1', vlanId: '10' })
    expect(guide?.notes).toContain(
      'En MikroTik CRS317 los enlaces quedan etiquetados al crear cada VLAN, así que no hay pasos de trunk aparte.',
    )
  })

  describe('VLAN list of the map link', () => {
    const allowedOf = (guide: SwitchGuide | undefined) =>
      guide?.steps.filter((step) => step.procedure.task === 'port-trunk').map((step) => step.values.allowedVlans)

    it('allows only the VLANs written on the map link plus its native VLAN', () => {
      const plan = twoSwitchPlan()
      const link = plan.links[0]
      if (!link) throw new Error('fixture')
      link.nativeVlan = 99

      const [core, floor] = buildPlanGuide(plan, catalog, new Map([['ln-1', '10']]))

      expect(allowedOf(core)).toEqual(['10,99'])
      expect(allowedOf(floor)).toEqual(['10,99'])
    })

    it('allows every plan VLAN, as before, when the map link has no list, an empty one or another link has one', () => {
      const today = buildPlanGuide(twoSwitchPlan(), catalog)

      expect(buildPlanGuide(twoSwitchPlan(), catalog, new Map())).toEqual(today)
      expect(buildPlanGuide(twoSwitchPlan(), catalog, new Map([['ln-1', ' ']]))).toEqual(today)
      expect(buildPlanGuide(twoSwitchPlan(), catalog, new Map([['ln-9', '10']]))).toEqual(today)
      expect(allowedOf(today[0])).toEqual(['1,10,20,99'])
    })

    it('keeps every plan VLAN on a link whose list cannot be read, so the commands never change silently', () => {
      const today = buildPlanGuide(twoSwitchPlan(), catalog)

      expect(buildPlanGuide(twoSwitchPlan(), catalog, new Map([['ln-1', '10, voz']]))).toEqual(today)
    })

    it('tags each link only with the VLANs it carries on brands that tag while creating the VLAN', () => {
      const plan = twoSwitchPlan()
      const floor = plan.switches[1]
      const link = plan.links[0]
      if (!floor || !link) throw new Error('fixture')
      floor.platform = 'mikrotik-routeros'
      floor.bridge = 'bridge1'
      link.b.interface = 'sfp-sfpplus1'
      plan.ports = []

      const [, guide] = buildPlanGuide(plan, catalog, new Map([['ln-1', '10,99']]))
      const trunkPortsOf = (vlanId: string) =>
        guide?.steps.find((step) => step.values.vlanId === vlanId && step.procedure.task === 'vlan-create')?.values
          .trunkPorts

      expect(trunkPortsOf('10')).toBe('sfp-sfpplus1')
      expect(trunkPortsOf('20')).toBeUndefined()
      expect(trunkPortsOf('99')).toBe('sfp-sfpplus1')

      // The native VLAN travels on the trunk even when the list on the map leaves it out, as on the other brands.
      link.nativeVlan = 99
      const [, withoutNative] = buildPlanGuide(plan, catalog, new Map([['ln-1', '10']]))
      expect(
        withoutNative?.steps.find((step) => step.values.vlanId === '99' && step.procedure.task === 'vlan-create')
          ?.values.trunkPorts,
      ).toBe('sfp-sfpplus1')
    })
  })

  it('never fills a value that the runbook would reject', () => {
    const plan = twoSwitchPlan()
    const core = plan.switches[0]
    if (!core) throw new Error('fixture')
    core.gateway = '192.168.99'

    const [guide] = buildPlanGuide(plan, catalog)
    const mgmt = guide?.steps.find((step) => step.procedure.task === 'mgmt-ip')

    expect(mgmt?.values.gateway).toBeUndefined()
    expect(mgmt?.pending.map((param) => param.id)).toContain('gateway')
  })

  it('explains that a model outside the manual gets no steps', () => {
    const plan = twoSwitchPlan()
    const floor = plan.switches[1]
    if (!floor) throw new Error('fixture')
    floor.platform = 'otro'

    const [, guide] = buildPlanGuide(plan, catalog)

    expect(guide?.steps).toEqual([])
    expect(guide?.notes).toEqual(['Este modelo no está en el manual, así que no hay pasos para él.'])
  })
})

describe('compressVlanList', () => {
  it('joins consecutive IDs into ranges', () => {
    expect(compressVlanList([30, 1, 31, 32, 20, 20])).toBe('1,20,30-32')
  })
})

describe('runbook params used by the planner', () => {
  it('are all either filled by the planner or left to the user on purpose', () => {
    const known = new Set([...RESOLVED_PARAM_IDS, ...USER_PARAM_IDS])
    const unknown = catalog.procedures
      .filter((procedure) => PLAN_TASKS.includes(procedure.task))
      .flatMap((procedure) => procedure.params.map((param) => `${procedure.platform}/${procedure.task}:${param.id}`))
      .filter((key) => !known.has(key.split(':')[1] ?? ''))

    expect(unknown).toEqual([])
  })
})
