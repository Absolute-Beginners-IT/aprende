import type { Device, DeviceType, GuideIndex, Topology, VendorSnippet } from './types';
import { guidesForDevice, type DeviceGuides } from './deviceGuides';
import { snippetsForDevice } from './vendorSnippets';
import { levelFinder } from './infraMap';
import { slugify } from './inventoryCsv';
import { GROUP_TYPE_NAMES, groupOf, upstreamOf } from './topology';

// The deployment plan of «Mi infraestructura»: the learner's devices in the order they are set up, each with what to
// configure (its guides), watch (its type's monitoring) and maintain (its type's tasks). Nothing here is new content:
// it is the inventory read against the type knowledge, the vendor configurations and the guide index.

/** Guides of a device in the order they are applied when it is first set up; a platform without one skips it. */
export const DEPLOYMENT_ORDER = ['os-install', 'backup-install', 'mgmt-ip', 'user-admin', 'ssh-access', 'ntp-client', 'vlan-create', 'port-trunk', 'port-access', 'vlan-bridge', 'snmp-monitoring', 'syslog-remote', 'backup-repository', 'backup-job', 'config-backup'] as const;

/** One thing to do on a device; `id` is stable, so the progress saved in the browser keeps pointing to it. */
export interface PlanStep { id: string; texto: string; detalles: string[]; href?: string }

export interface PlanDevice {
  numero: number;
  id: string;
  nombre: string;
  tipoNombre: string;
  marcaModelo: string;
  /** Names of the devices it hangs from that are still in the inventory. */
  cuelgaDe: string[];
  /** The group it belongs to, as «name (type)», e.g. «Par FortiGate (HA)». */
  grupo?: string;
  /** What the guides offer it: when it is not `cubierto`, Configurar explains why instead of listing steps. */
  guias: DeviceGuides;
  configurar: PlanStep[];
  vigilar: PlanStep[];
  mantener: PlanStep[];
}

export interface PlanSources { tipos: DeviceType[]; fabricantes: VendorSnippet[]; guias: GuideIndex }

// There is nothing to set up on the operator's line, but the firewall hanging from it still goes first.
const NOT_DEPLOYED = 'internet';
const CRITICALITY: Record<Device['criticidad'], number> = { Alta: 0, Media: 1, Baja: 2 };

function configSteps(guides: DeviceGuides): PlanStep[] {
  if (guides.estado !== 'cubierto') return [];
  const tasks = new Map(guides.grupos.flatMap(g => g.tareas).map(t => [t.id, t]));
  return DEPLOYMENT_ORDER.flatMap(id => {
    const task = tasks.get(id);
    return task ? [{ id: `config:${id}`, texto: task.titulo, detalles: [], href: task.href }] : [];
  });
}

function watchSteps(device: Device, type: DeviceType | undefined, snippets: VendorSnippet[]): PlanStep[] {
  if (!type) return [];
  const vendor = snippetsForDevice(device, snippets).map(s => s.nombre);
  return [
    { id: 'vigilar:metodo', texto: `Monitorización: ${type.metodo}`, detalles: [`Plantilla: ${type.plantillaZabbix}`, ...(vendor.length ? [`Configuración del fabricante: ${vendor.join(' · ')}`] : [])] },
    ...(type.alertas.length ? [{ id: 'vigilar:alertas', texto: `Alertas: ${type.alertas.map(a => a.que).join(', ')}`, detalles: [] }] : []),
  ];
}

/** `sorted` with the members of each group moved up, one after another, to the place of the first member. */
function groupedTogether(sorted: Device[], grupos: Topology['grupos']): Device[] {
  const placed = new Set<string>();
  return sorted.flatMap(d => {
    if (placed.has(d.id)) return [];
    const group = groupOf(grupos, d.id);
    const run = group ? sorted.filter(m => group.miembros.includes(m.id)) : [d];
    for (const m of run) placed.add(m.id);
    return run;
  });
}

/**
 * The plan, edge first: by how far each device hangs from the edge, then the most critical, then by name. The members
 * of a group go one after another, in the place of the first one.
 */
export function deploymentPlan(topology: Topology, sources: PlanSources, guidesBase: string): PlanDevice[] {
  const devices = topology.equipos;
  const levelOf = levelFinder(topology);
  const byId = new Map(devices.map(d => [d.id, d]));
  const types = new Map(sources.tipos.map(t => [t.id, t]));
  const sorted = devices.filter(d => d.tipo !== NOT_DEPLOYED)
    .sort((a, b) => levelOf(a.id) - levelOf(b.id) || CRITICALITY[a.criticidad] - CRITICALITY[b.criticidad] || a.nombre.localeCompare(b.nombre, 'es'));
  return groupedTogether(sorted, topology.grupos)
    .map((d, index) => {
      const type = types.get(d.tipo) ?? types.get('otro');
      const guias = guidesForDevice(d, sources.guias, guidesBase);
      const group = groupOf(topology.grupos, d.id);
      return {
        numero: index + 1,
        id: d.id,
        nombre: d.nombre,
        tipoNombre: type?.nombre ?? d.tipo,
        marcaModelo: [d.marca, d.modelo].filter(Boolean).join(' '),
        cuelgaDe: upstreamOf(topology.enlaces, d.id).flatMap(u => byId.get(u)?.nombre ?? []),
        ...(group ? { grupo: `${group.nombre} (${GROUP_TYPE_NAMES[group.tipo]})` } : {}),
        guias,
        configurar: configSteps(guias),
        vigilar: watchSteps(d, type, sources.fabricantes),
        // Named after the task, not its position, so reordering tipos.json never ticks another task.
        mantener: (type?.actuaciones ?? []).map(a => ({ id: `mantener:${slugify(a.que)}`, texto: a.que, detalles: [a.frecuencia] })),
      };
    });
}

/** Every step id of a device, in the order the plan shows them. */
export const planStepIds = (device: PlanDevice) => [...device.configurar, ...device.vigilar, ...device.mantener].map(s => s.id);
