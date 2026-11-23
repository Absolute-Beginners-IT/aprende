import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { catalog } from '../../content/catalog'
import type { NetworkPlan } from '../../domain/networkPlan'
import { INVENTORY_STORAGE_KEY, TOPOLOGY_STORAGE_KEY } from './inventoryImport'
import { PlannerPage } from './PlannerPage'
import { twoSwitchPlan } from './planFixtures'
import { PLAN_STORAGE_KEY } from './usePlan'

const seed = () => localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(twoSwitchPlan()))
const openTab = (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
  user.click(screen.getByRole('tab', { name }))

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/plan'
})

describe('PlannerPage', () => {
  it('lists what is missing before showing a guide', async () => {
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    await openTab(user, /^Guía/)

    const issues = screen.getByRole('list', { name: 'Puntos por corregir' })
    expect(within(issues).getByText('Añade al menos una VLAN.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: /^1\./ })).not.toBeInTheDocument()
  })

  it('does not flag anything while the plan is still empty', () => {
    render(<PlannerPage catalog={catalog} />)

    expect(screen.getByRole('tab', { name: 'VLAN' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Puntos por corregir en esta sección' })).not.toBeInTheDocument()
  })

  it('builds the guide from the VLANs and switches the user enters', async () => {
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    await user.click(screen.getByRole('button', { name: 'Añadir VLAN' }))
    await user.clear(screen.getByRole('spinbutton', { name: 'ID de la VLAN 1' }))
    await user.type(screen.getByRole('spinbutton', { name: 'ID de la VLAN 1' }), '99')
    await user.type(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' }), 'GESTION')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Propósito de la VLAN 1' }), 'Gestión')

    await openTab(user, /^Switches/)
    await user.click(screen.getByRole('button', { name: 'Añadir switch' }))
    await user.type(screen.getByRole('textbox', { name: 'Nombre del switch 1' }), 'nucleo')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Modelo del switch 1' }), 'Aruba CX 6100')
    await user.type(screen.getByRole('textbox', { name: 'IP de gestión del switch 1' }), '192.168.99.2/24')

    await openTab(user, /^Guía/)

    const guide = screen.getByRole('region', { name: '1. nucleo · Aruba CX 6100' })
    const vlanStep = within(guide).getByRole('listitem', { name: 'Crear la VLAN 99 (GESTION)' })
    expect(within(vlanStep).getAllByText('vlan 99').length).toBeGreaterThan(0)
    expect(within(guide).getByRole('listitem', { name: 'IP de gestión 192.168.99.2/24' })).toBeInTheDocument()
  })

  describe('opened at the guide (#/plan/guia)', () => {
    const switchHeadings = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)

    it('opens on the «Guía» tab with the guide of every switch', () => {
      seed()
      render(<PlannerPage catalog={catalog} openGuide />)

      expect(screen.getByRole('tab', { name: 'Guía' })).toHaveAttribute('aria-selected', 'true')
      expect(switchHeadings()).toEqual(['1. nucleo · Aruba CX 6100', '2. planta1 · Cisco Catalyst 1300'])
    })

    it('shows only the part of the switch that follows the device given, with a way back to the whole guide', () => {
      const plan = twoSwitchPlan()
      plan.switches = plan.switches.map((item, index) => ({ ...item, deviceId: index === 0 ? 'core' : 'p1' }))
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
      render(<PlannerPage catalog={catalog} openGuide deviceId="p1" />)

      expect(screen.getByRole('tab', { name: 'Guía' })).toHaveAttribute('aria-selected', 'true')
      expect(switchHeadings()).toEqual(['2. planta1 · Cisco Catalyst 1300'])
      expect(screen.getByRole('link', { name: 'Ver la guía de todos los switches' })).toHaveAttribute(
        'href',
        '#/plan/guia',
      )
    })

    it('finds the switch of an inventory device matched by its name, as the planner matches them', () => {
      seed()
      localStorage.setItem(
        INVENTORY_STORAGE_KEY,
        JSON.stringify(
          [
            { id: 'core', nombre: 'nucleo', tipo: 'switch', marca: 'Aruba', modelo: 'CX 6100', ip: '192.168.99.2/24' },
            { id: 'p1', nombre: 'planta1', tipo: 'switch', ip: '192.168.99.3/24', uplinks: ['core'] },
          ].map((item) => ({ criticidad: 'Media', monitorizado: false, ...item })),
        ),
      )
      render(<PlannerPage catalog={catalog} openGuide deviceId="core" />)

      expect(switchHeadings()).toEqual(['1. nucleo · Aruba CX 6100'])
    })

    it('opens the whole guide for a device that is not in the plan', () => {
      seed()
      render(<PlannerPage catalog={catalog} openGuide deviceId="no-such-device" />)

      expect(switchHeadings()).toEqual(['1. nucleo · Aruba CX 6100', '2. planta1 · Cisco Catalyst 1300'])
      expect(screen.queryByRole('link', { name: 'Ver la guía de todos los switches' })).not.toBeInTheDocument()
    })

    it('still opens on «VLAN» at #/plan', () => {
      seed()
      render(<PlannerPage catalog={catalog} />)

      expect(screen.getByRole('tab', { name: 'VLAN' })).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('keeps the plan after leaving the page', async () => {
    seed()
    const { unmount } = render(<PlannerPage catalog={catalog} />)
    unmount()

    render(<PlannerPage catalog={catalog} />)

    expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')
  })

  it('shows the issues of each section on its tab', async () => {
    seed()
    const plan = twoSwitchPlan()
    plan.ports.push({ id: 'pt-2', switch: 'sw-2', interface: 'gi1/0/6', vlan: 30 })
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    expect(screen.getByRole('tab', { name: /^Puertos/ })).toHaveAccessibleName('Puertos (1 por corregir)')
    await openTab(user, /^Puertos/)

    expect(screen.getByText('El puerto gi1/0/6 de planta1 usa la VLAN 30, que no está en el plan.')).toBeInTheDocument()
  })

  it('tells what the user still has to look up and opens the full runbook with the values filled', async () => {
    seed()
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)
    await openTab(user, /^Guía/)

    const floor = screen.getByRole('region', { name: '2. planta1 · Cisco Catalyst 1300' })
    const access = within(floor).getByRole('listitem', { name: 'Puerto gi1/0/5 en la VLAN 10 (USUARIOS)' })
    expect(within(access).getByText(/VLAN que tiene ahora el puerto/)).toBeInTheDocument()

    await user.click(within(access).getByRole('button', { name: 'Abrir la guía con estos datos' }))

    expect(window.location.hash).toBe('#/p/cisco-c1300/port-access')
    expect(JSON.parse(localStorage.getItem('switching-manual:cisco-c1300/port-access:values') ?? '{}')).toEqual({
      interfaceId: 'gi1/0/5',
      vlanId: '10',
    })
  })

  it('draws the map of the network from the plan', () => {
    seed()
    render(<PlannerPage catalog={catalog} />)

    const map = screen.getByRole('img', { name: /^Mapa de la red/ })
    expect(map).toHaveAccessibleName(
      'Mapa de la red: nucleo (Aruba CX 6100) unido a planta1 (Cisco Catalyst 1300) por 1/1/49 y gi1/0/48',
    )
    expect(within(map).getByText('nucleo')).toBeInTheDocument()
    expect(within(map).getByText('192.168.99.3/24')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Leyenda de VLAN' })).getByText('10 USUARIOS')).toBeInTheDocument()
  })

  it('keeps a long switch name from running into the core label on the map', () => {
    const plan = twoSwitchPlan()
    const core = plan.switches[0]
    if (!core) throw new Error('fixture')
    core.name = 'sw-marmarra-sotano-principal'
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
    render(<PlannerPage catalog={catalog} />)

    const map = screen.getByRole('img', { name: /^Mapa de la red: sw-marmarra-sotano-principal/ })
    const name = within(map).getByText('sw-marmarra-sotano-p…')
    expect(name.parentElement?.querySelector('title')).toHaveTextContent('sw-marmarra-sotano-principal')
    expect(within(map).getByText('Núcleo')).not.toHaveAttribute('text-anchor', 'end')
  })

  describe('when the browser can measure text', () => {
    // jsdom has no layout, so each test gives every character a fixed width in pixels.
    const measureAs = (pixelsPerChar: number) => {
      Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
        configurable: true,
        value(this: SVGElement) {
          return (this.textContent ?? '').length * pixelsPerChar
        },
      })
    }
    afterEach(() => {
      Reflect.deleteProperty(SVGElement.prototype, 'getComputedTextLength')
    })
    const mapWithCoreNamed = (name: string) => {
      const plan = twoSwitchPlan()
      const core = plan.switches[0]
      if (!core) throw new Error('fixture')
      core.name = name
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
      render(<PlannerPage catalog={catalog} />)
      return screen.getByRole('img', { name: /^Mapa de la red/ })
    }

    it('shortens a name of wide letters to the width of the card', () => {
      measureAs(14)
      const map = mapWithCoreNamed('MMMMMMMMMMMMMMMMMMMM')

      const name = within(map).getByText('MMMMMMMMMM…')
      expect(name.parentElement?.querySelector('title')).toHaveTextContent('MMMMMMMMMMMMMMMMMMMM')
    })

    it('shows the fitted name when it matches the character rule it starts from', () => {
      // 21 characters of 7.9 px take 165.9 px, so the measured fit is the same 20 characters plus "…".
      measureAs(7.9)
      // With 23 characters the search tries 21 last, which does not fit, before settling on 20.
      const map = mapWithCoreNamed('aaaaaaaaaaaaaaaaaaaaaaa')

      expect(within(map).getByText('aaaaaaaaaaaaaaaaaaaa…')).toBeInTheDocument()
    })

    it('keeps a long name of narrow letters whole when it fits', () => {
      measureAs(4)
      const map = mapWithCoreNamed('iiiiiiiiiiiiiiiiiiiiiiiiiiii')

      const name = within(map).getByText('iiiiiiiiiiiiiiiiiiiiiiiiiiii')
      expect(name.parentElement?.querySelector('title')).toBeNull()
    })
  })

  it('marks on the map the switches with no path to the core', () => {
    const plan = twoSwitchPlan()
    plan.links = []
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
    render(<PlannerPage catalog={catalog} />)

    expect(within(screen.getByRole('img', { name: /^Mapa de la red/ })).getByText('Sin enlace')).toBeInTheDocument()
  })

  it('starts the VLANs from a template by purpose', async () => {
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    await user.click(screen.getByRole('button', { name: 'Oficina con telefonía y cámaras' }))

    const table = screen.getByRole('table', { name: 'VLAN del plan' })
    expect(within(table).getAllByRole('row')).toHaveLength(6)
    expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')
    expect(screen.queryByRole('button', { name: 'Oficina pequeña' })).not.toBeInTheDocument()
  })

  it('exports the plan as a JSON file', async () => {
    seed()
    const user = userEvent.setup()
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:plan')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clicked: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download)
    })
    render(<PlannerPage catalog={catalog} />)

    await user.click(screen.getByRole('button', { name: 'Exportar plan' }))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(JSON.parse(await blob.text())).toEqual(twoSwitchPlan())
    expect(clicked[0]).toMatch(/^plan-de-red_\d{4}-\d{2}-\d{2}\.json$/)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:plan')
    click.mockRestore()
  })

  it('imports a plan from a JSON file', async () => {
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)
    const file = new File([JSON.stringify(twoSwitchPlan())], 'plan.json', { type: 'application/json' })

    await user.upload(screen.getByLabelText('Importar plan'), file)

    expect(await screen.findByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')
  })

  it('rejects a file that is not a plan and keeps the current one', async () => {
    seed()
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    await user.upload(screen.getByLabelText('Importar plan'), new File(['{"hola": 1}'], 'otro.json'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese archivo no es un plan de red válido.')
    expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')
  })

  it('asks before replacing or emptying a plan with content', async () => {
    seed()
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<PlannerPage catalog={catalog} />)

    await user.click(screen.getByRole('button', { name: 'Vaciar plan' }))
    expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' })).toHaveValue('USUARIOS')

    await user.click(screen.getByRole('button', { name: 'Vaciar plan' }))
    expect(screen.queryByRole('textbox', { name: 'Nombre de la VLAN 1' })).not.toBeInTheDocument()
    expect(confirm).toHaveBeenCalledWith('Se va a borrar el plan actual. ¿Continuar?')
    confirm.mockRestore()
  })

  it('offers only switch models for a switch of the plan', async () => {
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)

    await openTab(user, /^Switches/)
    await user.click(screen.getByRole('button', { name: 'Añadir switch' }))

    const options = within(screen.getByRole('combobox', { name: 'Modelo del switch 1' })).getAllByRole('option')
    expect(options.map((option) => option.textContent)).not.toContain('FortiGate')
    expect(options.length).toBeGreaterThan(4)
  })

  it('removes the links and ports of a switch that is deleted', async () => {
    seed()
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)
    await openTab(user, /^Switches/)

    await user.click(screen.getByRole('button', { name: 'Quitar el switch planta1' }))
    await openTab(user, /^Puertos/)

    expect(screen.queryByRole('textbox', { name: 'Puerto 1' })).not.toBeInTheDocument()
  })

  describe('with switches in «Mi infraestructura»', () => {
    const inventory = [
      { id: 'core', nombre: 'SW-CORE', tipo: 'switch', marca: 'Aruba', modelo: 'CX 6100', ip: '192.168.99.2/24' },
      { id: 'p1', nombre: 'SW-P1', tipo: 'switch', marca: 'HPE', modelo: '2530', uplinks: ['core'] },
      { id: 'fw', nombre: 'FW01', tipo: 'firewall' },
    ].map((item) => ({ criticidad: 'Media', monitorizado: false, ...item }))
    const seedInventory = () => localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory))
    const storedPlan = () => JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? '{}')

    it('shows the inventory switches with their name and address, which only «Mi infraestructura» changes', async () => {
      seedInventory()
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      await openTab(user, /^Switches/)

      const table = screen.getByRole('table', { name: 'Switches del plan' })
      expect(within(table).getByText('SW-CORE')).toBeInTheDocument()
      expect(within(table).getByText('192.168.99.2/24')).toBeInTheDocument()
      expect(within(table).getByText('SW-P1')).toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: 'Nombre del switch 1' })).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: 'IP de gestión del switch 1' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Añadir switch' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Quitar el switch/ })).not.toBeInTheDocument()
      expect(screen.getByText(/salen de Mi infraestructura/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Traer switches del inventario' })).not.toBeInTheDocument()
    })

    it('takes the switches and their connections from the topology that «Mi infraestructura» now stores', async () => {
      const { uplinks: _, ...p1 } = inventory[1] as (typeof inventory)[number] & { uplinks?: string[] }
      localStorage.setItem(
        TOPOLOGY_STORAGE_KEY,
        JSON.stringify({
          version: 2,
          equipos: [inventory[0], p1, inventory[2]],
          enlaces: [{ id: 'p1--core', a: { equipo: 'p1' }, b: { equipo: 'core' }, tipo: 'troncal' }],
          grupos: [],
        }),
      )
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      await openTab(user, /^Enlaces/)

      await user.type(screen.getByRole('textbox', { name: 'Puerto A del enlace 1' }), '1/1/49')
      expect(storedPlan().switches.map((item: { deviceId: string }) => item.deviceId)).toEqual(['core', 'p1'])
      expect(storedPlan().links).toEqual([
        { id: 'ln-1', a: { switch: 'sw-1', interface: '1/1/49' }, b: { switch: 'sw-2', interface: '' }, nativeVlan: 1 },
      ])
    })

    it('lets the user pick the model only when brand and model match none of the manual', async () => {
      seedInventory()
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      await openTab(user, /^Switches/)

      expect(screen.getByRole('combobox', { name: 'Modelo del switch 1' })).toBeDisabled()
      const second = screen.getByRole('combobox', { name: 'Modelo del switch 2' })
      expect(second).toBeEnabled()
      await user.selectOptions(second, 'cisco-c1300')
      const pairs = storedPlan().switches.map((item: { deviceId: string; platform: string }) => [
        item.deviceId,
        item.platform,
      ])
      expect(pairs).toEqual([
        ['core', 'aruba-aoscx'],
        ['p1', 'cisco-c1300'],
      ])
    })

    it('takes the links from the connections and keeps the ports the user writes', async () => {
      seedInventory()
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      await openTab(user, /^Enlaces/)

      expect(screen.queryByRole('button', { name: 'Añadir enlace' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Quitar el enlace/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Switch A del enlace 1' })).not.toBeInTheDocument()
      await user.type(screen.getByRole('textbox', { name: 'Puerto A del enlace 1' }), '1/1/49')
      expect(storedPlan().links).toEqual([
        { id: 'ln-1', a: { switch: 'sw-1', interface: '1/1/49' }, b: { switch: 'sw-2', interface: '' }, nativeVlan: 1 },
      ])
    })

    describe('with ports set on the map', () => {
      const { uplinks: _, ...p1 } = inventory[1] as (typeof inventory)[number] & { uplinks?: string[] }
      const seedTopology = (enlace: object) =>
        localStorage.setItem(
          TOPOLOGY_STORAGE_KEY,
          JSON.stringify({ version: 2, equipos: [inventory[0], p1, inventory[2]], enlaces: [enlace], grupos: [] }),
        )

      it('shows the map port read-only with where to change it, and leaves the other side editable', async () => {
        seedTopology({
          id: 'p1--core',
          a: { equipo: 'p1', puerto: 'gi1/0/48' },
          b: { equipo: 'core' },
          tipo: 'troncal',
        })
        const topologyText = localStorage.getItem(TOPOLOGY_STORAGE_KEY)
        const user = userEvent.setup()
        render(<PlannerPage catalog={catalog} />)

        await openTab(user, /^Enlaces/)

        // Side a is the core (what p1 hangs from); side b is p1, whose port the map sets.
        const fromMap = screen.getByRole('textbox', { name: 'Puerto B del enlace 1' })
        expect(fromMap).toHaveValue('gi1/0/48')
        expect(fromMap).toHaveAttribute('readonly')
        expect(fromMap).toHaveAccessibleDescription('Se cambia en el mapa de Mi infraestructura')
        const own = screen.getByRole('textbox', { name: 'Puerto A del enlace 1' })
        expect(own).not.toHaveAttribute('readonly')
        expect(own).not.toHaveAccessibleDescription()
        await user.type(own, '1/1/49')
        await user.type(fromMap, 'x')
        expect(fromMap).toHaveValue('gi1/0/48')
        expect(storedPlan().links).toEqual([
          {
            id: 'ln-1',
            a: { switch: 'sw-1', interface: '1/1/49' },
            b: { switch: 'sw-2', interface: '' },
            nativeVlan: 1,
          },
        ])
        expect(localStorage.getItem(TOPOLOGY_STORAGE_KEY)).toBe(topologyText)
      })

      it('puts the map port on the side of its switch when the plan has the link the other way round', async () => {
        localStorage.setItem(
          PLAN_STORAGE_KEY,
          JSON.stringify({
            ...twoSwitchPlan(),
            switches: twoSwitchPlan().switches.map((item, index) => ({ ...item, deviceId: ['core', 'p1'][index] })),
            links: [
              {
                id: 'ln-1',
                a: { switch: 'sw-2', interface: 'gi1/0/1' },
                b: { switch: 'sw-1', interface: '1/1/1' },
                nativeVlan: 1,
              },
            ],
          }),
        )
        seedTopology({ id: 'p1--core', a: { equipo: 'p1' }, b: { equipo: 'core', puerto: '1/1/52' }, tipo: 'datos' })
        const user = userEvent.setup()
        render(<PlannerPage catalog={catalog} />)

        await openTab(user, /^Enlaces/)

        expect(screen.getByRole('textbox', { name: 'Puerto A del enlace 1' })).toHaveValue('gi1/0/1')
        expect(screen.getByRole('textbox', { name: 'Puerto A del enlace 1' })).not.toHaveAttribute('readonly')
        expect(screen.getByRole('textbox', { name: 'Puerto B del enlace 1' })).toHaveValue('1/1/52')
        expect(screen.getByRole('textbox', { name: 'Puerto B del enlace 1' })).toHaveAttribute('readonly')
      })
    })

    it('keeps the plan made before, matching its switches by name, and names the ones the inventory lacks', () => {
      seedInventory()
      const plan = twoSwitchPlan()
      plan.switches.push({ id: 'sw-3', name: 'sw-core', platform: '', mgmtIp: '', gateway: '192.168.99.1', bridge: '' })
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
      render(<PlannerPage catalog={catalog} />)

      expect(screen.getByRole('status')).toHaveTextContent(
        'nucleo y planta1 están en el plan pero no en Mi infraestructura, así que no se muestran. Para recuperarlos con sus enlaces y puertos, añádelos allí con el mismo nombre.',
      )
      const stored = storedPlan()
      const rows = stored.switches.map((item: { id: string; name: string; deviceId?: string; gateway: string }) => [
        item.id,
        item.name,
        item.deviceId,
        item.gateway,
      ])
      expect(rows).toEqual([
        ['sw-3', 'SW-CORE', 'core', '192.168.99.1'],
        ['sw-4', 'SW-P1', 'p1', ''],
        ['sw-1', 'nucleo', undefined, '192.168.99.1'],
        ['sw-2', 'planta1', undefined, '192.168.99.1'],
      ])
      expect(stored.ports).toEqual(plan.ports)
      expect(stored.links).toContainEqual(plan.links[0])
    })

    it('discards the switches the inventory lacks, with their links and ports, after asking', async () => {
      seedInventory()
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(twoSwitchPlan()))
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
      render(<PlannerPage catalog={catalog} />)

      await user.click(screen.getByRole('button', { name: 'Quitar del plan' }))
      expect(confirm).toHaveBeenLastCalledWith(
        '¿Quitar nucleo y planta1 del plan? Se borran también sus enlaces y sus puertos.',
      )
      expect(storedPlan().switches).toHaveLength(4)

      await user.click(screen.getByRole('button', { name: 'Quitar del plan' }))
      expect(storedPlan().switches.map((item: { name: string }) => item.name)).toEqual(['SW-CORE', 'SW-P1'])
      expect(storedPlan().ports).toEqual([])
      expect(screen.queryByRole('button', { name: 'Quitar del plan' })).not.toBeInTheDocument()
      confirm.mockRestore()
    })

    it('asks to rename one of two inventory switches that share a name', () => {
      localStorage.setItem(
        INVENTORY_STORAGE_KEY,
        JSON.stringify([
          { id: 'a', nombre: 'SW-P1', tipo: 'switch', criticidad: 'Media', monitorizado: false },
          { id: 'b', nombre: 'sw-p1', tipo: 'switch', criticidad: 'Media', monitorizado: false },
        ]),
      )
      render(<PlannerPage catalog={catalog} />)

      expect(screen.getByRole('status')).toHaveTextContent(
        'En Mi infraestructura hay dos switches llamados SW-P1. Cambia el nombre de uno allí: el plan no puede saber cuál es cuál.',
      )
    })

    it('finds the plan switch by its name again once two inventory switches no longer share it', () => {
      const device = (id: string, nombre: string) => ({
        id,
        nombre,
        tipo: 'switch',
        criticidad: 'Media',
        monitorizado: false,
      })
      seed()
      localStorage.setItem(
        INVENTORY_STORAGE_KEY,
        JSON.stringify([device('c', 'nucleo'), device('a', 'planta1'), device('b', 'PLANTA1')]),
      )
      const { unmount } = render(<PlannerPage catalog={catalog} />)
      // While the name is shared, no new switch is saved in place of planta1; nucleo is still followed by its id.
      expect(storedPlan().switches.map((item: { id: string; deviceId?: string }) => [item.id, item.deviceId])).toEqual([
        ['sw-1', 'c'],
        ['sw-2', undefined],
      ])
      // planta1 is in the inventory, twice: it is not offered for removal as if it were missing.
      expect(screen.getByRole('status')).toHaveTextContent('hay dos switches llamados planta1')
      expect(screen.queryByText(/está en el plan pero no en Mi infraestructura/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Quitar del plan' })).not.toBeInTheDocument()
      unmount()

      localStorage.setItem(
        INVENTORY_STORAGE_KEY,
        JSON.stringify([device('c', 'nucleo'), device('a', 'planta1'), device('b', 'planta2')]),
      )
      render(<PlannerPage catalog={catalog} />)

      const planta1 = storedPlan().switches.find((item: { id: string }) => item.id === 'sw-2')
      expect(planta1).toMatchObject({ deviceId: 'a', gateway: '192.168.99.1' })
      expect(storedPlan().ports).toEqual(twoSwitchPlan().ports)
      expect(screen.queryByRole('button', { name: 'Quitar del plan' })).not.toBeInTheDocument()
    })

    it('still offers to discard a missing switch while two other inventory switches share a name', async () => {
      const device = (id: string, nombre: string) => ({
        id,
        nombre,
        tipo: 'switch',
        criticidad: 'Media',
        monitorizado: false,
      })
      seed()
      // nucleo is missing for real; planta1 is there twice.
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify([device('a', 'planta1'), device('b', 'PLANTA1')]))
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      expect(screen.getByText(/^nucleo está en el plan pero no en Mi infraestructura/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Quitar del plan' }))

      expect(confirm).toHaveBeenCalledWith('¿Quitar nucleo del plan? Se borran también sus enlaces y sus puertos.')
      const names = storedPlan().switches.map((item: { name: string }) => item.name)
      expect(names).toContain('planta1')
      expect(names).not.toContain('nucleo')
      expect(storedPlan().ports).toEqual(twoSwitchPlan().ports)
      confirm.mockRestore()
    })

    it('keeps following the other switches while two inventory switches share a name', () => {
      const device = (id: string, nombre: string) => ({
        id,
        nombre,
        tipo: 'switch',
        criticidad: 'Media',
        monitorizado: false,
      })
      const showWith = (devices: object[]) => {
        localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(devices))
        return render(<PlannerPage catalog={catalog} />)
      }
      seed()
      showWith([device('c', 'nucleo'), device('a', 'planta1'), device('b', 'PLANTA1')]).unmount()
      // nucleo is renamed before the shared name is solved: the plan follows it by its id.
      showWith([device('c', 'core'), device('a', 'planta1'), device('b', 'PLANTA1')]).unmount()
      showWith([device('c', 'core'), device('a', 'planta1'), device('b', 'planta2')])

      const stored = storedPlan()
      const pairs = stored.switches.map((item: { id: string; name: string; deviceId?: string }) => [
        item.id,
        item.name,
        item.deviceId,
      ])
      expect(pairs.slice(0, 2)).toEqual([
        ['sw-1', 'core', 'c'],
        ['sw-2', 'planta1', 'a'],
      ])
      expect(stored.links).toEqual(twoSwitchPlan().links)
      expect(stored.ports).toEqual(twoSwitchPlan().ports)
      expect(screen.queryByRole('button', { name: 'Quitar del plan' })).not.toBeInTheDocument()
    })

    it('works as before when the inventory has no switch', () => {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify([{ id: 'fw', nombre: 'FW01', tipo: 'firewall' }]))
      seed()
      render(<PlannerPage catalog={catalog} />)

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByText(/salen de Mi infraestructura/)).not.toBeInTheDocument()
      expect(storedPlan()).toEqual(twoSwitchPlan())
    })
  })

  describe('with another writer of the plan (the map of «Mi infraestructura», maybe in another tab)', () => {
    const device = (id: string, nombre: string, ip: string) => ({
      id,
      nombre,
      tipo: 'switch',
      ip,
      criticidad: 'Media',
      monitorizado: false,
    })
    const seedTopology = ({ vlans, withSecondFloor = false }: { vlans?: string; withSecondFloor?: boolean } = {}) =>
      localStorage.setItem(
        TOPOLOGY_STORAGE_KEY,
        JSON.stringify({
          version: 2,
          equipos: [
            device('core', 'nucleo', '192.168.99.2/24'),
            device('p1', 'planta1', '192.168.99.3/24'),
            ...(withSecondFloor ? [device('p2', 'planta2', '192.168.99.4/24')] : []),
          ],
          enlaces: [
            { id: 'p1--core', a: { equipo: 'p1' }, b: { equipo: 'core' }, tipo: 'troncal', ...(vlans && { vlans }) },
            ...(withSecondFloor
              ? [{ id: 'p2--core', a: { equipo: 'p2' }, b: { equipo: 'core' }, tipo: 'troncal' }]
              : []),
          ],
          grupos: [],
        }),
      )
    const storedPlan = (): NetworkPlan => JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? '{}')
    const addCameras = (plan: NetworkPlan): NetworkPlan => ({
      ...plan,
      vlans: [...plan.vlans, { id: 30, name: 'CAMARAS', purpose: 'cameras', subnet: '' }],
    })
    /** Another writer stores its change; another tab is told through a storage event, the same tab is not. */
    const writeAsOtherWriter = (change: (plan: NetworkPlan) => NetworkPlan, { notify }: { notify: boolean }) => {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(change(storedPlan())))
      if (notify) {
        act(() => {
          window.dispatchEvent(new StorageEvent('storage', { key: PLAN_STORAGE_KEY }))
        })
      }
    }

    it('shows a change another tab stores and keeps it when the planner edits the plan', async () => {
      seed()
      seedTopology()
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      writeAsOtherWriter(addCameras, { notify: true })
      expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 4' })).toHaveValue('CAMARAS')
      await user.type(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' }), 'X')

      expect(storedPlan().vlans.map((vlan) => [vlan.id, vlan.name])).toEqual([
        [10, 'USUARIOSX'],
        [20, 'VOZ'],
        [99, 'GESTION'],
        [30, 'CAMARAS'],
      ])
      expect(storedPlan().switches.map((item) => item.deviceId)).toEqual(['core', 'p1'])
    })

    it('applies its edit to what is stored right now, even before it hears of the other change', async () => {
      seed()
      seedTopology()
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      writeAsOtherWriter(addCameras, { notify: false })
      await user.type(screen.getByRole('textbox', { name: 'Nombre de la VLAN 1' }), 'X')

      expect(storedPlan().vlans.map((vlan) => vlan.name)).toEqual(['USUARIOSX', 'VOZ', 'GESTION', 'CAMARAS'])
      expect(screen.getByRole('textbox', { name: 'Nombre de la VLAN 4' })).toHaveValue('CAMARAS')
    })

    it('keeps the change of the other writer when it follows a new inventory switch', async () => {
      seed()
      seedTopology()
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      writeAsOtherWriter(addCameras, { notify: false })
      seedTopology({ withSecondFloor: true })
      await openTab(user, /^Switches/)

      expect(storedPlan().vlans.map((vlan) => vlan.id)).toEqual([10, 20, 99, 30])
      expect(storedPlan().switches.map((item) => item.name)).toEqual(['nucleo', 'planta1', 'planta2'])
    })

    it.each([
      [
        'cannot be read',
        '{"version":1,"vlans":"roto"',
        'El plan de red guardado en este navegador no se puede leer; no se ha tocado.',
      ],
      [
        'is of a newer version',
        JSON.stringify({ ...twoSwitchPlan(), version: 2 }),
        'El plan de red guardado en este navegador es de una versión más nueva; no se ha tocado.',
      ],
    ])(
      'never writes over a stored plan that %s, and replaces it only when the user confirms',
      async (_, text, message) => {
        localStorage.setItem(PLAN_STORAGE_KEY, text)
        seedTopology()
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
        const user = userEvent.setup()
        render(<PlannerPage catalog={catalog} />)

        expect(screen.getByRole('alert')).toHaveTextContent(message)
        expect(screen.queryByRole('button', { name: 'Añadir VLAN' })).not.toBeInTheDocument()
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Exportar plan' })).toBeDisabled()
        expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(text)

        await user.click(screen.getByRole('button', { name: 'Vaciar plan' }))
        await user.upload(
          screen.getByLabelText('Importar plan'),
          new File([JSON.stringify(twoSwitchPlan())], 'plan.json', { type: 'application/json' }),
        )
        expect(confirm).toHaveBeenCalledTimes(2)
        expect(confirm.mock.calls[0]?.[0]).toMatch(/Se va a borrar y lo que tenía se perderá/)
        expect(confirm.mock.calls[1]?.[0]).toMatch(/Se va a sustituir por el del archivo y lo que tenía se perderá/)
        expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(text)

        confirm.mockReturnValue(true)
        await user.click(screen.getByRole('button', { name: 'Vaciar plan' }))
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(storedPlan().vlans).toEqual([])
        confirm.mockRestore()
      },
    )

    it('still shows the guide when a VLAN list on the map cannot be read, and warns about it', async () => {
      seed()
      seedTopology({ vlans: '10, 5000' })
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      await openTab(user, /^Guía/)

      expect(screen.getByRole('region', { name: '1. nucleo · Aruba CX 6100' })).toBeInTheDocument()
      expect(within(screen.getByRole('list', { name: 'Avisos' })).getByRole('listitem')).toHaveTextContent(
        'El campo VLAN del enlace entre nucleo y planta1 en Mi infraestructura no es válido: La VLAN 5000 no existe: los números de VLAN van del 1 al 4094. Corrígelo en el mapa.',
      )
    })

    it('still shows the guide when a trunk on the map leaves out a VLAN with access ports, and warns about it', async () => {
      seed()
      seedTopology({ vlans: '20' })
      const user = userEvent.setup()
      render(<PlannerPage catalog={catalog} />)

      await openTab(user, /^Guía/)

      expect(screen.getByRole('region', { name: '1. nucleo · Aruba CX 6100' })).toBeInTheDocument()
      expect(within(screen.getByRole('list', { name: 'Avisos' })).getByRole('listitem')).toHaveTextContent(
        'La VLAN 10 no llega a planta1 (1 puerto de acceso): el campo VLAN del enlace entre nucleo y planta1 en Mi infraestructura no la deja pasar. Añádela a la troncal en el mapa.',
      )
      expect(screen.queryByRole('button', { name: /a la troncal/ })).not.toBeInTheDocument()
    })
  })
})

describe('PlannerPage concurrent writers', () => {
  it('says so when another tab added the same VLAN meanwhile', async () => {
    seed()
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)
    const plan = twoSwitchPlan()
    const theirs = JSON.stringify({
      ...plan,
      vlans: [...plan.vlans, { id: 30, name: 'CAMARAS', purpose: 'users', subnet: '' }],
    })
    localStorage.setItem(PLAN_STORAGE_KEY, theirs)

    await user.click(screen.getByRole('button', { name: 'Añadir VLAN' }))

    expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(theirs)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'En otra pestaña se ha añadido la VLAN 30 (CAMARAS) mientras escribías aquí: se queda esa y tu cambio no se ha guardado.',
    )
  })
})

describe('PlannerPage VLAN ids', () => {
  it('keeps a VLAN in its row while its ID is edited', async () => {
    seed()
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)
    const id2 = screen.getByRole('spinbutton', { name: 'ID de la VLAN 2' })
    await user.clear(id2)
    await user.type(id2, '25')
    const stored = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? 'null') as NetworkPlan
    expect(stored.vlans.map((v) => [v.id, v.name])).toEqual([
      [10, 'USUARIOS'],
      [25, 'VOZ'],
      [99, 'GESTION'],
    ])
  })
})
