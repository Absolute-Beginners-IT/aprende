export const VIEWS = [
  ['mapa', 'Mapa'],
  ['escenarios', 'Escenarios'],
  ['mi-infraestructura', 'Mi infraestructura'],
] as const;
export type View = typeof VIEWS[number][0];

export interface Route {
  view: View;
  scenarioId?: string;
}

/** Hash routes: #mapa, #mi-infraestructura, #escenarios and #escenarios/<id> (linked from the guide). */
export function parseHash(hash: string): Route {
  const [view, scenarioId] = hash.replace(/^#/, '').split('/');
  if (!VIEWS.some(([k]) => k === view)) return { view: 'mapa' };
  return view === 'escenarios' && scenarioId ? { view, scenarioId } : { view: view as View };
}

export const scenarioHash = (id: string) => `#escenarios/${id}`;
