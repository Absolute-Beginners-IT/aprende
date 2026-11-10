---
title: "Servidor de ficheros e impresión"
description: "Comparte una carpeta con permisos de recurso compartido y NTFS bien combinados, comprueba el acceso y conoce cómo funciona un servidor de impresión."
weight: 4
equipo: "disco"
duracion: "45 min"
nivel: "Intermedio"
objetivos:
  - "Distinguir los permisos de recurso compartido de los permisos NTFS."
  - "Crear una carpeta compartida y dar permisos a un grupo siguiendo AGDLP."
  - "Acceder a un recurso compartido por su ruta UNC."
  - "Explicar las piezas de un servidor de impresión y resolver el atasco más típico."
requisitos:
  - "Sala «Usuarios, grupos y GPO» (grupos GG-Contabilidad y DL-Contabilidad-M)"
---

{{% tarea n="1" titulo="Dos capas de permisos" %}}
Cuando alguien abre una carpeta compartida desde la red, Windows comprueba **dos** listas de permisos:

| Capa | Dónde se configura | A quién afecta |
| --- | --- | --- |
| **Permisos de recurso compartido** | Propiedades de la carpeta → Uso compartido → Uso compartido avanzado. | Solo a quien entra **por la red**. Son tres: Lectura, Cambiar y Control total. |
| **Permisos NTFS** | Propiedades de la carpeta → Seguridad. | A todo el mundo, entre por la red o sentado delante del servidor. Son más finos: Lectura, Escritura, Modificar, Control total… |

NTFS es el sistema de archivos de Windows, y sus permisos viajan con la carpeta. Por la red, el permiso efectivo es **el más restrictivo de los dos**. Por eso la práctica habitual es sencilla: permisos de recurso compartido amplios y el control fino en NTFS, donde vive de verdad.

Pulsa cada etapa para ver qué capas atraviesa la petición:

{{< evolucion datos="permisos-compartidos" >}}

{{< aviso titulo="La distinción que importa" >}}
Si el recurso compartido da Control total y NTFS da solo Lectura, el usuario solo puede leer. Y al revés también: NTFS con Modificar y el recurso compartido con Lectura dejan solo Lectura. Cuando alguien «tiene permisos pero no puede escribir», revisa las dos capas.
{{< /aviso >}}

{{< pregunta texto="Por la red, si el recurso compartido permite Cambiar y NTFS permite solo Lectura, ¿qué permiso efectivo tiene el usuario?" respuesta="lectura|leer|solo lectura" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Crea y comparte la carpeta" %}}
En una empresa, el servidor de ficheros es un servidor aparte, nunca el controlador de dominio. En el laboratorio, para ahorrar memoria, usarás SRV-DC01.

Crea la carpeta y compártela. Siguiendo AGDLP, el permiso se lo das al grupo de dominio local `DL-Contabilidad-M`, nunca a Ana directamente. Usa tu cuenta `adm-tunombre` para el control total:

```
New-Item -ItemType Directory -Path "C:\Compartido\Contabilidad"
New-SmbShare -Name "Contabilidad" -Path "C:\Compartido\Contabilidad" -ChangeAccess "LAB\DL-Contabilidad-M" -FullAccess "LAB\adm-tunombre"
Get-SmbShareAccess -Name "Contabilidad"
```

Ahora el permiso NTFS. Con `icacls` das **Modificar** (`M`) al mismo grupo; `(OI)(CI)` hace que se herede a los ficheros y subcarpetas que se creen dentro:

```
icacls "C:\Compartido\Contabilidad" /grant "LAB\DL-Contabilidad-M:(OI)(CI)M"
icacls "C:\Compartido\Contabilidad"
```

La carpeta también **hereda** los permisos de `C:\`, que dan acceso a todos los usuarios (a los usuarios autenticados, incluso para crear y modificar). En producción se quita esa herencia y se dejan solo SYSTEM, los administradores y tus grupos: pestaña Seguridad → Opciones avanzadas → Deshabilitar herencia → convertir en permisos explícitos, y después borras las entradas que sobran. Pruébalo en el laboratorio con una instantánea hecha, y comprueba que tu cuenta de administración sigue teniendo acceso.

{{< pregunta texto="¿Qué cmdlet crea una carpeta compartida en Windows?" respuesta="new-smbshare" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Comprueba el acceso" %}}
A un recurso compartido se llega con su **ruta UNC** (*Universal Naming Convention*): dos barras invertidas, el servidor y el nombre del recurso.

```
\\SRV-DC01\Contabilidad
\\srv-dc01.lab.example.com\Contabilidad
```

Desde un Windows unido al dominio, escríbela en el Explorador de archivos con la sesión de `LAB\ana.garcia`: puede crear y modificar ficheros. Con `LAB\luis.martin`, que no está en `GG-Contabilidad`, el acceso se deniega.

Si no tienes un cliente Windows, compruébalo desde el servidor Ubuntu del módulo 2 con `smbclient`, el cliente de carpetas compartidas de Linux (para instalarlo, el Ubuntu necesita salida a Internet). Te pedirá la contraseña de Ana; dentro, `ls` lista los ficheros y `exit` sale. Como Ana todavía no ha cambiado su contraseña inicial, antes quítale esa obligación en el servidor con `Set-ADUser ana.garcia -ChangePasswordAtLogon $false`:

```
sudo apt install smbclient
smbclient //192.168.50.10/Contabilidad -U ana.garcia -W LAB
```

Un detalle que confunde a muchos: los grupos de un usuario se leen **al iniciar sesión**. Si añades a alguien a un grupo, no tendrá el permiso nuevo hasta que cierre la sesión y vuelva a entrar.

En la práctica, las carpetas compartidas se entregan a los usuarios como **unidades de red** (por ejemplo, `Z:`) mediante una GPO, en Configuración de usuario → Preferencias → Configuración de Windows → Asignaciones de unidad.

Cuando hayas comprobado que Ana entra y Luis no, marca la tarea.
{{% /tarea %}}

{{% tarea n="4" titulo="El servidor de impresión" %}}
En una oficina, las impresoras no se instalan una a una en cada ordenador: se instalan una vez en un **servidor de impresión**, que las comparte. Así los controladores y la configuración se gestionan desde un único sitio. Las piezas:

| Pieza | Qué es |
| --- | --- |
| **Impresora** | El equipo físico, con su IP (fija o con reserva DHCP, como la de la sala «DNS interno y DHCP»). |
| **Puerto** | Cómo llega el servidor a la impresora; normalmente un puerto TCP/IP con su dirección. |
| **Controlador** (*driver*) | El software que traduce los trabajos al lenguaje de ese modelo. Descárgalo siempre de la web del fabricante. |
| **Cola de impresión** | La impresora compartida en el servidor, a la que se conectan los usuarios, por ejemplo `\\SRV-DC01\IMP-PLANTA1`. |

El rol se instala así, y la consola gráfica es **Administración de impresión** (`printmanagement.msc`):

```
Install-WindowsFeature Print-Server -IncludeManagementTools
```

Con el controlador del fabricante ya instalado, crear la cola son tres pasos: `Get-PrinterDriver` te da el nombre exacto del controlador, `Add-PrinterPort -Name "IP_192.168.50.150" -PrinterHostAddress "192.168.50.150"` crea el puerto, y `Add-Printer` con `-Shared` publica la cola. Igual que las unidades de red, las impresoras se reparten a los usuarios con una GPO.

La incidencia de impresión más habitual es un trabajo atascado que bloquea la cola. Lo atiende el servicio **Cola de impresión**, cuyo nombre interno es `Spooler`:

```
Get-Printer
Get-PrintJob -PrinterName "IMP-PLANTA1"
Restart-Service Spooler
```

Reiniciar el servicio suele desatascarla. Si el trabajo vuelve a quedarse atascado, revisa el controlador y el Visor de eventos.

{{< pregunta texto="¿Cuál es el nombre interno del servicio de Windows que gestiona la cola de impresión?" respuesta="spooler|print spooler" >}}
{{% /tarea %}}
