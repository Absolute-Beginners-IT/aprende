import type { Device, GuideIndex, GuidePlatform } from './types';

export interface DeviceGuideLink { id: string; titulo: string; href: string }
export interface DeviceGuideGroup { id: string; nombre: string; tareas: DeviceGuideLink[] }

/** What the guides offer a device: its runbooks, the models they cover, or nothing yet for its type. */
export type DeviceGuides =
  | { estado: 'cubierto'; plataforma: GuidePlatform; grupos: DeviceGuideGroup[] }
  | { estado: 'modelo-desconocido'; plataformas: GuidePlatform[] }
  | { estado: 'tipo-sin-guias' };

// The guides only cover switches today; the platform is found with the same rule the guides use.
const GUIDED_TYPE = 'switch';

/** The platform of a device from its brand, model and firmware: the first one in the index whose pattern matches. */
function platformOf(device: Device, platforms: GuidePlatform[]): GuidePlatform | undefined {
  const text = [device.marca, device.modelo, device.firmware].filter(Boolean).join(' ');
  if (!text) return undefined;
  return platforms.find(p => new RegExp(p.patron, p.flags).test(text));
}

/** The guides of a device, each linking to its runbook with the device chosen (`<base>#/p/<platform>/<task>?equipo=<id>`). */
export function guidesForDevice(device: Device, index: GuideIndex, base: string): DeviceGuides {
  if (device.tipo !== GUIDED_TYPE) return { estado: 'tipo-sin-guias' };
  const plataforma = platformOf(device, index.plataformas);
  if (!plataforma) return { estado: 'modelo-desconocido', plataformas: index.plataformas };
  const equipo = encodeURIComponent(device.id);
  const grupos = index.grupos.map(g => ({
    id: g.id,
    nombre: g.nombre,
    tareas: index.tareas.filter(t => t.grupo === g.id && t.plataformas.includes(plataforma.id))
      .map(t => ({ id: t.id, titulo: t.titulo, href: `${base}#/p/${plataforma.id}/${t.id}?equipo=${equipo}` })),
  })).filter(g => g.tareas.length > 0);
  return { estado: 'cubierto', plataforma, grupos };
}
