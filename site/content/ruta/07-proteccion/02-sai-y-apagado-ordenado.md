---
title: "SAI y apagado ordenado"
description: "Qué hace un SAI, cuánto aguanta y cómo consigue que los servidores se apaguen solos y en orden antes de que se agote la batería."
weight: 2
equipo: "sai"
duracion: "40 min"
nivel: "Inicial"
objetivos:
  - "Distinguir los tipos de SAI y saber cuál se usa para servidores."
  - "Entender de qué depende la autonomía de un SAI."
  - "Explicar cómo se automatiza el apagado ordenado con la tarjeta de red y un agente como NUT."
  - "Diseñar el orden de apagado y encendido de una sala de servidores."
requisitos:
  - "Sala «Copias de seguridad que se pueden restaurar»"
  - "Módulo 2, sala «Linux para administradores»"
---

{{% tarea n="1" titulo="Qué es un SAI y qué tipos hay" %}}
Un **SAI** (Sistema de Alimentación Ininterrumpida; en inglés, **UPS**) es un equipo con baterías que mantiene encendido lo que tiene conectado cuando se va la luz. Su trabajo no es aguantar horas, sino **cubrir cortes cortos** y, si el corte se alarga, **dar tiempo a apagar de forma ordenada**. Un apagado de golpe puede corromper bases de datos y sistemas de ficheros.

Hay tres tipos, de más sencillo a más completo:

| Tipo | Cómo funciona | Dónde se usa |
| --- | --- | --- |
| **Off-line (standby)** | Los equipos van directos a la red eléctrica; si cae, conmuta a batería en unos milisegundos. | Puestos de trabajo y equipos domésticos. |
| **Línea interactiva** | Como el anterior, pero corrige subidas y bajadas de tensión sin gastar batería. | Armarios pequeños, switches, oficinas. |
| **On-line (doble conversión)** | Los equipos siempre se alimentan desde el inversor, que toma la energía de la red (a través del rectificador) o de la batería si la red cae. No hay conmutación. | Salas de servidores y equipos críticos. |

{{< pregunta texto="¿Qué tipo de SAI alimenta siempre los equipos desde el inversor, sin conmutar?" respuesta="on-line|online|on line|doble conversion|de doble conversion|on-line de doble conversion|online de doble conversion" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Autonomía: cuánto aguanta de verdad" %}}
La **autonomía** es el tiempo que el SAI puede alimentar la carga con la batería. No es un número fijo: depende de **cuánta carga** tenga conectada. El mismo SAI que aguanta 30 minutos al 25 % de carga puede aguantar solo unos pocos minutos al 90 %.

Tres cosas que conviene saber:

- La potencia de un SAI se indica en **VA** (voltamperios) y en **W** (vatios). Para dimensionar, fíjate en los **vatios**: es la potencia real que puede entregar.
- Las baterías **envejecen**: duran entre 3 y 5 años, y con el tiempo dan menos autonomía. Haz un **test de batería** periódico (por ejemplo, trimestral) y cámbialas cuando fallen.
- No enchufes al SAI lo que no lo necesita. Una impresora láser, por ejemplo, tiene picos de consumo que le restan autonomía a los servidores.

La propia pantalla del SAI o su tarjeta de red te dicen la carga actual y la autonomía estimada. Apúntalas en el inventario.

{{< pregunta texto="Si aumentas la carga conectada a un SAI, ¿su autonomía sube o baja?" respuesta="baja|disminuye|se reduce" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="El apagado ordenado, automático" %}}
Si se va la luz a las tres de la mañana nadie va a apagar los servidores a mano. Hace falta que el SAI **avise** y que cada equipo **se apague solo** cuando quede poca batería.

{{< aviso titulo="La distinción que importa" >}}
Conectar el SAI por **USB** a un servidor solo avisa a ese servidor. Lo correcto es que el SAI tenga una **tarjeta de red** (con SNMP, un protocolo estándar para supervisar equipos por la red) y que todos los servidores escuchen sus avisos a través de la red con un **agente**.
{{< /aviso >}}

Cada fabricante tiene su agente, y en Linux existe una opción libre muy extendida: **NUT** (Network UPS Tools). Funciona así:

1. Un equipo ejecuta el servidor de NUT (`upsd`), que recibe los datos del SAI a través de un driver (por ejemplo, el de SNMP para la tarjeta de red).
2. El resto de equipos ejecutan el monitor (`upsmon`) y le preguntan al servidor por el estado.
3. Cuando el SAI indica **batería baja**, cada `upsmon` lanza el apagado de su equipo.

Desde cualquier cliente puedes consultar el estado con `upsc` (el nombre del SAI y la IP son de ejemplo):

```
upsc sai01@192.168.50.5 ups.status
upsc sai01@192.168.50.5 battery.runtime
```

| Estado | Significado |
| --- | --- |
| `OL` | On line: con corriente de la red. |
| `OB` | On battery: funcionando con batería. |
| `LB` | Low battery: batería baja, hora de apagar. |

`battery.runtime` da la autonomía estimada en **segundos**.

{{< pregunta texto="En NUT, ¿qué código de estado indica que el SAI está funcionando con batería?" respuesta="ob|on battery|ob (on battery)" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="El orden importa (y hay que probarlo)" %}}
No todo se apaga a la vez. Si apagas la cabina de almacenamiento antes que los hipervisores, las VM pierden sus discos con todo encendido. El orden habitual:

| Al apagar | Al encender (al revés) |
| --- | --- |
| 1. Las máquinas virtuales (y sus servicios) | 1. Red: switches y firewall |
| 2. Los hipervisores | 2. Almacenamiento |
| 3. El almacenamiento | 3. Hipervisores |
| 4. La red, la última (o se deja hasta que el SAI se agote) | 4. Máquinas virtuales, empezando por el controlador de dominio y el DNS |

¿Por qué hay que **probarlo**? Porque es una configuración que solo se ejecuta en una emergencia. Si una contraseña del agente caducó, un servidor nuevo no tiene el agente o el tiempo de apagado es más largo que la autonomía, lo descubrirás el día del corte. Pruébalo al menos una vez al año, en una ventana de mantenimiento pactada y con copias recientes, y apunta cuánto tarda cada fase.

En el laboratorio no tienes SAI, pero sí puedes preparar el plan: escribe el orden de apagado y de encendido de tu laboratorio (Ubuntu, `SRV-DC01` y el hipervisor) y marca la tarea.
{{% /tarea %}}
