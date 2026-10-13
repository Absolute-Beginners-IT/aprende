import { catalog } from '../../content/catalog'
import { buildSearchIndex } from './searchIndex'

const search = buildSearchIndex(catalog)
const keys = (query: string) => search(query).map((hit) => `${hit.platform}/${hit.task}`)

describe('search index', () => {
  it('returns nothing for a blank query', () => {
    expect(search('   ')).toEqual([])
  })

  it('finds a runbook by task words and narrows it by brand', () => {
    expect(keys('trunk')).toEqual(
      expect.arrayContaining(['aruba-aoscx/port-trunk', 'cisco-c1300/port-trunk', 'mikrotik-routeros/port-trunk']),
    )
    expect(keys('trunk cisco')[0]).toBe('cisco-c1300/port-trunk')
    expect(keys('trunk cisco')).not.toContain('aruba-aoscx/port-trunk')
  })

  it('ignores accents and letter case', () => {
    expect(keys('GESTION aruba')).toContain('aruba-aoscx/mgmt-ip')
    expect(keys('agregacion')).toContain('cisco-c1300/lag-create')
  })

  it('matches while the word is still being typed', () => {
    expect(keys('restau')).toContain('aruba-aoscx/config-restore')
  })

  it('finds a runbook by a command it contains', () => {
    expect(keys('channel-group')).toEqual(['cisco-c1300/lag-create'])
  })

  it('finds runbooks by their task group', () => {
    expect(keys('puesta en marcha mikrotik')).toEqual(
      expect.arrayContaining(['mikrotik-routeros/config-backup', 'mikrotik-routeros/mgmt-ip']),
    )
  })

  it('describes each hit with what the user needs to recognise it', () => {
    const hit = search('poe aruba')[0]

    expect(hit).toEqual({
      platform: 'aruba-aoscx',
      task: 'poe-port',
      title: 'Reiniciar un dispositivo PoE y fijar su prioridad',
      platformName: 'Aruba CX 6100',
      groupLabel: 'VLANs y puertos',
    })
  })
})
