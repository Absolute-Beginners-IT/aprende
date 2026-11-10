---
title: "Firewall: reglas, NAT y doble WAN"
description: "Cómo decide un firewall qué pasa y qué no, cómo traduce direcciones para salir a Internet y qué cambia cuando tienes dos líneas."
weight: 3
equipo: "firewall"
duracion: "50 min"
nivel: "Intermedio"
objetivos:
  - "Leer y escribir reglas de firewall con origen, destino, puerto y acción."
  - "Aplicar la denegación por defecto y entender el orden de las reglas."
  - "Distinguir el NAT de salida de la redirección de puertos."
  - "Conocer los modos de doble WAN y sus efectos secundarios."
requisitos:
  - "Sala «VLAN y subredes»"
---

{{% tarea n="1" titulo="Qué mira una regla" %}}
El **firewall** es el portero de la red: está entre Internet y la red interna, y en una pyme también **entre las VLAN**. Por cada conexión mira sus datos y busca una regla que encaje. Una regla tiene, como mínimo:

| Campo | Qué indica | Ejemplo |
| --- | --- | --- |
| **Origen** | Desde dónde viene. | `192.168.10.0/24` (VLAN de usuarios) |
| **Destino** | Adónde va. | `192.168.50.30` (servidor de ficheros) |
| **Servicio** | Protocolo y puerto. | TCP 445 (SMB, carpetas compartidas) |
| **Acción** | Qué hacer. | Permitir o denegar |

Algunos puertos que verás a menudo en las reglas:

| Servicio | Protocolo y puerto |
| --- | --- |
| DNS | UDP y TCP 53 |
| HTTPS | TCP 443 |
| SMB (carpetas compartidas de Windows) | TCP 445 |
| RDP (escritorio remoto) | TCP 3389 |
| SSH | TCP 22 |

{{< pregunta texto="¿Qué puerto TCP tiene que permitir la regla para que los usuarios abran las carpetas compartidas por SMB?" respuesta="445|tcp 445|tcp/445" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Orden y denegación por defecto" %}}
En la mayoría de firewalls, las reglas se leen **de arriba abajo** y se aplica **la primera que encaja**; las de debajo ya no se miran. Al final de todo hay una regla implícita: **denegar todo lo demás**.

Esa es la política correcta, la **denegación por defecto**: se bloquea todo y solo se abre lo que hace falta, con la regla más concreta posible. Un ejemplo para la VLAN de usuarios:

| # | Origen | Destino | Servicio | Acción |
| --- | --- | --- | --- | --- |
| 1 | VLAN 10 | `SRV-DC01` (`192.168.50.10`) | DNS, Kerberos, LDAP… | Permitir |
| 2 | VLAN 10 | Servidor de ficheros | TCP 445 | Permitir |
| 3 | VLAN 10 | VLAN 99 (gestión) | Cualquiera | Denegar |
| 4 | VLAN 10 | Internet | HTTP, HTTPS | Permitir |
| — | Cualquiera | Cualquiera | Cualquiera | Denegar (implícita) |

{{< aviso titulo="La distinción que importa" >}}
Una regla «permitir cualquiera a cualquiera» puesta «solo para probar» suele quedarse años. Si algo no funciona, mira el **registro** (*log*) del firewall para ver qué se bloquea y abre exactamente eso. Y pon a cada regla una descripción: dentro de un año no recordarás por qué existe.
{{< /aviso >}}

{{< pregunta texto="¿Cómo se llama la política de bloquear todo lo que no esté permitido expresamente?" respuesta="denegacion por defecto|denegar por defecto|default deny|deny all|denegar todo" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Firewall con estado" %}}
Los firewalls de empresa son **con estado** (*stateful*): recuerdan cada conexión que han dejado pasar. Si un PC de la VLAN 10 abre una conexión HTTPS hacia Internet y la regla lo permite, las **respuestas** del servidor web vuelven solas, sin necesitar una regla «de Internet hacia la VLAN 10».

Por eso las reglas se escriben en el sentido en que **empieza** la conexión, y normalmente en la interfaz por la que **entra** ese tráfico al firewall (en el ejemplo, la de la VLAN de usuarios).

{{< pregunta texto="En un firewall con estado, ¿hace falta una regla aparte para el tráfico de vuelta de una conexión permitida? (sí/no)" respuesta="no" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="NAT: salir a Internet y publicar servicios" %}}
Ya sabes que las IP privadas no circulan por Internet. El firewall usa **NAT** (*Network Address Translation*, traducción de direcciones) en dos sentidos:

| Tipo | Qué hace | Ejemplo |
| --- | --- | --- |
| **NAT de salida** (de origen, también llamado enmascaramiento) | Cambia la IP privada del equipo por la **IP pública** del firewall al salir. | `192.168.10.25` navega como `203.0.113.10`. |
| **Redirección de puertos** (NAT de destino, *port forwarding*) | Lo que llega a un puerto de la IP pública se reenvía a un servidor interno. | `203.0.113.10:443` → `192.168.50.40:443` (una web interna). |

El NAT de salida suele venir configurado de serie. La redirección de puertos, en cambio, **expone un servidor a todo Internet**: publica solo lo imprescindible y nunca servicios como RDP o SMB.

(Las direcciones `203.0.113.x` están reservadas para documentación; en tu empresa verás la IP pública que da la operadora).

Pulsa el botón para seguir una conexión desde internet hasta una web publicada con redirección de puertos:

{{< recorrido datos="publicar-web" >}}

{{< pregunta texto="¿Cómo se llama la regla que envía las conexiones que llegan a un puerto de la IP pública hacia un servidor interno?" respuesta="redireccion de puertos|port forwarding|reenvio de puertos|nat de destino|dnat|port forward" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Doble WAN" %}}
En el mapa de referencia hay dos líneas: la **fibra principal** y una **línea de respaldo** (4G/5G o una segunda fibra). Cada salida a Internet se llama **WAN**. Hay dos formas de usarlas:

| Modo | Cómo funciona |
| --- | --- |
| **Failover** (conmutación por error, activo-pasivo) | Todo sale por la principal. El firewall vigila una IP externa (con ping, por ejemplo) y, si deja de responder, pasa el tráfico a la de respaldo. |
| **Balanceo** (activo-activo) | Reparte las conexiones entre las dos líneas y, si una cae, todo va por la otra. |

Lo que se olvida al cambiar de línea:

- La **IP pública cambia**: las redirecciones de puertos y las VPN configuradas contra la IP de la fibra dejan de funcionar por la otra, salvo que las hayas preparado también para la segunda WAN.
- Los servicios que filtran por IP de origen (un proveedor que solo admite la IP de tu oficina) te rechazarán.
- Si **no la pruebas**, no sabes si funciona. Desenchufa la principal en una ventana de mantenimiento y comprueba.

Si montaste el laboratorio de la sala anterior: añade en la interfaz de usuarios una regla que permita ICMP hacia `192.168.50.10` y repite el ping. Si sigue fallando, comprueba que `SRV-DC01` tiene como puerta de enlace `192.168.50.1` (si no, sus respuestas no vuelven por el firewall) y recuerda que el propio firewall de Windows de `SRV-DC01` puede estar bloqueando el ping.

{{< pregunta texto="¿Cómo se llama el modo de doble WAN en el que la segunda línea solo se usa si cae la principal?" respuesta="failover|conmutacion por error|activo-pasivo|activo pasivo|respaldo" >}}
{{% /tarea %}}
