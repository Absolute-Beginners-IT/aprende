---
title: "Qué hay en una infraestructura"
description: "Las piezas de una pyme típica y por qué se miran por capas."
leccion: "01"
weight: 1
---

## La idea básica

Una infraestructura no es una lista de equipos: son **capas** que se apoyan unas en otras. Si entiendes las capas, sabrás por dónde empezar a buscar cuando algo falla.

| Capa | Qué contiene | Pregunta que responde |
| --- | --- | --- |
| Física | Operadora, firewall, switches, wifi, servidores, almacenamiento | ¿Por dónde viajan los datos? |
| Lógica | VLANs y subredes | ¿Quién puede hablar con quién? |
| Servicios | Directorio activo, DNS, DHCP, ficheros, aplicaciones | ¿Qué usan las personas? |
| Protección | Copias de seguridad, SAI, monitorización | ¿Qué evita perder datos o servicio? |

{{< aviso titulo="No son las capas del modelo OSI" >}}
Estas cuatro capas son una forma práctica de mirar la infraestructura de una empresa, propia de esta guía. No son las 7 capas del modelo OSI ni las 4 del modelo TCP/IP (acceso a la red, internet, transporte y aplicación), que describen cómo viaja la información por la red. Las vas a necesitar las dos: OSI para entender la red y estas capas para ordenar la infraestructura.
{{< /aviso >}}

Cómo encajan, a grandes rasgos, con el modelo OSI:

| Capa de esta guía | Capas OSI | Por qué |
| --- | --- | --- |
| Física | 1 (física) y 2 (enlace) | Cableado, puertos y switches |
| Lógica | 2 (enlace) y 3 (red) | Las VLAN separan el tráfico en la capa 2; las subredes y el enrutamiento son de la capa 3 |
| Servicios | Sobre todo 7 (aplicación) | DNS, DHCP o el directorio activo son servicios que usan las personas y los equipos |
| Protección | Ninguna | Es transversal: las copias, el SAI y la monitorización protegen a todas las demás |

{{< aviso titulo="La distinción que importa" >}}
Que un servidor responda a ping no significa que el servicio funcione. La capa física puede estar bien y el servicio (por ejemplo, el DNS) estar caído.
{{< /aviso >}}

## Qué vigilar en cada equipo

Esta tabla sale de la misma base de conocimiento que usa el mapa:

{{< tipos-de-equipo >}}

## Errores frecuentes

| Error | Mejor decisión |
| --- | --- |
| Pensar que dos equipos iguales dan alta disponibilidad completa. | Buscar los demás puntos únicos de fallo: alimentación, switch core, almacenamiento. |
| Hacer copias de seguridad en el mismo disco o la misma cabina. | Copias 3-2-1 y pruebas de restauración. |
| Olvidar las impresoras y los SAI en el inventario. | Inventariar todo lo que tenga IP o alimente algo crítico. |

## Checklist del alumno

- [ ] Sé nombrar las cuatro capas de esta guía, poner un ejemplo de cada una y explicar en qué se diferencian de las del modelo OSI.
- [ ] Sé qué pieza da nombre a las cosas (DNS) y cuál reparte direcciones (DHCP).
- [ ] Sé qué es un punto único de fallo y encuentro al menos dos en el mapa.
