# Mi infraestructura integral (entrega 3): la biblioteca de guías en el marco de la web

Objetivo: que, dentro de la web, Guías se vea como una sección más (barra de la web y biblioteca por tipo de equipo) y no como otra aplicación, preparada para sumar firewalls, virtualización y almacenamiento.
Rama: `feat/guias-marco` (desde main ecbcad5) · Entrega: un PR · Pruebas: Vitest (`guias/`, `app/`), `node --test site/scripts/*.test.mjs`, web ensamblada como en `pages.yml`.

## Specs

- S1. Decisión del usuario: «Nuevo marco en Guías (Recomendado)»: las guías siguen siendo su propia aplicación, pero dentro de la web cambian su cabecera, sus pestañas de marca y su barra lateral por el diseño de la maqueta: barra de la web y un árbol por tipo de equipo (Switches → marca → tareas; Firewalls, Virtualización y Almacenamiento como «Próximamente»).
- S2. Cada plataforma tiene su tipo de equipo, para sumar firewalls más adelante sin cambiar la estructura. El índice para la app (`content/guias-indice.json`) lo incluye.
- S3. El HTML para usar sin conexión (sin barra de la web) sigue funcionando como hasta ahora.
- S4. Lo que ya funciona se mantiene dentro del marco nuevo: buscar (Ctrl K), tema claro u oscuro, fundamentos, estado del contenido, recientes, «Rellenar con un equipo de mi infraestructura» y todas las rutas (`#/p/<p>/<t>?equipo=<id>` incluida). La página «Red y VLAN» (planificador) pertenece a «Mi infraestructura»: no muestra el árbol de la biblioteca.
- S5. Textos en español de España.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2 | delegada (escritor `guias/`) | hecho: RED 3 tests guías + 1 app → GREEN | 2b52be1 |
| T2 | S1, S3, S4, S5 | delegada (mismo escritor `guias/`) | hecho: RED 7 tests → GREEN guías 306/306, app 106/106, tsc, build; comprobación del padre igual | 2b52be1 |

- T1: campo de tipo de equipo en las plataformas (esquema, YAML, índice regenerado).
- T2: marco de la biblioteca cuando hay barra de la web: árbol por tipo → marca → tareas, portada de la biblioteca por tipo, barra de herramientas con búsqueda y tema; planificador sin árbol; archivo independiente sin cambios.

## Log

- L1 (2026-11-04): «entrega 3»; decisión: «Nuevo marco en Guías (Recomendado)».
- L2: un solo escritor por el respaldo de contexto (sesión larga del padre); T1 y T2 tocan la misma aplicación y van juntas.
- L3: escritor terminado, diff dentro de la superficie. Decisiones: dentro de la web no se pinta la cabecera del manual; barra de herramientas con «Guías» (solo en pantallas estrechas), «Buscar Ctrl K» y tema; árbol «Biblioteca» con grupos por tipo, la marca activa desplegada reutilizando `TaskNav`; en fundamentos se despliega la lista de artículos bajo «Fundamentos»; `#/plan` sin árbol ni barra. Riesgo: ninguno de la lista (el índice gana una clave nueva, `tipo`, que la app ya admite).
- L4: comprobación del padre en la web montada como en `pages.yml`: portada «Guías» con la tarjeta «Switches» (4 marcas, 19 tareas) y los tipos «Próximamente»; árbol «Biblioteca» con la marca activa desplegada; sin cabecera del manual; a 375 px sin desbordamiento horizontal y el botón «Guías» abre el árbol; `#/plan` sin biblioteca y con «Mapa | Lista | Red y VLAN»; consola limpia. Añadido por el padre: título de la pestaña «Guías · sysadmin junior» o «Red y VLAN · sysadmin junior» dentro de la web (1bc2c96, RED → GREEN, guías 307/307).
- L5: evaluación nativa del rango ecbcad5..HEAD: riesgo medio, `review_due` falso (`under_budget`); sin revisión. Riesgo: ninguno de la lista, así que sin verificador independiente.
