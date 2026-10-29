import type { Device } from './types';
import { content } from '../content';

// Same column layout as toolkit/01-Inventario/inventario.csv and the Descubrir-Red.ps1 output.
const COLUMNS = ['Nombre', 'Tipo', 'Marca', 'Modelo', 'IP_Gestion', 'Ubicacion', 'Rol', 'Criticidad', 'Uplink', 'Firmware', 'Fin_Soporte', 'Metodo_Monitorizacion', 'Monitorizado', 'Notas'];
const OPTIONAL = { marca: 'marca', modelo: 'modelo', ip_gestion: 'ip', ip: 'ip', ubicacion: 'ubicacion', rol: 'rol', firmware: 'firmware', fin_soporte: 'finSoporte', notas: 'notas' } as const;

const KNOWN_TYPES = new Set(content.tipos.map(t => t.id));
const TYPE_HINTS: [RegExp, string][] = [
  [/fire|fw/, 'firewall'], [/switch/, 'switch'], [/hiper|esx|hyper|proxmox|host/, 'hipervisor'], [/\bvm\b|virtual/, 'vm'],
  [/serv/, 'servidor'], [/nas|cabina|almac|san/, 'almacenamiento'], [/back|copia/, 'backup'], [/sai|ups/, 'sai'],
  [/wifi|\bap\b|wlan/, 'wifi'], [/router/, 'router'], [/impres|print/, 'impresora'], [/internet|isp|wan/, 'internet'],
];

// Matches the single apostrophe added by cell() in front of a formula-like value.
const FORMULA_GUARDED = /^'(?='*[=+\-@\t\r])/;

const stripAccents =(s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const slugify = (s: string) => stripAccents(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

function normalizeType(raw: string): string {
  const t = stripAccents(raw).toLowerCase().trim();
  if (KNOWN_TYPES.has(t)) return t;
  return TYPE_HINTS.find(([re]) => re.test(t))?.[1] ?? 'otro';
}

function splitRows(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  row.push(cell); rows.push(row);
  return rows;
}

export function parseInventoryCsv(text: string): Device[] {
  const clean = text.replace(/^﻿/, '').trim();
  if (!clean) return [];
  const first = clean.split(/\r?\n/)[0];
  const sep = (first.match(/;/g) ?? []).length >= (first.match(/,/g) ?? []).length ? ';' : ',';
  const [head, ...rows] = splitRows(clean, sep);
  const keys = head.map(h => stripAccents(h).trim().toLowerCase());

  const devices: Device[] = [];
  for (const cells of rows) {
    // Undo the formula guard added by toInventoryCsv so data round-trips.
    const r = Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? '').trim().replace(FORMULA_GUARDED, '')]));
    const nombre = r.nombre ?? '';
    if (!nombre || /^EJEMPLO-/i.test(nombre)) continue;
    const device: Device = {
      id: slugify(nombre),
      nombre,
      tipo: normalizeType(r.tipo ?? ''),
      criticidad: (['Alta', 'Media', 'Baja'] as const).find(c => c.toLowerCase() === (r.criticidad ?? '').toLowerCase()) ?? 'Media',
      monitorizado: /^s/i.test(r.monitorizado ?? ''),
    };
    for (const [col, field] of Object.entries(OPTIONAL)) if (r[col]) device[field] = r[col];
    const uplinks = (r.uplink ?? '').split(/[,|]/).map(u => slugify(u)).filter(Boolean);
    if (uplinks.length) device.uplinks = uplinks;
    devices.push(device);
  }
  return devices;
}

/**
 * Quotes a cell and neutralises leading =, +, -, @, tab or CR so spreadsheets never run it as a formula.
 * Values that already start with apostrophes before one of those get one more, so the parser can
 * strip exactly one and every value round-trips unchanged.
 */
function cell(value: string | undefined): string {
  let v = value ?? '';
  if (/^'*[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toInventoryCsv(devices: Device[]): string {
  const rows = devices.map(d => [
    d.nombre, d.tipo, d.marca, d.modelo, d.ip, d.ubicacion, d.rol, d.criticidad, (d.uplinks ?? []).join(','),
    d.firmware, d.finSoporte, undefined, d.monitorizado ? 'Sí' : 'No', d.notas,
  ].map(cell).join(';'));
  return '﻿' + [COLUMNS.join(';'), ...rows].join('\r\n');
}
