import { describe, expect, it } from 'vitest';
import { addToVlanList, carriedVlans, unknownListedVlans, vlanGaps, type NetworkPlan } from '@shared/plan';

// core ← dist ← floor, plus a second floor switch hanging straight from the core.
const plan = (): NetworkPlan => ({
  version: 1,
  vlans: [
    { id: 10, name: 'USUARIOS', purpose: 'users', subnet: '' },
    { id: 20, name: 'VOZ', purpose: 'voice', subnet: '' },
    { id: 30, name: 'CAMARAS', purpose: 'cameras', subnet: '' },
    { id: 99, name: 'GESTION', purpose: 'management', subnet: '' },
  ],
  switches: ['core', 'dist', 'floor', 'floor2'].map(id => ({ id, name: id.toUpperCase(), platform: '', mgmtIp: '', gateway: '', bridge: '' })),
  links: [
    { id: 'ln-1', a: { switch: 'core', interface: '' }, b: { switch: 'dist', interface: '' }, nativeVlan: 1 },
    { id: 'ln-2', a: { switch: 'dist', interface: '' }, b: { switch: 'floor', interface: '' }, nativeVlan: 99 },
    { id: 'ln-3', a: { switch: 'core', interface: '' }, b: { switch: 'floor2', interface: '' }, nativeVlan: 1 },
  ],
  ports: [
    { id: 'pt-1', switch: 'floor', interface: 'gi1', vlan: 30 },
    { id: 'pt-2', switch: 'floor', interface: 'gi2', vlan: 30 },
    { id: 'pt-3', switch: 'floor', interface: 'gi3', vlan: 10 },
    { id: 'pt-4', switch: 'dist', interface: 'gi4', vlan: 30 },
    { id: 'pt-5', switch: 'floor2', interface: 'gi5', vlan: 20 },
    // A VLAN the plan does not have is validatePlan's business, never a gap.
    { id: 'pt-6', switch: 'floor2', interface: 'gi6', vlan: 77 },
  ],
});

describe('carriedVlans', () => {
  it('is the list plus the native VLAN for a valid list, and every plan VLAN for none, an empty or an invalid one', () => {
    const link = plan().links[1];
    const all = [10, 20, 30, 99];
    expect([...carriedVlans(link, all, new Map([['ln-2', '10, 20']]))].sort((a, b) => a - b)).toEqual([10, 20, 99]);
    for (const lists of [new Map(), new Map([['ln-2', '']]), new Map([['ln-2', 'todas']])]) {
      expect([...carriedVlans(link, all, lists)]).toEqual(all);
    }
  });
});

describe('vlanGaps', () => {
  it('finds each trunk on the way to the core that leaves out a VLAN with access ports behind it', () => {
    // ln-1 carries only 10: VLAN 30 of dist and floor stops there. ln-2 carries 10 and 30 (+ native 99).
    const lists = new Map([['ln-1', '10'], ['ln-2', '10, 30']]);
    expect(vlanGaps(plan(), lists)).toEqual([{ vlan: 30, link: 'ln-1', switches: ['dist', 'floor'], ports: 3 }]);
  });

  it('flags every link of the path that leaves the VLAN out, nearest first', () => {
    const lists = new Map([['ln-1', '10'], ['ln-2', '10']]);
    expect(vlanGaps(plan(), lists)).toEqual([
      { vlan: 30, link: 'ln-1', switches: ['dist', 'floor'], ports: 3 },
      { vlan: 30, link: 'ln-2', switches: ['floor'], ports: 2 },
    ]);
  });

  it('never finds a gap through a trunk with no list, an empty one or one that cannot be read', () => {
    expect(vlanGaps(plan())).toEqual([]);
    expect(vlanGaps(plan(), new Map([['ln-1', ''], ['ln-2', '10-x'], ['ln-3', '']]))).toEqual([]);
  });

  it('counts the native VLAN as carried, and ignores the core and switches with no way to it', () => {
    const p = plan();
    p.ports.push({ id: 'pt-7', switch: 'floor', interface: 'gi7', vlan: 99 }, { id: 'pt-8', switch: 'core', interface: 'gi8', vlan: 30 });
    p.switches.push({ id: 'lonely', name: 'LONELY', platform: '', mgmtIp: '', gateway: '', bridge: '' });
    p.ports.push({ id: 'pt-9', switch: 'lonely', interface: 'gi9', vlan: 30 });
    expect(vlanGaps(p, new Map([['ln-2', '10, 30']]))).toEqual([]);
  });
});

describe('unknownListedVlans', () => {
  it('names the VLANs of a list the plan does not have, leaving VLAN 1 aside', () => {
    expect(unknownListedVlans(plan(), new Map([['ln-1', '1, 10, 40-41'], ['ln-2', '10, 20'], ['ln-3', 'x']]))).toEqual([{ link: 'ln-1', vlans: [40, 41] }]);
  });
});

describe('addToVlanList', () => {
  it('appends the VLAN in the format the list is read in, and keeps a list that has it or is empty', () => {
    expect(addToVlanList('10, 20-22', 30)).toBe('10, 20-22, 30');
    expect(addToVlanList(' 10 ', 30)).toBe('10, 30');
    expect(addToVlanList('10, 20-22', 21)).toBe('10, 20-22');
    expect(addToVlanList('', 30)).toBe('');
    expect(() => addToVlanList('10-x', 30)).toThrow('«10-x» no es un número de VLAN.');
  });
});
