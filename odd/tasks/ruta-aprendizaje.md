# Ruta de aprendizaje estilo TryHackMe

Objetivo: que un novato sepa por dónde empezar y avance paso a paso desde lo básico hasta montar una infraestructura.
Rama: `feat/ruta-aprendizaje` · Entrega: `ask-on-risk` · Comprobación: build de Hugo + recorrido en el navegador (Hugo no tiene runner de tests) y `npm test` en `app/`.

## Specs

- S1. "Analiza la web y comprueba que los apartados esten claros y si para una persona novata en el ambito de sistemas se perdería en la web sin saber muy bien como empezar." (análisis entregado en el plan aprobado).
- S2. "Me gustaría que la parte de aprendizaje o ruta de aprendizaje desde lo basico a tener en cuenta hasta "montar una infraestructura" tuviera un paso a paso equivalente a las rutas de aprendizaje de tryhackme."
  - Ruta → módulos → salas → tareas con preguntas comprobables, botón de completada y progreso guardado en el navegador.
  - Un único punto de entrada («Empieza la ruta») en portada y menú; el mapa pasa a secundario.
- S3. Textos del proyecto en español de España.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2, S3 | inline | pendiente | |
| T2 | S2, S3 | inline | pendiente | |
| T3 | S2, S3 | inline | pendiente | |

T1 estructura: layouts de ruta, shortcodes `tarea`/`pregunta`, `ruta.js`, portada y menú, lección 01 al módulo 3 con alias, módulo 8 desde `hoja-de-ruta.json`, módulos 4–9 como «próximamente» · T2 contenido de los módulos 0–2 · T3 (siguiente entrega) contenido de los módulos 4–7 y 9 y unificar duplicados site/app.

## Log

- L1 (2026-11-02): "Analiza la web y comprueba que los apartados esten claros y si para una persona novata en el ambito de sistemas se perdería en la web sin saber muy bien como empezar. Me gustaría que la parte de aprendizaje o ruta de aprendizaje desde lo basico a tener en cuenta hasta "montar una infraestructura" tuviera un paso a paso equivalente a las rutas de aprendizaje de tryhackme. Antes de empezar hazme un pequeño analisis de la web como te he pedido."
- L2: plan aprobado. Hallazgos: una sola lección, sin «empieza aquí», secciones duplicadas site/app, `hoja-de-ruta.json` sin mostrar, toolkit sin enlazar, sin progreso.
- L3: excepción test-first: las plantillas Hugo y el JS del navegador no tienen runner; se comprueban con `hugo --minify` y recorrido en el navegador.
