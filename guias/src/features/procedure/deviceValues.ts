import type { Param, Procedure } from '../../domain/schema'
import { isCidr, isIpv4 } from '../../domain/validateParam'
import type { InventorySwitch } from '../planner/inventoryImport'
import { resolveParam, resolveValidValues, type StepContext } from '../planner/resolveParam'

/** Params an inventory device can fill: its management address, in the shapes the brands ask for, and its location. */
export const DEVICE_PARAM_IDS = ['ipCidr', 'ipAddress', 'mask', 'switchIp', 'location']

/**
 * The runbook values a device of «Mi infraestructura» provides: only what it lets us deduce and the runbook
 * accepts. Everything else, secrets included, is left for the user.
 */
export function deviceValues(device: InventorySwitch, procedure: Procedure): Record<string, string> {
  const ip = device.ip?.trim() ?? ''
  // A plain address goes in without a prefix, so resolveParam derives no mask and a CIDR param rejects it.
  const ipCidr = isCidr(ip) || isIpv4(ip) ? ip : undefined
  const context: StepContext = { switchName: device.nombre.trim(), change: procedure.task, ipCidr }

  const resolve = (param: Param) => {
    if (!DEVICE_PARAM_IDS.includes(param.id)) return undefined
    if (param.id === 'switchIp') return ipCidr?.split('/')[0]
    if (param.id === 'location') return device.ubicacion
    return resolveParam(param, context)
  }
  return resolveValidValues(procedure.params, resolve)
}
