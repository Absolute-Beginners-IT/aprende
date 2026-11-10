---
title: "Red segmentada con VLAN (opcional)"
description: "Añade un firewall virtual, separa los puestos de los servidores y haz que el DHCP del dominio sirva a las dos redes."
weight: 3
equipo: "firewall"
duracion: "1,5–2 h"
nivel: "Intermedio"
objetivos:
  - "Montar un firewall virtual con una interfaz por red."
  - "Simular VLAN en el laboratorio con redes internas separadas."
  - "Servir DHCP a otra subred con un relay."
  - "Escribir reglas de firewall entre redes y comprobarlas."
requisitos:
  - "Sala «Dominio, DNS, DHCP y servidor de ficheros»"
  - "Módulo 5 (red de empresa)"
  - "1 GB de RAM libre para la VM del firewall"
---

Esta sala es **opcional**. Si tu ordenador va justo de memoria o prefieres centrarte en los servicios, sáltala: el resto del proyecto funciona en la red 192.168.50.0/24. Si la haces, tu laboratorio se parecerá mucho más a una empresa de verdad, y además tendrá salida a Internet a través de una puerta de enlace real en 192.168.50.1.

{{% tarea n="1" titulo="Cómo se simula una VLAN en el laboratorio" %}}
En una empresa, las VLAN viven en los **switches**: cada puerto de acceso pertenece a una VLAN y el enlace troncal hacia el firewall lleva todas las VLAN etiquetadas (lo viste en el módulo 5, switches y VLAN). En tu laboratorio no hay switch físico, así que usarás un truco equivalente:

| En la empresa | En tu laboratorio |
| --- | --- |
| VLAN 50 (Servidores) | Red interna del hipervisor llamada `lab-servidores` |
| VLAN 10 (Puestos) | Red interna llamada `lab-puestos` |
| Puerto de acceso de un equipo | Adaptador de red de la VM conectado a una de esas redes |
| Troncal hacia el firewall | Una interfaz del firewall en cada red interna |

Cada red interna se comporta como una VLAN: las máquinas de una no ven las de la otra si no pasan por el firewall. Si usas Proxmox VE con un puente «VLAN aware», o Hyper-V, puedes usar etiquetas 802.1Q de verdad; el resultado es el mismo.

{{< pregunta texto="¿Cómo se llama el enlace que lleva varias VLAN etiquetadas entre un switch y el firewall?" respuesta="troncal|trunk|enlace troncal|un troncal|puerto troncal" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Instala el firewall FW01" %}}
Crea una VM con **1 CPU, 1 GB de RAM, 16 GB de disco** y **tres adaptadores de red**:

| Adaptador | Conectado a | Interfaz en el firewall | IP |
| --- | --- | --- | --- |
| 1 | NAT | WAN | Por DHCP de tu hipervisor |
| 2 | Red interna `lab-servidores` | LAN (Servidores) | 192.168.50.1/24 |
| 3 | Red interna `lab-puestos` | OPT1 (Puestos) | 192.168.10.1/24 |

Instala **pfSense CE** u **OPNsense** desde su web oficial. Desde la consola del firewall:

1. Opción **Assign Interfaces**: asigna cada adaptador a WAN, LAN y OPT1 según la tabla (fíjate en las MAC para no confundirlos).
2. Opción **Set interface(s) IP address**: pon 192.168.50.1/24 en LAN y 192.168.10.1/24 en OPT1. Cuando te pregunte si quieres activar el servidor DHCP del firewall, responde **que no**: el DHCP de la empresa es `SRV-DC01`.

Conecta los adaptadores de `SRV-DC01`, `SRV-FS01` y `SRV-MON01` a `lab-servidores`. Entra en la web del firewall desde `SRV-DC01` (`https://192.168.50.1`), completa el asistente y **cambia la contraseña por defecto** antes de nada. Renombra OPT1 como `PUESTOS`.

**Cómo sabes que está bien:** desde `SRV-DC01`, `Test-NetConnection 192.168.50.1 -Port 443` devuelve `TcpTestSucceeded : True` y `Resolve-DnsName www.example.com` ya responde, porque el reenviador DNS por fin tiene salida. Cuando lo tengas, marca la tarea.
{{% /tarea %}}

{{% tarea n="3" titulo="DHCP para la VLAN de puestos" %}}
El DHCP funciona con mensajes de **difusión** (broadcast), y las difusiones no atraviesan el firewall. Para que `SRV-DC01` reparta direcciones en la VLAN 10 hacen falta dos cosas:

1. **Un ámbito para esa subred** en `SRV-DC01`:

```
Add-DhcpServerv4Scope -Name "VLAN10-Puestos" -StartRange 192.168.10.100 -EndRange 192.168.10.199 -SubnetMask 255.255.255.0 -State Active
Set-DhcpServerv4OptionValue -ScopeId 192.168.10.0 -Router 192.168.10.1 -DnsServer 192.168.50.10 -DnsDomain "lab.example.com"
```

2. **Un relay DHCP** en el firewall, que recoge la difusión en `PUESTOS` y la reenvía a 192.168.50.10. En pfSense está en **Services → DHCP Relay**: actívalo, elige la interfaz `PUESTOS` y pon como destino `192.168.50.10`. pfSense solo permite el relay si su propio servidor DHCP está desactivado en **todas** las interfaces; en OPNsense se configura por interfaz.

El servidor sabe qué ámbito usar porque el relay le indica desde qué red llega la petición.

**Cómo sabes que está bien:** conecta un puesto de prueba a `lab-puestos` (un Windows 11 de evaluación o cualquier ISO «live» de Linux). Debe recibir una IP entre 192.168.10.100 y .199, y en `SRV-DC01` la concesión aparece con:

```
Get-DhcpServerv4Lease -ScopeId 192.168.10.0
```

{{< pregunta texto="¿Qué puerta de enlace recibe un puesto conectado a la VLAN 10?" respuesta="192.168.10.1" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Reglas entre redes" %}}
En pfSense, una interfaz nueva como `PUESTOS` **no tiene ninguna regla**, así que bloquea todo el tráfico que entra por ella. Ve a **Firewall → Rules → PUESTOS** y crea, en este orden:

| Orden | Acción | Origen | Destino | Para qué |
| --- | --- | --- | --- | --- |
| 1 | Block | PUESTOS subnets | 192.168.99.0/24 | Los puestos no ven la red de gestión |
| 2 | Pass | PUESTOS subnets | Any | Servidores e Internet permitidos |

Las reglas se evalúan **de arriba abajo y gana la primera que coincide**. Si pusieras la regla «Pass a Any» en primer lugar, el bloqueo de la red de gestión nunca llegaría a aplicarse.

Pulsa cada etapa para seguir dos paquetes por las reglas:

{{< evolucion datos="reglas-firewall" >}}

{{< aviso titulo="La distinción que importa" >}}
Esta es una política sencilla para aprender. En producción irías más allá: de puestos a servidores permitirías solo los puertos que hacen falta (DNS, Kerberos, LDAP, SMB…) y registrarías lo bloqueado. Empieza abierto y controlado; endurece cuando sepas qué tráfico es normal, que es justo lo que te dará la monitorización.
{{< /aviso >}}

{{< pregunta texto="En pfSense, cuando varias reglas coinciden con un paquete, ¿se aplica la primera o la última?" respuesta="la primera|primera|la primera que coincide" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Comprueba la segmentación" %}}
Desde el puesto de prueba de la VLAN 10, comprueba que llega a lo que debe:

```
nslookup srv-fs01.lab.example.com 192.168.50.10
Test-NetConnection srv-fs01.lab.example.com -Port 445
Test-NetConnection 1.1.1.1 -Port 443
```

(Desde un Linux «live», usa `nslookup` y `ping`.) Y, para ver que el firewall está trabajando, edita la regla de bloqueo, marca **Log packets that are handled by this rule** (las reglas que creas no registran nada si no lo activas) y mira **Status → System Logs → Firewall** en pfSense mientras intentas llegar a una dirección de 192.168.99.0/24: aparecerán los bloqueos.

Checklist del hito:

1. Los servidores están en `lab-servidores` y salen a Internet por 192.168.50.1.
2. Un puesto en `lab-puestos` recibe IP de `SRV-DC01` a través del relay.
3. El puesto resuelve nombres del dominio y llega a `SRV-FS01` por el puerto 445.
4. El tráfico hacia la red de gestión aparece como bloqueado en el registro.

Actualiza el mapa de la primera sala con `FW01` y sus tres redes, haz una instantánea de todas las VM y marca la tarea.
{{% /tarea %}}
