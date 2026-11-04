import { type KeyboardEvent, useEffect, useId, useState } from 'react'
import type { Catalog } from '../../domain/buildCatalog'
import type { NetworkPlan } from '../../domain/networkPlan'
import { buildPlanGuide } from './buildPlanGuide'
import { readInventorySwitches } from './inventoryImport'
import { combineWithInventory, storeCombined } from './inventoryPlan'
import { LinkEditor, PortEditor, SwitchEditor, VlanEditor } from './PlanEditors'
import { PlanGuideView } from './PlanGuideView'
import { PlanTools } from './PlanTools'
import { TopologyDiagram } from './TopologyDiagram'
import { usePlan } from './usePlan'
import { type PlanIssue, type PlanSection, validatePlan } from './validatePlan'

const TABS = [
  { key: 'vlans', title: 'VLAN' },
  { key: 'switches', title: 'Switches' },
  { key: 'links', title: 'Enlaces' },
  { key: 'ports', title: 'Puertos' },
  { key: 'guide', title: 'Guía' },
] as const

type TabKey = (typeof TABS)[number]['key']

const EDITORS = { vlans: VlanEditor, switches: SwitchEditor, links: LinkEditor, ports: PortEditor }
const SECTION_TITLES = Object.fromEntries(TABS.map((tab) => [tab.key, tab.title])) as Record<TabKey, string>

function IssueList({
  issues,
  label,
  onGo,
}: {
  issues: PlanIssue[]
  label: string
  onGo?: (section: PlanSection) => void
}) {
  return (
    <ul className="plan-issues" aria-label={label}>
      {issues.map((issue, index) => (
        <li key={index}>
          {issue.message}
          {onGo && (
            <button type="button" className="link-button" onClick={() => onGo(issue.section)}>
              Ir a {SECTION_TITLES[issue.section]}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

const listNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : (names[0] ?? '')

/** Why some switches of the plan are out of sight, and how to get them back. */
function hiddenNotice(names: string[]): string {
  return names.length === 1
    ? `${names[0]} está en el plan pero no en Mi infraestructura, así que no se muestra. Para recuperarlo con sus enlaces y puertos, añádelo allí con el mismo nombre.`
    : `${listNames(names)} están en el plan pero no en Mi infraestructura, así que no se muestran. Para recuperarlos con sus enlaces y puertos, añádelos allí con el mismo nombre.`
}

/** Describe the network once and get the steps for each switch, in its brand's runbooks. */
export function PlannerPage({ catalog }: { catalog: Catalog }) {
  const baseId = useId()
  const [stored, setStored] = usePlan()
  // With switches in «Mi infraestructura» (same browser), they and their connections come from there.
  const devices = readInventorySwitches()
  const combined = devices.length > 0 ? combineWithInventory(stored, devices, catalog) : undefined
  const plan = combined?.plan ?? stored
  const setPlan = (next: NetworkPlan) => setStored(combined ? storeCombined(stored, next) : next)
  const inventory = combined && { deducedModels: combined.deducedModels }

  // Keeps the stored plan in step with the inventory, so a switch matched by name is then followed by its id.
  const storedText = JSON.stringify(stored)
  const syncedText = combined ? JSON.stringify(storeCombined(stored, combined.plan)) : storedText
  useEffect(() => {
    if (syncedText !== storedText) setStored(JSON.parse(syncedText))
  }, [syncedText, storedText, setStored])

  const [tab, setTab] = useState<TabKey>('vlans')
  const issues = validatePlan(plan, catalog)
  // A plan not started yet is not wrong: the editors stay quiet and only the guide says what is missing.
  const started = plan.vlans.length + plan.switches.length + plan.links.length + plan.ports.length > 0
  const editorIssues = started ? issues : []
  const countFor = (key: TabKey) => editorIssues.filter((issue) => issue.section === key).length

  const onTabKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    const index = TABS.findIndex((item) => item.key === tab)
    const next = TABS[(index + step + TABS.length) % TABS.length]
    if (!next) return
    setTab(next.key)
    document.getElementById(`${baseId}-tab-${next.key}`)?.focus()
  }

  const renderPanel = () => {
    if (tab === 'guide') {
      return issues.length > 0 ? (
        <>
          <p>Corrige estos puntos para ver la guía:</p>
          <IssueList issues={issues} label="Puntos por corregir" onGo={setTab} />
        </>
      ) : (
        <PlanGuideView guides={buildPlanGuide(plan, catalog)} />
      )
    }
    const Editor = EDITORS[tab]
    const own = editorIssues.filter((issue) => issue.section === tab)
    return (
      <>
        {own.length > 0 && <IssueList issues={own} label="Puntos por corregir en esta sección" />}
        <Editor plan={plan} catalog={catalog} onChange={setPlan} inventory={inventory} />
      </>
    )
  }

  return (
    <div className="planner">
      <header className="page-header">
        <h1>Planificador de red</h1>
        <p className="lead">
          Describe tus switches, cómo se conectan y qué VLAN necesitas. El planificador comprueba que todo encaja y te
          da los pasos para cada switch con los comandos de su marca ya rellenos.
        </p>
        <p className="muted">
          El plan se guarda en este navegador. Expórtalo para guardarlo con la documentación de la red.
        </p>
        <PlanTools plan={stored} onChange={setStored} />
        {combined && combined.hidden.length > 0 && (
          <p role="status" className="plan-inventory__status">
            {hiddenNotice(combined.hidden)}
          </p>
        )}
      </header>

      {plan.switches.length > 0 && (
        <section className="plan-map" aria-label="Mapa">
          <TopologyDiagram plan={plan} catalog={catalog} />
        </section>
      )}

      <div className="plan-tabs" role="tablist" aria-label="Partes del plan">
        {TABS.map((item) => {
          const count = item.key === 'guide' ? 0 : countFor(item.key)
          return (
            <button
              key={item.key}
              id={`${baseId}-tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              aria-controls={`${baseId}-panel`}
              aria-label={count > 0 ? `${item.title} (${count} por corregir)` : undefined}
              tabIndex={tab === item.key ? 0 : -1}
              onClick={() => setTab(item.key)}
              onKeyDown={onTabKeyDown}
            >
              {item.title}
              {count > 0 && <span className="plan-tabs__count">{count}</span>}
            </button>
          )
        })}
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`} className="plan-panel">
        {renderPanel()}
      </div>
    </div>
  )
}
