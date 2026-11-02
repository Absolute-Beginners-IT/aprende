---
title: "Diseña tu empresa: mapa y plan de direcciones"
description: "Recibe el encargo de una pequeña empresa y, antes de encender ninguna máquina, decide nombres, direcciones, redes y recursos."
weight: 1
equipo: "libro"
duracion: "1 h"
nivel: "Intermedio"
objetivos:
  - "Convertir un encargo en un diseño: servidores, servicios y redes."
  - "Hacer un plan de direcciones IP y de VLAN coherente."
  - "Fijar una convención de nombres y de cuentas antes de instalar nada."
  - "Dibujar el mapa de tu infraestructura y repartir los recursos del laboratorio."
requisitos:
  - "Módulos 0 a 8"
  - "Tu laboratorio con Windows Server y Ubuntu Server (módulo 2)"
---

Bienvenido al proyecto final. Aquí no hay teoría nueva: vas a **montar una empresa entera** en tu laboratorio usando lo que ya sabes. Cada tarea es un hito con su lista de comprobación y un apartado **«Cómo sabes que está bien»**. Si te atascas, vuelve a la sala donde lo aprendiste: para eso está.

{{% tarea n="1" titulo="El encargo" %}}
Te acaban de contratar como administrador de sistemas en **Talleres Brisa, S.L.**, una empresa ficticia que diseña y fabrica piezas metálicas. Esto es lo que te cuenta la gerente el primer día:

- Somos **15 personas** en dos departamentos: **Administración** (5 personas: contabilidad, compras y gerencia) e **Ingeniería** (10 personas: oficina técnica y taller).
- Queremos **un usuario por persona**, que cada uno inicie sesión con su cuenta y que los equipos reciban la configuración de red solos.
- Cada departamento necesita **su carpeta compartida**, y nadie de Ingeniería debe ver las nóminas. También queremos una carpeta **común** para todos.
- Si alguien borra un fichero por error, **tiene que poder recuperarse**.
- Queremos enterarnos **antes que los usuarios** cuando algo falle.
- Y queremos saber **qué equipos tenemos**, de quién dependen y cuándo dejan de tener soporte.

Traduce cada frase a una pieza técnica. Esta es tu lista de la compra:

| Lo que pide la empresa | Pieza técnica | Dónde lo aprendiste |
| --- | --- | --- |
| Un usuario por persona | Dominio de Active Directory | Módulo 4 (Active Directory) |
| Configuración de red automática | DHCP y DNS interno | Módulos 1 y 4 |
| Carpetas por departamento | Servidor de ficheros con permisos por grupo | Módulo 4 (servidor de ficheros) |
| Separar puestos y servidores | VLAN y firewall | Módulo 5 (red de empresa) |
| Recuperar ficheros borrados | Copias de seguridad y prueba de restauración | Módulo 7 (protección) |
| Enterarse antes que nadie | Monitorización con alertas | Módulo 8 (operar) |
| Saber qué equipos hay | Inventario | Módulos 3 y 8 |

{{< pregunta texto="¿Qué servicio de Windows Server permite que cada persona inicie sesión con su propia cuenta en cualquier equipo de la empresa?" respuesta="active directory|ad|el active directory|directorio activo|el directorio activo|ad ds|adds|active directory domain services|servicios de dominio de active directory" pista="Lo verás en el módulo 4: dominio, usuarios, grupos y GPO." >}}
{{% /tarea %}}

{{% tarea n="2" titulo="El plan de direcciones" %}}
Antes de instalar nada, decide qué dirección tendrá cada equipo y apúntalo. Un plan de direcciones evita el clásico «he puesto a mano una IP que ya repartía el DHCP».

Usarás la misma red base que en el módulo 2, **192.168.50.0/24**:

| Rango o dirección | Uso | Equipo |
| --- | --- | --- |
| 192.168.50.1 | Puerta de enlace | Firewall del laboratorio (si lo montas) |
| 192.168.50.10 | Controlador de dominio, DNS y DHCP | `SRV-DC01` (Windows Server) |
| 192.168.50.11 | Servidor de ficheros y copias | `SRV-FS01` (Windows Server) |
| 192.168.50.20 | Monitorización con Zabbix | `SRV-MON01` (tu Ubuntu Server del módulo 2) |
| 192.168.50.2 – .99 | Reservado para servidores e infraestructura futura | Asignación manual |
| 192.168.50.100 – .199 | **Ámbito DHCP** para puestos | Asignación automática |
| 192.168.50.200 – .254 | Reservado (impresoras, pruebas) | Asignación manual |

La regla de oro: **las IP fijas nunca dentro del ámbito DHCP**. Los servidores van fuera del rango que reparte el DHCP.

**Cómo sabes que está bien:** ninguna IP fija de la tabla cae entre .100 y .199, y cada servidor tiene una sola dirección apuntada.

{{< pregunta texto="Según el plan, ¿qué dirección IP tendrá el servidor de ficheros `SRV-FS01`?" respuesta="192.168.50.11" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Las VLAN (diseño)" %}}
En una empresa real no meterías los portátiles de los usuarios en la misma red que los servidores: si un puesto se infecta, lo tendría todo a tiro. Por eso se separa por **funciones** con VLAN, como viste en el módulo 5 (VLAN y subredes). El diseño de Talleres Brisa sigue la convención `192.168.<VLAN>.0/24`, así el número de VLAN y la subred se recuerdan juntos:

| VLAN | Nombre | Subred | Puerta de enlace | Quién vive aquí |
| --- | --- | --- | --- | --- |
| 50 | Servidores | 192.168.50.0/24 | 192.168.50.1 | `SRV-DC01`, `SRV-FS01`, `SRV-MON01` |
| 10 | Puestos | 192.168.10.0/24 | 192.168.10.1 | Ordenadores de Administración e Ingeniería |
| 99 | Gestión | 192.168.99.0/24 | 192.168.99.1 | Interfaces de administración de switches, hipervisor y SAI |

Y las reglas básicas del firewall entre ellas:

- **Puestos → Servidores:** permitido (necesitan el dominio, el DNS y las carpetas).
- **Puestos → Gestión:** bloqueado. Un usuario no tiene por qué ver la administración del switch.
- **Servidores y Puestos → Internet:** permitido.

{{< aviso titulo="La distinción que importa" >}}
Montar las VLAN en el laboratorio es **opcional**: necesitas una máquina virtual de firewall (pfSense u OPNsense) y algo más de memoria. El diseño, en cambio, no es opcional: hazlo igualmente, porque es lo que te pedirán en una empresa de verdad. Si no montas las VLAN, todo vivirá en la red 192.168.50.0/24 y el ámbito DHCP será el de la tarea anterior.
{{< /aviso >}}

{{< pregunta texto="Con la convención del diseño, ¿qué subred corresponde a la VLAN 10?" respuesta="192.168.10.0/24|192.168.10.0" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Nombres y cuentas" %}}
Las convenciones se deciden **una vez** y se respetan siempre. Las de este proyecto:

| Qué | Convención | Ejemplos |
| --- | --- | --- |
| Dominio | `lab.example.com` (NetBIOS `LAB`) | `LAB\ana.ruiz` |
| Servidores | `SRV-<FUNCIÓN><NN>` | `SRV-DC01`, `SRV-FS01`, `SRV-MON01` |
| Usuarios | `nombre.apellido` en minúsculas y sin tildes | `ana.ruiz`, `pablo.moreno` |
| Tu cuenta de administración | `adm-tunombre`, distinta de tu cuenta de usuario | `adm-lucia` |
| Grupos de seguridad | `GG-<Departamento>` | `GG-Administracion`, `GG-Ingenieria` |
| Carpetas compartidas | Una por departamento y una común | `Administracion`, `Ingenieria`, `Comun` |

Fíjate en el grupo: los permisos **nunca se dan a personas sueltas**, sino a grupos. Cuando llegue alguien nuevo a Ingeniería, lo metes en `GG-Ingenieria` y ya tiene todo lo que necesita; cuando se vaya, lo sacas y pierde el acceso.

**Cómo sabes que está bien:** puedes deducir para qué sirve cualquier equipo o grupo solo con leer su nombre.

{{< pregunta texto="Si mañana entra una persona nueva en Ingeniería, ¿a qué grupo la añades para que acceda a su carpeta?" respuesta="gg-ingenieria|gg ingenieria" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Dibuja el mapa y reparte los recursos" %}}
Ahora dibuja el mapa de Talleres Brisa por capas, como en el módulo 3 (qué hay en una infraestructura). Puede ser en papel, en draw.io o en un documento: lo importante es que se vea **de qué depende cada cosa**.

```
                 Internet (NAT de tu ordenador)
                            |
                 [ FW01  192.168.50.1 ]   (opcional: pfSense / OPNsense)
                            |
      +---------------------+----------------------+
      |                     |                      |
 [ SRV-DC01 .10 ]     [ SRV-FS01 .11 ]      [ SRV-MON01 .20 ]
  AD, DNS, DHCP        Ficheros, copias       Zabbix
```

Después, comprueba que tu ordenador puede con todo. Una propuesta mínima:

| Máquina virtual | CPU | RAM | Disco |
| --- | --- | --- | --- |
| `SRV-DC01` | 2 | 2–4 GB | 60 GB |
| `SRV-FS01` | 2 | 2 GB | 60 GB + 20 GB (datos) + 30 GB (copias) |
| `SRV-MON01` | 2 | 2–4 GB | 25 GB |
| `FW01` (opcional) | 1 | 1 GB | 16 GB |

Si te falta memoria, no hace falta tenerlas todas encendidas a la vez: enciende solo las de la sala en la que estés. Y antes de cada sala, **haz una instantánea** de las VM que vayas a tocar.

Checklist del hito:

1. Tabla de direcciones y de VLAN guardada.
2. Convención de nombres apuntada.
3. Mapa dibujado, con el uplink de cada equipo.
4. Recursos repartidos y comprobados.

Guarda todo en una carpeta «Documentación» de tu laboratorio, porque lo usarás al final para el inventario, y marca la tarea.
{{% /tarea %}}
