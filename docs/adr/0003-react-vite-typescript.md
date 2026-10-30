# 0003 · React + Vite + TypeScript para la app

- Estado: aceptada (2026-10-29)

## Decisión

La SPA de `app.example.com` se construye con React, Vite y TypeScript en modo estricto, con Vitest para los tests.

## Motivo

- Elección del proyecto (registro de la tarea, L2).
- El build es estático (`dist/`), así que encaja en Cloudflare Pages sin servidor Node.
- TypeScript tipa el contenido compartido: si `content/` cambia de forma, la compilación o los tests de integridad fallan.
