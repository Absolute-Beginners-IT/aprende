import { catalog } from './catalog'

// Validation itself happens while the catalog is built; these checks pin what the manual must contain.
describe('content catalog', () => {
  it('loads without schema or reference errors', () => {
    expect(catalog.platforms.length).toBeGreaterThan(0)
    expect(catalog.concepts.length).toBeGreaterThan(0)
    expect(catalog.procedures.length).toBeGreaterThan(0)
  })

  it('covers the three platforms used at the company', () => {
    const ids = catalog.platforms.map((item) => item.id)

    expect(new Set(ids)).toEqual(new Set(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros']))
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

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros'])('includes the VLAN creation runbook for %s', (platform) => {
    const runbook = catalog.procedures.find((item) => item.platform === platform && item.task === 'vlan-create')

    expect(runbook).toBeDefined()
  })

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros'])(
    'has access port and trunk port runbooks for %s',
    (platform) => {
      const tasks = catalog.procedures.filter((item) => item.platform === platform).map((item) => item.task)

      expect(tasks).toEqual(expect.arrayContaining(['port-access', 'port-trunk']))
    },
  )

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros'])('has a link aggregation runbook for %s', (platform) => {
    const runbook = catalog.procedures.find((item) => item.platform === platform && item.task === 'lag-create')

    expect(runbook?.risk.level).toBe('high')
  })

  it('has a PoE runbook only for the platforms that supply PoE', () => {
    const platforms = catalog.procedures.filter((item) => item.task === 'poe-port').map((item) => item.platform)

    expect(new Set(platforms)).toEqual(new Set(['aruba-aoscx', 'cisco-c1300']))
  })

  it('never rates a trunk change as low risk, since a trunk carries several VLANs at once', () => {
    const trunks = catalog.procedures.filter((item) => item.task === 'port-trunk')

    expect(trunks.filter((item) => item.risk.level === 'low')).toEqual([])
  })

  it('never marks a runbook as lab-tested without a note saying where it was tested', () => {
    const untraceable = catalog.procedures.filter((item) => item.status.level === 'lab-tested' && !item.status.notes)

    expect(untraceable).toEqual([])
  })
})
