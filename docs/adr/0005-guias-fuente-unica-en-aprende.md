# 0005 · Las guías se desarrollan solo en este repo

- Estado: aceptada (2026-11-05). Sustituye a la [0004](0004-guias-integradas-con-subtree.md).

## Contexto

La 0004 integró las guías en `guias/` con `git subtree` y pedía hacer los cambios primero en su repo, `Absolute-Beginners-IT/guias`, para traerlos después con `subtree pull`. Esa regla se siguió hasta el 2 de noviembre de 2026. Desde el commit 1434278 (3 de noviembre), las guías se han cambiado directamente aquí: 17 commits, 54 archivos y unas 3.200 líneas que el repo `guias` no tiene.

Casi todo lo nuevo solo funciona dentro de esta web:

- el planificador y las guías leen el inventario de «Mi infraestructura»;
- el índice `content/guias-indice.json`, que usa la app, se genera desde las guías;
- la barra de navegación copia la de la web.

El repo `guias` ya no se publica en ningún sitio. El repo `Manual-Switches`, del que salió `guias`, tampoco: su contenido está entero en `guias/` y ampliado con firewalls (FortiGate) y la integración con la web.

## Decisión

- `aprende/guias/` es la única fuente de las guías. Se editan aquí, con el mismo flujo que el resto del repo.
- Se dejan de usar `git subtree pull` y `git subtree push`.
- Los repos `Absolute-Beginners-IT/guias` y `Absolute-Beginners-IT/Manual-Switches` se archivan en GitHub (solo lectura) con una nota que apunta aquí. Su historial se conserva y se pueden desarchivar si hace falta.

## Requisito: poder trabajar sin la web

Las guías y las herramientas se tienen que poder consultar sin conexión y aunque la web deje de publicarse, para usarlas en el trabajo diario de sysadmin. Para no perderlo:

- las guías siguen compilando como un único `index.html` autónomo (`npm run build` en `guias/` sin `VITE_SITE_NAV`), que funciona abierto desde el disco;
- el toolkit sigue siendo archivos sueltos en `toolkit/`, sin depender de la web;
- este repo es la copia de respaldo: con clonarlo se tiene todo.

El paquete sin conexión se publica como release de GitHub, que no depende de GitHub Pages: al subir una etiqueta `sin-conexion-*`, el workflow `.github/workflows/paquete-sin-conexion.yml` compila las guías autónomas y arma con `site/scripts/paquete.mjs` un zip con `guias.html`, las herramientas del catálogo, `SHA256SUMS.txt` y `LEEME.txt`. Los workflows que trajeron las guías en `guias/.github/workflows/` no se ejecutan dentro de este repo, porque GitHub solo lanza los de la raíz.

## Por qué no otras opciones

- Sincronizar el repo `guias` con `git subtree push`: quedaría con funciones que solo funcionan dentro de la web, y habría dos repos que mantener para un solo producto.
- Mantener la 0004 tal cual: documenta un flujo que nadie sigue.

## Consecuencias

- Un solo sitio donde cambiar las guías, sin conflictos de subtree.
- Si algún día las guías se quieren publicar como proyecto aparte, se pueden separar otra vez con `git subtree split --prefix=guias`.
- Hay que cuidar que el modo autónomo de las guías siga funcionando: sus tests (`built on its own` en `guias/src/App.test.tsx`) lo protegen.
