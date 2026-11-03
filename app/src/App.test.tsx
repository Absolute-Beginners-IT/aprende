// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';
import { content } from './content';

// Same key and values as the switching guides, so one choice applies to the whole website.
const THEME_KEY = 'switching-manual:theme';

// Each test starts on the map, whatever hash another test (or a loop inside one) left behind.
beforeEach(() => { location.hash = ''; });

afterEach(() => {
  cleanup();
  location.hash = '';
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('App', () => {
  it('says on every section that the site is a prototype and links to what it is', () => {
    for (const hash of ['', '#escenarios', '#glosario', '#mi-infraestructura']) {
      location.hash = hash;
      const { unmount } = render(<App />);
      const notice = screen.getByRole('note', { name: 'Aviso de prototipo' });
      expect(notice.textContent).toBe('Prototipo en desarrollo: el contenido se está revisando y no sustituye a la documentación oficial del fabricante ni a una prueba en laboratorio. Qué es esto');
      expect(screen.getByRole('link', { name: 'Qué es esto' }).getAttribute('href')).toBe('../que-es-esto/');
      unmount();
    }
  });

  it('shows the same website navigation as the site and the guides', () => {
    render(<App />);
    const nav = within(screen.getAllByRole('navigation', { name: 'Secciones' })[0]);
    expect(nav.getAllByRole('link').map(a => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Inicio', '../'],
      ['Aprender', '../aprender/'],
      ['Mi infraestructura', '#mi-infraestructura'],
      ['Guías', './guias/'],
      ['Herramientas', '../herramientas/'],
    ]);
  });

  it('marks the current section in the navigation', () => {
    for (const [hash, current, sub] of [['', 'Aprender', 'Mapa'], ['#escenarios', 'Aprender', 'Escenarios'], ['#mi-infraestructura', 'Mi infraestructura', null]] as const) {
      location.hash = hash;
      const { unmount } = render(<App />);
      const nav = within(screen.getAllByRole('navigation', { name: 'Secciones' })[0]);
      expect(nav.getAllByRole('link').filter(a => a.getAttribute('aria-current') === 'page').map(a => a.textContent), hash).toEqual([current]);
      const tabs = screen.queryByRole('navigation', { name: 'Vistas del mapa' });
      if (sub) expect(within(tabs!).getByRole('link', { name: sub }).getAttribute('aria-current'), hash).toBe('page');
      else expect(tabs, hash).toBeNull();
      unmount();
    }
  });

  it('shows «Mi infraestructura» as two tabs: this inventory and the network planner of the guides', () => {
    location.hash = '#mi-infraestructura';
    render(<App />);
    const tabs = within(screen.getByRole('navigation', { name: 'Mi infraestructura' }));
    expect(tabs.getAllByRole('link').map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')])).toEqual([
      ['Inventario', '#mi-infraestructura', 'page'],
      ['Red y VLAN', './guias/#/plan', null],
    ]);
  });

  it('presents the reference map as part of Aprender, with a way back to it', () => {
    render(<App />);
    expect(screen.getByText('Aprender · Mapa de referencia')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a Aprender' }).getAttribute('href')).toBe('../aprender/');
  });

  it('offers only the map and the scenarios as map views, since the glossary lives in the guide', () => {
    render(<App />);
    const tabs = within(screen.getByRole('navigation', { name: 'Vistas del mapa' }));
    expect(tabs.getAllByRole('link').map(a => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Mapa', '#mapa'],
      ['Escenarios', '#escenarios'],
    ]);
  });

  it('opens the map for the old glossary link', () => {
    location.hash = '#glosario';
    render(<App />);
    const tabs = within(screen.getByRole('navigation', { name: 'Vistas del mapa' }));
    expect(tabs.getByRole('link', { name: 'Mapa' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('group', { name: 'Escenarios' })).toBeNull();
  });

  it('opens the scenario named in the link and updates the link when another is chosen', () => {
    const [first, second] = content.escenarios;
    location.hash = `#escenarios/${second.id}`;
    render(<App />);
    expect(screen.getByRole('button', { name: second.titulo }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(second.sintoma)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: first.titulo }));
    expect(location.hash).toBe(`#escenarios/${first.id}`);
  });

  it('sends learning to the guide route and unknown words to the guide glossary', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'ruta de aprendizaje' }).getAttribute('href')).toBe('../ruta/');
    expect(screen.getByRole('link', { name: 'glosario' }).getAttribute('href')).toBe('../glosario/');
  });

  it('cycles the theme system, light, dark and saves it where the guides read it', () => {
    render(<App />);
    const html = document.documentElement;
    fireEvent.click(screen.getByRole('button', { name: 'Tema: Sistema. Cambiar a Claro' }));
    expect(html.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('"light"');
    fireEvent.click(screen.getByRole('button', { name: 'Tema: Claro. Cambiar a Oscuro' }));
    expect(html.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('"dark"');
    fireEvent.click(screen.getByRole('button', { name: 'Tema: Oscuro. Cambiar a Sistema' }));
    expect(html.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe('"system"');
  });

  it('starts with the theme already chosen in the guides', () => {
    localStorage.setItem(THEME_KEY, '"dark"');
    render(<App />);
    expect(screen.getByRole('button', { name: 'Tema: Oscuro. Cambiar a Sistema' })).toBeTruthy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
