import type { Device, VendorSnippet } from './types';

const MAX_SNIPPETS = 3;

// The AOS-CX and AOS-S patterns overlap ("HPE Aruba 6300" matches both); the content lists the
// most specific first, so only the first match of each family is kept.
const family = (s: VendorSnippet) => s.nombre.split(' ')[0] + (s.nombre.includes('AOS') ? ' AOS' : '');

/** Vendor configurations that apply to a device, from its brand, model and firmware (as the legacy prototype did). */
export function snippetsForDevice(device: Device, snippets: VendorSnippet[]): VendorSnippet[] {
  const text = [device.marca, device.modelo, device.firmware].filter(Boolean).join(' ');
  if (!text) return [];
  const seen = new Set<string>();
  return snippets.filter(s => {
    if (!s.tipos.includes(device.tipo) || !new RegExp(s.patron, s.flags).test(text)) return false;
    if (seen.has(family(s))) return false;
    seen.add(family(s));
    return true;
  }).slice(0, MAX_SNIPPETS);
}
