import { describe, expect, it } from 'vitest';
import { content } from './index';
import { GUIDE_DEVICE_TYPES } from '../domain/types';

const ids = (items: { id: string }[]) => items.map(i => i.id);
const duplicates = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);

describe('shared content integrity', () => {
  const { tipos, familias, severidades, referencia } = content;
  const tipoIds = new Set(ids(tipos));
  const nodoIds = new Set(ids(referencia.nodos));

  it('has unique ids', () => {
    expect(duplicates(ids(tipos))).toEqual([]);
    expect(duplicates(ids(referencia.nodos))).toEqual([]);
    expect(duplicates(ids(referencia.capas))).toEqual([]);
  });

  it('references only known families and severities from each type', () => {
    const fams = new Set(ids(familias)), sevs = new Set(ids(severidades));
    for (const t of tipos) {
      expect(fams, `familia de ${t.id}`).toContain(t.familia);
      for (const a of t.alertas) expect(sevs, `severidad en ${t.id}`).toContain(a.severidad);
    }
  });

  it('explains every type for a junior (what it is, what for, what if it fails, common mistakes)', () => {
    for (const t of tipos) {
      for (const field of ['queEs', 'paraQue', 'siFalla'] as const) expect(t[field]?.trim(), `${field} de ${t.id}`).toBeTruthy();
      expect(t.errores?.length, `errores de ${t.id}`).toBeGreaterThan(0);
    }
  });

  it('ties every vendor configuration to known device types and a valid pattern', () => {
    for (const f of content.fabricantes) {
      expect(f.tipos?.length, `tipos de ${f.nombre}`).toBeGreaterThan(0);
      for (const t of f.tipos) expect(tipoIds, `tipo de ${f.nombre}`).toContain(t);
      expect(() => new RegExp(f.patron, f.flags), `patrón de ${f.nombre}`).not.toThrow();
    }
  });

  it('keeps the content free of company-specific references', () => {
    const text = JSON.stringify(content).toLowerCase();
    for (const word of ['ninjaone', 'consultoría', 'vuestro']) expect(text, word).not.toContain(word);
  });

  it('defines every glossary term once and links only to known types', () => {
    expect(content.glosario.length).toBeGreaterThan(0);
    expect(duplicates(ids(content.glosario))).toEqual([]);
    for (const g of content.glosario) {
      expect(g.termino.trim() && g.definicion.trim(), g.id).toBeTruthy();
      for (const t of g.tipos ?? []) expect(tipoIds, `tipo en ${g.id}`).toContain(t);
    }
  });

  it('walks every incident scenario through nodes that exist on the reference map', () => {
    expect(content.escenarios.length).toBeGreaterThan(0);
    expect(duplicates(ids(content.escenarios))).toEqual([]);
    for (const e of content.escenarios) {
      expect(e.pasos.length, e.id).toBeGreaterThan(0);
      for (const p of e.pasos) for (const n of p.nodos) expect(nodoIds, `nodo en ${e.id}`).toContain(n);
    }
  });

  it('builds the reference map only from known types, layers and nodes', () => {
    const capas = new Set(ids(referencia.capas));
    for (const n of referencia.nodos) {
      expect(tipoIds, `tipo de ${n.id}`).toContain(n.tipo);
      expect(capas, `capa de ${n.id}`).toContain(n.capa);
    }
    for (const e of referencia.enlaces) {
      expect(nodoIds).toContain(e.desde);
      expect(nodoIds).toContain(e.hasta);
    }
    for (const z of referencia.zonas) for (const n of z.nodos) expect(nodoIds, `nodo en ${z.id}`).toContain(n);
  });

  it('ties every guide task to a known group and platform, and every platform pattern compiles', () => {
    const { plataformas, grupos, tareas } = content.guias;
    const grupoIds = new Set(ids(grupos)), plataformaIds = new Set(ids(plataformas));
    for (const t of tareas) {
      expect(grupoIds, `grupo de ${t.id}`).toContain(t.grupo);
      for (const p of t.plataformas) expect(plataformaIds, `plataforma de ${t.id}`).toContain(p);
    }
    for (const p of plataformas) expect(() => new RegExp(p.patron, p.flags), `patrón de ${p.id}`).not.toThrow();
    for (const p of plataformas) expect(GUIDE_DEVICE_TYPES, `tipo de ${p.id}`).toContain(p.tipo);
  });
});
