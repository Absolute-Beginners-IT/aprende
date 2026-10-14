import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

const brands = () => screen.getByRole('navigation', { name: 'Marcas' })
const tasks = () => screen.getByRole('navigation', { name: 'Tareas' })
const openAt = (hash: string) => {
  window.location.hash = hash
  return render(<App />)
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

describe('App', () => {
  it('shows the manual title and one tab per brand', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Manual de Switching' })).toBeInTheDocument()
    expect(within(brands()).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Aruba CX 6100',
      'Cisco Catalyst 1300',
      'MikroTik CRS317',
      'Ruijie NBS3200',
    ])
  })

  it('lists every task of the brand in the sidebar, grouped and in working order', () => {
    openAt('#/p/aruba-aoscx')

    const group = within(tasks()).getByRole('list', { name: 'VLANs y puertos' })

    expect(within(group).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Crear una VLAN',
      'Asignar un puerto de acceso a una VLAN',
      'Configurar un puerto trunk',
      'Crear una agregación de enlaces (LAG con LACP)',
      'Reiniciar un dispositivo PoE y fijar su prioridad',
    ])
    expect(within(tasks()).getByRole('list', { name: 'Puesta en marcha y acceso' })).toBeInTheDocument()
  })

  it('opens a runbook from the sidebar in one click and marks it as the current one', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx')

    await user.click(within(tasks()).getByRole('link', { name: 'Crear una VLAN' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Crear una VLAN' })).toBeInTheDocument()
    expect(within(tasks()).getByRole('link', { name: 'Crear una VLAN' })).toHaveAttribute('aria-current', 'page')
    expect(within(tasks()).getByRole('link', { name: 'Configurar un puerto trunk' })).not.toHaveAttribute('aria-current')
  })

  it('keeps the task when switching to a brand that also has it', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx/port-trunk')

    await user.click(within(brands()).getByRole('link', { name: 'Cisco Catalyst 1300' }))

    expect(await screen.findByText(/Cisco · Cisco Catalyst 1300/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Configurar un puerto trunk' })).toBeInTheDocument()
    expect(within(brands()).getByRole('link', { name: 'Cisco Catalyst 1300' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens the brand sheet when the other brand does not have the task', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx/poe-port')

    await user.click(within(brands()).getByRole('link', { name: 'MikroTik CRS317' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'MikroTik CRS317' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Redes de seguridad' })).toBeInTheDocument()
    expect(within(tasks()).getByRole('link', { name: 'Ficha del equipo' })).toHaveAttribute('aria-current', 'page')
  })

  it('offers, inside a runbook, only the other brands that have that task', () => {
    openAt('#/p/aruba-aoscx/poe-port')

    const nav = screen.getByRole('navigation', { name: 'Misma tarea en otra marca' })

    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Cisco Catalyst 1300',
      'Ruijie NBS3200',
    ])
    expect(within(nav).getByRole('link', { name: 'Cisco Catalyst 1300' })).toHaveAttribute(
      'href',
      '#/p/cisco-c1300/poe-port',
    )
  })

  it('remembers the last brand used when returning to the home page', async () => {
    const user = userEvent.setup()
    openAt('#/p/cisco-c1300')

    await user.click(screen.getByRole('link', { name: 'Manual de Switching' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Manual de Switching' })).toBeInTheDocument()
    expect(within(brands()).getByRole('link', { name: 'Cisco Catalyst 1300' })).toHaveAttribute('aria-current', 'page')
    expect(within(tasks()).getByRole('link', { name: 'Ficha del equipo' })).toHaveAttribute('href', '#/p/cisco-c1300')
  })

  it('flags unverified runbooks in the sidebar', () => {
    openAt('#/p/mikrotik-routeros')

    const item = within(tasks()).getByRole('link', { name: /Crear una VLAN/ }).closest('li')

    expect(item).toHaveTextContent('sin verificar')
  })

  it('lets the sidebar be collapsed and expanded on narrow screens', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx')
    const toggle = screen.getByRole('button', { name: 'Tareas' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('explains when the address does not match any runbook', async () => {
    openAt('#/p/aruba-aoscx/does-not-exist')

    expect(await screen.findByText('No encontramos esa página.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '#/')
  })
})

describe('quick search', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Buscar guías' })

  it('opens with Ctrl+K, finds a runbook without accents and opens it with Enter', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx')

    await user.keyboard('{Control>}k{/Control}')
    await user.type(within(dialog()).getByRole('searchbox', { name: 'Buscar' }), 'gestion cisco')

    expect(within(dialog()).getByRole('link', { name: /Configurar la IP de gestión.*Cisco Catalyst 1300/ })).toBeInTheDocument()

    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Configurar la IP de gestión' })).toBeInTheDocument()
    expect(screen.getByText(/Cisco · Cisco Catalyst 1300/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens from its button and with the slash key, but not while typing in a field', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx/vlan-create')

    await user.type(screen.getByLabelText('Nombre de la VLAN'), '/')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Buscar/ }))
    expect(dialog()).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buscar/ })).toHaveFocus()

    await user.keyboard('/')
    expect(dialog()).toBeInTheDocument()
  })

  it('moves through the results with the arrow keys', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx')

    await user.keyboard('{Control>}k{/Control}')
    await user.type(within(dialog()).getByRole('searchbox', { name: 'Buscar' }), 'trunk')
    const results = within(dialog()).getAllByRole('link')

    expect(results[0]).toHaveAttribute('aria-current', 'true')

    await user.keyboard('{ArrowDown}')

    expect(results[0]).not.toHaveAttribute('aria-current')
    expect(results[1]).toHaveAttribute('aria-current', 'true')
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx')

    await user.keyboard('{Control>}k{/Control}')
    await user.type(within(dialog()).getByRole('searchbox', { name: 'Buscar' }), 'zzzz')

    expect(within(dialog()).getByText('Sin resultados.')).toBeInTheDocument()
  })

  it('lists the runbooks opened recently, both in the search and on the home page', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx/port-trunk')

    await user.keyboard('{Control>}k{/Control}')
    expect(within(dialog()).getByRole('link', { name: /Configurar un puerto trunk.*Aruba CX 6100/ })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('link', { name: 'Manual de Switching' }))
    const recents = await screen.findByRole('list', { name: 'Recientes' })

    expect(within(recents).getByRole('link', { name: /Configurar un puerto trunk.*Aruba CX 6100/ })).toHaveAttribute(
      'href',
      '#/p/aruba-aoscx/port-trunk',
    )
  })
})
