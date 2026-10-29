# Estructura para despliegue en tres dominios

Objetivo: preparar el repositorio para desplegarse según la metodología de `docs/metodologia/` (landing estática, SPA estática, API futura).
Rama: `feat/estructura-despliegue` · Entrega: `ask-on-risk` · Tests: Vitest (app).

## Specs

- S1. "prepares el proyecto para en un futuro poder desplegarlo de esa manera" (metodología de las imágenes 1-6: `example.com` landing estática, `app.example.com` SPA estática, `api.example.com` backend).
- S2. SPA con "React + Vite + TS".
- S3. Sin API por ahora: solo documentación y un puerto de almacenamiento que hoy implementa `localStorage` y mañana un adaptador HTTP.
- S4. Contenido compartido (`content/`) del que beben la guía (`site/`) y la app (`app/`).
- S5. El toolkit actual (scripts y plantillas 00-06) se conserva en `toolkit/`; el prototipo HTML se conserva como referencia.
- S6. Textos del proyecto en español de España.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S5 | inline | hecho | commit 1 (refactor) |
| T2 | S4 | inline | hecho | commit 2 (feat app) |
| T3 | S2, S3, S4 | inline | hecho: RED (módulos ausentes) → GREEN 8/8, build OK | commit 2 (feat app) |
| T4 | S1, S4 | inline | hecho: build Hugo 0.169 sin avisos, tabla desde `content/` | commit 3 (feat site) |
| T5 | S1, S3, S6 | inline | hecho | commit 3 (feat site) |

T1 reubicar toolkit y prototipo · T2 extraer contenido a JSON · T3 app React+Vite+TS con puerto de almacenamiento · T4 esqueleto Hugo · T5 docs de arquitectura, ADRs y `api/`.

## Log

- L1 (2026-10-29): "Mi objetivo futuro (Todavía no) es basarme en la metodologia que esta explicada en imagenes en la propia carpeta del proyecto. Son imagenes del 1 al 6 revisalas y quiero que prepares el proyecto para en un futuro poder desplegarlo de esa manera. Claramente si tiene sentido, en caso contrario me lo comentas."
- L2 (2026-10-29): stack elegido "React + Vite + TS".
- L3: Hugo no está instalado en el equipo; se verificó el build de `site/` con `hugo-extended` instalado temporalmente fuera del repositorio.
- L4: pendiente para la siguiente fase: reescribir el contenido de `content/kb/` en tono de guía (quitar referencias a una empresa concreta, como "Pedir a la consultoría…"), glosario, escenarios y modo "Mi infraestructura" en la app.
