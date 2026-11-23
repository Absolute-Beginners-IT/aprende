import { act, renderHook } from '@testing-library/react'
import type { NetworkPlan } from '../../domain/networkPlan'
import { twoSwitchPlan } from './planFixtures'
import { PLAN_STORAGE_KEY, rebasePlan, usePlan } from './usePlan'

const rename =
  (id: number, name: string) =>
  (plan: NetworkPlan): NetworkPlan => ({
    ...plan,
    vlans: plan.vlans.map((vlan) => (vlan.id === id ? { ...vlan, name } : vlan)),
  })
const addCameras = (plan: NetworkPlan): NetworkPlan => ({
  ...plan,
  vlans: [...plan.vlans, { id: 30, name: 'CAMARAS', purpose: 'cameras', subnet: '' }],
})
const stored = (): NetworkPlan => JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? 'null')

beforeEach(() => localStorage.clear())

describe('usePlan', () => {
  it('applies each change to what is stored right now', () => {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(twoSwitchPlan()))
    const { result } = renderHook(() => usePlan())

    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(addCameras(twoSwitchPlan())))
    act(() => result.current.update(rename(10, 'OFICINA')))

    expect(stored()).toEqual(addCameras(rename(10, 'OFICINA')(twoSwitchPlan())))
    expect(result.current.plan).toEqual(stored())
  })

  it('follows a change another tab stores', () => {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(twoSwitchPlan()))
    const { result } = renderHook(() => usePlan())

    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(addCameras(twoSwitchPlan())))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'otra-clave' }))
    })
    expect(result.current.plan.vlans).toHaveLength(3)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: PLAN_STORAGE_KEY }))
    })
    expect(result.current.plan.vlans.map((vlan) => vlan.id)).toEqual([10, 20, 99, 30])
  })

  it('does not write when a change leaves the plan as it is', () => {
    const text = JSON.stringify(twoSwitchPlan(), null, 2)
    localStorage.setItem(PLAN_STORAGE_KEY, text)
    const { result } = renderHook(() => usePlan())

    act(() => result.current.update((plan) => plan))

    expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(text)
  })

  it.each([
    ['unreadable', '{"version":1,"vlans":"roto"'],
    ['newer', JSON.stringify({ ...twoSwitchPlan(), version: 2 })],
  ])('reports a stored plan it must not write over (%s) and leaves it untouched', (reason, text) => {
    localStorage.setItem(PLAN_STORAGE_KEY, text)
    const { result } = renderHook(() => usePlan())

    expect(result.current.refusal).toBe(reason)
    act(() => result.current.update(addCameras))
    expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(text)

    act(() => result.current.replace(twoSwitchPlan()))
    expect(stored()).toEqual(twoSwitchPlan())
    expect(result.current.refusal).toBeUndefined()
  })

  it('stops writing as soon as another writer leaves a plan it must not write over', () => {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(twoSwitchPlan()))
    const { result } = renderHook(() => usePlan())

    localStorage.setItem(PLAN_STORAGE_KEY, '{"version":2}')
    act(() => result.current.update(addCameras))

    expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe('{"version":2}')
    expect(result.current.refusal).toBe('newer')
  })

  it('keeps working in memory when the browser blocks storage', () => {
    const blocked = () => {
      throw new DOMException('Access denied', 'SecurityError')
    }
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    const { result } = renderHook(() => usePlan())

    act(() => result.current.update(addCameras))
    act(() => result.current.update(rename(30, 'VIDEO')))

    expect(result.current.refusal).toBeUndefined()
    expect(result.current.plan.vlans).toEqual([{ id: 30, name: 'VIDEO', purpose: 'cameras', subnet: '' }])
    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe('rebasePlan', () => {
  it('applies only what the edit changed on top of the current plan', () => {
    const base = twoSwitchPlan()
    const current = addCameras(base)

    expect(rebasePlan(base, rename(10, 'OFICINA')(base), current)).toEqual(rename(10, 'OFICINA')(current))
  })

  it('removes what the edit removed and keeps out what another writer removed', () => {
    const base = twoSwitchPlan()
    const current = { ...addCameras(base), ports: [] }
    const next = { ...base, vlans: base.vlans.filter((vlan) => vlan.id !== 20) }

    expect(rebasePlan(base, next, current)).toEqual({
      ...current,
      vlans: current.vlans.filter((vlan) => vlan.id !== 20),
    })
  })

  it('takes the order the edit sets, with the items another writer added at the end', () => {
    const base = twoSwitchPlan()
    const [core, floor] = base.switches as [NetworkPlan['switches'][number], NetworkPlan['switches'][number]]
    const added = { ...floor, id: 'sw-3', name: 'planta2' }
    const current = { ...base, switches: [core, floor, added] }
    const next = { ...base, switches: [floor, core] }

    expect(rebasePlan(base, next, current).switches.map((item) => item.id)).toEqual(['sw-2', 'sw-1', 'sw-3'])
  })

  it('gives a new link or port a free id when another writer took the same one', () => {
    const base = twoSwitchPlan()
    const theirs = { id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/7', vlan: 20 }
    const mine = { id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/8', vlan: 10 }
    const current = { ...base, ports: [...base.ports, theirs] }

    expect(rebasePlan(base, { ...base, ports: [...base.ports, mine] }, current).ports).toEqual([
      ...base.ports,
      theirs,
      { ...mine, id: 'pt-3' },
    ])
  })

  it('keeps the current plan when the edit changed nothing', () => {
    const base = twoSwitchPlan()
    const current = addCameras(base)

    expect(rebasePlan(base, { ...base }, current)).toEqual(current)
  })
})

describe('rebasePlan keeps rows in place', () => {
  it('rebases an id change in place', () => {
    const base = twoSwitchPlan()
    const next = { ...base, vlans: base.vlans.map((v) => (v.id === 20 ? { ...v, id: 25 } : v)) }
    expect(rebasePlan(base, next, base)).toEqual(next)
  })

  it('puts a VLAN added at the top of the list at the top', () => {
    const base = twoSwitchPlan()
    const first = { id: 5, name: 'PRIMERA', purpose: 'other' as const, subnet: '' }
    const next = { ...base, vlans: [first, ...base.vlans] }
    expect(rebasePlan(base, next, base).vlans.map((v) => v.id)).toEqual([5, ...base.vlans.map((v) => v.id)])
  })
})

describe('rebasePlan with an item another writer added with the same id', () => {
  const video = { id: 30, name: 'VIDEO', purpose: 'cameras' as const, subnet: '' }

  it('keeps the VLAN another writer added and refuses the edit that adds another one with its id', () => {
    const base = twoSwitchPlan()
    const current = addCameras(base)
    const next = { ...base, vlans: [...base.vlans, video] }

    expect(() => rebasePlan(base, next, current)).toThrow(
      'En otra pestaña se ha añadido la VLAN 30 (CAMARAS) mientras escribías aquí: se queda esa y tu cambio no se ha guardado.',
    )
  })

  it('keeps the switch another writer added and refuses the edit that adds another one with its id', () => {
    const base = twoSwitchPlan()
    const theirs = { id: 'sw-3', name: 'ALMACEN', platform: 'cisco-c1300', mgmtIp: '', gateway: '', bridge: '' }
    const mine = { ...theirs, name: 'PLANTA2' }
    const current = { ...base, switches: [...base.switches, theirs] }
    const next = { ...base, switches: [...base.switches, mine] }

    expect(() => rebasePlan(base, next, current)).toThrow(
      'En otra pestaña se ha añadido el switch ALMACEN mientras escribías aquí: se queda ese y tu cambio no se ha guardado.',
    )
  })

  it('still keeps one copy when both writers added the very same VLAN', () => {
    const base = twoSwitchPlan()
    const current = addCameras(base)

    expect(rebasePlan(base, addCameras(base), current)).toEqual(current)
  })

  it('leaves the stored plan as it is and says why in usePlan', () => {
    const base = twoSwitchPlan()
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(base))
    const { result } = renderHook(() => usePlan())
    const theirs = JSON.stringify(addCameras(base))
    localStorage.setItem(PLAN_STORAGE_KEY, theirs)

    act(() => result.current.update((current) => rebasePlan(base, { ...base, vlans: [...base.vlans, video] }, current)))

    expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(theirs)
    expect(result.current.plan).toEqual(addCameras(base))
    expect(result.current.conflict).toBe(
      'En otra pestaña se ha añadido la VLAN 30 (CAMARAS) mientras escribías aquí: se queda esa y tu cambio no se ha guardado.',
    )

    act(() => result.current.update(rename(10, 'OFICINA')))
    expect(result.current.conflict).toBeUndefined()
    expect(stored().vlans[0]?.name).toBe('OFICINA')
  })
})
