---
title: "Puerta de enlace, DNS y DHCP"
description: "Las tres piezas que necesita cualquier equipo para funcionar en una red: por dónde salir, cómo encontrar nombres y quién le da la configuración."
weight: 2
equipo: "servidor"
duracion: "30 min"
nivel: "Inicial"
objetivos:
  - "Explicar para qué sirve la puerta de enlace."
  - "Entender qué hace el DNS y qué es un registro A."
  - "Saber cómo un equipo obtiene su IP por DHCP y qué pasa si no lo consigue."
requisitos:
  - "Sala «Direcciones IP y máscaras»"
---

{{% tarea n="1" titulo="La puerta de enlace" %}}
Un equipo habla directamente con los de su misma red. Para todo lo demás (otra red de la empresa, Internet) envía el tráfico a la **puerta de enlace** (*default gateway*): normalmente el router o el firewall, que sabe hacia dónde reenviarlo.

Si un equipo tiene mal la puerta de enlace, puede abrir las carpetas del servidor de su misma red, pero no llega a Internet ni a otras redes.

{{< pregunta texto="Un equipo sin puerta de enlace, ¿puede hablar con equipos de su misma red? (sí/no)" respuesta="si" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="DNS: de nombres a direcciones" %}}
Las personas recordamos nombres (`intranet.lab.example.com`); los equipos necesitan direcciones IP. El **DNS** es el servicio que traduce unos en otros. Cuando escribes un nombre, tu equipo pregunta al servidor DNS que tiene configurado y este le responde con la IP.

La información se guarda en **registros**. Los dos primeros que debes conocer:

| Registro | Qué hace | Ejemplo |
| --- | --- | --- |
| **A** | Asocia un nombre a una IPv4. | `fs01` → `192.168.10.20` |
| **PTR** | Lo contrario: de IP a nombre. | `192.168.10.20` → `fs01` |

En una empresa con Active Directory, el DNS interno lo sirven los controladores de dominio. Si el DNS cae, «no funciona nada» aunque la red esté perfecta.

{{< pregunta texto="¿Qué tipo de registro DNS asocia un nombre a una dirección IPv4?" respuesta="a|registro a|el registro a" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="DHCP: la configuración automática" %}}
Configurar a mano la IP de cada portátil sería inviable. El **servidor DHCP** reparte automáticamente la IP, la máscara, la puerta de enlace y los servidores DNS. El intercambio tiene cuatro pasos, que se recuerdan como **DORA**: *Discover* (el equipo pregunta), *Offer* (el servidor ofrece), *Request* (el equipo la pide) y *Acknowledge* (el servidor confirma).

Los servidores, impresoras y equipos de red llevan **IP fija** o una **reserva** en el DHCP, para que su dirección no cambie nunca.

{{< aviso titulo="La distinción que importa" >}}
Si un equipo Windows no encuentra ningún servidor DHCP, se pone una dirección que empieza por `169.254` (APIPA). Si ves una IP así, el problema no es «Internet»: el equipo no ha conseguido configuración.
{{< /aviso >}}

{{< pregunta texto="¿Por qué dos números empieza la IP que se pone Windows cuando no encuentra DHCP?" respuesta="169.254|169.254.x.x|169.254.0.0/16" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Todo junto: abrir una web" %}}
Esto es lo que pasa cuando enciendes un portátil y abres una web:

| Paso | Qué sucede | Quién lo hace |
| --- | --- | --- |
| 1 | El portátil pide configuración y recibe IP, máscara, puerta de enlace y DNS. | Servidor DHCP |
| 2 | Escribes `www.example.com` y el portátil pregunta su IP. | Servidor DNS |
| 3 | Como esa IP no está en su red, envía el tráfico a la puerta de enlace. | Router o firewall |
| 4 | El firewall lo traduce a la IP pública y lo envía a Internet. | Firewall (NAT) |

Cuando algo falla, piensa en qué paso se ha roto.

{{< pregunta texto="¿Qué servicio entrega normalmente la IP, la máscara, la puerta de enlace y el DNS?" respuesta="dhcp|el dhcp|servidor dhcp|el servidor dhcp" >}}
{{% /tarea %}}
