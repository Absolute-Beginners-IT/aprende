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
