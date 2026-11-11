# Historial de cambios

Todos los cambios relevantes de este proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- Figuras en todas las guías de FortiGate, Proxmox VE y Synology DSM, como las de Veeam: pantallas redibujadas y
  simplificadas para los pasos de la interfaz web (no son capturas) y esquemas que explican qué viaja y dónde se guarda
  en las guías de comandos. Lo que la guía no nombra se dibuja como una barra gris, y la leyenda lo dice. Los
  generadores de todas las figuras están en `guias/scripts/figures/`, con un kit de dibujo común.
- Figuras en los pasos de las guías: cada paso puede llevar un dibujo con su descripción para lectores de pantalla y una
  leyenda. Las guías de Veeam tienen ocho: pantallas de la consola redibujadas y simplificadas (no son capturas), con
  números que señalan lo que nombra el paso, y un esquema de qué viaja y dónde se guarda en una copia. Siguen el tema
  claro u oscuro y funcionan en el archivo sin conexión.
- Primeras copias de seguridad: Veeam Backup & Replication 13.1 en Windows Server, en «Copias de seguridad», con
  cinco guías de pasos en su consola: instalarlo, añadir un repositorio, programar un trabajo que copia las máquinas de
  Proxmox VE, restaurar una máquina virtual y guardar la copia cifrada de su configuración (.bco). Las plataformas pueden
  gestionarse ahora desde una consola gráfica, con sus pasos marcados como «Paso en la consola». Veeam entra en el Plan de
  despliegue: instalación, repositorio, trabajo y copia de la configuración.
- Primer almacenamiento: Synology DSM 7.4, en «Almacenamiento», con ocho guías de pasos en su interfaz web:
  instalar DSM con Web Assistant, crear un usuario administrador, NTP, syslog (Log Center), SNMPv3, guardar y restaurar la
  configuración (.dss) y actualizar DSM (irreversible, con copia antes).
- Proxmox VE completo: guías para actualizar el sistema (apt full-upgrade y vuelta al núcleo anterior), activar SNMPv3
  con snmpd y restaurar la configuración desde la copia, archivo por archivo. Las tareas de actualizar, SNMP y
  restaurar hablan ahora del «equipo» en lugar del «switch». SNMP entra en el Plan de despliegue de Proxmox.
- Tres tareas nuevas, con su guía de Proxmox VE 9: «Copiar una máquina virtual» (vzdump y cómo restaurar con
  qmrestore) y «Hacer una snapshot antes de un cambio» (qm snapshot, rollback y delsnapshot), en «Seguridad y
  resiliencia», y «Preparar el puente de red para VLAN» (puente VLAN aware y etiqueta en la tarjeta de la máquina
  virtual), en «VLANs y puertos». El puente para VLAN entra en el Plan de despliegue de Proxmox.
- Primer equipo de virtualización: Proxmox VE 9, en «Virtualización», con la guía de instalación (nueva tarea
  «Instalar el sistema», la primera de «Puesta en marcha y acceso») y las de crear un usuario administrador,
  sincronizar la hora con NTP, enviar los registros a un servidor syslog y guardar una copia de la configuración. La
  tarea del usuario administrador habla ahora del «equipo» en lugar del «switch».
- Primer equipo que no es un switch: el firewall FortiGate (FortiOS 7.4), con las guías para guardar una copia de la
  configuración, sincronizar la hora con NTP y enviar los registros a un servidor syslog. Sale en la biblioteca en
  «Firewalls». Sus pestañas de marca y «Misma tarea en otra marca» solo enlazan equipos del mismo tipo, el
  planificador y el desplegable «Rellenar con un equipo de mi infraestructura» siguen siendo solo para switches, y las
  tareas de NTP, syslog y copia de la configuración hablan ahora del «equipo» en lugar del «switch».
- Aviso fijo en todas las páginas: el manual es un prototipo en desarrollo y no sustituye a la documentación oficial
  del fabricante ni a una prueba en laboratorio.
- Barra de navegación de la web que contiene el manual, cuando se compila dentro de ella (variable `VITE_SITE_NAV`, con
  la lista de enlaces en JSON). Sustituye al enlace «← Volver a la web» y a la variable `VITE_HOME_URL`. El archivo
  independiente no la muestra.
- Planificador: si «Mi infraestructura» de la web tiene switches en el mismo navegador, son los switches del plan, con
  su nombre, su IP, su modelo (cuando es uno de los del manual) y un enlace por cada conexión entre ellos. Se cambian
  allí; el plan guarda solo lo suyo (VLAN, puertos de cada enlace, VLAN nativa, puertos de acceso, puerta de enlace y
  bridge) y cada switch lleva el id del equipo (`deviceId`). Un plan anterior se asocia por nombre y sus switches que no
  están en el inventario se ocultan sin borrarse. Sin switches en el inventario, el planificador funciona como antes.
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
- En la web, el planificador muestra la cuarta pestaña de «Mi infraestructura», «Plan de despliegue», después de
  «Red y VLAN»: el orden queda «Mapa | Lista | Red y VLAN | Plan de despliegue», como en la app.

### Cambiado

- El planificador de red lee el inventario en el nuevo formato de «Mi infraestructura», con enlaces de distintos tipos
  (`mapa-infra:topologia`). Une los switches igual que antes: un switch cuelga de otro por un enlace de datos, troncal,
  LAG, WAN o almacenamiento; los enlaces de alta disponibilidad, apilamiento, gestión y energía no cuentan. Si el
  navegador solo tiene el inventario antiguo, lo sigue leyendo.
- En el planificador, los puertos de un enlace entre switches puestos en el mapa de «Mi infraestructura» rellenan el
  puerto de ese lado y se muestran solo para leer, con la nota «Se cambia en el mapa de Mi infraestructura»; las guías
  generadas usan ese puerto. El lado sin puerto en el mapa sigue siendo editable, con el valor que tenía en el plan, y
  ese valor vuelve si se quita el puerto del mapa. Si dos enlaces del mapa unen los mismos switches, el primero da los
  puertos, porque el plan tiene un enlace por pareja. Las guías nunca escriben en el inventario.
- El manual se llama ahora «Guías de infraestructura» (antes «Manual de Switching»), porque ya no cubre solo switches:
  título de la página, cabecera y portada del archivo independiente. Lo guardado en el navegador se conserva.
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

### Corregido

- Las figuras de los pasos ya no se estiran hasta el ancho de la columna: como mucho ocupan el 80 % de su tamaño
  natural, así que en una pantalla ancha el texto se ve como en la consola real y no más grande.
- Planificador: cuando dos switches de «Mi infraestructura» se llaman igual, el guardado automático ya no les crea un
  switch nuevo a cada uno. Antes, al renombrar uno, el switch del plan con ese nombre quedaba oculto para siempre; ahora
  vuelve a asociarse por su nombre (salvo que edites el plan mientras los nombres siguen repetidos). Los demás switches
  se siguen guardando con su id, así que puedes renombrarlos sin perderlos. Ese switch del plan no aparece como si
  faltara, y «Quitar del plan» (que se sigue ofreciendo para los que sí faltan) no lo borra.
- Dentro de la web, la barra de navegación se queda fija arriba al hacer scroll, como en el resto de páginas; la lista
  de tareas y el índice de secciones quedan justo debajo.
- Dentro de la web, la barra de navegación y el aviso de prototipo son iguales que en el resto de secciones (mismas
  medidas, menú plegable en pantallas estrechas, botón «Tema» y enlace «Qué es esto»), así que la barra ya no da un salto
  al cambiar de sección. El botón del tema pasa de la barra fina de la biblioteca a la barra de la web.
- Planificador con «Mi infraestructura»: los switches ocultos (los que el inventario no tiene) se pueden quitar del plan
  con «Quitar del plan», que pide confirmación y borra también sus enlaces y puertos. Uno sin nombre aparece como «un
  switch sin nombre». Al guardar, los puertos y enlaces mantienen su orden aunque su switch esté oculto. Si dos switches
  del inventario tienen el mismo nombre, ninguno se asocia por nombre a un switch del plan y un aviso pide renombrar uno.

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
