// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DeploymentPlanPage } from './DeploymentPlanPage';
import { PROGRESS_KEY } from './deploymentProgress';
import type { Device } from '../../domain/types';
import type { InventoryRepository } from '../../ports/InventoryRepository';
import { content } from '../../content';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function memoryRepository(initial: Device[] = []): InventoryRepository {
  const devices = new Map(initial.map(d => [d.id, d]));
  return {
    async list() { return [...devices.values()]; },
    async save(d) { devices.set(d.id, d); },
    async saveAll(ds, removed = []) { for (const d of ds) devices.set(d.id, d); for (const id of removed) devices.delete(id); },
    async remove(id) { devices.delete(id); },
  };
}

const dev = (id: string, extra: Partial<Device> = {}): Device => ({ id, nombre: id.toUpperCase(), tipo: 'switch', criticidad: 'Media', monitorizado: false, ...extra });
const network = [
  dev('core', { nombre: 'CORE', marca: 'HPE Aruba', modelo: '6100 24G', uplinks: ['fw'] }),
  dev('fw', { nombre: 'FW01', tipo: 'firewall', criticidad: 'Alta', marca: 'Fortinet', modelo: 'FortiGate 60F', uplinks: ['isp'] }),
  dev('isp', { nombre: 'Internet', tipo: 'internet' }),
];
const stepsOf = (tipo: string) => { const t = content.tipos.find(x => x.id === tipo)!; return (t.alertas.length ? 2 : 1) + t.actuaciones.length; };
// FW01 has no guides; CORE (Aruba CX 6100) has the ten deployment guides.
const TOTAL = stepsOf('firewall') + 10 + stepsOf('switch');

const renderPage = (devices: Device[] = network, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) =>
  render(<DeploymentPlanPage repository={memoryRepository(devices)} storage={storage} />);
const card = (name: string) => within(screen.getByRole('article', { name }));

describe('DeploymentPlanPage', () => {
  it('shows one card per device in the order they are deployed, without Internet', async () => {
    renderPage();
    const cards = await screen.findAllByRole('article');
    expect(cards.map(c => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual(['1. FW01', '2. CORE']);
    expect(card('2. CORE').getByText('Switch · HPE Aruba 6100 24G · cuelga de FW01')).toBeTruthy();
    expect(card('1. FW01').getByText('Firewall · Fortinet FortiGate 60F · cuelga de Internet')).toBeTruthy();
    expect(screen.getByText(/solo en este navegador/)).toBeTruthy();
  });

  it('shows the three columns: guides to configure, what to watch and what to maintain', async () => {
    renderPage();
    await screen.findAllByRole('article');
    const core = card('2. CORE');
    expect(core.getAllByRole('heading', { level: 4 }).map(h => h.textContent)).toEqual(['Configurar', 'Vigilar', 'Mantener']);
    expect(core.getByRole('link', { name: 'Configurar la IP de gestión' }).getAttribute('href')).toBe('./guias/#/p/aruba-aoscx/mgmt-ip?equipo=core');
    expect(core.getByRole('checkbox', { name: 'Configurar la IP de gestión' })).toBeTruthy();
    const switchType = content.tipos.find(t => t.id === 'switch')!;
    expect(core.getByRole('checkbox', { name: `Monitorización: ${switchType.metodo}` })).toBeTruthy();
    expect(core.getByRole('checkbox', { name: switchType.actuaciones[0].que })).toBeTruthy();
    expect(core.getByText(switchType.actuaciones[0].frecuencia)).toBeTruthy();
  });

  it('explains in Configurar why a device has no guides, as its ficha does', async () => {
    renderPage();
    await screen.findAllByRole('article');
    expect(card('1. FW01').getByText('Las guías de este tipo de equipo llegarán más adelante; de momento cubren switches.')).toBeTruthy();
    expect(card('1. FW01').queryAllByRole('link')).toHaveLength(0);
  });

  it('saves a ticked step in this browser, counts it and keeps it after reloading', async () => {
    const { unmount } = renderPage();
    await screen.findAllByRole('article');
    expect(screen.getByText(`0 de ${TOTAL} pasos hechos`)).toBeTruthy();
    fireEvent.click(card('2. CORE').getByRole('checkbox', { name: 'Configurar la IP de gestión' }));
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!)).toEqual({ core: ['config:mgmt-ip'] });
    expect(screen.getByText(`1 de ${TOTAL} pasos hechos`)).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Progreso del plan' });
    expect([bar.getAttribute('aria-valuenow'), bar.getAttribute('aria-valuemax')]).toEqual(['1', String(TOTAL)]);
    unmount();

    renderPage();
    await screen.findAllByRole('article');
    expect((card('2. CORE').getByRole('checkbox', { name: 'Configurar la IP de gestión' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(`1 de ${TOTAL} pasos hechos`)).toBeTruthy();
    fireEvent.click(card('2. CORE').getByRole('checkbox', { name: 'Configurar la IP de gestión' }));
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!)).toEqual({ core: [] });
    expect(screen.getByText(`0 de ${TOTAL} pasos hechos`)).toBeTruthy();
  });

  it('ignores saved steps of devices no longer in the inventory and unreadable progress', async () => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ gone: ['vigilar:metodo'], core: ['vigilar:metodo', 'no-existe', 3] }));
    const { unmount } = renderPage();
    expect(await screen.findByText(`1 de ${TOTAL} pasos hechos`)).toBeTruthy();
    unmount();
    localStorage.setItem(PROGRESS_KEY, '{roto');
    renderPage();
    expect(await screen.findByText(`0 de ${TOTAL} pasos hechos`)).toBeTruthy();
  });

  it('says so when the browser refuses to save the progress, without ticking the step', async () => {
    const failing = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    renderPage(network, failing);
    await screen.findAllByRole('article');
    const box = card('2. CORE').getByRole('checkbox', { name: 'Configurar la IP de gestión' }) as HTMLInputElement;
    fireEvent.click(box);
    expect(screen.getByRole('status').textContent).toBe('No se ha podido guardar el progreso en este navegador: QuotaExceededError');
    expect(box.checked).toBe(false);
    expect(screen.getByText(`0 de ${TOTAL} pasos hechos`)).toBeTruthy();
  });

  it('invites to add devices in «Mapa» when the inventory is empty', async () => {
    renderPage([]);
    expect(await screen.findByText(/Todavía no tienes equipos en tu plan/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mapa' }).getAttribute('href')).toBe('#mi-infraestructura');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('prints the plan', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPage();
    await screen.findAllByRole('article');
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('handles a device whose id is also a name built into JavaScript objects', async () => {
    renderPage([dev('constructor', { nombre: 'Constructor' }), dev('__proto__', { nombre: '__proto__', uplinks: ['constructor'] })]);
    await screen.findAllByRole('article');
    const first = card('1. Constructor');
    fireEvent.click(first.getAllByRole('checkbox')[0]);
    expect((first.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true);
    expect((card('2. __proto__').getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(false);
  });
});
