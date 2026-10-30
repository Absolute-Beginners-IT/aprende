import { useState } from 'react';
import { content } from '../../content';
import { ReferenceMap } from './ReferenceMap';
import { NodeDetail } from './NodeDetail';

/** Container: owns layer visibility and selection, renders the presentational pieces. */
export function MapPage() {
  const model = content.referencia;
  const [visible, setVisible] = useState(() => new Set(model.capas.map(c => c.id)));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggle = (id: string) => setVisible(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <section className="map-page">
      <div className="layers" role="group" aria-label="Capas del mapa">
        {model.capas.map(c => (
          <button key={c.id} type="button" className="chip" aria-pressed={visible.has(c.id)} title={c.descripcion} onClick={() => toggle(c.id)}>
            {c.nombre}
          </button>
        ))}
      </div>
      <div className="map-grid">
        <div className="canvas"><ReferenceMap model={model} visibleLayers={visible} selectedId={selectedId} onSelect={setSelectedId} /></div>
        <NodeDetail node={model.nodos.find(n => n.id === selectedId) ?? null} />
      </div>
    </section>
  );
}
