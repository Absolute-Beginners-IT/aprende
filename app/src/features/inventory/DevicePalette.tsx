import { content } from '../../content';

/** Data type of a palette item dragged onto the map. */
export const PALETTE_DRAG_TYPE = 'application/x-mapa-infra-tipo';

/** Every device type of the inventory, grouped by family: click one to add it, or drag it onto the map. */
export function DevicePalette({ onAdd }: { onAdd: (tipo: string) => void }) {
  return (
    <section className="infra-palette card" aria-label="Paleta de equipos">
      <h2>Añadir equipo</h2>
      {content.familias.map(f => {
        const tipos = content.tipos.filter(t => t.familia === f.id);
        return tipos.length > 0 && (
          <div key={f.id}>
            <h3>{f.nombre}</h3>
            <div className="infra-palette__items">
              {tipos.map(t => (
                <button key={t.id} type="button" className={`infra-palette__item fam-${f.id}`} aria-label={`Añadir ${t.nombre}`} draggable
                  onDragStart={e => { e.dataTransfer.setData(PALETTE_DRAG_TYPE, t.id); e.dataTransfer.effectAllowed = 'copy'; }}
                  onClick={() => onAdd(t.id)}>{t.nombre}</button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
