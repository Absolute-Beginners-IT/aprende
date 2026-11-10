---
title: "VLAN y subredes"
description: "Separa la red por funciones aunque todos compartan los mismos switches, y haz que las VLAN se hablen solo por donde tú decidas."
weight: 2
equipo: "capas"
duracion: "50 min (más el laboratorio opcional)"
nivel: "Intermedio"
objetivos:
  - "Explicar qué es una VLAN y por qué se separa la red por funciones."
  - "Diseñar un plan sencillo de VLAN con una subred por VLAN."
  - "Entender el etiquetado 802.1Q en los puertos troncales."
  - "Saber dónde se enruta entre VLAN y por qué hace falta el DHCP relay."
requisitos:
  - "Sala «Switches: puertos y tabla MAC»"
  - "Sala «Direcciones IP y máscaras» (módulo 1)"
---

{{% tarea n="1" titulo="Qué es una VLAN" %}}
Una **VLAN** (*Virtual LAN*, red local virtual) divide un switch físico en varios switches lógicos. Los equipos de una VLAN solo se ven entre sí: sus broadcasts no llegan a las demás VLAN, aunque estén enchufados al mismo aparato.

¿Para qué separar?

| Motivo | Ejemplo |
| --- | --- |
| **Seguridad** | Si un portátil de la wifi de invitados está infectado, no llega a los servidores. |
| **Orden** | Cada función tiene su rango de IP: sabes qué es un equipo solo con mirar su dirección. |
| **Menos ruido** | Los broadcasts se quedan dentro de su VLAN en lugar de llegar a toda la empresa. |

Para que dos VLAN se comuniquen, el tráfico tiene que pasar por un **router** (en una pyme, casi siempre el firewall). Y eso es justo lo que queremos: un punto donde decidir qué se permite.

{{< pregunta texto="Un PC de la VLAN 10 y otro de la VLAN 20 están en el mismo switch. ¿Se comunican directamente, sin pasar por un router? (sí/no)" respuesta="no" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Una VLAN, una subred" %}}
La regla de oro: **cada VLAN tiene su propia subred IP** y su propia puerta de enlace. Este es el plan del mapa de referencia de la pyme, con un truco muy habitual: el número de VLAN coincide con el tercer octeto.

| VLAN | Función | Subred | Puerta de enlace |
| --- | --- | --- | --- |
| 10 | Usuarios (puestos e impresoras) | `192.168.10.0/24` | `192.168.10.1` |
| 20 | Wifi corporativa | `192.168.20.0/24` | `192.168.20.1` |
| 30 | Wifi de invitados | `192.168.30.0/24` | `192.168.30.1` |
| 50 | Servidores | `192.168.50.0/24` | `192.168.50.1` |
| 99 | Gestión (switches, firewall, SAI) | `192.168.99.0/24` | `192.168.99.1` |

Fíjate en que la VLAN 50 es la red de tu laboratorio: `SRV-DC01` en `192.168.50.10` sería un servidor más de esa VLAN.

La **VLAN de gestión** merece mención aparte: ahí van las interfaces de administración de los equipos de red. Solo deberían poder entrar los administradores, nunca la red de usuarios ni la de invitados.

{{< pregunta texto="Según el plan, ¿qué subred corresponde a la VLAN 30 de invitados?" respuesta="192.168.30.0/24|192.168.30.0" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="El etiquetado 802.1Q" %}}
Por un puerto de acceso pasa una sola VLAN, así que no hace falta marcar nada. Pero por un **troncal** viajan muchas: ¿cómo sabe el switch del otro lado a qué VLAN pertenece cada trama? Porque va **etiquetada**.

El estándar **IEEE 802.1Q** añade a la trama Ethernet una etiqueta de 4 bytes con el **identificador de VLAN** (VLAN ID). Ese campo tiene 12 bits, así que las VLAN válidas van de la **1 a la 4094** (la 0 y la 4095 están reservadas).

Muchos fabricantes lo configuran por puerto con dos palabras: *untagged* (sin etiquetar) y *tagged* (etiquetada). Un ejemplo genérico:

| Puerto | Conecta | VLAN sin etiquetar | VLAN etiquetadas |
| --- | --- | --- | --- |
| 1–20 | Puestos de la planta | 10 | — |
| 21 | Punto de acceso wifi | 99 | 20, 30 |
| 48 | Uplink al core | — | 10, 20, 30, 50, 99 |

En un troncal, la VLAN que viaja **sin etiqueta** se llama **VLAN nativa**. Tiene que coincidir en los dos extremos.

{{< aviso titulo="La distinción que importa" >}}
Acceso = una VLAN sin etiqueta, para equipos finales. Troncal = varias VLAN etiquetadas, para enlaces entre equipos de red. Si un PC acaba en un troncal o un AP en un puerto de acceso, «hay cable pero no hay red». Y evita usar la VLAN 1 (la que traen todos los puertos de fábrica) para nada importante.
{{< /aviso >}}

{{< pregunta texto="¿Qué estándar define la etiqueta de VLAN en las tramas Ethernet?" respuesta="802.1q|ieee 802.1q|dot1q" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Enrutar entre VLAN y el DHCP relay" %}}
Las VLAN se comunican a través de un equipo que tenga una «pata» (una IP de puerta de enlace) en cada una. Hay dos sitios habituales:

| Dónde | Cómo | Ventaja |
| --- | --- | --- |
| **En el firewall** | Un troncal hacia el firewall con una **subinterfaz** por VLAN (por ejemplo, `192.168.10.1` en la VLAN 10). | Todo el tráfico entre VLAN pasa por las reglas del firewall. Lo más común en pymes. |
| **En un switch de capa 3** | El switch core tiene una **interfaz virtual** por VLAN (en muchos fabricantes, SVI o interfaz `vlan`) y enruta él mismo. | Mucho más rendimiento. Pero el filtrado es más limitado (listas de acceso), así que se combina con el firewall. |

Hay un detalle que suele romper cosas: los clientes piden IP por **DHCP con un broadcast**, y los broadcasts no salen de su VLAN. Si el servidor DHCP está en la VLAN 50, la puerta de enlace de la VLAN 10 tiene que recoger esas peticiones y reenviárselas. Esa función se llama **DHCP relay** (en algunos fabricantes, *IP helper*).

Pulsa cada etapa para ver cómo se juntan las piezas de esta sala:

{{< evolucion datos="vlan-troncal" >}}

{{< pregunta texto="Los equipos de la VLAN 10 no reciben IP porque el servidor DHCP está en la VLAN 50. ¿Qué función hay que activar en la puerta de enlace de la VLAN 10?" respuesta="dhcp relay|relay dhcp|ip helper|ip helper-address|retransmision dhcp|agente de retransmision dhcp" pista="Es un reenvío: la puerta de enlace recoge el broadcast y lo manda al servidor." >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Laboratorio opcional: dos redes y un firewall" %}}
Si quieres verlo funcionar, monta un firewall virtual con **pfSense** u **OPNsense** (los dos son gratuitos y se instalan desde su ISO). En VirtualBox o Hyper-V, cada «VLAN» la simularás con una **red interna** distinta; en Proxmox puedes usar un puente con la opción *VLAN aware* y poner la etiqueta en la tarjeta de cada VM, que es etiquetado 802.1Q real.

1. Crea la VM del firewall con **tres adaptadores**: WAN en NAT, LAN en la red interna `servidores` y un tercero en la red interna `usuarios`.
2. Asigna `192.168.50.1/24` a la LAN y `192.168.10.1/24` a la interfaz de usuarios. Activa el servidor DHCP del firewall solo en la red de usuarios; en la LAN déjalo desactivado, porque ahí ya reparte direcciones tu `SRV-DC01` y dos DHCP en la misma red chocan.
3. Conecta una VM cliente a la red `usuarios` y comprueba que recibe una IP `192.168.10.x` con `ipconfig /all` o `ip a`.
4. Desde el cliente, haz `ping 192.168.50.10` (tu `SRV-DC01`). Lo normal es que **falle**: en estos firewalls, las interfaces nuevas no traen ninguna regla que permita tráfico. Apúntalo; lo arreglarás en la sala siguiente.

Haz una instantánea de las VMs cuando todo esté montado y marca la tarea.
{{% /tarea %}}
