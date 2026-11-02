---
title: "Monitorización, inventario y entrega"
description: "Instala Zabbix 7.0 LTS, vigila tus servidores con agentes y alertas, y cierra el proyecto con el inventario importado en «Mi infraestructura»."
weight: 5
equipo: "bandera"
duracion: "2 h"
nivel: "Intermedio"
objetivos:
  - "Instalar Zabbix 7.0 LTS en una VM Linux."
  - "Desplegar Zabbix Agent 2 en los servidores y aplicarles plantillas."
  - "Provocar una caída y comprobar que la alerta llega."
  - "Exportar el inventario en el formato del toolkit e importarlo en la aplicación."
requisitos:
  - "Salas anteriores de este módulo"
  - "Módulo 8 (operar la infraestructura)"
  - "Salida a Internet en SRV-MON01 (firewall de la sala de VLAN o un adaptador NAT adicional)"
---

Ya tienes una empresa que funciona. Ahora vas a hacer que te avise cuando deje de funcionar, y a dejarla documentada. Es exactamente el orden que sigue el módulo 8: sin inventario no sabes qué vigilar, y sin monitorización no tienes nada que alertar.

{{% tarea n="1" titulo="Instala Zabbix 7.0 LTS en SRV-MON01" %}}
Usarás tu Ubuntu Server del módulo 2 (192.168.50.20). La propuesta del toolkit es **Zabbix 7.0 LTS**: gratuito, con plantillas oficiales y soporte completo hasta junio de 2027. **Zabbix 8.0 LTS** está prevista para finales de 2026; cuando salga, practica la actualización en el laboratorio antes de hacerla en una empresa.

Dale nombre a la máquina y comprueba que resuelve con el DNS del dominio:

```
sudo hostnamectl set-hostname srv-mon01
resolvectl status
```

Si en `resolvectl status` no aparece 192.168.50.10 como servidor DNS, cámbialo en el fichero de `/etc/netplan/` y aplica con `sudo netplan apply`.

Ve a la página oficial de descarga de Zabbix y elige: **7.0 LTS**, **Ubuntu**, tu versión de Ubuntu, **Server, Frontend, Agent 2**, **MySQL** y **Apache**. Si tu versión de Ubuntu aún no aparece para 7.0, instala en esta VM la última LTS que sí aparezca. Copia de esa página los comandos del repositorio (`wget` y `dpkg -i` del paquete `zabbix-release`) y después instala:

```
sudo apt update
sudo apt install zabbix-server-mysql zabbix-frontend-php zabbix-apache-conf zabbix-sql-scripts zabbix-agent2 mysql-server
```

Crea la base de datos (pon tu propia contraseña en lugar de `CambiaEstaClave` y guárdala en el gestor de contraseñas):

```
sudo mysql
create database zabbix character set utf8mb4 collate utf8mb4_bin;
create user zabbix@localhost identified by 'CambiaEstaClave';
grant all privileges on zabbix.* to zabbix@localhost;
set global log_bin_trust_function_creators = 1;
quit;
```

Carga el esquema, vuelve a desactivar la opción temporal y pon la contraseña en `DBPassword=` del fichero `/etc/zabbix/zabbix_server.conf`:

```
zcat /usr/share/zabbix-sql-scripts/mysql/server.sql.gz | mysql --default-character-set=utf8mb4 -uzabbix -p zabbix
sudo mysql -e "set global log_bin_trust_function_creators = 0;"
sudo nano /etc/zabbix/zabbix_server.conf
sudo systemctl restart zabbix-server zabbix-agent2 apache2
sudo systemctl enable zabbix-server zabbix-agent2 apache2
```

Si algún comando de la página oficial difiere de estos, **manda la página oficial**: es la que corresponde exactamente a tu versión. Abre `http://192.168.50.20/zabbix` desde `SRV-DC01`, completa el asistente y entra con el usuario `Admin` y la contraseña `zabbix`. **Cámbiala lo primero** (User settings → Profile).

**Cómo sabes que está bien:** `systemctl status zabbix-server` aparece como `active (running)` y en **Monitoring → Hosts** el host «Zabbix server» tiene el icono **ZBX** en verde.

{{< pregunta texto="¿Qué usuario trae Zabbix por defecto para entrar en la web?" respuesta="admin" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Agentes en los servidores" %}}
Descarga **Zabbix Agent 2** para Windows desde la página oficial de agentes (7.0 LTS, amd64, OpenSSL, MSI) y cópialo a `SRV-DC01` y `SRV-FS01`. En cada uno, instálalo indicando quién es el servidor y cómo se llama este equipo (cambia el nombre del fichero por el que hayas descargado y `HOSTNAME` por el de cada servidor):

```
msiexec /i zabbix_agent2-7.0.x-windows-amd64-openssl.msi /qn SERVER=192.168.50.20 SERVERACTIVE=192.168.50.20 HOSTNAME=SRV-DC01
Get-Service "Zabbix Agent 2"
```

El instalador crea también la regla del firewall de Windows para el puerto **TCP 10050** (salvo que le pases `SKIP=fw`). Comprueba desde `SRV-MON01` que llegas:

```
nc -zv 192.168.50.10 10050
nc -zv 192.168.50.11 10050
```

Ahora da de alta los servidores en la web, en **Data collection → Hosts → Create host**:

| Campo | `SRV-DC01` | `SRV-FS01` |
| --- | --- | --- |
| Host name | `SRV-DC01` (igual que `HOSTNAME`) | `SRV-FS01` |
| Templates | `Windows by Zabbix agent` | `Windows by Zabbix agent` |
| Host groups | `Servidores` | `Servidores` |
| Interfaces | Agent, 192.168.50.10, puerto 10050 | Agent, 192.168.50.11, puerto 10050 |
| Tags | `criticidad` = `alta` | `criticidad` = `alta` |

Son las mismas plantillas y la misma organización por grupos y etiquetas que propone la guía de monitorización del toolkit.

**Cómo sabes que está bien:** en **Monitoring → Hosts**, los tres servidores (`SRV-MON01` aparece como «Zabbix server») tienen **ZBX** en verde y en **Monitoring → Latest data** ves la CPU, la memoria y el espacio libre de `E:` en `SRV-FS01`.

{{< pregunta texto="¿En qué puerto TCP escucha Zabbix Agent 2?" respuesta="10050" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Alertas: provoca una caída" %}}
La monitorización que nadie mira no sirve. Activa el aviso:

1. En **Alerts → Actions → Trigger actions**, activa la acción **Report problems to Zabbix administrators** (viene desactivada).
2. Si tienes una cuenta de correo de pruebas con SMTP, configúrala en **Alerts → Media types → Email** y añade tu dirección en **Users → Users → Admin → Media**. Si no, te basta con el panel de problemas.

Y ahora, la prueba que demuestra que funciona. En `SRV-FS01`:

```
Stop-Service "Zabbix Agent 2"
```

Espera unos minutos y abre **Monitoring → Problems**: debe aparecer un problema de `SRV-FS01` indicando que el agente de Zabbix no está disponible. Vuelve a arrancarlo con `Start-Service "Zabbix Agent 2"` y comprueba que el problema pasa a **RESOLVED**.

Para nota: para el servicio **Servidor DHCP** en `SRV-DC01` (`Stop-Service DHCPServer`) y mira cómo la plantilla detecta que un servicio automático no está en ejecución. No olvides arrancarlo después.

**Cómo sabes que está bien:** has visto aparecer y resolverse al menos un problema, y si configuraste el correo, te ha llegado el aviso. Apunta en tu documentación cuánto tardó en saltar la alerta y marca la tarea.
{{% /tarea %}}

{{% tarea n="4" titulo="Exporta el inventario" %}}
Toca documentar lo que has montado en el formato del toolkit (`toolkit/01-Inventario/inventario.csv`): punto y coma como separador, una fila por equipo y estas columnas:

```
Nombre;Tipo;Marca;Modelo;IP_Gestion;Ubicacion;Rol;Criticidad;Uplink;Firmware;Fin_Soporte;Metodo_Monitorizacion;Monitorizado;Notas
```

Los equipos del dominio puedes sacarlos de Active Directory en lugar de teclearlos. En `SRV-DC01`:

```
Get-ADComputer -Filter * -Properties IPv4Address, OperatingSystem | ForEach-Object {
  [pscustomobject]@{
    Nombre = $_.Name; Tipo = 'vm'; Marca = 'Microsoft'; Modelo = $_.OperatingSystem
    IP_Gestion = $_.IPv4Address; Ubicacion = 'Laboratorio'; Rol = ''; Criticidad = 'Alta'
    Uplink = 'LAB-HOST'; Firmware = ''; Fin_Soporte = ''; Metodo_Monitorizacion = 'Agente Zabbix'
    Monitorizado = 'Sí'; Notas = ''
  }
} | Export-Csv -Path "$env:USERPROFILE\Desktop\inventario-lab.csv" -Delimiter ';' -Encoding UTF8 -NoTypeInformation
```

Abre el fichero, rellena la columna **Rol** y añade a mano lo que no está en el dominio: tu ordenador anfitrión, `SRV-MON01` y, si lo montaste, `FW01`. El resultado se parecerá a esto:

```
Nombre;Tipo;Marca;Modelo;IP_Gestion;Ubicacion;Rol;Criticidad;Uplink;Firmware;Fin_Soporte;Metodo_Monitorizacion;Monitorizado;Notas
LAB-HOST;hipervisor;;Mi ordenador;;Casa;Hipervisor del laboratorio;Alta;;;;Ninguno;No;VirtualBox, Hyper-V o Proxmox VE
FW01;firewall;Netgate;pfSense CE;192.168.50.1;Laboratorio;Perimetral y VLAN;Alta;LAB-HOST;;;ICMP ping;No;Opcional: sala de VLAN
SRV-DC01;vm;Microsoft;Windows Server 2025 Standard Evaluation;192.168.50.10;Laboratorio;Controlador de dominio, DNS y DHCP;Alta;LAB-HOST;;;Agente Zabbix;Sí;
SRV-FS01;vm;Microsoft;Windows Server 2025 Standard Evaluation;192.168.50.11;Laboratorio;Ficheros y copias;Alta;LAB-HOST;;;Agente Zabbix;Sí;
SRV-MON01;vm;Canonical;Ubuntu Server LTS;192.168.50.20;Laboratorio;Monitorización Zabbix;Media;LAB-HOST;;;Agente Zabbix;Sí;
```

Ajusta los modelos a las versiones que hayas instalado y rellena **Fin_Soporte** con la fecha (AAAA-MM-DD) que encuentres en la web del fabricante o en endoflife.date: es la columna que te avisará, dentro de unos años, de que toca renovar.

**Cómo sabes que está bien:** cada equipo aparece una sola vez, todos los nombres de la columna **Uplink** existen como fila en el propio fichero y no queda ninguna fila `EJEMPLO-`.

{{< pregunta texto="¿Qué columna del inventario indica de qué equipo cuelga cada uno y es la que dibuja el mapa?" respuesta="uplink" >}}
{{% /tarea %}}

{{% tarea n="5" titulo="Importa el inventario en «Mi infraestructura»" %}}
Abre [Mi infraestructura]({{< param "appURL" >}}#mi-infraestructura) en la aplicación del mapa. En la tarjeta **Importar o exportar**, pega el contenido de tu CSV (con la cabecera) y pulsa **Importar**. La aplicación te dirá cuántos equipos ha importado.

Después, mira el panel **Qué te falta**: compara tu inventario con una pyme típica y te señala carencias como equipos sin monitorizar, la falta de SAI o de alta disponibilidad. Que salgan avisos es normal en un laboratorio; lo importante es que sepas explicar cada uno. Por ejemplo, ¿qué harías para que `FW01` pasara a «Monitorizado»? (Pista: la plantilla `ICMP Ping` en Zabbix).

{{< aviso titulo="La distinción que importa" >}}
El inventario de la aplicación se guarda **solo en tu navegador**: no se envía a ningún servidor, y si borras los datos del navegador, se pierde. El fichero CSV es tu copia buena: guárdalo junto al resto de la documentación del laboratorio y usa **Exportar CSV** cuando cambies algo en la aplicación.
{{< /aviso >}}

**Cómo sabes que está bien:** **Tus equipos** muestra todos los equipos de tu CSV, cada uno «conectado a» su uplink, y los servidores aparecen como «Monitorizado». Cuando lo tengas, marca la tarea.
{{% /tarea %}}

{{% tarea n="6" titulo="¡Enhorabuena!" %}}
Para un momento y mira lo que has construido: un dominio con DNS y DHCP, usuarios y grupos bien organizados, carpetas con permisos por departamento, una red segmentada si te atreviste con ella, copias que **has demostrado** que se restauran, una monitorización que te avisa antes que los usuarios y un inventario que cualquiera puede leer. Eso es, a pequeña escala, la infraestructura de una pyme de verdad, y la has montado tú.

Antes de cerrar, deja el laboratorio como lo dejaría un profesional:

1. Instantánea de todas las VM con el nombre «Proyecto final terminado».
2. Carpeta «Documentación» con el plan de direcciones, el mapa, la política de copias con su tiempo de restauración y el inventario CSV.
3. Contraseñas (DSRM, base de datos de Zabbix, `Admin` de Zabbix, firewall) guardadas en el gestor de contraseñas.

¿Y ahora? El siguiente paso es hacer esto mismo en una empresa real, donde la red ya existe y nadie te ha dado el plano. Para eso está el **módulo 8 (operar la infraestructura)**: su hoja de ruta te guía para descubrir, inventariar, monitorizar, alertar, mantener y medir una red que no conoces, con los scripts del toolkit y siempre con autorización.

Marca la tarea y date el gusto: has terminado la ruta.
{{% /tarea %}}
