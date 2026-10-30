import { useEffect, useMemo, useState } from 'react';
import { MapPage } from './features/map/MapPage';
import { ScenariosPage } from './features/scenarios/ScenariosPage';
import { GlossaryPage } from './features/glossary/GlossaryPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { createLocalStorageInventoryRepository } from './adapters/localStorageInventoryRepository';
import { content } from './content';
import { ThemeToggle } from './features/theme/ThemeToggle';

const VIEWS = [
  ['mapa', 'Mapa'],
  ['escenarios', 'Escenarios'],
  ['glosario', 'Glosario'],
  ['mi-infraestructura', 'Mi infraestructura'],
] as const;
type View = typeof VIEWS[number][0];

const viewFromHash = (): View => {
  const h = location.hash.slice(1);
  return VIEWS.some(([k]) => k === h) ? (h as View) : 'mapa';
};

// localStorage can be unavailable (private mode, blocked storage): fall back to memory for the session.
function browserStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    localStorage.setItem('mapa-infra:probe', '1');
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
  }
}

export function App() {
  const [view, setView] = useState<View>(viewFromHash);
  const repository = useMemo(() => createLocalStorageInventoryRepository(browserStorage()), []);
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="wrap">
      {/* Relative links: the app is served under the site (/app/), so ../ is the site and ./guias/ the guides. */}
      <p className="prototype-notice" role="note" aria-label="Aviso de prototipo">
        <b>Prototipo en desarrollo:</b> el contenido se está revisando y no sustituye a la documentación oficial del fabricante ni a una prueba en laboratorio. <a href="../que-es-esto/">Qué es esto</a>
      </p>
      <div className="head-bar">
        <a href="../" className="home-link">← Volver a la web</a>
        <ThemeToggle />
      </div>
      <header className="head">
        <span className="label">Guía para administradores de sistemas junior</span>
        <h1>Mapa de infraestructura</h1>
        <p className="muted">{content.referencia.descripcion} Activa y desactiva las capas para ver cómo encaja cada pieza.</p>
      </header>
      <nav className="tabs" aria-label="Secciones">
        {VIEWS.map(([k, label]) => (
          <a key={k} href={`#${k}`} className="tab" aria-current={view === k ? 'page' : undefined}>{label}</a>
        ))}
        <a href="./guias/" className="tab">Guías de switching</a>
      </nav>
      <main>
        {view === 'mapa' && <MapPage />}
        {view === 'escenarios' && <ScenariosPage />}
        {view === 'glosario' && <GlossaryPage />}
        {view === 'mi-infraestructura' && <InventoryPage repository={repository} />}
      </main>
    </div>
  );
}
