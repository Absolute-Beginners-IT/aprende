---
title: "Qué hay en una infraestructura"
description: "Las piezas de una pyme típica y por qué se miran por capas."
weight: 1
equipo: "switch"
duracion: "30 min"
nivel: "Inicial"
aliases: ["/lecciones/01-que-hay-en-una-infraestructura/"]
objetivos:
  - "Nombrar las cuatro capas de una infraestructura y poner un ejemplo de cada una."
  - "Saber qué vigilar en cada tipo de equipo."
  - "Encontrar puntos únicos de fallo en un mapa."
requisitos:
  - "Módulo 1 (redes)"
  - "Módulo 2 (sistemas operativos)"
---

{{% tarea n="1" titulo="La idea básica: capas" %}}
Una infraestructura no es una lista de equipos: son **capas** que se apoyan unas en otras. Si entiendes las capas, sabrás por dónde empezar a buscar cuando algo falla.

| Capa | Qué contiene | Pregunta que responde |
| --- | --- | --- |
| Física | Operadora, firewall, switches, wifi, servidores, almacenamiento | ¿Por dónde viajan los datos? |
| Lógica | VLANs y subredes | ¿Quién puede hablar con quién? |
| Servicios | Directorio activo, DNS, DHCP, ficheros, aplicaciones | ¿Qué usan las personas? |
| Protección | Copias de seguridad, SAI, monitorización | ¿Qué evita perder datos o servicio? |

{{< aviso titulo="La distinción que importa" >}}
Que un servidor responda a ping no significa que el servicio funcione. La capa física puede estar bien y el servicio (por ejemplo, el DNS) estar caído.
{{< /aviso >}}

{{< pregunta texto="¿En qué capa están las VLAN?" respuesta="logica|capa logica|la capa logica" pista="Las VLAN deciden quién puede hablar con quién." >}}
{{< pregunta texto="¿En qué capa está el SAI?" respuesta="proteccion|capa de proteccion|la capa de proteccion" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Qué vigilar en cada equipo" %}}
Esta tabla sale de la misma base de conocimiento que usa el mapa:

{{< tipos-de-equipo >}}

{{< pregunta texto="¿Qué servicio traduce nombres (como `servidor01`) en direcciones IP?" respuesta="dns|el dns" >}}
{{< pregunta texto="¿Y cuál reparte las direcciones IP a los equipos?" respuesta="dhcp|el dhcp" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Errores frecuentes" %}}
| Error | Mejor decisión |
| --- | --- |
| Pensar que dos equipos iguales dan alta disponibilidad completa. | Buscar los demás puntos únicos de fallo: alimentación, switch core, almacenamiento. |
| Hacer copias de seguridad en el mismo disco o la misma cabina. | Copias 3-2-1 y pruebas de restauración. |
| Olvidar las impresoras y los SAI en el inventario. | Inventariar todo lo que tenga IP o alimente algo crítico. |

{{< pregunta texto="¿Cómo se llama la regla de copias «3 copias, 2 soportes distintos, 1 fuera de la oficina»?" respuesta="3-2-1|321|3 2 1|regla 3-2-1" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Explora el mapa" %}}
Abre el [mapa interactivo]({{< param "appURL" >}}) y haz esto:

1. Desactiva todas las capas menos la **física** y pulsa en el firewall: lee qué pasa si falla.
2. Activa la capa **lógica** y fíjate en qué VLAN está cada grupo de equipos.
3. Busca **dos puntos únicos de fallo**: piezas que, si se rompen, dejan sin servicio a mucha gente y no tienen otra que las sustituya.

Cuando los tengas localizados, marca la tarea como completada.
{{% /tarea %}}
