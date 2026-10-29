# Guía de monitorización de toda la infraestructura

Propuesta base: **Zabbix (versión LTS)** como sistema central, porque es gratuito,
trae plantillas oficiales para la mayoría de fabricantes y gestiona alertas,
escalados y mantenimientos. Si ya usáis un RMM (por ejemplo NinjaOne) para
servidores y puestos, Zabbix complementa la parte de red, virtualización y
hardware; las alertas de ambos deben acabar en el mismo sistema de tickets.

## 1. Arquitectura

```
                 +---------------------------+
  Equipos  --->  |  Zabbix Server (VM Linux) |  ---> Alertas: correo, Teams, Telegram, SMS
  (SNMP,         |  + base de datos + web    |  ---> Tickets (PSA / GLPI / NinjaOne)
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
| Switch HPE Aruba | SNMPv3 | UDP 161 | `HP Enterprise Switch by SNMP` / Aruba (según modelo) |
| Router operadora | Ping + SNMP si os dan acceso | ICMP | `ICMP Ping` |
| VMware ESXi/vCenter | API de vCenter | TCP 443 | `VMware` (requiere `StartVMwareCollectors` en el servidor) |
| Hyper-V / Windows | Zabbix Agent 2 | TCP 10050 | `Windows by Zabbix agent` + contadores Hyper-V |
| Linux | Zabbix Agent 2 | TCP 10050 | `Linux by Zabbix agent` |
| Hardware servidor | Redfish / SNMP de iDRAC o iLO | 443 / 161 | `Dell iDRAC by SNMP`, `HPE iLO by HTTP` |
| Cabina de discos / NAS | SNMP o API del fabricante | 161 / 443 | Plantilla del fabricante (Synology, QNAP, NetApp...) |
| SAI | SNMP de la tarjeta de red | 161 | `APC UPS by SNMP` (u otra marca) |
| Backup Veeam | API REST de Veeam | 9419 | `Veeam Backup and Replication by HTTP` |
| Web/servicios | Comprobación HTTP, certificado | 443 | `Website certificate by Zabbix agent 2`, web scenarios |
| Salida a Internet | Ping a 1.1.1.1 / 8.8.8.8 + speedtest | ICMP | `ICMP Ping` + scripts de `05-Pruebas-Red` |

Regla general: **SNMPv3 con autenticación y cifrado** (nunca `public`), y acceso SNMP solo desde la IP del servidor/proxy Zabbix.

## 3. Configuración por fabricante (copiar y adaptar)

Sustituye `<ZBX_IP>`, `<CLAVE_AUTH>` y `<CLAVE_PRIV>`. Guarda las claves en el gestor de contraseñas.

### FortiGate (FortiOS 7.x)
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
```
snmp-server view ZBXVIEW iso included
snmp-server group ZBXGRP v3 priv read ZBXVIEW
snmp-server user zabbix ZBXGRP v3 auth sha <CLAVE_AUTH> priv aes 128 <CLAVE_PRIV>
snmp-server host <ZBX_IP> version 3 priv zabbix
snmp-server enable traps snmp linkdown linkup coldstart
```

### HPE Aruba AOS-S (2530, 2930F...)
```
snmpv3 enable
snmpv3 user zabbix auth sha <CLAVE_AUTH> priv aes <CLAVE_PRIV>
snmpv3 group managerpriv user zabbix sec-model ver3
snmpv3 only
```

### HPE Aruba AOS-CX (6100, 6300...)
```
snmp-server vrf default
snmpv3 user zabbix auth sha auth-pass plaintext <CLAVE_AUTH> priv aes priv-pass plaintext <CLAVE_PRIV>
```

### VMware vCenter
1. Crea en vCenter un usuario `svc-zabbix` con rol **Solo lectura** propagado.
2. En `zabbix_server.conf`: `StartVMwareCollectors=2` y reinicia el servicio.
3. Crea un host en Zabbix, aplica la plantilla `VMware` y define las macros:
   `{$VMWARE.URL}=https://<vcenter>/sdk`, `{$VMWARE.USERNAME}`, `{$VMWARE.PASSWORD}`.
4. Zabbix descubre solo hosts ESXi, datastores y VMs.

### Hyper-V / Windows Server
1. Instala **Zabbix Agent 2** (MSI) con `Server=<ZBX_IP>` y `ServerActive=<ZBX_IP>`.
   Despliegue masivo: GPO o vuestro RMM.
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
Activa SNMPv3 o Redfish en la controladora (no en el sistema operativo). Así ves discos, fuentes, ventiladores y temperatura aunque el servidor esté apagado.

## 4. Organización dentro de Zabbix

- **Grupos de hosts** por tipo y sede: `Red/Firewalls`, `Red/Switches`, `Virtualización`, `Servidores`, `Hardware`, `Sede-Central`, `Sede-X`.
- **Etiquetas** (tags): `criticidad:alta`, `servicio:erp`, `equipo:sistemas`. Las alertas se enrutan por etiquetas.
- **Dependencias de triggers**: si cae el switch core, no quieres 40 alertas de equipos colgados de él. Marca que los triggers de cada equipo dependen del de su uplink (la misma columna `Uplink` del inventario).
- **Mapas de red** (Monitoring → Maps): replica el mapa del inventario con iconos que cambian de color.
- **Mantenimientos** (Data collection → Maintenance): durante una ventana programada se silencian alertas.

## 5. Orden de despliegue recomendado

1. Ping (ICMP) a todo el inventario: visibilidad inmediata en un día.
2. Firewall y switch core por SNMPv3.
3. vCenter / clúster Hyper-V y hardware (iDRAC/iLO).
4. Servidores críticos con agente.
5. Backups, SAI, certificados, servicios web.
6. Resto de switches, wifi, impresoras.
7. Revisar ruido tras 2 semanas y ajustar umbrales.
