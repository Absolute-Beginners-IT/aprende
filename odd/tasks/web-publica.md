# Web pública del prototipo

Objetivo: publicar el proyecto como prototipo honesto, con la arquitectura de tres responsabilidades (portada estática, SPA estática, API futura) e integrando Manuales sin tocar su repo. Rama: una por etapa, un PR por etapa. Estrategia de entrega: ask-on-risk. Pruebas: Vitest (`app/`, `guias/`), Hugo build (`site/`), `toolkit/tests/Test-Toolkit.ps1`.

## Specs

- S1. Arquitectura y ritmo: "sigue la arquitectura que te pasé en las 6 imagenes, simplifica todo lo que puedas y vamos poco a poco". Las imágenes describen: `example.com` portada y contenido público estático, `app.example.com` SPA de usuarios estática, `api.example.com` backend futuro.
- S2. Integración de Manuales: "integraría el repor de manuales switches en el proyecto este pero dejaría su repo como está por si se sigue desarrollando independientemente por otra via". Supuesto: se integra con `git subtree` en `guias/`, lo que permite traer cambios del repo `guias` más adelante.
- S3. Honestidad: "Quiero que la web sea sincera en todo momento indicando que es un prototipo o algo parecido".
- S4. Herramientas: "tambien quiero un apartado que tenga todas las herramientas disponibles que se creen estilo descubrir red etc".
- S5. Material privado: "Las imagenes son de un curso privado por lo que no hay que publicarlas".
- S6. Publicación: repos públicos y GitHub Pages (decisión del usuario: "Repos públicos (Recomendado)").

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
| --- | --- | --- | --- | --- |
| T1 | S1, S2 | inline | hecho | subtree desde `guias` 13cea0a; `guias` 243/243 y build, `app` 34/34 y build, Hugo build sin errores |
| T2 | S1, S6 | inline | pendiente | — |
| T3 | S3 | inline | pendiente | — |
| T4 | S4 | inline | pendiente | — |
| T5 | S3 | inline | pendiente (requiere cuentas del usuario) | — |
| T6 | S1 | inline | pendiente | — |

T1 Manuales integrado en `guias/` con `git subtree`, con sus pruebas y su build funcionando dentro de este repo · T2 despliegue en GitHub Pages: `site/` en la raíz, `app/` en `/app/` y `guias/` en `/app/guias/` · T3 aviso de prototipo en todas las páginas y página «Qué es esto» · T4 apartado de herramientas con descargas y SHA-256 · T5 analítica sin cookies y formulario de opinión · T6 configuraciones por fabricante en Mi infraestructura (rama `feat/vendor-config-inventory` del repo archivado).

## Log

- L1 (2026-10-30): "no lo sé, sigue la arquitectura que te pasé en las 6 imagenes, simplifica todo lo que puedas y vamos poco a poco. integraría el repor de manuales switches en el proyecto este pero dejaría su repo como está por si se sigue desarrollando independientemente por otra via"
- L2 (2026-10-30): contexto previo. Repos públicos nuevos `aprende` (desde Mapa-Infraestructura, sin `legacy/` ni las imágenes del curso) y `guias` (desde Manual-Switches), cada uno con un commit inicial firmado con la dirección anónima de GitHub; los privados quedan como archivo. Verificado: sin datos de la empresa ni secretos; `aprende` 34/34 pruebas y build, `guias` 243/243 pruebas, tipos y build.
- L3 (2026-10-30): T1 en la rama `feat/integrate-guias`. Manuales integrado en `guias/` con `git subtree --squash` (ADR 0004); se quita `Subir-a-GitHub.ps1`, un script de un solo uso que creaba el repo privado antiguo. Siguiente: T2, despliegue en GitHub Pages.
