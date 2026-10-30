# Guía de monitorización de toda la infraestructura

Propuesta base: **Zabbix 7.0 LTS** como sistema central, porque es gratuito,
trae plantillas oficiales para la mayoría de fabricantes y gestiona alertas,
escalados y mantenimientos. Zabbix 8.0 LTS está prevista para el último trimestre
de 2026: cuando salga, planifica la actualización (7.0 LTS tiene soporte completo
hasta junio de 2027). Si la empresa ya usa un RMM para servidores y puestos,
Zabbix complementa la parte de red, virtualización y hardware; las alertas de
ambos deben acabar en el mismo sistema de tickets.

## 1. Arquitectura

```
                 +---------------------------+
  Equipos  --->  |  Zabbix Server (VM Linux) |  ---> Alertas: correo, Teams, Telegram, SMS
  (SNMP,         |  + base de datos + web    |  ---> Tickets (GLPI, Jira, RMM/PSA)  
   agente,       +---------------------------+
   API)                 ^            ^
                        |            |
             Zabbix Proxy (sedes remotas, opcional)
```

- **Servidor:** VM Linux (Ubuntu LTS o Debian/RHEL), 4 vCPU, 8 GB RAM, 100 GB disco para hasta ~500 equipos.
- **Proxy:** uno por sede remota; recoge localmente y envía al servidor (evita abrir puertos por VPN para cada equipo).
- **No la alojes en el mismo clúster que vigila sin un plan B**: si cae el clúster, cae la monitorización. Mínimo, un ping externo (UptimeRobot, Healthchecks o similar) contra tu salida a Internet y contra Zabbix.

## 2. Cómo se recoge el dato según el tipo de equipo

| Tipo | Método | Puerto | Plantilla Zabbix (buscar por nombre) |
| --- | --- | --- | --- |
| Firewall FortiGate | SNMPv3 + traps | UDP 161 / 162 | `FortiGate by SNMP` |
| Switch Cisco | SNMPv3 + traps | UDP 161 / 162 | `Cisco IOS by SNMP` |
| Switch HPE Aruba | SNMPv3 | UDP 161 | `Aruba CX 8300s by SNMP` (8325/8360) o `HP Enterprise Switch by SNMP` |
| Router operadora | Ping + SNMP si os dan acceso | ICMP | `ICMP Ping` |
| VMware ESXi/vCenter | API de vCenter | TCP 443 | `VMware` (requiere `StartVMwareCollectors` en el servidor) |
| Proxmox VE | API con token de solo lectura | TCP 8006 | `Proxmox VE by HTTP` |
| Hyper-V / Windows | Zabbix Agent 2 | TCP 10050 | `Windows by Zabbix agent` + contadores Hyper-V |
| Linux | Zabbix Agent 2 | TCP 10050 | `Linux by Zabbix agent` |
| Hardware servidor | Redfish de iDRAC o iLO (preferido) o SNMPv3 | 443 / 161 | `DELL PowerEdge <modelo> by HTTP`, `HPE iLO by HTTP` |
| Cabina de discos / NAS | SNMP o API del fabricante | 161 / 443 | Plantilla del fabricante (Synology, QNAP, NetApp...) |
| SAI | SNMP de la tarjeta de red | 161 | `APC UPS by SNMP` (u otra marca) |
| Backup Veeam (12 y 13) | API REST de Veeam (no incluida en la edición Enterprise) | 9419 | `Veeam Backup and Replication by HTTP` |
| Web/servicios | Comprobación HTTP, certificado | 443 | `Website certificate by Zabbix agent 2`, web scenarios |
| Salida a Internet | Ping a 1.1.1.1 / 8.8.8.8 + speedtest | ICMP | `ICMP Ping` + scripts de `05-Pruebas-Red` |

Regla general: **SNMPv3 con autenticación y cifrado** (nunca `public`), y acceso SNMP solo desde la IP del servidor/proxy Zabbix.

## 3. Configuración por fabricante (copiar y adaptar)

Sustituye `<ZBX_IP>`, `<CLAVE_AUTH>` y `<CLAVE_PRIV>`. Guarda las claves en el gestor de contraseñas.

### FortiGate (FortiOS 7.4, 7.6 y 8.0)
```
config system snmp sysinfo
    set status enable
    set contact-info "sistemas"
    set location "CPD"
end
config system snmp user
    edit "zabbix"
        set notify-hosts <ZBX_IP>
        set security-level auth-priv
        set auth-proto sha256
        set auth-pwd <CLAVE_AUTH>
        set priv-proto aes256
        set priv-pwd <CLAVE_PRIV>
    next
end
config system interface
    edit "<interfaz_gestion>"
        append allowaccess snmp
    next
end
```

### Cisco IOS / IOS-XE
Desde IOS-XE 17.10 puedes usar SHA-2 y AES-256; en versiones anteriores solo hay SHA-1, así que usa `auth sha <CLAVE_AUTH> priv aes 128 <CLAVE_PRIV>`.
```
snmp-server view ZBXVIEW iso included
snmp-server group ZBXGRP v3 priv read ZBXVIEW
snmp-server user zabbix ZBXGRP v3 auth sha-2 256 <CLAVE_AUTH> priv aes 256 <CLAVE_PRIV>
snmp-server host <ZBX_IP> version 3 priv zabbix
snmp-server enable traps snmp linkdown linkup coldstart
```

### HPE Aruba AOS-S (2530, 2930F..., gama anterior)
```
snmpv3 enable
snmpv3 user zabbix auth sha <CLAVE_AUTH> priv aes <CLAVE_PRIV>
snmpv3 group managerpriv user zabbix sec-model ver3
snmpv3 only
```

### HPE Aruba AOS-CX (6100, 6300...)
```
snmp-server vrf default
snmpv3 user zabbix auth sha256 auth-pass plaintext <CLAVE_AUTH> priv aes256 priv-pass plaintext <CLAVE_PRIV>
```
`sha256` y `aes256` figuran en la documentación de AOS-CX 10.13 y posteriores. Si tu versión no los admite (compruébalo con `snmpv3 user zabbix auth ?`), usa `auth sha` y `priv aes`. Las claves deben tener de 8 a 32 caracteres; si llevan caracteres especiales, escríbelas entre comillas simples. Plantilla: `Aruba CX 8300s by SNMP` en 8325/8360; en otros modelos, `HP Enterprise Switch by SNMP`.

### VMware vCenter (vSphere 8 y 9)
1. Crea en vCenter un usuario `svc-zabbix` con rol **Solo lectura** propagado.
2. En `zabbix_server.conf`: `StartVMwareCollectors=2` y reinicia el servicio.
3. Crea un host en Zabbix, aplica la plantilla `VMware` y define las macros:
   `{$VMWARE.URL}=https://<vcenter>/sdk`, `{$VMWARE.USERNAME}`, `{$VMWARE.PASSWORD}`.
4. Zabbix descubre solo hosts ESXi, datastores y VMs.

### Proxmox VE
1. En Proxmox: **Datacenter → Permissions → API Tokens**, crea el usuario `zabbix@pve` con el rol `PVEAuditor` (solo lectura) y genera un token.
2. Asigna el rol `PVEAuditor` en `/` al usuario **y también al token**: si el token tiene activada la opción *Privilege Separation*, no hereda los permisos del usuario.
3. En Zabbix, aplica `Proxmox VE by HTTP` y define `{$PVE.URL.HOST}`, `{$PVE.TOKEN.ID}` (con el formato `zabbix@pve!<nombre-del-token>`) y `{$PVE.TOKEN.SECRET}`. Cambia `{$PVE.URL.PORT}` solo si la API no está en el puerto 8006.

### Hyper-V / Windows Server
1. Instala **Zabbix Agent 2** (MSI) con `Server=<ZBX_IP>` y `ServerActive=<ZBX_IP>`.
   Despliegue masivo: GPO, Intune o el RMM de la empresa.
2. Aplica `Windows by Zabbix agent`.
3. Contadores útiles de Hyper-V (ítems tipo `perf_counter_en`):
   - `\Hyper-V Hypervisor Logical Processor(_Total)\% Total Run Time`
   - `\Hyper-V Dynamic Memory Balancer(*)\Available Memory`
   - `\Hyper-V Virtual Storage Device(*)\Latency`
4. Estado del clúster con un `UserParameter` en el agente:
   ```
   UserParameter=cluster.nodes.down,powershell -NoProfile -Command "(Get-ClusterNode | Where-Object State -ne 'Up').Count"
   UserParameter=cluster.csv.freepct[*],powershell -NoProfile -Command "$c=Get-ClusterSharedVolume -Name '$1'; [math]::Round($c.SharedVolumeInfo.Partition.PercentFree,1)"
   ```

### Dell iDRAC / HPE iLO
Activa Redfish (preferido) o SNMPv3 en la controladora, no en el sistema operativo, con un usuario de solo lectura. Así ves discos, fuentes, ventiladores y temperatura aunque el servidor esté apagado. En Dell usa la plantilla `DELL PowerEdge <modelo> by HTTP` (iDRAC 8/9 con firmware 4.32 o posterior); en HPE, `HPE iLO by HTTP`.

## 4. Organización dentro de Zabbix

- **Grupos de hosts** por tipo y sede: `Red/Firewalls`, `Red/Switches`, `Virtualización`, `Servidores`, `Hardware`, `Sede-Central`, `Sede-X`.
- **Etiquetas** (tags): `criticidad:alta`, `servicio:erp`, `equipo:sistemas`. Las alertas se enrutan por etiquetas.
- **Dependencias de triggers**: si cae el switch core, no quieres 40 alertas de equipos colgados de él. Marca que los triggers de cada equipo dependen del de su uplink (la misma columna `Uplink` del inventario).
- **Mapas de red** (Monitoring → Maps): replica el mapa del inventario con iconos que cambian de color.
- **Mantenimientos** (Data collection → Maintenance): durante una ventana programada se silencian alertas.

## 5. Orden de despliegue recomendado

1. Ping (ICMP) a todo el inventario: visibilidad inmediata en un día.
2. Firewall y switch core por SNMPv3.
3. Virtualización (vCenter, clúster Hyper-V o Proxmox VE) y hardware (iDRAC/iLO).
4. Servidores críticos con agente.
5. Backups, SAI, certificados, servicios web.
6. Resto de switches, wifi, impresoras.
7. Revisar ruido tras 2 semanas y ajustar umbrales.
