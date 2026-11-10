---
title: "Switches: puertos y tabla MAC"
description: "Qué hace de verdad un switch, cómo aprende dónde está cada equipo y para qué sirve cada tipo de puerto."
weight: 1
equipo: "switch"
duracion: "35 min"
nivel: "Inicial"
objetivos:
  - "Explicar cómo un switch aprende y usa la tabla MAC."
  - "Distinguir puertos de acceso, troncales y uplinks."
  - "Entender por qué un bucle tumba una red y qué lo evita."
requisitos:
  - "Módulo 1 (redes)"
  - "Sala «Qué hay en una infraestructura»"
---

{{% tarea n="1" titulo="Qué hace un switch: la tabla MAC" %}}
Un **switch** conecta los equipos de una misma red local: puestos, impresoras, servidores, puntos de acceso wifi. A diferencia de un router, no mira direcciones IP, sino **direcciones MAC**: el identificador físico de cada tarjeta de red (por ejemplo, `00-1A-2B-3C-4D-5E`).

Para saber por qué puerto mandar cada trama (el «paquete» de Ethernet), el switch va rellenando una **tabla MAC**:

1. Llega una trama por el puerto 5 con **MAC de origen** `AA-AA-…`.
2. El switch apunta: «`AA-AA-…` está detrás del puerto 5».
3. Cuando alguien envíe algo **a** `AA-AA-…`, el switch lo mandará solo por el puerto 5.

| MAC | Puerto | VLAN |
| --- | --- | --- |
| `00-1A-2B-3C-4D-5E` | 5 | 10 |
| `00-50-56-AB-12-34` | 24 | 50 |

Las entradas caducan si un equipo deja de hablar durante un tiempo (suele ser unos minutos), así que la tabla se mantiene al día sola. En algunos fabricantes también la verás como **tabla CAM**.

Pulsa cada etapa para ver cómo la rellena, trama a trama:

{{< evolucion datos="tabla-mac" >}}

{{< pregunta texto="¿Cómo se llama la tabla donde el switch apunta qué dirección MAC hay detrás de cada puerto?" respuesta="tabla mac|tabla de direcciones mac|mac address table|tabla cam|cam" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Lo que el switch no conoce" %}}
¿Y si llega una trama para una MAC que todavía no está en la tabla? El switch no la tira: la envía por **todos los puertos menos por el que entró**. Esto se llama **inundación** (*flooding*). El equipo correcto responderá y, con esa respuesta, el switch aprenderá dónde está.

Lo mismo pasa con el **broadcast** (difusión): las tramas dirigidas a `FF-FF-FF-FF-FF-FF`, como las peticiones ARP o DHCP que viste en el módulo 1, salen siempre por todos los puertos.

{{< aviso titulo="La distinción que importa" >}}
Un switch reparte el tráfico **dentro** de una red. Para ir de una red a otra (por ejemplo, de `192.168.10.0/24` a `192.168.50.0/24`) hace falta un **router**, un firewall o un switch de capa 3. Lo verás en la siguiente sala.
{{< /aviso >}}

{{< pregunta texto="¿Cómo se llama el envío de una trama por todos los puertos excepto por el que entró?" respuesta="inundacion|flooding|inundar" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Puertos de acceso, troncales y uplinks" %}}
En un switch **gestionable** (los que tienen interfaz de administración; los de escritorio sin gestión no permiten nada de esto) cada puerto tiene un papel:

| Tipo de puerto | Qué conecta | Qué transporta |
| --- | --- | --- |
| **Acceso** | Un equipo final: PC, impresora, cámara. | Una sola VLAN, sin etiquetar. El equipo no sabe que existe. |
| **Troncal** (*trunk*) | Otro switch, un punto de acceso wifi, un hipervisor o el firewall. | Varias VLAN por el mismo cable, cada trama con su etiqueta. |
| **Uplink** | El enlace «hacia arriba»: del switch de planta al switch core. | Normalmente es un troncal, y suele ser el puerto más rápido (por ejemplo, de fibra). |

Un esquema típico de pyme, como el del mapa de referencia: los **switches de acceso** de cada planta suben por su uplink al **switch core**, y el core conecta con el firewall y los servidores.

```
             Firewall
                |  troncal
           Switch core
          /     |      \      uplinks (troncales)
   Planta 1  Planta 2  Puntos de acceso wifi
     |  |      |  |
    PCs (puertos de acceso)
```

Muchos switches de acceso también dan **PoE** (*Power over Ethernet*): alimentan por el propio cable a teléfonos IP, cámaras y puntos de acceso.

{{< pregunta texto="¿Cómo se llama el puerto que transporta varias VLAN por el mismo cable?" respuesta="troncal|puerto troncal|trunk|puerto trunk" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Bucles, STP y enlaces agregados" %}}
Si conectas dos switches con **dos cables** «por si uno falla», creas un **bucle**. Si nada lo impide (lo verás en la tabla de abajo), un broadcast entra por un cable, vuelve por el otro y da vueltas sin fin, multiplicándose. En segundos la red se satura (**tormenta de broadcast**) y deja de funcionar. Pasa también cuando alguien enchufa un latiguillo con los dos extremos en la misma roseta.

Hay dos herramientas para tener redundancia sin bucles:

| Herramienta | Qué hace |
| --- | --- |
| **STP** (*Spanning Tree Protocol*) y su versión rápida **RSTP** | Los switches se ponen de acuerdo y **bloquean** los enlaces sobrantes. Si cae el activo, desbloquean otro. |
| **Agregación de enlaces** (**LACP**) | Une varios cables en **un único enlace lógico**: suma su capacidad y, si cae uno, siguen los demás. Tiene que configurarse en los dos extremos. |

Regla práctica: no desactives STP en una red de empresa, aunque «la red vaya más rápida» sin él.

{{< pregunta texto="¿Qué protocolo bloquea los enlaces redundantes entre switches para evitar bucles?" respuesta="stp|spanning tree|spanning tree protocol|rstp" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Míralo desde tu equipo" %}}
No necesitas un switch gestionable para ver estas ideas. Desde tu PC o tu laboratorio, en PowerShell:

```
Get-NetAdapter | Select-Object Name, MacAddress, LinkSpeed
arp -a
```

- El primer comando muestra **tu MAC** y la **velocidad del enlace** con el switch (si ves `100 Mbps` en lugar de `1 Gbps`, sospecha del cable o del puerto).
- `arp -a` muestra la **tabla ARP** de tu equipo: qué MAC corresponde a cada IP con la que has hablado. Busca la de tu puerta de enlace.

No confundas las dos tablas: la **tabla ARP** está en los equipos y traduce IP a MAC; la **tabla MAC** está en el switch y relaciona MAC con puertos.

{{< pregunta texto="¿Qué comando de Windows muestra la tabla ARP del equipo?" respuesta="arp -a|arp -g" >}}
{{% /tarea %}}
