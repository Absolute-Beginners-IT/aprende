import type { LinkType } from '../../domain/types';
import { LINK_TYPE_NAMES } from '../../domain/topology';

/** Line types the learner can hide from the map, with the text of their toggle. Power lines have a view of their own. */
export const HIDEABLE_LINES: Partial<Record<LinkType, string>> = {
  gestion: 'Mostrar las líneas de gestión',
};

const STORAGE_KEY = 'mapa-infra:lineas-ocultas';

/** The line types hidden in this browser; nothing when the storage cannot be read or holds something else. */
export function loadHiddenLines(): LinkType[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(raw) ? (Object.keys(HIDEABLE_LINES) as LinkType[]).filter(t => raw.includes(t)) : [];
  } catch {
    return [];
  }
}

/** Remembers the hidden line types in this browser; a blocked or full storage only means it is not remembered. */
export function saveHiddenLines(hidden: LinkType[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden)); } catch { /* remembered for this visit only */ }
}

/** The link types on the map with a sample of their line, and the toggles of the lines that can be hidden. */
export function MapLegend({ types, hidden, onToggle }: { types: LinkType[]; hidden: LinkType[]; onToggle: (tipo: LinkType, show: boolean) => void }) {
  if (!types.length) return null;
  const toggles = types.filter(t => HIDEABLE_LINES[t]);
  return (
    <section className="infra-legend" aria-label="Leyenda del mapa">
      <ul className="infra-legend__items">
        {types.map(t => (
          <li key={t} className={hidden.includes(t) ? 'is-hidden' : undefined}>
            <svg className={`infra-legend__swatch infra-edge--${t}`} width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">
              <line x1="2" y1="6" x2="32" y2="6" />
            </svg>
            {LINK_TYPE_NAMES[t]}
          </li>
        ))}
      </ul>
      {toggles.map(t => (
        <label key={t} className="check">
          <input type="checkbox" checked={!hidden.includes(t)} onChange={e => onToggle(t, e.target.checked)} /> {HIDEABLE_LINES[t]}
        </label>
      ))}
    </section>
  );
}
