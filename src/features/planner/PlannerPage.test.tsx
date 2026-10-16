import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { catalog } from '../../content/catalog'
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

  it('removes the links and ports of a switch that is deleted', async () => {
    seed()
    const user = userEvent.setup()
    render(<PlannerPage catalog={catalog} />)
    await openTab(user, /^Switches/)

    await user.click(screen.getByRole('button', { name: 'Quitar el switch planta1' }))
    await openTab(user, /^Puertos/)

    expect(screen.queryByRole('textbox', { name: 'Puerto 1' })).not.toBeInTheDocument()
  })
})
