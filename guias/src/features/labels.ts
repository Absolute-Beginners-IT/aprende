import type { VlanPurpose } from '../domain/networkPlan'
import type { DeviceType, ManagementMode, RiskLevel, StatusLevel, TaskGroup } from '../domain/schema'

export const GROUP_LABELS: Record<TaskGroup, string> = {
  'setup-access': 'Puesta en marcha y acceso',
  'vlans-ports': 'VLANs y puertos',
  monitoring: 'Monitorización',
  'security-resilience': 'Seguridad y resiliencia',
}

// Plural, as they head the library's sections.
export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  switch: 'Switches',
  firewall: 'Firewalls',
  hypervisor: 'Virtualización',
  storage: 'Almacenamiento',
  backup: 'Copias de seguridad',
}

export const MANAGEMENT_LABELS: Record<ManagementMode, string> = {
  cli: 'Línea de comandos',
  web: 'Interfaz web',
  console: 'Consola gráfica',
}

// Tag of a step done by hand, named after where it is done.
export const MANUAL_STEP_LABELS: Record<ManagementMode, string> = {
  cli: 'Acción manual',
  web: 'Paso en la interfaz web',
  console: 'Paso en la consola',
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Riesgo bajo',
  medium: 'Riesgo medio',
  high: 'Riesgo alto',
}

export const STATUS_LABELS: Record<StatusLevel, string> = {
  unverified: 'Sin verificar',
  'docs-checked': 'Contrastada con documentación',
  'lab-tested': 'Probada en equipo real',
}

export const PURPOSE_LABELS: Record<VlanPurpose, string> = {
  users: 'Usuarios',
  voice: 'Voz (telefonía IP)',
  servers: 'Servidores',
  guests: 'Invitados',
  cameras: 'Cámaras',
  management: 'Gestión',
  iot: 'Dispositivos IoT',
  other: 'Otro',
}
