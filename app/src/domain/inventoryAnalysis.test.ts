import { describe, expect, it } from 'vitest';
import { analyzeInventory } from './inventoryAnalysis';
import type { DeviceGroup, Link } from './types';
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

describe('analyzeInventory groups and links', () => {
  const base = fromInventoryV1([...complete, dev('core1', 'switch', { nombre: 'Core 1' }), dev('core2', 'switch', { nombre: 'Core 2' }), dev('acc1', 'switch', { nombre: 'Acceso 1' })]);
  const end = (equipo: string, puerto?: string) => (puerto === undefined ? { equipo } : { equipo, puerto });
  const link = (id: string, a: string, b: string, tipo: Link['tipo'], puertos: [string?, string?] = []): Link => ({ id, a: end(a, puertos[0]), b: end(b, puertos[1]), tipo });
  const group = (tipo: DeviceGroup['tipo'], nombre: string, miembros: string[]): DeviceGroup => ({ id: `g-${nombre}`, tipo, nombre, miembros });
  const run = (enlaces: Link[], grupos: DeviceGroup[] = []) => analyzeInventory({ ...base, enlaces, grupos }, TODAY);

  it('keeps reporting nothing for the complete inventory with a well-linked HA pair', () => {
    expect(run([link('1', 'fw1', 'fw2', 'ha'), link('2', 'fw1', 'fw2', 'ha')], [group('ha', 'Par FortiGate', ['fw1', 'fw2'])])).toEqual([]);
  });

  it('warns about an HA group with no ha link between its members', () => {
    expect(run([link('1', 'fw1', 'fw2', 'datos')], [group('ha', 'Par FortiGate', ['fw1', 'fw2'])])).toEqual([
      { nivel: 'warn', mensaje: 'El grupo HA «Par FortiGate» no tiene ningún enlace HA entre sus equipos.' },
    ]);
  });

  it('notes an HA group with exactly one ha link', () => {
    expect(run([link('1', 'fw1', 'fw2', 'ha')], [group('ha', 'Par FortiGate', ['fw1', 'fw2'])])).toEqual([
      { nivel: 'info', mensaje: 'El grupo HA «Par FortiGate» tiene un solo enlace HA entre sus equipos: si ese cable falla, cada equipo cree que el otro ha caído.' },
    ]);
  });

  it('warns about a stack group with no stack link, but not when it has one', () => {
    expect(run([], [group('stack', 'Núcleo', ['core1', 'core2'])])).toEqual([
      { nivel: 'warn', mensaje: 'El grupo Stack «Núcleo» no tiene ningún enlace de stack entre sus equipos.' },
    ]);
    expect(run([link('1', 'core1', 'core2', 'stack')], [group('stack', 'Núcleo', ['core1', 'core2'])])).toEqual([]);
  });

  it('notes a group with a single member', () => {
    expect(run([], [group('cluster', 'Clúster VMware', ['esx1'])])).toEqual([
      { nivel: 'info', mensaje: 'El grupo Clúster «Clúster VMware» solo tiene un equipo.' },
    ]);
  });

  it('notes a switch with devices hanging from it and a single link upwards', () => {
    expect(run([link('1', 'acc1', 'core1', 'datos'), link('2', 'core1', 'fw1', 'troncal')])).toEqual([
      { nivel: 'info', mensaje: 'Core 1 tiene equipos que cuelgan de él y un solo enlace hacia arriba: si ese enlace cae, se quedan aislados.', deviceId: 'core1' },
    ]);
  });

  it('does not note the switch when it has two links upwards, or nothing hanging from it', () => {
    expect(run([link('1', 'acc1', 'core1', 'datos'), link('2', 'core1', 'fw1', 'troncal'), link('3', 'core1', 'fw2', 'troncal')])).toEqual([]);
    expect(run([link('1', 'core1', 'fw1', 'troncal'), link('2', 'acc1', 'core1', 'ha')])).toEqual([]);
  });

  it('warns about the same port of a device used by two links', () => {
    expect(run([link('1', 'acc1', 'core1', 'gestion', ['', 'port1']), link('2', 'core1', 'core2', 'stack', ['port1', 'port9'])])).toEqual([
      { nivel: 'warn', mensaje: 'Core 1 usa el puerto «port1» en 2 enlaces.', deviceId: 'core1' },
    ]);
  });

  it('does not warn when the ports differ or are empty', () => {
    expect(run([link('1', 'acc1', 'core1', 'gestion', ['', 'port1']), link('2', 'core1', 'core2', 'stack', ['port2', 'port1']), link('3', 'acc1', 'core2', 'gestion', ['', ' '])])).toEqual([]);
  });
});
