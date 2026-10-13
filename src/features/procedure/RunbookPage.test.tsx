import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConceptSchema, PlatformSchema, ProcedureSchema } from '../../domain/schema'
import { RunbookPage } from './RunbookPage'

const status = { level: 'docs-checked', reviewed: '2026-10-13', firmware: 'AOS-CX 10.15' }
const sources = [{ title: 'Guía oficial de VLAN', url: 'https://example.com/vlan' }]

const platform = PlatformSchema.parse({
  id: 'aruba-aoscx',
  vendor: 'HPE Aruba Networking',
  name: 'Aruba CX 6100',
  os: 'AOS-CX',
  models: ['6100 48G 4SFP+'],
  summary: 'Switch de acceso.',
  cliModes: [{ name: 'Manager', prompt: 'switch#', enter: 'Inicio de sesión', description: 'Consultas.' }],
  configPersistence: 'Se guarda con write memory.',
  safetyNets: [{ name: 'Checkpoint', description: 'Copia con nombre.' }],
  sources,
  status,
})

const concept = ConceptSchema.parse({
  id: 'vlan-create',
  title: 'Crear una VLAN',
  group: 'vlans-ports',
  summary: 'Da de alta una VLAN.',
  explanation: 'Una VLAN separa el tráfico.',
  risks: ['Usar un ID que ya existe.'],
})

const procedure = ProcedureSchema.parse({
  platform: 'aruba-aoscx',
  task: 'vlan-create',
  summary: 'Crea una VLAN y la guarda.',
  risk: { level: 'low', reason: 'No afecta a los puertos.' },
  params: [
    { id: 'vlanId', label: 'ID de la VLAN', type: 'vlan-id', example: '20' },
    { id: 'vlanName', label: 'Nombre de la VLAN', type: 'text', example: 'VOZ' },
  ],
  preflight: [{ text: 'Revisá las VLAN existentes.', command: 'show vlan' }],
  steps: [
    { title: 'Entrar en configuración', commands: ['config'], explanation: 'Cambia de modo.' },
    {
      title: 'Crear la VLAN',
      commands: ['vlan {{vlanId}}', 'name {{vlanName}}'],
      explanation: 'Crea la VLAN {{vlanId}}.',
      breakdown: [{ token: 'vlan', meaning: 'Crea la VLAN indicada.' }],
      warning: 'Comprobá el ID antes de seguir.',
    },
  ],
  verification: [{ command: 'show vlan {{vlanId}}', expect: 'Aparece la VLAN {{vlanId}}.' }],
  rollback: {
    summary: 'Borrá la VLAN.',
    steps: [{ title: 'Borrar', commands: ['no vlan {{vlanId}}'], explanation: 'Elimina la VLAN.' }],
    lockoutRecovery: 'Reiniciá el switch para volver a la configuración de arranque.',
  },
  sources,
  status,
})

const renderPage = () => render(<RunbookPage platform={platform} concept={concept} procedure={procedure} />)
const section = (name: string) => screen.getByRole('region', { name })

beforeEach(() => {
  localStorage.clear()
})

describe('RunbookPage', () => {
  it('shows the four fixed sections in order', () => {
    renderPage()

    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)

    expect(titles).toEqual(['Tus datos', 'Antes de empezar', 'Paso a paso', 'Verificación', 'Vuelta atrás', 'Fuentes'])
  })

  it('shows the risk level with its reason and the verification status', () => {
    renderPage()

    expect(screen.getByText('Riesgo bajo')).toBeInTheDocument()
    expect(screen.getByText('No afecta a los puertos.')).toBeInTheDocument()
    expect(screen.getByText('Contrastada con documentación')).toBeInTheDocument()
    expect(screen.getByText(/AOS-CX 10\.15/)).toBeInTheDocument()
  })

  it('marks unfilled values in the commands until the user types them', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(within(section('Paso a paso')).getByText('vlan <vlanId>')).toBeInTheDocument()

    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')

    expect(within(section('Paso a paso')).getByText('vlan 20')).toBeInTheDocument()
    expect(within(section('Paso a paso')).getByText('name VOZ')).toBeInTheDocument()
    expect(within(section('Paso a paso')).getByText('Crea la VLAN 20.')).toBeInTheDocument()
    expect(within(section('Verificación')).getByText('show vlan 20')).toBeInTheDocument()
    expect(within(section('Vuelta atrás')).getByText('no vlan 20')).toBeInTheDocument()
  })

  it('explains what is wrong with an invalid value', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('ID de la VLAN'), '5000')

    expect(screen.getByText('Debe ser un número entero entre 1 y 4094.')).toBeInTheDocument()
  })

  it('does not let the user copy a command with missing or invalid values', async () => {
    const user = userEvent.setup()
    renderPage()
    const copyStep = () => within(section('Paso a paso')).getByRole('button', { name: 'Copiar: Crear la VLAN' })

    expect(copyStep()).toBeDisabled()
    expect(within(section('Paso a paso')).getByRole('button', { name: 'Copiar: Entrar en configuración' })).toBeEnabled()

    await user.type(screen.getByLabelText('ID de la VLAN'), '5000')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')
    expect(copyStep()).toBeDisabled()

    await user.clear(screen.getByLabelText('ID de la VLAN'))
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    expect(copyStep()).toBeEnabled()
  })

  it('copies the commands of a step with the real values', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')

    await user.click(screen.getByRole('button', { name: 'Copiar: Crear la VLAN' }))

    expect(await navigator.clipboard.readText()).toBe('vlan 20\nname VOZ')
    expect(screen.getByRole('button', { name: 'Copiar: Crear la VLAN' })).toHaveTextContent('Copiado')
  })

  it('copies every step as one block', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')

    await user.click(screen.getByRole('button', { name: 'Copiar todos los pasos' }))

    expect(await navigator.clipboard.readText()).toBe('config\nvlan 20\nname VOZ')
  })

  it('shows the warning, the parameter breakdown and the lockout recovery', () => {
    renderPage()

    expect(screen.getByText('Comprobá el ID antes de seguir.')).toBeInTheDocument()
    expect(screen.getByText('Crea la VLAN indicada.')).toBeInTheDocument()
    expect(screen.getByText('Reiniciá el switch para volver a la configuración de arranque.')).toBeInTheDocument()
  })

  it('shows a manual step without a command block or copy button', () => {
    const manual = ProcedureSchema.parse({
      ...procedure,
      steps: [{ title: 'Descargar el archivo', explanation: 'Copialo a tu equipo.', manual: true }],
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={manual} />)

    expect(within(section('Paso a paso')).getByText('Copialo a tu equipo.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar: Descargar el archivo' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Hecho: Descargar el archivo' })).toBeInTheDocument()
    expect(within(section('Paso a paso')).getByText('Acción manual')).toBeInTheDocument()
  })

  it('shows a manual rollback step without a command block or copy button', () => {
    const manual = ProcedureSchema.parse({
      ...procedure,
      rollback: {
        summary: 'No confirmes el cambio.',
        steps: [{ title: 'Dejar vencer el temporizador', explanation: 'El switch vuelve solo.', manual: true }],
      },
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={manual} />)

    expect(within(section('Vuelta atrás')).getByText('El switch vuelve solo.')).toBeInTheDocument()
    expect(within(section('Vuelta atrás')).getByText('Acción manual')).toBeInTheDocument()
    expect(within(section('Vuelta atrás')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('links to the official sources', () => {
    renderPage()

    expect(screen.getByRole('link', { name: 'Guía oficial de VLAN' })).toHaveAttribute('href', 'https://example.com/vlan')
  })

  it('keeps the values and the step progress after reopening the runbook', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.click(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' }))
    first.unmount()

    renderPage()

    expect(screen.getByLabelText('ID de la VLAN')).toHaveValue('20')
    expect(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Hecho: Entrar en configuración' })).not.toBeChecked()
  })

  it('clears the values and the progress on request', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.click(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' }))

    await user.click(screen.getByRole('button', { name: 'Limpiar datos y progreso' }))

    expect(screen.getByLabelText('ID de la VLAN')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' })).not.toBeChecked()
  })
})
