---
title: "Copias de seguridad y prueba de restauración"
description: "Protege las carpetas de la empresa con copias programadas y demuestra que sabes recuperar un fichero borrado."
weight: 4
equipo: "disco"
duracion: "1,5 h"
nivel: "Intermedio"
objetivos:
  - "Definir qué se copia, cada cuánto y dónde se guarda."
  - "Hacer copias con Copias de seguridad de Windows Server y programarlas."
  - "Restaurar ficheros borrados en otra ubicación y comprobarlos."
  - "Aplicar la regla 3-2-1 a tu laboratorio."
requisitos:
  - "Sala «Dominio, DNS, DHCP y servidor de ficheros»"
  - "Módulo 7 (protección)"
---

La gerente de Talleres Brisa lo dejó claro: «si alguien borra un fichero, tiene que poder recuperarse». Una copia que nunca has restaurado es solo una esperanza. En esta sala harás la copia **y** la prueba que demuestra que sirve.

{{% tarea n="1" titulo="La política de copias" %}}
Antes de pulsar ningún botón, decide qué proteges. Esta es la política de Talleres Brisa:

| Qué | Dónde está | Frecuencia | Retención | Destino |
| --- | --- | --- | --- | --- |
| Carpetas de la empresa | `SRV-FS01`, unidad `E:` | Diaria, 21:00 | Las que quepan en el disco de copias | Disco `F:` de `SRV-FS01` + copia fuera |
| Estado del sistema del dominio | `SRV-DC01` | Diaria | 7 días | Disco de copias del controlador |
| Configuración del firewall (si lo montaste) | `FW01` | Tras cada cambio | Últimas 5 | Fichero XML exportado desde la web |

Con una copia diaria, lo peor que puede pasar es perder **el trabajo de un día**. Ese margen se llama **RPO** (punto de recuperación objetivo), y es una decisión de la empresa, no tuya: pregúntalo siempre.

{{< aviso titulo="La distinción que importa" >}}
Una **instantánea** de la VM no es una copia de seguridad: vive en el mismo almacenamiento que la máquina, y si se estropea el disco o un ransomware cifra el hipervisor, desaparecen las dos. Las instantáneas sirven para volver atrás tras un cambio; las copias, para sobrevivir a un desastre. Lo viste en el módulo 7 (copias de seguridad 3-2-1).
{{< /aviso >}}

{{< pregunta texto="¿Es una instantánea de la VM una copia de seguridad? (sí/no)" respuesta="no" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Prepara el disco de copias" %}}
Las copias **nunca** van al mismo disco que los datos. Apaga `SRV-FS01`, añádele un disco virtual de 30 GB y, al arrancar, inicialízalo como `F:`:

```
Get-Disk | Where-Object PartitionStyle -eq 'RAW' | Initialize-Disk -PartitionStyle GPT -PassThru | New-Partition -DriveLetter F -UseMaximumSize | Format-Volume -FileSystem NTFS -NewFileSystemLabel "Copias"
Install-WindowsFeature -Name Windows-Server-Backup -IncludeManagementTools
```

Crea también unos ficheros de prueba que puedas «perder» después:

```
Set-Content -Path "E:\Compartido\Administracion\nominas-octubre.txt" -Value "Nóminas de octubre"
Set-Content -Path "E:\Compartido\Ingenieria\plano-pieza-0042.txt" -Value "Plano de la pieza 0042"
```

**Cómo sabes que está bien:** `Get-Volume` muestra `E:` («Datos») y `F:` («Copias») como volúmenes distintos, y `wbadmin.msc` abre la consola de **Copias de seguridad de Windows Server**. Cuando lo tengas, marca la tarea.
{{% /tarea %}}

{{% tarea n="3" titulo="Haz la primera copia" %}}
Lanza una copia manual de la unidad de datos al disco de copias:

```
wbadmin start backup -backupTarget:F: -include:E: -quiet
```

Y comprueba que existe, con su identificador de versión:

```
wbadmin get versions -backupTarget:F:
```

El **identificador de versión** tiene el formato `MM/DD/AAAA-HH:MM`: el mes va primero, aunque tu Windows esté en español, y la hora puede no coincidir con la de tu reloj. Cópialo tal cual de la salida del comando: lo necesitarás para restaurar.

En el controlador de dominio, haz también una copia del **estado del sistema**, que es lo que permite recuperar Active Directory. Necesita un disco distinto del sistema, así que añade a `SRV-DC01` un disco virtual (por ejemplo, `F:`) igual que antes:

```
Install-WindowsFeature -Name Windows-Server-Backup -IncludeManagementTools
wbadmin start systemstatebackup -backupTarget:F: -quiet
```

**Cómo sabes que está bien:** `wbadmin get versions` muestra al menos una versión en cada servidor y el registro **Microsoft → Windows → Backup** del Visor de eventos no tiene errores.

{{< pregunta texto="¿Qué subcomando de `wbadmin` lista las copias disponibles en un destino?" respuesta="get versions|wbadmin get versions" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Simula el desastre y restaura" %}}
Ahora, la prueba de verdad. Alguien de Administración «ha borrado sin querer» las nóminas:

```
Remove-Item -Path "E:\Compartido\Administracion\nominas-octubre.txt"
```

Restaura la carpeta en **otra ubicación**, nunca encima de la original sin mirar antes qué vas a sobrescribir. Usa el identificador de versión de la tarea anterior (el de abajo es un ejemplo):

```
wbadmin start recovery -version:11/02/2026-20:00 -itemType:File -items:E:\Compartido\Administracion -backupTarget:F: -machine:SRV-FS01 -recoveryTarget:E:\Restaurado -recursive -quiet
```

Cuando indicas `-backupTarget`, `wbadmin` exige también `-machine` con el nombre del servidor cuya copia restauras.

Antes de seguir, mira dónde ha quedado lo restaurado:

```
Get-ChildItem -Path "E:\Restaurado" -Recurse
```

Lo normal es encontrar la carpeta como `E:\Restaurado\Administracion`; si en tu caso la ruta es otra, ajusta los comandos siguientes. Comprueba el fichero restaurado y sus permisos, y después devuélvelo a su sitio:

```
Get-Content -Path "E:\Restaurado\Administracion\nominas-octubre.txt"
icacls "E:\Restaurado\Administracion"
Copy-Item -Path "E:\Restaurado\Administracion\nominas-octubre.txt" -Destination "E:\Compartido\Administracion\"
```

`wbadmin` restaura también los permisos NTFS (salvo que añadas `-notRestoreAcl`), así que `icacls` debe mostrar otra vez `GG-Administracion`. Cuando termines, borra `E:\Restaurado`: una copia olvidada de las nóminas en otra carpeta es una fuga de datos esperando a ocurrir.

**Cómo sabes que está bien:** el fichero vuelve a estar en `\\srv-fs01\Administracion` con su contenido original y solo lo ve quien debe. Apunta en tu documentación cuánto has tardado: es tu primer **RTO** (tiempo de recuperación) medido.

{{< pregunta texto="¿Qué valor pones en `-itemType` para restaurar ficheros y carpetas?" respuesta="file" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Prográmala y aplica el 3-2-1" %}}
Una copia manual se olvida. Prográmala en `SRV-FS01`, desde la consola `wbadmin.msc` (**Programar copia de seguridad**) o con:

```
wbadmin enable backup -addtarget:F: -include:E: -schedule:21:00 -quiet
```

Y en `SRV-DC01`, una tarea programada que lance cada noche el `wbadmin start systemstatebackup` de la tarea 3. Ese comando no borra las copias antiguas por sí solo: para cumplir los 7 días de la tabla, añade a la misma tarea `wbadmin delete systemstatebackup -keepVersions:7 -quiet`, que conserva solo las siete más recientes.

Con eso tienes **dos copias** (los datos y la del disco `F:`), pero las dos viven en el mismo ordenador. Para cumplir la regla **3-2-1** (3 copias, en 2 soportes distintos, 1 fuera) falta la de fuera. En el laboratorio, basta con copiar la carpeta `F:\WindowsImageBackup` a un disco USB o a una carpeta de tu ordenador anfitrión de vez en cuando. En una empresa, esa copia iría a otra sede, a la nube o a cinta, y sería **inmutable** para que un ransomware no pudiera borrarla.

Checklist del hito:

1. Copia diaria programada de `E:` en `SRV-FS01`.
2. Copia del estado del sistema en `SRV-DC01`.
3. Una restauración real hecha, comprobada y documentada, con su tiempo.
4. Una copia fuera del laboratorio.
5. Un recordatorio en tu calendario para repetir la prueba de restauración cada mes.

Cuando lo tengas todo, marca la tarea.
{{% /tarea %}}
