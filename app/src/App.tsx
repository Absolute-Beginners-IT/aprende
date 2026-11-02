import { useEffect, useMemo, useState } from 'react';
import { MapPage } from './features/map/MapPage';
import { ScenariosPage } from './features/scenarios/ScenariosPage';
import { GlossaryPage } from './features/glossary/GlossaryPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { createLocalStorageInventoryRepository } from './adapters/localStorageInventoryRepository';
import { content } from './content';
import { SiteNav } from './features/nav/SiteNav';

// The map, its scenarios and its glossary are one section ("Mapa"); "Mi infraestructura" is its own section.
const MAP_VIEWS = [
  ['mapa', 'Mapa'],
  ['escenarios', 'Escenarios'],
  ['glosario', 'Glosario'],
] as const;
type View = typeof MAP_VIEWS[number][0] | 'mi-infraestructura';

const viewFromHash = (): View => {
  const h = location.hash.slice(1);
  return h === 'mi-infraestructura' || MAP_VIEWS.some(([k]) => k === h) ? (h as View) : 'mapa';
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

  const inventory = view === 'mi-infraestructura';

  return (
    <>
      <p className="prototype-notice" role="note" aria-label="Aviso de prototipo">
        <b>Prototipo en desarrollo:</b> el contenido se está revisando y no sustituye a la documentación oficial del fabricante ni a una prueba en laboratorio. <a href="../que-es-esto/">Qué es esto</a>
      </p>
      <SiteNav current={inventory ? 'infra' : 'mapa'} />
      <div className="wrap">
        {inventory ? (
          <header className="head">
            <span className="label">Mi infraestructura</span>
            <h1>Compara tu red con la de una pyme típica</h1>
            <p className="muted">Apunta tus equipos o importa tu inventario y descubre qué te falta.</p>
          </header>
        ) : (
          <>
            <header className="head">
              <span className="label">Mapa</span>
              <h1>Mapa de infraestructura</h1>
              <p className="muted">{content.referencia.descripcion} Activa y desactiva las capas para ver cómo encaja cada pieza.</p>
            </header>
            <nav className="tabs" aria-label="Vistas del mapa">
              {MAP_VIEWS.map(([k, label]) => (
                <a key={k} href={`#${k}`} className="tab" aria-current={view === k ? 'page' : undefined}>{label}</a>
              ))}
            </nav>
          </>
        )}
        <main>
          {view === 'mapa' && <MapPage />}
          {view === 'escenarios' && <ScenariosPage />}
          {view === 'glosario' && <GlossaryPage />}
          {inventory && <InventoryPage repository={repository} />}
        </main>
      </div>
    </>
  );
}
