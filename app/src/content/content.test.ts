import { describe, expect, it } from 'vitest';
import { content } from './index';

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
});
