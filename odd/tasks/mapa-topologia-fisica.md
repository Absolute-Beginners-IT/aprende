Redesign «Mi infraestructura» so its map can show a real physical infrastructure diagram (HA pairs, stacks, LAGs, ports).
Branch: feat/mapa-topologia-modelo (slice 1) · Delivery: ask-on-risk, one PR per slice · Tests: vitest (app, guias), tsc, biome (guias).

## Specs

- **S1** Scope (user decision, L3): physical schema first. VLANs only as a field of a link; no logical view in this feature.
- **S2** A link is its own entity: `{ id, a: { equipo, puerto? }, b: { equipo, puerto? }, tipo, velocidad?, vlans?, notas? }`.
  `tipo` is one of `datos`, `troncal`, `lag`, `ha`, `stack`, `wan`, `almacenamiento`, `gestion`, `energia`. A pair of
  devices may have several links.
- **S3** Hierarchy: for `datos`, `troncal`, `lag`, `wan` and `almacenamiento`, `b` is the upstream side (what `a` hangs
  from). `ha`, `stack`, `gestion` and `energia` carry no hierarchy. Levels and deployment order use only hierarchical links.
- **S4** A group is its own entity: `{ id, tipo: 'ha' | 'stack' | 'cluster', nombre, miembros: string[] }`.
- **S5** Storage v2: one key `mapa-infra:topologia` holding `{ version: 2, equipos, enlaces, grupos }`, written with a
  single `setItem` per change. When it is missing, the old key `mapa-infra:inventario` (a `Device[]` with `uplinks`) is
  migrated: each uplink becomes a `datos` link with `a` = the device and `b` = the uplink target; duplicates are dropped;
  uplinks to ids not in the inventory are kept as links (the analysis keeps reporting them). The old key is never
  deleted or rewritten. Unreadable or foreign data reads as an empty topology, as today.
- **S6** Removing a device removes its links and takes it out of every group, in the same write.
- **S7** Slice 1 changes no drawing: the map shows one line per link, as today, and its connect gesture still creates a
  `datos` link from the dragged device to the target (refused if the pair already has a hierarchical link either way).
- **S8** Everything that used `uplinks` reads links instead, with the same visible behaviour: map, list page («conectado
  a …», uplink field when adding), CSV import/export (column `uplink` kept: import makes `datos` links, export lists
  the device's upstream devices), deployment plan («cuelga de»), inventory analysis («depende de … que no está en el
  inventario»), and the guides' planner (reads `mapa-infra:topologia` first, then the old key).
- **S9** Later slices (not in slice 1): drawing by tiers with groups and typed orthogonal lines (slice 2), editing link
  type, ports and groups (slice 3), planner/deployment/analysis using ports and groups (slice 4), link export and route
  content (slice 5).

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2–S8 | delegated (context backstop: long parent session) | pending | |
| T2 | verification of T1 (high-risk items 1 and 3) | independent verifier | pending | |
| T3 | S9 slice 2: tiers, groups, typed lines | pending decision after T1 | pending | |

## Log

- **L1** (2026-11-10, user, verbatim): «El problema de mi infraestructura es que las conexiones no se ven bien reflejadas,
  Si ponemos dos conexiones entre firewalls para reflejar el HA acaba siendo un amalgama de líneas sin sentido. Hay que
  repensar bien la herramienta y planificarla para reflejar un esquema real de infraestructura. Haz el análisis
  pertinente y muestra el plan»
- **L2** Analysis: a connection is only `Device.uplinks` (child → parent): no type, no ports, at most one per pair
  (`connectDevices` refuses a second either way); rows come from uplink depth, so HA and stack peers stack vertically;
  every edge uses one top and one bottom handle. Reproduced with 2 firewalls, 2 core switches, 2 access switches,
  2 hypervisors and a NAS.
- **L3** (2026-11-10, user, verbatim): «Físico primero» — answer to the scope question (physical vs physical + logical).
- **L4** (2026-11-10, user, verbatim): «arranca» — start slice 1 (model v2 and migration).
