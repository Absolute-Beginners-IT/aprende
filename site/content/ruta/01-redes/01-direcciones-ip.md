---
title: "Direcciones IP y máscaras"
description: "Cómo se identifica cada equipo en una red y cómo saber si dos equipos están en la misma."
weight: 1
equipo: "router"
duracion: "35 min"
nivel: "Inicial"
objetivos:
  - "Leer una dirección IPv4 y su máscara."
  - "Pasar de una máscara a notación CIDR (`/24`)."
  - "Distinguir direcciones privadas de públicas."
  - "Saber si dos equipos están en la misma red."
requisitos:
  - "Módulo 0"
---

{{% tarea n="1" titulo="Qué es una dirección IP" %}}
Una **dirección IP** identifica a un equipo dentro de una red, igual que una dirección postal identifica una casa. La más usada en las redes de empresa es **IPv4**: cuatro números del 0 al 255 separados por puntos, por ejemplo `192.168.1.20`.

Cada uno de esos cuatro números se llama **octeto**, porque ocupa 8 bits. En total, una IPv4 tiene 32 bits.

{{< pregunta texto="¿Cuántos octetos tiene una dirección IPv4?" respuesta="4|cuatro" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Red y equipo: la máscara" %}}
Una IP tiene dos partes: la que dice **en qué red** está el equipo y la que dice **qué equipo** es dentro de esa red. La **máscara de subred** marca dónde termina una parte y empieza la otra.

| IP | Máscara | Parte de red | Parte de equipo |
| --- | --- | --- | --- |
| `192.168.1.20` | `255.255.255.0` | `192.168.1` | `20` |

La misma máscara se escribe más corta en **notación CIDR**: se cuenta cuántos bits están a 1. `255.255.255.0` son 24 bits a 1, así que se escribe `/24`. Por eso verás `192.168.1.20/24`.

| Máscara | CIDR |
| --- | --- |
| `255.0.0.0` | `/8` |
| `255.255.0.0` | `/16` |
| `255.255.255.0` | `/24` |

{{< pregunta texto="¿Qué prefijo CIDR equivale a la máscara 255.255.0.0?" respuesta="/16|16" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Direcciones privadas y públicas" %}}
Dentro de las empresas se usan **direcciones privadas**: rangos reservados que no se usan en Internet y que cualquiera puede repetir en su red. Para salir a Internet, el firewall o el router traduce las privadas a la **IP pública** de la empresa (esto se llama **NAT**).

| Rango privado | En CIDR |
| --- | --- |
| `10.0.0.0` a `10.255.255.255` | `10.0.0.0/8` |
| `172.16.0.0` a `172.31.255.255` | `172.16.0.0/12` |
| `192.168.0.0` a `192.168.255.255` | `192.168.0.0/16` |

{{< pregunta texto="¿La dirección 172.20.5.4 es pública o privada?" respuesta="privada|es privada" pista="Mira el segundo rango de la tabla: va de 172.16 a 172.31." >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Cuántos equipos caben" %}}
En una red `/24` quedan 8 bits para los equipos: 2⁸ = 256 direcciones. Pero dos están reservadas:

- La primera (`192.168.1.0`) es la **dirección de red**: identifica a la red entera.
- La última (`192.168.1.255`) es la de **difusión** (*broadcast*): un mensaje enviado a ella llega a todos.

Quedan 256 − 2 direcciones para equipos, de `192.168.1.1` a `192.168.1.254`.

{{< pregunta texto="¿Cuántas direcciones utilizables para equipos tiene una red /24?" respuesta="254" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="¿Están en la misma red?" %}}
Dos equipos pueden hablar directamente solo si están en la **misma red**, es decir, si su parte de red coincide. Si no, necesitan un router que los conecte (lo verás en la siguiente sala).

Con máscara `/24`, compara los tres primeros octetos:

| Equipo A | Equipo B | ¿Misma red? |
| --- | --- | --- |
| `192.168.1.10/24` | `192.168.1.200/24` | Sí: `192.168.1` en los dos |
| `192.168.1.10/24` | `192.168.2.10/24` | No: `192.168.1` frente a `192.168.2` |

{{< pregunta texto="¿Están en la misma red 10.0.5.20/24 y 10.0.6.20/24? (sí/no)" respuesta="no" >}}
{{% /tarea %}}
