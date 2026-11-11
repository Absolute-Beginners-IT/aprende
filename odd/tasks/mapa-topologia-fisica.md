Redesign «Mi infraestructura» so its map can show a real physical infrastructure diagram (HA pairs, stacks, LAGs, ports).
Branch: feat/mapa-topologia-modelo (slice 1), feat/mapa-topologia-dibujo (slice 2) · Delivery: ask-on-risk, one PR per slice · Tests: vitest (app, guias), tsc, biome (guias).

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
- **S10** (slice 2) Tiers, top to bottom, from the device type: Operadora (internet), Perímetro (firewall, router),
  Red (switch, wifi), Servidores (hipervisor, servidor, vm, impresora, otro), Almacenamiento y copias (almacenamiento,
  backup), Energía (sai). Inside a tier, a device that hangs from another device of the same tier (hierarchical link)
  goes on a lower sub-row, so a core switch sits above its access switches. Each tier shows its name at the left edge.
- **S11** (slice 2) Devices placed by the user (`posicion`) stay where they are; the tier layout places only unplaced
  devices. A «Colocar por capas» action re-places every device by tiers, asks for confirmation first, and saves all the
  new positions in one write.
- **S12** (slice 2) Members of a group, and devices joined by an `ha` or `stack` link, sit side by side in their tier,
  inside a labelled box: the group name, or «HA» / «Stack» when there is no group.
- **S13** (slice 2) Lines are orthogonal. Hierarchical links leave the top of the lower device and enter the bottom of
  the upper one; `ha` and `stack` links run horizontally between the peers. Several links between the same pair are
  drawn apart so each one is visible. Style per type: datos solid; troncal thicker; lag thick with a «LAG» label; ha
  dashed; stack thick dotted; wan, almacenamiento and energia in their family colour; gestion thin dotted. The speed, if
  any, is shown as a label.
- **S14** (slice 2) A legend lists the link types present on the map. «Gestión» and «Energía» lines can be hidden with
  a toggle (remembered per browser only).
- **S15** (slice 2) Accessibility: each line has an accessible name «A – B: tipo»; each group box is labelled.
- **S16** (slice 2) Stored data changes only through «Colocar por capas» and moving devices, as today.
- **S17** (slice 3) Joining two devices on the map opens a small form before anything is saved: link type (default
  «Datos»), optional port on each side, optional speed, and VLANs when the type is troncal or lag. «Crear enlace» saves
  it in one write; «Cancelar» saves nothing. For hierarchical types the dragged device is `a` (it hangs from the
  target). A hierarchical link is refused, with a message, when the pair already has a hierarchical link in the
  opposite direction; any other extra link between the same pair is allowed.
- **S18** (slice 3) Selecting a line opens its ficha: the two ends, type, ports, speed, VLANs and notes, editable and
  saved in one write, plus «Quitar enlace».
- **S19** (slice 3) Selecting two or more devices offers «Agrupar»: type (HA, Stack, Clúster) and a name. A device
  belongs to at most one group; if a selected device is already in one, grouping is refused with a message naming it.
  A device's ficha shows its group with «Sacar del grupo» and «Deshacer el grupo». Every change is one write.
- **S20** (slice 3) The forms are keyboard-usable: focus moves into them, Escape cancels, labels are associated.
- **S9** Later slices (not in slice 1): drawing by tiers with groups and typed orthogonal lines (slice 2), editing link
  type, ports and groups (slice 3), planner/deployment/analysis using ports and groups (slice 4), link export and route
  content (slice 5).

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2–S8 | delegated (context backstop: long parent session) | done | 5d1cc88, f5a4caf |
| T2 | verification of T1 (high-risk items 1 and 3) | independent verifier | done (1 blocker fixed) | f5a4caf |
| T3 | S10–S16 (slice 2) | delegated (context backstop) | implemented, checks green; browser check pending | |
| T4 | S17–S20 (slice 3) | delegated (context backstop) | implemented, checks green; browser check pending | |

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
- **L7** Independent verifier: S2–S7 pass; one S8 blocker (CSV re-import lost the uplink order) fixed in f5a4caf
  with regression tests. Native review (risk, resilience, reliability) approved and acknowledged; advisories for later:
  R1-001 and R4-rollback-stale-v1 (old key kept stale after v2 writes), R4-unknown-version-overwrite (a future version
  would be overwritten), R3-form-readd-accumulates-links (re-adding a device from the form adds links again),
  R3-onconnect-untested.
- **L8** (2026-11-11, user, verbatim): «Sí, mergea» (PR #46, merged as 230f278) and «Sí, arranca» — start slice 2. Layout by hand by tiers, no new dependency (elkjs only if this falls short). Creating ha/stack links and groups from the screen is slice 3.
- **L9** (2026-11-11, T3 writer) Slice 2 implemented. Domain in `app/src/domain/infraMap.ts`: `TIERS`/`tierOf`, `peerSets`
  (groups by name, then HA/stack runs no group holds, «HA»/«Stack»), `layoutByTiers` (tiers top-down, sub-rows by
  `levelFinder` over the tier's devices, peers contiguous on the lowest sub-row of their members, rows centred and
  ordered under their upstream devices), `layoutDevices` (`posicion` wins; the rest by tiers below the placed ones),
  `arrangeByTiers`, `tierLabels`, `groupBoxes`, `edgeEnds`, `parallelOffsets`, `linkName`, `linkTypesIn`; `GRID` is now
  200×130. `topology.ts` gained `isPeerLink` and `LINK_TYPE_NAMES`. UI: four handles per device (top/bottom as before,
  hidden side anchors for HA/stack), custom orthogonal edge `InfraEdge` (smooth-step, parallel offset on both ends and
  the bend, «LAG · speed» label), group boxes and tier names as non-interactive background nodes, legend with
  «Mostrar las líneas de gestión/energía» toggles stored in `mapa-infra:lineas-ocultas` (try/catch), «Colocar por capas»
  with an inline confirmation and one `saveDevices` write. Line styles are classes in `styles.css`. RED observed before
  GREEN: domain 14 failing, page 7 failing. Checks: app vitest 193/193, app build OK. Browser check pending (parent).
- **L10** (2026-11-11, T3 writer, after the parent's browser check) Blocker: cross links (CORE-1→FW-2, CORE-2→FW-1,
  ACC→other core) were drawn on top of the straight ones, so four links showed as two lines; polish: the four «LAG · 10G»
  labels overlapped. Fix in `infraMap.ts`: `routeEdges` replaces `parallelOffsets` and gives every line end its own spot
  on its device side, ordered by the x (top/bottom) or y (left/right) of the device at the other end, links of the same
  pair included; vertical lines between the same two rows bend at distinct heights. `edgeGeometry` applies the route
  and puts each label above its source end, one label higher per earlier line on that side. `InfraEdge` and the page
  use them (routed by node centres). RED 4 failing (spots ordered left to right, four FW/core links as four separate
  lines, same-pair links apart, labels never in the same place and ≥16px apart on one switch), then GREEN. Checks: app
  vitest 196/196, app build OK. Browser re-check pending (parent).
- **L11** (2026-11-11, user, verbatim): «Sí, mergea» (PR #47, merged as e790798) and «Sí, arranca» — start slice 3 (editing link types, ports and groups).
- **L12** (2026-11-11, T4 writer) Slice 3 implemented. Domain: `TopologyChange` gained `updateLinks`, `addGroups` (id
  `grupo-N`, first free), `saveGroups` and `removeGroups`, all in the same single write; `topology.ts` gained `groupOf`
  and `GROUP_TYPE_NAMES`; `infraMap.ts` gained `LinkDraft`, `carriesVlans`, `linkRefusal` (`mismo-equipo`,
  `sentido-contrario`, with the edited link left out), `connectDevices(topology, from, to, draft)` (S17 rule replaces S7's:
  only an opposite hierarchical link is refused), `editLink`, `draftOf` and `groupRefusal`. UI: `LinkForms.tsx`
  (`NewLinkForm` «Nuevo enlace», `LinkInspector` «Ficha del enlace»), `GroupPanel.tsx` («Equipos seleccionados» with
  «Agrupar»), group section in the device ficha («Sacar del grupo», «Deshacer el grupo»). The page keeps a list of
  selected devices (Ctrl/Cmd + click, Shift + drag box; `selectNodesOnDrag` off so a click selects), opens the link ficha
  when exactly one line and no device is selected, and the inspector column shows, in order: new link form, link ficha,
  group panel, device ficha, overview. Forms focus their first field, Escape cancels, labels wrap their fields. RED
  observed before GREEN: domain 11 failing, page 14 failing (connect tests reach `onConnect` through React Flow's
  click-to-connect with `document.elementFromPoint` stubbed). Checks: app vitest 220/220, app build OK. Browser check
  pending (parent).
