// Link types of «Mi infraestructura» whose `b` end is what the `a` end hangs from: levels, deployment order and the
// planner's links follow them. The others join peers or carry power and management, with no side above the other.
export const HIERARCHICAL_LINK_TYPES: ReadonlySet<string> = new Set([
  'datos',
  'troncal',
  'lag',
  'wan',
  'almacenamiento',
])
