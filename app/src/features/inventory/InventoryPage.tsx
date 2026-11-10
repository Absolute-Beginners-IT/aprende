import { useMemo, useState, type FormEvent } from 'react';
import type { Device } from '../../domain/types';
import type { InventoryRepository } from '../../ports/InventoryRepository';
import { analyzeInventory } from '../../domain/inventoryAnalysis';
import { parseInventoryCsv, slugify, toInventoryCsv } from '../../domain/inventoryCsv';
import { snippetsForDevice } from '../../domain/vendorSnippets';
import { importInventoryV1, upstreamOf } from '../../domain/topology';
import { content, typeOf } from '../../content';
import { PLANNER_URL } from '../../config';
import { useInventory } from './useInventory';
import { FindingList } from './FindingList';

/** Container for the learner's own inventory: persistence through the repository port only. */
export function InventoryPage({ repository }: { repository: InventoryRepository }) {
  const { topology, devices, message, setMessage, persist } = useInventory(repository);
  const [csv, setCsv] = useState('');

  const findings = useMemo(() => analyzeInventory(topology, new Date()), [topology]);
  const sorted = [...devices].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const nameOf = (id: string) => devices.find(d => d.id === id)?.nombre ?? id;

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, data = new FormData(form);
    const nombre = String(data.get('nombre') ?? '').trim();
    if (!nombre) return;
    const id = slugify(nombre);
    if (devices.some(d => d.id === id)) { setMessage(`Ya existe un equipo llamado ${nombre}.`); return; }
    const uplink = String(data.get('uplink') ?? '');
    const finSoporte = String(data.get('finSoporte') ?? '');
    const marca = String(data.get('marca') ?? '').trim();
    const modelo = String(data.get('modelo') ?? '').trim();
    // The device and the link to the one it is connected to go in one write.
    await persist(() => repository.apply({
      saveDevices: [{
        id, nombre, tipo: String(data.get('tipo')),
        criticidad: String(data.get('criticidad')) as Device['criticidad'],
        monitorizado: data.get('monitorizado') === 'on',
        ...(marca ? { marca } : {}),
        ...(modelo ? { modelo } : {}),
        ...(finSoporte ? { finSoporte } : {}),
      }],
      addLinks: uplink ? [{ a: { equipo: id }, b: { equipo: uplink }, tipo: 'datos' }] : [],
    }), `${nombre} añadido.`);
    form.reset();
  };

  const toggleMonitored = (d: Device) => persist(() => repository.apply({ saveDevices: [{ ...d, monitorizado: !d.monitorizado }] }), `${d.nombre} actualizado.`);
  // The device and its links go in one write, as on the map: no connection is left dangling.
  const remove = (d: Device) => persist(() => repository.apply({ removeDevices: [d.id] }), `${d.nombre} borrado.`);

  const importCsv = async () => {
    const parsed = parseInventoryCsv(csv);
    if (!parsed.length) { setMessage('No se encontró ningún equipo. Revisa que el CSV tenga cabecera.'); return; }
    // Rows whose names slugify to the same id are one device: keep the last row, as the store would.
    const existing = new Set(devices.map(d => d.id));
    const unique = [...new Map(parsed.map(d => [d.id, d])).values()];
    const repeated = parsed.length - unique.length;
    const updated = unique.filter(d => existing.has(d.id)).length;
    const summary = `${unique.length} equipos importados (nuevos: ${unique.length - updated}, actualizados: ${updated}).`
      + (updated ? ' Los equipos que ya existían se han sobrescrito con los datos del CSV.' : '')
      + (repeated === 1 ? ' 1 fila repetida por nombre se ha combinado: se conserva la última.' : '')
      + (repeated > 1 ? ` ${repeated} filas repetidas por nombre se han combinado: se conserva la última de cada una.` : '');
    // The whole import is one write: on failure nothing is stored and the CSV stays in the box for a retry.
    // The CSV has no place on the map: an overwritten device stays where the learner put it.
    await persist(async () => {
      await repository.apply(importInventoryV1(await repository.load(), unique));
      setCsv('');
    }, summary);
  };

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toInventoryCsv({ ...topology, equipos: sorted })], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `inventario_${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className="inventory">
      <p className="notice">Tu inventario se guarda <b>solo en este navegador</b>: no se envía a ningún servidor. Si borras los datos del navegador, se pierde, así que expórtalo de vez en cuando.</p>
      <div className="map-grid">
        <div className="stack">
          <form className="card form" onSubmit={add}>
            <h2>Añadir equipo</h2>
            <label>Nombre<input name="nombre" required placeholder="FW01" /></label>
            <label>Tipo<select name="tipo" defaultValue="switch">{content.tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
            <label>Marca<input name="marca" placeholder="Fortinet" /></label>
            <label>Modelo<input name="modelo" placeholder="FortiGate 60F" /></label>
            <label>Criticidad<select name="criticidad" defaultValue="Media"><option>Alta</option><option>Media</option><option>Baja</option></select></label>
            <label>Conectado a<select name="uplink" defaultValue=""><option value="">— Ninguno —</option>{sorted.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></label>
            <label>Fin de soporte<input name="finSoporte" type="date" /></label>
            <label className="check"><input name="monitorizado" type="checkbox" /> Monitorizado</label>
            <button type="submit" className="chip primary">Añadir</button>
          </form>
          <div className="card">
            <h2>Importar o exportar</h2>
            <p className="muted">Pega el contenido de <code>inventario.csv</code> o del CSV de <code>Descubrir-Red.ps1</code>, con cabecera.</p>
            <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={5} aria-label="CSV del inventario" />
            <div className="row">
              <button type="button" className="chip" onClick={() => void importCsv()} disabled={!csv.trim()}>Importar</button>
              <button type="button" className="chip" onClick={exportCsv} disabled={!devices.length}>Exportar CSV</button>
            </div>
          </div>
          {message && <p className="muted" role="status">{message}</p>}
          <div className="card">
            <h2>Tus equipos ({devices.length})</h2>
            {devices.length === 0 ? <p className="muted">Todavía no has añadido ningún equipo.</p> : (
              <ul className="devices">
                {sorted.map(d => {
                  const marcaModelo = [d.marca, d.modelo].filter(Boolean).join(' ');
                  const snippets = snippetsForDevice(d, content.fabricantes);
                  const uplinks = upstreamOf(topology.enlaces, d.id);
                  return (
                    <li key={d.id}>
                      <span><b>{d.nombre}</b> <span className="muted">· {typeOf(d.tipo).nombre}{marcaModelo ? ` · ${marcaModelo}` : ''}{uplinks.length ? ` · conectado a ${uplinks.map(nameOf).join(', ')}` : ''}</span></span>
                      <span className="row">
                        <button type="button" className="chip" aria-pressed={d.monitorizado} onClick={() => void toggleMonitored(d)}>{d.monitorizado ? 'Monitorizado' : 'Sin monitorizar'}</button>
                        <button type="button" className="chip" onClick={() => void remove(d)} aria-label={`Borrar ${d.nombre}`}>Borrar</button>
                      </span>
                      {d.tipo === 'switch' && <a className="plan-link" href={PLANNER_URL}>Planificar VLAN y puertos</a>}
                      {snippets.map(s => (
                        <details key={s.nombre} className="vendor">
                          <summary>{s.nombre}</summary>
                          <pre>{s.configuracion}</pre>
                        </details>
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <aside className="detail" aria-live="polite">
          <h2>Qué te falta</h2>
          {devices.length === 0 && <p className="muted">Añade tus equipos y aquí verás qué falta comparado con una pyme típica: copias, alta disponibilidad, SAI, monitorización y soporte.</p>}
          {devices.length > 0 && findings.length === 0 && <p>No se detecta ninguna carencia. ¡Buen trabajo!</p>}
          <FindingList findings={findings} />
        </aside>
      </div>
    </section>
  );
}
