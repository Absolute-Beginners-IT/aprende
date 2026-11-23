import { nextId, type NetworkPlan, type PlanLink, type PlanSwitch } from '@shared/plan';

// Plan changes for `PlanRepository.apply` made from the panel of a switch or a link. Each one touches only its port or
// its link, in the shape the guides' planner uses (PortEditor: `{ id: 'pt-N', switch, interface, vlan }`), so the
// repository's store-back keeps hidden switches, the switch order, link interfaces and unknown fields as they are.

const NOT_IN_PLAN = 'Este switch ya no está en el plan de red: vuelve a abrir su ficha.';

/** The switch of the plan that is the device `deviceId` of «Mi infraestructura». */
export const planSwitchOf = (plan: NetworkPlan, deviceId: string): PlanSwitch | undefined =>
  plan.switches.find(s => s.deviceId === deviceId);

/** The plan's link between the devices `a` and `b`, whichever end each one is; the planner keeps one per pair. */
export function planLinkBetween(plan: NetworkPlan, a: string, b: string): PlanLink | undefined {
  const x = planSwitchOf(plan, a)?.id;
  const y = planSwitchOf(plan, b)?.id;
  if (!x || !y) return undefined;
  return plan.links.find(l => (l.a.switch === x && l.b.switch === y) || (l.a.switch === y && l.b.switch === x));
}

/** Two interface names are the same port when they differ only in case or surrounding spaces. */
const samePort = (x: string, y: string) => x.trim().toLowerCase() === y.trim().toLowerCase();

/** Why a new access port cannot be added to the switch with these ports; empty when it can. */
export function portProblem(name: string, ports: { interface: string }[]): string {
  const port = name.trim();
  if (!port) return 'Escribe el puerto, por ejemplo gi1/0/5.';
  if (ports.some(p => samePort(p.interface, port))) return `El puerto ${port} ya está en la lista: cambia su VLAN en la tabla.`;
  return '';
}

/** Adds an access port in `vlan` to the switch of the device `deviceId`. */
export const addAccessPort = (deviceId: string, name: string, vlan: number) => (plan: NetworkPlan): NetworkPlan => {
  const own = planSwitchOf(plan, deviceId);
  if (!own) throw new Error(NOT_IN_PLAN);
  // Checked again against what is stored now: another tab may have added the same port meanwhile.
  const problem = portProblem(name, plan.ports.filter(p => p.switch === own.id));
  if (problem) throw new Error(problem);
  return { ...plan, ports: [...plan.ports, { id: nextId('pt', plan.ports), switch: own.id, interface: name.trim(), vlan }] };
};

const portGone = 'Ese puerto ya no está en el plan: puede que lo hayas quitado en otra pestaña.';

/** Puts the port `id` in `vlan`; its other fields, known or not, stay. */
export const setPortVlan = (id: string, vlan: number) => (plan: NetworkPlan): NetworkPlan => {
  if (!plan.ports.some(p => p.id === id)) throw new Error(portGone);
  return { ...plan, ports: plan.ports.map(p => (p.id === id ? { ...p, vlan } : p)) };
};

export const removePort = (id: string) => (plan: NetworkPlan): NetworkPlan => ({ ...plan, ports: plan.ports.filter(p => p.id !== id) });

/** Why `text` cannot be the native VLAN of a link; empty when it can. */
export function nativeVlanProblem(text: string): string {
  const value = text.trim();
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 4094 ? '' : 'La VLAN nativa va del 1 al 4094.';
}

/** Sets the native VLAN of the plan's link between the devices `a` and `b`, found again in what is stored now. */
export const setNativeVlan = (a: string, b: string, vlan: number) => (plan: NetworkPlan): NetworkPlan => {
  const link = planLinkBetween(plan, a, b);
  if (!link) throw new Error('Este enlace ya no está en el plan de red: vuelve a abrir su ficha.');
  return { ...plan, links: plan.links.map(l => (l.id === link.id ? { ...l, nativeVlan: vlan } : l)) };
};
