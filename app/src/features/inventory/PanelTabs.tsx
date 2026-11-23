import { useRef, type KeyboardEvent } from 'react';

export interface PanelTab<T extends string> { id: T; nombre: string }

/**
 * The tabs of the right-hand panel. Arrow keys, Home and End move between them, as in the views of the map. Each tab
 * controls the panel `${idPrefix}-${id}` (only the selected one is drawn) and is named `${idPrefix}-tab-${id}`, so the panel can point back at it.
 */
export function PanelTabs<T extends string>({ tabs, tab, onTab, idPrefix, label }: {
  tabs: PanelTab<T>[]; tab: T; onTab: (tab: T) => void; idPrefix: string; label: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const keys: Record<string, number> = { ArrowLeft: index ? index - 1 : last, ArrowRight: index === last ? 0 : index + 1, Home: 0, End: last };
    const next = keys[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onTab(tabs[next].id);
    buttons.current[next]?.focus();
  };
  return (
    <div className="infra-views infra-network__tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={el => { buttons.current[i] = el; }} type="button" role="tab" id={`${idPrefix}-tab-${t.id}`} aria-selected={tab === t.id}
          aria-controls={tab === t.id ? `${idPrefix}-${t.id}` : undefined} tabIndex={tab === t.id ? 0 : -1} onClick={() => onTab(t.id)} onKeyDown={e => move(e, i)}>
          {t.nombre}
        </button>
      ))}
    </div>
  );
}
