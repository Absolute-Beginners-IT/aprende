---
title: "Dominio, DNS, DHCP y servidor de ficheros"
description: "Levanta el corazón de la empresa: el controlador de dominio con DNS y DHCP, los usuarios y grupos, y las carpetas por departamento."
weight: 2
equipo: "servidor"
duracion: "2–3 h"
nivel: "Intermedio"
objetivos:
  - "Promover un controlador de dominio con DNS integrado."
  - "Crear registros DNS y un ámbito DHCP según el plan de direcciones."
  - "Organizar usuarios y grupos en unidades organizativas."
  - "Montar un servidor de ficheros con permisos por grupo y comprobarlos."
requisitos:
  - "Sala «Diseña tu empresa: mapa y plan de direcciones»"
  - "Módulo 4 (servicios esenciales)"
---

Trabaja con las VM conectadas a la **red interna** del laboratorio: vas a montar un DHCP y no quieres que reparta direcciones en tu red real (lo viste en la sala «Monta tu laboratorio»). Haz una instantánea de cada VM antes de empezar.

{{% tarea n="1" titulo="Promueve SRV-DC01 a controlador de dominio" %}}
Parte del Windows Server del módulo 2, que ya se llama `SRV-DC01` y tiene la IP fija 192.168.50.10 con DNS apuntando a sí mismo. En PowerShell como administrador:

```
Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools
Install-ADDSForest -DomainName "lab.example.com" -DomainNetbiosName "LAB" -InstallDns
```

Te pedirá la contraseña del **modo de restauración de servicios de directorio** (DSRM): guárdala en el gestor de contraseñas, porque solo la necesitarás el día que todo vaya mal. El servidor se reiniciará solo.

Al volver, crea tu cuenta nominal de administración y métela en el grupo de administradores del dominio (los conceptos están en el módulo 4, Active Directory):

```
New-ADUser -Name "adm-tunombre" -SamAccountName "adm-tunombre" -AccountPassword (Read-Host -AsSecureString "Contraseña") -Enabled $true
Add-ADGroupMember -Identity "$((Get-ADDomain).DomainSID)-512" -Members "adm-tunombre"
```

El segundo comando busca el grupo «Admins. del dominio» por su identificador (termina en `-512`), así funciona igual en un Windows en español que en inglés. A partir de aquí, inicia sesión como `LAB\adm-tunombre`.

**Cómo sabes que está bien:** `Get-ADDomain` muestra `lab.example.com` y `nslookup srv-dc01.lab.example.com` responde desde el propio servidor.

{{< pregunta texto="¿Qué IP devuelve `nslookup srv-dc01.lab.example.com`?" respuesta="192.168.50.10" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Completa el DNS" %}}
Los equipos de Windows que se unan al dominio registrarán su nombre solos, pero el Ubuntu de monitorización no. Créale su registro **A** y, ya puestos, la **zona inversa**, para que las IP también se traduzcan a nombres:

```
Add-DnsServerResourceRecordA -ZoneName "lab.example.com" -Name "srv-mon01" -IPv4Address 192.168.50.20
Add-DnsServerPrimaryZone -NetworkId "192.168.50.0/24" -ReplicationScope Forest
Add-DnsServerResourceRecordPtr -ZoneName "50.168.192.in-addr.arpa" -Name "20" -PtrDomainName "srv-mon01.lab.example.com"
```

Y para que los servidores resuelvan nombres de Internet, añade un **reenviador** (por ejemplo, el DNS de tu router o uno público):

```
Add-DnsServerForwarder -IPAddress 1.1.1.1
```

**Cómo sabes que está bien:** las dos consultas siguientes devuelven el nombre y la IP de `SRV-MON01`. Si tu laboratorio ya tiene salida a Internet (con el firewall de la sala de VLAN), `Resolve-DnsName www.example.com` también debe responder.

```
nslookup srv-mon01.lab.example.com
nslookup 192.168.50.20
```

{{< pregunta texto="¿Qué IP devuelve `nslookup srv-mon01.lab.example.com`?" respuesta="192.168.50.20" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Monta el DHCP" %}}
Instala el rol, **autorízalo** en el dominio (un DHCP sin autorizar en Active Directory no reparte nada) y crea el ámbito de tu plan de direcciones:

```
Install-WindowsFeature -Name DHCP -IncludeManagementTools
Add-DhcpServerInDC -DnsName "srv-dc01.lab.example.com" -IPAddress 192.168.50.10
Add-DhcpServerv4Scope -Name "Puestos" -StartRange 192.168.50.100 -EndRange 192.168.50.199 -SubnetMask 255.255.255.0 -State Active
Set-DhcpServerv4OptionValue -ScopeId 192.168.50.0 -Router 192.168.50.1 -DnsServer 192.168.50.10 -DnsDomain "lab.example.com"
```

Las **opciones** son lo que el DHCP entrega además de la IP: la puerta de enlace, el servidor DNS y el sufijo del dominio. Si un puesto recibe IP pero no encuentra el dominio, casi siempre es la opción de DNS.

{{< aviso titulo="La distinción que importa" >}}
Si tu hipervisor tiene su propio DHCP activo en la misma red (por ejemplo, una «red NAT» de VirtualBox), habrá dos servidores repartiendo direcciones y los puestos cogerán la del que conteste primero. Usa una red interna, donde solo reparte tu `SRV-DC01`.
{{< /aviso >}}

**Cómo sabes que está bien:** `Get-DhcpServerv4Scope` muestra el ámbito `Active` y, si conectas un puesto de prueba a la red interna, `ipconfig /all` le muestra una IP entre .100 y .199 con el DNS 192.168.50.10.

{{< pregunta texto="¿Qué puerta de enlace reciben los puestos por DHCP?" respuesta="192.168.50.1" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Usuarios y grupos" %}}
Crea una estructura de **unidades organizativas** (OU) para no tenerlo todo mezclado en los contenedores por defecto, y dentro los dos grupos de departamento:

```
$dom = "DC=lab,DC=example,DC=com"
New-ADOrganizationalUnit -Name "Empresa" -Path $dom
New-ADOrganizationalUnit -Name "Usuarios" -Path "OU=Empresa,$dom"
New-ADOrganizationalUnit -Name "Grupos" -Path "OU=Empresa,$dom"
New-ADGroup -Name "GG-Administracion" -GroupScope Global -GroupCategory Security -Path "OU=Grupos,OU=Empresa,$dom"
New-ADGroup -Name "GG-Ingenieria" -GroupScope Global -GroupCategory Security -Path "OU=Grupos,OU=Empresa,$dom"
```

No hace falta crear a las 15 personas: con **dos de cada departamento** te basta para probar los permisos. Por ejemplo:

```
$clave = Read-Host -AsSecureString "Contraseña inicial"
New-ADUser -Name "Ana Ruiz" -SamAccountName "ana.ruiz" -UserPrincipalName "ana.ruiz@lab.example.com" -Path "OU=Usuarios,OU=Empresa,$dom" -AccountPassword $clave -ChangePasswordAtLogon $true -Enabled $true
Add-ADGroupMember -Identity "GG-Administracion" -Members "ana.ruiz"
```

Repite con `pablo.moreno` (Ingeniería) y otros dos más. Si quieres practicar, crea los 15 desde un CSV con `Import-Csv` y un bucle `ForEach-Object`.

**Cómo sabes que está bien:** cada usuario está en un solo grupo de departamento.

```
Get-ADGroupMember -Identity "GG-Administracion" | Select-Object Name
Get-ADGroupMember -Identity "GG-Ingenieria" | Select-Object Name
```

{{< pregunta texto="¿Qué cmdlet lista los miembros de un grupo de Active Directory?" respuesta="get-adgroupmember" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Prepara SRV-FS01" %}}
Crea una segunda VM de Windows Server igual que en el módulo 2, llámala `SRV-FS01`, ponle la IP fija **192.168.50.11** con DNS **192.168.50.10** (si apuntas a otro DNS, no encontrará el dominio) y únela al dominio (`-NewName` le cambia el nombre en el mismo paso; el reinicio va al final para que no corte los comandos anteriores):

```
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.50.11 -PrefixLength 24 -DefaultGateway 192.168.50.1
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses 192.168.50.10
Add-Computer -DomainName "lab.example.com" -NewName "SRV-FS01" -Credential "LAB\adm-tunombre" -Restart
```

Los datos de la empresa **no van en el disco del sistema**. Apaga la VM, añádele un disco virtual de 20 GB y, al arrancar, inicialízalo como unidad `E:`:

```
Get-Disk | Where-Object PartitionStyle -eq 'RAW' | Initialize-Disk -PartitionStyle GPT -PassThru | New-Partition -DriveLetter E -UseMaximumSize | Format-Volume -FileSystem NTFS -NewFileSystemLabel "Datos"
```

**Cómo sabes que está bien:** desde `SRV-DC01`, `nslookup srv-fs01.lab.example.com` devuelve 192.168.50.11 (se ha registrado sola al unirse) y en `SRV-FS01` existe la unidad `E:` con la etiqueta «Datos». Cuando lo tengas, marca la tarea.
{{% /tarea %}}

{{% tarea n="6" titulo="Carpetas y permisos por grupo" %}}
En `SRV-FS01`, crea las carpetas y quítales la herencia, para que solo tengan los permisos que tú decidas:

```
Install-WindowsFeature -Name FS-FileServer
New-Item -ItemType Directory -Path "E:\Compartido\Administracion", "E:\Compartido\Ingenieria", "E:\Compartido\Comun"
icacls "E:\Compartido\Administracion" /inheritance:r /grant "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "LAB\GG-Administracion:(OI)(CI)M"
icacls "E:\Compartido\Ingenieria" /inheritance:r /grant "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "LAB\GG-Ingenieria:(OI)(CI)M"
icacls "E:\Compartido\Comun" /inheritance:r /grant "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "LAB\GG-Administracion:(OI)(CI)M" "LAB\GG-Ingenieria:(OI)(CI)M"
```

Los `*S-1-5-…` son los identificadores de **Administradores** y **SYSTEM**: así el comando funciona en cualquier idioma. `F` es control total, `M` es modificar, y `(OI)(CI)` hace que el permiso se herede a ficheros y subcarpetas.

Después, compártelas. Con **enumeración basada en acceso**, cada persona solo ve las carpetas en las que tiene permiso:

```
New-SmbShare -Name "Administracion" -Path "E:\Compartido\Administracion" -ChangeAccess "LAB\GG-Administracion" -FullAccess "LAB\adm-tunombre" -FolderEnumerationMode AccessBased
New-SmbShare -Name "Ingenieria" -Path "E:\Compartido\Ingenieria" -ChangeAccess "LAB\GG-Ingenieria" -FullAccess "LAB\adm-tunombre" -FolderEnumerationMode AccessBased
New-SmbShare -Name "Comun" -Path "E:\Compartido\Comun" -ChangeAccess "LAB\GG-Administracion", "LAB\GG-Ingenieria" -FullAccess "LAB\adm-tunombre" -FolderEnumerationMode AccessBased
```

{{< aviso titulo="La distinción que importa" >}}
Hay **dos capas de permisos**: los del recurso compartido (al entrar por la red) y los NTFS (los de la carpeta). Se aplica el **más restrictivo** de los dos. Por eso conviene que ambos digan lo mismo: si no, perderás horas buscando por qué alguien «tiene permiso pero no entra».
{{< /aviso >}}

**Cómo sabes que está bien:**

1. `icacls "E:\Compartido\Administracion"` muestra solo Administradores, SYSTEM y `GG-Administracion`; ningún permiso heredado.
2. `Get-SmbShareAccess -Name "Ingenieria"` no muestra a `GG-Administracion`.
3. Si tienes un puesto de Windows unido al dominio, inicia sesión como `pablo.moreno` y abre `\\srv-fs01\Administracion`: debe darte «Acceso denegado». Con `ana.ruiz`, entra sin problema.

{{< pregunta texto="En la salida de `icacls`, ¿qué letra indica el permiso de modificar?" respuesta="m|(m)" >}}
{{% /tarea %}}
