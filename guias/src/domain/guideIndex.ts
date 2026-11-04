import type { Catalog } from './buildCatalog'
import { PLATFORM_PATTERNS } from './platformPatterns'
import { type DeviceType, TASK_GROUPS, type TaskGroup } from './schema'

/**
 * What the website's app knows about the guides (content/guias-indice.json), so it can link a device to its
 * runbooks without importing the catalog. Keys are in Spanish, like the rest of the app's content.
 */
export interface GuideIndex {
  plataformas: { id: string; nombre: string; fabricante: string; tipo: DeviceType; patron: string; flags: string }[]
  grupos: { id: TaskGroup; nombre: string }[]
  tareas: { id: string; titulo: string; grupo: TaskGroup; plataformas: string[] }[]
}

export function buildGuideIndex(catalog: Catalog, groupLabels: Record<TaskGroup, string>): GuideIndex {
  const plataformas = catalog.platforms.map((platform) => {
    const pattern = PLATFORM_PATTERNS[platform.id]
    if (!pattern) throw new Error(`Platform "${platform.id}" has no model pattern in PLATFORM_PATTERNS`)
    return {
      id: platform.id,
      nombre: platform.name,
      fabricante: platform.vendor,
      tipo: platform.deviceType,
      patron: pattern.source,
      flags: pattern.flags,
    }
  })

  const tareas = catalog.concepts.map((concept) => ({
    id: concept.id,
    titulo: concept.title,
    grupo: concept.group,
    plataformas: catalog.platforms
      .filter((platform) =>
        catalog.procedures.some((item) => item.platform === platform.id && item.task === concept.id),
      )
      .map((platform) => platform.id),
  }))

  return { plataformas, grupos: TASK_GROUPS.map((id) => ({ id, nombre: groupLabels[id] })), tareas }
}

/** The file's exact text: two-space JSON with a trailing newline. */
export const serializeGuideIndex = (index: GuideIndex) => `${JSON.stringify(index, null, 2)}\n`
