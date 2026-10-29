import { describe, expect, it } from 'vitest';
import { analyzeInventory } from './inventoryAnalysis';
import type { Device } from './types';

const TODAY = new Date(2026, 9, 29, 12, 0);
const dev = (id: string, tipo: string, overrides: Partial<Device> = {}): Device => ({
  id, nombre: id, tipo, criticidad: 'Media', monitorizado: true, ...overrides,
});
const complete = [
  dev('isp1', 'internet'), dev('isp2', 'internet'), dev('fw1', 'firewall'), dev('fw2', 'firewall'),
  dev('esx1', 'hipervisor'), dev('esx2', 'hipervisor'), dev('bkp', 'backup'), dev('sai', 'sai'),
];
const messages = (devices: Device[]) => analyzeInventory(devices, TODAY).map(f => f.mensaje);

describe('analyzeInventory', () => {
  it('reports nothing for an empty inventory', () => {
    expect(analyzeInventory([], TODAY)).toEqual([]);
  });

  it('reports nothing for a complete, monitored and supported inventory', () => {
    expect(analyzeInventory(complete, TODAY)).toEqual([]);
  });

  it('flags missing firewall and backup as critical gaps', () => {
    const findings = analyzeInventory([dev('core', 'switch')], TODAY);
    expect(findings).toContainEqual({ nivel: 'crit', mensaje: 'No hay ningún firewall registrado.' });
    expect(findings).toContainEqual({ nivel: 'crit', mensaje: 'No hay ningún sistema de copias de seguridad registrado.' });
  });

  it('flags single points of failure', () => {
    const single = complete.filter(d => !['fw2', 'esx2', 'isp2'].includes(d.id));
    expect(messages(single)).toEqual(expect.arrayContaining([
      'Solo hay un firewall: es un punto único de fallo (valora una pareja en alta disponibilidad).',
      'Solo hay un hipervisor: si cae, caen todas sus máquinas virtuales.',
      'Solo hay una línea de Internet: sin respaldo, un corte de la operadora aísla la empresa.',
    ]));
  });

  it('flags a missing UPS', () => {
    expect(messages(complete.filter(d => d.tipo !== 'sai'))).toContain('No hay ningún SAI registrado: un corte de luz apagaría los equipos de golpe.');
  });

  it('flags unmonitored devices and support dates', () => {
    const devices = [
      ...complete,
      dev('core', 'switch', { nombre: 'Core', monitorizado: false }),
      dev('old', 'switch', { nombre: 'Viejo', finSoporte: '2026-01-31' }),
      dev('soon', 'switch', { nombre: 'Pronto', finSoporte: '2027-03-01' }),
    ];
    expect(analyzeInventory(devices, TODAY)).toEqual([
      { nivel: 'crit', mensaje: 'Viejo está sin soporte del fabricante desde 2026-01-31.', deviceId: 'old' },
      { nivel: 'warn', mensaje: 'Core no está monitorizado.', deviceId: 'core' },
      { nivel: 'warn', mensaje: 'Pronto se queda sin soporte en 123 días (2027-03-01): presupuesta la renovación.', deviceId: 'soon' },
    ]);
  });

  it('counts support days by calendar date, whatever the time of day', () => {
    const lateEvening = new Date(2026, 9, 29, 23, 30);
    const earlyMorning = new Date(2026, 9, 29, 0, 5);
    const soon = [...complete, dev('soon', 'switch', { nombre: 'Pronto', finSoporte: '2027-03-01' })];
    for (const now of [lateEvening, earlyMorning]) {
      expect(analyzeInventory(soon, now).map(f => f.mensaje)).toContain('Pronto se queda sin soporte en 123 días (2027-03-01): presupuesta la renovación.');
    }
  });

  it('flags support dates that cannot be read instead of ignoring them', () => {
    expect(analyzeInventory([...complete, dev('x', 'switch', { nombre: 'Raro', finSoporte: '31/12/2027' })], TODAY)).toEqual([
      { nivel: 'info', mensaje: 'Raro tiene una fecha de fin de soporte no válida («31/12/2027»): usa el formato AAAA-MM-DD.', deviceId: 'x' },
    ]);
  });

  it('flags uplinks that point to devices not in the inventory', () => {
    expect(messages([...complete, dev('acc1', 'switch', { nombre: 'Acceso 1', uplinks: ['nope'] })]))
      .toContain('Acceso 1 depende de «nope», que no está en el inventario.');
  });
});
