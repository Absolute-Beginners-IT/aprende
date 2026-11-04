import { describe, expect, it } from 'vitest';
import { guidesForDevice } from './deviceGuides';
import { content } from '../content';
import type { Device } from './types';

const BASE = './guias/';
const dev = (tipo: string, overrides: Partial<Device> = {}): Device => ({
  id: 'sw01', nombre: 'SW01', tipo, criticidad: 'Media', monitorizado: false, ...overrides,
});
const guides = (d: Device) => guidesForDevice(d, content.guias, BASE);
const covered = (d: Device) => {
  const g = guides(d);
  if (g.estado !== 'cubierto') throw new Error(`expected a covered device, got ${g.estado}`);
  return g;
};
const taskIds = (d: Device) => covered(d).grupos.flatMap(g => g.tareas.map(t => t.id));

describe('guidesForDevice', () => {
  it('finds the platform of a switch from its brand, model or firmware', () => {
    expect(covered(dev('switch', { marca: 'HPE Aruba', modelo: '6100 24G' })).plataforma.id).toBe('aruba-aoscx');
    expect(covered(dev('switch', { marca: 'Cisco', modelo: 'Catalyst 1300-24P-4G' })).plataforma.id).toBe('cisco-c1300');
    expect(covered(dev('switch', { marca: 'MikroTik', modelo: 'CRS317-1G-16S+' })).plataforma.id).toBe('mikrotik-routeros');
    expect(covered(dev('switch', { marca: 'Ruijie', modelo: 'RG-NBS3200-24GT4XS' })).plataforma.id).toBe('ruijie-reyee');
    expect(covered(dev('switch', { firmware: 'RouterOS 7.15' })).plataforma.id).toBe('mikrotik-routeros');
  });

  it('groups the tasks in index order and links each one to the guide with the device chosen', () => {
    const g = covered(dev('switch', { marca: 'HPE Aruba', modelo: '6100 24G' }));
    expect(g.plataforma.nombre).toBe('Aruba CX 6100');
    expect(g.grupos.map(gr => gr.id)).toEqual(['setup-access', 'vlans-ports', 'monitoring', 'security-resilience']);
    expect(g.grupos[0]).toMatchObject({ nombre: 'Puesta en marcha y acceso' });
    expect(g.grupos[0].tareas[0]).toEqual({
      id: 'config-backup', titulo: 'Guardar una copia de la configuración', href: './guias/#/p/aruba-aoscx/config-backup?equipo=sw01',
    });
    expect(g.grupos.flatMap(gr => gr.tareas)).toHaveLength(content.guias.tareas.length);
  });

  it('encodes the device id in the link', () => {
    const g = covered(dev('switch', { id: 'sw a/b#1&x', marca: 'Cisco', modelo: 'C1300-24T' }));
    expect(g.grupos[0].tareas[0].href).toBe('./guias/#/p/cisco-c1300/config-backup?equipo=sw%20a%2Fb%231%26x');
  });

  it('leaves out the tasks the platform does not have', () => {
    const mikrotik = taskIds(dev('switch', { marca: 'MikroTik', modelo: 'CRS326' }));
    expect(mikrotik).not.toContain('poe-port');
    expect(mikrotik).toContain('port-security');
    const ruijie = taskIds(dev('switch', { marca: 'Ruijie', modelo: 'NBS3200' }));
    for (const id of ['port-security', 'ssh-access', 'user-admin']) expect(ruijie).not.toContain(id);
    expect(ruijie).toContain('poe-port');
  });

  it('leaves out a group with no task for the platform', () => {
    const index = { ...content.guias, tareas: content.guias.tareas.filter(t => t.grupo !== 'monitoring' || !t.plataformas.includes('ruijie-reyee')) };
    const g = guidesForDevice(dev('switch', { marca: 'Ruijie', modelo: 'NBS3200' }), index, BASE);
    expect(g.estado === 'cubierto' && g.grupos.map(gr => gr.id)).toEqual(['setup-access', 'vlans-ports', 'security-resilience']);
  });

  it('lists the covered platforms for a switch whose brand and model match none', () => {
    const names = ['Aruba CX 6100', 'Cisco Catalyst 1300', 'MikroTik CRS317', 'Ruijie NBS3200'];
    for (const d of [dev('switch'), dev('switch', { marca: 'Dell', modelo: 'PowerSwitch N3248' })]) {
      const g = guides(d);
      expect(g.estado).toBe('modelo-desconocido');
      expect(g.estado === 'modelo-desconocido' && g.plataformas.map(p => p.nombre)).toEqual(names);
    }
  });

  it('has no guides yet for any other device type, even with a covered model', () => {
    expect(guides(dev('firewall', { marca: 'Fortinet', modelo: 'FortiGate 60F' }))).toEqual({ estado: 'tipo-sin-guias' });
    expect(guides(dev('router', { marca: 'MikroTik', modelo: 'CRS317', firmware: 'RouterOS 7' }))).toEqual({ estado: 'tipo-sin-guias' });
  });
});
