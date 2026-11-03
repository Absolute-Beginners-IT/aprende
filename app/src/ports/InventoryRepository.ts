import type { Device } from '../domain/types';

/**
 * Storage port for the learner's inventory. Today it is backed by localStorage;
 * a future HTTP adapter against api.example.com must honour the same contract,
 * so the UI never knows where the data lives.
 */
export interface InventoryRepository {
  list(): Promise<Device[]>;
  save(device: Device): Promise<void>;
  /** Saves several devices together: either all of them are stored or, on failure, none is. */
  saveAll(devices: Device[]): Promise<void>;
  remove(id: string): Promise<void>;
}
