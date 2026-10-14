import MiniSearch from 'minisearch'
import type { Catalog } from '../../domain/buildCatalog'
import { GROUP_LABELS } from '../labels'

/** What the user needs to recognise a runbook in a list. */
export interface RunbookHit {
  platform: string
  task: string
  title: string
  platformName: string
  groupLabel: string
}

const DIACRITICS = /\p{Diacritic}/gu
// Lets "gestion" find "gestión": people type fast and without accents when they are working.
const normalize = (term: string) => term.toLowerCase().normalize('NFD').replace(DIACRITICS, '')

export function describeRunbook(catalog: Catalog, platformId: string, taskId: string): RunbookHit | undefined {
  const platform = catalog.platforms.find((item) => item.id === platformId)
  const concept = catalog.concepts.find((item) => item.id === taskId)
  const exists = catalog.procedures.some((item) => item.platform === platformId && item.task === taskId)
  if (!platform || !concept || !exists) return undefined

  return {
    platform: platform.id,
    task: concept.id,
    title: concept.title,
    platformName: platform.name,
    groupLabel: GROUP_LABELS[concept.group],
  }
}

export function buildSearchIndex(catalog: Catalog): (query: string) => RunbookHit[] {
  const hits = new Map<string, RunbookHit>()
  const index = new MiniSearch({
    fields: ['title', 'platform', 'group', 'summary', 'commands'],
    processTerm: normalize,
    searchOptions: { prefix: true, combineWith: 'AND', boost: { title: 3, platform: 2 } },
  })

  for (const procedure of catalog.procedures) {
    const hit = describeRunbook(catalog, procedure.platform, procedure.task)
    const platform = catalog.platforms.find((item) => item.id === procedure.platform)
    if (!hit || !platform) continue

    const id = `${hit.platform}/${hit.task}`
    hits.set(id, hit)
    index.add({
      id,
      title: hit.title,
      platform: `${platform.vendor} ${platform.name} ${platform.os}`,
      group: hit.groupLabel,
      summary: procedure.summary,
      commands: [...procedure.steps, ...procedure.rollback.steps].flatMap((step) => step.commands).join(' '),
    })
  }

  return (query) => {
    if (query.trim() === '') return []
    return index.search(query).flatMap((result) => hits.get(String(result.id)) ?? [])
  }
}
