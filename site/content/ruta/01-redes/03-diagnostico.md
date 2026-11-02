---
title: "Herramientas de diagnóstico"
description: "Los comandos que usarás cada día para saber qué le pasa a una red, y un método para no ir a ciegas."
weight: 3
equipo: "terminal"
duracion: "40 min"
nivel: "Inicial"
objetivos:
  - "Ver la configuración de red de un equipo con `ipconfig /all`."
  - "Usar `ping`, `tracert` y `nslookup` e interpretar lo que devuelven."
  - "Diagnosticar de dentro hacia fuera."
requisitos:
  - "Sala «Puerta de enlace, DNS y DHCP»"
  - "Una consola de Windows (o tu laboratorio)"
---

{{% tarea n="1" titulo="¿Qué configuración tengo?" %}}
Lo primero ante cualquier problema de red es mirar la configuración del propio equipo. Abre **PowerShell** o el símbolo del sistema y escribe:

```
ipconfig /all
```

Busca tu adaptador y anota: **Dirección IPv4**, **Máscara de subred**, **Puerta de enlace predeterminada**, **Servidores DNS** y **Dirección física** (la MAC). En Linux, el equivalente es `ip a` para las direcciones e `ip route` para la puerta de enlace.

{{< pregunta texto="¿Qué comando de Windows muestra también los servidores DNS y la dirección MAC?" respuesta="ipconfig /all|ipconfig/all" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="ping: ¿me oyes?" %}}
`ping` envía un pequeño mensaje a otro equipo y espera respuesta. Te dice si hay conexión y cuánto tarda (latencia, en milisegundos).

```
ping 192.168.1.1
```

Usa el protocolo **ICMP**. Ojo: muchos firewalls bloquean ICMP, así que «no responde a ping» **no siempre** significa «está apagado». Para comprobar un servicio concreto, prueba su puerto desde PowerShell:

```
Test-NetConnection servidor01 -Port 443
```

{{< pregunta texto="¿Qué protocolo usa ping?" respuesta="icmp" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="tracert: el camino" %}}
`tracert` (en Linux, `traceroute`) muestra los **saltos**: cada router por el que pasa el tráfico hasta el destino. Te sirve para ver **dónde** se corta.

```
tracert 1.1.1.1
```

Si el primer salto (tu puerta de enlace) responde y a partir de ahí ya no responde ninguno, ni siquiera el destino, el problema está entre tu router y la operadora. Un salto suelto con `*` no es una avería: muchos routers no contestan a `tracert` y dejan pasar el tráfico igualmente.

{{< pregunta texto="¿Cómo se llama el comando de Windows que muestra los saltos hasta un destino?" respuesta="tracert" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="nslookup: pregunta al DNS" %}}
`nslookup` pregunta a un servidor DNS por un nombre. Sin más parámetros usa el DNS que tiene configurado el equipo; si añades una IP al final, pregunta a ese servidor en concreto:

```
nslookup www.example.com
nslookup www.example.com 1.1.1.1
```

Si el segundo responde y el primero no, el problema está en **tu** DNS, no en Internet.

{{< pregunta texto="Escribe el comando para preguntar al DNS 1.1.1.1 por example.com" respuesta="nslookup example.com 1.1.1.1" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="El método: de dentro hacia fuera" %}}
No pruebes cosas al azar. Ve de lo más cercano a lo más lejano y para en cuanto algo falle:

| Paso | Comando | Si falla, sospecha de… |
| --- | --- | --- |
| 1. ¿Tengo configuración? | `ipconfig /all` | DHCP, cable o wifi |
| 2. ¿Llego a mi puerta de enlace? | `ping 192.168.1.1` | Red local: switch, VLAN, cable |
| 3. ¿Llego a Internet por IP? | `ping 1.1.1.1` | Firewall o línea de la operadora |
| 4. ¿Resuelvo nombres? | `nslookup www.example.com` | DNS |

{{< pregunta texto="El ping a 1.1.1.1 responde, pero ninguna web abre por su nombre. ¿Qué servicio sospechas?" respuesta="dns|el dns" >}}
{{% /tarea %}}
