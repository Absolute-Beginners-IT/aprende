import type { Device } from './types';

export interface Finding {
  nivel: 'crit' | 'warn' | 'info';
  mensaje: string;
  deviceId?: string;
}

const RANK = { crit: 0, warn: 1, info: 2 } as const;
const DAY_MS = 864e5;

/** Compares the learner's inventory with what a typical SME should have and lists the gaps. */
export function analyzeInventory(devices: Device[], today: Date): Finding[] {
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
    for (const up of d.uplinks ?? []) {
      if (!ids.has(up)) findings.push({ nivel: 'info', mensaje: `${d.nombre} depende de «${up}», que no está en el inventario.`, deviceId: d.id });
    }
  }
  return findings.sort((a, b) => RANK[a.nivel] - RANK[b.nivel]);
}
