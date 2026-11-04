export const VIEWS = [
  ['mapa', 'Mapa'],
  ['escenarios', 'Escenarios'],
  ['mi-infraestructura', 'Mi infraestructura'],
] as const;
export type View = typeof VIEWS[number][0];

const INFRA_VIEWS = ['lista', 'plan'] as const;
export type InfraView = typeof INFRA_VIEWS[number];

export interface Route {
  view: View;
  scenarioId?: string;
  /** «Mi infraestructura» opens its map; `lista` is the device list with the CSV import, `plan` the deployment plan. */
  infraView?: InfraView;
}

/** Hash routes: #mapa, #escenarios, #escenarios/<id> (linked from the guide), #mi-infraestructura, #mi-infraestructura/lista and #mi-infraestructura/plan. */
export function parseHash(hash: string): Route {
  const [view, sub] = hash.replace(/^#/, '').split('/');
  if (!VIEWS.some(([k]) => k === view)) return { view: 'mapa' };
  if (view === 'escenarios' && sub) return { view, scenarioId: sub };
  const infraView = INFRA_VIEWS.find(v => v === sub);
  if (view === 'mi-infraestructura' && infraView) return { view, infraView };
  return { view: view as View };
}

export const scenarioHash = (id: string) => `#escenarios/${id}`;
