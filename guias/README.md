# Guías de infraestructura

Antes «Manual de Switching». Guías interactivas para configurar switches y firewalls de forma segura: eliges la marca y la tarea, escribes tus valores y
obtienes los comandos listos para copiar, con los riesgos, la verificación y la vuelta atrás de cada cambio. Es un
único archivo HTML que funciona sin conexión.

| Marca | Equipo | Gestión |
|-------|--------|---------|
| HPE Aruba Networking | Aruba CX 6100 (AOS-CX) | Línea de comandos |
| Cisco | Catalyst 1300 | Línea de comandos |
| MikroTik | CRS317 (RouterOS 7) | Línea de comandos |
| Ruijie Reyee | NBS3200 | Interfaz web |
| Fortinet | FortiGate (FortiOS 7.4), firewall | Línea de comandos |
| Proxmox | Proxmox VE 9, virtualización | Línea de comandos (la instalación, con su instalador gráfico) |

El FortiGate y Proxmox VE son los equipos que no son switches. El FortiGate tiene tres guías (copia de la
configuración, NTP y syslog); Proxmox VE tiene cinco: su instalación, el usuario administrador, NTP, syslog y la copia
de la configuración. Ninguno entra en el planificador, que solo trabaja con switches.

Incluye 80 guías en 20 tareas (puesta en marcha y acceso, VLAN y puertos, monitorización, seguridad y resiliencia),
7 artículos de fundamentos y un planificador de red que genera los pasos de cada switch a partir del
diseño de la red.

## Uso rápido

1. Genera `dist/index.html` con `npm ci` y `npm run build` en esta carpeta. Las releases antiguas del repo archivado
   Manual-Switches (hasta la v1.1.0) solo tienen los switches de entonces.
2. Ábrelo con doble clic. No necesita servidor ni internet.
3. Elige la marca arriba y la tarea en el lateral, o busca con `Ctrl+K`.
4. Rellena **Tus datos**: los comandos se completan solos y solo se pueden copiar cuando todos los valores son válidos.
5. Sigue **Antes de empezar**, **Paso a paso** y **Verificación**. Si algo falla, aplica **Vuelta atrás**.
6. En **Registro del cambio**, anota el equipo y el ticket y copia o descarga el registro para el ticket. También
   puedes imprimir la guía rellenada o guardarla como PDF.

El tema claro u oscuro se cambia con el botón de la cabecera. El **Estado del contenido**, enlazado en el pie de página,
muestra qué guías están contrastadas, cuáles faltan por probar y cuáles conviene revisar.

### Dentro de la web y sin conexión

Las guías se ven de dos formas:

- **Archivo sin conexión** (`dist/index.html` o el HTML de cada release): cabecera con el título «Manual de
  Switching», «Fundamentos», «Planificador de red», una pestaña por marca, «Buscar» y el tema; en el lateral, las
  tareas de la marca elegida.
- **Dentro de la web del proyecto** (`/app/guias/`): las guías son una sección más de la web. No tienen cabecera
  propia: arriba está la barra de la web, igual que en el resto de secciones (con el menú plegable en pantallas estrechas
  y el botón **Tema**), y encima de cada página, una barra fina con **Buscar** (`Ctrl+K`) y, en pantallas estrechas, el botón **Guías** que abre el lateral. El lateral es la biblioteca por tipo de equipo:
  **Switches** con sus marcas (la marca en uso se despliega con sus tareas), los tipos que aún no tienen guías
  (Firewalls, Virtualización y Almacenamiento) como «Próximamente», y los enlaces a **Fundamentos** y **Estado del
  contenido**. La portada muestra una tarjeta por tipo de equipo. **Red y VLAN** (el planificador) pertenece a «Mi
  infraestructura» y se ve sin la biblioteca.

Las direcciones, la búsqueda, el tema, los recientes y el rellenado con un equipo del inventario funcionan igual en
las dos.

### Planificador de red

El **Planificador de red** (`#/plan`) sirve para diseñar o documentar la red de una empresa y sacar los
pasos de cada switch:

1. En **VLAN**, empieza con una plantilla o añade las VLAN una a una, con su propósito. Marca una como Gestión.
2. En **Switches**, elige el modelo de cada uno y su IP de gestión. El primero es el núcleo.
3. En **Enlaces**, indica qué puerto de cada switch une a cuál. Cada enlace se configura como trunk en los dos extremos.
4. En **Puertos**, asigna los puertos de acceso a su VLAN.
5. En **Guía**, si todo encaja, tienes los pasos de cada switch, del núcleo hacia fuera, con los comandos de su marca ya
   rellenos. «Abrir la guía con estos datos» lleva a la guía completa con los valores puestos.

En la web del proyecto, el planificador no está en la cabecera del manual: es la pestaña **Red y VLAN** de «Mi infraestructura», junto al mapa y la lista de equipos. Si en el inventario de ese navegador hay switches, son los switches del plan: su nombre, su IP, su modelo (cuando es uno de los del manual) y sus conexiones salen de «Mi infraestructura» y se cambian allí. En el planificador indicas lo que solo sabe el plan: las VLAN, el puerto de cada extremo de un enlace, la VLAN nativa, los puertos de acceso, la puerta de enlace, el bridge y cuál es el núcleo. Un plan hecho antes se asocia por nombre; los switches que el inventario no tiene se ocultan, sin borrarse, hasta que los añadas allí con el mismo nombre. Sin switches en el inventario, el planificador funciona como en el archivo independiente. En el archivo independiente, el planificador sigue en la cabecera.

El mapa de la red se dibuja solo a partir del plan. El plan se guarda en el navegador y se puede exportar e importar como
JSON. No cubre el enrutamiento entre VLAN, el DHCP ni el cortafuegos.

### Rellenar una guía con un equipo de tu inventario

En la web del proyecto, si en el inventario de «Mi infraestructura» de ese navegador hay switches, cada guía muestra en
**Tus datos** el desplegable **Rellenar con un equipo de mi infraestructura**. Solo lista los switches del modelo de
esa guía. Al elegir uno se ponen los valores que se pueden sacar del equipo y que la guía acepta: su IP de gestión (con
prefijo en Aruba y MikroTik; dirección y, si el inventario tiene el prefijo, máscara en Cisco y Ruijie) y su ubicación.
Se sustituyen solo esos valores; los demás, y las claves, los escribes tú. **Ninguno, lo escribo yo** deja los valores
como están. Si hay switches pero ninguno de ese modelo, la guía lo indica; sin inventario, como en el archivo
independiente, el desplegable no aparece. Las guías del FortiGate no lo muestran, porque solo rellena datos de switches.

La dirección `#/p/<marca>/<tarea>?equipo=<id>` abre la guía con ese equipo ya elegido y sus valores puestos (el `<id>`
del inventario va codificado para URL). Si el equipo no existe o es de otro modelo, la guía se abre sin rellenar nada.

Los valores y los pasos marcados se guardan en el navegador de ese ordenador. Las claves (como las de SNMPv3) se
piden en campos aparte que solo viven en memoria: rellenan los comandos, pero no se guardan en el navegador y salen
como `********` en el registro del cambio.

## Cómo leer cada guía

| Indicador | Significado |
|-----------|-------------|
| Riesgo bajo | No afecta al tráfico ni al acceso de gestión. |
| Riesgo medio | Puede cortar un puerto o un servicio concreto. |
| Riesgo alto | Puede dejar sin red a muchos equipos o dejarte sin acceso; usa siempre la red de seguridad de la marca. |
| Sin verificar | Algún comando no se ha podido confirmar en la documentación oficial. Pruébala antes en laboratorio. |
| Contrastada con documentación | Pasos y comandos comprobados en la guía oficial del fabricante para el firmware indicado. |
| Probada en equipo real | Ejecutada en un switch de laboratorio, con una nota de dónde y con qué firmware. |

## Desarrollo

Necesitas Node 24 (ver `.nvmrc`).

```bash
npm ci
npm run dev        # servidor de desarrollo
npm test           # pruebas (Vitest)
npm run typecheck  # comprobación de tipos
npm run lint       # solo lint (Biome)
npm run check      # lint, formato y orden de imports (Biome)
npm run format     # aplica el formato y los arreglos automáticos del lint
npm run build      # genera dist/index.html
npm run guide-index  # regenera ../content/guias-indice.json a partir del catálogo
```

La web del proyecto conoce las guías por `content/guias-indice.json` (en la raíz del repositorio), sin importar el
catálogo: marcas con su tipo de equipo y el patrón que reconoce sus modelos, bloques y tareas con las marcas que tienen guía. Si cambias
marcas, tareas o sus títulos, ejecuta `npm run guide-index` y sube el archivo: `npm test` (y el CI) falla mientras el
índice no coincida con el catálogo.

Si el manual se publica dentro de otra web, compílalo con `VITE_SITE_NAV`, una lista JSON con la navegación de esa web
(`[{"label": "Inicio", "href": "../../"}, {"label": "Guías", "href": "./", "current": true}, …]`): aparece entonces
una barra con esos enlaces y las guías cambian al marco de la biblioteca (ver «Dentro de la web y sin conexión»). El
primer enlace tiene que ser la portada de esa web: el nombre de la barra apunta a él. Si un enlace lleva
`"id": "infra"`, el planificador pasa a ser la pestaña «Red y VLAN» de esa sección. Sin la variable, o si no es una
lista válida, se compila el archivo independiente, sin barra y con su cabecera.

Cada pull request pasa por el CI del repositorio (`.github/workflows/ci.yml` en la raíz de `aprende`): `check`, `test` y
`build` de las guías, además de las pruebas de la app y de la web. El paquete sin conexión se publica con
`.github/workflows/paquete-sin-conexion.yml`.

## Cómo añadir o corregir una guía

El contenido vive en YAML, separado del código:

| Carpeta | Contiene |
|---------|----------|
| `src/content/platforms/` | Una ficha por marca: tipo de equipo (`deviceType`), sistema, modelos, cómo se guarda la configuración y redes de seguridad. |
| `src/content/concepts/` | Una tarea por archivo: qué es, riesgos y requisitos, comunes a todas las marcas. |
| `src/content/procedures/<marca>/<tarea>.yaml` | La guía de esa tarea en esa marca. |
| `src/content/fundamentals/` | Artículos de fundamentos. |

Una guía tiene estas partes, en este orden: `summary`, `risk`, `params`, `preflight`, `steps`, `verification`,
`rollback`, `sources` y `status`. Copia una guía parecida de la misma marca como punto de partida.

Reglas que comprueba `npm test`:

- Todo `{{param}}` usado en comandos o textos tiene que estar declarado en `params`.
- Un paso sin comandos lleva `manual: true`; en las marcas gestionadas por web, todos los pasos son manuales.
- Un parámetro que pida contraseñas, claves o comunidades tiene que ser de tipo `secret`.
- Toda guía tiene riesgo, fuentes y vuelta atrás. Restaurar, LAG, IP de gestión, firmware y ACL de gestión son
  siempre de riesgo alto.
- `lab-tested` exige una nota que diga dónde se probó.

Para subir una guía de nivel:

1. **Sin verificar → Contrastada:** confirma cada comando en la documentación oficial y añade la fuente en `sources`.
2. **Contrastada → Probada:** ejecútala completa, incluida la vuelta atrás, en un equipo de laboratorio. Actualiza
   `status.level`, `status.reviewed`, `status.firmware` y `status.notes`.

Los textos de la interfaz y del contenido se escriben en español de España; el código y los mensajes de commit, en
inglés con [Conventional Commits](https://www.conventionalcommits.org/es/).

## Estructura del código

| Ruta | Responsabilidad |
|------|-----------------|
| `src/domain/` | Esquema del contenido, carga del catálogo, generación de comandos y validación de valores. |
| `src/features/` | Pantallas: navegación, guía, ficha de marca, fundamentos, estado y planificador de red. |
| `src/ui/` | Componentes reutilizables. |
| `src/lib/` | Rutas por hash, estado guardado en el navegador y portapapeles. |
| `odd/tasks/` | Seguimiento de cada funcionalidad: requisitos, tareas y registro de decisiones. |

El historial de versiones está en [CHANGELOG.md](CHANGELOG.md).
