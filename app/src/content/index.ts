import tipos from '@content/kb/tipos.json';
import familias from '@content/kb/familias.json';
import severidades from '@content/kb/severidades.json';
import referencia from '@content/referencia/pyme.json';
import type { DeviceType, Family, ReferenceModel, Severity } from '../domain/types';

// Single entry point to the shared content; the guide (site/) reads the same files.
export const content = {
  tipos: tipos as DeviceType[],
  familias: familias as Family[],
  severidades: severidades as Severity[],
  referencia: referencia as ReferenceModel,
};

const byId = new Map(content.tipos.map(t => [t.id, t]));
export const typeOf = (id: string): DeviceType => byId.get(id) ?? byId.get('otro')!;
