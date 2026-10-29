# Contenido de guía, actualización tecnológica y modo «Mi infraestructura»

Objetivo: convertir la base de conocimiento en contenido de guía para juniors, actualizar lo desfasado y completar la siguiente fase (glosario, escenarios y modo «Mi infraestructura»).
Rama: `feat/contenido-guia` · Entrega: `ask-on-risk` · Tests: Vitest (app) + build Hugo.

## Specs

- S1. "continua" con la siguiente fase: reescribir el contenido en tono de guía y sin referencias a una empresa concreta; glosario y escenarios de incidencias; modo «Mi infraestructura» en la app.
- S2. "actualiza la información desfasada que encuentres, si hay una tecnología que sea antigua y se este utilizando una versión mas actual y mejorada actualizalo".
- S3. Textos del proyecto en español de España.

## Hallazgos verificados (2026-10-29)

| Tema | Antes | Ahora | Fuente |
| --- | --- | --- | --- |
| Zabbix | "versión LTS" sin concretar | 7.0 LTS vigente; 8.0 LTS prevista para el 4.º trimestre de 2026 | zabbix.com/life_cycle_and_release_policy |
| Cisco SNMPv3 | `auth sha` + `aes 128` | `auth sha-2 256` + `aes 256` desde IOS-XE 17.10 | community.cisco.com |
| FortiOS | "7.x" | 7.4 / 7.6 / 8.0 (8.0 desde abril de 2026, según rastreadores de terceros) | versio.io |
| Veeam | sin versión | B&R 13, API REST en 9419, solo en ediciones con API (no Enterprise) | zabbix.com/integrations/veeam |
| Dell iDRAC | `Dell iDRAC by SNMP` | Redfish: `DELL PowerEdge R7x0 by HTTP` (iDRAC 8/9) | documentación Zabbix 7.0 |
| Aruba CX | plantilla genérica | `Aruba CX 8300s by SNMP` (8325/8360) o `HP Enterprise Switch by SNMP` | documentación Zabbix |
| Virtualización | solo VMware / Hyper-V | añadido Proxmox VE (`Proxmox VE by HTTP`) | documentación Zabbix 7.0 |

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S2, S3 | inline | pendiente | |
| T2 | S2, S3 | inline | pendiente | |
| T3 | S1, S3 | inline | pendiente | |
| T4 | S1 | inline | pendiente | |

T1 `content/kb`: fichas educativas, datos actualizados y sin referencias de empresa · T2 toolkit y guías actualizados · T3 glosario y escenarios (contenido, guía y app) · T4 modo «Mi infraestructura» con análisis de carencias.

## Log

- L1 (2026-10-29): "continua y actualiza la información desfasada que encuentres, si hay una tecnología que sea antigua y se este utilizando una versión mas actual y mejorada actualizalo"
