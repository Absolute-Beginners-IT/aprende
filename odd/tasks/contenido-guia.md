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
| Teams | conectores de Office 365 | retirados del 18 al 22 de mayo de 2026; usar `MS Teams Workflow` | devblogs.microsoft.com (MC1181996) |

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S2, S3 | inline | hecho: RED 2 tests de contenido → GREEN | d7db62c |
| T2 | S2, S3 | inline | hecho | 2c87754 |
| T3 | S1, S3 | inline | hecho: RED 2 tests → GREEN; build Hugo con 29 términos y 4 escenarios | 8b8ede0 |
| T4 | S1 | inline | hecho: RED (módulos ausentes) → GREEN 24/24; flujo de importación probado en el navegador | 9e9c42f |

T1 `content/kb`: fichas educativas, datos actualizados y sin referencias de empresa · T2 toolkit y guías actualizados · T3 glosario y escenarios (contenido, guía y app) · T4 modo «Mi infraestructura» con análisis de carencias.

## Log

- L1 (2026-10-29): "continua y actualiza la información desfasada que encuentres, si hay una tecnología que sea antigua y se este utilizando una versión mas actual y mejorada actualizalo"
- L2: dependencias de `app/` al día (`npm outdated` vacío, `npm audit` sin vulnerabilidades). Sin verificar: sintaxis SHA-256/AES-256 en AOS-CX (se deja `sha`/`aes` con indicación de comprobarlo) y macros exactas de `Proxmox VE by HTTP`.
- L3: pendiente fuera de alcance: correcciones de seguridad de los scripts del toolkit (inyección CSV en Descubrir-Red.ps1, hash de binarios, validación del prefijo).
- L4: revisión de fiabilidad aprobada (review-781124e58d0f5af0). Sus 3 avisos se corrigen: importación que informa de nuevos y actualizados, errores de almacenamiento visibles y tests del contenedor con React Testing Library (29/29).
- L5 (2026-10-29): L3 resuelto en el PR #4 (prefijo validado, celdas CSV protegidas, SHA-256 de binarios; `toolkit/tests/Test-Toolkit.ps1`). La importación que falla a mitad informa de lo guardado (PR #3).
- L6 (2026-10-30): L2 verificado. La documentación de AOS-CX 10.13 admite `auth sha224…sha512` y `priv aes192/aes256`: la guía usa `sha256`/`aes256`, con `sha`/`aes` como alternativa en versiones antiguas. `Proxmox VE by HTTP`: macros confirmadas en el README de la plantilla (Zabbix 7.0), con `{$PVE.URL.PORT}` y permisos también para el token. Avisos de la revisión del toolkit: exportación por `Export-CsvProtegido` con prueba de comportamiento y límite del hash documentado en `bin\LEEME.txt`. R3-002 (`FORMULA_GUARDED`) se mantiene como compromiso: solo afecta a un CSV externo con `'` seguido de un carácter de fórmula.
