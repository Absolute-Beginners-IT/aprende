---
title: "Máquinas virtuales, plantillas e instantáneas"
description: "Crea servidores en minutos a partir de una plantilla y usa las instantáneas para lo que sirven, sin confundirlas con una copia de seguridad."
weight: 2
equipo: "capas"
duracion: "50 min"
nivel: "Inicial"
objetivos:
  - "Saber de qué ficheros se compone una máquina virtual."
  - "Usar instantáneas antes de un cambio y entender por qué no son copias de seguridad."
  - "Preparar una plantilla y clonar servidores a partir de ella sin duplicar identidades."
requisitos:
  - "Sala «Hipervisores en la empresa»"
  - "Salas «Windows Server: primeros pasos» y «Linux para administradores»"
---

{{% tarea n="1" titulo="Una VM son ficheros" %}}
Para el hipervisor, una máquina virtual es poco más que unos ficheros en un disco:

| Pieza | Qué guarda | Ejemplos de extensión |
| --- | --- | --- |
| **Configuración** | Cuántas vCPU, cuánta RAM, qué tarjetas de red, qué discos. | `.vmx` (VMware), `.vbox` (VirtualBox) |
| **Disco virtual** | Todo el contenido del disco de la VM: sistema, programas y datos. | `.vmdk` (VMware), `.vhdx` (Hyper-V), `.vdi` (VirtualBox), `.qcow2` (Proxmox/KVM) |

Esto tiene una consecuencia enorme: copiar, mover o duplicar un servidor es copiar ficheros. Gracias a eso existen las plantillas, las instantáneas y las copias de seguridad de VM completas.

{{< pregunta texto="¿Qué extensión tienen los discos virtuales de Hyper-V?" respuesta="vhdx|.vhdx|vhd" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Instantáneas: volver atrás tras un cambio" %}}
Una **instantánea** (*snapshot*; en Hyper-V, **punto de control**) congela el estado de la VM en un momento. A partir de ahí, el hipervisor deja el disco original intacto y escribe los cambios en un fichero aparte. Si el cambio sale mal, descartas ese fichero y vuelves al punto de partida.

Úsalas así:

1. Haz la instantánea **justo antes** de un cambio arriesgado: una actualización, un cambio de configuración, instalar un programa.
2. Comprueba que todo funciona.
3. **Elimínala** en cuanto confirmes que el cambio está bien (horas o pocos días, no meses).

Una instantánea olvidada sigue creciendo con cada cambio, ocupa espacio en el almacén y hace que el disco de la VM vaya más lento.

{{< aviso titulo="La distinción que importa" >}}
Una instantánea **no es una copia de seguridad**. Depende del disco original y vive en el mismo almacenamiento: si ese disco se corrompe, se borra o se pierde el servidor, la instantánea desaparece con él. Una copia de seguridad es una copia independiente, guardada en otro sitio. Lo verás a fondo en el módulo 7.
{{< /aviso >}}

{{< pregunta texto="Si se estropea el almacenamiento donde está la VM, ¿te salva una instantánea? (si/no)" respuesta="no" pista="Piensa en dónde se guarda la instantánea y de qué depende." >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Pruébalo: instantánea y vuelta atrás" %}}
En tu VM de Ubuntu (`192.168.50.20`):

1. Desde el hipervisor, haz una instantánea llamada `antes-de-romper`.
2. Conéctate por SSH y «rompe» algo inofensivo, por ejemplo:

```
sudo touch /etc/esto-no-deberia-estar
ls /etc/esto-no-deberia-estar
```

3. Apaga la VM, restaura la instantánea `antes-de-romper` y arráncala.
4. Comprueba que el fichero ya no existe:

```
ls /etc/esto-no-deberia-estar
```

Debe responder que no existe. Después, elimina la instantánea (no la restaures: elimínala) para no dejarla olvidada, y marca la tarea.
{{% /tarea %}}

{{% tarea n="4" titulo="Plantillas: servidores en minutos" %}}
Instalar un Windows Server desde la ISO cuesta casi una hora. En una empresa se hace una vez: se instala, se actualiza, se deja con la configuración común y se convierte en **plantilla**. Cada servidor nuevo es un **clon** de esa plantilla.

El problema: un clon es idéntico al original, incluidos datos que deberían ser únicos en cada equipo. Antes de convertir una VM en plantilla hay que **generalizarla**:

| Sistema | Qué hay que hacer único | Cómo se generaliza |
| --- | --- | --- |
| **Windows** | El identificador de seguridad del equipo (**SID**), el nombre, la activación. | Con **Sysprep**: `C:\Windows\System32\Sysprep\sysprep.exe /generalize /oobe /shutdown` |
| **Linux (Ubuntu)** | El identificador de máquina (`/etc/machine-id`), las claves SSH del servidor, el nombre. | Vaciando `/etc/machine-id` y borrando las claves SSH para que se regeneren. |

Además, cada clon necesita su propia **dirección MAC** (la dirección física de la tarjeta de red), un nombre y una IP distintos. Los hipervisores generan MAC nuevas al clonar si se lo pides.

{{< aviso titulo="La distinción que importa" >}}
Dos equipos Windows clonados sin Sysprep comparten SID y dan problemas difíciles de diagnosticar, sobre todo al unirlos a un dominio. Generaliza siempre la plantilla, no cada clon.
{{< /aviso >}}

{{< pregunta texto="¿Qué herramienta de Windows generaliza un sistema antes de convertirlo en plantilla?" respuesta="sysprep|sysprep.exe" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Pruébalo: clona tu Ubuntu desde una plantilla" %}}
Vas a crear una plantilla a partir de una **copia** de tu Ubuntu, para no tocar la VM que ya usas.

1. Apaga el Ubuntu y haz un **clon completo** llamado `PLANTILLA-UBUNTU` (en VirtualBox: botón derecho → **Clonar**, eligiendo generar nuevas direcciones MAC).
2. Arranca `PLANTILLA-UBUNTU`, entra en su consola y generalízala:

```
sudo truncate -s 0 /etc/machine-id
sudo rm /etc/ssh/ssh_host_*
sudo poweroff
```

3. A partir de ahora no arranques la plantilla: solo se clona. Haz un clon de ella llamado `SRV-WEB01`.
4. Arranca `SRV-WEB01` y, desde su consola (el SSH no funcionará hasta regenerar las claves), cámbiale el nombre y regenera las claves SSH:

```
sudo hostnamectl set-hostname SRV-WEB01
sudo dpkg-reconfigure openssh-server
cat /etc/machine-id
```

`/etc/machine-id` ya no está vacío: el sistema generó uno nuevo al arrancar. Por último, comprueba con `ip a` que el clon tiene una IP distinta de la del Ubuntu original (si en tu laboratorio usas IP fijas, dale una libre, por ejemplo `192.168.50.21`), y marca la tarea.
{{% /tarea %}}
