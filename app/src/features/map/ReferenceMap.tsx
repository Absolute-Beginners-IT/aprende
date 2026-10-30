import type { ReferenceModel } from '../../domain/types';
import { typeOf } from '../../content';

const CELL_W = 150, CELL_H = 104, NODE_W = 128, NODE_H = 52, PAD = 24;

interface Props {
  model: ReferenceModel;
  visibleLayers: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** When set, every other node is dimmed (used by the incident scenarios). */
  highlighted?: Set<string>;
}

const center = (x: number, y: number) => ({ cx: PAD + x * CELL_W + NODE_W / 2, cy: PAD + y * CELL_H + NODE_H / 2 });

/** Presentational SVG of the reference infrastructure, filtered by layer. */
export function ReferenceMap({ model, visibleLayers, selectedId, onSelect, highlighted }: Props) {
  const dimmed = (id: string) => highlighted !== undefined && !highlighted.has(id);
  const nodes = model.nodos.filter(n => visibleLayers.has(n.capa));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const cols = Math.max(...model.nodos.map(n => n.x)) + 1, rows = Math.max(...model.nodos.map(n => n.y)) + 1;
  const width = PAD * 2 + (cols - 1) * CELL_W + NODE_W, height = PAD * 2 + (rows - 1) * CELL_H + NODE_H;

  return (
    <svg className="map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Mapa de referencia: ${model.nombre}`}>
      {visibleLayers.has('logica') && model.zonas.map(z => {
        const members = z.nodos.map(id => byId.get(id)).filter(n => n !== undefined);
        if (!members.length) return null;
        const x0 = Math.min(...members.map(n => n.x)), x1 = Math.max(...members.map(n => n.x));
        const y0 = Math.min(...members.map(n => n.y)), y1 = Math.max(...members.map(n => n.y));
        const x = PAD + x0 * CELL_W - 10, y = PAD + y0 * CELL_H - 20;
        return (
          <g key={z.id} className="zone">
            <rect x={x} y={y} width={(x1 - x0) * CELL_W + NODE_W + 20} height={(y1 - y0) * CELL_H + NODE_H + 30} rx={10} />
            <text x={x + 8} y={y + 13}>{z.nombre}</text>
          </g>
        );
      })}
      {model.enlaces.map(e => {
        const a = byId.get(e.desde), b = byId.get(e.hasta);
        if (!a || !b) return null;
        const p = center(a.x, a.y), q = center(b.x, b.y);
        const dim = dimmed(a.id) || dimmed(b.id) ? ' dim' : '';
        return <line key={`${e.desde}-${e.hasta}`} className={`link link-${e.tipo ?? 'red'}${dim}`} x1={p.cx} y1={p.cy} x2={q.cx} y2={q.cy} />;
      })}
      {nodes.map(n => {
        const t = typeOf(n.tipo), x = PAD + n.x * CELL_W, y = PAD + n.y * CELL_H;
        return (
          <g
            key={n.id}
            className={`node fam-${t.familia}${selectedId === n.id ? ' selected' : ''}${dimmed(n.id) ? ' dim' : ''}${highlighted?.has(n.id) ? ' lit' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={n.nombre}
            aria-pressed={selectedId === n.id}
            onClick={() => onSelect(n.id)}
            onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelect(n.id); } }}
          >
            <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={8} />
            <text className="node-name" x={x + 10} y={y + 22}>{n.nombre.length > 18 ? `${n.nombre.slice(0, 17)}…` : n.nombre}</text>
            <text className="node-type" x={x + 10} y={y + 40}>{t.nombre}</text>
          </g>
        );
      })}
    </svg>
  );
}
