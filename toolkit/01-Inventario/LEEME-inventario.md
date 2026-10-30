# Cómo rellenar el inventario

Separador: punto y coma (`;`), para que Excel en español lo abra bien. Una fila por equipo.

| Columna | Valores admitidos | Ejemplo |
| --- | --- | --- |
| Nombre | Nombre único (hostname) | FW01 |
| Tipo | `internet`, `firewall`, `router`, `switch`, `wifi`, `hipervisor`, `servidor`, `vm`, `almacenamiento`, `backup`, `sai`, `impresora`, `otro` | switch |
| Marca / Modelo | Texto libre | HPE Aruba / 2930F |
| IP_Gestion | IP de administración | 192.168.1.2 |
| Ubicacion | Sede / sala / rack | CPD-Rack1 |
| Rol | Qué hace | Core, acceso planta 1, perimetral |
| Criticidad | `Alta`, `Media`, `Baja` | Alta |
| Uplink | **Nombre** del equipo al que se conecta hacia arriba | CORE01 |
| Firmware | Versión actual | 7.4.5 |
| Fin_Soporte | Fecha AAAA-MM-DD de fin de soporte del fabricante | 2027-09-30 |
| Metodo_Monitorizacion | SNMPv3, agente Zabbix, API, IPMI/Redfish, ping | SNMPv3 |
| Monitorizado | `Sí` / `No` | No |

La columna **Uplink** es la que dibuja el mapa: cada equipo cuelga de su uplink.

## Dónde sacar cada dato

- **Firewall FortiGate:** `get system status` (modelo, firmware, serie).
- **Switch Aruba/HPE:** `show version`, `show lldp info remote-device` (vecinos = uplinks).
- **Switch Cisco:** `show version`, `show cdp neighbors` / `show lldp neighbors`.
- **ESXi/vCenter:** PowerCLI `Get-VMHost | Select Name,Version,Build,Model`.
- **Hyper-V:** `Get-VMHost`, `Get-ClusterNode`, `Get-VM`.
- **Windows:** `Get-ComputerInfo`, `Get-CimInstance Win32_BIOS`.
- **Fin de soporte:** web del fabricante o https://endoflife.date
