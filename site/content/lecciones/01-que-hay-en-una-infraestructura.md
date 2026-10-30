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

- [ ] Sé nombrar las cuatro capas y poner un ejemplo de cada una.
- [ ] Sé qué pieza da nombre a las cosas (DNS) y cuál reparte direcciones (DHCP).
- [ ] Sé qué es un punto único de fallo y encuentro al menos dos en el mapa.
