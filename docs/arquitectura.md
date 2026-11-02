# Arquitectura

El proyecto sigue la separación en tres responsabilidades de la metodología de referencia (`docs/metodologia/01.jpeg` a `06.jpeg`). Tres subdominios representan tres responsabilidades, no tres máquinas.

```
              Navegador
             /         \
   example.com        app.example.com
   site/ (Hugo)       app/ (React SPA)
   guía y ruta        mapa interactivo
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
| App | `app` | `npm ci && npm run build` (con `VITE_GUIDE_URL` apuntando a la guía) | `dist` |

Cada carpeta lleva su `_headers` con cabeceras de seguridad (CSP estricta, `nosniff`, `frame-ancestors 'none'`). La app incluye `_redirects` para que las rutas de la SPA vuelvan a `index.html`.

## Ruta de aprendizaje

`site/content/ruta/` sigue el modelo de TryHackMe: la ruta tiene módulos (secciones con `modulo` y `weight`), cada módulo tiene salas (páginas con `duracion`, `nivel`, `objetivos` y `requisitos`) y cada sala tiene tareas (shortcode `tarea`) con preguntas (shortcode `pregunta`). Las respuestas válidas se publican como hash SHA-256 del texto normalizado, y `site/assets/js/ruta.js` (servido con hash en el nombre por Hugo Pipes) las comprueba y guarda el progreso en `localStorage` (en memoria si no está disponible). Las barras de progreso cuentan las tareas sobre la sala ya renderizada, así que también cuentan las que genera un shortcode, como las fases de la hoja de ruta (`content/kb/hoja-de-ruta.json`) en el módulo 8.

La ruta se dibuja como una **topología de red**: cada módulo es un segmento con su color y su «VLAN», y cada sala es un equipo (icono según el campo `equipo` de su front matter, en `layouts/partials/icono-equipo.html`). `ruta.js` dibuja en SVG los cables en ángulo recto entre salas consecutivas, los enciende cuando la sala de origen está completa y marca el estado de cada LED (completada, en curso, siguiente). Sin JavaScript, la ruta se ve como una lista.

## Guía y app

La guía es para aprender y la app para practicar. El glosario vive solo en la guía y la página de escenarios de la guía presenta cada incidencia y enlaza a la app (`app.example.com/#escenarios/<id>`), donde se resuelve sobre el mapa. La app enlaza de vuelta a la guía con `VITE_GUIDE_URL` (`src/config.ts`) y lee las rutas del hash con `src/routing.ts`.

Decisiones registradas en [docs/adr/](adr/).
