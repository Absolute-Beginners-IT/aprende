# Arquitectura

El proyecto separa tres responsabilidades: portada y contenido público estático, aplicación de usuario estática (SPA) y una API futura. Tres subdominios representan tres responsabilidades, no tres máquinas.

```
              Navegador
             /         \
   example.com        app.example.com
   site/ (Hugo)       app/ (React SPA)     + /guias/
   guía y ruta        mapa interactivo       guias/ (guías de switching)
                           |
                           | HTTPS (futuro)
                           v
                     api.example.com
                     api/ (no existe aún)

   content/  ← base de conocimiento compartida que leen site/ y app/ al compilar
```

| Dirección | Qué sirve | Cómo se aloja |
| --- | --- | --- |
| `example.com` | Ruta de aprendizaje (módulos, salas y tareas), glosario, escenarios, documentación | `hugo --minify` → Cloudflare Pages (o cualquier hosting estático) |
| `app.example.com` | Mapa por capas y modo "Mi infraestructura" | `npm run build` → Cloudflare Pages |
| `app.example.com/guias/` | Guías de switching por marca y planificador de red | `npm run build` en `guias/`, integradas con `git subtree` (ver ADR 0004) |
| `api.example.com` | Cuentas, progreso, inventarios compartidos | **No se construye todavía** (ver ADR 0002) |

## Contenido compartido

`content/` es la única fuente del conocimiento:

- `content/kb/`: tipos de equipo (qué vigilar, cómo, alertas, mantenimiento), familias, severidades, fragmentos de configuración por fabricante y hoja de ruta.
- `content/referencia/pyme.json`: el mapa de referencia de una pyme típica (nodos con capa y posición, enlaces, VLANs).
- `content/glosario.json` y `content/escenarios.json`: términos y escenarios de incidencias paso a paso (cada paso señala nodos del mapa de referencia).

Los tests de `app/` validan el contenido: fichas completas, referencias entre ficheros correctas y ninguna referencia a una empresa concreta.

Hugo lo monta como datos (`hugo.Data.kb.*`) y la app lo importa con el alias `@content`. Ninguno de los dos copia los datos.

## App: puertos y adaptadores

La app no sabe dónde se guardan los datos del alumno:

- `src/ports/InventoryRepository.ts`: contrato asíncrono (`list`, `save`, `remove`).
- `src/adapters/localStorageInventoryRepository.ts`: implementación actual, solo en el navegador.
- Futuro: `httpInventoryRepository.ts` contra `api.example.com`, con el mismo contrato.

Los componentes siguen el patrón contenedor/presentación: `MapPage`, `ScenariosPage` e `InventoryPage` gestionan el estado, y `ReferenceMap` y `NodeDetail` solo pintan. La lógica del modo «Mi infraestructura» vive en funciones puras con tests: `domain/inventoryAnalysis.ts` (carencias frente a una pyme típica) y `domain/inventoryCsv.ts` (importación y exportación con protección contra fórmulas de hoja de cálculo).

## Despliegue (cuando toque)

| Proyecto | Directorio raíz | Comando de build | Salida |
| --- | --- | --- | --- |
| Guía | `site` | `hugo --minify` | `public` |
| App | `app` | `npm ci && npm run build` | `dist` |
| Guías de switching | `guias` | `npm ci && npm run build` | `dist/index.html`, servido en `/guias/` de la app |

Cada carpeta lleva su `_headers` con cabeceras de seguridad (CSP estricta, `nosniff`, `frame-ancestors 'none'`). La app incluye `_redirects` para que las rutas de la SPA vuelvan a `index.html`.

## Ruta de aprendizaje

`site/content/ruta/` sigue el modelo de las rutas de TryHackMe, con aspecto propio: la ruta tiene módulos (secciones con `modulo` y `weight`), cada módulo tiene salas (páginas con `duracion`, `nivel`, `objetivos`, `requisitos` y `equipo`) y cada sala tiene tareas (shortcode `tarea`) con preguntas (shortcode `pregunta`). Las respuestas válidas se publican como hash SHA-256 del texto normalizado y `site/assets/js/ruta.js` las comprueba y guarda el progreso en `localStorage` (en memoria si no está disponible). La ruta se dibuja como una topología de red: cada módulo es un segmento con su color y su «VLAN», cada sala un equipo con icono (`layouts/partials/icono-equipo.html`), y `ruta.js` dibuja en SVG los cables entre salas y los enciende al completarlas. Sin JavaScript se ve como una lista. La ruta se portó desde el repo archivado `Mapa-Infraestructura` (PR #7), donde está su historial de revisión.

El CSS y `ruta.js` se sirven con Hugo Pipes (`minify | fingerprint`, con SRI): cada versión tiene una URL distinta y ningún navegador ni CDN sirve una copia antigua. `tema.js` sigue en `static/` porque debe cargarse en `<head>` antes del primer pintado y su test lo lee desde ahí.

## Guía y app

La guía es para aprender y la app para practicar. El glosario vive solo en la guía; la página de escenarios de la guía presenta cada incidencia y enlaza a la app (`app/#escenarios/<id>`), donde se resuelve sobre el mapa. La app enlaza de vuelta a la guía con `VITE_GUIDE_URL` (`app/src/config.ts`, por defecto `../`, porque la app se publica en `/app/` junto a la guía) y lee las rutas del hash con `app/src/routing.ts`.

Decisiones registradas en [docs/adr/](adr/).
