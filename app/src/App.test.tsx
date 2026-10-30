// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from './App';

// Same key and values as the switching guides, so one choice applies to the whole website.
const THEME_KEY = 'switching-manual:theme';

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
      ['Mapa', '#mapa'],
      ['Mi infraestructura', '#mi-infraestructura'],
      ['Guías', './guias/'],
      ['Herramientas', '../herramientas/'],
    ]);
  });

  it('marks the current section in the navigation', () => {
    for (const [hash, current, sub] of [['', 'Mapa', 'Mapa'], ['#escenarios', 'Mapa', 'Escenarios'], ['#glosario', 'Mapa', 'Glosario'], ['#mi-infraestructura', 'Mi infraestructura', null]] as const) {
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
