# Ruta de aprendizaje (port desde el repo archivado)

Objetivo: llevar a la web publicada la ruta de aprendizaje estilo TryHackMe hecha en `Mapa-Infraestructura` (PR #7, merge 31c2e7a), adaptada al aspecto, la navegación y el tema de `aprende`.
Rama: `feat/ruta-aprendizaje` · Entrega: un PR · Pruebas: Vitest (`app/`), `node --test site/scripts/*.test.mjs`, build de Hugo con la subruta `/aprende/`, recorrido en el navegador.

## Specs

- S1. "no veo los cambios en https://absolute-beginners-it.github.io/aprende/" → decisión del usuario: "Portarla a aprende (Recomendado)".
- S2. Ruta: 10 módulos, 31 salas, 146 tareas con preguntas comprobables y progreso en el navegador, dibujada como topología de red (decisión previa del usuario: "Topología de red").
- S3. Reparto: "Guía aprende, app practica" (glosario solo en la guía; escenarios presentados en la guía y resueltos en la app con `#escenarios/<id>`).
- S4. Respetar lo propio de `aprende`: subruta `/aprende/`, tema (`data-theme` + preferencia del sistema), `content/navegacion.json`, aviso de prototipo, herramientas y guías.
- S5. Textos en español de España.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2, S3, S4, S5 | delegada (escritor paralelo: `site/`) | hecho: build con `/aprende/` sin avisos (70 páginas), 14/14 tests de scripts | (commit de la guía) |
| T2 | S3, S4, S5 | delegada (escritor paralelo: `app/src/`) | hecho: RED 7 tests → GREEN 51/51, tsc y build | (commit de la app) |
| T3 | S1–S5 | inline | hecho: web ensamblada como en `pages.yml` y recorrida en el navegador | (este PR) |

## Log

- L1 (2026-11-02): "no veo los cambios en https://absolute-beginners-it.github.io/aprende/". La web sale de `aprende`, sin historia común con `Mapa-Infraestructura` (que `aprende` cita como repo archivado).
- L2: escritores en paralelo por disparador de paralelismo: dos unidades independientes con superficies disjuntas (`site/` y `app/src/`), cada una de varios cientos de líneas.
- L3: verificación del padre: contenido de la ruta, `ruta.js` y plantillas idénticos a los revisados en el repo archivado salvo tres enlaces (relref a escenarios y a herramientas). Web ensamblada como en `pages.yml` (guía en `/aprende/`, app en `/aprende/app/`): 10 segmentos, 31 salas, 30 cables; pregunta respondida y progreso guardado; tema oscuro forzado con colores de segmento oscuros; escenario de la guía abre `app/#escenarios/<id>`; la app enlaza a `/aprende/ruta/` y `/aprende/glosario/`; alias de la lección antigua redirige; consola sin errores. Guías (`guias/`) no se compilaron en local: no se han tocado.
