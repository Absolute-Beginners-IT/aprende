import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { parseVlanList } from '@shared/plan';
import { LINK_TYPES, type Link, type LinkType } from '../../domain/types';
import type { PlanRepository } from '../../ports/PlanRepository';
import { LINK_TYPE_NAMES, isHierarchical, powerEndRoles, powerSourceSide } from '../../domain/topology';
import { carriesNetworkData, carriesVlans, draftOf, type LinkDraft } from '../../domain/infraMap';
import { PLAN_READ_ONLY, usePlanDocument } from './usePlanDocument';
import { nativeVlanProblem, planLinkBetween, setNativeVlan } from './portAssignment';

/** Puts the focus on `ref` once, when the form opens, so the keyboard starts inside it. */
export function useFocusOnOpen<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => ref.current?.focus(), []);
  return ref;
}

/** Escape anywhere inside a form cancels it. */
export const cancelOnEscape = (cancel: () => void) => (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  cancel();
};

/** The device types at the two ends of a link, `a` and `b`, which say who feeds whom over a power link. */
export interface EndTypes { tipoA?: string; tipoB?: string }

/** How the two ends relate for the chosen type: who feeds whom over a power link, who hangs from whom, or that neither does. */
function directionText(tipo: LinkDraft['tipo'], nameA: string, nameB: string, { tipoA, tipoB }: EndTypes) {
  if (tipo === 'energia') {
    const source = powerSourceSide(tipoA, tipoB);
    if (source === 'a') return `${nameB} se alimenta de ${nameA}.`;
    if (source === 'b') return `${nameA} se alimenta de ${nameB}.`;
    return `${nameA} y ${nameB} quedan unidos por un cable de energía, sin que uno alimente al otro.`;
  }
  return isHierarchical({ tipo }) ? `${nameA} cuelga de ${nameB}.` : `${nameA} y ${nameB} quedan unidos sin que uno cuelgue del otro.`;
}

/** Why the allowed VLANs of `draft` cannot be saved; empty when they can, or when its type carries no VLANs. */
export function vlanListProblem(draft: LinkDraft): string {
  if (!carriesVlans(draft.tipo)) return '';
  const parsed = parseVlanList(draft.vlans ?? '');
  return parsed.ok ? '' : parsed.error;
}

/**
 * The VLANs a trunk or a LAG lets through, checked as they are typed. The guides allow exactly these plus the native
 * VLAN; an empty list lets every VLAN of the plan through, as before the map had lists.
 */
function AllowedVlans({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const hintId = useId();
  const parsed = parseVlanList(value);
  const hint = !parsed.ok ? parsed.error : parsed.ids.length === 0 ? 'Vacío: pasan todas las VLAN del plan.' : 'Solo pasan estas VLAN y la VLAN nativa.';
  return <>
    <label>VLAN permitidas<input value={value} placeholder="10, 20, 30-32" spellCheck={false} aria-invalid={!parsed.ok || undefined} aria-describedby={hintId}
      onChange={e => onChange(e.target.value)} /></label>
    <p id={hintId} className={parsed.ok ? 'muted infra-form__hint' : 'infra-form__error'} aria-live="polite">{hint}</p>
  </>;
}

/**
 * The fields of a link shared by the new link form and the ficha of a link; VLANs only for trunks and LAGs. A power
 * link has no network ports or speed: its ports hold the outlet («Toma», on the SAI or regleta) and the power supply.
 */
function LinkFields({ draft, onChange, nameA, nameB, types, first, notes, linkTypes = LINK_TYPES, children }: {
  draft: LinkDraft; onChange: (draft: LinkDraft) => void; nameA: string; nameB: string; types: EndTypes; first: RefObject<HTMLSelectElement | null>; notes?: boolean;
  linkTypes?: readonly LinkType[];
  /** Fields that go after the VLANs, such as the native VLAN in the ficha. */
  children?: ReactNode;
}) {
  const text = (key: Exclude<keyof LinkDraft, 'tipo'>, label: string, placeholder?: string) => (
    <label key={key}>{label}<input value={draft[key] ?? ''} placeholder={placeholder} onChange={e => onChange({ ...draft, [key]: e.target.value })} /></label>
  );
  // On a power link the outlet goes first, whichever end of the link it is.
  const roles = powerEndRoles(types.tipoA, types.tipoB);
  const powerField = (side: 'a' | 'b') => {
    const [key, name] = side === 'a' ? (['puertoA', nameA] as const) : (['puertoB', nameB] as const);
    return roles[side] === 'toma' ? text(key, `Toma en ${name}`, '1, 2…') : text(key, `Fuente de alimentación en ${name}`, 'Fuente 1, Fuente 2…');
  };
  const powerSides = (['a', 'b'] as const).slice().sort((x, y) => Number(roles[x] !== 'toma') - Number(roles[y] !== 'toma'));
  return (
    <>
      <label>Tipo de enlace
        <select ref={first} value={draft.tipo} onChange={e => onChange({ ...draft, tipo: e.target.value as LinkDraft['tipo'] })}>
          {linkTypes.map(t => <option key={t} value={t}>{LINK_TYPE_NAMES[t]}</option>)}
        </select>
      </label>
      <p className="muted infra-form__hint">{directionText(draft.tipo, nameA, nameB, types)}</p>
      {carriesNetworkData(draft.tipo) ? (
        <>
          {text('puertoA', `Puerto en ${nameA}`, '1/1/1')}
          {text('puertoB', `Puerto en ${nameB}`, '1/1/48')}
          {text('velocidad', 'Velocidad', '1G, 10G…')}
        </>
      ) : powerSides.map(powerField)}
      {carriesVlans(draft.tipo) && <AllowedVlans value={draft.vlans ?? ''} onChange={vlans => onChange({ ...draft, vlans })} />}
      {children}
      {notes && <label>Notas<textarea value={draft.notas ?? ''} rows={2} onChange={e => onChange({ ...draft, notas: e.target.value })} /></label>}
    </>
  );
}

/**
 * The form that opens when two devices are joined on the map: nothing is saved until «Crear enlace».
 * `onCreate` saves the link, or returns why it cannot be made so the form stays open showing it. `linkTypes` limits the
 * types offered (the «Energía» view offers only power); the first one is chosen to start with.
 */
export function NewLinkForm({ nameA, nameB, types = {}, linkTypes, onCreate, onCancel }: {
  nameA: string; nameB: string; types?: EndTypes; linkTypes?: readonly LinkType[]; onCreate: (draft: LinkDraft) => string | null; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<LinkDraft>({ tipo: linkTypes?.[0] ?? 'datos' });
  const [refusal, setRefusal] = useState('');
  const first = useFocusOnOpen<HTMLSelectElement>();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // A VLAN list that cannot be read is already explained under its field.
    if (vlanListProblem(draft)) return;
    setRefusal(onCreate(draft) ?? '');
  };
  return (
    <aside className="detail infra-inspector nokey" aria-label="Nuevo enlace">
      <span className="label">Nuevo enlace</span>
      <p>Entre <b>{nameA}</b> y <b>{nameB}</b></p>
      <form className="infra-form" onSubmit={submit} onKeyDown={cancelOnEscape(onCancel)}>
        <LinkFields draft={draft} onChange={d => { setDraft(d); setRefusal(''); }} nameA={nameA} nameB={nameB} types={types} first={first} linkTypes={linkTypes} />
        {refusal && <p className="infra-form__error" role="alert">{refusal}</p>}
        <div className="infra-form__actions">
          <button type="submit">Crear enlace</button>
          <button type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </aside>
  );
}

/**
 * The ficha of the selected line: its two ends and everything else editable, saved in one write with «Guardar enlace».
 * A trunk or LAG between two switches also shows its native VLAN, kept in the planner document (`plan`); a change to it
 * is saved there by the same button, first: `onSave` gets it as `planFirst` and saves the link only once the plan took
 * it, so a refused plan write leaves everything as it was. `onSave` returns why the change cannot be saved, if it
 * cannot; Escape and «Cancelar» close it without saving.
 */
export function LinkInspector({ link, nameOf, types = {}, onSave, onRemove, onClose, plan }: {
  link: Link; nameOf: (id: string) => string; types?: EndTypes; onRemove: () => void; onClose: () => void;
  onSave: (draft: LinkDraft, planFirst?: () => Promise<boolean>) => string | null;
  plan: { repository: PlanRepository; revision: unknown; onMessage: (message: string) => void };
}) {
  const [draft, setDraft] = useState<LinkDraft>(() => draftOf(link));
  const [refusal, setRefusal] = useState('');
  // The native VLAN as typed; null while untouched, so the stored one is shown and nothing is written.
  const [native, setNative] = useState<string | null>(null);
  const nativeHint = useId();
  const first = useFocusOnOpen<HTMLSelectElement>();
  const { loaded, problem, locked, errors, change } = usePlanDocument(plan.repository, plan.revision, plan.onMessage);
  const planLink = loaded && !problem ? planLinkBetween(loaded.plan, link.a.equipo, link.b.equipo) : undefined;
  // Only a native VLAN the form shows can stop the save: a link turned into one without VLANs drops what was typed.
  const nativeShown = carriesVlans(draft.tipo) && Boolean(planLink);
  const nativeError = native === null || !nativeShown ? '' : nativeVlanProblem(native);
  const nameA = nameOf(link.a.equipo);
  const nameB = nameOf(link.b.equipo);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // A VLAN list or a native VLAN that cannot be read is already explained under its field.
    if (vlanListProblem(draft) || nativeError) return;
    const nativeChanged = !locked && planLink && nativeShown && native !== null && Number(native) !== planLink.nativeVlan;
    const vlan = Number(native);
    // A refusal of the plan is shown by usePlanDocument; the link is then not saved either.
    const planFirst = nativeChanged
      ? () => change(setNativeVlan(link.a.equipo, link.b.equipo, vlan), `VLAN nativa ${vlan} guardada en el plan de red.`)
        .then(saved => { if (saved) setNative(null); return saved; })
      : undefined;
    setRefusal(onSave(draft, planFirst) ?? '');
  };
  const nativeField = !carriesVlans(draft.tipo) || !loaded ? null : planLink ? (
    <>
      <label>VLAN nativa<input type="number" min={1} max={4094} value={native ?? String(planLink.nativeVlan)} disabled={locked}
        aria-invalid={Boolean(nativeError) || undefined} aria-describedby={nativeHint} onChange={e => { setNative(e.target.value); setRefusal(''); }} /></label>
      <p id={nativeHint} className={nativeError ? 'infra-form__error' : 'muted infra-form__hint'} aria-live="polite">
        {nativeError || 'La que pasa sin etiqueta. Es la misma en los dos extremos y se guarda en el plan de red.'}
      </p>
    </>
  ) : (
    <p className="muted infra-form__hint">{problem ? `${problem} ${PLAN_READ_ONLY}` : 'La VLAN nativa se guarda en el plan de red, que solo tiene los enlaces entre dos switches.'}</p>
  );
  return (
    <aside className="detail infra-inspector nokey" aria-label="Ficha del enlace">
      <span className="label">Ficha del enlace</span>
      <p className="infra-link-ends">{nameA} – {nameB}</p>
      {errors.map(e => <p key={e} className="infra-form__error" role="alert">{e}</p>)}
      <form className="infra-form" onSubmit={submit} onKeyDown={cancelOnEscape(onClose)}>
        <LinkFields draft={draft} onChange={d => { setDraft(d); setRefusal(''); }} nameA={nameA} nameB={nameB} types={types} first={first} notes>
          {nativeField}
        </LinkFields>
        {refusal && <p className="infra-form__error" role="alert">{refusal}</p>}
        <div className="infra-form__actions">
          <button type="submit">Guardar enlace</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
      <button type="button" className="chip infra-delete" onClick={onRemove}>Quitar enlace</button>
    </aside>
  );
}
