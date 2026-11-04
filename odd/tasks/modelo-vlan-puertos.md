# Modelo único de equipos, VLAN y puertos

Objetivo: que «Mi infraestructura» sea la única fuente de los switches y de sus conexiones, y que el planificador de «Red y VLAN» solo guarde lo que es suyo (VLAN, puertos de cada enlace, VLAN nativa, puertos de acceso y campos propios del switch).
Rama: `feat/modelo-vlan-puertos` (desde main ace0771) · Entrega: un PR · Pruebas: Vitest (`guias/`, `app/`), web ensamblada como en `pages.yml`.

## Specs

- S1. Decisión del usuario: «Inventory owns devices (Recommended)»: «Switches and connections live only in the inventory; the plan stops copying them and keeps just VLANs, interfaces per link, native VLAN and access ports, keyed by inventory device id. Existing plans are migrated once by matching names.»
- S2. Modo inventario: cuando el inventario de este navegador (`mapa-infra:inventario`) tiene al menos un switch, los switches del plan son los del inventario (nombre e IP de gestión vienen de él; el modelo se deduce de marca, modelo y firmware, y si no encaja se queda el que elija el usuario) y los enlaces son los `uplinks` entre dos switches. El plan guarda `deviceId` en cada switch. (Supuesto: el criterio «al menos un switch» lo elige el padre.)
- S3. Migración: un switch guardado sin `deviceId` se asocia al del inventario con el mismo nombre (sin distinguir mayúsculas ni espacios). Los switches del plan que no están en el inventario no se borran: se ocultan con sus enlaces y puertos y un aviso dice cuáles son y cómo recuperarlos. Un enlace guardado entre dos switches del inventario conserva sus puertos y su VLAN nativa.
- S4. En modo inventario el planificador no añade ni quita switches ni enlaces, ni cambia su nombre o su IP: lo explica y manda a «Mi infraestructura». Sigue editando modelo (si no se deduce), puerta de enlace, bridge, núcleo, puertos de cada enlace, VLAN nativa, VLAN y puertos de acceso. Desaparece el botón «Traer switches del inventario».
- S5. Sin switches en el inventario (guías sueltas, abiertas desde un fichero, o inventario vacío) el planificador funciona como hasta ahora. Los planes exportados antes siguen pudiéndose importar.
- S6. Textos en español de España; documentación y CHANGELOG de las guías al día.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1–S3, S5 | inline | hecho: RED (módulo ausente) → GREEN 9/9 | (commit de la entrega) |
| T2 | S4, S6 | inline | hecho: RED 4 tests de la página → GREEN; guías 316/316, tsc, build | (commit de la entrega) |

T1 función pura que combina plan guardado e inventario, y la vuelta al guardar · T2 editores, página del planificador, textos y docs.

## Log

- L1 (2026-11-04): «Unify VLAN/ports» (siguiente paso del resumen de la entrega 4), y la respuesta «Inventory owns devices (Recommended)».
- L2: mapa del explorador: los consumidores del plan (`validatePlan`, `buildPlanGuide`, `TopologyDiagram`) solo necesitan un `NetworkPlan`; si se les da el plan ya combinado con el inventario no cambian. Las guías no saben si están dentro de la web salvo por `VITE_SITE_NAV`; el criterio de modo es el propio inventario, que solo se lee en el mismo origen.
- L3: aviso de proceso: el ADR 0004 dice que los cambios de `guias/` van primero a su repo, pero desde 1434278 las entregas editan `guias/` aquí y el repo `guias` está en 7a890a3. Esta entrega sigue la práctica reciente; queda pendiente decidir si se llevan los cambios al repo de las guías.
- L4: ruta inline: una sola unidad de comportamiento, sin disparador de escritor.
- L5: comprobado en el navegador (`vite` de las guías con inventario y plan sembrados): el plan anterior se asocia por nombre (`sw-1` → SW-CORE con `deviceId`), SW-P1 entra como `sw-3`, «viejo» se oculta con su enlace `ln-1` y su puerto, y el aviso lo nombra; el modelo deducido queda bloqueado; consola sin errores. `biome check src`: solo el formato de `App.test.tsx`, que ya fallaba en la base. Se quita `addInventorySwitches` (sin uso). La app no cambia.
- L6: Risk: item 1 (el planificador reescribe el plan guardado: añade `deviceId` y copia nombre e IP del inventario; nada se borra). Toca verificador independiente.
- L7: verificación independiente (base ace0771, entrega 4dcd0ba): S1, S2, S4, S5 y S6 cumplidas; 22 de los tests de la página de la base siguen pasando (fallan solo los dos de «Traer switches», que S4 quita); la sincronización escribe una vez y para; sin inventario de switches no escribe nada. S3 con un bloqueante: un switch borrado y vuelto a crear en Mi infraestructura (id nuevo, mismo nombre) no se recuperaba porque la búsqueda por nombre ignoraba los switches con `deviceId`. Corregido: también se asocian por nombre los que tienen un `deviceId` que ya no existe. RED con el caso del verificador → GREEN, guías 317/317, tsc. Avisos no corregidos: los puertos de switches ocultos pasan al final de la lista (solo cambia el orden); los ocultos solo se recuperan desde el inventario, el planificador no permite descartarlos.
