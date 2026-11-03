import { useEffect, useMemo, useState } from 'react';
import { MapPage } from './features/map/MapPage';
import { ScenariosPage } from './features/scenarios/ScenariosPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { createLocalStorageInventoryRepository } from './adapters/localStorageInventoryRepository';
import { content } from './content';
import { SiteNav } from './features/nav/SiteNav';
import { GUIDE_URL, PLANNER_URL } from './config';
import { parseHash, scenarioHash, type Route } from './routing';

// The map and its scenarios are one section ("Mapa"); "Mi infraestructura" is its own section.
// The glossary lives only in the guide: the old #glosario link opens the map (see routing.ts).
const MAP_VIEWS = [
  ['mapa', 'Mapa'],
  ['escenarios', 'Escenarios'],
] as const;

const routeFromHash = (): Route => parseHash(location.hash);

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
  const [route, setRoute] = useState<Route>(routeFromHash);
  const { view } = route;
  const repository = useMemo(() => createLocalStorageInventoryRepository(browserStorage()), []);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
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
            <p className="muted">Apunta tus equipos o importa tu inventario y descubre qué te falta. Después, en <b>Red y VLAN</b>, diseña las VLAN y los enlaces de tus switches y obtén sus comandos.</p>
            <nav className="tabs" aria-label="Mi infraestructura">
              <a href="#mi-infraestructura" className="tab" aria-current="page">Inventario</a>
              <a href={PLANNER_URL} className="tab">Red y VLAN</a>
            </nav>
          </header>
        ) : (
          <>
            <header className="head">
              <span className="label">Mapa</span>
              <h1>Mapa de infraestructura</h1>
              <p className="muted">{content.referencia.descripcion} Activa y desactiva las capas para ver cómo encaja cada pieza.</p>
              <p className="muted">Aquí se practica. Para aprender los conceptos paso a paso, sigue la <a href={`${GUIDE_URL}ruta/`}>ruta de aprendizaje</a> de la guía; si una palabra no te suena, búscala en el <a href={`${GUIDE_URL}glosario/`}>glosario</a>.</p>
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
          {view === 'escenarios' && <ScenariosPage scenarioId={route.scenarioId} onChoose={id => { location.hash = scenarioHash(id); }} />}
          {inventory && <InventoryPage repository={repository} />}
        </main>
      </div>
    </>
  );
}
