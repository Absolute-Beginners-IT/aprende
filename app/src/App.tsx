import { useEffect, useMemo, useState } from 'react';
import { MapPage } from './features/map/MapPage';
import { ScenariosPage } from './features/scenarios/ScenariosPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { createLocalStorageInventoryRepository } from './adapters/localStorageInventoryRepository';
import { content } from './content';
import { GUIDE_URL } from './config';
import { VIEWS, parseHash, scenarioHash } from './routing';

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
  const [route, setRoute] = useState(() => parseHash(location.hash));
  const repository = useMemo(() => createLocalStorageInventoryRepository(browserStorage()), []);
  useEffect(() => {
    const onHash = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="wrap">
      <header className="head">
        <span className="label">Guía para administradores de sistemas junior</span>
        <h1>Mapa de infraestructura</h1>
        <p className="muted">{content.referencia.descripcion} Activa y desactiva las capas para ver cómo encaja cada pieza.</p>
        <p className="muted">Aquí se practica. Para aprender los conceptos paso a paso, sigue la <a href={`${GUIDE_URL}ruta/`}>ruta de aprendizaje</a>; si una palabra no te suena, búscala en el <a href={`${GUIDE_URL}glosario/`}>glosario</a>.</p>
      </header>
      <nav className="tabs" aria-label="Secciones">
        {VIEWS.map(([k, label]) => (
          <a key={k} href={`#${k}`} className="tab" aria-current={route.view === k ? 'page' : undefined}>{label}</a>
        ))}
        <a href={`${GUIDE_URL}ruta/`} className="tab">Guía y ruta ↗</a>
      </nav>
      <main>
        {route.view === 'mapa' && <MapPage />}
        {route.view === 'escenarios' && <ScenariosPage scenarioId={route.scenarioId} onChoose={id => { location.hash = scenarioHash(id); }} />}
        {route.view === 'mi-infraestructura' && <InventoryPage repository={repository} />}
      </main>
    </div>
  );
}
