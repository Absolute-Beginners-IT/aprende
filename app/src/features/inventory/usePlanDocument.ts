import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoadedPlan, PlanChange, PlanRepository } from '../../ports/PlanRepository';
import { errorText } from './useInventory';

/** What a panel says while the stored plan cannot be changed from the map. */
export const PLAN_READ_ONLY = 'Mientras tanto, el plan de red no se puede cambiar desde el mapa, para no escribir encima del plan guardado.';

/**
 * The planner document as the panels of the map read it, kept up to date: read again when `revision` changes (the
 * inventory, where its switches come from) and when another tab saves. Only the newest read is shown, so a slow read
 * that finishes late never puts back an older plan, and a read that works clears the error of one that failed.
 * `change` applies one change to what is stored right now; a refusal is shown, never thrown.
 */
export function usePlanDocument(planRepository: PlanRepository, revision: unknown, onMessage: (message: string) => void) {
  const [loaded, setLoaded] = useState<LoadedPlan | null>(null);
  const [readError, setReadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const latest = useRef(0);

  const read = useCallback(async () => {
    const ticket = ++latest.current;
    try {
      const plan = await planRepository.load();
      if (ticket !== latest.current) return;
      setLoaded(plan);
      setReadError('');
    } catch (e) {
      if (ticket !== latest.current) return;
      // Blocked storage, for instance: say so and change nothing.
      setReadError(`No se ha podido leer el plan de red: ${errorText(e)}`);
    }
  }, [planRepository]);

  useEffect(() => {
    void read();
  }, [read, revision]);
  // Another tab (the guides' planner, or the map open twice) saved: show what is stored now.
  useEffect(() => {
    const onStorage = () => { void read(); };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      // A read still running when the panel closes is ignored.
      latest.current += 1;
    };
  }, [read]);

  const change = async (update: PlanChange, success: string) => {
    setSaveError('');
    try {
      await planRepository.apply(update);
      onMessage(success);
      await read();
      return true;
    } catch (e) {
      setSaveError(`No se ha guardado: ${errorText(e)}`);
      await read();
      return false;
    }
  };

  const problem = loaded?.problem;
  return {
    loaded,
    problem,
    /** True while the plan must not be changed: not read yet, unreadable, of a newer version or not readable now. */
    locked: Boolean(readError) || !loaded || Boolean(problem),
    /** The error of the last read or save, if any; the save error goes first. */
    errors: [saveError, readError].filter(Boolean),
    change,
    /** Forgets the error of the last save, for a host that moves to another panel; a read error stays until a read works. */
    clearSaveError: useCallback(() => setSaveError(''), []),
  };
}

/** What usePlanDocument gives a panel. */
export type PlanDocument = ReturnType<typeof usePlanDocument>;
