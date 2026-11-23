import { parseVlanList } from '@shared/plan/vlanList'

describe('parseVlanList', () => {
  it('reads single VLANs and ranges, sorted and once each', () => {
    expect(parseVlanList('10, 20, 30-32')).toEqual({ ok: true, ids: [10, 20, 30, 31, 32] })
    expect(parseVlanList(' 30 - 31 ;20 20,10 ')).toEqual({ ok: true, ids: [10, 20, 30, 31] })
    expect(parseVlanList('1,4094')).toEqual({ ok: true, ids: [1, 4094] })
  })

  it('reads an empty field as no list', () => {
    expect(parseVlanList('')).toEqual({ ok: true, ids: [] })
    expect(parseVlanList('  , ')).toEqual({ ok: true, ids: [] })
  })

  it('refuses a VLAN outside 1-4094 with a message that says the valid range', () => {
    expect(parseVlanList('10, 5000')).toEqual({
      ok: false,
      error: 'La VLAN 5000 no existe: los números de VLAN van del 1 al 4094.',
    })
    expect(parseVlanList('0')).toEqual({
      ok: false,
      error: 'La VLAN 0 no existe: los números de VLAN van del 1 al 4094.',
    })
    expect(parseVlanList('4090-4095')).toMatchObject({ ok: false, error: expect.stringContaining('4095') })
  })

  it('refuses text that is not a VLAN number and shows how to write the list', () => {
    expect(parseVlanList('10, voz')).toEqual({
      ok: false,
      error:
        '«voz» no es un número de VLAN. Escribe números del 1 al 4094 separados por comas, por ejemplo 10, 20, 30-32.',
    })
    expect(parseVlanList('10-')).toMatchObject({ ok: false, error: expect.stringContaining('«10-»') })
    expect(parseVlanList('1.5')).toMatchObject({ ok: false, error: expect.stringContaining('«1.5»') })
  })

  it('refuses a range written backwards and says how to write it', () => {
    expect(parseVlanList('32-30')).toEqual({
      ok: false,
      error: 'El rango 32-30 está al revés: escribe primero el número menor (30-32).',
    })
  })
})
