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

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros'])(
    'has a management IP runbook for %s, rated high risk because it can cut the session in use',
    (platform) => {
      const runbook = catalog.procedures.find((item) => item.platform === platform && item.task === 'mgmt-ip')

      expect(runbook?.risk.level).toBe('high')
    },
  )

  it.each(['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros'])(
    'has admin user, SSH access and firmware upgrade runbooks for %s',
    (platform) => {
      const tasks = catalog.procedures.filter((item) => item.platform === platform).map((item) => item.task)

      expect(tasks).toEqual(expect.arrayContaining(['user-admin', 'ssh-access', 'firmware-upgrade']))
    },
  )

  it('rates every firmware upgrade as high risk, since it reboots the switch', () => {
    const upgrades = catalog.procedures.filter((item) => item.task === 'firmware-upgrade')

    expect(upgrades.map((item) => item.risk.level)).toEqual(upgrades.map(() => 'high'))
  })

  it('never asks for a password as a runbook value, because values are stored in the browser', () => {
    const secretLike = /pass|contrase|secret|clave/i
    const offenders = catalog.procedures.flatMap((item) =>
      item.params
        .filter((param) => secretLike.test(param.id) || secretLike.test(param.label))
        .map((param) => `${item.platform}/${item.task}: ${param.id}`),
    )

    expect(offenders).toEqual([])
  })

  it('does not let the Aruba firmware runbook install over the image kept as fallback', () => {
    const upgrade = catalog.procedures.find(
      (item) => item.platform === 'aruba-aoscx' && item.task === 'firmware-upgrade',
    )
    const target = upgrade?.params.find((param) => param.id === 'targetImage')

    expect(target?.differentFrom?.param).toBe('fallbackImage')
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
