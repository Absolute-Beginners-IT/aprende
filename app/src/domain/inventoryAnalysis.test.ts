import { describe, expect, it } from 'vitest';
import { analyzeInventory } from './inventoryAnalysis';
import type { Link } from './types';
import { fromInventoryV1, type DeviceV1 } from './topology';

const TODAY = new Date(2026, 9, 29, 12, 0);
const dev = (id: string, tipo: string, overrides: Partial<DeviceV1> = {}): DeviceV1 => ({
  id, nombre: id, tipo, criticidad: 'Media', monitorizado: true, ...overrides,
});
const complete = [
  dev('isp1', 'internet'), dev('isp2', 'internet'), dev('fw1', 'firewall'), dev('fw2', 'firewall'),
  dev('esx1', 'hipervisor'), dev('esx2', 'hipervisor'), dev('bkp', 'backup'), dev('sai', 'sai'),
];
const analyze = (devices: DeviceV1[]) => analyzeInventory(fromInventoryV1(devices), TODAY);
const messages = (devices: DeviceV1[]) => analyze(devices).map(f => f.mensaje);

describe('analyzeInventory', () => {
  it('reports nothing for an empty inventory', () => {
    expect(analyze([])).toEqual([]);
  });

  it('reports nothing for a complete, monitored and supported inventory', () => {
    expect(analyze(complete)).toEqual([]);
  });

  it('flags missing firewall and backup as critical gaps', () => {
    const findings = analyze([dev('core', 'switch')]);
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
    expect(analyze(devices)).toEqual([
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
      expect(analyzeInventory(fromInventoryV1(soon), now).map(f => f.mensaje)).toContain('Pronto se queda sin soporte en 123 días (2027-03-01): presupuesta la renovación.');
    }
  });

  it('flags support dates that cannot be read instead of ignoring them', () => {
    expect(analyze([...complete, dev('x', 'switch', { nombre: 'Raro', finSoporte: '31/12/2027' })])).toEqual([
      { nivel: 'info', mensaje: 'Raro tiene una fecha de fin de soporte no válida («31/12/2027»): usa el formato AAAA-MM-DD.', deviceId: 'x' },
    ]);
  });

  it('flags uplinks that point to devices not in the inventory', () => {
    expect(messages([...complete, dev('acc1', 'switch', { nombre: 'Acceso 1', uplinks: ['nope'] })]))
      .toContain('Acceso 1 depende de «nope», que no está en el inventario.');
  });

  it('flags a hierarchical link whose upstream device is missing, but not a link with no hierarchy', () => {
    const topology = fromInventoryV1([...complete, dev('acc1', 'switch', { nombre: 'Acceso 1' })]);
    const link = (id: string, b: string, tipo: Link['tipo']): Link => ({ id, a: { equipo: 'acc1' }, b: { equipo: b }, tipo });
    const findings = analyzeInventory({ ...topology, enlaces: [link('1', 'troncal-perdido', 'troncal'), link('2', 'par-perdido', 'ha')] }, TODAY);
    expect(findings).toEqual([{ nivel: 'info', mensaje: 'Acceso 1 depende de «troncal-perdido», que no está en el inventario.', deviceId: 'acc1' }]);
  });
});
