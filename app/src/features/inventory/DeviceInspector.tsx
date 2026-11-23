import { useEffect, useId, useState } from 'react';
import type { Device, DeviceGroup } from '../../domain/types';
import { GROUP_TYPE_NAMES } from '../../domain/topology';
import type { Finding } from '../../domain/inventoryAnalysis';
import { snippetsForDevice } from '../../domain/vendorSnippets';
import { guidesForDevice } from '../../domain/deviceGuides';
import { content } from '../../content';
import { GUIDES_URL, plannerGuideUrl } from '../../config';
import type { PlanRepository } from '../../ports/PlanRepository';
import { FindingList } from './FindingList';
import { GuideNote } from './GuideNote';
import { PanelTabs, type PanelTab } from './PanelTabs';
import { SwitchPorts } from './SwitchPorts';

type OptionalText = 'marca' | 'modelo' | 'ip';

/** The tabs of a selected switch: its ficha, its ports in the plan, its guides and how to get its commands. */
type SwitchTab = 'ficha' | 'puertos' | 'guias' | 'comandos';
const SWITCH_TABS: PanelTab<SwitchTab>[] = [
  { id: 'ficha', nombre: 'Ficha' }, { id: 'puertos', nombre: 'Puertos y VLAN' }, { id: 'guias', nombre: 'Guías' }, { id: 'comandos', nombre: 'Comandos' },
];

/** Where the commands of a switch come from: the planner's guide, opened at this switch. */
function SwitchCommands({ device }: { device: Device }) {
  return (
    <section className="switch-commands">
      <p>Los comandos de cada switch salen del plan de red: sus VLAN, sus enlaces y sus puertos. La guía del planificador los genera paso a paso, empezando por el switch núcleo; este enlace la abre en la parte de este switch.</p>
      <p><a className="plan-link" href={plannerGuideUrl(device.id)}>Ver los comandos de {device.nombre}</a></p>
    </section>
  );
}

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
export function DeviceInspector({ device, connections, group, findings, onChange, onRename, onDisconnect, onLeaveGroup, onUngroup, onDelete, plan }: {
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
  /** The planner document, for the «Puertos y VLAN» tab of a switch; `revision` changes with the inventory. */
  plan: { repository: PlanRepository; revision: unknown; onMessage: (message: string) => void };
}) {
  const [tab, setTab] = useState<SwitchTab>('ficha');
  // A switch splits its ficha into tabs; any other device shows everything at once, as before.
  const tabbed = device.tipo === 'switch';
  const shown = tabbed ? tab : 'ficha';
  const setText = (key: OptionalText, value: string) => onChange(d => {
    const next = { ...d };
    if (value) next[key] = value; else delete next[key];
    return next;
  });
  const snippets = snippetsForDevice(device, content.fabricantes);

  return (
    <aside className="detail infra-inspector" aria-label="Ficha del equipo">
      <span className="label">Ficha del equipo</span>
      {tabbed && <>
        <h2>{device.nombre}</h2>
        <PanelTabs tabs={SWITCH_TABS} tab={tab} onTab={setTab} idPrefix="infra-switch" label="Configuración del switch" />
      </>}
      <div role={tabbed ? 'tabpanel' : undefined} id={tabbed ? `infra-switch-${shown}` : undefined}
        aria-labelledby={tabbed ? `infra-switch-tab-${shown}` : undefined} className="infra-network__panel">
        {shown === 'ficha' && <>
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
          {!tabbed && <DeviceGuidesSection device={device} />}
          {findings.length > 0 && <><h3>Qué le falta</h3><FindingList findings={findings} /></>}
          {snippets.length > 0 && <h3>Monitorización</h3>}
          {snippets.map(s => (
            <details key={s.nombre} className="vendor">
              <summary>{s.nombre}</summary>
              <pre>{s.configuracion}</pre>
            </details>
          ))}
          <button type="button" className="chip infra-delete" onClick={onDelete}>Borrar equipo</button>
        </>}
        {shown === 'puertos' && <SwitchPorts device={device} planRepository={plan.repository} revision={plan.revision} onMessage={plan.onMessage} />}
        {shown === 'guias' && <DeviceGuidesSection device={device} />}
        {shown === 'comandos' && <SwitchCommands device={device} />}
      </div>
    </aside>
  );
}

/** The gaps of the whole inventory compared with a typical small business, in the «Avisos» tab of «Red y VLAN». */
export function InventoryFindings({ empty, findings }: { empty: boolean; findings: Finding[] }) {
  return (
    <section className="infra-findings" aria-labelledby="infra-findings-title">
      <h3 id="infra-findings-title">Qué te falta</h3>
      {empty && <p className="muted">Añade tus equipos y aquí verás qué falta comparado con una pyme típica: copias, alta disponibilidad, SAI, monitorización y soporte.</p>}
      {!empty && findings.length === 0 && <p>No se detecta ninguna carencia. ¡Buen trabajo!</p>}
      <FindingList findings={findings} />
    </section>
  );
}

/** Every gesture of the map editor, at the foot of the «Red y VLAN» panel. */
export function MapHelp() {
  return (
    <details className="infra-help">
      <summary id="infra-hints-title">Cómo se usa el mapa</summary>
      <ul className="infra-hints" aria-labelledby="infra-hints-title">
        <li>Pulsa un tipo de la biblioteca de la izquierda (o arrástralo al mapa) para añadir un equipo. Escribe en «Buscar equipos y formas» para encontrarlo antes.</li>
        <li>Arrastra un equipo para colocarlo donde quieras.</li>
        <li>Para unir dos equipos, arrastra desde el punto superior de uno hasta el punto inferior del equipo del que cuelga. Antes de guardar, elige el tipo de enlace (datos, troncal, LAG, HA, stack, WAN, almacenamiento, gestión o energía), los puertos de cada lado, la velocidad y, en troncales y LAG, las VLAN.</li>
        <li>Un enlace de energía es un cable de corriente, no de datos: no lleva puertos de red ni velocidad. Indica, si quieres, la toma del SAI o de la regleta y la fuente de alimentación del equipo («Fuente 1», «Fuente 2»). Quién alimenta a quién sale del tipo de equipo: el SAI o la regleta.</li>
        <li>Pulsa en un equipo para abrir su ficha y cambiar su nombre, su tipo y sus datos. Un switch tiene además las pestañas «Puertos y VLAN» (sus puertos de acceso y la VLAN de cada uno, guardados en el plan de red), «Guías» y «Comandos», que abre la guía del planificador en la parte de ese switch.</li>
        <li>Pulsa en una línea para abrir su ficha: cambia su tipo, sus puertos, su velocidad, sus VLAN y sus notas, o quita el enlace. En una troncal o un LAG, «VLAN permitidas» admite números y rangos (10, 20, 30-32); si lo dejas vacío pasan todas las VLAN del plan. Entre dos switches también eliges su VLAN nativa.</li>
        <li>Selecciona varios equipos con Ctrl + clic (Cmd + clic en Mac), o arrastrando con Mayúsculas pulsada, y pulsa «Agrupar» para formar un par HA, un stack o un clúster.</li>
        <li>Pulsa «Colocar por capas» para ordenar todos los equipos por capas, de la operadora a la energía; te pide confirmación porque se pierde la posición que les hayas dado.</li>
        <li>Con las pestañas «Red» y «Energía» cambias de vista. «Red» no dibuja los cables de corriente: cada equipo muestra de qué regletas o SAI se alimenta, en naranja si solo tiene una. «Energía» dibuja solo la corriente: los SAI arriba, las regletas como barras y, debajo, los equipos que alimentan. Cambiar de vista no mueve ni guarda nada.</li>
        <li>En la leyenda de la vista «Red» puedes ocultar las líneas de gestión; tu elección se recuerda en este navegador.</li>
        <li>En la pestaña «Capas» de la columna izquierda, pulsa una VLAN para resaltar las troncales que la llevan y los equipos que la usan (con su puerta de enlace y sus puertos de acceso); el resto se atenúa. El ojo oculta del mapa los avisos de esa VLAN, y también puedes mostrar u ocultar las insignias de energía y las etiquetas de IP y de puertos. Todo esto se recuerda en este navegador y no cambia nada guardado.</li>
        <li>Si una VLAN tiene puertos de acceso en un switch pero una troncal de su camino hasta el switch núcleo no la deja pasar, el mapa marca esa troncal y ese switch, y «Avisos» te ofrece «Añadir N a la troncal», que la añade al campo VLAN de esa troncal.</li>
        <li>En la página «Lista», «Exportar el esquema (JSON)» guarda todo el mapa en un archivo e «Importar el esquema (JSON)» lo recupera.</li>
        <li>Con nada seleccionado, el panel de la derecha muestra «Red y VLAN»: las VLAN de tu red, el switch núcleo y sus redes, y los avisos. «Comprobar red» abre los avisos. Aquí se edita lo que antes estaba en la pestaña «Red y VLAN» de «Mi infraestructura»: es el mismo plan de red que usan las guías.</li>
        <li>«Obtener comandos» abre la guía del planificador con los comandos de cada switch, del núcleo hacia fuera; con un switch seleccionado, la abre en la parte de ese switch.</li>
        <li>Acerca, aleja o encaja todo el mapa con los botones de la barra de herramientas; el minimapa de la esquina te dice qué parte estás viendo.</li>
      </ul>
    </details>
  );
}
