import { useState } from 'react';
import { content } from '../../content';

/** Data type of a palette item dragged onto the map. */
export const PALETTE_DRAG_TYPE = 'application/x-mapa-infra-tipo';

/** Lower case without accents, so «camara» finds «Cámara». */
const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * The library of the map editor: every device type of the inventory, grouped by family in groups that fold, with a
 * search by name. Click one to add it, or drag it onto the map. On a narrow screen the whole library folds too.
 */
export function DevicePalette({ onAdd }: { onAdd: (tipo: string) => void }) {
  const [query, setQuery] = useState('');
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(false);
  const wanted = plain(query.trim());
  const toggle = (id: string) => setFolded(prev => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const families = content.familias
    .map(f => ({ ...f, tipos: content.tipos.filter(t => t.familia === f.id && plain(t.nombre).includes(wanted)) }))
    .filter(f => f.tipos.length > 0);

  return (
    <section className={`infra-palette${open ? ' is-open' : ''}`} aria-label="Paleta de equipos">
      <button type="button" className="infra-palette__toggle" aria-expanded={open} aria-controls="infra-palette-body" onClick={() => setOpen(o => !o)}>
        Biblioteca de equipos
      </button>
      <div className="infra-palette__body" id="infra-palette-body">
        <input type="search" className="infra-palette__search" aria-label="Buscar equipos y formas" placeholder="Buscar equipos y formas"
          value={query} onChange={e => setQuery(e.target.value)} />
        {families.length === 0 && <p className="muted">Ningún equipo coincide con «{query.trim()}».</p>}
        {families.map(f => {
          // While searching every family with a match is shown open, so a match is never hidden in a folded group.
          const expanded = wanted !== '' || !folded.has(f.id);
          return (
            <div key={f.id} className="infra-palette__family">
              <h3>
                <button type="button" className="infra-palette__family-toggle" aria-expanded={expanded} aria-controls={`infra-palette-${f.id}`}
                  onClick={() => toggle(f.id)}>{f.nombre}</button>
              </h3>
              {expanded && (
                <div className="infra-palette__items" id={`infra-palette-${f.id}`}>
                  {f.tipos.map(t => (
                    <button key={t.id} type="button" className={`infra-palette__item fam-${f.id}`} aria-label={`Añadir ${t.nombre}`} draggable
                      onDragStart={e => { e.dataTransfer.setData(PALETTE_DRAG_TYPE, t.id); e.dataTransfer.effectAllowed = 'copy'; }}
                      onClick={() => onAdd(t.id)}>{t.nombre}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
