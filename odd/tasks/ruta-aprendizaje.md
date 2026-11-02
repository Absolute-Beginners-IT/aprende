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
| T3 | S2, S3 | delegada (escritor paralelo) | hecho: 4 salas, 15 preguntas | 2489f4a |
| T4 | S2, S3 | delegada (escritor paralelo) | hecho: 5 salas, 21 preguntas | cfa10c7 |
| T5 | S2, S3 | delegada (escritor paralelo) | hecho: 4 salas, 13 preguntas | 364bb58 |
| T6 | S2, S3 | delegada (escritor paralelo) | hecho: 4 salas, 13 preguntas | 81bb0fe |
| T7 | S2, S3 | delegada (escritor paralelo) | hecho: 5 salas; VLAN de puestos unificada en la 10 | 3de5908 |
| T8 | S2 | pendiente de decisión | unificar Glosario/Escenarios entre site y app | |

T1 estructura: layouts de ruta, shortcodes `tarea`/`pregunta`, `ruta.js`, portada y menú, lección 01 al módulo 3 con alias, módulo 8 desde `hoja-de-ruta.json`, módulos 4–9 como «próximamente» · T2 contenido de los módulos 0–2 · T3–T7 contenido de los módulos 4, 5, 6, 7 y 9 · T8 unificar duplicados site/app.

## Log

- L1 (2026-11-02): "Analiza la web y comprueba que los apartados esten claros y si para una persona novata en el ambito de sistemas se perdería en la web sin saber muy bien como empezar. Me gustaría que la parte de aprendizaje o ruta de aprendizaje desde lo basico a tener en cuenta hasta "montar una infraestructura" tuviera un paso a paso equivalente a las rutas de aprendizaje de tryhackme. Antes de empezar hazme un pequeño analisis de la web como te he pedido."
- L2: plan aprobado. Hallazgos: una sola lección, sin «empieza aquí», secciones duplicadas site/app, `hoja-de-ruta.json` sin mostrar, toolkit sin enlazar, sin progreso.
- L3: excepción test-first: las plantillas Hugo y el JS del navegador no tienen runner; se comprueban con `hugo --minify` y recorrido en el navegador.
- L4 (2026-11-02): verificado en `hugo server`: respuesta errónea rechazada; «Cuatro », «Lógica» y «protección» aceptadas (mayúsculas, espacios y tildes); la tarea con dos preguntas solo se completa al responder ambas; la tarea sin pregunta se marca con el botón; el progreso sobrevive a la recarga; «Continúa» apunta a la primera sala sin terminar; consola sin errores; móvil sin desbordamiento horizontal. `npm test` en `app/`: 34/34.
- L5: corregido durante la verificación: Hugo trata `weight: 0` como «sin peso» y mandaba el módulo 0 al final (pesos de módulo 1–10); el menú se salía de la pantalla en móvil.
- L6: siguiente paso: T3 (contenido de los módulos 4–7 y 9, y decidir qué se queda en el site y qué en la app de Glosario/Escenarios).
- L7 (2026-11-02): "va continua". Ruta: cinco escritores en paralelo (disparador de paralelismo: cinco módulos independientes, cada uno en su carpeta y con varios cientos de líneas). El padre revisa coherencia, compila y verifica en el navegador.
- L8 (2026-11-02): revisión del padre: sin voseo; nombres del laboratorio coherentes (`SRV-DC01` .10, Ubuntu reutilizado como `SRV-MON01` .20 en el proyecto final); la VLAN de puestos del módulo 9 pasa de la 60 a la 10 para coincidir con el módulo 5 y el mapa de referencia. Build: 65 páginas, 31 salas, 146 tareas, sin avisos. Navegador: una respuesta correcta por módulo nuevo aceptada, consola sin errores.
