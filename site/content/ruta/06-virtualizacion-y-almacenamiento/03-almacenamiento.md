---
title: "Discos, RAID, NAS y SAN"
description: "Dónde se guardan de verdad los datos y las máquinas virtuales: tipos de disco, niveles de RAID y la diferencia entre un NAS y una SAN."
weight: 3
equipo: "disco"
duracion: "50 min"
nivel: "Inicial"
objetivos:
  - "Elegir entre discos de aprovisionamiento fino y grueso."
  - "Comparar RAID 1, 5, 6 y 10 y calcular su capacidad útil."
  - "Distinguir el almacenamiento de ficheros (NAS) del de bloques (SAN)."
  - "Añadir un disco a una VM y prepararlo en Windows y en Linux."
requisitos:
  - "Sala «Máquinas virtuales, plantillas e instantáneas»"
---

{{% tarea n="1" titulo="Discos físicos y discos virtuales" %}}
Debajo de todo hay discos físicos:

| Tipo | Ventaja | Inconveniente | Uso típico |
| --- | --- | --- | --- |
| **HDD** (disco duro mecánico) | Mucha capacidad por poco dinero. | Lento en accesos aleatorios. | Copias de seguridad, archivo, ficheros grandes. |
| **SSD** (disco de estado sólido) | Muy rápido. | Más caro por GB. | Sistemas operativos, bases de datos, máquinas virtuales. |

Sobre ellos, el hipervisor crea los discos virtuales de las VM de dos formas:

- **Aprovisionamiento grueso** (*thick*): el fichero ocupa desde el principio todo el tamaño del disco. Si das 100 GB, se reservan 100 GB.
- **Aprovisionamiento fino** (*thin*, o «dinámico» en Hyper-V y VirtualBox): el fichero empieza pequeño y crece a medida que la VM escribe datos.

El fino ahorra espacio y permite sobreasignar disco, pero exige vigilar el almacén: si se llena, todas las VM que viven en él se detienen a la vez.

{{< pregunta texto="¿Cómo se llama el aprovisionamiento en el que el disco virtual crece a medida que se escriben datos?" respuesta="fino|thin|dinamico|aprovisionamiento fino|aprovisionamiento dinamico" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="RAID: que un disco roto no pare el servidor" %}}
Los discos se estropean; es cuestión de tiempo. **RAID** (conjunto redundante de discos independientes) combina varios discos para que el sistema siga funcionando cuando falla uno. Lo gestiona una controladora del servidor o el propio sistema operativo.

| Nivel | Mínimo de discos | Capacidad útil | Fallos que aguanta | Comentario |
| --- | --- | --- | --- | --- |
| **RAID 1** (espejo) | 2 | La de un disco (50 %) | 1 | Sencillo y fiable. Típico para el disco del sistema. |
| **RAID 5** | 3 | Todos menos uno | 1 | Aprovecha bien el espacio, pero con discos grandes la reconstrucción es lenta y arriesgada. |
| **RAID 6** | 4 | Todos menos dos | 2 | Como RAID 5, pero aguanta un segundo fallo durante la reconstrucción. |
| **RAID 10** (espejos combinados) | 4 | La mitad (50 %) | 1 seguro; hasta uno por cada espejo si fallan en espejos distintos | El más rápido; muy usado para VM y bases de datos. |

Ejemplo con **4 discos de 4 TB**: en RAID 5 tienes 12 TB útiles; en RAID 6, 8 TB; en RAID 10, 8 TB.

Cuando un disco falla, el RAID queda **degradado**: sigue funcionando, pero sin margen. Hay que cambiar el disco cuanto antes para que se **reconstruya**. Por eso es vital que alguien reciba las alertas de la controladora o del NAS.

{{< pregunta texto="Con 4 discos de 4 TB en RAID 6, ¿cuántos TB útiles tienes?" respuesta="8|8 tb|8tb" pista="En RAID 6 pierdes la capacidad de dos discos." >}}
{{% /tarea %}}

{{% tarea n="3" titulo="RAID no es copia de seguridad" %}}
RAID te protege de **un** tipo de problema: que se rompa un disco. Contra todo lo demás no hace nada:

- Si alguien borra una carpeta, el RAID borra la carpeta en todos los discos a la vez.
- Si un *ransomware* (programa que cifra tus datos para pedir un rescate) cifra los ficheros, el RAID guarda fielmente los ficheros cifrados.
- Si hay un incendio, se inunda la sala o roban el servidor, se pierden todos los discos juntos.

Pulsa cada etapa para ver qué te salva un espejo y qué no:

{{< evolucion datos="raid-espejo" >}}

{{< aviso titulo="La distinción que importa" >}}
RAID sirve para **disponibilidad**: que el servicio no se pare por un disco roto. Las copias de seguridad sirven para **recuperar** datos perdidos. Necesitas las dos cosas; una no sustituye a la otra.
{{< /aviso >}}

{{< pregunta texto="Un usuario borra por error una carpeta de un servidor con RAID 1. ¿El RAID te permite recuperarla? (si/no)" respuesta="no" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="NAS y SAN" %}}
Cuando el almacenamiento no está dentro del propio servidor, sino en un equipo aparte al que se accede por red, hay dos enfoques:

| | **NAS** (almacenamiento conectado a la red) | **SAN** (red de área de almacenamiento) |
| --- | --- | --- |
| Qué ofrece | **Ficheros y carpetas** compartidos. | **Bloques**: discos «en crudo» que el servidor ve como si fueran locales. |
| Protocolos | **SMB** (el de las carpetas compartidas de Windows) y **NFS** (habitual en Linux y VMware). | **iSCSI** (sobre la red Ethernet normal) y **Fibre Channel** (red dedicada de fibra). |
| Quién gestiona el sistema de ficheros | El propio NAS. | El servidor que usa el disco: lo formatea con NTFS, ext4, VMFS… |
| Uso típico | Carpetas de departamento, copias de seguridad, almacén de VM por NFS. | Almacén compartido de VM en un clúster, bases de datos. |

En iSCSI, el servidor que usa el disco es el **iniciador** y el equipo que lo ofrece es el **destino** (*target*); cada disco ofrecido se llama **LUN** (número de unidad lógica).

Muchos NAS de pyme pueden hacer las dos cosas: compartir carpetas por SMB y ofrecer LUN por iSCSI. Lo que cambia es **cómo** se accede, no la caja.

{{< pregunta texto="¿Qué protocolo ofrece almacenamiento de bloques sobre una red Ethernet normal?" respuesta="iscsi" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Pruébalo: añade un segundo disco a tus VM" %}}
Apaga `SRV-DC01` y añádele, desde el hipervisor, un segundo disco virtual de **10 GB** de aprovisionamiento fino. Arráncala y, en PowerShell como administrador:

```
Get-Disk
Initialize-Disk -Number 1 -PartitionStyle GPT
New-Partition -DiskNumber 1 -UseMaximumSize -AssignDriveLetter | Format-Volume -FileSystem NTFS -NewFileSystemLabel "Datos"
```

`Get-Disk` te muestra el disco nuevo sin inicializar; comprueba que su número es el 1 antes de seguir. En gráfico, lo mismo se hace en **Administración de discos** (`diskmgmt.msc`).

Haz lo mismo con tu Ubuntu y mira cómo aparece:

```
lsblk
```

El disco nuevo sale como `sdb` (o `vdb`, según el hipervisor), sin particiones. Cuando veas el disco en los dos sistemas, marca la tarea.
{{% /tarea %}}
