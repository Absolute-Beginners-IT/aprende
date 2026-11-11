import { useEffect, useRef, useState } from 'react';
import type { Topology } from '../../domain/types';
import { emptyTopology } from '../../domain/topology';
import type { InventoryRepository } from '../../ports/InventoryRepository';

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The learner's topology as stored behind the repository port, shared by the map, the list and the deployment plan. */
export function useInventory(repository: InventoryRepository) {
  const [topology, setTopology] = useState<Topology>(emptyTopology);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const reload = async () => {
    try { setTopology(await repository.load()); }
    catch (e) { setMessage(`No se ha podido leer el inventario guardado: ${errorText(e)}`); }
    setLoaded(true);
  };
  // Every write goes through here so a full or blocked browser storage is reported, never swallowed.
  // Writes run one after another: a write that reads the stored topology first never races with the previous one.
  // `success` may be worked out after the write, when the message names what the write created.
  const persist = (write: () => Promise<void>, success: string | (() => string)) => {
    const run = queue.current.then(async () => {
      let ok = true;
      try { await write(); setMessage(typeof success === 'function' ? success() : success); }
      catch (e) { ok = false; setMessage(`No se ha podido guardar en este navegador: ${errorText(e)}`); }
      await reload();
      return ok;
    });
    queue.current = run;
    return run;
  };
  useEffect(() => { void reload(); }, [repository]);

  return { topology, devices: topology.equipos, loaded, message, setMessage, persist };
}
