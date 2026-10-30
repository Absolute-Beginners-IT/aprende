# Arquitectura

El proyecto separa tres responsabilidades: portada y contenido público estático, aplicación de usuario estática (SPA) y una API futura. Tres subdominios representan tres responsabilidades, no tres máquinas.

```
              Navegador
             /         \
   example.com        app.example.com
   site/ (Hugo)       app/ (React SPA)     + /guias/
   guía y lecciones   mapa interactivo       guias/ (guías de switching)
                           |
                           | HTTPS (futuro)
                           v
                     api.example.com
                     api/ (no existe aún)

   content/  ← base de conocimiento compartida que leen site/ y app/ al compilar
```

| Dirección | Qué sirve | Cómo se aloja |
| --- | --- | --- |
| `example.com` | Lecciones, glosario, escenarios, documentación | `hugo --minify` → Cloudflare Pages (o cualquier hosting estático) |
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

Decisiones registradas en [docs/adr/](adr/).
