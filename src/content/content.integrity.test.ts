import { catalog } from './catalog'

// Validation itself happens while the catalog is built; these checks pin what the manual must contain.
describe('content catalog', () => {
  it('loads without schema or reference errors', () => {
    expect(catalog.platforms.length).toBeGreaterThan(0)
    expect(catalog.concepts.length).toBeGreaterThan(0)
    expect(catalog.procedures.length).toBeGreaterThan(0)
  })

  it('includes the VLAN creation runbook for Aruba AOS-CX', () => {
    const runbook = catalog.procedures.find((item) => item.platform === 'aruba-aoscx' && item.task === 'vlan-create')

    expect(runbook).toBeDefined()
  })

  it('covers the three platforms used at the company', () => {
    expect(catalog.platforms.map((item) => item.id)).toEqual(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros'])
  })

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros'])(
    'has config backup and restore runbooks for %s, since every rollback relies on them',
    (platform) => {
      const tasks = catalog.procedures.filter((item) => item.platform === platform).map((item) => item.task)

      expect(tasks).toEqual(expect.arrayContaining(['config-backup', 'config-restore']))
    },
  )

  it('rates every restore runbook as high risk', () => {
    const restores = catalog.procedures.filter((item) => item.task === 'config-restore')

    expect(restores.map((item) => item.risk.level)).toEqual(restores.map(() => 'high'))
  })

  it('includes the VLAN creation runbook for Cisco C1300', () => {
    const runbook = catalog.procedures.find((item) => item.platform === 'cisco-c1300' && item.task === 'vlan-create')

    expect(runbook).toBeDefined()
  })

  it('never marks a runbook as lab-tested without a note saying where it was tested', () => {
    const untraceable = catalog.procedures.filter((item) => item.status.level === 'lab-tested' && !item.status.notes)

    expect(untraceable).toEqual([])
  })
})
