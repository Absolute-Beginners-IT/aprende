import { z } from 'zod'
import { extractParamIds } from './renderCommand'

const text = z.string().trim().min(1)
const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)

export const TASK_GROUPS = ['setup-access', 'vlans-ports', 'monitoring', 'security-resilience'] as const
export const RISK_LEVELS = ['low', 'medium', 'high'] as const
export const STATUS_LEVELS = ['unverified', 'docs-checked', 'lab-tested'] as const

const SourceSchema = z.object({ title: text, url: z.url() })

const StatusSchema = z.object({
  level: z.enum(STATUS_LEVELS),
  reviewed: z.iso.date(),
  firmware: text,
  notes: text.optional(),
})

export const ParamSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/),
    label: text,
    type: z.enum(['text', 'number', 'vlan-id', 'ipv4', 'cidr', 'choice']),
    example: text,
    help: text.optional(),
    required: z.boolean().default(true),
    options: z.array(text).min(2).optional(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    pattern: text.optional(),
    patternHint: text.optional(),
  })
  .refine((param) => param.type !== 'choice' || param.options !== undefined, {
    message: 'A choice param needs options',
  })

const CommandStepSchema = z.object({
  title: text.optional(),
  commands: z.array(text).min(1),
  explanation: text,
  breakdown: z.array(z.object({ token: text, meaning: text })).optional(),
  warning: text.optional(),
})

export const ProcedureSchema = z.object({
  platform: id,
  task: id,
  summary: text,
  risk: z.object({ level: z.enum(RISK_LEVELS), reason: text }),
  params: z.array(ParamSchema).default([]),
  preflight: z.array(z.object({ text, command: text.optional() })).min(1),
  steps: z.array(CommandStepSchema.extend({ title: text })).min(1),
  verification: z.array(z.object({ command: text, expect: text })).min(1),
  rollback: z.object({
    summary: text,
    steps: z.array(CommandStepSchema).min(1),
    lockoutRecovery: text.optional(),
  }),
  sources: z.array(SourceSchema).min(1),
  status: StatusSchema,
})

export const ConceptSchema = z.object({
  id,
  title: text,
  group: z.enum(TASK_GROUPS),
  summary: text,
  explanation: text,
  risks: z.array(text).min(1),
  prerequisites: z.array(text).default([]),
})

export const PlatformSchema = z.object({
  id,
  vendor: text,
  name: text,
  os: text,
  models: z.array(text).min(1),
  summary: text,
  cliModes: z.array(z.object({ name: text, prompt: text, enter: text, description: text })).min(1),
  configPersistence: text,
  safetyNets: z.array(z.object({ name: text, description: text, commands: z.array(text).optional() })).min(1),
  sources: z.array(SourceSchema).min(1),
  status: StatusSchema,
})

export type Param = z.infer<typeof ParamSchema>
export type Procedure = z.infer<typeof ProcedureSchema>
export type Concept = z.infer<typeof ConceptSchema>
export type Platform = z.infer<typeof PlatformSchema>
export type TaskGroup = (typeof TASK_GROUPS)[number]
export type RiskLevel = (typeof RISK_LEVELS)[number]
export type StatusLevel = (typeof STATUS_LEVELS)[number]

/** Placeholder ids used anywhere in a procedure's commands that no param declares. */
export function findUndeclaredParams(procedure: Procedure): string[] {
  const declared = new Set(procedure.params.map((param) => param.id))
  const templates = [
    ...procedure.preflight.flatMap((check) => (check.command ? [check.command] : [])),
    ...procedure.steps.flatMap((step) => step.commands),
    ...procedure.verification.map((check) => check.command),
    ...procedure.rollback.steps.flatMap((step) => step.commands),
  ]
  const used = new Set(templates.flatMap(extractParamIds))
  return [...used].filter((paramId) => !declared.has(paramId))
}
