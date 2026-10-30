# Cómo llegan las alertas

## Severidades y canales

| Severidad Zabbix | Significado | Canal | Horario | Escalado |
| --- | --- | --- | --- | --- |
| Desastre | Servicio caído para toda la empresa | Teams + SMS/llamada + ticket | 24x7 | Si no se reconoce en 15 min → responsable de IT; 30 min → proveedor de soporte |
| Alta | Riesgo inminente o servicio degradado | Teams + ticket | 24x7 | Sin reconocer en 30 min → responsable |
| Media | Problema que hay que planificar | Correo + ticket | Laboral | — |
| Aviso | Tarea pendiente (licencias, parches) | Resumen diario por correo | Laboral | — |
| Información | Solo registro | Ninguno | — | — |

## Configuración en Zabbix

1. **Alerts → Media types**: activa `Email`, `MS Teams Workflow` (canal de Teams con un flujo "cuando se recibe una solicitud de webhook") y, si lo necesitas, `Telegram` o una pasarela SMS. No uses el antiguo tipo `MS Teams` basado en conectores de Office 365: Microsoft los retiró en mayo de 2026 y esos webhooks ya no funcionan.
2. **Users → tu usuario → Media**: añade correo y Teams con las severidades y horario de cada uno.
3. **Alerts → Actions → Trigger actions**: crea acciones por condición:
   - Severidad ≥ Alta **y** etiqueta `criticidad:alta` → Teams + SMS, pasos de escalado.
   - Severidad = Media → correo.
   - Operación de recuperación → aviso de "resuelto" por el mismo canal.
4. **Integración con tickets**: media type webhook hacia el sistema de tickets de la empresa (GLPI, Jira, el RMM/PSA, etc.) para que cada problema Alta/Desastre abra ticket y se cierre al recuperarse.

## Reglas contra el ruido

- Dependencias por uplink: solo alerta el equipo que realmente ha caído.
- Umbrales con duración (`>80% durante 15 min`), no picos.
- Mantenimientos programados silencian las ventanas de cambios.
- Revisión mensual: cada alerta que nadie atendió se ajusta o se elimina.
