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
| T1 | S2–S8 | delegated (context backstop: long parent session) | done, checks green (L5); commit pending (parent) | |
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
- **L5** (2026-11-10, T1 writer) Slice 1 implemented. Model in `app/src/domain/types.ts` (`Link`, `LinkEnd`, `LinkType`,
  `DeviceGroup`, `Topology`; `Device` lost `uplinks`) and `app/src/domain/topology.ts` (`fromInventoryV1`,
  `fromStoredTopology`, `applyTopologyChange`, `importInventoryV1`, `isHierarchical`, `upstreamOf`, `downstreamOf`,
  `nextLinkId` = `${a}--${b}` then `-2`, `-3`…). Port: `load(): Promise<Topology>` and `apply(change)`; the localStorage
  adapter reads `mapa-infra:topologia`, migrates `mapa-infra:inventario` in memory when it is missing (never writes it)
  and stores each change with one `setItem`. RED observed before GREEN for every rule (new topology module missing,
  adapter 7/7, domain 36, pages 47, guides 4). Checks: app vitest 167/167, app build OK, guides vitest 352/352, guides
  tsc OK, biome 0 errors (6 old warnings). Differential against the base rebuilt from the original sources (no git):
  CSV export, deployment plan, map layout and dangling findings are identical for the same v1 inventory, except that
  repeated uplinks inside one device collapse to one (S5 asks for that). Changes in behaviour: a CSV import is now one
  write (all or nothing), so the message «Se han guardado X de Y equipos antes del fallo» is gone; removing a line
  removes only that link (before, both directions of the pair). The map connect gesture is covered by domain tests
  only (React Flow drag is not simulated in jsdom).
- **L6** (2026-11-10, T1 correction after T2 blocker on 5d1cc88, S8) A CSV re-import that only reordered a device's
  uplinks lost the row's order (export `core1,core2` instead of `core2,core1`). Fix in `importInventoryV1`: when the
  kept links are not already in the row's order, the device's hierarchical links are stored again in the row's order,
  each kept link with its type, ports, speed, VLANs and notes; ids stay unique. Regression tests assert the base output
  literally: export row `ACC1;switch;;;;;;Media;core2,core1;;;;No;`, `cuelgaDe` `["CORE2","CORE1"]`, list «conectado a
  CORE2, CORE1», domain `[a,b]` + row `c,b,a` → `[c,b,a]`, kept links keep type and ports. RED 4 failing, then GREEN.
  Checks: app vitest 171/171, app build OK, guides vitest 352/352, guides tsc OK. Advisories left as they are: v1
  entries with no id are dropped; onConnect does not re-check that both devices still exist; the same id in
  `removeDevices` and `saveDevices` moves the device to the end.
