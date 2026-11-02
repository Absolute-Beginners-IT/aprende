---
title: "VPN: teletrabajo y entre sedes"
description: "Conecta a quien trabaja desde casa y une oficinas a través de Internet sin exponer la red interna."
weight: 5
equipo: "nube"
duracion: "45 min"
nivel: "Intermedio"
objetivos:
  - "Distinguir una VPN de acceso remoto de una VPN sitio a sitio."
  - "Reconocer los protocolos habituales: IPsec, VPN SSL/TLS y WireGuard."
  - "Configurar el teletrabajo con criterio: MFA, túnel dividido o completo y permisos mínimos."
  - "Evitar subredes solapadas y diagnosticar una VPN que conecta pero no funciona."
requisitos:
  - "Sala «Firewall: reglas, NAT y doble WAN»"
  - "Sala «Herramientas de diagnóstico» (módulo 1)"
---

{{% tarea n="1" titulo="Qué es una VPN y de qué tipos hay" %}}
Una **VPN** (*Virtual Private Network*, red privada virtual) crea un **túnel cifrado** a través de Internet. Lo que viaja dentro no se puede leer ni modificar por el camino, y los equipos de los dos extremos se comportan como si estuvieran en la misma red privada.

En una empresa verás dos tipos:

| Tipo | Qué une | Quién la inicia | Ejemplo |
| --- | --- | --- | --- |
| **Acceso remoto** | Un dispositivo con la red de la empresa. | El usuario, con un cliente VPN en su portátil. | Teletrabajo: abrir el ERP desde casa. |
| **Sitio a sitio** | Dos redes enteras (dos sedes). | Los firewalls de cada sede, de forma permanente. | La delegación de Valencia accede a los servidores de la central. |

En la VPN sitio a sitio, los usuarios no instalan nada: para ellos, el servidor de la otra sede «simplemente está ahí».

{{< pregunta texto="¿Qué tipo de VPN une de forma permanente las redes de dos oficinas?" respuesta="sitio a sitio|site to site|site-to-site|vpn sitio a sitio|lan to lan" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Protocolos habituales" %}}
No necesitas saber cómo cifran por dentro, pero sí reconocerlos, porque condicionan qué puertos abrir y qué cliente instalar:

| Protocolo | Dónde se usa | Qué abre en el firewall |
| --- | --- | --- |
| **IPsec** (normalmente con **IKEv2** para negociar las claves) | El estándar de las VPN **sitio a sitio**, sobre todo entre firewalls de fabricantes distintos. También para acceso remoto. | UDP 500 y UDP 4500 (este último cuando hay NAT por el camino); sin NAT, además, el protocolo ESP (protocolo IP 50). |
| **VPN SSL/TLS** (por ejemplo, OpenVPN o las «SSL VPN» de los fabricantes) | Muy común en **acceso remoto**: cada fabricante suele tener su cliente. | Depende de la configuración; a menudo TCP o UDP 443, o UDP 1194 en OpenVPN. |
| **WireGuard** | Moderno y sencillo: cada extremo tiene un par de claves. Sirve para los dos tipos. | Un puerto UDP que eliges tú; 51820 es el que se usa habitualmente. |

Para que una VPN sitio a sitio funcione, los dos extremos tienen que coincidir en los parámetros: protocolo, cifrado, clave o certificados y **qué subredes** viajan por el túnel. Un fallo típico es que solo coincida una parte y el túnel «suba» pero no pase tráfico.

{{< pregunta texto="¿Qué protocolo es el más habitual para VPN sitio a sitio entre firewalls de distintos fabricantes?" respuesta="ipsec|ipsec ikev2" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Teletrabajo con criterio" %}}
La VPN de acceso remoto es una puerta a la red interna desde cualquier sitio, así que es un objetivo favorito de los atacantes. Lo mínimo:

1. **Usuarios nominales** contra el directorio de la empresa, nunca una cuenta compartida.
2. **MFA** (autenticación multifactor): además de la contraseña, un código o una aprobación en el móvil.
3. **Permisos mínimos**: reglas de firewall en la interfaz de la VPN que den a cada grupo solo lo que necesita (contabilidad, al ERP; los administradores, a la VLAN de gestión).
4. **Firmware al día** en el firewall: las vulnerabilidades de las VPN se explotan muy rápido tras publicarse.

Además, hay que decidir qué tráfico va por el túnel:

| Modo | Qué va por la VPN | A tener en cuenta |
| --- | --- | --- |
| **Túnel completo** (*full tunnel*) | Todo, también la navegación. | Más control, pero más carga para la línea de la oficina. |
| **Túnel dividido** (*split tunnel*) | Solo lo que va a las redes de la empresa. | Menos carga; el resto sale por la conexión de casa. |

{{< pregunta texto="¿Cómo se llama el modo en el que solo el tráfico hacia la empresa va por la VPN y el resto sale directo a Internet?" respuesta="split tunnel|split tunneling|tunel dividido|tunel partido" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="El problema de las subredes repetidas" %}}
Una VPN conecta redes, y para enrutar entre ellas **no pueden usar la misma subred**. Dos casos clásicos:

- **Sitio a sitio**: si la central y la delegación usan las dos `192.168.10.0/24`, ningún equipo sabe si `192.168.10.20` está en su oficina o en la otra. Cada sede necesita sus propios rangos (por ejemplo, la central `192.168.10.0/24` y la delegación `192.168.110.0/24`).
- **Teletrabajo**: muchos routers domésticos usan `192.168.0.0/24` o `192.168.1.0/24`. Si la oficina usa esas mismas redes, el portátil del teletrabajador no sabrá por dónde ir.

Por eso conviene evitar esos rangos tan comunes al diseñar la red de una empresa. Existen trucos para arreglarlo a posteriori (traducir direcciones dentro del túnel), pero complican mucho el diagnóstico.

{{< pregunta texto="¿Pueden la central y la delegación usar las dos la subred 192.168.10.0/24 en una VPN sitio a sitio, sin traducir direcciones? (sí/no)" respuesta="no" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Conecta pero no funciona" %}}
La incidencia más típica: «la VPN dice conectado, pero no llego al servidor». Aplica el método de dentro hacia fuera que ya conoces, ahora a través del túnel:

| Paso | Comprobación | Si falla, sospecha de… |
| --- | --- | --- |
| 1. ¿El cliente recibió IP de la VPN? | `ipconfig /all`: busca el adaptador de la VPN. | Configuración del cliente o del conjunto de direcciones de la VPN. |
| 2. ¿Hay ruta hacia la red de la empresa? | `route print` en Windows (`ip route` en Linux). | Túnel dividido mal definido o subredes solapadas. |
| 3. ¿Llego por IP? | `ping 192.168.50.10` | Reglas del firewall en la interfaz de la VPN. |
| 4. ¿Llego por nombre? | `nslookup SRV-DC01` | El DNS que entrega la VPN. |

{{< pregunta texto="Con la VPN conectada llegas a 192.168.50.10 por IP, pero no por el nombre SRV-DC01. ¿Qué servicio revisas?" respuesta="dns|el dns" >}}
{{% /tarea %}}
