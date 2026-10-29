import { MapPage } from './features/map/MapPage';
import { content } from './content';

export function App() {
  return (
    <div className="wrap">
      <header className="head">
        <span className="label">Guía para administradores de sistemas junior</span>
        <h1>Mapa de infraestructura</h1>
        <p className="muted">{content.referencia.descripcion} Activa y desactiva las capas para ver cómo encaja cada pieza.</p>
      </header>
      <main><MapPage /></main>
    </div>
  );
}
