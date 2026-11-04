import { useEffect, useId, useState } from 'react';
import type { Device } from '../../domain/types';
import type { Finding } from '../../domain/inventoryAnalysis';
import { snippetsForDevice } from '../../domain/vendorSnippets';
import { guidesForDevice } from '../../domain/deviceGuides';
import { content } from '../../content';
import { GUIDES_URL, PLANNER_URL } from '../../config';
import { FindingList } from './FindingList';

type OptionalText = 'marca' | 'modelo' | 'ip';

const listFormat = new Intl.ListFormat('es', { type: 'conjunction' });

/** The runbooks of the guides for this device, opened with its values filled in; or why there are none yet. */
function DeviceGuidesSection({ device }: { device: Device }) {
  const guides = guidesForDevice(device, content.guias, GUIDES_URL);
  const titleId = useId();
  return (
    <section className="device-guides" aria-labelledby={titleId}>
      <h3 id={titleId}>Guías para este equipo</h3>
      {guides.estado === 'tipo-sin-guias' && <p className="muted">Las guías de este tipo de equipo llegarán más adelante; de momento cubren switches.</p>}
      {guides.estado === 'modelo-desconocido' && <p className="muted">Indica la marca y el modelo para ver sus guías. Las guías cubren: {listFormat.format(guides.plataformas.map(p => p.nombre))}.</p>}
      {guides.estado === 'cubierto' && <>
        <p>Para tu {guides.plataforma.nombre}, con sus datos ya puestos:</p>
        {guides.grupos.map((g, i) => (
          <details key={g.id} open={i === 0}>
            <summary>{g.nombre}</summary>
            <ul>{g.tareas.map(t => <li key={t.id}><a href={t.href}>{t.titulo}</a></li>)}</ul>
          </details>
        ))}
      </>}
    </section>
  );
}

/** A text box that saves when it loses focus or on Enter; it goes back to the stored value when the save fails. */
function TextField({ label, value, placeholder, required, onCommit }: {
  label: string; value: string; placeholder?: string; required?: boolean; onCommit: (value: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = draft.trim();
    if (next === value) return;
    if (required && !next) { setDraft(value); return; }
    void onCommit(next).then(ok => { if (!ok) setDraft(value); });
  };
  return (
    <label>{label}<input value={draft} placeholder={placeholder} onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>
  );
}

/** The ficha of the selected device: every change is saved through `onChange` as soon as it is made. */
export function DeviceInspector({ device, connections, findings, onChange, onRename, onDisconnect, onDelete }: {
  device: Device;
  connections: { id: string; nombre: string }[];
  findings: Finding[];
  /** Saves `change` applied to the stored device, so two quick edits never undo each other. */
  onChange: (change: (d: Device) => Device) => Promise<boolean>;
  onRename: (nombre: string) => Promise<boolean>;
  onDisconnect: (otherId: string) => void;
  onDelete: () => void;
}) {
  const setText = (key: OptionalText, value: string) => onChange(d => {
    const next = { ...d };
    if (value) next[key] = value; else delete next[key];
    return next;
  });
  const snippets = snippetsForDevice(device, content.fabricantes);

  return (
    <aside className="detail infra-inspector" aria-label="Ficha del equipo">
      <span className="label">Ficha del equipo</span>
      <div className="infra-form">
        <TextField label="Nombre" value={device.nombre} required onCommit={onRename} />
        <label>Tipo<select value={device.tipo} onChange={e => { const tipo = e.target.value; void onChange(d => ({ ...d, tipo })); }}>{content.tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
        <TextField label="Marca" value={device.marca ?? ''} placeholder="Fortinet" onCommit={v => setText('marca', v)} />
        <TextField label="Modelo" value={device.modelo ?? ''} placeholder="FortiGate 60F" onCommit={v => setText('modelo', v)} />
        <TextField label="IP" value={device.ip ?? ''} placeholder="192.168.1.1" onCommit={v => setText('ip', v)} />
        <label>Criticidad<select value={device.criticidad} onChange={e => { const criticidad = e.target.value as Device['criticidad']; void onChange(d => ({ ...d, criticidad })); }}><option>Alta</option><option>Media</option><option>Baja</option></select></label>
        <label className="check"><input type="checkbox" checked={device.monitorizado} onChange={e => { const monitorizado = e.target.checked; void onChange(d => ({ ...d, monitorizado })); }} /> Monitorizado</label>
      </div>
      <h3>Conexiones</h3>
      {connections.length === 0 ? <p className="muted">Sin conexiones. Arrastra desde uno de sus puntos hasta otro equipo para unirlos.</p> : (
        <ul className="infra-links">
          {connections.map(c => (
            <li key={c.id}><span>{c.nombre}</span> <button type="button" className="chip" aria-label={`Quitar la conexión con ${c.nombre}`} onClick={() => onDisconnect(c.id)}>Quitar</button></li>
          ))}
        </ul>
      )}
      <DeviceGuidesSection device={device} />
      {device.tipo === 'switch' && <p><a className="plan-link" href={PLANNER_URL}>Planificar VLAN y puertos</a></p>}
      {findings.length > 0 && <><h3>Qué le falta</h3><FindingList findings={findings} /></>}
      {snippets.length > 0 && <h3>Monitorización</h3>}
      {snippets.map(s => (
        <details key={s.nombre} className="vendor">
          <summary>{s.nombre}</summary>
          <pre>{s.configuracion}</pre>
        </details>
      ))}
      <button type="button" className="chip infra-delete" onClick={onDelete}>Borrar equipo</button>
    </aside>
  );
}

/** What the inspector shows with nothing selected: the gaps of the whole inventory and how to use the map. */
export function InventoryOverview({ empty, findings }: { empty: boolean; findings: Finding[] }) {
  return (
    <aside className="detail infra-inspector" aria-label="Qué te falta">
      <h2>Qué te falta</h2>
      {empty && <p className="muted">Añade tus equipos y aquí verás qué falta comparado con una pyme típica: copias, alta disponibilidad, SAI, monitorización y soporte.</p>}
      {!empty && findings.length === 0 && <p>No se detecta ninguna carencia. ¡Buen trabajo!</p>}
      <FindingList findings={findings} />
      <h3>Cómo se usa el mapa</h3>
      <ul className="infra-hints">
        <li>Pulsa un tipo de la paleta (o arrástralo al mapa) para añadir un equipo.</li>
        <li>Arrastra un equipo para colocarlo donde quieras.</li>
        <li>Para unir dos equipos, arrastra desde el punto superior de uno hasta el punto inferior del equipo del que cuelga.</li>
        <li>Pulsa en un equipo para abrir su ficha y cambiar su nombre, su tipo y sus datos.</li>
        <li>Pulsa en una conexión y después Supr para quitarla.</li>
      </ul>
    </aside>
  );
}
