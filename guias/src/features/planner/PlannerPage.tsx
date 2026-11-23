import { STORED_PLAN_REFUSALS } from '@shared/plan/networkPlan'
import { type KeyboardEvent, useEffect, useId, useState } from 'react'
import type { Catalog } from '../../domain/buildCatalog'
import type { NetworkPlan } from '../../domain/networkPlan'
import { buildPlanGuide } from './buildPlanGuide'
import { readInventorySwitches } from './inventoryImport'
import { combineWithInventory, discardHidden, storeCombined, withoutNewSharedNames } from './inventoryPlan'
import { LinkEditor, PortEditor, SwitchEditor, VlanEditor } from './PlanEditors'
import { PlanGuideView } from './PlanGuideView'
import { PlanTools } from './PlanTools'
import { TopologyDiagram } from './TopologyDiagram'
import { rebasePlan, usePlan } from './usePlan'
import { type PlanIssue, type PlanSection, planWarnings, validatePlan } from './validatePlan'

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

/** Why the plan cannot tell two inventory switches apart, and what to do about it. */
function duplicatesNotice(names: string[]): string {
  return names.length === 1
    ? `En Mi infraestructura hay dos switches llamados ${names[0]}. Cambia el nombre de uno allí: el plan no puede saber cuál es cuál.`
    : `En Mi infraestructura hay switches con el mismo nombre (${listNames(names)}). Cambia el nombre de uno de cada pareja allí: el plan no puede saber cuál es cuál.`
}

/** The plan seen through «Mi infraestructura» as both are stored right now; none without inventory switches. */
function combineNow(stored: NetworkPlan, catalog: Catalog) {
  const devices = readInventorySwitches()
  return devices.length > 0 ? combineWithInventory(stored, devices, catalog) : undefined
}

/** The stored plan in step with the inventory, without the new switches of shared names (see withoutNewSharedNames). */
function syncedWithInventory(stored: NetworkPlan, catalog: Catalog): NetworkPlan {
  const combined = combineNow(stored, catalog)
  return combined ? storeCombined(stored, withoutNewSharedNames(stored, combined), combined.mapPorts) : stored
}

/** Describe the network once and get the steps for each switch, in its brand's runbooks. */
export function PlannerPage({ catalog }: { catalog: Catalog }) {
  const baseId = useId()
  const { plan: stored, refusal, update, replace } = usePlan()
  // With switches in «Mi infraestructura» (same browser), they and their connections come from there. A stored plan
  // that must be left alone is not shown, so nothing is combined nor kept in step with it.
  const combined = refusal ? undefined : combineNow(stored, catalog)
  const plan = combined?.plan ?? stored
  // The map may have stored a change meanwhile (in another tab): the edit is applied to the plan stored now, seen
  // through the inventory as it is now, so only what the user changed here is written.
  const setPlan = (next: NetworkPlan) =>
    update((current) => {
      const now = combineNow(current, catalog)
      const edited = rebasePlan(plan, next, now?.plan ?? current)
      return now ? storeCombined(current, edited, now.mapPorts) : edited
    })
  const inventory = combined && { deducedModels: combined.deducedModels, mapPorts: combined.mapPorts }

  // Keeps the stored plan in step with the inventory, so a switch matched by name is then followed by its id. The new
  // switches of inventory switches that share a name are not saved (see withoutNewSharedNames).
  const storedText = JSON.stringify(stored)
  const syncedText = combined
    ? JSON.stringify(storeCombined(stored, withoutNewSharedNames(stored, combined), combined.mapPorts))
    : storedText
  useEffect(() => {
    if (syncedText !== storedText) update((current) => syncedWithInventory(current, catalog))
  }, [syncedText, storedText, update, catalog])

  const [tab, setTab] = useState<TabKey>('vlans')
  const mapVlans = combined?.mapVlans
  const issues = validatePlan(plan, catalog)
  // A warning never hides the guide: an unreadable VLAN list on the map allows every plan VLAN, as no list does.
  const warnings = planWarnings(plan, mapVlans)
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
      return (
        <>
          {warnings.length > 0 && <IssueList issues={warnings} label="Avisos" onGo={setTab} />}
          {issues.length > 0 ? (
            <>
              <p>Corrige estos puntos para ver la guía:</p>
              <IssueList issues={issues} label="Puntos por corregir" onGo={setTab} />
            </>
          ) : (
            <PlanGuideView guides={buildPlanGuide(plan, catalog, mapVlans)} />
          )}
        </>
      )
    }
    const Editor = EDITORS[tab]
    const own = editorIssues.filter((issue) => issue.section === tab)
    const ownWarnings = warnings.filter((warning) => warning.section === tab)
    return (
      <>
        {own.length > 0 && <IssueList issues={own} label="Puntos por corregir en esta sección" />}
        {ownWarnings.length > 0 && <IssueList issues={ownWarnings} label="Avisos" />}
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
        <PlanTools
          plan={stored}
          refusal={refusal}
          onChange={(next) => (refusal ? replace(next) : update(() => next))}
        />
        {refusal && (
          <p role="alert" className="plan-inventory__status">
            {STORED_PLAN_REFUSALS[refusal]} El planificador no lo cambia mientras sea así. Si quieres empezar de nuevo,
            importa un plan o vacía este: lo que tenía guardado se perderá.
          </p>
        )}
        {/* A switch named like two inventory switches is not listed here, nor discarded: it is not missing. */}
        {combined && combined.hidden.length > 0 && (
          <div role="status" className="plan-inventory__status">
            <p>{hiddenNotice(combined.hidden)}</p>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                const names = listNames(combined.hidden)
                if (window.confirm(`¿Quitar ${names} del plan? Se borran también sus enlaces y sus puertos.`)) {
                  update((current) => {
                    const now = combineNow(current, catalog)
                    return now ? discardHidden(current, now.plan, now.duplicates, now.mapPorts) : current
                  })
                }
              }}
            >
              Quitar del plan
            </button>
          </div>
        )}
        {combined && combined.duplicates.length > 0 && (
          <p role="status" className="plan-inventory__status">
            {duplicatesNotice(combined.duplicates)}
          </p>
        )}
      </header>

      {!refusal && plan.switches.length > 0 && (
        <section className="plan-map" aria-label="Mapa">
          <TopologyDiagram plan={plan} catalog={catalog} />
        </section>
      )}

      {!refusal && (
        <>
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
        </>
      )}
    </div>
  )
}
