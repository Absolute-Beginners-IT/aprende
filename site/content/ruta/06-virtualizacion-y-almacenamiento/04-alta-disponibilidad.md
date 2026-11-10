---
title: "Alta disponibilidad y puntos únicos de fallo"
description: "Cómo se monta un clúster de virtualización para que un servidor roto no pare la empresa, y cómo encontrar lo que todavía puede pararla."
weight: 4
equipo: "escudo"
duracion: "40 min"
nivel: "Intermedio"
objetivos:
  - "Explicar qué es un clúster de virtualización y por qué necesita almacenamiento compartido."
  - "Distinguir la migración en vivo del reinicio por alta disponibilidad."
  - "Detectar los puntos únicos de fallo de una infraestructura."
requisitos:
  - "Salas «Hipervisores en la empresa» y «Discos, RAID, NAS y SAN»"
---

{{% tarea n="1" titulo="Un clúster de hosts" %}}
Con un solo host, todas las VM dependen de un único servidor físico: si se le rompe la placa, se paran todas. La solución es un **clúster**: varios hosts que trabajan como un conjunto y pueden ejecutar cualquiera de las VM.

Para que una VM pueda arrancar en cualquier host, sus discos no pueden estar dentro de uno de ellos. Tienen que estar en un **almacenamiento compartido** al que lleguen todos:

```
   [Host A]      [Host B]      [Host C]
       \             |             /
        \------ red de almacenamiento ------/
                     |
       [Almacenamiento compartido: SAN o NAS]
         (aquí viven los discos de las VM)
```

También existe el almacenamiento **hiperconvergente**: los discos de los propios hosts se combinan por software en un almacén compartido (VMware vSAN, Storage Spaces Direct en Windows, Ceph en Proxmox VE).

{{< pregunta texto="¿Qué necesitan los hosts de un clúster para que cualquiera de ellos pueda ejecutar una VM?" respuesta="almacenamiento compartido|un almacenamiento compartido|almacenamiento comun" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Migración en vivo y alta disponibilidad" %}}
Un clúster ofrece dos cosas distintas que es fácil confundir:

| | **Migración en vivo** | **Alta disponibilidad (HA)** |
| --- | --- | --- |
| Cuándo ocurre | La lanzas tú, con los hosts funcionando. | Automáticamente, cuando un host **falla**. |
| Qué hace | Copia la memoria de la VM encendida a otro host y la mueve sin apagarla. | Arranca de nuevo en otros hosts las VM que se ejecutaban en el host caído. |
| Corte de servicio | Prácticamente ninguno. | Sí: lo que tarda la VM en arrancar otra vez. |
| Nombre en cada plataforma | vMotion (VMware), Migración en vivo (Hyper-V y Proxmox VE). | vSphere HA, clúster de conmutación por error de Windows, Proxmox VE HA. |

La migración en vivo es la que te permite actualizar o reparar un host en horario laboral: vacías el host moviendo sus VM a los demás, lo reinicias y las devuelves.

Pulsa cada etapa para ver la diferencia en un clúster de tres hosts:

{{< evolucion datos="alta-disponibilidad" >}}

Los clústeres usan también el **quórum**: los hosts votan para decidir quién sigue funcionando si se pierden de vista entre ellos, y así evitar que dos mitades arranquen la misma VM a la vez. Por eso se recomiendan al menos tres votos (tres hosts, o dos hosts y un **testigo**).

{{< aviso titulo="La distinción que importa" >}}
La alta disponibilidad no evita el corte: lo acorta. Si el host cae, sus VM se apagan de golpe, como si les quitaras la corriente, y arrancan en otro host al cabo de unos minutos. Para que un servicio no se note ni eso, hay que duplicarlo en la propia aplicación (por ejemplo, dos controladores de dominio).
{{< /aviso >}}

{{< pregunta texto="¿Cómo se llama la migración en vivo en VMware?" respuesta="vmotion|vsphere vmotion" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Puntos únicos de fallo" %}}
Un **punto único de fallo** (*SPOF*, del inglés *single point of failure*) es cualquier pieza cuya avería detiene el servicio entero porque no tiene repuesto. Un clúster de tres hosts no sirve de mucho si todos dependen de:

- **Un único almacenamiento compartido**: si cae la cabina o el NAS, caen todas las VM a la vez.
- **Un único switch** que conecta los hosts con el almacenamiento.
- **Una única fuente de alimentación** por servidor, o un único SAI (sistema de alimentación ininterrumpida).
- **Una única línea de Internet** o un único cortafuegos.
- **Un único controlador de dominio**: sin él, nadie inicia sesión.
- **Una única persona** que conoce las contraseñas o sabe cómo funciona algo.

Para encontrarlos, sigue el camino de un servicio de punta a punta (del usuario a los datos) y pregúntate en cada pieza: **«si esto se rompe ahora mismo, ¿qué deja de funcionar?»**. Si la respuesta es «todo», has encontrado un punto único de fallo.

No hace falta eliminarlos todos: a veces duplicar algo cuesta más que el tiempo de parada. Lo importante es **conocerlos**, decidirlo a conciencia y tener un plan para cuando fallen.

{{< pregunta texto="¿Cómo se llama una pieza cuya avería detiene todo el servicio porque no tiene repuesto?" respuesta="punto unico de fallo|un punto unico de fallo|spof|single point of failure" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Pruébalo: busca los puntos únicos de fallo de tu laboratorio" %}}
Toma tu laboratorio como si fuera una empresa pequeña y apunta en una tabla cada pieza y qué pasaría si fallara:

| Pieza | Si falla… | ¿Tiene repuesto? |
| --- | --- | --- |
| Tu ordenador (el host) | Se paran todas las VM. | No |
| `SRV-DC01` (`192.168.50.10`) | | |
| El disco donde guardas las VM | | |
| La red virtual del laboratorio | | |

Complétala y añade al menos dos piezas más. Después, elige un punto único de fallo y escribe cómo lo eliminarías en una empresa real (por ejemplo, un segundo controlador de dominio). Guarda la tabla: te servirá en el proyecto final. Cuando la tengas, marca la tarea.
{{% /tarea %}}
