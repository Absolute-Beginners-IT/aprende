import { useState, type FormEvent } from 'react';
import type { PlanVlan } from '@shared/plan';
import type { Device } from '../../domain/types';
import type { PlanRepository } from '../../ports/PlanRepository';
import { PLAN_READ_ONLY, usePlanDocument } from './usePlanDocument';
import { addAccessPort, planSwitchOf, portProblem, removePort, setPortVlan } from './portAssignment';

/** The VLANs of the plan as options; a VLAN a port has but the plan lacks is offered too, so it is not changed by accident. */
function VlanOptions({ vlans, current }: { vlans: PlanVlan[]; current?: number }) {
  return <>
    {current !== undefined && !vlans.some(v => v.id === current) && <option value={current}>{current} (no está en el plan)</option>}
    {vlans.map(v => <option key={v.id} value={v.id}>{v.id} · {v.name}</option>)}
  </>;
}

/**
 * «Puertos y VLAN» of a selected switch: its links to other switches and its access ports, each in one VLAN of the
 * plan. It reads and writes the planner document through `planRepository`, so the guides' planner sees the same ports.
 */
export function SwitchPorts({ device, planRepository, revision, onMessage }: {
  device: Device; planRepository: PlanRepository; revision: unknown; onMessage: (message: string) => void;
}) {
  const { loaded, problem, locked, errors, change } = usePlanDocument(planRepository, revision, onMessage);
  const plan = loaded?.plan;
  const own = plan && planSwitchOf(plan, device.id);
  const ports = own ? plan.ports.filter(p => p.switch === own.id) : [];
  const nameOfSwitch = (id: string) => plan?.switches.find(s => s.id === id)?.name.trim() || id;
  const links = own ? plan.links.filter(l => l.a.switch === own.id || l.b.switch === own.id) : [];

  return (
    <div className="switch-ports">
      {errors.map(e => <p key={e} className="infra-form__error" role="alert">{e}</p>)}
      {problem && <p className="infra-form__error">{problem} {PLAN_READ_ONLY}</p>}
      {!loaded && errors.length === 0 && <p className="muted">Leyendo el plan de red…</p>}
      {loaded && !problem && !own && <p className="muted">Este switch aún no está en el plan de red, así que no se le pueden asignar puertos desde aquí.</p>}
      {plan && own && !problem && <>
        {plan.switches[0]?.id === own.id && <p className="muted">Es el switch núcleo: las guías empiezan por él.</p>}
        <h3>Enlaces con otros switches</h3>
        {links.length === 0 ? <p className="muted">Ningún enlace con otro switch. Únelos en el mapa con un enlace de datos, troncal o LAG.</p> : (
          <ul className="switch-ports__links">
            {links.map(l => {
              const [mine, theirs] = l.a.switch === own.id ? [l.a, l.b] : [l.b, l.a];
              return <li key={l.id}>{mine.interface || 'Sin puerto'} → {nameOfSwitch(theirs.switch)} · VLAN nativa {l.nativeVlan}</li>;
            })}
          </ul>
        )}
        <p className="muted">El puerto y la VLAN nativa de cada enlace se cambian en su ficha: pulsa su línea en el mapa.</p>
        <h3>Puertos de acceso</h3>
        {ports.length === 0 ? <p className="muted">Aún no hay puertos de acceso. Añade cada puerto donde conectas un equipo y la VLAN en la que va.</p> : (
          <table className="vlan-table switch-ports__table" aria-label={`Puertos de acceso de ${device.nombre}`}>
            <thead><tr><th scope="col">Puerto</th><th scope="col">VLAN</th><th scope="col"><span className="visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              {ports.map(p => (
                <tr key={p.id}>
                  <td className="vlan-table__net">{p.interface}</td>
                  <td>
                    <select aria-label={`VLAN del puerto ${p.interface}`} value={p.vlan} disabled={locked}
                      onChange={e => { const vlan = Number(e.target.value); void change(setPortVlan(p.id, vlan), `Puerto ${p.interface} de ${device.nombre} en la VLAN ${vlan}.`); }}>
                      <VlanOptions vlans={plan.vlans} current={p.vlan} />
                    </select>
                  </td>
                  <td className="vlan-table__actions">
                    <button type="button" className="chip" disabled={locked} aria-label={`Quitar el puerto ${p.interface}`}
                      onClick={() => void change(removePort(p.id), `Puerto ${p.interface} de ${device.nombre} quitado.`)}>Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {plan.vlans.length === 0
          ? <p className="muted">Aún no hay VLAN en el plan. Pulsa en un hueco del mapa y añádelas en «Red y VLAN»; luego vuelve aquí para asignar los puertos.</p>
          : <NewPortForm vlans={plan.vlans} locked={locked} problem={name => portProblem(name, ports)}
              onAdd={(name, vlan) => change(addAccessPort(device.id, name, vlan), `Puerto ${name.trim()} de ${device.nombre} añadido en la VLAN ${vlan}.`)} />}
      </>}
    </div>
  );
}

/** The form of a new access port; it says what is wrong before anything is saved. */
function NewPortForm({ vlans, locked, problem, onAdd }: {
  vlans: PlanVlan[]; locked: boolean; problem: (name: string) => string; onAdd: (name: string, vlan: number) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [vlan, setVlan] = useState(vlans[0].id);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = problem(name);
    setError(found);
    if (!found && await onAdd(name, vlan)) setName('');
  };
  return (
    <form className="infra-form switch-ports__form" aria-label="Nuevo puerto de acceso" noValidate onSubmit={e => void submit(e)}>
      <label>Puerto<input value={name} placeholder="Ej.: gi1/0/5" spellCheck={false} onChange={e => { setName(e.target.value); setError(''); }} /></label>
      <label>VLAN<select value={vlan} onChange={e => setVlan(Number(e.target.value))}><VlanOptions vlans={vlans} current={vlan} /></select></label>
      {error && <p className="infra-form__error" role="alert">{error}</p>}
      <div className="infra-form__actions"><button type="submit" disabled={locked}>Añadir puerto</button></div>
    </form>
  );
}
