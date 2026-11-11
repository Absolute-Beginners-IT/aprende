import type { Topology } from '../domain/types';
import type { TopologyChange } from '../domain/topology';

/**
 * Storage port for the learner's infrastructure: devices, links and groups. Today it is backed by localStorage;
 * a future HTTP adapter against api.example.com must honour the same contract, so the UI never knows where the data lives.
 */
export interface InventoryRepository {
  load(): Promise<Topology>;
  /** Applies one change to what is stored right now and stores the result as one write: on failure, nothing is stored. */
  apply(change: TopologyChange): Promise<void>;
}
