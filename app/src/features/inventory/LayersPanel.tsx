import type { VlanLayer } from './vlanLayers';

/** What the map draws over the devices and lines, each with its toggle in «Capas». */
export interface MapOverlays { power: boolean; ip: boolean; ports: boolean }

/** How the learner looks at the map in «Capas»: kept in this browser, never in the plan or the inventory. */
export interface LayerChoices {
  /** The tab of the left column. */
  tab: 'formas' | 'capas';
  /** The VLAN whose lines and devices are lit; null shows the cabling as usual. */
  picked: number | null;
  /** VLANs whose gap warnings are not drawn on the map (they stay in «Avisos»). */
  hidden: number[];
  overlays: MapOverlays;
}

export const DEFAULT_LAYERS: LayerChoices = { tab: 'formas', picked: null, hidden: [], overlays: { power: true, ip: false, ports: false } };
const STORAGE_KEY = 'mapa-infra:capas';

const isId = (value: unknown): value is number => Number.isInteger(value);

/** The layer choices of this browser; the defaults for what is missing, unreadable or of another shape. */
export function loadLayerChoices(): LayerChoices {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Record<keyof LayerChoices, unknown>>;
    const overlays = (typeof raw.overlays === 'object' && raw.overlays ? raw.overlays : {}) as Partial<Record<keyof MapOverlays, unknown>>;
    const flag = (key: keyof MapOverlays) => (typeof overlays[key] === 'boolean' ? overlays[key] as boolean : DEFAULT_LAYERS.overlays[key]);
    return {
      tab: raw.tab === 'capas' ? 'capas' : 'formas',
      picked: isId(raw.picked) ? raw.picked : null,
      hidden: Array.isArray(raw.hidden) ? raw.hidden.filter(isId) : [],
      overlays: { power: flag('power'), ip: flag('ip'), ports: flag('ports') },
    };
  } catch {
    return DEFAULT_LAYERS;
  }
}

/** Remembers the layer choices in this browser; a blocked or full storage only means they are not remembered. */
export function saveLayerChoices(choices: LayerChoices) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choices)); } catch { /* remembered for this visit only */ }
}

const OVERLAYS: { id: keyof MapOverlays; nombre: string }[] = [
  { id: 'power', nombre: 'Insignias de energía' }, { id: 'ip', nombre: 'Etiquetas de IP' }, { id: 'ports', nombre: 'Etiquetas de puertos' },
];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface LayersPanelProps {
  layers: VlanLayer[];
  choices: LayerChoices;
  onChange: (choices: LayerChoices) => void;
  /** Why the plan cannot be read, if it cannot: the VLAN layers then have nothing to show. */
  problem?: string;
}

/**
 * «Capas»: the physical cabling, each VLAN of the plan (pick one to light the lines that carry it and the devices that
 * use it) and what the map draws over the devices and lines.
 */
export function LayersPanel({ layers, choices, onChange, problem }: LayersPanelProps) {
  const set = (change: Partial<LayerChoices>) => onChange({ ...choices, ...change });
  const pick = (id: number | null) => set({ picked: id });
  const toggleHidden = (id: number) => {
    const hidden = choices.hidden.includes(id) ? choices.hidden.filter(v => v !== id) : [...choices.hidden, id];
    set({ hidden, picked: choices.picked === id && hidden.includes(id) ? null : choices.picked });
  };

  return (
    <div className="infra-layers">
      <h3 id="infra-layers-title">Capas</h3>
      <ul className="infra-layers__list" aria-labelledby="infra-layers-title">
        <li className="infra-layer">
          <button type="button" className="infra-layer__pick" aria-pressed={choices.picked === null} onClick={() => pick(null)}>
            <span className="infra-layer__name">Cableado físico</span>
            <span className="infra-layer__summary">Todas las conexiones, sin resaltar ninguna VLAN</span>
          </button>
        </li>
        {layers.map(layer => {
          const hidden = choices.hidden.includes(layer.id);
          return (
            <li key={layer.id} className={`infra-layer${hidden ? ' is-hidden' : ''}`}>
              <button type="button" className="infra-layer__pick" aria-pressed={choices.picked === layer.id} disabled={hidden}
                aria-label={`VLAN ${layer.id} ${layer.name}`} onClick={() => pick(choices.picked === layer.id ? null : layer.id)}>
                <span className="infra-layer__name"><span className="infra-layer__swatch" style={{ background: layer.color }} aria-hidden="true" />{layer.id} {layer.name}</span>
                <span className="infra-layer__summary">{plural(layer.switches, 'switch', 'switches')} · {plural(layer.trunks, 'troncal', 'troncales')}</span>
                {layer.gaps > 0 && <span className="infra-layer__gaps">⚠ {plural(layer.gaps, 'hueco', 'huecos')}</span>}
              </button>
              <button type="button" className="infra-layer__eye" aria-pressed={hidden} onClick={() => toggleHidden(layer.id)}
                aria-label={hidden ? `Mostrar la VLAN ${layer.id}` : `Ocultar la VLAN ${layer.id}`} title={hidden ? 'Mostrar' : 'Ocultar'}>
                {hidden ? '◌' : '👁'}
              </button>
            </li>
          );
        })}
      </ul>
      {problem && <p className="infra-form__error">{problem}</p>}
      {!problem && layers.length === 0 && <p className="muted">El plan aún no tiene VLAN: añádelas en la pestaña «VLAN» de «Red y VLAN».</p>}
      <fieldset className="infra-layers__overlays">
        <legend>Sobre el mapa</legend>
        {OVERLAYS.map(o => (
          <label key={o.id} className="check">
            <input type="checkbox" checked={choices.overlays[o.id]} onChange={e => set({ overlays: { ...choices.overlays, [o.id]: e.target.checked } })} /> {o.nombre}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
