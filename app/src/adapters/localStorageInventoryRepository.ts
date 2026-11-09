import type { Device } from '../domain/types';
import type { InventoryRepository } from '../ports/InventoryRepository';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'mapa-infra:inventario';

/** The stored inventory with `devices` saved and `removedIds` gone: saved devices keep their place, new ones go last. */
function merge(stored: Device[], devices: Device[], removedIds: string[] = []): Device[] {
  const incoming = new Map(devices.map(d => [d.id, d]));
  const removed = new Set(removedIds);
  const known = new Set(stored.map(d => d.id));
  return [
    ...stored.filter(d => incoming.has(d.id) || !removed.has(d.id)).map(d => incoming.get(d.id) ?? d),
    ...[...incoming.values()].filter(d => !known.has(d.id)),
  ];
}

export function createLocalStorageInventoryRepository(storage: KeyValueStorage): InventoryRepository {
  const read = (): Device[] => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as Device[]) : [];
    } catch {
      return [];
    }
  };
  const write = (devices: Device[]) => storage.setItem(STORAGE_KEY, JSON.stringify(devices));

  return {
    async list() {
      return read();
    },
    async save(device) {
      write(merge(read(), [device]));
    },
    async saveAll(devices, removedIds = []) {
      // One setItem: if the browser refuses the write, the stored inventory stays exactly as it was.
      write(merge(read(), devices, removedIds));
    },
    async remove(id) {
      write(read().filter(d => d.id !== id));
    },
  };
}
