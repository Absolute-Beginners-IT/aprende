# 0001 · Separación en guía, app y API

- Estado: aceptada (2026-10-29)

## Contexto

El prototipo era un único HTML de casi 900 líneas con contenido, lógica y vista mezclados, y dependiente del almacenamiento de los artifacts de Claude. Queremos una guía para juniors que crezca en contenido y se pueda desplegar siguiendo la metodología de `docs/metodologia/`.

## Decisión

- `site/` (Hugo) para el contenido público: lecciones con la plantilla de la metodología.
- `app/` (SPA estática) para el mapa interactivo.
- `content/` como fuente única del conocimiento, leída por ambos al compilar.
- `api/` reservada para el futuro.

## Consecuencias

- Guía y app se despliegan por separado, sin servidores, en hosting estático gratuito.
- El contenido no se duplica: un cambio en `content/` llega a la guía y al mapa.
- Hay dos procesos de build (Hugo y Vite) en lugar de un HTML que se abre sin más.
