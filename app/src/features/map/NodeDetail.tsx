import type { ReferenceNode } from '../../domain/types';
import { typeOf } from '../../content';

/** Presentational learning card for the selected piece of infrastructure. */
export function NodeDetail({ node }: { node: ReferenceNode | null }) {
  if (!node) {
    return (
      <aside className="detail" aria-live="polite">
        <h2>Pulsa una pieza del mapa</h2>
        <p className="muted">Verás qué es, qué vigilar, qué alertas crear y qué mantenimiento necesita.</p>
      </aside>
    );
  }
  const t = typeOf(node.tipo);
  return (
    <aside className="detail" aria-live="polite">
      <span className={`tag fam-${t.familia}`}>{t.nombre}</span>
      <h2>{node.nombre}</h2>
      <p>{node.descripcion}</p>
      <h3>Qué es</h3>
      <p>{t.queEs}</p>
      <h3>Para qué sirve</h3>
      <p>{t.paraQue}</p>
      <h3>Si falla</h3>
      <p>{t.siFalla}</p>
      <h3>Errores típicos</h3>
      <ul>{t.errores.map(e => <li key={e}>{e}</li>)}</ul>
      <h3>Qué vigilar</h3>
      <ul>{t.metricas.map(m => <li key={m}>{m}</li>)}</ul>
      <h3>Cómo se recogen los datos</h3>
      <p>{t.metodo}</p>
      <h3>Alertas</h3>
      <ul>{t.alertas.map(a => <li key={a.que}><b>{a.que}</b>: aviso {a.aviso}, crítico {a.critico}. {a.accion}.</li>)}</ul>
      <h3>Mantenimiento</h3>
      <ul>{t.actuaciones.map(a => <li key={a.que}>{a.que} <span className="muted">({a.frecuencia})</span></li>)}</ul>
    </aside>
  );
}
