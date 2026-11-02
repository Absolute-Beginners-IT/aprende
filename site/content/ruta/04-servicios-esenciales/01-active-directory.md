---
title: "Active Directory: tu primer dominio"
description: "Entiende qué es un dominio de Active Directory, elige bien su nombre y convierte SRV-DC01 en el primer controlador de dominio de tu laboratorio."
weight: 1
equipo: "servidor"
duracion: "50 min"
nivel: "Inicial"
objetivos:
  - "Explicar qué es Active Directory y qué hace un controlador de dominio."
  - "Elegir un nombre de dominio adecuado y justificarlo."
  - "Promover un Windows Server a controlador de dominio con PowerShell."
  - "Comprobar que el dominio funciona."
requisitos:
  - "Sala «Windows Server: primeros pasos» (SRV-DC01 con IP fija 192.168.50.10)"
  - "Sala «Puerta de enlace, DNS y DHCP»"
---

{{% tarea n="1" titulo="Qué es Active Directory" %}}
Imagina una empresa de 50 personas sin nada centralizado: cada ordenador tiene sus propios usuarios y contraseñas, y cuando alguien entra o se va hay que tocar los equipos uno a uno. **Active Directory** (AD) resuelve eso: es el **directorio** de la empresa, una base de datos central con los usuarios, los grupos y los equipos, y el sistema que comprueba quién es quién cuando alguien inicia sesión.

Las piezas que vas a oír a diario:

| Término | Qué es |
| --- | --- |
| **Dominio** | El conjunto de usuarios, grupos y equipos que se administran juntos. Tiene un nombre DNS, como `lab.example.com`. |
| **Controlador de dominio** (DC, *domain controller*) | El servidor que guarda la base de datos de AD y valida los inicios de sesión. En una empresa lo recomendable es tener al menos dos, por si uno falla. |
| **Bosque** | El contenedor de uno o varios dominios. Al crear el primer dominio, creas también su bosque. |
| **Unidad organizativa** (OU) | Una «carpeta» dentro del dominio para ordenar objetos y aplicarles directivas. |
| **Objeto** | Cada cosa que vive en el directorio: un usuario, un grupo, un equipo… |

Cuando un ordenador está **unido al dominio**, cualquier usuario del dominio puede iniciar sesión en él con su cuenta de siempre, y el administrador gestiona todo desde un único sitio.

{{< pregunta texto="¿Cómo se llama el servidor que guarda la base de datos de Active Directory y valida los inicios de sesión?" respuesta="controlador de dominio|un controlador de dominio|el controlador de dominio|dc|domain controller" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Elige bien el nombre del dominio" %}}
El nombre del dominio es casi imposible de cambiar después, así que merece pensarlo un minuto. Un dominio de AD tiene dos nombres:

| Nombre | En el laboratorio | Para qué sirve |
| --- | --- | --- |
| **Nombre DNS** | `lab.example.com` | El nombre «completo» del dominio. Los equipos lo usan para encontrar los controladores de dominio. |
| **Nombre NetBIOS** | `LAB` | Un nombre corto heredado de redes antiguas. Lo verás al iniciar sesión como `LAB\usuario`. |

Durante años fue habitual usar nombres como `empresa.local`. Hoy se desaconseja:

- La terminación `.local` está reservada para **Multicast DNS** (mDNS), el sistema con el que impresoras, móviles y equipos Apple se anuncian en la red. Mezclar los dos provoca fallos de resolución difíciles de diagnosticar.
- Nadie puede ser propietario de `.local`, así que ninguna autoridad pública te emitirá certificados para esos nombres.

La recomendación actual es usar un **subdominio de un dominio que tu empresa ya posee**: si la empresa tiene `empresa.es`, el dominio de AD sería algo como `ad.empresa.es`. Es único, es tuyo y no choca con la web pública. En el laboratorio usamos `lab.example.com` porque `example.com` está reservado precisamente para documentación y ejemplos.

{{< aviso titulo="La distinción que importa" >}}
Usa un **subdominio** (`ad.empresa.es`), no el dominio principal (`empresa.es`). Si llamas al dominio de AD igual que tu web, el DNS interno tendrá que saber también dónde está la web pública, y cada cambio en la web habrá que repetirlo dentro.
{{< /aviso >}}

{{< pregunta texto="¿Qué terminación de dominio se desaconseja porque está reservada para Multicast DNS?" respuesta=".local|local" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Prepara el servidor e instala el rol" %}}
Antes de promover un servidor a controlador de dominio, repasa esta lista. Todo lo que falle aquí es mucho más difícil de arreglar después:

1. **Nombre definitivo**: `SRV-DC01`. Cambiar el nombre de un controlador de dominio es un trámite delicado.
2. **IP fija**: `192.168.50.10`, máscara `/24`, puerta de enlace `192.168.50.1`.
3. **DNS apuntando a sí mismo** (`192.168.50.10`): el controlador de dominio será también el servidor DNS del dominio.
4. **Contraseña robusta** en la cuenta `Administrador` local: al crear el dominio, pasará a ser la del administrador del dominio.
5. **Instantánea** de la VM, por si quieres repetir el proceso.

Comprueba los tres primeros puntos con:

```
hostname
Get-NetIPConfiguration
```

Si todo cuadra, instala el rol **Servicios de dominio de Active Directory** (AD DS, *Active Directory Domain Services*) con sus herramientas de administración:

```
Install-WindowsFeature AD-Domain-Services -IncludeManagementTools
```

Instalar el rol solo copia los componentes: el servidor todavía no es controlador de dominio. Eso lo hace el siguiente paso.

{{< pregunta texto="¿Cuál es el nombre de la característica que instalas con Install-WindowsFeature para tener Active Directory?" respuesta="ad-domain-services" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Promueve SRV-DC01 a controlador de dominio" %}}
**Promover** un servidor es convertirlo en controlador de dominio. Como es el primero, vas a crear a la vez un **bosque nuevo** y su dominio. Abre PowerShell como administrador:

```
Install-ADDSForest -DomainName "lab.example.com" -DomainNetbiosName "LAB" -InstallDns
```

Qué hace cada parte:

| Parámetro | Qué indica |
| --- | --- |
| `-DomainName` | El nombre DNS del dominio. |
| `-DomainNetbiosName` | El nombre corto. |
| `-InstallDns` | Instala también el servidor DNS, que AD necesita para funcionar. |

El asistente te pedirá la contraseña del **modo de restauración de servicios de directorio** (DSRM, *Directory Services Restore Mode*): es la que usarías para reparar AD si un día no arranca. Guárdala en el gestor de contraseñas, como cualquier credencial de emergencia. Después te pedirá confirmación, mostrará algunos avisos (son normales en un primer controlador de dominio) y el servidor se reiniciará solo.

Tras el reinicio, inicia sesión como `LAB\Administrador` con la contraseña que tenía el `Administrador` local. Lo mismo se puede hacer en gráfico desde el **Administrador del servidor**, con la bandera de notificaciones → «Promover este servidor a controlador de dominio».

{{< pregunta texto="¿Qué cmdlet crea un bosque nuevo y promueve el servidor a controlador de dominio?" respuesta="install-addsforest" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Comprueba que el dominio funciona" %}}
Un dominio recién creado parece funcionar aunque tenga problemas. Acostúmbrate a comprobarlo:

```
Get-ADDomain
Get-ADDomainController
Resolve-DnsName -Type SRV _ldap._tcp.dc._msdcs.lab.example.com
dcdiag
```

| Comando | Qué te dice |
| --- | --- |
| `Get-ADDomain` | Los datos del dominio: nombre DNS, nombre NetBIOS, controladores… |
| `Get-ADDomainController` | Qué controlador de dominio te ha respondido y su IP. |
| `Resolve-DnsName -Type SRV …` | Si el DNS publica dónde están los controladores de dominio. Sin estos registros, los equipos no encuentran el dominio. |
| `dcdiag` | Un diagnóstico completo del controlador de dominio. Busca las líneas que pongan que una prueba no se ha superado. |

Abre también la consola **Usuarios y equipos de Active Directory** (`dsa.msc`): verás el dominio `lab.example.com` con sus contenedores por defecto.

Cuando `Get-ADDomain` te muestre tu dominio y `dcdiag` no marque errores graves, haz una **instantánea** de la VM (este es un buen punto al que volver) y marca la tarea.
{{% /tarea %}}
