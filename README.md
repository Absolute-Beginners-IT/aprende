# Proyecto: Mapa de infraestructura, monitorización y actuaciones

Carpeta de trabajo para documentar la infraestructura, montar la monitorización y
organizar alertas, mantenimientos y pruebas de red. Acompaña a la base de
conocimiento interactiva (mapa visual) publicada en Claude.

## Cómo usar esta carpeta (orden de trabajo)

| Fase | Carpeta | Qué haces | Resultado |
| --- | --- | --- | --- |
| 1. Descubrir | `00-Descubrimiento` | Ejecutas `Descubrir-Red.ps1` en cada VLAN/subred | `descubrimiento_<fecha>.csv` con IPs, nombres, MAC, puertos |
| 2. Inventariar | `01-Inventario` | Completas `inventario.csv` (tipo, marca, modelo, firmware, uplink) | Inventario único; lo pegas en el mapa interactivo |
| 3. Monitorizar | `02-Monitorizacion` | Sigues la guía: servidor Zabbix + SNMPv3/agentes por tipo de equipo | Todos los equipos con su plantilla aplicada |
| 4. Alertar | `03-Alertas` | Revisas `matriz-alertas.csv` y defines canales y horarios | Alertas útiles, sin ruido, a quien corresponde |
| 5. Actuaciones | `04-Actuaciones` | Programas mantenimientos según `calendario-mantenimiento.csv` | Calendario anual de parches, firmware, pruebas de restauración |
| 6. Medir la red | `05-Pruebas-Red` | Ejecutas los scripts de velocidad interna y de Internet | Histórico CSV de velocidades y latencias |
| 7. Procedimientos | `06-Runbooks` | Usas las plantillas MOP y post-mortem | Cada cambio y cada incidente documentado |

## Principios

1. **Una sola fuente de verdad:** el inventario. Todo (mapa, monitorización, alertas) sale de él.
2. **Nada sin monitorizar:** cada equipo del inventario tiene columna `Monitorizado` = Sí/No.
3. **Cada alerta tiene dueño y acción:** si una alerta no lleva a hacer algo, sobra.
4. **Cada actuación tiene MOP y rollback.**

## Requisitos de los scripts

- Windows PowerShell 5.1 o PowerShell 7.
- `iperf3` para pruebas internas (https://iperf.fr/iperf-download.php) — copia `iperf3.exe` en `05-Pruebas-Red\bin`.
- Ookla Speedtest CLI para Internet (https://www.speedtest.net/apps/cli) — copia `speedtest.exe` en `05-Pruebas-Red\bin`.
- Ejecuta los scripts de descubrimiento solo en redes de tu empresa y con autorización.
