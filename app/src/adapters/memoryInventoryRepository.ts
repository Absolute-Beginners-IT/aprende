import type { Topology } from '../domain/types';
import { applyTopologyChange, emptyTopology } from '../domain/topology';
import type { InventoryRepository } from '../ports/InventoryRepository';

/** A repository that keeps the topology in memory, for tests and previews; `topology` is what it holds right now. */
export function createMemoryInventoryRepository(initial: Topology = emptyTopology()): InventoryRepository & { readonly topology: Topology } {
  let topology = initial;
  return {
    get topology() { return topology; },
    async load() { return topology; },
    async apply(change) { topology = applyTopologyChange(topology, change); },
  };
}
