import { describe, expect, it } from 'vitest';
import { snippetsForDevice } from './vendorSnippets';
import { content } from '../content';
import type { Device } from './types';

const dev = (tipo: string, overrides: Partial<Device> = {}): Device => ({
  id: 'x', nombre: 'X', tipo, criticidad: 'Media', monitorizado: false, ...overrides,
});
const names = (d: Device) => snippetsForDevice(d, content.fabricantes).map(s => s.nombre);

describe('snippetsForDevice', () => {
  it('finds the configuration for the brand, model or firmware of the device', () => {
    expect(names(dev('firewall', { marca: 'Fortinet', modelo: 'FortiGate 100F' }))).toEqual(['FortiGate (FortiOS 7.4, 7.6 y 8.0) · SNMPv3']);
    expect(names(dev('switch', { modelo: 'Catalyst 9200' }))).toEqual(['Cisco IOS / IOS-XE · SNMPv3']);
    expect(names(dev('hipervisor', { firmware: 'Proxmox VE 8.2' }))).toEqual(['Proxmox VE · API']);
  });

  it('only offers configurations that apply to the device type', () => {
    // "HPE" also matches the AOS-S switch pattern: a server must get iLO, never a switch configuration.
    expect(names(dev('servidor', { marca: 'HPE', modelo: 'ProLiant DL380 Gen11' }))).toEqual(['HPE iLO · Redfish']);
    expect(names(dev('switch', { marca: 'Dell', modelo: 'PowerSwitch N3248' }))).toEqual([]);
  });

  it('keeps only the most specific Aruba configuration when AOS-CX and AOS-S both match', () => {
    expect(names(dev('switch', { marca: 'HPE Aruba', modelo: '6300M' }))).toEqual(['HPE Aruba AOS-CX · SNMPv3']);
    expect(names(dev('switch', { marca: 'HPE Aruba', modelo: '2930F' }))).toEqual(['HPE Aruba AOS-S (2530, 2930F…, gama anterior) · SNMPv3']);
  });

  it('offers nothing when the device has no brand, model or firmware', () => {
    expect(names(dev('switch'))).toEqual([]);
    expect(names(dev('switch', { nombre: 'cisco-core' }))).toEqual([]);
  });

  it('returns at most three configurations', () => {
    expect(names(dev('servidor', { marca: 'Dell', modelo: 'PowerEdge R760 HPE ProLiant', firmware: 'Windows Server 2025 Hyper-V' })).length).toBeLessThanOrEqual(3);
  });
});
