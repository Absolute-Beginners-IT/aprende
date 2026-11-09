// Shapes of the shared content in ../content. Keys stay in Spanish because they mirror the content files.

export type FamilyId = 'perim' | 'net' | 'comp' | 'data' | 'power' | 'other';

export interface Alert {
  que: string;
  aviso: string;
  critico: string;
  severidad: string;
  canal: string;
  horario: string;
  accion: string;
}

export interface Maintenance {
  que: string;
  frecuencia: string;
  disparador: string | null;
}

export interface DeviceType {
  id: string;
  nombre: string;
  familia: FamilyId;
  icono: string;
  metodo: string;
  plantillaZabbix: string;
  metricas: string[];
  alertas: Alert[];
  actuaciones: Maintenance[];
  queEs: string;
  paraQue: string;
  siFalla: string;
  errores: string[];
}

export interface Family { id: FamilyId; nombre: string }
export interface Severity { id: string; nombre: string; nivel: 'crit' | 'warn' | 'info' }

/** Monitoring setup for a brand; `patron` is matched against brand, model and firmware, `tipos` limits it to device types. */
export interface VendorSnippet { patron: string; flags: string; tipos: string[]; nombre: string; configuracion: string }
/** Index of the switching guides (`content/guias-indice.json`, generated from `guias/`): `patron` is matched like `VendorSnippet`'s. */
/** Kinds of element the guides cover (`tipo`), mirroring `DEVICE_TYPES` in `guias/src/domain/schema.ts`. */
export const GUIDE_DEVICE_TYPES = ['switch', 'firewall', 'hypervisor', 'storage', 'backup'] as const;
export type GuideDeviceType = (typeof GUIDE_DEVICE_TYPES)[number];
export interface GuidePlatform { id: string; nombre: string; fabricante: string; tipo: GuideDeviceType; patron: string; flags: string }
export interface GuideGroup { id: string; nombre: string }
export interface GuideTask { id: string; titulo: string; grupo: string; plataformas: string[] }
export interface GuideIndex { plataformas: GuidePlatform[]; grupos: GuideGroup[]; tareas: GuideTask[] }
export interface RoadmapPhase { fase: string; objetivo: string; pasos: { id: string; texto: string }[] }

export interface GlossaryTerm { id: string; termino: string; definicion: string; tipos?: string[] }

export interface ScenarioStep { titulo: string; texto: string; nodos: string[] }
export interface Scenario {
  id: string;
  titulo: string;
  sintoma: string;
  pasos: ScenarioStep[];
  causasTipicas: string[];
  aprendizaje: string;
}

export interface Layer { id: string; nombre: string; descripcion: string }

export interface ReferenceNode {
  id: string;
  tipo: string;
  nombre: string;
  capa: string;
  x: number;
  y: number;
  descripcion: string;
}

export type LinkKind = 'red' | 'ha' | 'aloja' | 'copia' | 'energia';

export interface ReferenceLink { desde: string; hasta: string; tipo?: LinkKind }
export interface Zone { id: string; nombre: string; nodos: string[] }

export interface ReferenceModel {
  id: string;
  nombre: string;
  descripcion: string;
  capas: Layer[];
  nodos: ReferenceNode[];
  enlaces: ReferenceLink[];
  zonas: Zone[];
}

export interface Position { x: number; y: number }

/** A device in the learner's own inventory ("Mi infraestructura" mode). */
export interface Device {
  id: string;
  nombre: string;
  tipo: string;
  criticidad: 'Alta' | 'Media' | 'Baja';
  monitorizado: boolean;
  marca?: string;
  modelo?: string;
  ip?: string;
  ubicacion?: string;
  rol?: string;
  uplinks?: string[];
  firmware?: string;
  finSoporte?: string;
  notas?: string;
  /** Where the learner placed it on the map; without it the map places it on its own. */
  posicion?: Position;
}
