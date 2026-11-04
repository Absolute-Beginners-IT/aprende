# Mi infraestructura integral (entrega 2): guías desde la ficha

Objetivo: que la ficha de cada equipo muestre las guías que le tocan y las abra con sus datos ya puestos, y que cada guía pueda rellenarse con un equipo de «Mi infraestructura».
Rama: `feat/infra-guias-ficha` (desde main 60dbed1) · Entrega: un PR · Pruebas: Vitest (`app/`, `guias/`), `node --test site/scripts/*.test.mjs`, web ensamblada como en `pages.yml`.

## Specs

- S1. Diseño acordado (maqueta): la ficha del equipo tiene «Guías para este equipo» con las guías que le tocan, «con tus valores ya puestos».
- S2. Diseño acordado (maqueta): cada guía ofrece «Rellenar con un equipo de mi infraestructura»; también se puede elegir «Ninguno, lo escribo yo».
- S3. El catálogo de guías vive solo en `guias/`. La app lo conoce por un índice generado (`content/guias-indice.json`) con un test que falla si el índice no coincide con el catálogo.
- S4. Una guía abierta desde la ficha (`#/p/<plataforma>/<tarea>?equipo=<id>`) se abre con ese equipo elegido. Solo se rellenan los valores que el equipo permite deducir y que pasan la validación; el resto los escribe el usuario. Las claves nunca se guardan.
- S5. Equipos que las guías aún no cubren: un switch sin modelo reconocido explica qué modelos cubren las guías; otros tipos dicen que sus guías llegarán más adelante.
- S6. Textos en español de España.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2, S4, S6 | delegada (escritor `guias/`) | hecho: RED (rutas 4, RunbookPage 8, App 1, módulos nuevos) → GREEN guías 289/289, tsc, build; comprobación del padre 289/289 | 6a4b11b |
| T2 | S3 | delegada (mismo escritor `guias/`) | hecho: índice con `toMatchFileSnapshot`, `npm run guide-index` lo regenera | 6a4b11b |
| T3 | S1, S3, S5, S6 | delegada (escritor `app/`, después de T1-T2) | hecho: RED (módulo y 3 tests de ficha) → GREEN; test de coherencia del índice añadido por el padre; app 106/106, tsc, build | 17daf9d |

- T1: «Rellenar con un equipo de mi infraestructura» en la guía; ruta con `?equipo=<id>`; valores deducidos del equipo reutilizando `resolveParam`.
- T2: índice `content/guias-indice.json` (plataformas con su patrón de marca y modelo, tareas con título, bloque y plataformas) generado por un script de `guias/`, con test de que está al día.
- T3: sección «Guías para este equipo» en la ficha de la app, agrupada por bloque, con enlaces que abren la guía ya rellenada.

## Log

- L1 (2026-11-04): «Sí, entrega 2».
- L2: mapa del explorador: el planificador ya rellena una guía escribiendo `switching-manual:<p>/<t>:values` y navegando a `#/p/<p>/<t>`; `parseRoute` no admite `?…`; no hay parámetro de nombre de equipo; la IP de gestión es `ipCidr` (Aruba, MikroTik) o `ipAddress` + `mask` (Cisco, Ruijie); `PLATFORM_PATTERNS` solo existe, sin exportar, en `guias/src/features/planner/inventoryImport.ts`; la app no importa nada de `guias/`.
- L3: escritores delegados por el respaldo de contexto (sesión larga del padre). T3 depende del índice de T2 y de la ruta de T1, así que va después.
- L4: escritor de guías terminado, diff dentro de la superficie. Decisiones: patrones de plataforma movidos a `guias/src/domain/platformPatterns.ts`; regla común `resolveValidValues` para planificador y equipo; el equipo rellena solo `ipCidr`, `ipAddress`, `mask`, `switchIp` y `location` (nunca inventa prefijo; los nombres de copia no se deducen); `?equipo=` leído con `URLSearchParams`. Cambio de comportamiento aceptado: `parseRoute` quita cualquier `?…` antes de enrutar, así que toda página con una consulta en la dirección (`#/plan?x=1`, `#/f?x`, `#/status?x`, `#/p/<p>/<t>?x=1`…) se abre en vez de dar «no encontrado».
- L5: escritor de la app terminado, diff dentro de la superficie. El test de coherencia del índice vive en `app/src/content/content.test.ts` (ruta mal indicada al escritor); lo añadió el padre. «Planificar VLAN y puertos» se mantiene justo después de la sección de guías.
- L6: verificación independiente (base 60dbed1, entrega 17daf9d): S1–S6 cumplidas, sin bloqueantes; diferencial con la base idéntico salvo las consultas `?…` (L4). Aviso 1 corregido por riesgo real (comandos listos con la IP de otro equipo): al cambiar de equipo, los valores que puso el anterior y nadie cambió se borran, también entre visitas (`:device` en el almacenamiento); RED 2 tests → GREEN guías 292/292. Avisos no corregidos: recargar una dirección con `?equipo=` vuelve a aplicar el equipo; una guía sin parámetros guarda `{}`; el orden de plataformas coincide en app y guías pero no se impone.
- L7: revisión nativa (RDD) del rango 60dbed1..HEAD, riesgo alto por el ítem 3 (rutas y resolución de valores compartidas), lentes riesgo y fiabilidad; el usuario eligió «Revisar este cambio». Fiabilidad encontró que reabrir o recargar `?equipo=` volvía a poner la IP del inventario encima de una corrección del usuario (R3-devicefill-reload-clobber); corregido en a7fdf11: al abrir desde la ficha no se pisa nada que el usuario haya cambiado; elegir en el desplegable sí aplica el equipo. Validación aprobada y acuse hecho (autoridad gastada). Avisos no bloqueantes: R3-missing-reload-coverage, R3-platform-regex-recompile, R3-query-leniency. Guías 293/293.
