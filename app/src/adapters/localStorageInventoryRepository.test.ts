import { describe, expect, it } from 'vitest';
import { createLocalStorageInventoryRepository } from './localStorageInventoryRepository';
import type { Device } from '../domain/types';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

const device = (id: string, overrides: Partial<Device> = {}): Device => ({
  id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...overrides,
});

describe('localStorage inventory repository', () => {
  it('returns an empty inventory when nothing is stored', async () => {
    const repo = createLocalStorageInventoryRepository(new MemoryStorage());
    expect(await repo.list()).toEqual([]);
  });

  it('persists saved devices so another instance on the same storage reads them', async () => {
    const storage = new MemoryStorage();
    await createLocalStorageInventoryRepository(storage).save(device('fw01', { tipo: 'firewall' }));
    expect(await createLocalStorageInventoryRepository(storage).list()).toEqual([device('fw01', { tipo: 'firewall' })]);
  });

  it('overwrites a device saved again with the same id', async () => {
    const repo = createLocalStorageInventoryRepository(new MemoryStorage());
    await repo.save(device('core'));
    await repo.save(device('core', { monitorizado: true }));
    expect(await repo.list()).toEqual([device('core', { monitorizado: true })]);
  });

  it('removes a device by id and keeps the rest', async () => {
    const repo = createLocalStorageInventoryRepository(new MemoryStorage());
    await repo.save(device('a'));
    await repo.save(device('b'));
    await repo.remove('a');
    expect(await repo.list()).toEqual([device('b')]);
  });

  it('treats corrupted or unexpected stored data as an empty inventory', async () => {
    const storage = new MemoryStorage();
    storage.setItem('mapa-infra:inventario', '{not json');
    expect(await createLocalStorageInventoryRepository(storage).list()).toEqual([]);
    storage.setItem('mapa-infra:inventario', '{"a":1}');
    expect(await createLocalStorageInventoryRepository(storage).list()).toEqual([]);
  });
});
