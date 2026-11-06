# Guías: completar Proxmox, Synology y Veeam

Objetivo: completar las guías de Proxmox VE, añadir el almacenamiento Synology y, si encaja, Veeam Backup & Replication.
Rama: una por entrega desde `main` (`feat/guias-proxmox-completar`, luego Synology y Veeam) · Entrega: un PR por entrega · Pruebas: Vitest (`guias/`, `app/`), web ensamblada como en `pages.yml`.

## Specs

- S1. «Completa la guia de proxmox»: guías de Proxmox VE 9 para las tareas existentes que encajan y faltan: actualizar el sistema (`firmware-upgrade`), SNMP (`snmp-monitoring`) y restaurar la copia de la configuración (`config-restore`). Las tareas reutilizadas hablan del «equipo» en lugar del «switch».
- S2. «luego ponte con la de Almacenamioento Synology»: plataforma Synology DSM (tipo almacenamiento, gestión por interfaz web: solo pasos en pantalla) con sus guías de puesta en marcha. Supuesto: instalación de DSM, usuario administrador, NTP, syslog, SNMP, copia de la configuración y actualización.
- S3. «no se si encaja bien en esta parte Veeam Backup para ver como se monta como se hacen los jobs, donde se guardan etc..»: se propone como tipo nuevo «Copias de seguridad» (el inventario ya tiene el tipo `backup`), con instalación, repositorios, jobs y restauración. Pendiente de que el usuario confirme la estructura antes de escribirla.
- S4. Cada guía contrastada con la documentación oficial del fabricante y marcada con su estado; lo no contrastado se anota. Textos en español de España; README y CHANGELOG de las guías al día.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S4 | inline | hecho: RED (Proxmox 11 guías, SNMP en el orden de montaje) → GREEN; guías 337/337, app 138/138, navegador | feat/guias-proxmox-completar |
| T2 | S2, S4 | inline | hecho: RED (plataforma, 8 guías, tarjeta Almacenamiento, NAS en el Plan de despliegue) → GREEN; guías 338/338, app 139/139, navegador | feat/guias-synology |
| T3 | S3 | inline | pendiente: propuesta al usuario | |

## Log

- L1 (2026-11-06): «Completa la guia de proxmox y luego ponte con la de Almacenamioento Synology y no se si encaja bien en esta parte Veeam Backup para ver como se monta como se hacen los jobs, donde se guardan etc..»
- L2 (2026-11-06): Veeam encaja como tipo «Copias de seguridad»: el inventario de la app ya tiene `backup`; la equivalencia de tipos de deviceGuides se amplía cuando se añada. Se propone la estructura antes de escribirla.
- L3 (2026-11-06): T1. Proxmox: firmware-upgrade (apt full-upgrade, contrastada), snmp-monitoring (SNMPv3 con snmpd, sin verificar: Proxmox no lo documenta) y config-restore (archivo por archivo desde la copia, sin verificar). Las tres tareas reutilizadas hablan del «equipo». Siguiente: T2, Synology.
- L4 (2026-11-06): T2. Synology DSM 7.4 (la vigente; ya no es la 7.2): ocho guías de pasos web contrastadas con la guía de usuario de DSM 7.4 y la ayuda de DSM 7 (leída con el navegador: las páginas se cargan con JavaScript). La actualización de DSM es irreversible según Synology. Siguiente: T3, propuesta de Veeam.
