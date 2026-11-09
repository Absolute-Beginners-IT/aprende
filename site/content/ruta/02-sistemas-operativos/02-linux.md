---
title: "Linux para administradores"
description: "Instala Ubuntu Server, conéctate por SSH y aprende lo justo para moverte, gestionar usuarios, permisos y servicios."
weight: 2
equipo: "terminal"
duracion: "45 min (más la instalación)"
nivel: "Inicial"
objetivos:
  - "Administrar un servidor Linux a distancia por SSH."
  - "Moverte por el sistema de ficheros y saber dónde está cada cosa."
  - "Gestionar usuarios, `sudo` y permisos."
  - "Comprobar servicios y leer sus registros."
requisitos:
  - "Sala «Monta tu laboratorio»"
  - "Módulo 1 (redes)"
---

{{% tarea n="1" titulo="Instala Ubuntu Server y conéctate por SSH" %}}
Crea una VM con **1–2 CPU, 2 GB de RAM y 25 GB de disco** y arranca desde la ISO de Ubuntu Server. Conéctala a la misma red que el Windows Server. Durante la instalación, en la pantalla de red, pon la IP fija `192.168.50.20/24`, la puerta de enlace `192.168.50.1` y el DNS `192.168.50.10`, y marca la opción **Install OpenSSH server**.

Los servidores Linux casi nunca se administran delante de la pantalla, sino a distancia con **SSH**, una conexión cifrada a la consola. Desde Windows (PowerShell ya incluye el cliente):

```
ssh tuusuario@192.168.50.20
```

Esto es lo que pasa por la red cuando lo ejecutas: primero se abre la conexión, después se acuerda el cifrado y solo entonces viaja la contraseña.

{{< recorrido datos="ssh" >}}

{{< pregunta texto="¿Qué protocolo se usa para administrar un servidor Linux a distancia?" respuesta="ssh" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Moverte por el sistema" %}}
En Linux todo cuelga de una única raíz, `/`. Los comandos básicos:

| Comando | Qué hace |
| --- | --- |
| `pwd` | Dice en qué directorio estás. |
| `ls -l` | Lista ficheros con permisos, propietario y tamaño. |
| `cd /var/log` | Cambia de directorio. |
| `cat fichero` / `less fichero` | Muestra un fichero (con `less` puedes desplazarte; sal con `q`). |

Y los directorios que más visitarás:

| Directorio | Qué hay |
| --- | --- |
| `/etc` | Ficheros de configuración del sistema y de los servicios. |
| `/var/log` | Registros (logs). |
| `/home` | Las carpetas de los usuarios. |

{{< pregunta texto="¿En qué directorio están la mayoría de los ficheros de configuración?" respuesta="/etc|etc" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Usuarios y sudo" %}}
En Linux no se trabaja como `root` (el administrador). Se usa un usuario normal y, cuando hace falta, se antepone **`sudo`** al comando para ejecutarlo con privilegios. Así queda registrado quién hizo qué.

```
sudo adduser ana
sudo usermod -aG sudo ana
```

El primero crea el usuario `ana`; el segundo lo añade al grupo `sudo`, que puede usar privilegios de administrador.

{{< pregunta texto="¿Qué comando antepones para ejecutar otro comando con privilegios de administrador?" respuesta="sudo" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Permisos" %}}
Cada fichero tiene un **propietario**, un **grupo** y permisos para tres tipos de usuario: el propietario, el grupo y el resto. Los permisos son **r** (leer), **w** (escribir) y **x** (ejecutar). `ls -l` los muestra así:

```
-rw-r----- 1 ana contabilidad 2048 nov 2 10:00 nominas.csv
```

| Bloque | Para quién | Permisos |
| --- | --- | --- |
| `rw-` | Propietario (`ana`) | Leer y escribir |
| `r--` | Grupo (`contabilidad`) | Solo leer |
| `---` | Resto | Nada |

Se cambian con `chmod` (permisos) y `chown` (propietario), por ejemplo `chmod 640 nominas.csv`.

{{< evolucion datos="permisos-linux" >}}

{{< pregunta texto="En `-rw-r-----`, ¿puede el grupo escribir en el fichero? (sí/no)" respuesta="no" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Servicios, registros y actualizaciones" %}}
Los servicios se gestionan con `systemctl` y sus registros se leen con `journalctl`:

```
systemctl status ssh
sudo systemctl restart ssh
journalctl -u ssh --since today
```

Y para mantener el sistema al día:

```
sudo apt update && sudo apt upgrade
```

Ejecuta los tres primeros comandos en tu VM y fíjate en si el servicio aparece como `active (running)`.

{{< pregunta texto="¿Qué comando muestra el estado del servicio ssh?" respuesta="systemctl status ssh|sudo systemctl status ssh" >}}
{{% /tarea %}}
