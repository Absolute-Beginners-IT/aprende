import type { DeviceGuides } from '../../domain/deviceGuides';

const listFormat = new Intl.ListFormat('es', { type: 'conjunction' });

/** Why the guides have nothing for a device yet; shared by its ficha and the deployment plan. Nothing when it is covered. */
export function GuideNote({ guides }: { guides: DeviceGuides }) {
  if (guides.estado === 'tipo-sin-guias') return <p className="muted">Las guías de este tipo de equipo llegarán más adelante.</p>;
  if (guides.estado === 'modelo-desconocido') return <p className="muted">Indica la marca y el modelo para ver sus guías. Las guías cubren: {listFormat.format(guides.plataformas.map(p => p.nombre))}.</p>;
  return null;
}
