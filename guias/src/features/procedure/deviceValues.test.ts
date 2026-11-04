import { catalog } from '../../content/catalog'
import type { Procedure } from '../../domain/schema'
import type { InventorySwitch } from '../planner/inventoryImport'
import { deviceValues } from './deviceValues'

const runbook = (platform: string, task: string): Procedure => {
  const procedure = catalog.procedures.find((item) => item.platform === platform && item.task === task)
  if (!procedure) throw new Error(`No runbook ${platform}/${task}`)
  return procedure
}

const device = (fields: Partial<InventorySwitch> = {}): InventorySwitch => ({
  id: 'sw-core',
  nombre: 'SW-CORE',
  tipo: 'switch',
  ...fields,
})

describe('deviceValues', () => {
  it('fills the management IP with its prefix where the runbook asks for it', () => {
    expect(deviceValues(device({ ip: '192.168.99.2/24' }), runbook('aruba-aoscx', 'mgmt-ip'))).toEqual({
      ipCidr: '192.168.99.2/24',
    })
  })

  it('never invents a prefix for a device whose IP has none', () => {
    expect(deviceValues(device({ ip: '192.168.99.2' }), runbook('aruba-aoscx', 'mgmt-ip'))).toEqual({})
  })

  it('splits the IP into address and mask where the runbook asks for both', () => {
    expect(deviceValues(device({ ip: ' 192.168.99.3/24 ' }), runbook('cisco-c1300', 'mgmt-ip'))).toEqual({
      ipAddress: '192.168.99.3',
      mask: '255.255.255.0',
    })
    expect(deviceValues(device({ ip: '192.168.99.3' }), runbook('cisco-c1300', 'mgmt-ip'))).toEqual({
      ipAddress: '192.168.99.3',
    })
  })

  it('fills the switch IP a runbook uses to reach the device', () => {
    expect(deviceValues(device({ ip: '10.0.0.23/24' }), runbook('ruijie-reyee', 'mgmt-acl'))).toEqual({
      switchIp: '10.0.0.23',
    })
  })

  it('fills the location when the runbook accepts it, and never a secret', () => {
    const procedure = runbook('aruba-aoscx', 'snmp-monitoring')

    expect(deviceValues(device({ ubicacion: 'CPD-Rack2' }), procedure)).toEqual({ location: 'CPD-Rack2' })
    // The runbook's pattern rejects spaces, so this location is left for the user.
    expect(deviceValues(device({ ubicacion: 'Sala 1, rack 2' }), procedure)).toEqual({})
    expect(procedure.params.some((param) => param.type === 'secret')).toBe(true)
  })

  it('leaves out anything the device cannot provide or that is not a valid address', () => {
    expect(deviceValues(device({ ip: 'pendiente' }), runbook('cisco-c1300', 'mgmt-ip'))).toEqual({})
    expect(deviceValues(device({ ip: '300.1.1.1/24' }), runbook('cisco-c1300', 'mgmt-ip'))).toEqual({})
    expect(deviceValues(device({ ip: '10.0.0.1/40' }), runbook('aruba-aoscx', 'mgmt-ip'))).toEqual({})
    expect(deviceValues(device({ ip: '10.0.0.1/24' }), runbook('aruba-aoscx', 'vlan-create'))).toEqual({})
  })
})
