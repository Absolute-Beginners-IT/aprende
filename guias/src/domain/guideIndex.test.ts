import { catalog } from '../content/catalog'
import { GROUP_LABELS } from '../features/labels'
import { buildGuideIndex, serializeGuideIndex } from './guideIndex'
import { PLATFORM_PATTERNS } from './platformPatterns'

const index = buildGuideIndex(catalog, GROUP_LABELS)

describe('buildGuideIndex', () => {
  it('lists the platforms in catalog order, with the pattern that recognises their models', () => {
    expect(index.plataformas.map((item) => item.id)).toEqual(catalog.platforms.map((item) => item.id))
    expect(index.plataformas[0]).toEqual({
      id: 'aruba-aoscx',
      nombre: 'Aruba CX 6100',
      fabricante: 'HPE Aruba Networking',
      tipo: 'switch',
      patron: PLATFORM_PATTERNS['aruba-aoscx']?.source,
      flags: 'i',
    })
  })

  it('keeps patterns that rebuild into the same matching as the guides', () => {
    const matches = (platform: string, text: string) => {
      const entry = index.plataformas.find((item) => item.id === platform)
      return entry ? new RegExp(entry.patron, entry.flags).test(text) : false
    }

    expect(matches('cisco-c1300', 'Cisco Catalyst 1300-24P')).toBe(true)
    expect(matches('mikrotik-routeros', 'MikroTik CRS317-1G-16S+RM')).toBe(true)
    expect(matches('aruba-aoscx', 'HPE Aruba 2930F')).toBe(false)
  })

  it('names the groups as the guides do, in their fixed order', () => {
    expect(index.grupos).toEqual([
      { id: 'setup-access', nombre: 'Puesta en marcha y acceso' },
      { id: 'vlans-ports', nombre: 'VLANs y puertos' },
      { id: 'monitoring', nombre: 'Monitorización' },
      { id: 'security-resilience', nombre: 'Seguridad y resiliencia' },
    ])
  })

  it('lists every task in catalog order with the platforms that have a runbook for it', () => {
    expect(index.tareas.map((item) => item.id)).toEqual(catalog.concepts.map((item) => item.id))
    expect(index.tareas.find((item) => item.id === 'vlan-create')).toEqual({
      id: 'vlan-create',
      titulo: catalog.concepts.find((item) => item.id === 'vlan-create')?.title,
      grupo: 'vlans-ports',
      plataformas: ['aruba-aoscx', 'cisco-c1300', 'mikrotik-routeros', 'ruijie-reyee'],
    })
    for (const task of index.tareas) {
      const expected = catalog.platforms
        .filter((platform) => catalog.procedures.some((item) => item.platform === platform.id && item.task === task.id))
        .map((platform) => platform.id)
      expect(task.plataformas).toEqual(expected)
    }
  })

  it('fails loudly when a platform has no pattern to recognise its models', () => {
    const extra = { ...catalog, platforms: [...catalog.platforms, { ...catalog.platforms[0], id: 'otra-marca' }] }

    expect(() => buildGuideIndex(extra as typeof catalog, GROUP_LABELS)).toThrow(
      'Platform "otra-marca" has no model pattern in PLATFORM_PATTERNS',
    )
  })
})

describe('content/guias-indice.json', () => {
  // The website's app reads this file instead of importing the guides; it must match the catalog.
  it('is up to date with the catalog', async () => {
    await expect(serializeGuideIndex(index)).toMatchFileSnapshot(
      '../../../content/guias-indice.json',
      'stale guide index: regenerate it with «npm run guide-index» in guias/ and commit the file',
    )
  })
})
