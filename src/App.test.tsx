import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

describe('App', () => {
  it('shows the manual title and the available platforms', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Manual de Switching' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Aruba CX 6100/ })).toBeInTheDocument()
  })

  it('leads from the platform to its tasks grouped by area, and from a task to its runbook', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: /Aruba CX 6100/ }))

    const group = await screen.findByRole('region', { name: 'VLANs y puertos' })
    await user.click(within(group).getByRole('link', { name: /Crear una VLAN/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Crear una VLAN' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Vuelta atrás' })).toBeInTheDocument()
  })

  it('shows the platform safety nets on its page', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: /Aruba CX 6100/ }))

    expect(await screen.findByRole('heading', { name: 'Redes de seguridad' })).toBeInTheDocument()
    expect(screen.getByText('Modo checkpoint auto')).toBeInTheDocument()
  })

  it('explains when the address does not match any runbook', async () => {
    window.location.hash = '#/p/aruba-aoscx/does-not-exist'
    render(<App />)

    expect(await screen.findByText('No encontramos esa página.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '#/')
  })
})
