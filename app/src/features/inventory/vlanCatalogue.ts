import type { NetworkPlan, PlanTemplate, PlanVlan, VlanPurpose } from '@shared/plan';

/** The purposes as the guides' planner names them (guias/src/features/labels.ts), so both say the same. */
export const PURPOSE_LABELS: Record<VlanPurpose, string> = {
  users: 'Usuarios',
  voice: 'Voz (telefonía IP)',
  servers: 'Servidores',
  guests: 'Invitados',
  cameras: 'Cámaras',
  management: 'Gestión',
  iot: 'Dispositivos IoT',
  other: 'Otro',
};

/** One colour per VLAN by its place in the catalogue; mid tones that read on light and dark surfaces. */
const VLAN_COLORS = ['#3b82f6', '#10b981', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16'];
export const vlanColor = (index: number) => VLAN_COLORS[index % VLAN_COLORS.length];

// Same rule as the guides' planner (validatePlan.ts), so a VLAN saved here is never refused there.
const VLAN_NAME = /^[A-Za-z0-9_-]{1,32}$/;
const DIGITS = /^\d+$/;
const octet = (text: string) => DIGITS.test(text) && Number(text) <= 255;

/** An IPv4 address with its prefix, such as 192.168.10.0/24. */
export function isCidr(value: string): boolean {
  const [address = '', prefix, ...rest] = value.split('/');
  const parts = address.split('.');
  return prefix !== undefined && rest.length === 0 && parts.length === 4 && parts.every(octet) && DIGITS.test(prefix) && Number(prefix) <= 32;
}

/** The usual gateway of a network: its first address («.1» in a /24); '' when the network is missing or not valid. */
export function gatewayHint(subnet: string): string {
  const value = subnet.trim();
  if (!isCidr(value) || Number(value.split('/')[1]) > 30) return '';
  const [address, prefix] = value.split('/');
  const number = address.split('.').reduce((total, part) => total * 256 + Number(part), 0);
  const size = 2 ** (32 - Number(prefix));
  const first = Math.floor(number / size) * size + 1;
  return [24, 16, 8, 0].map(shift => Math.floor(first / 2 ** shift) % 256).join('.');
}

/** What the learner types in the VLAN form. */
export interface VlanDraft { id: string; name: string; purpose: VlanPurpose; subnet: string }

/**
 * What is wrong with a VLAN before it is saved, checked against the catalogue it goes into. `editing` is the id of
 * the VLAN being changed, so it does not clash with itself. Empty when it can be saved.
 */
export function vlanProblems(draft: VlanDraft, vlans: PlanVlan[], editing?: number): string[] {
  const problems: string[] = [];
  const others = vlans.filter(v => v.id !== editing);
  const id = Number(draft.id);
  if (!DIGITS.test(draft.id.trim()) || id < 1 || id > 4094) problems.push('El ID de la VLAN va de 1 a 4094.');
  else if (others.some(v => v.id === id)) problems.push(`Ya hay una VLAN con el ID ${id}.`);
  if (!VLAN_NAME.test(draft.name.trim())) problems.push('El nombre solo admite letras sin tildes, números, guion y guion bajo (máximo 32).');
  if (draft.subnet.trim() && !isCidr(draft.subnet.trim())) problems.push('La red tiene que ir con prefijo, por ejemplo 192.168.10.0/24.');
  if (draft.purpose === 'management' && others.some(v => v.purpose === 'management')) problems.push('Solo puede haber una VLAN de gestión.');
  return problems;
}

/** The first usual VLAN id still free, as the guides' planner suggests it. */
export function freeVlanId(vlans: PlanVlan[]): number {
  const free = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99].find(id => !vlans.some(v => v.id === id));
  return free ?? Math.max(1, ...vlans.map(v => v.id)) + 1;
}

/** Fails with the first problem, so a change made against what is stored now never saves a clash another tab caused. */
const ensureValid = (draft: VlanDraft, vlans: PlanVlan[], editing?: number) => {
  const [problem] = vlanProblems(draft, vlans, editing);
  if (problem) throw new Error(problem);
};
const fields = (draft: VlanDraft) => ({ id: Number(draft.id), name: draft.name.trim(), purpose: draft.purpose, subnet: draft.subnet.trim() });

/** Plan changes for `PlanRepository.apply`: each one touches only its VLAN, so whatever else is stored stays. */
export const addVlan = (draft: VlanDraft) => (plan: NetworkPlan): NetworkPlan => {
  ensureValid(draft, plan.vlans);
  return { ...plan, vlans: [...plan.vlans, fields(draft)] };
};

/**
 * `opened` is the VLAN as the form showed it: only the fields the learner changed from it are written, so a change
 * another tab made meanwhile to the other fields stays. Without it every field of the form is written.
 */
export const editVlan = (id: number, draft: VlanDraft, opened?: PlanVlan) => (plan: NetworkPlan): NetworkPlan => {
  const stored = plan.vlans.find(v => v.id === id);
  if (!stored) throw new Error(`La VLAN ${id} ya no está en el plan: puede que la hayas quitado en otra pestaña.`);
  const wanted = fields(draft);
  const changed = opened
    ? Object.fromEntries(Object.entries(wanted).filter(([key, value]) => opened[key as keyof typeof wanted] !== value))
    : wanted;
  // Fields the map does not show (written by the planner, a later version or by hand) are kept.
  const merged = { ...stored, ...changed };
  ensureValid({ id: String(merged.id), name: merged.name, purpose: merged.purpose, subnet: merged.subnet }, plan.vlans, id);
  return { ...plan, vlans: plan.vlans.map(v => (v.id === id ? merged : v)) };
};

export const removeVlan = (id: number) => (plan: NetworkPlan): NetworkPlan => ({ ...plan, vlans: plan.vlans.filter(v => v.id !== id) });

/**
 * Adds the VLANs of a template that fit: an id already in the plan, or a second management VLAN, is left out, so
 * applying a template never changes or drops what the learner already has.
 */
export const applyTemplate = (template: PlanTemplate) => (plan: NetworkPlan): NetworkPlan => {
  const vlans = [...plan.vlans];
  for (const vlan of template.vlans) {
    const clash = vlans.some(v => v.id === vlan.id) || (vlan.purpose === 'management' && vlans.some(v => v.purpose === 'management'));
    if (!clash) vlans.push({ ...vlan });
  }
  return { ...plan, vlans };
};

/** Makes the switch `id` the core: the first of the plan, the others in their order. */
export const makeCore = (id: string) => (plan: NetworkPlan): NetworkPlan => {
  const core = plan.switches.find(s => s.id === id);
  if (!core) throw new Error('Ese switch ya no está en el plan: vuelve a elegir el núcleo.');
  return { ...plan, switches: [core, ...plan.switches.filter(s => s.id !== id)] };
};
