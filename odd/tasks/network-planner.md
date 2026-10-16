# network-planner

Objective: a network planner where an IT administrator describes switches, links, VLANs (with their purpose) and access ports, sees the topology, and gets a step-by-step guide for that exact case and switch model, built from the existing runbooks.
Branch: `feat/network-planner` · Delivery strategy: ask-on-risk (forecast above 400 lines; one PR per phase if the user prefers) · Test runner: `npm test` (Vitest).

## Specs

- **S1** User request: "aparte de lo que ya esta hecho haya una opcion estilo Mapa Que te permita Dibujar la topología de la red de la empresa, especificar que Vlanes quieres definir, para que será cada Vlan y en base a eso te de la guía específica a ese caso en concreto con el modelo de switch que hayas elegido en el mapa."
- **S2** Approved approach: structured editor (VLAN · Switches · Enlaces · Puertos) plus an automatically generated diagram, not free drawing. Each VLAN has a purpose (users, voice, servers, guests, cameras, management, iot, other).
- **S3** Coherence checks before the guide: duplicated IDs or IPs, exactly one management VLAN, ports and links pointing at existing switches and VLANs, interface names in the format of each brand's runbook, every switch reachable from the first one (otherwise the management VLAN does not reach it). The native VLAN is a single value per link, so both ends always match.
- **S4** Guide generator: per switch, from the core outwards, in a safe order (VLANs, trunks, management IP, access ports), composing the existing runbooks with their params prefilled; params that depend on the current state of the switch (previous values) stay for the user to fill in.
- **S5** Persistence in the browser plus JSON export/import of the plan; starting templates by purpose; route `#/plan`.
- **S6** Project texts in Spanish from Spain (global user rule); code, identifiers and commits in English.

## Tasks

- [ ] T1 · S2 S3 S4 S6 · inline · Plan domain, validatePlan, buildPlanGuide with tests
- [ ] T2 · S1 S4 S5 S6 · inline · PlannerPage forms, generated guide, route and navigation
- [ ] T3 · S1 S5 S6 · inline · Topology diagram, starting templates, JSON export/import, fundamentals article

## Log

- **L1** (2026-10-15) User request, verbatim: "Me gustaria que este manual sirviera para todo Administrador IT que tenga que encargarse de la infraestructura de su empresa. Mi idea es que aparte de lo que ya esta hecho haya una opcion estilo Mapa Que te permita Dibujar la topología de la red de la empresa, especificar que Vlanes quieres definir, para que será cada Vlan y en base a eso te de la guía específica a ese caso en concreto con el modelo de switch que hayas elegido en el mapa. Quiero que analices bien la propuesta, e investigues lo que hay en el mercado. Si ves que no tiene ningun sentido tambien quiero que seas honesto y decirme si es inviable". Market check: no SMB tool goes from topology to a per-vendor step-by-step guide (NetBox + Ansible is heavy, SCGen is Cisco only, Docusnap documents existing config, diagram tools generate no config). Plan approved: structured editor + generated diagram, 3 phases.
- **L2** (2026-10-16) User: "continua". Route: all inline (sequential phases sharing files, no parallel writer reason). Findings that shape the generator: param ids differ per brand (interface `interfaceId` / `interfaceName` / `port`; IP `ipAddress` + `mask` vs `ipCidr`), so values are resolved per param id from a semantic context; MikroTik `vlan-create` already tags the VLAN on `trunkPorts`, so when a brand's `vlan-create` declares `trunkPorts` the trunks are configured there and no `port-trunk` step is generated; safety names (`checkpointName`, `backupName`) are generated, `minutes` takes the runbook example, and `previous*`, `dnsServer` and the MikroTik management interface stay pending for the user.
