# switching-manual

Objective: offline interactive switching runbooks, selected by platform and task.
Branch: `feat/switching-manual` · Delivery strategy: `ask-on-risk` · Test runner: `npm test` (Vitest).
Test-first policy: RED before implementation for domain and UI behavior; content is checked by the integrity test.

## Specs

- **S1** Static web app built to a single `index.html` that opens from disk with no server and no internet ("En mi portátil, sin depender de internet").
- **S2** The user selects a platform, then a task, and gets a step-by-step runbook: "seleccionar la marca seleccionar creacion y gestion de VPN y que paso a paso me ponga los comandos, cuales usar que hacen en terminos generales y especificamente los parametros".
- **S3** Commands are generated from the user's own values (VLAN ID, name, port, IP) and can be copied per step and as a whole block.
- **S4** Every runbook explains risk and recovery: "que me explique los riesgos de lo que estoy haciendo, si algo falla como poder volver atrás". Fixed sections: before you start, step by step, verification, rollback.
- **S5** Each runbook shows its risk level and its verification status (`unverified` | `docs-checked` | `lab-tested`), with the official source and firmware version it was written against.
- **S6** Content lives in YAML, separate from code. An automated test fails when a runbook lacks rollback, sources or risk, or uses an undeclared `{{param}}`.
- **S7** Platforms: "Mikrotik Route OS, CRS317-1G-17S+RM, Cisco C1300-48, 6100 48G 4SFP+ Swch,Aruba AOS-CX".
- **S8** Task groups: "Puesta en marcha y acceso,VLANs y puertos,Monitorización,Seguridad y resiliencia".
- **S9** Fundamentals section: "que son para que sirven que potencial tienen y las diferentes marcas que hay".
- **S10** Content and UI in Spanish (neutral); code, file names and identifiers in English. Assumption stated in the approved plan.
- **S11** Global search across runbooks.

## Tasks

- [x] T1 · S1 · inline · Project scaffold: Vite + React + TS, Vitest, single-file build · commit: c4468a1
- [x] T2 · S3 S6 · inline · Domain: content schema, command rendering, param validation · commit: e2be784
- [x] T3 · S4 S5 S6 S7 · inline · Content loader, integrity test, first runbook (VLANs on Aruba 6100) · commit: b6f8009
- [x] T4 · S2 S3 S4 S5 · inline · UI: catalog, runbook view, param form, copy, step progress · commit: 95db245
- [x] T5 · S4 S7 · inline · Platform sheets and config backup/restore on the 3 platforms · commit: 10b37b1
- [ ] T6 · S8 · inline · VLANs and ports on the 3 platforms · partial: `vlan-create` done on the 3 platforms; pending access port, trunk port, LAG/LACP, PoE · commit:
- [ ] T7 · S8 · inline · Initial setup and access · commit:
- [ ] T8 · S8 · inline · Monitoring · commit:
- [ ] T9 · S8 · inline · Security and resilience · commit:
- [ ] T10 · S9 S11 · inline · Fundamentals and search · commit:

## Log

- **L1** (2026-10-13) Original request, verbatim: "El proyecto trata de unos manuales interactivos de Switching. Estoy aprendiendo en gestionar switches de forma profesional, que son para que sirven que potencial tienen y las diferentes marcas que hay, etc. Pero sobre todo quiero guías practicas. Ejemplo: Hay que crear VLANs en switch aruba 6100, pues seleccionar la marca seleccionar creacion y gestion de VPN y que paso a paso me ponga los comandos, cuales usar que hacen en terminos generales y especificamente los parametros, etc Comoactivar SNMP? pues lo mismos seleccionar SNMP y que muestre los comandos de creacion, si hay que habilitar, crear ACL, etc. Quiero que la guia sea interactiva para cuando haya que hacer algo en la empresa pueda acudir a un manual de forma agil y ponerme a trabajar de una forma segura con confianza. Tambien quiero que me explique los riesgos de lo que estoy haciendo, si algo falla como poder volver atrás etc."
- **L2** (2026-10-13) Plan approved. Stack: Vite, React, TypeScript, Zod, Vitest, vite-plugin-singlefile, hash routing, MiniSearch.
- **L3** (2026-10-13) Route: all tasks inline; no Writer trigger reason (units are sequential and share the schema).
- **L4** (2026-10-13) Git had no identity configured; set repo-local `user.name`/`user.email`. Baseline commit `60ac252`.
- **L5** (2026-10-13) Assumption: "VPN" in the VLAN example of L1 is read as "VLAN".
- **L6** (2026-10-13) T1-T4 done. Evidence: `npm test` 50 passed (7 files); `tsc --noEmit` clean; `npm run build` emits a single `dist/index.html` with no external script or stylesheet references; runbook exercised in the browser through `vite preview` (invalid value flagged, commands filled, copy disabled while values are missing, no console errors). Opening from disk was only checked as a static snapshot in the preview pane; a double-click test on `file://` by the user is pending.
- **L7** (2026-10-13) AOS-CX content checked against the 10.15 Layer-2 Bridging and Fundamentals guides. There is no `checkpoint create` command; checkpoints are created with `copy running-config checkpoint <name>`. `end` and the default VLAN name were not confirmed in the docs and are flagged in the runbook notes.
- **L8** (2026-10-13) Native assess over 60ac252..95db245: risk medium (`.claude/launch.json` configuration change), `review_due` false, reason `under_budget`. `npm audit`: 3 high in `braces` (dev-only build tooling, not shipped).
- **L9** (2026-10-13) Next: T5. Paused for the user to review the first runbook format before it is replicated across platforms.
- **L10** (2026-10-13) User, verbatim: "sí, seguí con MikroTik y Cisco". Format accepted as is.
- **L11** (2026-10-13) T5 done. Steps may now have no commands (manual actions such as pressing Ctrl+X or downloading a file); the UI renders them without a command block. Restore runbooks are rated high risk on every platform and a test pins that.
- **L12** (2026-10-13) Vitest 5 `fsModuleCache` served a stale content glob after new YAML files were added, so the integrity test ran against the old catalog. Disabled it in `vite.config.ts`.
- **L13** (2026-10-13) Sources: Cisco Catalyst 1300 CLI Guide (edition 2026-04-28, firmware version not stated); MikroTik help.mikrotik.com (frozen by the vendor in favor of a new manual; the CRS3xx page returned 404). On C1300, `copy <url> running-config` merges instead of replacing, so restore uses `boot config <url>` plus `reload`. MikroTik `vlan-create` is marked `unverified` because its rollback command (`remove [find ...]`) could not be confirmed in the docs.
- **L14** (2026-10-13) Evidence: `npm test` 59 passed (7 files); `tsc --noEmit` clean; build emits a single `dist/index.html`; home lists 3 platforms and the Cisco restore runbook renders in the browser with no console errors.
- **L15** (2026-10-13) Next: rest of T6 (access port, trunk port, LAG/LACP, PoE), then T7-T10.
