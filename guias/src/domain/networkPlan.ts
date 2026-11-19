// The plan's schema lives in the module the guides share with «Mi infraestructura»; these helpers are the guides' own.
export {
  EMPTY_PLAN,
  type NetworkPlan,
  NetworkPlanSchema,
  orderFromCore,
  type PlanLink,
  PlanLinkSchema,
  type PlanPort,
  PlanPortSchema,
  type PlanSwitch,
  PlanSwitchSchema,
  type PlanVlan,
  PlanVlanSchema,
  VLAN_PURPOSES,
  type VlanPurpose,
} from '@shared/plan/networkPlan'

const toNumber = (address: string) => address.split('.').reduce((total, octet) => total * 256 + Number(octet), 0)

/** Whether an IPv4 address belongs to a network given in CIDR form. Both must already be valid. */
export function inSubnet(address: string, network: string): boolean {
  const [base = '', prefixText = '0'] = network.split('/')
  const prefix = Number(prefixText)
  const size = 2 ** (32 - prefix)
  return Math.floor(toNumber(address) / size) === Math.floor(toNumber(base) / size)
}

/** Dotted mask for a prefix length, such as 255.255.255.0 for 24. */
export function prefixToMask(prefix: number): string {
  const bits = '1'.repeat(prefix).padEnd(32, '0')
  return [0, 8, 16, 24].map((start) => Number.parseInt(bits.slice(start, start + 8), 2)).join('.')
}
