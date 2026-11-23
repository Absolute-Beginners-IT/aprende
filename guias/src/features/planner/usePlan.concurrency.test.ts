// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { NetworkPlan } from '../../domain/networkPlan'
import { twoSwitchPlan } from './planFixtures'
import { PLAN_STORAGE_KEY, rebasePlan, usePlan } from './usePlan'

beforeEach(() => localStorage.clear())
const withVlan = (plan: NetworkPlan, id: number, name: string): NetworkPlan => ({
  ...plan,
  vlans: [...plan.vlans, { id, name, purpose: 'users', subnet: '' }],
})

describe('L14 same-id add refused', () => {
  it('VLAN: storage byte-identical, exact message, cleared by a later applied change', () => {
    const base = twoSwitchPlan()
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(base))
    const { result } = renderHook(() => usePlan())
    // the map adds VLAN 30 in another tab; no storage event yet
    const theirs = JSON.stringify({ ...withVlan(base, 30, 'VOZIP'), extra: 1 })
    localStorage.setItem(PLAN_STORAGE_KEY, theirs)
    act(() => result.current.update((current) => rebasePlan(base, withVlan(base, 30, 'CAMARAS'), current)))
    expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(theirs)
    expect(result.current.conflict).toBe(
      'En otra pestaña se ha añadido la VLAN 30 (VOZIP) mientras escribías aquí: se queda esa y tu cambio no se ha guardado.',
    )
    expect(result.current.plan.vlans.map((v) => v.name)).toContain('VOZIP')
    act(() =>
      result.current.update((current) => ({
        ...current,
        vlans: current.vlans.map((v) => (v.id === 10 ? { ...v, name: 'OFICINA' } : v)),
      })),
    )
    expect(result.current.conflict).toBeUndefined()
    const saved = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? 'null')
    expect(saved.extra).toBe(1)
    expect(saved.vlans.find((v: { id: number }) => v.id === 30).name).toBe('VOZIP')
  })

  it('same VLAN content added by both writers is not a conflict', () => {
    const base = twoSwitchPlan()
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(base))
    const { result } = renderHook(() => usePlan())
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(withVlan(base, 30, 'X')))
    act(() => result.current.update((current) => rebasePlan(base, withVlan(base, 30, 'X'), current)))
    expect(result.current.conflict).toBeUndefined()
  })

  it('switch: refused with the switch name, storage byte-identical', () => {
    const base = twoSwitchPlan()
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(base))
    const { result } = renderHook(() => usePlan())
    const sw = (name: string) => ({ id: 'sw-3', name, platform: '', mgmtIp: '', gateway: '', bridge: '' })
    const theirs = JSON.stringify({ ...base, switches: [...base.switches, { ...sw('PLANTA2'), deviceId: 'd2' }] })
    localStorage.setItem(PLAN_STORAGE_KEY, theirs)
    act(() =>
      result.current.update((current) =>
        rebasePlan(base, { ...base, switches: [...base.switches, sw('ALMACEN')] }, current),
      ),
    )
    expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(theirs)
    expect(result.current.conflict).toBe(
      'En otra pestaña se ha añadido el switch PLANTA2 mientras escribías aquí: se queda ese y tu cambio no se ha guardado.',
    )
  })

  it('port with a clashing id still takes a free id (unchanged)', () => {
    const base = twoSwitchPlan()
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(base))
    const { result } = renderHook(() => usePlan())
    const mapPort = { id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/6', vlan: 20 }
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ ...base, ports: [...base.ports, mapPort] }))
    const mine = { id: 'pt-2', switch: 'sw-1', interface: '1/1/3', vlan: 10 }
    act(() => result.current.update((current) => rebasePlan(base, { ...base, ports: [...base.ports, mine] }, current)))
    const saved = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? 'null')
    expect(saved.ports).toEqual([...base.ports, mapPort, { ...mine, id: 'pt-3' }])
    expect(result.current.conflict).toBeUndefined()
  })
})
