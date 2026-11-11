import type { Link, Topology } from './types';
import { downstreamOf, GROUP_TYPE_NAMES, isHierarchical, isPowerSupplier, powerEndRoles, powerSourceOf, upstreamOf } from './topology';

export interface Finding {
  nivel: 'crit' | 'warn' | 'info';
  mensaje: string;
  deviceId?: string;
}

const RANK = { crit: 0, warn: 1, info: 2 } as const;

/**
 * The power paths of a topology: `feedsOf(id)` lists, for each power link that feeds `id` from a SAI or a regleta, the
 * SAIs that link leads to through regletas; `saisBehind(id)` lists the SAIs behind a SAI or regleta. Each device is
 * visited once, so a loop of regletas ends.
 */
function powerPaths(topology: Topology) {
  const typeOf = new Map(topology.equipos.map(d => [d.id, d.tipo]));
  const cables = topology.enlaces.filter(l => l.tipo === 'energia' && l.a.equipo !== l.b.equipo);
  const otherEnd = (l: Link, id: string) => (l.a.equipo === id ? l.b.equipo : l.a.equipo);
  const saisBehind = (start: string): string[] => {
    const found: string[] = [];
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const id = queue.shift()!;
      if (typeOf.get(id) === 'sai') { found.push(id); continue; }
      for (const l of cables) {
        if (l.a.equipo !== id && l.b.equipo !== id) continue;
        const next = otherEnd(l, id);
        if (!seen.has(next) && isPowerSupplier(typeOf.get(next))) { seen.add(next); queue.push(next); }
      }
    }
    return found;
  };
  const feedsOf = (id: string) => cables.filter(l => (l.a.equipo === id || l.b.equipo === id) && powerSourceOf(topology, l) === otherEnd(l, id))
    .map(l => saisBehind(otherEnd(l, id)));
  return { saisBehind, feedsOf };
}
const DAY_MS = 864e5;

/** Compares the learner's inventory with what a typical SME should have and lists the gaps. */
export function analyzeInventory({ equipos: devices, enlaces, grupos }: Topology, today: Date): Finding[] {
  if (!devices.length) return [];
  const count = (tipo: string) => devices.filter(d => d.tipo === tipo).length;
  const findings: Finding[] = [];

  const fw = count('firewall'), hyp = count('hipervisor'), isp = count('internet');
  if (fw === 0) findings.push({ nivel: 'crit', mensaje: 'No hay ningún firewall registrado.' });
  if (fw === 1) findings.push({ nivel: 'warn', mensaje: 'Solo hay un firewall: es un punto único de fallo (valora una pareja en alta disponibilidad).' });
  if (count('backup') === 0) findings.push({ nivel: 'crit', mensaje: 'No hay ningún sistema de copias de seguridad registrado.' });
  if (count('sai') === 0) findings.push({ nivel: 'warn', mensaje: 'No hay ningún SAI registrado: un corte de luz apagaría los equipos de golpe.' });
  if (hyp === 1) findings.push({ nivel: 'warn', mensaje: 'Solo hay un hipervisor: si cae, caen todas sus máquinas virtuales.' });
  if (isp === 1) findings.push({ nivel: 'warn', mensaje: 'Solo hay una línea de Internet: sin respaldo, un corte de la operadora aísla la empresa.' });

  const ids = new Set(devices.map(d => d.id));
  const nameOf = (id: string) => devices.find(d => d.id === id)?.nombre ?? id;
  const typeOf = (id: string) => devices.find(d => d.id === id)?.tipo;
  const power = powerPaths({ equipos: devices, enlaces, grupos });
  // Compare calendar dates, not instants, so the count does not depend on the time of day.
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  for (const d of devices) {
    if (!d.monitorizado) findings.push({ nivel: 'warn', mensaje: `${d.nombre} no está monitorizado.`, deviceId: d.id });
    if (d.finSoporte) {
      const end = /^\d{4}-\d{2}-\d{2}$/.test(d.finSoporte) ? Date.parse(`${d.finSoporte}T00:00:00Z`) : NaN;
      if (Number.isNaN(end)) {
        findings.push({ nivel: 'info', mensaje: `${d.nombre} tiene una fecha de fin de soporte no válida («${d.finSoporte}»): usa el formato AAAA-MM-DD.`, deviceId: d.id });
      } else {
        const days = Math.round((end - todayUtc) / DAY_MS);
        if (days < 0) findings.push({ nivel: 'crit', mensaje: `${d.nombre} está sin soporte del fabricante desde ${d.finSoporte}.`, deviceId: d.id });
        else if (days < 365) findings.push({ nivel: 'warn', mensaje: `${d.nombre} se queda sin soporte en ${days} días (${d.finSoporte}): presupuesta la renovación.`, deviceId: d.id });
      }
    }
    for (const up of upstreamOf(enlaces, d.id)) {
      if (!ids.has(up)) findings.push({ nivel: 'info', mensaje: `${d.nombre} depende de «${up}», que no está en el inventario.`, deviceId: d.id });
    }
    if (d.tipo === 'switch' && downstreamOf(enlaces, d.id).length > 0 && enlaces.filter(l => isHierarchical(l) && l.a.equipo === d.id).length === 1) {
      findings.push({ nivel: 'info', mensaje: `${d.nombre} tiene equipos que cuelgan de él y un solo enlace hacia arriba: si ese enlace cae, se quedan aislados.`, deviceId: d.id });
    }
    if (d.tipo === 'regleta' && power.saisBehind(d.id).length === 0) {
      findings.push({ nivel: 'warn', mensaje: `${d.nombre} no tiene ningún SAI detrás: un corte de luz apaga todo lo que está enchufado a ella.`, deviceId: d.id });
    }
    const feeds = isPowerSupplier(d.tipo) ? [] : power.feedsOf(d.id);
    const sais = new Set(feeds.flat());
    if (feeds.length && feeds.every(path => path.length > 0) && sais.size === 1) {
      const sai = nameOf([...sais][0]);
      if (d.criticidad === 'Alta') {
        findings.push({ nivel: 'info', mensaje: `${d.nombre} solo recibe corriente del SAI ${sai}: si ese SAI cae, ${d.nombre} se apaga; si tiene dos fuentes, conéctalas a SAIs distintos.`, deviceId: d.id });
      }
      if (feeds.length > 1) {
        findings.push({ nivel: 'warn', mensaje: `${d.nombre} tiene ${feeds.length} cables de corriente y todos acaban en el SAI ${sai}: si ese SAI cae, la segunda fuente de alimentación no lo protege.`, deviceId: d.id });
      }
    }
    // The same port in two links; on a power link the end is an outlet («toma») or a power supply, not a network port.
    const ports = new Map<string, { word: string; port: string; uses: number }>();
    for (const l of enlaces) {
      const roles = l.tipo === 'energia' ? powerEndRoles(typeOf(l.a.equipo), typeOf(l.b.equipo)) : undefined;
      for (const side of ['a', 'b'] as const) {
        const port = l[side].equipo === d.id ? l[side].puerto?.trim() : undefined;
        if (!port) continue;
        const word = !roles ? 'el puerto' : roles[side] === 'toma' ? 'la toma' : 'la fuente de alimentación';
        const key = JSON.stringify([word, port]);
        const seen = ports.get(key);
        ports.set(key, { word, port, uses: (seen?.uses ?? 0) + 1 });
      }
    }
    for (const { word, port, uses } of ports.values()) {
      if (uses > 1) findings.push({ nivel: 'warn', mensaje: `${d.nombre} usa ${word} «${port}» en ${uses} enlaces.`, deviceId: d.id });
    }
  }

  for (const g of grupos) {
    const name = `El grupo ${GROUP_TYPE_NAMES[g.tipo]} «${g.nombre}»`;
    if (g.miembros.length === 1) findings.push({ nivel: 'info', mensaje: `${name} solo tiene un equipo.` });
    if (g.miembros.length < 2 || g.tipo === 'cluster') continue;
    // Links between two members of the group of the type that keeps it together: HA heartbeat or stacking cable.
    const joining = enlaces.filter(l => l.tipo === g.tipo && l.a.equipo !== l.b.equipo && g.miembros.includes(l.a.equipo) && g.miembros.includes(l.b.equipo)).length;
    const kind = g.tipo === 'ha' ? 'HA' : 'de stack';
    if (joining === 0) findings.push({ nivel: 'warn', mensaje: `${name} no tiene ningún enlace ${kind} entre sus equipos.` });
    else if (joining === 1 && g.tipo === 'ha') findings.push({ nivel: 'info', mensaje: `${name} tiene un solo enlace HA entre sus equipos: si ese cable falla, cada equipo cree que el otro ha caído.` });
  }
  return findings.sort((a, b) => RANK[a.nivel] - RANK[b.nivel]);
}
