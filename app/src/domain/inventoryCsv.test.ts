import { describe, expect, it } from 'vitest';
import { parseInventoryCsv, toInventoryCsv } from './inventoryCsv';
import { fromInventoryV1 } from './topology';
import type { Link } from './types';

const HEADER = 'Nombre;Tipo;Marca;Modelo;IP_Gestion;Ubicacion;Rol;Criticidad;Uplink;Firmware;Fin_Soporte;Metodo_Monitorizacion;Monitorizado;Notas';

describe('parseInventoryCsv', () => {
  it('reads the toolkit inventory format and skips example rows', () => {
    const csv = `﻿${HEADER}\r\nEJEMPLO-FW01;firewall;Fortinet;100F;;;;Alta;;;;;No;borrar\r\nFW01;Firewall;Fortinet;FortiGate 100F;192.168.1.1;CPD;Perimetral;alta;;7.6.7;2030-01-31;SNMPv3;Sí;"Nota; con ""comillas"""\r\nCORE;switch;;;192.168.1.2;;;;FW01;;;;No;`;
    expect(parseInventoryCsv(csv)).toEqual([
      { id: 'fw01', nombre: 'FW01', tipo: 'firewall', criticidad: 'Alta', monitorizado: true, marca: 'Fortinet', modelo: 'FortiGate 100F', ip: '192.168.1.1', ubicacion: 'CPD', rol: 'Perimetral', firmware: '7.6.7', finSoporte: '2030-01-31', notas: 'Nota; con "comillas"' },
      { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Media', monitorizado: false, ip: '192.168.1.2', uplinks: ['fw01'] },
    ]);
  });

  it('maps unknown types to "otro" and accepts comma separators', () => {
    expect(parseInventoryCsv('Nombre,Tipo\nCam-01,camara IP')).toEqual([
      { id: 'cam-01', nombre: 'Cam-01', tipo: 'otro', criticidad: 'Media', monitorizado: false },
    ]);
  });

  it('recognises power strips as regletas and keeps reading SAIs', () => {
    const csv = ['Nombre,Tipo', 'R1,Regleta', 'R2,PDU', 'R3,Power strip', 'R4,PDU del SAI', 'U1,SAI', 'U2,UPS APC'].join('\n');
    expect(parseInventoryCsv(csv).map(d => [d.nombre, d.tipo])).toEqual([
      ['R1', 'regleta'], ['R2', 'regleta'], ['R3', 'regleta'], ['R4', 'regleta'], ['U1', 'sai'], ['U2', 'sai'],
    ]);
  });

  it('returns nothing for empty input', () => {
    expect(parseInventoryCsv('   ')).toEqual([]);
  });
});

describe('toInventoryCsv', () => {
  it('writes the toolkit format and round-trips through the parser', () => {
    const devices = parseInventoryCsv(`${HEADER}\nFW01;firewall;;;10.0.0.1;;;Alta;;;;;Sí;a;b`);
    const csv = toInventoryCsv(fromInventoryV1(devices));
    expect(csv.split('\r\n')[0]).toBe(`﻿${HEADER}`);
    expect(parseInventoryCsv(csv)).toEqual(devices);
  });

  it('round-trips values that start with formula characters or an apostrophe unchanged', () => {
    const tricky = ['=SUM(A1)', '+34 600 000 000', '-', '@admin', "'=already quoted", "'normal"];
    const devices = tricky.map((notas, i) => ({ id: `d${i}`, nombre: `D${i}`, tipo: 'otro', criticidad: 'Baja' as const, monitorizado: false, notas }));
    expect(parseInventoryCsv(toInventoryCsv(fromInventoryV1(devices))).map(d => d.notas)).toEqual(tricky);
  });

  it('neutralises spreadsheet formulas so Excel does not execute them', () => {
    const csv = toInventoryCsv({ equipos: [{ id: 'x', nombre: '=HYPERLINK("http://evil")', tipo: 'otro', criticidad: 'Baja', monitorizado: false, notas: '+cmd|calc' }], enlaces: [], grupos: [] });
    const row = csv.split('\r\n')[1];
    expect(row.startsWith(`"'=HYPERLINK(""http://evil"")"`)).toBe(true);
    expect(row.endsWith("'+cmd|calc")).toBe(true);
  });

  it('round-trips what each device hangs from through the Uplink column', () => {
    const devices = parseInventoryCsv(`${HEADER}\nCORE;switch;;;;;;;FW01,FW02;;;;No;\nFW01;firewall;;;;;;;;;;;No;`);
    expect(parseInventoryCsv(toInventoryCsv(fromInventoryV1(devices)))).toEqual(devices);
  });

  it('lists in the Uplink column the devices it hangs from by hierarchical links only, missing ones included', () => {
    const link = (id: string, a: string, b: string, tipo: Link['tipo']): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo });
    const core = { id: 'core', nombre: 'CORE', tipo: 'switch', criticidad: 'Media' as const, monitorizado: false };
    const csv = toInventoryCsv({ equipos: [core], enlaces: [link('1', 'core', 'fw1', 'lag'), link('2', 'core', 'fw1', 'troncal'), link('3', 'core', 'core2', 'stack'), link('4', 'core', 'gone', 'datos'), link('5', 'p1', 'core', 'datos')], grupos: [] });
    expect(csv.split('\r\n')[1]).toBe('CORE;switch;;;;;;Media;fw1,gone;;;;No;');
  });
});
