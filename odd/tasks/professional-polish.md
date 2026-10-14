# professional-polish

Objective: give the switching manual a professional footing: repository base, UI polish, change record (MOP) and content status panel.
Branch: one per delivery (`chore/repo-foundation`, `feat/ui-polish`, `feat/change-record`, `feat/status-panel`) · Delivery strategy: one PR per delivery · Test runner: `npm test` (Vitest).

## Specs

- **S1** Base del repositorio: "README (uso, cómo añadir guías, niveles de verificación), versión y CHANGELOG, ESLint + Prettier, y CI en GitHub Actions que pase tests y build en cada pull request y publique el index.html en cada versión."
- **S2** Registro de cambio (MOP): "Desde una guía rellenada, generar el procedimiento del cambio para el ticket o la ventana de mantenimiento: equipo, valores, pasos marcados, hora y resultado de la verificación; más estilos de impresión y PDF."
- **S3** Panel de estado: "Página con la matriz marca × tarea: estado (sin verificar, contrastada, laboratorio), riesgo y fecha de revisión, para ver qué falta probar y qué guías llevan tiempo sin revisarse."
- **S4** Pulido de interfaz: "Pie con versión y fecha del contenido, selector de tema claro/oscuro, repaso de accesibilidad y teclado, y aviso visible en las guías sin verificar."
- **S5** Project texts in Spanish from Spain (global user rule); code, identifiers and commits in English.

## Tasks

- [ ] T1 · S1 S5 · inline · Repository base: README, CHANGELOG, ESLint + Prettier, .nvmrc, CI and release workflows · commit:
- [ ] T2 · S4 S5 · inline · UI polish: footer with version, theme selector, unverified notice, skip link, aria-live · commit:
- [ ] T3 · S2 S5 · inline · Change record: record fields, buildChangeRecord, copy/download/print, print styles · commit:
- [ ] T4 · S3 S5 · inline · Status panel at #/status, summarizeCatalog, links; release v1.0.0 · commit:

## Log

- **L1** (2026-10-15) User request, verbatim: "Analiza el proyecto y trata de mejorarlo o darle un enfoque mas profesional". Asked which lines to plan; user chose all four: "Base del repositorio,Registro de cambio (MOP),Panel de estado,Pulido de interfaz". Plan approved (one branch and PR per delivery, in order 1-4, v1.0.0 at the end).
- **L2** (2026-10-15) Route: all inline; deliveries are sequential and share files (styles, RunbookPage), so there is no parallel writer reason.
- **L3** (2026-10-15) T1 in progress on `chore/repo-foundation`. `typescript-eslint` refuses TypeScript 7 (peer `<6.1.0`), so per the plan Biome 2.5.15 replaces ESLint + Prettier: `biome.json` (2 spaces, width 120, single quotes, no semicolons, content YAML and `odd/` excluded, `noArrayIndexKey` off because content lists are static), scripts `lint`, `check`, `format`, `.nvmrc` 24. Lint findings fixed (non-null assertion in main.tsx, base element styles moved before components) or justified inline (redundant list roles for Safari, palette backdrop click, search autofocus, effect triggers). Commits 1d981d0 (tooling) and 82798d8 (formatting pass). Evidence: `npm test` 155 passed; `tsc` clean; `npm run check` clean.
- **L4** (2026-10-15) User, verbatim: "Lo dejamos por hoy". Next: README.md and CHANGELOG.md in es-ES, `.github/workflows/ci.yml` (npm ci, check, typecheck, test, build, artifact) and `release.yml` (tag v*), then push and PR for T1; deliveries 2-4 afterwards.
