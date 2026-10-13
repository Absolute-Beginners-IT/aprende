import { findUndeclaredParams, ProcedureSchema } from './schema'

const validProcedure = () => ({
  platform: 'aruba-aoscx',
  task: 'vlan-create',
  summary: 'Crea una VLAN.',
  risk: { level: 'low', reason: 'No afecta al tráfico existente.' },
  params: [{ id: 'vlanId', label: 'ID de VLAN', type: 'vlan-id', example: '20' }],
  preflight: [{ text: 'Guardá la configuración actual.' }],
  steps: [
    {
      title: 'Crear la VLAN',
      commands: ['vlan {{vlanId}}'],
      explanation: 'Crea la VLAN y entra en su contexto.',
    },
  ],
  verification: [{ command: 'show vlan {{vlanId}}', expect: 'La VLAN aparece como up.' }],
  rollback: {
    summary: 'Eliminá la VLAN creada.',
    steps: [{ commands: ['no vlan {{vlanId}}'], explanation: 'Borra la VLAN.' }],
  },
  sources: [{ title: 'Guía oficial', url: 'https://example.com/guide' }],
  status: { level: 'docs-checked', reviewed: '2026-10-13', firmware: '10.13' },
})

describe('ProcedureSchema', () => {
  it('accepts a complete procedure and defaults params to required', () => {
    const procedure = ProcedureSchema.parse(validProcedure())

    expect(procedure.params[0]?.required).toBe(true)
  })

  it.each(['rollback', 'sources', 'risk', 'verification', 'status'])('rejects a procedure without %s', (field) => {
    const procedure: Record<string, unknown> = validProcedure()
    delete procedure[field]

    expect(ProcedureSchema.safeParse(procedure).success).toBe(false)
  })

  it('rejects empty steps, rollback steps and sources', () => {
    expect(ProcedureSchema.safeParse({ ...validProcedure(), steps: [] }).success).toBe(false)
    expect(ProcedureSchema.safeParse({ ...validProcedure(), sources: [] }).success).toBe(false)
    expect(
      ProcedureSchema.safeParse({ ...validProcedure(), rollback: { summary: 'x', steps: [] } }).success,
    ).toBe(false)
  })

  it('rejects an unknown verification status', () => {
    const procedure = { ...validProcedure(), status: { level: 'trusted', reviewed: '2026-10-13', firmware: '10.13' } }

    expect(ProcedureSchema.safeParse(procedure).success).toBe(false)
  })

  it('rejects a choice param without options', () => {
    const procedure = {
      ...validProcedure(),
      params: [{ id: 'mode', label: 'Modo', type: 'choice', example: 'access' }],
    }

    expect(ProcedureSchema.safeParse(procedure).success).toBe(false)
  })
})

describe('findUndeclaredParams', () => {
  it('returns nothing when every placeholder is declared', () => {
    expect(findUndeclaredParams(ProcedureSchema.parse(validProcedure()))).toEqual([])
  })

  it('reports placeholders used in steps, verification, preflight and rollback', () => {
    const base = validProcedure()
    const procedure = ProcedureSchema.parse({
      ...base,
      preflight: [{ text: 'Revisá el puerto.', command: 'show interface {{port}}' }],
      steps: [{ ...base.steps[0], commands: ['vlan {{vlanId}}', 'name {{name}}'] }],
      verification: [{ command: 'show vlan {{vlan}}', expect: 'x' }],
      rollback: { summary: 'x', steps: [{ commands: ['no vlan {{old}}'], explanation: 'x' }] },
    })

    expect(findUndeclaredParams(procedure)).toEqual(['port', 'name', 'vlan', 'old'])
  })
})
