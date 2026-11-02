---
title: "Windows Server: primeros pasos"
description: "Instala un Windows Server en tu laboratorio y déjalo como lo dejaría un administrador: nombre, IP fija, roles y registros."
weight: 1
equipo: "servidor"
duracion: "45 min (más la instalación)"
nivel: "Inicial"
objetivos:
  - "Distinguir la instalación con escritorio de Server Core."
  - "Hacer la configuración inicial de un servidor con PowerShell."
  - "Instalar roles y consultar servicios y eventos."
requisitos:
  - "Sala «Monta tu laboratorio»"
  - "Módulo 1 (redes)"
---

{{% tarea n="1" titulo="Instala Windows Server" %}}
Crea una máquina virtual con **2 CPU, 4 GB de RAM y 60 GB de disco**, conéctala a una red de laboratorio `192.168.50.0/24` y arranca desde la ISO de evaluación. En VirtualBox, crea una **Red NAT** con ese rango: las VM se ven entre ellas, salen a Internet y VirtualBox pone la puerta de enlace en `192.168.50.1`. El modo **NAT** simple no sirve aquí, porque usa su propia red `10.0.2.0/24`.

El instalador te ofrece dos tipos de instalación:

| Tipo | Qué es | Cuándo se usa |
| --- | --- | --- |
| **Experiencia de escritorio** | Con interfaz gráfica, como un Windows normal. | Para aprender y en servidores que necesitan herramientas gráficas. |
| **Server Core** | Sin escritorio: solo consola y administración remota. | En producción: menos actualizaciones, menos consumo y menos superficie de ataque. |

Para esta ruta, elige **Experiencia de escritorio**. Al terminar, pon una contraseña robusta a la cuenta `Administrador`.

{{< pregunta texto="¿Cómo se llama la instalación de Windows Server sin escritorio gráfico?" respuesta="server core|core" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Configuración inicial: nombre e IP fija" %}}
Un servidor necesita un **nombre** que siga una convención (por ejemplo, `SRV-DC01`) y una **IP fija**: si su dirección cambiara, nadie lo encontraría. Abre **PowerShell como administrador**:

```
Rename-Computer -NewName "SRV-DC01" -Restart
```

Después del reinicio, mira el nombre de tu adaptador con `Get-NetAdapter` y asígnale la IP (ajusta los valores a tu laboratorio):

```
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.50.10 -PrefixLength 24 -DefaultGateway 192.168.50.1
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses 192.168.50.10
```

También puedes hacer todo esto desde el menú de texto `sconfig`, muy útil en Server Core.

{{< pregunta texto="¿Qué cmdlet de PowerShell cambia el nombre del equipo?" respuesta="rename-computer" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Roles y características" %}}
Windows Server hace cosas distintas según los **roles** que instales: DNS, DHCP, Servicios de dominio de Active Directory, servidor de archivos… Se instalan desde el **Administrador del servidor** o con PowerShell:

```
Get-WindowsFeature | Where-Object Installed
Install-WindowsFeature -Name DNS -IncludeManagementTools
```

En el módulo 4 instalarás los roles de un controlador de dominio. Por ahora, basta con que sepas listarlos e instalarlos.

{{< pregunta texto="¿Qué cmdlet instala un rol en Windows Server?" respuesta="install-windowsfeature|add-windowsfeature" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Servicios y Visor de eventos" %}}
Cuando algo «no funciona» en un servidor, mira dos sitios:

- **Servicios**: ¿está arrancado el servicio? `Get-Service` lo lista y `Restart-Service <nombre>` lo reinicia. En gráfico: `services.msc`.
- **Visor de eventos** (`eventvwr.msc`): los registros de **Sistema** y **Aplicación** te dicen qué falló y cuándo. Filtra por nivel «Error» o «Crítico».

```
Get-Service | Where-Object Status -eq 'Stopped'
Get-WinEvent -LogName System -MaxEvents 20
```

{{< pregunta texto="¿Qué herramienta gráfica de Windows muestra los registros de errores del sistema?" respuesta="visor de eventos|el visor de eventos|event viewer|eventvwr|eventvwr.msc" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="No trabajes como Administrador" %}}
La cuenta `Administrador` lo puede todo, y un error con ella también. Buenas prácticas desde el primer día:

1. Crea una **cuenta nominal** para ti (por ejemplo, `adm-tunombre`) con los permisos que necesites y úsala para administrar.
2. Guarda la contraseña de `Administrador` en el **gestor de contraseñas** y úsala solo en emergencias.
3. Antes de cambiar algo importante en el laboratorio, haz una **instantánea** de la VM: si algo sale mal, vuelves atrás.

Crea tu cuenta nominal y una instantánea de la VM, y marca la tarea.
{{% /tarea %}}
