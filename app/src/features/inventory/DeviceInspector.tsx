import { useEffect, useId, useState } from 'react';
import type { Device, DeviceGroup } from '../../domain/types';
import { GROUP_TYPE_NAMES } from '../../domain/topology';
import type { Finding } from '../../domain/inventoryAnalysis';
import { snippetsForDevice } from '../../domain/vendorSnippets';
import { guidesForDevice } from '../../domain/deviceGuides';
import { content } from '../../content';
import { GUIDES_URL, PLANNER_URL } from '../../config';
import { FindingList } from './FindingList';
import { GuideNote } from './GuideNote';

type OptionalText = 'marca' | 'modelo' | 'ip';

/** The runbooks of the guides for this device, opened with its values filled in; or why there are none yet. */
function DeviceGuidesSection({ device }: { device: Device }) {
  const guides = guidesForDevice(device, content.guias, GUIDES_URL);
  const titleId = useId();
  return (
    <section className="device-guides" aria-labelledby={titleId}>
      <h3 id={titleId}>Guías para este equipo</h3>
      <GuideNote guides={guides} />
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
export function DeviceInspector({ device, connections, group, findings, onChange, onRename, onDisconnect, onLeaveGroup, onUngroup, onDelete }: {
  device: Device;
  /** One entry per link of the device: the link id and the name of the device at its other end. */
  connections: { id: string; nombre: string }[];
  findings: Finding[];
  /** Saves `change` applied to the stored device, so two quick edits never undo each other. */
  onChange: (change: (d: Device) => Device) => Promise<boolean>;
  onRename: (nombre: string) => Promise<boolean>;
  /** Removes the link with this id. */
  onDisconnect: (linkId: string) => void;
  /** The group the device belongs to, if any. */
  group?: DeviceGroup;
  /** Takes the device out of its group. */
  onLeaveGroup: () => void;
  /** Undoes the whole group of the device. */
  onUngroup: () => void;
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
      <h3>Grupo</h3>
      {group ? (
        <div className="infra-group">
          <p>{group.nombre} ({GROUP_TYPE_NAMES[group.tipo]})</p>
          <button type="button" className="chip" onClick={onLeaveGroup}>Sacar del grupo</button>
          <button type="button" className="chip" onClick={onUngroup}>Deshacer el grupo</button>
        </div>
      ) : <p className="muted">No está en ningún grupo. Para agrupar equipos, selecciónalos con Ctrl + clic (Cmd + clic en Mac).</p>}
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
      <h3 id="infra-hints-title">Cómo se usa el mapa</h3>
      <ul className="infra-hints" aria-labelledby="infra-hints-title">
        <li>Pulsa un tipo de la paleta (o arrástralo al mapa) para añadir un equipo.</li>
        <li>Arrastra un equipo para colocarlo donde quieras.</li>
        <li>Para unir dos equipos, arrastra desde el punto superior de uno hasta el punto inferior del equipo del que cuelga. Antes de guardar, elige el tipo de enlace (datos, troncal, LAG, HA, stack, WAN, almacenamiento, gestión o energía), los puertos de cada lado, la velocidad y, en troncales y LAG, las VLAN.</li>
        <li>Pulsa en un equipo para abrir su ficha y cambiar su nombre, su tipo y sus datos.</li>
        <li>Pulsa en una línea para abrir su ficha: cambia su tipo, sus puertos, su velocidad, sus VLAN y sus notas, o quita el enlace.</li>
        <li>Selecciona varios equipos con Ctrl + clic (Cmd + clic en Mac), o arrastrando con Mayúsculas pulsada, y pulsa «Agrupar» para formar un par HA, un stack o un clúster.</li>
        <li>Pulsa «Colocar por capas» para ordenar todos los equipos por capas, de la operadora a la energía; te pide confirmación porque se pierde la posición que les hayas dado.</li>
        <li>En la leyenda puedes ocultar las líneas de gestión y de energía; tu elección se recuerda en este navegador.</li>
        <li>En la página «Lista», «Exportar el esquema (JSON)» guarda todo el mapa en un archivo e «Importar el esquema (JSON)» lo recupera.</li>
      </ul>
    </aside>
  );
}
