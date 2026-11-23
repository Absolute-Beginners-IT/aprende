// The guide (Hugo site) is where concepts are learnt; the app is where they are practised.
// The app is published at <base>/app/ next to the guide at <base>/, so the default is relative ('../').
// Set VITE_GUIDE_URL at build time (ending in '/') when the guide is deployed somewhere else.
export const GUIDE_URL = import.meta.env.VITE_GUIDE_URL || '../';

// The switching guides, served at <base>/app/guias/; a device's ficha links to its runbooks there.
export const GUIDES_URL = './guias/';

// The network planner of the switching guides. The map's «Red y VLAN» panel edits the same plan; the planner is where
// its guide with the commands of each switch is generated.
export const PLANNER_URL = `${GUIDES_URL}#/plan`;

// The planner open on its «Guía» tab and, given an inventory device, at the part of the plan switch that follows it.
export const plannerGuideUrl = (deviceId?: string) =>
  `${GUIDES_URL}#/plan/guia${deviceId ? `?equipo=${encodeURIComponent(deviceId)}` : ''}`;
