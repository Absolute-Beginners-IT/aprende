import { parseRoute, runbookHref } from './useHashRoute'

describe('parseRoute', () => {
  it('keeps recognising every page of the manual', () => {
    expect(parseRoute('')).toEqual({ name: 'home' })
    expect(parseRoute('#/')).toEqual({ name: 'home' })
    expect(parseRoute('#/status')).toEqual({ name: 'status' })
    expect(parseRoute('#/plan')).toEqual({ name: 'plan' })
    expect(parseRoute('#/f')).toEqual({ name: 'fundamentals' })
    expect(parseRoute('#/f/que-es-un-switch')).toEqual({ name: 'fundamental', article: 'que-es-un-switch' })
    expect(parseRoute('#/p/aruba-aoscx')).toEqual({ name: 'platform', platform: 'aruba-aoscx' })
    expect(parseRoute('#/p/aruba-aoscx/mgmt-ip')).toEqual({
      name: 'runbook',
      platform: 'aruba-aoscx',
      task: 'mgmt-ip',
    })
    expect(parseRoute('#/p/aruba-aoscx/mgmt-ip/extra')).toEqual({ name: 'not-found' })
    expect(parseRoute('#/otra')).toEqual({ name: 'not-found' })
  })

  it('opens a runbook with the device given in ?equipo=, decoding it', () => {
    expect(parseRoute('#/p/cisco-c1300/mgmt-ip?equipo=sw%20planta%2F1')).toEqual({
      name: 'runbook',
      platform: 'cisco-c1300',
      task: 'mgmt-ip',
      deviceId: 'sw planta/1',
    })
  })

  it('leaves the device out of a runbook route without one', () => {
    expect(parseRoute('#/p/cisco-c1300/mgmt-ip')).not.toHaveProperty('deviceId')
    expect(parseRoute('#/p/cisco-c1300/mgmt-ip?equipo=')).not.toHaveProperty('deviceId')
    expect(parseRoute('#/p/cisco-c1300/mgmt-ip?otra=1')).not.toHaveProperty('deviceId')
  })

  it('ignores any query on the other pages', () => {
    expect(parseRoute('#/plan?equipo=sw-core')).toEqual({ name: 'plan' })
    expect(parseRoute('#/p/aruba-aoscx?equipo=sw-core')).toEqual({ name: 'platform', platform: 'aruba-aoscx' })
    expect(parseRoute('#/?x=1')).toEqual({ name: 'home' })
    // A broken escape must not throw: the runbook still opens, and an unknown device fills nothing.
    expect(parseRoute('#/p/aruba-aoscx/mgmt-ip?equipo=%E0%A4%A')).toMatchObject({
      name: 'runbook',
      platform: 'aruba-aoscx',
      task: 'mgmt-ip',
    })
  })
})

describe('runbookHref', () => {
  it('links a runbook, with the device encoded when there is one', () => {
    expect(runbookHref('aruba-aoscx', 'mgmt-ip')).toBe('#/p/aruba-aoscx/mgmt-ip')
    expect(runbookHref('aruba-aoscx', 'mgmt-ip', 'sw planta/1')).toBe('#/p/aruba-aoscx/mgmt-ip?equipo=sw%20planta%2F1')
  })

  it('round-trips through parseRoute', () => {
    expect(parseRoute(runbookHref('ruijie-reyee', 'mgmt-acl', 'a&b=c?d'))).toEqual({
      name: 'runbook',
      platform: 'ruijie-reyee',
      task: 'mgmt-acl',
      deviceId: 'a&b=c?d',
    })
  })
})
