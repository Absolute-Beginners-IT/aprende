---
title: "Monta tu laboratorio"
description: "Un entorno de máquinas virtuales en tu ordenador donde practicar todo lo de la ruta sin miedo a romper nada."
weight: 2
equipo: "portatil"
duracion: "40 min (más las descargas)"
nivel: "Inicial"
objetivos:
  - "Saber qué es un hipervisor y cuál elegir."
  - "Comprobar que tu ordenador puede virtualizar."
  - "Elegir el tipo de red de las máquinas virtuales sin afectar a la red real."
requisitos:
  - "Un ordenador con al menos 8 GB de RAM (mejor 16 GB)"
---

{{% tarea n="1" titulo="Por qué un laboratorio" %}}
En sistemas se aprende **haciendo**, y haciendo se rompen cosas. Un laboratorio es un conjunto de **máquinas virtuales** (ordenadores simulados) que viven dentro de tu ordenador: puedes instalar un servidor, estropearlo y volver atrás en minutos.

El programa que crea y ejecuta las máquinas virtuales se llama **hipervisor**. Reparte la CPU, la memoria y el disco de tu ordenador entre ellas.

{{< pregunta texto="¿Cómo se llama el software que ejecuta varias máquinas virtuales en un mismo equipo?" respuesta="hipervisor|un hipervisor|el hipervisor" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Comprueba tu ordenador" %}}
Para el laboratorio de esta ruta (un Windows Server y un Linux encendidos a la vez) necesitas:

| Recurso | Mínimo | Recomendado |
| --- | --- | --- |
| Memoria RAM | 8 GB | 16 GB o más |
| Disco libre | 80 GB | 150 GB en SSD |
| CPU | Con virtualización por hardware | 4 núcleos o más |

La virtualización por hardware se llama **Intel VT-x** o **AMD-V** y se activa en la BIOS/UEFI. En Windows, abre el **Administrador de tareas → Rendimiento → CPU** y mira la línea «Virtualización»: debe poner «Habilitado».

{{< pregunta texto="¿Cómo se llama la virtualización por hardware en los procesadores Intel?" respuesta="vt-x|intel vt-x|vtx|intel vtx" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Elige el hipervisor" %}}
| Opción | Cuándo elegirla |
| --- | --- |
| **VirtualBox** | Gratuito y sencillo. Buena opción para empezar en tu propio ordenador. |
| **Hyper-V** | Viene con Windows Pro, Enterprise y Education. Es el mismo hipervisor que usan muchas empresas. |
| **Proxmox VE** | Si tienes un PC viejo que dedicar solo al laboratorio. Es lo más parecido a un servidor de empresa. |

Instala uno. Si dudas, empieza con VirtualBox: lo que aprendas te sirve para los demás. Cuando lo tengas instalado, marca la tarea.
{{% /tarea %}}

{{% tarea n="4" titulo="Descarga los sistemas operativos" %}}
Usarás dos sistemas, ambos gratuitos para practicar:

- **Windows Server** (versión de evaluación de 180 días), desde el Centro de evaluación de Microsoft.
- **Ubuntu Server** (la versión LTS más reciente), desde la web oficial de Ubuntu.

Descárgalos **solo de las webs oficiales**. Una imagen de origen desconocido puede traer cualquier cosa dentro. No los instales todavía: lo harás en el módulo 2. Marca la tarea cuando tengas las dos imágenes ISO.
{{% /tarea %}}

{{% tarea n="5" titulo="La red del laboratorio" %}}
Cada máquina virtual tiene una tarjeta de red virtual, y tú decides a qué se conecta:

| Modo | Qué hace | Riesgo |
| --- | --- | --- |
| **NAT** | La VM sale a Internet a través de tu ordenador, pero nadie de fuera la ve. Cada VM queda aislada en su propia red (`10.0.2.0/24` en VirtualBox). | Ninguno, pero las VM no se ven entre ellas. Sirve para una VM suelta. |
| **Red NAT** | Como NAT, pero todas las VM conectadas comparten una red cuyo rango eliges tú, con la puerta de enlace en `.1`. | Ninguno. **Es la que usarás en esta ruta**, con el rango `192.168.50.0/24`. En Hyper-V, el equivalente es un conmutador interno con NAT. |
| **Red interna** | Las VM solo se ven entre ellas, sin salida a Internet. | Ninguno. Útil para redes aisladas, como las VLAN del módulo 5. |
| **Adaptador puente** | La VM se conecta directamente a tu red real, como un equipo más. | Si montas un DHCP o un DNS en la VM, puedes estropear la red de tu casa o de tu empresa. |

{{< aviso titulo="La distinción que importa" >}}
Un servidor DHCP de laboratorio conectado en modo puente a la red de la oficina empezará a repartir direcciones a los equipos reales. Usa Red NAT o red interna salvo que sepas exactamente por qué necesitas el puente.
{{< /aviso >}}

{{< pregunta texto="¿Qué modo conecta la máquina virtual directamente a tu red real?" respuesta="puente|adaptador puente|bridge|modo puente" >}}
{{% /tarea %}}
