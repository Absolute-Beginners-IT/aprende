import { useState } from 'react';
import { content } from '../../content';
import { ReferenceMap } from '../map/ReferenceMap';

const allLayers = new Set(content.referencia.capas.map(c => c.id));

/** Container: picks a scenario and a step, and highlights on the map where to look. */
export function ScenariosPage() {
  const [scenarioId, setScenarioId] = useState(content.escenarios[0]?.id ?? '');
  const [step, setStep] = useState(0);
  const scenario = content.escenarios.find(s => s.id === scenarioId);
  if (!scenario) return <p className="muted">Todavía no hay escenarios.</p>;

  const current = scenario.pasos[step];
  const last = step === scenario.pasos.length - 1;
  const choose = (id: string) => { setScenarioId(id); setStep(0); };

  return (
    <section className="scenarios">
      <div className="layers" role="group" aria-label="Escenarios">
        {content.escenarios.map(s => (
          <button key={s.id} type="button" className="chip" aria-pressed={s.id === scenarioId} onClick={() => choose(s.id)}>{s.titulo}</button>
        ))}
      </div>
      <div className="map-grid">
        <div className="canvas">
          <ReferenceMap model={content.referencia} visibleLayers={allLayers} selectedId={null} onSelect={() => {}} highlighted={new Set(current.nodos)} />
        </div>
        <aside className="detail" aria-live="polite">
          <span className="tag">Síntoma</span>
          <p>{scenario.sintoma}</p>
          <h2>Paso {step + 1} de {scenario.pasos.length}: {current.titulo}</h2>
          <p>{current.texto}</p>
          <div className="row">
            <button type="button" className="chip" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Anterior</button>
            <button type="button" className="chip" disabled={last} onClick={() => setStep(s => s + 1)}>Siguiente</button>
          </div>
          {last && (
            <>
              <h3>Causas típicas</h3>
              <ul>{scenario.causasTipicas.map(c => <li key={c}>{c}</li>)}</ul>
              <h3>Qué te llevas</h3>
              <p>{scenario.aprendizaje}</p>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
