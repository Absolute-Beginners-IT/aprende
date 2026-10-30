// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from './App';

afterEach(() => { cleanup(); location.hash = ''; });

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

  it('links to the switching guides served inside the app', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'Guías de switching' }).getAttribute('href')).toBe('./guias/');
  });
});
