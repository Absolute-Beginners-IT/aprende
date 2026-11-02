---
title: "Hipervisores en la empresa"
description: "Qué diferencia al hipervisor de tu portátil del que mueve los servidores de una empresa, qué opciones hay y cómo se reparten la CPU y la memoria."
weight: 1
equipo: "servidor"
duracion: "35 min"
nivel: "Inicial"
objetivos:
  - "Distinguir un hipervisor de tipo 1 de uno de tipo 2."
  - "Reconocer VMware vSphere, Hyper-V y Proxmox VE y sus herramientas de gestión."
  - "Entender qué es la sobreasignación de CPU y memoria y dónde está el límite."
requisitos:
  - "Sala «Monta tu laboratorio»"
  - "Módulo 2 (sistemas operativos)"
---

{{% tarea n="1" titulo="Tipo 1 y tipo 2" %}}
En la sala «Monta tu laboratorio» instalaste un hipervisor en tu ordenador. Ese hipervisor es un programa más, que corre **encima** de tu Windows, Linux o macOS. En una empresa los servidores físicos se dedican solo a virtualizar, y el hipervisor se instala **directamente sobre el hardware**.

| Tipo | Dónde se instala | Ejemplos | Uso habitual |
| --- | --- | --- | --- |
| **Tipo 1** (*bare metal*, «sobre el metal») | Directamente en el servidor físico, sin sistema operativo debajo. | VMware ESXi, Hyper-V, Proxmox VE | Producción: los servidores de la empresa. |
| **Tipo 2** (alojado) | Como una aplicación dentro de un sistema operativo normal. | VirtualBox, VMware Workstation | Laboratorios, pruebas y equipos de desarrollo. |

Un hipervisor de tipo 1 rinde más y es más estable, porque no compite con un sistema operativo de escritorio por los recursos ni se reinicia cuando ese sistema se actualiza.

{{< aviso titulo="La distinción que importa" >}}
Hyper-V parece de tipo 2 porque lo activas desde Windows, pero no lo es: al activarlo, el hipervisor arranca primero, sobre el hardware, y tu Windows pasa a ejecutarse encima de él como una partición especial de gestión. Por eso se considera de **tipo 1**.
{{< /aviso >}}

{{< pregunta texto="¿De qué tipo es un hipervisor que se instala directamente sobre el hardware, sin sistema operativo debajo?" respuesta="tipo 1|1|de tipo 1|tipo uno|bare metal|baremetal" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Los tres que vas a encontrar" %}}
En las pymes casi siempre te toparás con uno de estos tres:

| Plataforma | El hipervisor | La consola de gestión | Notas |
| --- | --- | --- | --- |
| **VMware vSphere** | ESXi | vCenter Server (gestiona varios hosts a la vez) | Muy extendido en empresas de todos los tamaños. |
| **Microsoft Hyper-V** | Hyper-V, como rol de Windows Server | Administrador de Hyper-V y Administrador de clústeres de conmutación por error | Encaja bien donde ya todo es Microsoft. |
| **Proxmox VE** | KVM, integrado en el núcleo de Linux | Interfaz web propia (puerto 8006 por defecto) | Código abierto; la suscripción de soporte es opcional. |

Un **host** (anfitrión) es cada servidor físico que ejecuta el hipervisor; las máquinas virtuales que corren dentro se llaman **invitadas** (*guests*).

Tras la compra de VMware por Broadcom cambió su modelo de licencias, y eso llevó a muchas pymes a evaluar Hyper-V y Proxmox VE como alternativas. Por eso conviene que conozcas los tres: los conceptos (hosts, almacenes de datos, redes virtuales, instantáneas) son los mismos y solo cambian los nombres de los menús.

{{< pregunta texto="¿Cómo se llama el hipervisor de tipo 1 de VMware?" respuesta="esxi|vmware esxi" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="vCPU y memoria: repartir lo que hay" %}}
Cuando creas una VM le das **vCPU** (procesadores virtuales) y RAM. El hipervisor reparte entre todas las VM los núcleos y la memoria reales del host.

**Sobreasignar** (*overcommit*) es dar a las VM, en total, más recursos de los que el host tiene físicamente. Funciona porque las VM casi nunca usan todo a la vez, pero cada recurso se comporta distinto:

| Recurso | ¿Se puede sobreasignar? | Qué pasa si te pasas |
| --- | --- | --- |
| **CPU** | Sí, y es lo normal: varias vCPU comparten cada núcleo físico. | Las VM esperan turno para usar la CPU y todo va lento, pero sigue funcionando. |
| **Memoria RAM** | Con mucho cuidado. Algunos hipervisores la ajustan en caliente (en Hyper-V, *memoria dinámica*). | El host tiene que quitar memoria a las VM o usar el disco como memoria, y el rendimiento se hunde. |
| **Disco** | Sí, con discos de aprovisionamiento fino (lo verás en la sala de almacenamiento). | Si el almacén se llena de verdad, las VM se detienen. |

Ejemplo: un host con 16 núcleos físicos puede ejecutar sin problema VM que suman 40 vCPU si están tranquilas. En cambio, si tiene 128 GB de RAM, no le asignes 200 GB y esperes que vaya bien.

{{< aviso titulo="La distinción que importa" >}}
Dar más vCPU a una VM no siempre la acelera: una VM con muchas vCPU tiene que esperar a que haya varios núcleos libres a la vez. Empieza con pocas y súbelas si las métricas demuestran que hacen falta.
{{< /aviso >}}

{{< pregunta texto="¿Qué recurso se sobreasigna con normalidad y con menos riesgo: la CPU o la memoria?" respuesta="cpu|la cpu|procesador|el procesador" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Mira los recursos de tu host" %}}
Abre tu hipervisor de laboratorio y anota, para tu ordenador (el host):

1. Cuántos núcleos y cuánta RAM tiene. En Windows, **Administrador de tareas → Rendimiento**.
2. Cuántas vCPU y cuánta RAM has dado a `SRV-DC01` y a tu Ubuntu.
3. Si sumas la RAM de las dos VM, ¿cuánta le queda libre a tu propio sistema?

Si las VM se comen casi toda la RAM, tu ordenador irá lento con todo encendido: baja la memoria del Ubuntu a 2 GB, que le sobra para lo que hace. Cuando tengas los números, marca la tarea.
{{% /tarea %}}
