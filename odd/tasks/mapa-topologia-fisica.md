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
- **S21** (slice 4) The guides' planner («Red y VLAN») takes the ports of switch-to-switch links from the map: when
  the inventory link has a port on a side, that port fills the planner's interface for that side and is shown
  read-only with the hint «Se cambia en el mapa de Mi infraestructura»; when it has none, the planner keeps its own
  editable value as today. The guides never write to `mapa-infra:topologia`.
- **S22** (slice 4) The deployment plan lists the members of a group one after another, in the position of the first
  member, and each member's step names its group («Par FortiGate (HA)»).
- **S23** (slice 4) «Qué te falta» reports, with the device or group named:
  an HA group with no `ha` link between its members (aviso); an HA group with exactly one `ha` link («si ese cable
  falla, cada equipo cree que el otro ha caído»; info); a stack group with no `stack` link (aviso); a group with a
  single member (info); a switch that has devices hanging from it and a single hierarchical link upwards (info); the
  same port of a device used by two links (aviso).
- **S24** (slice 5) The «Lista» page, next to the CSV export, offers «Exportar el esquema (JSON)»: it downloads
  `mi-infraestructura.json` with `{ version: 2, equipos, enlaces, grupos }`. The CSV export stays as it is.
- **S25** (slice 5) «Importar el esquema (JSON)» reads a file. Unreadable, foreign or empty content shows an error and
  saves nothing. Valid content asks for confirmation naming what will be replaced and what comes in («Sustituye tus N
  equipos por M equipos, X enlaces y Y grupos»); confirming replaces the whole topology in one write, cancelling saves
  nothing. The old key `mapa-infra:inventario` is never touched.
- **S26** (slice 5) The app's help texts («Cómo se usa el mapa» and the list page hints) explain link types and ports
  when joining, the line ficha, Ctrl + clic / Mayúsculas + arrastrar to group, «Colocar por capas», the legend toggles
  and the JSON export/import.
- **S27** (slice 5) The route lessons that describe the map say what it can do now: final project room 5 (importing the
  inventory, then setting link types, ports and groups on the map and exporting the whole schema as JSON), final project
  room 1 (the drawn map shows each device's links, HA pairs and stacks), the switches lesson (the map can draw trunks
  and LAGs), and «Qué es esto». CSV wording that is still true stays.
- **S28** (slice 6, power) A new device type «Regleta (PDU)» (`regleta`, family power), in the Energía tier next to the
  SAI, with its own content entry (what it is, what to watch, typical mistakes) like every other type. The CSV import
  recognises «regleta», «PDU» and «power strip» as this type.
- **S29** (slice 6) An `energia` link carries no network data: the link form and the line ficha show no network ports,
  speed or VLANs for it. Instead they offer, both optional, «Toma» on the SAI or regleta side (the outlet) and «Fuente
  de alimentación» on the other side (for example «Fuente 1», «Fuente 2»). They are stored in the existing `puerto`
  fields, so no format change is needed. The drawing labels the line with them when set.
- **S30** (slice 6) Who feeds whom comes from the device types, not from `a`/`b`: the power source of an `energia` link
  is the end that is a SAI or a regleta (the SAI when both are). The forms show «X se alimenta de Y». A link between two
  devices that are neither is allowed but has no source.
- **S31** (slice 6) «Qué te falta» follows the power path (device → regleta(s) → SAI) and reports, naming devices and
  SAIs: a device with criticidad Alta whose every power path ends in the same single SAI (info: «si ese SAI cae, X se
  apaga; si tiene dos fuentes, conéctalas a SAIs distintos»); a device with two or more power links whose paths all end
  in the same SAI (aviso: the second power supply gives no protection if that SAI fails); a regleta with no SAI behind it
  (aviso). The port-reuse finding words a repeated outlet as «toma».
- **S9** Later slices (not in slice 1): drawing by tiers with groups and typed orthogonal lines (slice 2), editing link
  type, ports and groups (slice 3), planner/deployment/analysis using ports and groups (slice 4), link export and route
  content (slice 5).

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2–S8 | delegated (context backstop: long parent session) | done | 5d1cc88, f5a4caf |
| T2 | verification of T1 (high-risk items 1 and 3) | independent verifier | done (1 blocker fixed) | f5a4caf |
| T3 | S10–S16 (slice 2) | delegated (context backstop) | done (PR #47) | e790798 |
| T4 | S17–S20 (slice 3) | delegated (context backstop) | done (PR #48, b22c464) | |
| T5 | S21–S23 (slice 4) | delegated (context backstop) | done (PR #49) | dcf57b6 |
| T6 | S24–S27 (slice 5) | delegated, two parallel units (app S24–S26, site S27) | done (PR #50) | a9b1489 |
| T7 | S28–S31 (slice 6, power) | delegated (context backstop) | in progress | |

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
- **L13** (2026-11-11, user, verbatim): «Sí, mergea» (PR #48, merged as b22c464) and «Sí, arranca» — start slice 4. Decision: the guides read the map's ports and never write the app's storage (single source for inventory links).
- **L14** (2026-11-11, T5 writer, S22–S23) Deployment plan: after the usual sort, `groupedTogether` moves the members of a
  group (`groupOf`) to the place of the first one, keeping their sorted order; `PlanDevice.grupo` is «name (type)» with
  `GROUP_TYPE_NAMES` («Par FortiGate (HA)») and the card adds it to its description. «Qué te falta» adds: an HA or stack
  group of two or more members with no link of its type between members (warn), an HA group with exactly one (info, «si
  ese cable falla, cada equipo cree que el otro ha caído»), a group with one member (info; link checks skipped, clusters
  have none), a switch with dependants (`downstreamOf`) and exactly one hierarchical link up (info; links counted, so two
  cables to one core are enough), the same trimmed port of a device in two or more links (warn, «usa el puerto «p» en N
  enlaces»). Group findings carry no `deviceId`, so they show in the overview only. RED 9 failing (plan 2, page 1,
  analysis 6), then GREEN; negative cases and existing tests already green. Checks: app vitest 233/233, app build OK.
- **L15** (2026-11-11, user, verbatim): «Sí, mergea» (PR #49, merged as dcf57b6) and «Sí, arranca» — start slice 5.
- **L16** (2026-11-11, T6 app writer, S24–S26) Domain: `topologyDocument` (`{ version: 2, equipos, enlaces, grupos }`, also
  used by the localStorage adapter), `readTopologyDocument(text)` (`ilegible` / `ajeno` / `vacio`, else the topology read
  by `fromStoredTopology`) and `TopologyChange.replace` (the whole topology, applied first): no port change, still one
  `setItem` of `mapa-infra:topologia`, old key untouched. «Lista»: «Exportar el esquema (JSON)» downloads
  `mi-infraestructura.json`; «Importar el esquema (JSON)» (file input) shows «No se ha podido importar: …» or an inline
  confirmation «Sustituye tus N equipos por M equipos, X enlaces y Y grupos.» (singular for 1) with «Sí, sustituir» /
  «Cancelar»; CSV export unchanged (shared `download` helper). Help: «Cómo se usa el mapa» (link types, ports, speed,
  VLAN, line ficha, Ctrl + clic / Mayúsculas + arrastrar and «Agrupar», «Colocar por capas», legend toggles, JSON) and two
  list hints. RED 14 failing (domain 4, adapter 1, page 8, help 1), CSV pin green, then GREEN. Checks: app vitest
  248/248, app build OK.
- **L17** (2026-11-11, user, verbatim): «Los enlaces del SAI no son de datos con lo cual no hay que conectar el cable a un puerto
  como tal, son cables de energía. Normalmente se conecta una regleta al SAI y de esa regleta salen cables de corrientes que
  van a los diferentes aparatos (Router, Firewall, switches, etc) Es asi como se suelen formar los racks. Es mas algunos
  aparatos permiten más de una toma de corriente por si un sai cae el otro cable del otro sai lo alimenta y lo mantiene
  encendido en caso de emergencia» — after PR #50 (a9b1489) was merged. Slice 6 (S28–S31) models power properly.
