# Mi infraestructura integral (entrega 1)

Objetivo: que «Mi infraestructura» sea un espacio único con un mapa editable de la red del usuario, y que el menú separe aprender (ruta, mapa de referencia, escenarios, glosario) de la red propia.
Rama: `feat/infra-integral` · Entrega: un PR por entrega (`ask-on-risk`) · Pruebas: Vitest (`app/`, `guias/`), `node --test site/scripts/*.test.mjs`, build de Hugo con `/aprende/`, web ensamblada como en `pages.yml`.

## Specs

- S1. Menú: «Me encaja mas la 1 y la parte de Mapa esta enfocada a enseñar por lo que la meteria dentro de aprender». Guías sigue en el menú principal como biblioteca; el mapa de referencia y los escenarios se presentan dentro de Aprender.
- S2. «Cuando usas el planificador de red y pones las conexiones me gusta porque hace un mapa de lo que estas poniendo y como lo estas conectando y eso debería representarse como el mapa de mi infraestructura. Ese mapa debería de poder modificarse con el raton arrastrando soltando, cambiando texto, etc.»
- S3. El mapa abarca todos los tipos de equipo del inventario (firewall, switch, servidores, hipervisor, almacenamiento, wifi, SAI…), no solo switches.
- S4. Lo ya guardado en el navegador se sigue viendo: el mapa edita el mismo inventario (`mapa-infra:inventario`), las conexiones son los `uplinks` de cada equipo y la posición en el mapa es un campo opcional nuevo. Sin migración de formato en esta entrega. Asunción: VLAN y puertos se unifican cuando la vista VLAN entre en el espacio (entrega posterior).
- S5. Textos en español de España.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S5 | inline | hecho: RED 3 tests → GREEN 62/62, scripts 14/14, build Hugo | 107aee1 |
| T2 | S2, S3, S4 | inline | hecho: RED (módulo inexistente) → GREEN 10/10, app 72/72, tsc | 0d87497 |
| T3 | S2, S3, S4, S5 | delegada (respaldo de contexto del padre) | hecho: RED 4 tests + suite nueva → GREEN 87/87, tsc, build; comprobación del padre 87/87 | 058bfb9, corrección en el commit siguiente |

- T1: `content/navegacion.json` sin «Mapa»; Aprender enlaza al mapa de referencia; la app marca «Aprender» en el mapa y los escenarios.
- T2: funciones puras del mapa (posición automática por niveles, conectar, desconectar, mover) con tests.
- T3: lienzo editable en «Mi infraestructura» (React Flow `@xyflow/react` 12.12.0, MIT): arrastrar, unir equipos, añadir desde una paleta, ficha del equipo con nombre editable y borrar; vistas Mapa y Lista.

## Log

- L1 (2026-11-03): «Me va gustando más pero no me termina de convencer. Siento que Mi infraestructura y Guias estan como por separado pero debería ser algo mas unificado mas integral y no tan desconectado y rígido. […] Ese mapa debería de poder modificarse con el raton arrastrando soltando, cambiando texto, etc. Ahora mismo la Guia esta sobre todo enfocado a switching pero en un futuro sera una guia integral […] Busca y analiza la forma de combinarlo todo de una forma estetica y funcional y antes de desarrollarla dame una imagen de la idea que tienes»
- L2: maqueta aprobada con ajustes: «Me encaja mas la 1 y la parte de Mapa esta enfocada a enseñar por lo que la meteria dentro de aprender»; después «Sí, empieza».
- L3: decisión de alcance: el inventario ya modela las conexiones (`uplinks`), así que la entrega 1 no cambia el formato guardado; solo añade `posicion` opcional. Evita una migración de datos y mantiene el botón «Traer switches del inventario» de las guías.
- L4: dependencia nueva `@xyflow/react` fijada a 12.12.0 (24-09-2026); la 12.12.1 salió el 02-11-2026 y se descarta por reciente. Riesgo: ítem 5 (dependencias).
- L5: T3 delegada a un escritor por el respaldo de contexto (sesión larga del padre); superficie: `app/package.json`, `app/package-lock.json`, `app/src/App.tsx`, `app/src/App.test.tsx`, `app/src/routing.ts`, `app/src/routing.test.ts`, `app/src/styles.css`, `app/src/features/inventory/**`.
- L6: escritor de T3 terminado. Diff dentro de la superficie. Decisiones: escrituras en cola en `useInventory.persist` (evita que ediciones rápidas de la ficha se pisen; afecta también a la Lista), selección controlada por la app, nodos `deletable: false` (Supr solo quita conexiones), posiciones guardadas desde `onNodesChange` (arrastre y flechas). Pendiente: unir soltando sobre el cuerpo del equipo (solo de punto a punto).
- L7: verificación independiente (base 68e3b0c, entrega 058bfb9): S1, S3, S4 y S5 cumplidas; S2 parcial por un bloqueante: en un inventario sin posiciones, mover un equipo recolocaba a los demás de su fila encima de él. Corrección: el primer movimiento fija también la posición que muestran los equipos colocados automáticamente (`placeUnplaced`); test de regresión con el caso del verificador (RED → GREEN, app 90/90). Avisos corregidos: espacio en el mensaje para lectores de pantalla y coordenadas no numéricas ignoradas. Avisos no corregidos por venir de la base: borrar desde la Lista deja `uplinks` colgando; `save` reordena el inventario guardado.
- L8: pestañas del planificador de las guías alineadas con la app («Mapa | Lista | Red y VLAN») y documentación actualizada (9a3d52f).
