import { parse } from 'yaml'
import type { z } from 'zod'
import {
  type Concept,
  ConceptSchema,
  findUndeclaredParams,
  type Platform,
  PlatformSchema,
  type Procedure,
  ProcedureSchema,
} from './schema'

export interface Catalog {
  platforms: Platform[]
  concepts: Concept[]
  procedures: Procedure[]
}

function parseFile<Schema extends z.ZodType>(path: string, source: string, schema: Schema): z.infer<Schema> {
  const result = schema.safeParse(parse(source))
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    throw new Error(`Invalid content in ${path}\n  ${issues.join('\n  ')}`)
  }
  return result.data
}

function assertIdMatchesFileName(path: string, id: string): void {
  if (!path.endsWith(`/${id}.yaml`)) {
    throw new Error(`Invalid content in ${path}: id "${id}" does not match the file name`)
  }
}

/** Builds the catalog from raw YAML keyed by file path, failing loudly on any inconsistency. */
export function buildCatalog(files: Record<string, string>): Catalog {
  const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
  const inFolder = (folder: string) => entries.filter(([path]) => path.includes(`/content/${folder}/`))

  const platforms = inFolder('platforms').map(([path, source]) => {
    const platform = parseFile(path, source, PlatformSchema)
    assertIdMatchesFileName(path, platform.id)
    return platform
  })

  const concepts = inFolder('concepts').map(([path, source]) => {
    const concept = parseFile(path, source, ConceptSchema)
    assertIdMatchesFileName(path, concept.id)
    return concept
  })

  const platformIds = new Set(platforms.map((platform) => platform.id))
  const conceptIds = new Set(concepts.map((concept) => concept.id))

  const procedures = inFolder('procedures').map(([path, source]) => {
    const procedure = parseFile(path, source, ProcedureSchema)
    const fail = (reason: string): never => {
      throw new Error(`Invalid content in ${path}: ${reason}`)
    }

    if (!platformIds.has(procedure.platform)) fail(`unknown platform "${procedure.platform}"`)
    if (!conceptIds.has(procedure.task)) fail(`unknown task "${procedure.task}"`)

    const expectedPath = `procedures/${procedure.platform}/${procedure.task}.yaml`
    if (!path.endsWith(`/content/${expectedPath}`)) fail(`expected path ${expectedPath}`)

    const undeclared = findUndeclaredParams(procedure)
    if (undeclared.length > 0) fail(`undeclared params: ${undeclared.join(', ')}`)

    return procedure
  })

  return { platforms, concepts, procedures }
}
