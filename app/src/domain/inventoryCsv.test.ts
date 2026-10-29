import { describe, expect, it } from 'vitest';
import { parseInventoryCsv, toInventoryCsv } from './inventoryCsv';

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

  it('returns nothing for empty input', () => {
    expect(parseInventoryCsv('   ')).toEqual([]);
  });
});

describe('toInventoryCsv', () => {
  it('writes the toolkit format and round-trips through the parser', () => {
    const devices = parseInventoryCsv(`${HEADER}\nFW01;firewall;;;10.0.0.1;;;Alta;;;;;Sí;a;b`);
    const csv = toInventoryCsv(devices);
    expect(csv.split('\r\n')[0]).toBe(`﻿${HEADER}`);
    expect(parseInventoryCsv(csv)).toEqual(devices);
  });

  it('round-trips values that start with formula characters or an apostrophe unchanged', () => {
    const tricky = ['=SUM(A1)', '+34 600 000 000', '-', '@admin', "'=already quoted", "'normal"];
    const devices = tricky.map((notas, i) => ({ id: `d${i}`, nombre: `D${i}`, tipo: 'otro', criticidad: 'Baja' as const, monitorizado: false, notas }));
    expect(parseInventoryCsv(toInventoryCsv(devices)).map(d => d.notas)).toEqual(tricky);
  });

  it('neutralises spreadsheet formulas so Excel does not execute them', () => {
    const csv = toInventoryCsv([{ id: 'x', nombre: '=HYPERLINK("http://evil")', tipo: 'otro', criticidad: 'Baja', monitorizado: false, notas: '+cmd|calc' }]);
    const row = csv.split('\r\n')[1];
    expect(row.startsWith(`"'=HYPERLINK(""http://evil"")"`)).toBe(true);
    expect(row.endsWith("'+cmd|calc")).toBe(true);
  });
});
