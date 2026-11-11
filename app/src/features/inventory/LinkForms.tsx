import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { LINK_TYPES, type Link } from '../../domain/types';
import { LINK_TYPE_NAMES, isHierarchical } from '../../domain/topology';
import { carriesVlans, draftOf, type LinkDraft } from '../../domain/infraMap';

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

/** How the two ends relate for the chosen type: who hangs from whom, or that neither does. */
const directionText = (tipo: LinkDraft['tipo'], nameA: string, nameB: string) =>
  isHierarchical({ tipo }) ? `${nameA} cuelga de ${nameB}.` : `${nameA} y ${nameB} quedan unidos sin que uno cuelgue del otro.`;

/** The fields of a link shared by the new link form and the ficha of a link; VLANs only for trunks and LAGs. */
function LinkFields({ draft, onChange, nameA, nameB, first, notes }: {
  draft: LinkDraft; onChange: (draft: LinkDraft) => void; nameA: string; nameB: string; first: RefObject<HTMLSelectElement | null>; notes?: boolean;
}) {
  const text = (key: Exclude<keyof LinkDraft, 'tipo'>, label: string, placeholder?: string) => (
    <label>{label}<input value={draft[key] ?? ''} placeholder={placeholder} onChange={e => onChange({ ...draft, [key]: e.target.value })} /></label>
  );
  return (
    <>
      <label>Tipo de enlace
        <select ref={first} value={draft.tipo} onChange={e => onChange({ ...draft, tipo: e.target.value as LinkDraft['tipo'] })}>
          {LINK_TYPES.map(t => <option key={t} value={t}>{LINK_TYPE_NAMES[t]}</option>)}
        </select>
      </label>
      <p className="muted infra-form__hint">{directionText(draft.tipo, nameA, nameB)}</p>
      {text('puertoA', `Puerto en ${nameA}`, '1/1/1')}
      {text('puertoB', `Puerto en ${nameB}`, '1/1/48')}
      {text('velocidad', 'Velocidad', '1G, 10G…')}
      {carriesVlans(draft.tipo) && text('vlans', 'VLAN', '10, 20, 30')}
      {notes && <label>Notas<textarea value={draft.notas ?? ''} rows={2} onChange={e => onChange({ ...draft, notas: e.target.value })} /></label>}
    </>
  );
}

/**
 * The form that opens when two devices are joined on the map: nothing is saved until «Crear enlace».
 * `onCreate` saves the link, or returns why it cannot be made so the form stays open showing it.
 */
export function NewLinkForm({ nameA, nameB, onCreate, onCancel }: {
  nameA: string; nameB: string; onCreate: (draft: LinkDraft) => string | null; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<LinkDraft>({ tipo: 'datos' });
  const [refusal, setRefusal] = useState('');
  const first = useFocusOnOpen<HTMLSelectElement>();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setRefusal(onCreate(draft) ?? '');
  };
  return (
    <aside className="detail infra-inspector nokey" aria-label="Nuevo enlace">
      <span className="label">Nuevo enlace</span>
      <p>Entre <b>{nameA}</b> y <b>{nameB}</b></p>
      <form className="infra-form" onSubmit={submit} onKeyDown={cancelOnEscape(onCancel)}>
        <LinkFields draft={draft} onChange={d => { setDraft(d); setRefusal(''); }} nameA={nameA} nameB={nameB} first={first} />
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
 * `onSave` returns why the change cannot be saved, if it cannot; Escape and «Cancelar» close it without saving.
 */
export function LinkInspector({ link, nameOf, onSave, onRemove, onClose }: {
  link: Link; nameOf: (id: string) => string; onSave: (draft: LinkDraft) => string | null; onRemove: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<LinkDraft>(() => draftOf(link));
  const [refusal, setRefusal] = useState('');
  const first = useFocusOnOpen<HTMLSelectElement>();
  const nameA = nameOf(link.a.equipo);
  const nameB = nameOf(link.b.equipo);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setRefusal(onSave(draft) ?? '');
  };
  return (
    <aside className="detail infra-inspector nokey" aria-label="Ficha del enlace">
      <span className="label">Ficha del enlace</span>
      <p className="infra-link-ends">{nameA} – {nameB}</p>
      <form className="infra-form" onSubmit={submit} onKeyDown={cancelOnEscape(onClose)}>
        <LinkFields draft={draft} onChange={d => { setDraft(d); setRefusal(''); }} nameA={nameA} nameB={nameB} first={first} notes />
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
