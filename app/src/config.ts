// The guide (Hugo site) is where concepts are learnt; the app is where they are practised.
// The app is published at <base>/app/ next to the guide at <base>/, so the default is relative ('../').
// Set VITE_GUIDE_URL at build time (ending in '/') when the guide is deployed somewhere else.
export const GUIDE_URL = import.meta.env.VITE_GUIDE_URL || '../';

// The switching guides, served at <base>/app/guias/; a device's ficha links to its runbooks there.
export const GUIDES_URL = './guias/';

// The network planner of the switching guides. On the website it is the second tab of «Mi infraestructura»,
// so the inventory links straight to it.
export const PLANNER_URL = `${GUIDES_URL}#/plan`;
