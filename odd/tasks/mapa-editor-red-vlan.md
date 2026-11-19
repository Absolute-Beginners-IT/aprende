# Map editor with integrated «Red y VLAN»

Objective: turn the «Mi infraestructura» map into a diagrams.net-like infrastructure editor that keeps the current style, with the «Red y VLAN» planner integrated as its contextual configuration panel (proposal A) and VLAN layers (proposal B).
Branch: `feat/mapa-editor-red-vlan` (from main 2459431) · Delivery: stacked-to-main, one PR per slice (same as `mapa-topologia-fisica`) · Tests: Vitest in `app/` and `guias/`, site assembled as in `pages.yml`.

## Specs

- **S1** (L2, user, verbatim) «Lo primero cuando voy a la parte de Red y VLAN todo el contenido se deplaza a la izquierda.» Inside the website the planner window is centred like the app's windows (1240px), so switching tabs of «Mi infraestructura» does not move the page.
- **S2** (L2, user, verbatim) «El mapa debería de ser parecido a app.diagrams.net especializado en infraestructura manteniendo el estilo actual.» Editor shell as in mockups A1/A2: toolbar above the canvas (undo/redo when available, zoom, select/connect, «Colocar por capas», Red/Energía views, «Comprobar red» with the count of findings, export, «Obtener comandos»), a searchable shape library on the left grouped by family, the canvas with grid and minimap, and one right-hand panel whose content follows the selection. The findings and the help move into that panel (nothing is dropped).
- **S3** (L2, user, verbatim) «Red y VLAN debería ser parte del mapa como un panel de configuración integrado.» With nothing selected the panel shows the whole network: tabs «VLAN» (catalogue: add, edit, remove, templates, import plan), «Direccionamiento» and «Avisos». With a switch selected: tabs «Ficha», «Puertos y VLAN», «Guías», «Comandos». With a link selected: its ends, ports, type and, for trunks/LAGs, native VLAN and allowed VLANs.
- **S4** (L3 «A + B», L4) No data moves and nothing replaces anything: the map reads and writes the same planner document (`switching-manual:plan`, schema `NetworkPlan`) and the guides' planner keeps working on it. Both write through one shared module (combine with the inventory, store back) so hidden switches, switch order (the first is the core), plan link interfaces and ports are kept exactly as the planner keeps them today.
- **S5** (L4, user, verbatim) «Si la solución propuesta no sustituye una cosa por otra habrá que hacerlo con cuidado de no perder nada». Writes re-read what is stored and apply only the change; fields and switches the map does not show are kept; a stored plan that is unreadable or of a newer version is never written over (the map says so); a round-trip test proves a real plan comes back identical except for the requested change.
- **S6** (L5, user, verbatim: «Sí, adelante con eso») The «VLAN» field of a trunk or LAG link on the map decides the allowed VLANs in the generated commands. A trunk with VLANs written allows only those (plus its native VLAN); a trunk with none written allows every plan VLAN, exactly as today. The field is validated as a VLAN list (ids 1–4094, ranges like `10-12`), with an error message the learner can act on.
- **S7** (proposal B, mockup b) Left column tabs «Formas» / «Capas». «Capas» lists the physical cabling, every plan VLAN (colour, eye to hide, summary «N switches · N troncales», gap count) and overlays (power badges, IP and ports labels). Picking a VLAN lights the links that carry it and the devices that use it, dims the rest, and tags devices (gateway, access ports count).
- **S8** (proposal B) Gap warning: a switch with access ports in a VLAN whose path to the core goes through a trunk that does not carry it (per S6) is flagged on the map and in «Avisos», with a one-click fix «Añadir N a la troncal» that writes the link's VLAN field.
- **S9** The website tab «Red y VLAN» of «Mi infraestructura» is retired once its editing lives in the map; «Obtener comandos» opens the planner's «Guía» through a new deep link (`#/plan/guia`, optionally `?equipo=<deviceId>`). The guides opened on their own (no inventory, file) keep the planner as today.
- **S10** Texts shipped in es-ES (tú/vosotros); help «Cómo se usa el mapa», guides docs and CHANGELOG updated; route lessons that mention «Red y VLAN» point to the new place.

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1 | inline | done (verified at 1440px: window x=100 w=1240) | f588c7b |
| T2 | S4–S6 (slice 1: shared plan module, plan repository in the app, link VLAN list in the guide) | delegated (context backstop: long parent session) | done: app 309/309, guias 384/384, typecheck and builds OK | 992e529 |
| T3 | verification of T2 (high-risk items 1 and 3: stored plan with two writers, shared contract) | independent verifier | running | |
| T4 | S2–S3 (slice 2: editor shell, network panel with VLAN catalogue) | delegated (context backstop) | pending | |
| T5 | S3, S6 (slice 3: switch «Puertos y VLAN», link panel) | delegated (context backstop) | pending | |
| T6 | S7–S8 (slice 4: VLAN layers and gap warnings) | delegated (context backstop) | pending | |
| T7 | S9–S10 (slice 5: retire the tab, deep link, docs) | delegated (context backstop) | pending | |

Forecast: about 2000 authored changed lines over five slices (over the 400 heuristic), so stacked-to-main slices, the strategy the previous map feature used.

## Log

- **L1** (2026-11-19, user, verbatim): «Ya está borrada, sigue con la vista lógica»
- **L2** (2026-11-19, user, verbatim, answering where the logical view takes the VLAN list from): «Lo primero cuando voy a la parte de Red y VLAN todo el contenido se deplaza a la izquierda. Segundo. El mapa debería de ser parecido a app.diagrams.net especializado en infraestructura manteniendo el estilo actual. Dicho esto Red y VLAN debería ser parte del mapa como un panel de configuración integrado. Busca y planifica varias formas de integrarlo de forma oragnia y pasame pantallazos de como quedaria la interfaz en las varias propuestas para decidir si seguir trabajando en alguna de ellas o buscar otras alternativas»
- Mockups (scratchpad, not committed): A contextual panel, B VLAN layers, C pages Física/Lógica/Energía.
- **L3** (2026-11-19, user, verbatim): «A + B»
- **L4** (2026-11-19, user, verbatim): «Si la solución actual evita que haya que "mover las VLAN del planificador al mapa" como indicas, descártalo. Si la solución propuesta no sustituye una cosa por otra habrá que hacerlo con cuidado de no perder nada»
- Mapping (explorer): `app/` and `guias/` share no code (only URLs, storage keys and `content/guias-indice.json`); app has no zod; the plan link stores only ends and `nativeVlan`; `buildPlanGuide.ts:136` allows every VLAN on every trunk, so a gap cannot exist without a per-link list; the map's `Link.vlans` is free text nobody reads; the planner's «Guía» tab is local state with no deep link; no per-model port counts exist.
- **L5** (2026-11-19, user, verbatim, to «¿el campo VLAN de cada troncal del mapa pasa a decidir qué VLAN se permiten en los comandos?»): «Sí, adelante con eso»
- **L6** (2026-11-19, T2 writer, S4–S6) `shared/plan/` (schema with `z.looseObject` at every level so unknown keys survive both writers, inventory reading, combine/store-back, `parseVlanList`/`trunkVlans`, single `HIERARCHICAL_LINK_TYPES`), `@shared` alias in both Vite/tsconfig with `resolve.dedupe: ['zod']`; app gets zod 4.6.7 and `localStoragePlanRepository` (re-read before write, refuses unreadable or `version > 1` with es-ES message, `PlanChange` is an updater). `buildPlanGuide`/`validatePlan` take the map's link VLAN lists: valid non-empty list → list + native (MikroTik `trunkPorts` follow it too); none/empty/invalid → all VLANs as before; an invalid list is a «Enlaces» issue (blocks «Guía» like every issue). RED: guias 6 tests + 1 suite, app 1 suite; GREEN app 309/309, guias 384/384, typecheck, builds. Not changed (out of scope): the guides' planner still falls back to `EMPTY_PLAN` on an unreadable plan and may write over it; Biome does not lint `shared/` in CI.
