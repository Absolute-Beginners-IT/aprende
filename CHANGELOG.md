# Historial de cambios

Todos los cambios relevantes de este proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [1.0.0] - 2026-10-15

Primera versión publicada como release, con el HTML descargable.

### Añadido

- Registro del cambio en cada guía: equipo, ticket, resultado de la verificación y notas, para copiarlo, descargarlo
  como `.md` o imprimir la guía rellenada y guardarla como PDF.
- Panel de estado del contenido (`#/status`): guías por estado y riesgo, matriz de tareas por marca, aviso de las que
  llevan más de 180 días sin revisarse y filtro de las pendientes de probar.
- Pie de página con la versión y la fecha de la última revisión del contenido.
- Botón de tema en la cabecera (sistema, claro u oscuro), que se recuerda entre sesiones.
- Aviso destacado en las guías sin verificar.
- Accesibilidad: botón «Saltar al contenido», anuncio de las copias para lectores de pantalla y foco siempre visible.
- README con el uso, el desarrollo, cómo añadir guías y los niveles de verificación.
- Lint y formato con Biome (`npm run check`, `npm run format`).
- CI en GitHub Actions para cada pull request y publicación del HTML al crear una versión.

### Cambiado

- Nuevo aspecto pizarra e índigo en los temas claro y oscuro, con tarjetas con sombra y esquinas redondeadas.

### Corregido

- En pantallas de menos de 900 px las pestañas de marca desaparecían y el botón «Tareas» se salía de la pantalla.

## [0.1.0] - 2026-10-15

Primera versión utilizable, sin publicar como release.

### Añadido

- Guías interactivas para Aruba CX 6100, Cisco Catalyst 1300, MikroTik CRS317 y Ruijie NBS3200: comandos generados
  con tus valores, riesgos, comprobaciones previas, verificación y vuelta atrás.
- Tareas de puesta en marcha y acceso, VLAN y puertos, monitorización (SNMPv3 incluido) y seguridad y resiliencia.
- Fundamentos: qué es un switch, MAC, IP y VLAN, tipos de switch, gestión, marcas y cómo trabajar sin romper la red.
- Navegación con pestañas de marca, lateral de tareas, índice de secciones, búsqueda con `Ctrl+K` y guías recientes.
- Un único `index.html` que funciona sin conexión.
