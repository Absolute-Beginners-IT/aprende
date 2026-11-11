import { describe, expect, it } from 'vitest';
import { deploymentPlan, DEPLOYMENT_ORDER, planStepIds } from './deploymentPlan';
import { content } from '../content';
import type { Link } from './types';
import { slugify } from './inventoryCsv';
import { fromInventoryV1, type DeviceV1 } from './topology';

const BASE = './guias/';
const dev = (id: string, extra: Partial<DeviceV1> = {}): DeviceV1 => ({ id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...extra });
const plan = (devices: DeviceV1[]) => deploymentPlan(fromInventoryV1(devices), content, BASE);
const order = (devices: DeviceV1[]) => plan(devices).map(p => p.nombre);
const link = (id: string, a: string, b: string, tipo: Link['tipo']): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo });
const tipo = (id: string) => content.tipos.find(t => t.id === id)!;

describe('deploymentPlan order', () => {
  it('goes from the edge inwards: devices with no uplinks first, then those hanging from them', () => {
    const devices = [dev('p1', { uplinks: ['core'] }), dev('core', { uplinks: ['fw'] }), dev('fw', { tipo: 'firewall' })];
    expect(order(devices)).toEqual(['FW', 'CORE', 'P1']);
    expect(plan(devices).map(p => p.numero)).toEqual([1, 2, 3]);
  });

  it('within a level puts the most critical first, then sorts by name in Spanish', () => {
    const devices = [
      dev('b', { nombre: 'Beta', criticidad: 'Baja' }),
      dev('n', { nombre: 'Ñandú', criticidad: 'Media' }),
      dev('z', { nombre: 'Zeta', criticidad: 'Alta' }),
      dev('o', { nombre: 'Oso', criticidad: 'Media' }),
      dev('a', { nombre: 'alfa', criticidad: 'Media' }),
    ];
    expect(order(devices)).toEqual(['Zeta', 'alfa', 'Ñandú', 'Oso', 'Beta']);
  });

  it('leaves Internet out of the plan but still counts it for the order of the rest', () => {
    const devices = [dev('lan', { uplinks: ['fw'] }), dev('fw', { tipo: 'firewall', uplinks: ['isp'] }), dev('isp', { tipo: 'internet', nombre: 'Internet' }), dev('suelto', { criticidad: 'Baja' })];
    const steps = plan(devices);
    expect(steps.map(p => p.nombre)).toEqual(['SUELTO', 'FW', 'LAN']);
    expect(steps.map(p => p.numero)).toEqual([1, 2, 3]);
    expect(steps[1].cuelgaDe).toEqual(['Internet']);
  });

  it('survives a loop of uplinks', () => {
    const devices = [dev('a', { uplinks: ['b'] }), dev('b', { uplinks: ['a'] }), dev('c', { uplinks: ['b'] })];
    expect(order(devices)).toHaveLength(3);
    expect(order(devices).at(-1)).toBe('C');
  });

  it('says what each device hangs from, ignoring uplinks to devices no longer in the inventory', () => {
    const devices = [dev('core', { uplinks: ['fw', 'gone'] }), dev('fw', { nombre: 'FW01', tipo: 'firewall' }), dev('sw2', { uplinks: ['core', 'fw'] })];
    expect(plan(devices).map(p => [p.nombre, p.cuelgaDe])).toEqual([['FW01', []], ['CORE', ['FW01']], ['SW2', ['CORE', 'FW01']]]);
  });

  it('orders and says what each device hangs from by hierarchical links only, once per device', () => {
    const [isp, fw1, fw2, core] = fromInventoryV1([dev('isp', { tipo: 'internet', nombre: 'Internet' }), dev('fw1', { tipo: 'firewall' }), dev('fw2', { tipo: 'firewall' }), dev('core')]).equipos;
    const topology = {
      equipos: [core, fw2, fw1, isp],
      enlaces: [link('1', 'fw1', 'isp', 'wan'), link('2', 'fw2', 'isp', 'wan'), link('3', 'fw1', 'fw2', 'ha'), link('4', 'core', 'fw1', 'lag'), link('5', 'core', 'fw1', 'datos'), link('6', 'core', 'fw2', 'gestion')],
      grupos: [],
    };
    expect(deploymentPlan(topology, content, BASE).map(p => [p.nombre, p.cuelgaDe])).toEqual([['FW1', ['Internet']], ['FW2', ['Internet']], ['CORE', ['FW1']]]);
  });

  it('describes each device by its type, brand and model', () => {
    const [p] = plan([dev('fw', { tipo: 'firewall', marca: 'Fortinet', modelo: 'FortiGate 60F' })]);
    expect(p).toMatchObject({ id: 'fw', tipoNombre: 'Firewall', marcaModelo: 'Fortinet FortiGate 60F' });
    expect(plan([dev('x', { tipo: 'no-existe' })])[0].tipoNombre).toBe('Otro');
  });
});

describe('deploymentPlan Configurar', () => {
  it('lists the guides of a covered switch in deployment order, linked with the device chosen', () => {
    const [p] = plan([dev('sw01', { marca: 'HPE Aruba', modelo: '6100 24G' })]);
    expect(p.guias.estado).toBe('cubierto');
    // The Aruba guides have no installation, VLAN bridge (a hypervisor task) nor backup tasks: every other task is listed.
    const notSwitch = new Set(['os-install', 'backup-install', 'vlan-bridge', 'backup-repository', 'backup-job']);
    expect(p.configurar.map(s => s.id)).toEqual(DEPLOYMENT_ORDER.filter(t => !notSwitch.has(t)).map(t => `config:${t}`));
    expect(p.configurar[0]).toEqual({ id: 'config:mgmt-ip', texto: 'Configurar la IP de gestión', detalles: [], href: './guias/#/p/aruba-aoscx/mgmt-ip?equipo=sw01' });
  });

  it('starts a Proxmox VE host with its installation', () => {
    const [p] = plan([dev('pve1', { tipo: 'hipervisor', marca: 'Proxmox', modelo: 'VE 9' })]);
    expect(p.configurar.map(s => s.id)).toEqual(['config:os-install', 'config:user-admin', 'config:ntp-client', 'config:vlan-bridge', 'config:snmp-monitoring', 'config:syslog-remote', 'config:config-backup']);
    expect(p.configurar[0]).toMatchObject({ texto: 'Instalar el sistema', href: './guias/#/p/proxmox-ve/os-install?equipo=pve1' });
  });

  it('starts a Synology NAS with its installation', () => {
    const [p] = plan([dev('nas1', { tipo: 'almacenamiento', marca: 'Synology', modelo: 'DS923+' })]);
    expect(p.configurar.map(s => s.id)).toEqual(['config:os-install', 'config:user-admin', 'config:ntp-client', 'config:snmp-monitoring', 'config:syslog-remote', 'config:config-backup']);
    expect(p.configurar[0].href).toBe('./guias/#/p/synology-dsm/os-install?equipo=nas1');
  });

  it('sets up a Veeam backup server from its installation to its own configuration backup', () => {
    const [p] = plan([dev('bkp1', { tipo: 'backup', marca: 'Veeam', modelo: 'Backup & Replication 13' })]);
    expect(p.configurar.map(s => s.id)).toEqual(['config:backup-install', 'config:backup-repository', 'config:backup-job', 'config:config-backup']);
    expect(p.configurar[0].href).toBe('./guias/#/p/veeam-br/backup-install?equipo=bkp1');
  });

  it('lists the guides of a FortiGate firewall in deployment order', () => {
    const [p] = plan([dev('fw', { tipo: 'firewall', marca: 'Fortinet', modelo: 'FortiGate 60F' })]);
    expect(p.configurar.map(s => s.id)).toEqual(['config:ntp-client', 'config:syslog-remote', 'config:config-backup']);
    expect(p.configurar[0].href).toBe('./guias/#/p/fortinet-fortigate/ntp-client?equipo=fw');
  });

  it('only lists the guides the platform has', () => {
    const [p] = plan([dev('sw01', { marca: 'Ruijie', modelo: 'RG-NBS3200-24GT4XS' })]);
    expect(p.configurar.map(s => s.id)).toEqual(['mgmt-ip', 'ntp-client', 'vlan-create', 'port-trunk', 'port-access', 'snmp-monitoring', 'syslog-remote', 'config-backup'].map(t => `config:${t}`));
  });

  it('has no configuration steps for devices the guides do not cover, and says why', () => {
    const [unknown] = plan([dev('sw01', { marca: 'Genérica', modelo: 'X1' })]);
    expect(unknown.guias.estado).toBe('modelo-desconocido');
    expect(unknown.configurar).toEqual([]);
    const [other] = plan([dev('srv', { tipo: 'servidor', marca: 'Dell', modelo: 'PowerEdge R650' })]);
    expect(other.guias.estado).toBe('tipo-sin-guias');
    expect(other.configurar).toEqual([]);
  });
});

describe('deploymentPlan Vigilar and Mantener', () => {
  it('takes the method, template and alerts of the type, with the vendor configuration when there is one', () => {
    const [p] = plan([dev('fw', { tipo: 'firewall', marca: 'Fortinet', modelo: 'FortiGate 60F' })]);
    const t = tipo('firewall');
    expect(p.vigilar).toEqual([
      { id: 'vigilar:metodo', texto: `Monitorización: ${t.metodo}`, detalles: [`Plantilla: ${t.plantillaZabbix}`, 'Configuración del fabricante: FortiGate (FortiOS 7.4, 7.6 y 8.0) · SNMPv3'] },
      { id: 'vigilar:alertas', texto: `Alertas: ${t.alertas.map(a => a.que).join(', ')}`, detalles: [] },
    ]);
  });

  it('leaves the vendor configuration out when no brand matches', () => {
    const [p] = plan([dev('srv', { tipo: 'servidor', marca: 'Genérica' })]);
    expect(p.vigilar[0].detalles).toEqual([`Plantilla: ${tipo('servidor').plantillaZabbix}`]);
  });

  it('turns each maintenance task of the type into a step with its frequency', () => {
    const [p] = plan([dev('sw01')]);
    expect(p.mantener).toEqual(tipo('switch').actuaciones.map(a => ({ id: `mantener:${slugify(a.que)}`, texto: a.que, detalles: [a.frecuencia] })));
  });

  it('gives every step of a device a distinct id', () => {
    const [p] = plan([dev('sw01', { marca: 'Cisco', modelo: 'Catalyst 1300-24P-4G' })]);
    const ids = planStepIds(p);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(p.configurar.length + p.vigilar.length + p.mantener.length);
  });
});
