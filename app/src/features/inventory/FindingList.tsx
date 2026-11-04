import type { Finding } from '../../domain/inventoryAnalysis';

const LEVEL = { crit: 'Urgente', warn: 'Pendiente', info: 'Dato' } as const;

/** The gaps found in the inventory, most urgent first (the order `analyzeInventory` returns). */
export function FindingList({ findings }: { findings: Finding[] }) {
  return <ul className="findings">{findings.map(f => <li key={f.mensaje} className={`finding ${f.nivel}`}><b>{LEVEL[f.nivel]}</b> {f.mensaje}</li>)}</ul>;
}
