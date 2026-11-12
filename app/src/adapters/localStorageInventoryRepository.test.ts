import { describe, expect, it } from 'vitest';
import { createLocalStorageInventoryRepository } from './localStorageInventoryRepository';
import type { Device, Link } from '../domain/types';

const TOPOLOGY_KEY = 'mapa-infra:topologia';
const V1_KEY = 'mapa-infra:inventario';

class MemoryStorage {
  data = new Map<string, string>();
  writes: string[] = [];
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes.push(key); this.data.set(key, value); }
}

const device = (id: string, overrides: Partial<Device> = {}): Device => ({
  id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...overrides,
});
const link = (id: string, a: string, b: string, tipo: Link['tipo'] = 'datos'): Link => ({ id, a: { equipo: a }, b: { equipo: b }, tipo });
const stored = (storage: MemoryStorage) => JSON.parse(storage.data.get(TOPOLOGY_KEY) ?? 'null');
const EMPTY = { equipos: [], enlaces: [], grupos: [] };

describe('localStorage inventory repository', () => {
  it('returns an empty topology when nothing is stored', async () => {
    const repo = createLocalStorageInventoryRepository(new MemoryStorage());
    expect(await repo.load()).toEqual(EMPTY);
  });

  it('stores every change as one write of the whole version 2 document, which another instance reads', async () => {
    const storage = new MemoryStorage();
    await createLocalStorageInventoryRepository(storage).apply({ saveDevices: [device('fw01', { tipo: 'firewall' }), device('core')], addLinks: [{ a: { equipo: 'core' }, b: { equipo: 'fw01' }, tipo: 'datos' }] });
    expect(storage.writes).toEqual([TOPOLOGY_KEY]);
    expect(stored(storage)).toEqual({ version: 2, equipos: [device('fw01', { tipo: 'firewall' }), device('core')], enlaces: [link('core--fw01', 'core', 'fw01')], grupos: [] });
    expect(await createLocalStorageInventoryRepository(storage).load()).toEqual({ equipos: [device('fw01', { tipo: 'firewall' }), device('core')], enlaces: [link('core--fw01', 'core', 'fw01')], grupos: [] });
  });

  it('migrates the old inventory when there is no version 2 document, and never touches the old key', async () => {
    const storage = new MemoryStorage();
    const old = JSON.stringify([{ ...device('core'), uplinks: ['fw', 'fw', 'gone'] }, device('fw')]);
    storage.data.set(V1_KEY, old);
    const repo = createLocalStorageInventoryRepository(storage);
    expect(await repo.load()).toEqual({ equipos: [device('core'), device('fw')], enlaces: [link('core--fw', 'core', 'fw'), link('core--gone', 'core', 'gone')], grupos: [] });
    expect(storage.writes).toEqual([]);

    await repo.apply({ saveDevices: [device('core', { monitorizado: true })] });
    expect(storage.writes).toEqual([TOPOLOGY_KEY]);
    expect(stored(storage).enlaces).toEqual([link('core--fw', 'core', 'fw'), link('core--gone', 'core', 'gone')]);
    expect(storage.data.get(V1_KEY)).toBe(old);
  });

  it('prefers the version 2 document over the old inventory', async () => {
    const storage = new MemoryStorage();
    storage.data.set(V1_KEY, JSON.stringify([device('old')]));
    storage.data.set(TOPOLOGY_KEY, JSON.stringify({ version: 2, equipos: [device('new')], enlaces: [], grupos: [] }));
    expect((await createLocalStorageInventoryRepository(storage).load()).equipos).toEqual([device('new')]);
  });

  it('treats corrupted or foreign stored data as an empty topology', async () => {
    const storage = new MemoryStorage();
    storage.data.set(V1_KEY, '{not json');
    expect(await createLocalStorageInventoryRepository(storage).load()).toEqual(EMPTY);
    storage.data.set(V1_KEY, '{"a":1}');
    expect(await createLocalStorageInventoryRepository(storage).load()).toEqual(EMPTY);
    storage.data.set(TOPOLOGY_KEY, '{"version":7}');
    storage.data.set(V1_KEY, JSON.stringify([device('old')]));
    expect(await createLocalStorageInventoryRepository(storage).load()).toEqual(EMPTY);
    storage.data.set(TOPOLOGY_KEY, '[roto');
    expect(await createLocalStorageInventoryRepository(storage).load()).toEqual(EMPTY);
  });

  it('removes a device with its links and group membership in the same single write', async () => {
    const storage = new MemoryStorage();
    storage.data.set(TOPOLOGY_KEY, JSON.stringify({
      version: 2, equipos: [device('fw1'), device('fw2'), device('core')],
      enlaces: [link('core--fw1', 'core', 'fw1'), link('fw1--fw2', 'fw1', 'fw2', 'ha')],
      grupos: [{ id: 'par', tipo: 'ha', nombre: 'Par', miembros: ['fw1', 'fw2'] }],
    }));
    await createLocalStorageInventoryRepository(storage).apply({ removeDevices: ['fw1'] });
    expect(storage.writes).toEqual([TOPOLOGY_KEY]);
    expect(stored(storage)).toEqual({ version: 2, equipos: [device('fw2'), device('core')], enlaces: [], grupos: [{ id: 'par', tipo: 'ha', nombre: 'Par', miembros: ['fw2'] }] });
  });

  it('leaves the stored document as it was when the browser refuses the write', async () => {
    const storage = new MemoryStorage();
    await createLocalStorageInventoryRepository(storage).apply({ saveDevices: [device('core')] });
    const before = storage.data.get(TOPOLOGY_KEY);
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    await expect(createLocalStorageInventoryRepository(storage).apply({ removeDevices: ['core'] })).rejects.toThrow('QuotaExceededError');
    expect(storage.data.get(TOPOLOGY_KEY)).toBe(before);
  });

  it('replaces the whole topology in one write and never touches the old inventory', async () => {
    const storage = new MemoryStorage();
    const old = JSON.stringify([{ ...device('old'), uplinks: ['gone'] }]);
    storage.data.set(V1_KEY, old);
    storage.data.set(TOPOLOGY_KEY, JSON.stringify({ version: 2, equipos: [device('core')], enlaces: [], grupos: [] }));
    const incoming = { equipos: [device('fw1'), device('fw2')], enlaces: [link('fw1--fw2', 'fw1', 'fw2', 'ha')], grupos: [{ id: 'grupo-1', tipo: 'ha' as const, nombre: 'Par', miembros: ['fw1', 'fw2'] }] };
    await createLocalStorageInventoryRepository(storage).apply({ replace: incoming });
    expect(storage.writes).toEqual([TOPOLOGY_KEY]);
    expect(stored(storage)).toEqual({ version: 2, ...incoming });
    expect(storage.data.get(V1_KEY)).toBe(old);
  });
});

describe('a document from a newer version of the app', () => {
  it('refuses to write over it and leaves it exactly as it was', async () => {
    const storage = new MemoryStorage();
    const newer = JSON.stringify({ version: 3, equipos: [device('fw')], enlaces: [], grupos: [], extra: true });
    storage.data.set(TOPOLOGY_KEY, newer);
    const repository = createLocalStorageInventoryRepository(storage);
    await expect(repository.apply({ saveDevices: [device('core')] })).rejects.toThrow(
      'El mapa guardado en este navegador es de una versión más nueva de la app; no se ha tocado.',
    );
    expect(storage.data.get(TOPOLOGY_KEY)).toBe(newer);
    expect(storage.writes).toEqual([]);
  });

  it('still writes over corrupted data and over documents with no version, as before', async () => {
    for (const text of ['[roto', '{"a":1}', '{"version":"3"}']) {
      const storage = new MemoryStorage();
      storage.data.set(TOPOLOGY_KEY, text);
      await createLocalStorageInventoryRepository(storage).apply({ saveDevices: [device('core')] });
      expect(stored(storage)).toEqual({ version: 2, equipos: [device('core')], enlaces: [], grupos: [] });
    }
  });
});
