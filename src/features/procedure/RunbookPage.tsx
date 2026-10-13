import { extractParamIds, type ParamValues, renderCommand } from '../../domain/renderCommand'
import type { Concept, Platform, Procedure, RiskLevel, StatusLevel } from '../../domain/schema'
import { validateParam } from '../../domain/validateParam'
import { useStoredState } from '../../lib/useStoredState'
import { Badge } from '../../ui/Badge'
import { CommandBlock } from '../../ui/CommandBlock'
import { CopyButton } from '../../ui/CopyButton'
import { Section } from '../../ui/Section'
import { RISK_LABELS, STATUS_LABELS } from '../labels'

interface RunbookPageProps {
  platform: Platform
  concept: Concept
  procedure: Procedure
}

const RISK_TONES: Record<RiskLevel, 'ok' | 'warn' | 'danger'> = { low: 'ok', medium: 'warn', high: 'danger' }
const STATUS_TONES: Record<StatusLevel, 'ok' | 'warn' | 'danger'> = {
  unverified: 'danger',
  'docs-checked': 'warn',
  'lab-tested': 'ok',
}

interface StepCommandsProps {
  manual: boolean
  lines: string[]
  copyLabel: string
  ready: boolean
}

/** A step either runs commands or is done by hand; this is the single place that tells them apart. */
function StepCommands({ manual, lines, copyLabel, ready }: StepCommandsProps) {
  if (manual) return <p className="manual-tag">Acción manual</p>
  return <CommandBlock lines={lines} copyLabel={copyLabel} ready={ready} />
}

export function RunbookPage({ platform, concept, procedure }: RunbookPageProps) {
  const storageKey = `switching-manual:${procedure.platform}/${procedure.task}`
  const [values, setValues] = useStoredState<Record<string, string>>(`${storageKey}:values`, {})
  const [doneSteps, setDoneSteps] = useStoredState<number[]>(`${storageKey}:done`, [])

  const errors = Object.fromEntries(
    procedure.params.map((param) => [param.id, validateParam(param, values[param.id] ?? '')]),
  )
  // Invalid values are treated as unfilled so a wrong command is never shown as runnable.
  const validValues: ParamValues = Object.fromEntries(
    procedure.params.filter((param) => errors[param.id] === null).map((param) => [param.id, values[param.id]]),
  )

  const fill = (template: string) => renderCommand(template, validValues)
  const isReady = (templates: string[]) =>
    templates.flatMap(extractParamIds).every((id) => Boolean(validValues[id]?.trim()))

  const allStepCommands = procedure.steps.flatMap((step) => step.commands)

  const toggleStep = (index: number) =>
    setDoneSteps(doneSteps.includes(index) ? doneSteps.filter((step) => step !== index) : [...doneSteps, index])

  const reset = () => {
    setValues({})
    setDoneSteps([])
  }

  return (
    <article className="runbook">
      <header className="page-header">
        <p className="eyebrow">
          {platform.vendor} · {platform.name} · {platform.os}
        </p>
        <h1>{concept.title}</h1>
        <p className="lead">{procedure.summary}</p>
        <div className="status-line">
          <Badge label={STATUS_LABELS[procedure.status.level]} tone={STATUS_TONES[procedure.status.level]} />
          <span>
            {procedure.status.firmware} · revisada el {procedure.status.reviewed}
          </span>
        </div>
        {procedure.status.notes && <p className="muted">{procedure.status.notes}</p>}
      </header>

      <aside className={`risk risk--${procedure.risk.level}`}>
        <Badge label={RISK_LABELS[procedure.risk.level]} tone={RISK_TONES[procedure.risk.level]} />
        <p>{procedure.risk.reason}</p>
        <ul>
          {concept.risks.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ul>
      </aside>

      <details className="concept">
        <summary>Qué es y para qué sirve</summary>
        <p>{concept.explanation}</p>
        {concept.prerequisites.length > 0 && (
          <ul>
            {concept.prerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </details>

      <Section
        title="Tus datos"
        actions={
          <button type="button" className="link-button" onClick={reset}>
            Limpiar datos y progreso
          </button>
        }
      >
        <form className="params" onSubmit={(event) => event.preventDefault()}>
          {procedure.params.map((param) => {
            const value = values[param.id] ?? ''
            const error = value.trim() === '' ? null : errors[param.id]
            const fieldId = `param-${param.id}`
            const update = (next: string) => setValues({ ...values, [param.id]: next })

            return (
              <div className="field" key={param.id}>
                <label htmlFor={fieldId}>{param.label}</label>
                {param.type === 'choice' ? (
                  <select id={fieldId} value={value} onChange={(event) => update(event.target.value)}>
                    <option value="">Elegí…</option>
                    {param.options?.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={fieldId}
                    value={value}
                    placeholder={`Ej.: ${param.example}`}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={error ? true : undefined}
                    onChange={(event) => update(event.target.value)}
                  />
                )}
                {param.help && <p className="muted">{param.help}</p>}
                {error && (
                  <p className="field__error" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )
          })}
        </form>
      </Section>

      <Section title="Antes de empezar">
        <ol className="checks">
          {procedure.preflight.map((check, index) => (
            <li key={index}>
              <p>{fill(check.text)}</p>
              {check.command && (
                <CommandBlock
                  lines={[fill(check.command)]}
                  copyLabel={`Copiar comprobación ${index + 1}`}
                  ready={isReady([check.command])}
                />
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="Paso a paso"
        actions={
          <CopyButton
            text={allStepCommands.map(fill).join('\n')}
            label="Copiar todos los pasos"
            disabled={!isReady(allStepCommands)}
          >
            Copiar todo
          </CopyButton>
        }
      >
        <ol className="steps">
          {procedure.steps.map((step, index) => (
            <li key={index} className={doneSteps.includes(index) ? 'step step--done' : 'step'}>
              <div className="step__title">
                <input
                  type="checkbox"
                  aria-label={`Hecho: ${step.title}`}
                  checked={doneSteps.includes(index)}
                  onChange={() => toggleStep(index)}
                />
                <h3>{step.title}</h3>
              </div>
              {step.warning && <p className="warning">{fill(step.warning)}</p>}
              <StepCommands
                manual={step.manual}
                lines={step.commands.map(fill)}
                copyLabel={`Copiar: ${step.title}`}
                ready={isReady(step.commands)}
              />
              <p>{fill(step.explanation)}</p>
              {step.breakdown && (
                <dl className="breakdown">
                  {step.breakdown.map((part) => (
                    <div key={part.token}>
                      <dt>
                        <code>{fill(part.token)}</code>
                      </dt>
                      <dd>{fill(part.meaning)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Verificación">
        <ol className="checks">
          {procedure.verification.map((check, index) => (
            <li key={index}>
              <CommandBlock
                lines={[fill(check.command)]}
                copyLabel={`Copiar verificación ${index + 1}`}
                ready={isReady([check.command])}
              />
              <p>
                <strong>Qué deberías ver:</strong> {fill(check.expect)}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Vuelta atrás">
        <p>{fill(procedure.rollback.summary)}</p>
        <ol className="steps">
          {procedure.rollback.steps.map((step, index) => {
            const title = step.title ?? `Paso ${index + 1}`
            return (
              <li key={index} className="step">
                <h3>{title}</h3>
                {step.warning && <p className="warning">{fill(step.warning)}</p>}
                <StepCommands
                  manual={step.manual}
                  lines={step.commands.map(fill)}
                  copyLabel={`Copiar vuelta atrás: ${title}`}
                  ready={isReady(step.commands)}
                />
                <p>{fill(step.explanation)}</p>
              </li>
            )
          })}
        </ol>
        {procedure.rollback.lockoutRecovery && (
          <div className="lockout">
            <h3>Si perdés el acceso al switch</h3>
            <p>{fill(procedure.rollback.lockoutRecovery)}</p>
          </div>
        )}
      </Section>

      <Section title="Fuentes">
        <ul>
          {procedure.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </article>
  )
}
