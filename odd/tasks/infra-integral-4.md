# Mi infraestructura integral (entrega 4): plan de despliegue

Objetivo: una pestaña «Plan de despliegue» en «Mi infraestructura» que ordene los equipos del inventario en el orden en que se montan y diga, para cada uno, qué configurar, qué vigilar y qué mantener, con el progreso guardado.
Rama: `feat/plan-despliegue` (desde main e566651) · Entrega: un PR · Pruebas: Vitest (`app/`, `guias/`), `node --test site/scripts/*.test.mjs`, web ensamblada como en `pages.yml`.

## Specs

- S1. Decisión del usuario sobre la maqueta: «Sí, así (Recomendado)»: «Nueva pestaña «Plan de despliegue» en Mi infraestructura. Los equipos van en el orden en que se montan, del borde hacia dentro. Cada uno tiene tres columnas: Configurar (las guías que le tocan, ya rellenadas, en orden de montaje), Vigilar (método, plantilla y alertas de su tipo) y Mantener (tareas con su frecuencia). El progreso se guarda en el navegador y el plan se puede imprimir.»
- S2. Fuente única: el plan se calcula del inventario guardado (`mapa-infra:inventario`), del conocimiento de cada tipo (`content/kb/tipos.json`: `metodo`, `plantillaZabbix`, `alertas`, `actuaciones`), de las configuraciones por fabricante (`snippetsForDevice`) y del índice de guías (`content/guias-indice.json`, enlaces `?equipo=` como en la ficha). No se duplica contenido.
- S3. Equipos sin guías (otros tipos o switches de un modelo no cubierto) muestran en Configurar la misma explicación que la ficha; Vigilar y Mantener se muestran igual.
- S4. La pestaña está en la app y en el planificador de las guías, con el mismo orden: «Mapa | Lista | Red y VLAN | Plan de despliegue».
- S5. Textos en español de España.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1–S5 | delegada (un escritor: `app/` y la pestaña en `guias/`) | hecho: RED (rutas, pestañas, módulos nuevos) → GREEN app 130/130, guías 307/307, tsc, build; comprobación del padre igual | 796c1e0, corrección en el commit siguiente |

## Log

- L1 (2026-11-04): «Sí, entrega 4»; maqueta del plan aprobada: «Sí, así (Recomendado)».
- L2: un escritor por el respaldo de contexto (sesión larga del padre); la pestaña de las guías es una línea ligada al mismo cambio, así que va con él.
- L3: escritor terminado, diff dentro de la superficie. Decisiones: `levelFinder` exportado de `infraMap.ts` y compartido por el mapa y el plan; progreso en `mapa-infra:despliegue` con el mismo almacenamiento que el inventario; si falla la escritura, la casilla no se marca y se avisa; `GuideNote` compartido entre la ficha y el plan; CSS de impresión. El escritor dejó abierto un `vite preview` (puerto 4179) y otro del escritor de la entrega 2 (puerto 4785).
- L4: verificación independiente (base e566651, entrega 796c1e0): S2–S5 cumplidas y diferencial idéntico (`layoutDevices`, rutas, notas de la ficha); S1 con un bloqueante: un equipo con id `constructor` o `__proto__` (basta con llamarlo así) rompía la página del plan. Corregido con `doneSteps` (solo claves propias); RED con el mismo `TypeError` → GREEN, app 131/131. También: los pasos de mantenimiento se identifican por el texto de la tarea (`mantener:<tarea>`), no por su posición, y una «y» doble del README. Avisos no corregidos: un equipo suelto va antes que un firewall que cuelga de Internet (Internet cuenta como nivel 0, es intencionado y la página lo explica); Configurar incluye 10 de las 19 tareas (las de montaje inicial).
