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
| T1 | S2, S3 | inline | hecho: build Hugo sin avisos (43 páginas, 42 tareas contadas); recorrido en el navegador | e8c3d9e |
| T2 | S2, S3 | inline | hecho: 7 salas nuevas (módulos 0–2) | 5d2a4e2 |
| T3 | S2, S3 | inline | pendiente | |

T1 estructura: layouts de ruta, shortcodes `tarea`/`pregunta`, `ruta.js`, portada y menú, lección 01 al módulo 3 con alias, módulo 8 desde `hoja-de-ruta.json`, módulos 4–9 como «próximamente» · T2 contenido de los módulos 0–2 · T3 (siguiente entrega) contenido de los módulos 4–7 y 9 y unificar duplicados site/app.

## Log

- L1 (2026-11-02): "Analiza la web y comprueba que los apartados esten claros y si para una persona novata en el ambito de sistemas se perdería en la web sin saber muy bien como empezar. Me gustaría que la parte de aprendizaje o ruta de aprendizaje desde lo basico a tener en cuenta hasta "montar una infraestructura" tuviera un paso a paso equivalente a las rutas de aprendizaje de tryhackme. Antes de empezar hazme un pequeño analisis de la web como te he pedido."
- L2: plan aprobado. Hallazgos: una sola lección, sin «empieza aquí», secciones duplicadas site/app, `hoja-de-ruta.json` sin mostrar, toolkit sin enlazar, sin progreso.
- L3: excepción test-first: las plantillas Hugo y el JS del navegador no tienen runner; se comprueban con `hugo --minify` y recorrido en el navegador.
- L4 (2026-11-02): verificado en `hugo server`: respuesta errónea rechazada; «Cuatro », «Lógica» y «protección» aceptadas (mayúsculas, espacios y tildes); la tarea con dos preguntas solo se completa al responder ambas; la tarea sin pregunta se marca con el botón; el progreso sobrevive a la recarga; «Continúa» apunta a la primera sala sin terminar; consola sin errores; móvil sin desbordamiento horizontal. `npm test` en `app/`: 34/34.
- L5: corregido durante la verificación: Hugo trata `weight: 0` como «sin peso» y mandaba el módulo 0 al final (pesos de módulo 1–10); el menú se salía de la pantalla en móvil.
- L6: siguiente paso: T3 (contenido de los módulos 4–7 y 9, y decidir qué se queda en el site y qué en la app de Glosario/Escenarios).
