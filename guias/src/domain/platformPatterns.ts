// Brand plus the model line each platform's runbooks were written for. A brand alone is not enough:
// an Aruba 2930F runs AOS-S and a Catalyst 9200 runs IOS-XE, where these commands would be wrong.
export const PLATFORM_PATTERNS: Record<string, RegExp> = {
  'aruba-aoscx': /aos-?cx|\bcx\s?\d{4}|\b(4100i|6[0-4]\d\d[a-z]{0,2}|8[1-4]\d\d)\b/i,
  'cisco-c1300': /\bc1300\b|\b(catalyst|cisco)\s*1300\b|\bcatalyst\s*1300-/i,
  'mikrotik-routeros': /\bcrs\d|routeros/i,
  'ruijie-reyee': /reyee|\brg-nbs|\bnbs\d/i,
  'fortinet-fortigate': /fortigate|fortios|\bfgt-?\d/i,
  'proxmox-ve': /proxmox|\bpve\b/i,
  'synology-dsm': /synology|diskstation|rackstation|\b(ds|rs)\d{3,4}/i,
  'veeam-br': /veeam|\bvbr\b/i,
}

/** The first of `platformIds` whose pattern recognises the brand and model text, or '' when none does. */
export function matchPlatform(text: string, platformIds: readonly string[]): string {
  const match = Object.entries(PLATFORM_PATTERNS).find(
    ([id, pattern]) => pattern.test(text) && platformIds.includes(id),
  )
  return match?.[0] ?? ''
}
