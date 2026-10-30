# Guía del administrador de sistemas junior

Guía interactiva para dar los primeros pasos como administrador de sistemas: qué hay en una infraestructura, cómo se vigila y cómo se actúa sobre ella. El núcleo es un **mapa de infraestructura por capas** (física, lógica, servicios y protección) en el que cada pieza explica qué es, para qué sirve, qué pasa si falla, los errores típicos, qué vigilar, qué alertas crear y qué mantenimiento necesita.

La app incluye además **escenarios de incidencias** paso a paso sobre el mapa, un **glosario** y el modo **«Mi infraestructura»**, que compara tu inventario (guardado solo en tu navegador) con el de una pyme típica y te dice qué falta.

## Estructura

| Carpeta | Qué es | Se despliega en |
| --- | --- | --- |
| `site/` | Guía y lecciones (Hugo, contenido estático) | `example.com` |
| `app/` | Mapa interactivo (React + Vite + TypeScript, SPA estática) | `app.example.com` |
| `guias/` | Guías de switching por marca (de [Absolute-Beginners-IT/guias](https://github.com/Absolute-Beginners-IT/guias), integradas con `git subtree`) | `app.example.com/guias/` |
| `api/` | Backend futuro. **Todavía no existe**: ver `api/README.md` | `api.example.com` |
| `content/` | Base de conocimiento compartida (JSON) que leen `site/` y `app/` | — |
| `toolkit/` | Scripts PowerShell y plantillas para aplicar lo aprendido en una red real | — |
| `docs/` | Arquitectura, decisiones (ADR) y la metodología de referencia | — |

La separación en portada estática, aplicación estática y API futura se explica en [docs/arquitectura.md](docs/arquitectura.md).

## Desarrollo

Requisitos: Node.js 24 y Hugo extended 0.158 o superior.

```bash
cd app && npm install && npm run dev      # mapa en http://localhost:5173
cd app && npm test                         # tests (Vitest)
cd guias && npm ci && npm run dev          # guías de switching
cd guias && npm test                       # tests de las guías (Vitest)
cd site && hugo server                     # guía en http://localhost:1313
node site/scripts/descargas.mjs            # genera las descargas de «Herramientas» (también al publicar)
node --test "site/scripts/*.test.mjs"      # tests de los scripts de la portada (descargas y tema)
```

Las guías de switching se desarrollan en su propio repo. Para traer sus cambios:

```bash
git subtree pull --prefix=guias https://github.com/Absolute-Beginners-IT/guias.git main --squash
```

No edites `guias/` directamente aquí: el siguiente `subtree pull` daría conflictos (ver [ADR 0004](docs/adr/0004-guias-integradas-con-subtree.md)).

## Contenido

Todo el conocimiento (tipos de equipo, alertas, mantenimientos, el mapa de referencia) vive en `content/`. Si cambias un dato ahí, cambia a la vez en la guía y en el mapa. Los tests de `app/` comprueban que el contenido es coherente (tipos, capas y enlaces que existen).

Para escribir una lección nueva: `cd site && hugo new lecciones/02-mi-leccion.md` (usa la plantilla de lección).

## Toolkit

Lo que antes era la carpeta de trabajo está en `toolkit/`, en el mismo orden: descubrir, inventariar, monitorizar, alertar, actuaciones, medir la red y procedimientos.

- Windows PowerShell 5.1 o PowerShell 7.
- `iperf3` (https://iperf.fr/iperf-download.php) y Ookla Speedtest CLI (https://www.speedtest.net/apps/cli) en `toolkit\05-Pruebas-Red\bin`, con su SHA-256 registrado en `bin\SHA256SUMS.txt`: los scripts no ejecutan un binario cuyo hash no figure ahí o no coincida. Los pasos están en `toolkit\05-Pruebas-Red\bin\LEEME.txt`.
- **Ejecuta los scripts de descubrimiento solo en redes de tu empresa y con autorización.**

La página «Herramientas» de la web publica los archivos que lista `toolkit/catalogo.json`, con su descripción, requisitos y huella SHA-256. Al publicar, `site/scripts/descargas.mjs` copia esos archivos y calcula sus huellas: nunca se escriben a mano. Si añades o renombras un archivo del toolkit, actualiza el catálogo; los tests fallan si lista un archivo que no existe.

## Principios

1. **Una sola fuente de verdad:** el inventario. Todo (mapa, monitorización, alertas) sale de él.
2. **Nada sin monitorizar:** cada equipo tiene `Monitorizado` = Sí/No.
3. **Cada alerta tiene dueño y acción:** si una alerta no lleva a hacer algo, sobra.
4. **Cada actuación tiene MOP y rollback.**
