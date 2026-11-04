// Done steps of the deployment plan, per device id. They live only in this browser, next to the inventory.

export const PROGRESS_KEY = 'mapa-infra:despliegue';

export type Progress = Record<string, string[]>;
type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The saved progress; anything unreadable (bad JSON, another shape, blocked storage) counts as nothing done. */
export function readProgress(storage: KeyValueStorage): Progress {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PROGRESS_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, ids]) => Array.isArray(ids))
      .map(([id, ids]) => [id, (ids as unknown[]).filter((s): s is string => typeof s === 'string')]));
  } catch {
    return {};
  }
}

/** Throws when the browser refuses the write, so the page can say so. */
export const writeProgress = (storage: KeyValueStorage, progress: Progress) => storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
