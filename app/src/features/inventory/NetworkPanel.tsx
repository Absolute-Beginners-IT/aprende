import { useRef, useState, type FormEvent } from 'react';
import { PLAN_TEMPLATES, VLAN_PURPOSES, type PlanVlan, type VlanPurpose } from '@shared/plan';
import type { LoadedPlan, PlanChange, PlanRepository } from '../../ports/PlanRepository';
import type { Finding } from '../../domain/inventoryAnalysis';
import { PanelTabs, type PanelTab } from './PanelTabs';
import { usePlanDocument } from './usePlanDocument';
import { InventoryFindings, MapHelp } from './DeviceInspector';
import {
  PURPOSE_LABELS, addVlan, applyTemplate, editVlan, freeVlanId, gatewayHint, makeCore, removeVlan, vlanColor, vlanProblems, type VlanDraft,
} from './vlanCatalogue';

/** The tabs of «Red y VLAN»: what holds for the whole network while nothing is selected on the map. */
export type NetworkTab = 'vlan' | 'direccionamiento' | 'avisos';

const READ_ONLY = 'Mientras tanto, las VLAN no se pueden cambiar desde el mapa, para no escribir encima del plan guardado.';

interface NetworkPanelProps {
  planRepository: PlanRepository;
  /** Changes whenever the inventory does: the switches of the plan come from it, so the plan is read again. */
  revision: unknown;
  /** Whether «Mi infraestructura» has any switch: without one there is no core to pick. */
  hasSwitches: boolean;
  empty: boolean;
  findings: Finding[];
  tab: NetworkTab;
  onTab: (tab: NetworkTab) => void;
  /** Tells what a change did, in the map's own status line. */
  onMessage: (message: string) => void;
}

/** The right-hand panel of the map editor with nothing selected: the VLANs, the addressing and the warnings. */
export function NetworkPanel({ planRepository, revision, hasSwitches, empty, findings, tab, onTab, onMessage }: NetworkPanelProps) {
  const { loaded, problem, locked, errors, change } = usePlanDocument(planRepository, revision, onMessage);
  const warnings = findings.length + (problem ? 1 : 0);

  return (
    <aside className="detail infra-inspector infra-network" aria-label="Red y VLAN">
      <span className="label">Nada seleccionado · Toda la red</span>
      <h2>Red y VLAN</h2>
      <p className="muted">Lo que vale para todos los switches. Pulsa un equipo o un enlace para configurarlo.</p>
      {errors.map(e => <p key={e} className="infra-form__error" role="alert">{e}</p>)}
      <PanelTabs tabs={TABS.map(t => (t.id === 'avisos' && warnings > 0 ? { ...t, nombre: `${t.nombre} (${warnings})` } : t))}
        tab={tab} onTab={onTab} idPrefix="infra-network" label="Configuración de la red" />
      <div role="tabpanel" id={`infra-network-${tab}`} aria-labelledby={`infra-network-tab-${tab}`} className="infra-network__panel">
        {tab === 'vlan' && <VlanCatalogue vlans={loaded?.plan.vlans ?? []} problem={problem} locked={locked} onChange={change} />}
        {tab === 'direccionamiento' && (
          <Addressing loaded={loaded} hasSwitches={hasSwitches} locked={locked}
            onCore={id => void change(makeCore(id), `${loaded?.plan.switches.find(s => s.id === id)?.name || id} es ahora el switch núcleo.`)} />
        )}
        {tab === 'avisos' && <>
          {problem && <p className="infra-form__error">{problem} {READ_ONLY}</p>}
          <InventoryFindings empty={empty} findings={findings} />
        </>}
      </div>
      <MapHelp />
    </aside>
  );
}

const TABS: PanelTab<NetworkTab>[] = [
  { id: 'vlan', nombre: 'VLAN' }, { id: 'direccionamiento', nombre: 'Direccionamiento' }, { id: 'avisos', nombre: 'Avisos' },
];

type Change = (update: PlanChange, success: string) => Promise<boolean>;
/** The VLAN being written: a new one, or the id of the one being changed. */
type Editing = { kind: 'new' } | { kind: 'edit'; id: number };

/** The VLANs of the plan: add, change and remove them one by one, or start from a template of the planner. */
function VlanCatalogue({ vlans, problem, locked, onChange }: { vlans: PlanVlan[]; problem?: string; locked: boolean; onChange: Change }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const templates = useRef<HTMLDetailsElement>(null);
  const apply = (template: (typeof PLAN_TEMPLATES)[number]) => {
    if (templates.current) templates.current.open = false;
    void onChange(applyTemplate(template), `Plantilla «${template.name}» aplicada: las VLAN que ya tenías no se han tocado.`);
  };

  return (
    <div className="vlan-catalogue">
      {problem && <p className="infra-form__error" role="alert">{problem} {READ_ONLY}</p>}
      <div className="vlan-catalogue__head">
        <span className="label">{vlans.length === 1 ? '1 VLAN' : `${vlans.length} VLAN`}</span>
        <details className="vlan-templates" ref={templates}>
          <summary aria-disabled={locked || undefined} onClick={e => { if (locked) e.preventDefault(); }}>Plantillas</summary>
          <ul>
            {PLAN_TEMPLATES.map(t => (
              <li key={t.name}>
                <button type="button" disabled={locked} onClick={() => apply(t)}>{t.name}</button>
                <span className="muted">{t.description}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
      {vlans.length === 0 && !problem && <p className="muted">Aún no hay VLAN. Añade la primera o empieza con una plantilla; marca una como Gestión: es la red por la que vas a administrar los switches.</p>}
      {vlans.length > 0 && (
        <table className="vlan-table vlan-table--catalogue" aria-label="VLAN del plan">
          <thead>
            <tr><th scope="col">ID</th><th scope="col">Nombre</th><th scope="col">Propósito</th><th scope="col">Red</th><th scope="col"><span className="visually-hidden">Acciones</span></th></tr>
          </thead>
          <tbody>
            {vlans.map((v, i) => (
              <tr key={v.id}>
                <td><span className="vlan-swatch" style={{ background: vlanColor(i) }} aria-hidden="true" />{v.id}</td>
                <td>{v.name}</td>
                <td>{PURPOSE_LABELS[v.purpose]}</td>
                <td className="vlan-table__net">{v.subnet}</td>
                <td className="vlan-table__actions">
                  <button type="button" className="chip" disabled={locked} aria-label={`Editar la VLAN ${v.id}`} onClick={() => setEditing({ kind: 'edit', id: v.id })}>Editar</button>
                  <button type="button" className="chip" disabled={locked} aria-label={`Quitar la VLAN ${v.id}`}
                    onClick={() => { if (editing?.kind === 'edit' && editing.id === v.id) setEditing(null); void onChange(removeVlan(v.id), `VLAN ${v.id} quitada.`); }}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing ? (
        <VlanForm key={editing.kind === 'edit' ? editing.id : 'new'} vlans={vlans} editing={editing.kind === 'edit' ? vlans.find(v => v.id === editing.id) : undefined}
          onCancel={() => setEditing(null)}
          onSave={async (draft, opened) => {
            const saved = editing.kind === 'edit'
              ? await onChange(editVlan(editing.id, draft, opened), `VLAN ${draft.id.trim()} actualizada.`)
              : await onChange(addVlan(draft), `VLAN ${draft.id.trim()} añadida.`);
            if (saved) setEditing(null);
          }} />
      ) : (
        <button type="button" className="infra-tool infra-tool--primary infra-network__add" disabled={locked} onClick={() => setEditing({ kind: 'new' })}>Añadir VLAN</button>
      )}
    </div>
  );
}

/** The form of one VLAN; it says what is wrong before anything is saved. */
function VlanForm({ vlans, editing, onSave, onCancel }: {
  vlans: PlanVlan[]; editing?: PlanVlan; onSave: (draft: VlanDraft, opened?: PlanVlan) => void; onCancel: () => void;
}) {
  // The VLAN as the form first showed it, even if the panel reloads meanwhile: only what changed from it is saved.
  const [opened] = useState(editing);
  const [draft, setDraft] = useState<VlanDraft>(() => (editing
    ? { id: String(editing.id), name: editing.name, purpose: editing.purpose, subnet: editing.subnet }
    : { id: String(freeVlanId(vlans)), name: '', purpose: 'users', subnet: '' }));
  const [problems, setProblems] = useState<string[]>([]);
  const set = (patch: Partial<VlanDraft>) => setDraft(d => ({ ...d, ...patch }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = vlanProblems(draft, vlans, editing?.id);
    setProblems(found);
    if (found.length === 0) onSave(draft, opened);
  };
  return (
    <form className="infra-form vlan-form" aria-label={editing ? `Editar la VLAN ${editing.id}` : 'Nueva VLAN'} noValidate onSubmit={submit}
      onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <label>ID<input type="number" min={1} max={4094} value={draft.id} onChange={e => set({ id: e.target.value })} /></label>
      <label>Nombre<input value={draft.name} placeholder="Ej.: USUARIOS" spellCheck={false} onChange={e => set({ name: e.target.value })} /></label>
      <label>Propósito
        <select value={draft.purpose} onChange={e => set({ purpose: e.target.value as VlanPurpose })}>
          {VLAN_PURPOSES.map(p => <option key={p} value={p}>{PURPOSE_LABELS[p]}</option>)}
        </select>
      </label>
      <label>Red (opcional)<input value={draft.subnet} placeholder="Ej.: 192.168.10.0/24" spellCheck={false} onChange={e => set({ subnet: e.target.value })} /></label>
      {problems.length > 0 && <div className="infra-form__error" role="alert"><ul>{problems.map(p => <li key={p}>{p}</li>)}</ul></div>}
      <div className="infra-form__actions">
        <button type="submit">Guardar VLAN</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

/** The core switch (the first of the plan: the guide starts there) and the network and usual gateway of each VLAN. */
function Addressing({ loaded, hasSwitches, locked, onCore }: { loaded: LoadedPlan | null; hasSwitches: boolean; locked: boolean; onCore: (id: string) => void }) {
  const plan = loaded?.plan;
  return (
    <div className="infra-addressing">
      {hasSwitches ? (
        <label className="infra-addressing__core">Switch núcleo
          <select value={plan?.switches[0]?.id ?? ''} disabled={locked} onChange={e => onCore(e.target.value)}>
            {plan?.switches.map(s => <option key={s.id} value={s.id}>{s.name.trim() || s.id}</option>)}
          </select>
        </label>
      ) : (
        <p className="muted">No hay ningún switch en tu inventario. Añade un switch desde la biblioteca de equipos y aquí podrás elegir el núcleo de tu red.</p>
      )}
      <p className="muted">El núcleo es el primer switch que se configura: las guías empiezan por él y siguen hacia fuera.</p>
      {plan && plan.vlans.length > 0 ? (
        <table className="vlan-table" aria-label="Direccionamiento de las VLAN">
          <thead><tr><th scope="col">VLAN</th><th scope="col">Red</th><th scope="col">Puerta de enlace sugerida</th></tr></thead>
          <tbody>
            {plan.vlans.map(v => (
              <tr key={v.id}>
                <td>{v.id} · {v.name}</td>
                <td className="vlan-table__net">{v.subnet || 'Sin red'}</td>
                <td className="vlan-table__net">{gatewayHint(v.subnet) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="muted">Cuando añadas VLAN con su red, aquí verás la puerta de enlace que se suele usar en cada una (la primera dirección, «.1»).</p>}
    </div>
  );
}
