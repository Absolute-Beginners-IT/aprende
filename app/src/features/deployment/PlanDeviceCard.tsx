import { useId } from 'react';
import { planStepIds, type PlanDevice, type PlanStep } from '../../domain/deploymentPlan';
import { GuideNote } from '../inventory/GuideNote';

/** Steps with a box to tick each one; a guide step is its link, and the box is named after it. */
function StepList({ steps, done, onToggle }: { steps: PlanStep[]; done: Set<string>; onToggle: (stepId: string) => void }) {
  const base = useId();
  return (
    <ul className="plan-steps">
      {steps.map((s, i) => {
        const boxId = `${base}-${i}`, textId = `${boxId}-texto`;
        return (
          <li key={s.id}>
            <input type="checkbox" id={boxId} checked={done.has(s.id)} onChange={() => onToggle(s.id)} aria-labelledby={s.href ? textId : undefined} />
            {s.href ? <a id={textId} href={s.href}>{s.texto}</a> : <label htmlFor={boxId}>{s.texto}</label>}
            {s.detalles.map(d => <span key={d} className="plan-step__detail muted">{d}</span>)}
          </li>
        );
      })}
    </ul>
  );
}

/** One device of the plan: what it is and hangs from, and its three columns of steps. */
export function PlanDeviceCard({ device, done, onToggle }: { device: PlanDevice; done: Set<string>; onToggle: (stepId: string) => void }) {
  const titleId = useId();
  const ids = planStepIds(device);
  const description = [device.tipoNombre, device.marcaModelo, device.cuelgaDe.length ? `cuelga de ${device.cuelgaDe.join(', ')}` : ''].filter(Boolean).join(' · ');
  return (
    <article className="card plan-device" aria-labelledby={titleId}>
      <header className="plan-device__head">
        <h3 id={titleId}><span className="plan-device__num">{device.numero}.</span> {device.nombre}</h3>
        <span className="plan-device__count muted">{ids.filter(id => done.has(id)).length} de {ids.length} hechos</span>
        <p className="muted">{description}</p>
      </header>
      <div className="plan-columns">
        <section>
          <h4>Configurar</h4>
          {device.guias.estado === 'cubierto' && <p className="muted">Guías para tu {device.guias.plataforma.nombre}, en orden de montaje y con sus datos ya puestos:</p>}
          {device.configurar.length > 0 ? <StepList steps={device.configurar} done={done} onToggle={onToggle} /> : <GuideNote guides={device.guias} />}
        </section>
        <section><h4>Vigilar</h4><StepList steps={device.vigilar} done={done} onToggle={onToggle} /></section>
        <section><h4>Mantener</h4><StepList steps={device.mantener} done={done} onToggle={onToggle} /></section>
      </div>
    </article>
  );
}
