import { useRef, useState, type FormEvent } from 'react';
import { GROUP_TYPES, type Device, type GroupType } from '../../domain/types';
import { GROUP_TYPE_NAMES } from '../../domain/topology';
import { cancelOnEscape, useFocusOnOpen } from './LinkForms';

/** The type and name of a new group; `onGroup` saves it, or returns why it cannot be made so the form shows it. */
function GroupForm({ onGroup, onCancel }: { onGroup: (tipo: GroupType, nombre: string) => string | null; onCancel: () => void }) {
  const [tipo, setTipo] = useState<GroupType>('ha');
  const [nombre, setNombre] = useState('');
  const [refusal, setRefusal] = useState('');
  const first = useFocusOnOpen<HTMLSelectElement>();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setRefusal(onGroup(tipo, nombre) ?? '');
  };
  return (
    <form className="infra-form" onSubmit={submit} onKeyDown={cancelOnEscape(onCancel)}>
      <label>Tipo de grupo
        <select ref={first} value={tipo} onChange={e => { setTipo(e.target.value as GroupType); setRefusal(''); }}>
          {GROUP_TYPES.map(t => <option key={t} value={t}>{GROUP_TYPE_NAMES[t]}</option>)}
        </select>
      </label>
      <label>Nombre del grupo<input value={nombre} placeholder="Par de firewalls" onChange={e => { setNombre(e.target.value); setRefusal(''); }} /></label>
      {refusal && <p className="infra-form__error" role="alert">{refusal}</p>}
      <div className="infra-form__actions">
        <button type="submit">Crear grupo</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

/** What the inspector shows with several devices selected: which ones, and «Agrupar» to make them one group. */
export function GroupPanel({ devices, onGroup }: { devices: Device[]; onGroup: (tipo: GroupType, nombre: string) => string | null }) {
  const [grouping, setGrouping] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const close = () => {
    setGrouping(false);
    // Back to the button that opened the form, so the keyboard does not lose its place.
    setTimeout(() => opener.current?.focus());
  };
  return (
    <aside className="detail infra-inspector nokey" aria-label="Equipos seleccionados">
      <span className="label">Equipos seleccionados</span>
      <ul className="infra-selection">{devices.map(d => <li key={d.id}>{d.nombre}</li>)}</ul>
      {grouping
        ? <GroupForm onGroup={(tipo, nombre) => { const refusal = onGroup(tipo, nombre); if (!refusal) setGrouping(false); return refusal; }} onCancel={close} />
        : <button type="button" ref={opener} onClick={() => setGrouping(true)}>Agrupar</button>}
      <p className="muted infra-form__hint">Pulsa Ctrl (Cmd en Mac) y haz clic en un equipo para añadirlo a la selección o quitarlo de ella.</p>
    </aside>
  );
}
