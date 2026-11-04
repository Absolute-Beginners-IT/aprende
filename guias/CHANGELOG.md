# Historial de cambios

Todos los cambios relevantes de este proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- Aviso fijo en todas las páginas: el manual es un prototipo en desarrollo y no sustituye a la documentación oficial
  del fabricante ni a una prueba en laboratorio.
- Barra de navegación de la web que contiene el manual, cuando se compila dentro de ella (variable `VITE_SITE_NAV`, con
  la lista de enlaces en JSON). Sustituye al enlace «← Volver a la web» y a la variable `VITE_HOME_URL`. El archivo
  independiente no la muestra.
- Planificador: botón «Traer switches del inventario», que añade al plan los switches apuntados en «Mi infraestructura»
  de la web, con su modelo, su IP y sus conexiones.
- En cada guía, el desplegable «Rellenar con un equipo de mi infraestructura» pone en «Tus datos» lo que se puede
  sacar de un switch de ese modelo apuntado en «Mi infraestructura»: su IP de gestión (con prefijo, o la dirección y la
  máscara, según la marca) y su ubicación, solo si pasan la validación de la guía. El resto, y las claves, los escribes
  tú. «Ninguno, lo escribo yo» deja los valores como están. Si el navegador no tiene inventario, no aparece.
- Dirección `#/p/<marca>/<tarea>?equipo=<id>`: abre la guía con ese equipo del inventario ya elegido y sus valores
  puestos. Así la ficha de cada equipo de la web puede enlazar a sus guías.
- Índice de las guías para la web, `content/guias-indice.json` en la raíz del repositorio: marcas con el patrón que
  reconoce sus modelos, bloques y tareas con las marcas que tienen guía. Se genera con `npm run guide-index` y
  `npm test` falla si no coincide con el catálogo.
- Tipo de equipo en cada ficha de marca (`deviceType`: `switch`, `firewall`, `hypervisor` o `storage`); las cuatro
  marcas actuales son switches. El índice para la web lo incluye en cada marca (`tipo`).

### Cambiado

- En la web, las guías se ven como una sección más: sin la cabecera del manual ni las pestañas de marca. Arriba queda
  la barra de la web y, encima de cada página, una barra fina con «Buscar» (`Ctrl+K`), el tema y, en pantallas
  estrechas, el botón «Guías» que abre el lateral. El lateral es la biblioteca por tipo de equipo: «Switches» con sus
  marcas (la marca en uso se despliega con sus tareas), «Firewalls», «Virtualización» y «Almacenamiento» como
  «Próximamente», y los enlaces a «Fundamentos» y «Estado del contenido». La portada es la biblioteca, con una tarjeta
  por tipo de equipo. «Red y VLAN» no muestra la biblioteca, porque pertenece a «Mi infraestructura». El archivo
  independiente se ve como hasta ahora.

- En la web, el planificador de red es la pestaña «Red y VLAN» de «Mi infraestructura» y sale de la cabecera del
  manual. El archivo independiente lo mantiene en la cabecera.
- Colores y tipografía alineados con la web del proyecto: acento naranja (más oscuro en el tema claro para mantener el
  contraste) y los mismos fondos, textos y bordes.

- La guía de SNMP del Cisco Catalyst 1300 pasa de una comunidad v2c a SNMPv3: Engine ID, grupo con autenticación y
  cifrado, usuario con SHA y AES 128 (creado en la interfaz web, como indica Cisco) y una ACL de gestión que solo
  acepta consultas SNMP del servidor de monitorización. Ahora las cuatro marcas usan SNMPv3.
- En las guías de SNMP de Aruba y MikroTik, el paso que crea el usuario SNMPv3 vuelve a mostrar el comando completo
  para copiar. Las claves de autenticación y de cifrado se escriben en «Tus datos»: rellenan el comando, pero solo viven
  en memoria (no se guardan en el navegador y se borran al recargar) y salen como `********` en el registro del cambio.

## [1.1.0] - 2026-10-16

Planificador de red: del diseño de la red a los pasos de cada switch.

### Añadido

- Planificador de red (`#/plan`): VLAN con su propósito, switches con su modelo, enlaces y puertos de acceso; comprueba
  que el plan es coherente y genera los pasos de cada switch, del núcleo hacia fuera, con los comandos de su marca ya
  rellenos y un enlace para abrir cada guía con esos valores.
- Mapa de la red dibujado a partir del plan, plantillas de inicio y exportación e importación del plan en JSON.
- Artículo de fundamentos «Diseñar las VLAN por propósito».

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
