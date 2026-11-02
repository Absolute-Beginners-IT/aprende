---
title: "Usuarios, grupos y GPO"
description: "Ordena el dominio con unidades organizativas, crea usuarios y grupos siguiendo AGDLP y aplica tu primera directiva de grupo."
weight: 3
equipo: "usuarios"
duracion: "50 min"
nivel: "Intermedio"
objetivos:
  - "Crear una estructura de unidades organizativas y leer un nombre distintivo."
  - "Dar de alta usuarios y grupos desde PowerShell."
  - "Entender los ámbitos de grupo y la idea de AGDLP."
  - "Crear, vincular y comprobar una directiva de grupo."
requisitos:
  - "Sala «Active Directory: tu primer dominio»"
  - "Sala «DNS interno y DHCP»"
---

{{% tarea n="1" titulo="Ordena el dominio con unidades organizativas" %}}
Los contenedores que trae el dominio por defecto (`Users`, `Computers`) no admiten directivas propias. Por eso, lo primero en cualquier dominio es crear tu propia estructura de **unidades organizativas** (OU, *organizational units*). Una estructura sencilla y muy habitual:

```
lab.example.com
└── LAB
    ├── Usuarios
    ├── Grupos
    └── Equipos
```

En PowerShell, cada objeto de AD se identifica por su **nombre distintivo** (DN, *distinguished name*), que se lee de dentro hacia fuera: `OU=Usuarios,OU=LAB,DC=lab,DC=example,DC=com` es la OU `Usuarios`, dentro de la OU `LAB`, en el dominio `lab.example.com` (cada trozo del nombre DNS es un `DC=`).

```
New-ADOrganizationalUnit -Name "LAB" -Path "DC=lab,DC=example,DC=com"
New-ADOrganizationalUnit -Name "Usuarios" -Path "OU=LAB,DC=lab,DC=example,DC=com"
New-ADOrganizationalUnit -Name "Grupos" -Path "OU=LAB,DC=lab,DC=example,DC=com"
New-ADOrganizationalUnit -Name "Equipos" -Path "OU=LAB,DC=lab,DC=example,DC=com"
Get-ADOrganizationalUnit -Filter * | Select-Object Name, DistinguishedName
```

Las OU se crean protegidas contra el borrado accidental: si un día necesitas borrar una, tendrás que quitar antes esa protección. Es una buena red de seguridad.

{{< pregunta texto="¿Con qué siglas se conoce una unidad organizativa?" respuesta="ou" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Da de alta usuarios" %}}
Crea una usuaria de prueba en tu OU. `Read-Host -AsSecureString` te pide la contraseña sin que se vea en pantalla ni quede en el historial:

```
New-ADUser -Name "Ana García" -GivenName "Ana" -Surname "García" -SamAccountName "ana.garcia" -UserPrincipalName "ana.garcia@lab.example.com" -Path "OU=Usuarios,OU=LAB,DC=lab,DC=example,DC=com" -AccountPassword (Read-Host -AsSecureString "Contraseña") -Enabled $true -ChangePasswordAtLogon $true
```

| Parámetro | Qué es |
| --- | --- |
| `-SamAccountName` | El nombre de inicio de sesión clásico: `LAB\ana.garcia`. |
| `-UserPrincipalName` | El inicio de sesión con formato de correo: `ana.garcia@lab.example.com`. |
| `-ChangePasswordAtLogon` | Obliga a cambiar la contraseña en el primer inicio de sesión: el administrador nunca debe conocer la contraseña definitiva de nadie. |

Comprueba que existe y en qué OU está:

```
Get-ADUser ana.garcia
```

Crea un segundo usuario, `luis.martin`, con el mismo comando. Y ahora tu cuenta de administración: comprueba si `adm-tunombre` ya existe en el dominio con `Get-ADUser adm-tunombre`. Si no aparece, créala igual que a Ana (en la OU `Usuarios`) y añádela al grupo de administradores del dominio, que se llama `Domain Admins` en un Windows en inglés y `Admins. del dominio` en uno en español:

```
Add-ADGroupMember -Identity "Admins. del dominio" -Members "adm-tunombre"
```

{{< pregunta texto="¿Qué cmdlet consulta los datos de un usuario de Active Directory?" respuesta="get-aduser" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Grupos y la idea de AGDLP" %}}
Nunca des permisos a usuarios sueltos: cuando Ana cambie de departamento, nadie se acordará de quitárselos. Los permisos se dan a **grupos**, y los usuarios entran y salen de los grupos.

Los grupos de seguridad tienen un **ámbito**, que decide qué pueden contener y dónde se pueden usar:

| Ámbito | Para qué se usa habitualmente |
| --- | --- |
| **Global** | Agrupar personas por su función: «los de Contabilidad». |
| **Dominio local** | Recibir permisos sobre un recurso: «modificar la carpeta de Contabilidad». |
| **Universal** | Agrupar en entornos con varios dominios. En un dominio único apenas lo usarás. |

La receta clásica se llama **AGDLP**: las cuentas (*Accounts*) entran en grupos **G**lobales, los grupos globales entran en grupos de **D**ominio **L**ocal, y los grupos de dominio local reciben los **P**ermisos. Parece rebuscado con un solo recurso, pero cuando tienes veinte carpetas y diez departamentos, sabes siempre dónde mirar.

Crea los dos grupos y anídalos:

```
New-ADGroup -Name "GG-Contabilidad" -GroupScope Global -GroupCategory Security -Path "OU=Grupos,OU=LAB,DC=lab,DC=example,DC=com"
New-ADGroup -Name "DL-Contabilidad-M" -GroupScope DomainLocal -GroupCategory Security -Path "OU=Grupos,OU=LAB,DC=lab,DC=example,DC=com"
Add-ADGroupMember -Identity "GG-Contabilidad" -Members "ana.garcia"
Add-ADGroupMember -Identity "DL-Contabilidad-M" -Members "GG-Contabilidad"
Get-ADGroupMember -Identity "DL-Contabilidad-M" -Recursive
```

Los prefijos `GG-` (grupo global) y `DL-` (dominio local) y el sufijo `-M` (modificar) son una convención: no la exige Windows, pero hace que el nombre de cada grupo explique para qué sirve. En la última sala usarás `DL-Contabilidad-M` para dar permisos sobre una carpeta compartida.

{{< pregunta texto="En AGDLP, ¿qué ámbito de grupo recibe los permisos sobre el recurso?" respuesta="dominio local|local de dominio|domain local|domainlocal" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Tu primera directiva de grupo" %}}
Una **directiva de grupo** (GPO, *Group Policy Object*) es un paquete de configuración que el dominio aplica solo a los equipos y usuarios: el fondo de escritorio, las unidades de red, la política de contraseñas, qué pueden tocar los usuarios… Cada GPO tiene dos partes: **Configuración del equipo** (se aplica al arrancar, según dónde esté la cuenta del equipo) y **Configuración del usuario** (se aplica al iniciar sesión, según dónde esté la cuenta del usuario).

Una GPO no hace nada hasta que la **vinculas** a una OU (o al dominio entero). Cuando varias GPO chocan, gana la última que se aplica, en este orden: local, sitio, dominio y, por último, OU. La regla se recuerda como **LSDOU**.

Crea una GPO que impida a los usuarios abrir el Panel de control, configúrala y vincúlala a la OU `Usuarios` (afectará a todas las cuentas de esa OU, también a `adm-tunombre` si la creaste ahí):

```
New-GPO -Name "U-Bloquear-Panel-de-control"
Set-GPRegistryValue -Name "U-Bloquear-Panel-de-control" -Key "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" -ValueName "NoControlPanel" -Type DWord -Value 1
New-GPLink -Name "U-Bloquear-Panel-de-control" -Target "OU=Usuarios,OU=LAB,DC=lab,DC=example,DC=com"
```

En el día a día lo harás casi siempre en gráfico, con la **Consola de administración de directivas de grupo** (`gpmc.msc`): esta misma opción está en Configuración de usuario → Directivas → Plantillas administrativas → Panel de control. Ábrela y busca tu GPO vinculada a la OU.

Los equipos refrescan las directivas solos cada cierto tiempo. Para no esperar, en el equipo cliente:

```
gpupdate /force
gpresult /r
```

`gpresult /r` te dice qué GPO se han aplicado al equipo y al usuario. Si tienes una VM con Windows 10 u 11 en la misma red, únela al dominio con `Add-Computer -DomainName "lab.example.com" -Credential "LAB\adm-tunombre" -Restart`, inicia sesión como `LAB\ana.garcia` y comprueba que el Panel de control ya no abre. Si no, revisa la GPO con `Get-GPOReport -Name "U-Bloquear-Panel-de-control" -ReportType Html -Path "C:\gpo.html"` y abre el informe.

{{< aviso titulo="La distinción que importa" >}}
Las directivas de **usuario** se aplican según la OU donde está el **usuario**, y las de **equipo**, según la OU donde está el **equipo**. Una GPO con configuración de usuario vinculada a la OU `Equipos` no hará nada: es el error más frecuente con las GPO.
{{< /aviso >}}

{{< pregunta texto="¿Qué comando fuerza en el cliente la aplicación inmediata de las directivas de grupo?" respuesta="gpupdate /force|gpupdate" >}}
{{% /tarea %}}
