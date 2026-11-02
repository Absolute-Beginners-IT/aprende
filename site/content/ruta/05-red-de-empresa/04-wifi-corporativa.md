---
title: "Wifi corporativa e invitados"
description: "Cómo se monta la wifi de una empresa: una red para la plantilla con credenciales personales y otra para invitados que solo da Internet."
weight: 4
equipo: "wifi"
duracion: "35 min"
nivel: "Inicial"
objetivos:
  - "Relacionar puntos de acceso, SSID y VLAN."
  - "Distinguir WPA2/WPA3-Personal de WPA2/WPA3-Enterprise."
  - "Aislar la wifi de invitados del resto de la red."
  - "Tener en cuenta bandas y canales al revisar la cobertura."
requisitos:
  - "Sala «VLAN y subredes»"
  - "Sala «Firewall: reglas, NAT y doble WAN»"
---

{{% tarea n="1" titulo="Puntos de acceso, SSID y VLAN" %}}
La wifi de una empresa no sale de un router doméstico, sino de varios **puntos de acceso** (AP, *access point*) repartidos por las plantas. Cada AP es, en el fondo, un switch sin cables: conecta los dispositivos inalámbricos a la red.

Cada red wifi que ven los usuarios tiene un nombre, el **SSID**. Un mismo AP puede emitir varios SSID a la vez, y cada uno se asocia a una **VLAN**:

| SSID | VLAN | Para quién |
| --- | --- | --- |
| `Empresa` | 20 (wifi corporativa) | Portátiles y móviles de la plantilla |
| `Empresa-Invitados` | 30 (invitados) | Visitas y dispositivos personales |

Por eso el AP se conecta a un **puerto troncal**: le llegan etiquetadas las VLAN 20 y 30, y su propia gestión va en la VLAN 99, como viste en la tabla de la sala de VLAN. Cuando hay muchos AP, se administran todos juntos desde un **controlador** (un equipo o un servicio en la nube) en lugar de uno por uno.

{{< pregunta texto="¿Cómo se llama el nombre de una red wifi que ven los usuarios al buscar redes?" respuesta="ssid" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Personal o Enterprise" %}}
La seguridad de la wifi se configura con **WPA2** o, mejor, **WPA3** (*Wi-Fi Protected Access*). Cada uno tiene dos modos, y la diferencia es enorme:

| Modo | Cómo se entra | Problema o ventaja |
| --- | --- | --- |
| **Personal** (PSK, *Pre-Shared Key*) | Una **contraseña compartida** por todos. WPA3-Personal usa un intercambio más robusto, llamado SAE. | Si se va alguien de la empresa, se lleva la clave; para quitarle el acceso hay que cambiarla en todos los dispositivos. |
| **Enterprise** (802.1X) | Cada persona entra con **sus credenciales** (usuario del dominio) o con un **certificado** en el equipo. Un servidor **RADIUS** comprueba quién es. | Das de baja la cuenta y pierde el acceso. Además, el registro dice quién se conectó y cuándo. |

El servidor RADIUS puede ser el rol **NPS** (Servidor de directivas de redes) de Windows Server, FreeRADIUS en Linux o un servicio del propio fabricante, normalmente consultando el directorio activo. Así, la wifi usa las mismas cuentas del Active Directory que montaste en el módulo 4.

{{< aviso titulo="La distinción que importa" >}}
La wifi **corporativa** debería ir en modo **Enterprise**. El modo Personal es aceptable para la de **invitados**, siempre que esa red esté aislada y la clave se cambie de vez en cuando.
{{< /aviso >}}

{{< pregunta texto="¿Qué modo de WPA2/WPA3 autentica a cada usuario con sus propias credenciales mediante un servidor RADIUS?" respuesta="enterprise|wpa2-enterprise|wpa3-enterprise|empresarial|802.1x" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="La wifi de invitados" %}}
La wifi de invitados es, para la red interna, **Internet con otro nombre**: no te fíes de nada de lo que se conecte a ella. Lo mínimo:

1. **VLAN propia** (la 30 del plan) y su propio DHCP.
2. **Reglas en el firewall**: la VLAN 30 solo puede salir a Internet. Una regla que deniegue el acceso a todas las redes privadas internas, y debajo, permitir salida a Internet.
3. **Aislamiento de clientes**: el AP impide que los dispositivos de invitados se vean entre sí, para que un móvil infectado no ataque al de al lado.
4. Opcional: un **portal cautivo** (la página de bienvenida que pide aceptar las condiciones o un código) y un **límite de ancho de banda** para que las visitas no saturen la línea.

```
Reglas de la interfaz VLAN 30 (invitados)
1. Permitir   VLAN 30 -> firewall       DNS (UDP/TCP 53)
2. Denegar    VLAN 30 -> 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
3. Permitir   VLAN 30 -> cualquiera     HTTP, HTTPS
```

{{< pregunta texto="¿Cómo se llama la opción del punto de acceso que impide que los dispositivos de la wifi de invitados se vean entre sí?" respuesta="aislamiento de clientes|aislamiento de cliente|client isolation|aislamiento|ap isolation" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Bandas, canales y cobertura" %}}
Cuando alguien dice «la wifi va mal», no siempre es culpa de la red de cable. Las bandas tienen comportamientos distintos:

| Banda | Alcance | Capacidad | Nota |
| --- | --- | --- | --- |
| **2,4 GHz** | Mayor, atraviesa mejor las paredes. | Menor y con más interferencias. | Con el ancho habitual de 20 MHz, solo hay **tres canales que no se solapan**: el 1, el 6 y el 11. |
| **5 GHz** | Menor. | Mucho mayor, con muchos más canales. | La banda principal en una oficina. |
| **6 GHz** | La menor. | La mayor. | Solo para dispositivos y AP compatibles con Wi-Fi 6E o posterior. |

Al revisar una incidencia de wifi, comprueba: a qué AP y banda está conectado el dispositivo, con qué intensidad de señal, y si dos AP cercanos usan el mismo canal. En Windows, `netsh wlan show interfaces` te enseña el SSID, el canal y la señal del equipo.

{{< pregunta texto="En la banda de 2,4 GHz, ¿qué tres canales no se solapan? (separados por comas)" respuesta="1,6,11|1, 6, 11|1 6 11" >}}
{{% /tarea %}}
