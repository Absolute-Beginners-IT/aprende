// The guide (Hugo site) is where concepts are learnt; the app is where they are practised.
// The app is published at <base>/app/ next to the guide at <base>/, so the default is relative ('../').
// Set VITE_GUIDE_URL at build time (ending in '/') when the guide is deployed somewhere else.
export const GUIDE_URL = import.meta.env.VITE_GUIDE_URL || '../';
