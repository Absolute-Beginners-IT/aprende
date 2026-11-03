export const VIEWS = [
  ['mapa', 'Mapa'],
  ['escenarios', 'Escenarios'],
  ['mi-infraestructura', 'Mi infraestructura'],
] as const;
export type View = typeof VIEWS[number][0];

export interface Route {
  view: View;
  scenarioId?: string;
  /** «Mi infraestructura» opens its map; `lista` is the device list with the CSV import. */
  infraView?: 'lista';
}

/** Hash routes: #mapa, #escenarios, #escenarios/<id> (linked from the guide), #mi-infraestructura and #mi-infraestructura/lista. */
export function parseHash(hash: string): Route {
  const [view, sub] = hash.replace(/^#/, '').split('/');
  if (!VIEWS.some(([k]) => k === view)) return { view: 'mapa' };
  if (view === 'escenarios' && sub) return { view, scenarioId: sub };
  if (view === 'mi-infraestructura' && sub === 'lista') return { view, infraView: 'lista' };
  return { view: view as View };
}

export const scenarioHash = (id: string) => `#escenarios/${id}`;
