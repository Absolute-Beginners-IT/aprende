import { useState } from 'react';
import { content, typeOf } from '../../content';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function GlossaryPage() {
  const [query, setQuery] = useState('');
  const q = normalize(query.trim());
  const terms = [...content.glosario]
    .sort((a, b) => a.termino.localeCompare(b.termino, 'es'))
    .filter(g => !q || normalize(`${g.termino} ${g.definicion}`).includes(q));

  return (
    <section className="glossary">
      <label className="search">
        <span>Buscar término</span>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="VLAN, DNS, RAID…" />
      </label>
      {terms.length === 0 && <p className="muted">No hay ningún término que coincida.</p>}
      <dl className="terms">
        {terms.map(g => (
          <div key={g.id} className="term">
            <dt>{g.termino}</dt>
            <dd>
              {g.definicion}
              {g.tipos?.length ? <span className="muted"> Relacionado con: {g.tipos.map(t => typeOf(t).nombre).join(', ')}.</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
