import { useMemo, useState } from 'react';
import type { InventoryRepository } from '../../ports/InventoryRepository';
import { deploymentPlan, planStepIds } from '../../domain/deploymentPlan';
import { content } from '../../content';
import { GUIDES_URL } from '../../config';
import { errorText, useInventory } from '../inventory/useInventory';
import { doneSteps, readProgress, writeProgress, type Progress } from './deploymentProgress';
import { PlanDeviceCard } from './PlanDeviceCard';

/** Container for the deployment plan: the plan is worked out from the inventory, the progress kept in browser storage. */
export function DeploymentPlanPage({ repository, storage }: { repository: InventoryRepository; storage: Pick<Storage, 'getItem' | 'setItem'> }) {
  const { devices, loaded, message: inventoryMessage } = useInventory(repository);
  const [progress, setProgress] = useState<Progress>(() => readProgress(storage));
  const [message, setMessage] = useState('');
  const plan = useMemo(() => deploymentPlan(devices, content, GUIDES_URL), [devices]);

  // Saved steps of devices no longer in the inventory, or of steps the plan no longer has, are not counted.
  const doneOf = (deviceId: string) => new Set(doneSteps(progress, deviceId));
  const total = plan.reduce((sum, d) => sum + planStepIds(d).length, 0);
  const done = plan.reduce((sum, d) => sum + planStepIds(d).filter(id => doneOf(d.id).has(id)).length, 0);

  // The box only changes once the browser has kept the change, so what is ticked is always what is saved.
  const toggle = (deviceId: string, stepId: string) => {
    const current = doneSteps(progress, deviceId);
    const next = { ...progress, [deviceId]: current.includes(stepId) ? current.filter(id => id !== stepId) : [...current, stepId] };
    try { writeProgress(storage, next); setProgress(next); setMessage(''); }
    catch (e) { setMessage(`No se ha podido guardar el progreso en este navegador: ${errorText(e)}`); }
  };

  const status = message || inventoryMessage;
  return (
    <section className="deployment" aria-label="Plan de despliegue">
      <div className="plan-toolbar">
        <h2>Plan de despliegue</h2>
        {plan.length > 0 && <button type="button" className="chip" onClick={() => window.print()}>Imprimir</button>}
      </div>
      <p className="muted">Monta tus equipos en este orden, del borde de la red hacia dentro: primero los que no cuelgan de ningún otro y después los que cuelgan de ellos; entre iguales, los más críticos antes. Para cada uno tienes qué configurar, qué vigilar y qué mantener. Marca cada paso cuando lo hayas hecho.</p>
      <p className="notice">Lo que marcas como hecho se guarda <b>solo en este navegador</b>, igual que tu inventario.</p>
      {status && <p className="muted" role="status">{status}</p>}
      {loaded && plan.length === 0 && (
        <div className="card plan-empty"><p>Todavía no tienes equipos en tu plan. Añádelos en <a href="#mi-infraestructura">Mapa</a> y aquí verás en qué orden montarlos y qué configurar, vigilar y mantener en cada uno.</p></div>
      )}
      {plan.length > 0 && <>
        <div className="plan-progress">
          <p>{`${done} de ${total} pasos hechos`}</p>
          <div className="plan-progress__bar" role="progressbar" aria-label="Progreso del plan" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
            <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
        <ol className="plan-devices">
          {plan.map(d => <li key={d.id}><PlanDeviceCard device={d} done={doneOf(d.id)} onToggle={stepId => toggle(d.id, stepId)} /></li>)}
        </ol>
      </>}
    </section>
  );
}
