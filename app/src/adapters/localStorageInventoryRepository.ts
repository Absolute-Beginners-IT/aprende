import type { Device } from '../domain/types';
import type { InventoryRepository } from '../ports/InventoryRepository';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'mapa-infra:inventario';

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
      write([...read().filter(d => d.id !== device.id), device]);
    },
    async remove(id) {
      write(read().filter(d => d.id !== id));
    },
  };
}
