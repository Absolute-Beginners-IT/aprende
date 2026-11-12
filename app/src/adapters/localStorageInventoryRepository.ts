import type { Topology } from '../domain/types';
import { applyTopologyChange, emptyTopology, fromInventoryV1, fromStoredTopology, topologyDocument } from '../domain/topology';
import type { InventoryRepository } from '../ports/InventoryRepository';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The version 2 document: `{ version: 2, equipos, enlaces, grupos }`. The guides' planner reads it too. */
export const TOPOLOGY_KEY = 'mapa-infra:topologia';
/** The first inventory, a list of devices with `uplinks`: read only to migrate it, never deleted or rewritten. */
export const INVENTORY_V1_KEY = 'mapa-infra:inventario';

const parse = (text: string): unknown => {
  try { return JSON.parse(text); } catch { return undefined; }
};

/** A document written by a later version of the app: this one cannot read it, so it must not write over it. */
const isNewerDocument = (raw: unknown) => typeof raw === 'object' && raw !== null
  && typeof (raw as { version?: unknown }).version === 'number' && (raw as { version: number }).version > 2;

export function createLocalStorageInventoryRepository(storage: KeyValueStorage): InventoryRepository {
  const read = (): Topology => {
    const stored = storage.getItem(TOPOLOGY_KEY);
    if (stored !== null) return fromStoredTopology(parse(stored));
    const old = storage.getItem(INVENTORY_V1_KEY);
    return old === null ? emptyTopology() : fromInventoryV1(parse(old));
  };

  return {
    async load() {
      return read();
    },
    async apply(change) {
      if (isNewerDocument(parse(storage.getItem(TOPOLOGY_KEY) ?? 'null'))) {
        throw new Error('El mapa guardado en este navegador es de una versión más nueva de la app; no se ha tocado.');
      }
      // One setItem of the whole document: if the browser refuses the write, what is stored stays exactly as it was.
      const next = applyTopologyChange(read(), change);
      storage.setItem(TOPOLOGY_KEY, JSON.stringify(topologyDocument(next)));
    },
  };
}
