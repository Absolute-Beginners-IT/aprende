import type { StoredPlanRefusal } from '@shared/plan/networkPlan'
import { type ChangeEvent, useState } from 'react'
import { EMPTY_PLAN, type NetworkPlan } from '../../domain/networkPlan'
import { parsePlan } from './usePlan'

const isEmpty = (plan: NetworkPlan) =>
  plan.vlans.length + plan.switches.length + plan.links.length + plan.ports.length === 0

const localDate = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part) => String(part).padStart(2, '0')).join('-')

function download(plan: NetworkPlan) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `plan-de-red_${localDate(new Date())}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function readJson(file: File): Promise<unknown> {
  try {
    return JSON.parse(await file.text())
  } catch {
    return null
  }
}

// Said before replacing a stored plan the planner cannot show: what it holds is lost for good.
const REFUSED_PLAN: Record<StoredPlanRefusal, string> = {
  unreadable: 'El plan guardado en este navegador no se puede leer.',
  newer: 'El plan guardado en este navegador es de una versión más nueva.',
}

/**
 * Save the plan next to the company's documentation, bring it back, or start again. While the stored plan cannot be
 * shown (`refusal`), there is nothing to export, and importing or emptying asks first, saying that it will be lost.
 */
export function PlanTools({
  plan,
  refusal,
  onChange,
}: {
  plan: NetworkPlan
  refusal?: StoredPlanRefusal
  onChange: (plan: NetworkPlan) => void
}) {
  const [importError, setImportError] = useState(false)
  const replaceAllowed = (message: string, lost: string) =>
    refusal ? window.confirm(`${REFUSED_PLAN[refusal]} ${lost} ¿Continuar?`) : isEmpty(plan) || window.confirm(message)

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const imported = parsePlan(await readJson(file))
    // Cleared so choosing the same file again fires another change.
    input.value = ''
    setImportError(imported === null)
    const lost = 'Se va a sustituir por el del archivo y lo que tenía se perderá.'
    if (imported && replaceAllowed('Se va a sustituir el plan actual por el del archivo. ¿Continuar?', lost))
      onChange(imported)
  }

  return (
    <div className="plan-tools">
      <button type="button" className="plan-add" disabled={refusal !== undefined} onClick={() => download(plan)}>
        Exportar plan
      </button>
      <label className="plan-add plan-tools__import">
        Importar plan
        <input type="file" accept="application/json,.json" className="visually-hidden" onChange={onImport} />
      </label>
      <button
        type="button"
        className="link-button"
        disabled={!refusal && isEmpty(plan)}
        onClick={() =>
          replaceAllowed('Se va a borrar el plan actual. ¿Continuar?', 'Se va a borrar y lo que tenía se perderá.') &&
          onChange(EMPTY_PLAN)
        }
      >
        Vaciar plan
      </button>
      {importError && (
        <p className="field__error" role="alert">
          Ese archivo no es un plan de red válido.
        </p>
      )}
    </div>
  )
}
