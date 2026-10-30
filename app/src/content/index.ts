import tipos from '@content/kb/tipos.json';
import familias from '@content/kb/familias.json';
import severidades from '@content/kb/severidades.json';
import fabricantes from '@content/kb/fabricantes.json';
import hojaDeRuta from '@content/kb/hoja-de-ruta.json';
import referencia from '@content/referencia/pyme.json';
import glosario from '@content/glosario.json';
import escenarios from '@content/escenarios.json';
import type { DeviceType, Family, GlossaryTerm, ReferenceModel, RoadmapPhase, Scenario, Severity, VendorSnippet } from '../domain/types';

// Single entry point to the shared content; the guide (site/) reads the same files.
export const content = {
  tipos: tipos as DeviceType[],
  familias: familias as Family[],
  severidades: severidades as Severity[],
  fabricantes: fabricantes as VendorSnippet[],
  hojaDeRuta: hojaDeRuta as RoadmapPhase[],
  referencia: referencia as ReferenceModel,
  glosario: glosario as GlossaryTerm[],
  escenarios: escenarios as Scenario[],
};

const byId = new Map(content.tipos.map(t => [t.id, t]));
export const typeOf = (id: string): DeviceType => byId.get(id) ?? byId.get('otro')!;
