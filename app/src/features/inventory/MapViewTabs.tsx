import { useRef, type KeyboardEvent } from 'react';

/** The two views of the same inventory: the network links, or only the power. */
export type MapView = 'red' | 'energia';

const VIEWS: { id: MapView; nombre: string }[] = [{ id: 'red', nombre: 'Red' }, { id: 'energia', nombre: 'Energía' }];
const STORAGE_KEY = 'mapa-infra:vista';

/** The view chosen in this browser; «Red» when nothing was chosen or the storage cannot be read. */
export function loadMapView(): MapView {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'energia' ? 'energia' : 'red';
  } catch {
    return 'red';
  }
}

/** Remembers the view in this browser; a blocked or full storage only means it is not remembered. */
export function saveMapView(view: MapView) {
  try { localStorage.setItem(STORAGE_KEY, view); } catch { /* remembered for this visit only */ }
}

/** The tabs above the map. Arrow keys, Home and End move between them, as in any tab list. */
export function MapViewTabs({ view, onChange, controls }: { view: MapView; onChange: (view: MapView) => void; controls: string }) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, index: number) => {
    const last = VIEWS.length - 1;
    const keys: Record<string, number> = { ArrowLeft: index ? index - 1 : last, ArrowRight: index === last ? 0 : index + 1, Home: 0, End: last };
    const next = keys[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(VIEWS[next].id);
    tabs.current[next]?.focus();
  };
  return (
    <div className="infra-views" role="tablist" aria-label="Vista del mapa">
      {VIEWS.map((v, i) => (
        <button key={v.id} ref={el => { tabs.current[i] = el; }} type="button" role="tab" id={`infra-view-${v.id}`} aria-selected={view === v.id}
          aria-controls={controls} tabIndex={view === v.id ? 0 : -1} onClick={() => onChange(v.id)} onKeyDown={e => move(e, i)}>{v.nombre}</button>
      ))}
    </div>
  );
}
