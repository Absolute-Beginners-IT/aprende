Explanatory figures for the FortiGate, Proxmox VE and Synology DSM guides, like the Veeam ones.
Branch: feat/guias-figuras-plataformas · Delivery: one PR per platform slice (ask-on-risk) · Tests: vitest (guias), biome, tsc.

## Specs

- **S1** Every guide of FortiGate (3), Proxmox VE (11) and Synology DSM (8) has at least one explanatory figure, as the
  Veeam guides do.
- **S2** Steps done in a web interface or console get a redrawn, simplified screen with numbered orange marks for what
  the step names, no logos, theme colours, and a caption that starts with «Pantalla redibujada y simplificada a partir
  de la guía de <producto> (no es una captura).» followed by what each number means.
- **S3** (assumption, decided by the agent) Guides whose steps are commands get a schema that explains what happens
  and why (what travels where, what is stored where, in which order), with a caption that starts with «Esquema.».
- **S4** Each figure's field names and values match the step text and the guide's sources; nothing the guide does not
  state is drawn as fact.
- **S5** The content integrity test checks that every guide of these three platforms has at least one figure.
- **S6** The figure generators live in the repository (`guias/scripts/figures/`), sharing one drawing kit, so a figure
  can be redrawn later.

## Tasks

| ID | Specs | Route | Status | Commit |
| --- | --- | --- | --- | --- |
| T1 | S6 | inline | in progress | |
| T2 | S1–S4 (FortiGate) | delegated (parallel unit) | pending | |
| T3 | S1–S4 (Proxmox VE) | delegated (parallel unit) | pending | |
| T4 | S1–S4 (Synology DSM) | delegated (parallel unit) | pending | |
| T5 | S5, integration, browser check, PR | inline | pending | |

Route evidence: T2–T4 are independent units with disjoint edit surfaces (their own figures folder, procedures folder
and generator), each several files of work, launched together. The parent owns git, the shared test and the changelog.

## Log

- **L1** (2026-11-10, user, verbatim): «pero en las guías de Forti, Proxmox y Synology no hay imagenes explicativas.»
- **L2** Earlier related requests, verbatim: «Para las explicaciones me gustaría que se incluyeran imagenes explicativas
  que ayuden a contar el porque de las cosas, porque primero se hace una cosa y luego otra a modo de evolucion.» and
  «las imagenes son demasiado grandes» (fixed in PR #44: figures capped at 80 % of their natural width).
- **L3** Decision: screens for web/console steps, schemas for command guides (S3), because a command step has no screen
  to redraw and the user asked for images that explain why.
