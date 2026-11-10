---
title: "DNS interno y DHCP"
description: "Gestiona las zonas y registros del DNS de tu dominio y monta un servidor DHCP con ámbito, opciones y reservas."
weight: 2
equipo: "router"
duracion: "50 min"
nivel: "Inicial"
objetivos:
  - "Distinguir zonas directas e inversas y los registros más habituales."
  - "Crear registros DNS y configurar reenviadores."
  - "Instalar y autorizar un servidor DHCP en Active Directory."
  - "Configurar un ámbito con exclusiones, opciones y reservas."
requisitos:
  - "Sala «Active Directory: tu primer dominio»"
  - "Sala «Puerta de enlace, DNS y DHCP»"
---

{{% tarea n="1" titulo="El DNS de tu dominio" %}}
Al promover SRV-DC01 instalaste también el servidor DNS. Ya lo conoces del módulo 1: traduce nombres en direcciones IP. Ahora vas a ver cómo se organiza por dentro.

Un servidor DNS guarda la información en **zonas**:

| Zona | Qué resuelve | En tu laboratorio |
| --- | --- | --- |
| **Directa** | De nombre a IP. | `lab.example.com` (se creó sola al promover el servidor). |
| **Inversa** | De IP a nombre. | `50.168.192.in-addr.arpa`, que crearás en la siguiente tarea. |

Las zonas de tu dominio están **integradas en Active Directory**: se guardan dentro de AD y se copian solas a cada controlador de dominio nuevo. Dentro de cada zona viven los **registros**:

| Registro | Para qué sirve | Ejemplo |
| --- | --- | --- |
| **A** | Nombre → IPv4. | `srv-dc01` → `192.168.50.10` |
| **PTR** | IPv4 → nombre (en la zona inversa). | `192.168.50.10` → `srv-dc01` |
| **CNAME** | Un alias que apunta a otro nombre. | `intranet` → `srv-lnx01` |
| **SRV** | Dónde está un servicio. AD los usa para que los equipos encuentren los controladores de dominio. | `_ldap._tcp…` → `srv-dc01` |
| **MX** | Qué servidor recibe el correo de un dominio. | `example.com` → servidor de correo |

Lista las zonas del servidor y los registros de tu dominio:

```
Get-DnsServerZone
Get-DnsServerResourceRecord -ZoneName "lab.example.com"
```

{{< pregunta texto="¿Qué tipo de registro usan los equipos para encontrar los controladores de dominio?" respuesta="srv|registro srv|el registro srv" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Crea registros y una zona inversa" %}}
Crea la zona inversa de tu red. `-ReplicationScope "Domain"` la integra en AD, como la zona directa:

```
Add-DnsServerPrimaryZone -NetworkId "192.168.50.0/24" -ReplicationScope "Domain"
```

Ahora da nombre al servidor Ubuntu del módulo 2. Aquí lo llamamos `srv-lnx01`; usa el nombre que le pusiste. `-CreatePtr` crea a la vez su registro PTR en la zona inversa:

```
Add-DnsServerResourceRecordA -ZoneName "lab.example.com" -Name "srv-lnx01" -IPv4Address "192.168.50.20" -CreatePtr
Add-DnsServerResourceRecordCName -ZoneName "lab.example.com" -Name "intranet" -HostNameAlias "srv-lnx01.lab.example.com"
```

Comprueba que resuelven, en los dos sentidos:

```
Resolve-DnsName srv-lnx01.lab.example.com
Resolve-DnsName intranet.lab.example.com
Resolve-DnsName 192.168.50.20
```

¿Y los nombres de Internet, como `www.example.com`? Tu DNS no los conoce, así que se los pregunta a otro servidor DNS: un **reenviador** (*forwarder*), normalmente el de tu proveedor o uno público. Si tu laboratorio tiene salida a Internet, configúralo así:

```
Add-DnsServerForwarder -IPAddress 1.1.1.1
Get-DnsServerForwarder
```

Pulsa el botón para seguir una consulta que tu DNS no conoce, paso a paso:

{{< recorrido datos="dns-reenviador" >}}

{{< aviso titulo="La distinción que importa" >}}
En una red con Active Directory, **todos** los equipos deben usar como DNS los controladores de dominio, nunca un DNS público directamente. Si un portátil usa `8.8.8.8`, navegará por Internet, pero no encontrará el dominio: fallarán el inicio de sesión, las directivas y las carpetas compartidas. Lo público lo resuelve el reenviador.
{{< /aviso >}}

{{< pregunta texto="¿Cómo se llama el servidor DNS al que el tuyo pregunta los nombres que no conoce?" respuesta="reenviador|un reenviador|el reenviador|forwarder|reenviadores" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Instala y autoriza el servidor DHCP" %}}
Antes de nada, revisa la red de la VM. Un DHCP solo debe repartir direcciones en la red del laboratorio:

- **Nunca** en modo puente: repartiría direcciones a los equipos reales de tu casa o de tu oficina.
- Usa **red interna**. Si usas una red NAT del hipervisor que ya trae su propio DHCP, desactívalo en la configuración de esa red: dos servidores DHCP repartiendo en la misma red es un problema clásico.

Instala el rol:

```
Install-WindowsFeature DHCP -IncludeManagementTools
```

En un dominio, un servidor DHCP de Windows no reparte direcciones hasta que alguien lo **autoriza** en Active Directory. Es una protección: así un servidor DHCP instalado por error no se pone a repartir IPs a toda la empresa.

```
Add-DhcpServerInDC -DnsName "srv-dc01.lab.example.com" -IPAddress 192.168.50.10
Get-DhcpServerInDC
```

Por último, crea los grupos locales que usa el servicio para delegar su administración y reinícialo:

```
netsh dhcp add securitygroups
Restart-Service DHCPServer
```

El Administrador del servidor seguirá mostrando un aviso para «completar la configuración de DHCP». Puedes abrirlo y terminar el asistente: hace lo mismo que acabas de hacer (crear los grupos y autorizar el servidor).

{{< pregunta texto="¿Qué cmdlet autoriza un servidor DHCP en Active Directory?" respuesta="add-dhcpserverindc" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Ámbitos, exclusiones y opciones" %}}
Un **ámbito** (*scope*) es el rango de direcciones que el servidor puede repartir en una red, junto con su configuración. Planifica tu red antes de crearlo:

| Rango | Uso |
| --- | --- |
| `192.168.50.1` – `192.168.50.99` | IP fijas configuradas a mano: puerta de enlace, servidores, equipos de red. El DHCP no las toca. |
| `192.168.50.100` – `192.168.50.199` | Ámbito DHCP: ordenadores de los usuarios y, con reserva, impresoras. |

Crea el ámbito con una concesión de 8 días (el tiempo durante el que el equipo puede usar la IP antes de renovarla):

```
Add-DhcpServerv4Scope -Name "LAB-Clientes" -StartRange 192.168.50.100 -EndRange 192.168.50.199 -SubnetMask 255.255.255.0 -LeaseDuration 8.00:00:00 -State Active
```

Si dentro del ámbito hay direcciones que no quieres repartir, crea una **exclusión**:

```
Add-DhcpServerv4ExclusionRange -ScopeId 192.168.50.0 -StartRange 192.168.50.190 -EndRange 192.168.50.199
```

Además de la IP, el DHCP entrega **opciones**. Cada una tiene un número:

| Opción | Qué entrega |
| --- | --- |
| **003** | La puerta de enlace (*router*). |
| **006** | Los servidores DNS. |
| **015** | El nombre del dominio DNS. |

```
Set-DhcpServerv4OptionValue -ScopeId 192.168.50.0 -Router 192.168.50.1 -DnsServer 192.168.50.10 -DnsDomain "lab.example.com"
Get-DhcpServerv4OptionValue -ScopeId 192.168.50.0
```

Fíjate en que el ámbito se identifica por la dirección de su red, `192.168.50.0`.

{{< pregunta texto="¿Qué número de opción DHCP entrega la puerta de enlace?" respuesta="003|3|opcion 003|opcion 3" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Reservas y concesiones" %}}
Una **reserva** hace que el DHCP entregue siempre la misma IP a un equipo concreto, que identifica por su **dirección MAC** (la dirección física de su tarjeta de red). Es la forma cómoda de dar una IP estable a una impresora sin configurarla a mano:

```
Add-DhcpServerv4Reservation -ScopeId 192.168.50.0 -IPAddress 192.168.50.150 -ClientId "00-15-5D-01-02-03" -Name "IMP-PLANTA1" -Description "Impresora de la planta 1"
Get-DhcpServerv4Reservation -ScopeId 192.168.50.0
```

La IP de la reserva debe estar dentro del rango del ámbito (`.100` a `.199`). Cambia la MAC del ejemplo por la de un equipo real de tu laboratorio, o déjala así para practicar: la reserva se crea igual, aunque ningún equipo la use.

Para ver qué equipos tienen ahora mismo una IP del ámbito, consulta las **concesiones**:

```
Get-DhcpServerv4Lease -ScopeId 192.168.50.0
```

Si tienes una VM cliente en la misma red interna, configúrala en automático y, en Windows, ejecuta `ipconfig /release` y luego `ipconfig /renew`: debería recibir una IP del ámbito, la puerta de enlace y el DNS `192.168.50.10`.

Así consigue el cliente su IP, mensaje a mensaje:

{{< recorrido datos="dhcp" >}}

{{< pregunta texto="¿Qué dato del equipo usa una reserva DHCP para reconocerlo?" respuesta="mac|direccion mac|la mac|la direccion mac" >}}
{{% /tarea %}}
