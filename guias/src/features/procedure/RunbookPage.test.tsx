import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { catalog } from '../../content/catalog'
import { ConceptSchema, PlatformSchema, ProcedureSchema } from '../../domain/schema'
import { INVENTORY_STORAGE_KEY } from '../planner/inventoryImport'
import { RunbookPage } from './RunbookPage'

const status = { level: 'docs-checked', reviewed: '2026-10-13', firmware: 'AOS-CX 10.15' }
const sources = [{ title: 'Guía oficial de VLAN', url: 'https://example.com/vlan' }]

const platform = PlatformSchema.parse({
  id: 'aruba-aoscx',
  vendor: 'HPE Aruba Networking',
  name: 'Aruba CX 6100',
  deviceType: 'switch',
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
  order: 1,
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
  preflight: [{ text: 'Revisa las VLAN existentes.', command: 'show vlan' }],
  steps: [
    { title: 'Entrar en configuración', commands: ['config'], explanation: 'Cambia de modo.' },
    {
      title: 'Crear la VLAN',
      commands: ['vlan {{vlanId}}', 'name {{vlanName}}'],
      explanation: 'Crea la VLAN {{vlanId}}.',
      breakdown: [{ token: 'vlan', meaning: 'Crea la VLAN indicada.' }],
      warning: 'Comprueba el ID antes de seguir.',
    },
  ],
  verification: [{ command: 'show vlan {{vlanId}}', expect: 'Aparece la VLAN {{vlanId}}.' }],
  rollback: {
    summary: 'Borra la VLAN.',
    steps: [{ title: 'Borrar', commands: ['no vlan {{vlanId}}'], explanation: 'Elimina la VLAN.' }],
    lockoutRecovery: 'Reinicia el switch para volver a la configuración de arranque.',
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

    expect(titles).toEqual([
      'Tus datos',
      'Antes de empezar',
      'Paso a paso',
      'Verificación',
      'Vuelta atrás',
      'Registro del cambio',
      'Fuentes',
    ])
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
    expect(
      within(section('Paso a paso')).getByRole('button', { name: 'Copiar: Entrar en configuración' }),
    ).toBeEnabled()

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
    expect(screen.getByText('Copiado al portapapeles')).toHaveAttribute('role', 'status')
  })

  it('warns prominently, with its notes, when the runbook is unverified', () => {
    const unverified = ProcedureSchema.parse({
      ...procedure,
      status: { ...status, level: 'unverified', notes: 'El borrado no aparece en la documentación.' },
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={unverified} />)

    const notice = screen.getByRole('note', { name: 'Guía sin verificar' })
    expect(notice).toHaveTextContent('Pruébala antes en un equipo de laboratorio')
    expect(notice).toHaveTextContent('El borrado no aparece en la documentación.')
  })

  it('does not show the unverified warning on a runbook checked against the documentation', () => {
    renderPage()

    expect(screen.queryByRole('note', { name: 'Guía sin verificar' })).not.toBeInTheDocument()
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

    expect(screen.getByText('Comprueba el ID antes de seguir.')).toBeInTheDocument()
    expect(screen.getByText('Crea la VLAN indicada.')).toBeInTheDocument()
    expect(screen.getByText('Reinicia el switch para volver a la configuración de arranque.')).toBeInTheDocument()
  })

  it('shows a manual step without a command block or copy button', () => {
    const manual = ProcedureSchema.parse({
      ...procedure,
      steps: [{ title: 'Descargar el archivo', explanation: 'Cópialo a tu equipo.', manual: true }],
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={manual} />)

    expect(within(section('Paso a paso')).getByText('Cópialo a tu equipo.')).toBeInTheDocument()
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

  it('links to the same task on the other brands', () => {
    const alternatives = [{ name: 'Cisco Catalyst 1300', href: '#/p/cisco-c1300/vlan-create' }]
    render(<RunbookPage platform={platform} concept={concept} procedure={procedure} alternatives={alternatives} />)

    const nav = screen.getByRole('navigation', { name: 'Misma tarea en otra marca' })

    expect(within(nav).getByRole('link', { name: 'Cisco Catalyst 1300' })).toHaveAttribute(
      'href',
      '#/p/cisco-c1300/vlan-create',
    )
  })

  it('does not offer other brands when none has the task', () => {
    renderPage()

    expect(screen.queryByRole('navigation', { name: 'Misma tarea en otra marca' })).not.toBeInTheDocument()
  })

  it('offers an index that scrolls to each working section', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderPage()
    const index = screen.getByRole('navigation', { name: 'Secciones de la guía' })

    expect(
      within(index)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Tus datos', 'Antes de empezar', 'Paso a paso', 'Verificación', 'Vuelta atrás'])

    await user.click(within(index).getByRole('button', { name: 'Vuelta atrás' }))

    expect(scrollIntoView.mock.instances[0]).toBe(section('Vuelta atrás'))
  })

  it('says so when a runbook needs no values from the user', () => {
    const fixed = ProcedureSchema.parse({
      ...procedure,
      params: [],
      preflight: [{ text: 'Revisa las VLAN.', command: 'show vlan' }],
      steps: [{ title: 'Entrar en configuración', commands: ['config'], explanation: 'Cambia de modo.' }],
      verification: [{ command: 'show vlan', expect: 'Aparecen las VLAN.' }],
      rollback: { summary: 'Nada que deshacer.', steps: [{ commands: ['end'], explanation: 'Sale.' }] },
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={fixed} />)

    expect(within(section('Tus datos')).getByText('Esta guía no necesita datos tuyos.')).toBeInTheDocument()
    expect(within(section('Paso a paso')).getByRole('button', { name: 'Copiar todos los pasos' })).toBeEnabled()
  })

  it('blocks the commands while two values that must differ are the same', async () => {
    const user = userEvent.setup()
    const images = ProcedureSchema.parse({
      ...procedure,
      params: [
        {
          id: 'target',
          label: 'Imagen de destino',
          type: 'choice',
          example: 'secondary',
          options: ['primary', 'secondary'],
          differentFrom: { param: 'fallback', hint: 'No puede ser la misma imagen que la de reserva.' },
        },
        {
          id: 'fallback',
          label: 'Imagen de reserva',
          type: 'choice',
          example: 'primary',
          options: ['primary', 'secondary'],
        },
      ],
      preflight: [{ text: 'Mira las imágenes.' }],
      steps: [{ title: 'Descargar', commands: ['copy file {{target}}'], explanation: 'Descarga.' }],
      verification: [{ command: 'show images', expect: 'Aparece la versión nueva.' }],
      rollback: { summary: 'Volver.', steps: [{ commands: ['boot system {{fallback}}'], explanation: 'Reinicia.' }] },
    })
    render(<RunbookPage platform={platform} concept={concept} procedure={images} />)

    await user.selectOptions(screen.getByLabelText('Imagen de destino'), 'primary')
    await user.selectOptions(screen.getByLabelText('Imagen de reserva'), 'primary')

    expect(screen.getByText('No puede ser la misma imagen que la de reserva.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar: Descargar' })).toBeDisabled()
    expect(within(section('Paso a paso')).getByText('copy file <target>')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Imagen de reserva'), 'secondary')

    expect(screen.getByRole('button', { name: 'Copiar: Descargar' })).toBeEnabled()
    expect(within(section('Paso a paso')).getByText('copy file primary')).toBeInTheDocument()
  })

  it('labels the steps of a console-managed runbook as steps in the console', () => {
    const consolePlatform = PlatformSchema.parse({ ...platform, management: 'console', cliModes: [] })
    const onScreen = ProcedureSchema.parse({
      ...procedure,
      params: [],
      preflight: [{ text: 'Abre la consola.' }],
      steps: [{ title: 'Abrir el asistente', explanation: 'Pulsa Add Repository.', manual: true }],
      verification: [{ expect: 'El repositorio aparece en la lista.' }],
      rollback: { summary: 'Quítalo.', steps: [{ title: 'Quitar', explanation: 'Pulsa Remove.', manual: true }] },
    })
    render(<RunbookPage platform={consolePlatform} concept={concept} procedure={onScreen} />)

    expect(within(section('Paso a paso')).getByText('Paso en la consola')).toBeInTheDocument()
    expect(within(section('Vuelta atrás')).getByText('Paso en la consola')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar todos los pasos' })).not.toBeInTheDocument()
  })

  it('presents a web-managed runbook as screen steps, without command blocks to copy', () => {
    const webPlatform = PlatformSchema.parse({ ...platform, management: 'web', cliModes: [] })
    const web = ProcedureSchema.parse({
      ...procedure,
      params: [{ id: 'vlanId', label: 'ID de la VLAN', type: 'vlan-id', example: '20' }],
      preflight: [{ text: 'Abre Local Device > VLAN > VLAN List.' }],
      steps: [{ title: 'Añadir la VLAN', explanation: 'Pulsa Add e introduce {{vlanId}}.', manual: true }],
      verification: [{ expect: 'La VLAN {{vlanId}} aparece en VLAN List.' }],
      rollback: { summary: 'Bórrala.', steps: [{ title: 'Borrar', explanation: 'Pulsa Delete.', manual: true }] },
    })
    render(<RunbookPage platform={webPlatform} concept={concept} procedure={web} />)

    expect(within(section('Paso a paso')).getByText('Paso en la interfaz web')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar todos los pasos' })).not.toBeInTheDocument()
    expect(within(section('Verificación')).getByText('La VLAN <vlanId> aparece en VLAN List.')).toBeInTheDocument()
    expect(within(section('Verificación')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('links to the official sources', () => {
    renderPage()

    expect(screen.getByRole('link', { name: 'Guía oficial de VLAN' })).toHaveAttribute(
      'href',
      'https://example.com/vlan',
    )
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

  describe('with a secret value', () => {
    const withKey = ProcedureSchema.parse({
      ...procedure,
      params: [
        ...procedure.params,
        { id: 'authKey', label: 'Clave de autenticación', type: 'secret', example: 'Clave2026x' },
      ],
      steps: [
        ...procedure.steps,
        { title: 'Crear el usuario', commands: ['user monitor auth {{authKey}}'], explanation: 'Crea el usuario.' },
      ],
    })
    const renderWithKey = () => render(<RunbookPage platform={platform} concept={concept} procedure={withKey} />)

    it('shows the secret in the command and copies it, without writing it to the browser storage', async () => {
      const user = userEvent.setup()
      renderWithKey()
      await user.type(screen.getByLabelText('ID de la VLAN'), '20')
      await user.type(screen.getByLabelText('Clave de autenticación'), 'S3cretoReal')

      expect(screen.getByText('user monitor auth S3cretoReal')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Copiar: Crear el usuario' }))
      expect(await navigator.clipboard.readText()).toBe('user monitor auth S3cretoReal')
      expect(JSON.stringify({ ...localStorage })).not.toContain('S3cretoReal')
      expect(JSON.stringify({ ...localStorage })).toContain('20')
    })

    it('forgets the secret when the runbook is opened again, keeping the other values', async () => {
      const user = userEvent.setup()
      const first = renderWithKey()
      await user.type(screen.getByLabelText('ID de la VLAN'), '20')
      await user.type(screen.getByLabelText('Clave de autenticación'), 'S3cretoReal')
      first.unmount()

      renderWithKey()

      expect(screen.getByLabelText('ID de la VLAN')).toHaveValue('20')
      expect(screen.getByLabelText('Clave de autenticación')).toHaveValue('')
    })

    it('drops a secret left in the browser storage when another value changes', async () => {
      localStorage.setItem('switching-manual:aruba-aoscx/vlan-create:values', JSON.stringify({ authKey: 'Antigua123' }))
      const user = userEvent.setup()
      renderWithKey()

      expect(screen.getByLabelText('Clave de autenticación')).toHaveValue('')
      await user.type(screen.getByLabelText('ID de la VLAN'), '20')

      expect(JSON.stringify({ ...localStorage })).not.toContain('Antigua123')
    })

    it('clears the secret on request', async () => {
      const user = userEvent.setup()
      renderWithKey()
      await user.type(screen.getByLabelText('Clave de autenticación'), 'S3cretoReal')

      await user.click(screen.getByRole('button', { name: 'Limpiar datos y progreso' }))

      expect(screen.getByLabelText('Clave de autenticación')).toHaveValue('')
    })

    it('leaves the secret out of the copied change record', async () => {
      const user = userEvent.setup()
      renderWithKey()
      await user.type(screen.getByLabelText('Clave de autenticación'), 'S3cretoReal')

      await user.click(screen.getByRole('button', { name: 'Copiar registro del cambio' }))

      const copied = await navigator.clipboard.readText()
      expect(copied).not.toContain('S3cretoReal')
      expect(copied).toContain('- Clave de autenticación: ********')
    })

    it('tells the user the secret is not saved', () => {
      renderWithKey()

      expect(screen.getByText(/No se guarda en el navegador ni en el registro del cambio/)).toBeInTheDocument()
    })
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

  it('copies a change record with the device, ticket, values, progress and verification result', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText('ID de la VLAN'), '20')
    await user.type(screen.getByLabelText('Nombre de la VLAN'), 'VOZ')
    await user.click(screen.getByRole('checkbox', { name: 'Hecho: Crear la VLAN' }))
    const record = section('Registro del cambio')
    await user.type(within(record).getByLabelText('Equipo (nombre o IP)'), 'SW-PLANTA2')
    await user.type(within(record).getByLabelText('Ticket o referencia'), 'INC-1234')
    await user.click(within(record).getByRole('checkbox', { name: 'Verificación correcta' }))

    await user.click(within(record).getByRole('button', { name: 'Copiar registro del cambio' }))

    const copied = await navigator.clipboard.readText()
    expect(copied).toMatch(/^# Registro de cambio: Crear una VLAN/)
    expect(copied).toContain('| Equipo | SW-PLANTA2 |')
    expect(copied).toContain('| Ticket o referencia | INC-1234 |')
    expect(copied).toContain('2. [x] Crear la VLAN')
    expect(copied).toContain('vlan 20')
    expect(copied).toContain('Resultado: correcta')
  })

  it('keeps the change record fields when the page is opened again', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await user.type(within(section('Registro del cambio')).getByLabelText('Equipo (nombre o IP)'), 'SW-PLANTA2')

    unmount()
    renderPage()

    expect(within(section('Registro del cambio')).getByLabelText('Equipo (nombre o IP)')).toHaveValue('SW-PLANTA2')
  })

  it('clears the change record together with the values and progress', async () => {
    const user = userEvent.setup()
    renderPage()
    const record = section('Registro del cambio')
    await user.type(within(record).getByLabelText('Equipo (nombre o IP)'), 'SW-PLANTA2')
    await user.type(within(record).getByLabelText('Notas'), 'Ventana nocturna.')
    await user.click(within(record).getByRole('checkbox', { name: 'Verificación correcta' }))

    await user.click(screen.getByRole('button', { name: 'Limpiar datos y progreso' }))

    expect(within(record).getByLabelText('Equipo (nombre o IP)')).toHaveValue('')
    expect(within(record).getByLabelText('Notas')).toHaveValue('')
    expect(within(record).getByRole('checkbox', { name: 'Verificación correcta' })).not.toBeChecked()
  })

  it('downloads the change record as a Markdown file named by date, brand and task', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:record')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clicked: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download)
    })
    renderPage()

    await user.click(within(section('Registro del cambio')).getByRole('button', { name: 'Descargar .md' }))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(await blob.text()).toMatch(/^# Registro de cambio: Crear una VLAN/)
    expect(clicked[0]).toMatch(/^\d{4}-\d{2}-\d{2}_aruba-aoscx_vlan-create\.md$/)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:record')
    click.mockRestore()
  })

  it('opens the print dialog to save the runbook as PDF', async () => {
    const user = userEvent.setup()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderPage()

    await user.click(
      within(section('Registro del cambio')).getByRole('button', { name: 'Imprimir o guardar como PDF' }),
    )

    expect(print).toHaveBeenCalledOnce()
    print.mockRestore()
  })
})

describe('RunbookPage filled from «Mi infraestructura»', () => {
  const PICKER = 'Rellenar con un equipo de mi infraestructura'
  const inventory = [
    { id: 'fw01', nombre: 'FW01', tipo: 'firewall', ip: '192.168.99.1/24' },
    { id: 'sw-core', nombre: 'SW-CORE', tipo: 'switch', marca: 'HPE Aruba', modelo: '6300M', ip: '192.168.99.2/24' },
    { id: 'sw-sala', nombre: 'SW-SALA', tipo: 'switch', marca: 'Aruba', modelo: 'CX 6100', ubicacion: 'CPD-Rack2' },
    { id: 'sw-planta', nombre: 'SW-PLANTA', tipo: 'switch', marca: 'Cisco', modelo: 'C1300-48P', ip: '10.0.0.3' },
    { id: 'sw-almacen', nombre: 'SW-ALMACEN', tipo: 'switch', marca: 'Cisco', modelo: 'C1300-24P', ip: '10.0.0.4/16' },
  ]
  const storeInventory = (devices: unknown[] = inventory) =>
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(devices))

  const fromCatalog = (platformId: string, task: string) => {
    const brand = catalog.platforms.find((item) => item.id === platformId)
    const idea = catalog.concepts.find((item) => item.id === task)
    const runbook = catalog.procedures.find((item) => item.platform === platformId && item.task === task)
    if (!brand || !idea || !runbook) throw new Error(`No runbook ${platformId}/${task}`)
    return { platform: brand, concept: idea, procedure: runbook }
  }
  const renderRunbook = (platformId: string, task: string, deviceId?: string) =>
    render(<RunbookPage {...fromCatalog(platformId, task)} deviceId={deviceId} />)
  const storedValues = (platformId: string, task: string) =>
    JSON.parse(localStorage.getItem(`switching-manual:${platformId}/${task}:values`) ?? '{}')

  it('clears what the previous device filled when the next one cannot provide it', async () => {
    const user = userEvent.setup()
    storeInventory()
    renderRunbook('aruba-aoscx', 'mgmt-ip')
    await user.type(screen.getByLabelText('Puerta de enlace'), '192.168.99.254')

    await user.selectOptions(screen.getByLabelText(PICKER), 'sw-core')
    await user.selectOptions(screen.getByLabelText(PICKER), 'sw-sala')

    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('')
    expect(screen.getByLabelText('Puerta de enlace')).toHaveValue('192.168.99.254')
    expect(storedValues('aruba-aoscx', 'mgmt-ip')).toEqual({ gateway: '192.168.99.254' })
  })

  it('keeps a value the user changed after a device filled it', async () => {
    const user = userEvent.setup()
    storeInventory()
    renderRunbook('aruba-aoscx', 'mgmt-ip')
    await user.selectOptions(screen.getByLabelText(PICKER), 'sw-core')
    await user.clear(screen.getByLabelText('IP de gestión con prefijo'))
    await user.type(screen.getByLabelText('IP de gestión con prefijo'), '192.168.99.20/24')

    await user.selectOptions(screen.getByLabelText(PICKER), 'sw-sala')

    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('192.168.99.20/24')
  })

  it("does not carry one device's values into the runbook opened for another device", () => {
    storeInventory()
    const first = renderRunbook('aruba-aoscx', 'mgmt-ip', 'sw-core')
    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('192.168.99.2/24')
    first.unmount()

    renderRunbook('aruba-aoscx', 'mgmt-ip', 'sw-sala')

    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('')
  })

  it("keeps the user's correction when the runbook is opened again for the same device", async () => {
    const user = userEvent.setup()
    storeInventory()
    const first = renderRunbook('aruba-aoscx', 'mgmt-ip', 'sw-core')
    await user.clear(screen.getByLabelText('IP de gestión con prefijo'))
    await user.type(screen.getByLabelText('IP de gestión con prefijo'), '192.168.99.20/24')
    first.unmount()

    renderRunbook('aruba-aoscx', 'mgmt-ip', 'sw-core')

    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('192.168.99.20/24')
  })

  it('offers only the switches of this model, starting with «Ninguno, lo escribo yo»', () => {
    storeInventory()
    renderRunbook('aruba-aoscx', 'mgmt-ip')

    const picker = screen.getByLabelText(PICKER)
    expect(
      within(picker)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Ninguno, lo escribo yo', 'SW-CORE (192.168.99.2/24)', 'SW-SALA'])
    expect(picker).toHaveValue('')
    expect(within(section('Tus datos')).getByText(/«IP de gestión con prefijo»/)).toHaveTextContent(
      'el resto lo escribes tú',
    )
  })

  it('fills the management IP with its prefix and keeps the other values', async () => {
    const user = userEvent.setup()
    storeInventory()
    renderRunbook('aruba-aoscx', 'mgmt-ip')
    await user.type(screen.getByLabelText('Puerta de enlace'), '192.168.99.254')

    await user.selectOptions(screen.getByLabelText(PICKER), 'sw-core')

    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('192.168.99.2/24')
    expect(screen.getByLabelText('Puerta de enlace')).toHaveValue('192.168.99.254')
    expect(storedValues('aruba-aoscx', 'mgmt-ip')).toMatchObject({
      ipCidr: '192.168.99.2/24',
      gateway: '192.168.99.254',
    })
    expect(within(section('Tus datos')).getByText(/Puesto desde SW-CORE/)).toHaveTextContent(
      'Puesto desde SW-CORE: «IP de gestión con prefijo». El resto lo escribes tú.',
    )
  })

  it('fills the address alone when the device has no prefix, and the mask when it has one', async () => {
    const user = userEvent.setup()
    storeInventory()
    renderRunbook('cisco-c1300', 'mgmt-ip')

    await user.selectOptions(screen.getByLabelText(PICKER), 'sw-planta')
    expect(screen.getByLabelText('IP de gestión')).toHaveValue('10.0.0.3')
    expect(screen.getByLabelText('Máscara de red')).toHaveValue('')

    await user.selectOptions(screen.getByLabelText(PICKER), 'sw-almacen')
    expect(screen.getByLabelText('IP de gestión')).toHaveValue('10.0.0.4')
    expect(screen.getByLabelText('Máscara de red')).toHaveValue('255.255.0.0')
  })

  it('leaves the secrets as typed and never stores them', async () => {
    const user = userEvent.setup()
    storeInventory()
    renderRunbook('aruba-aoscx', 'snmp-monitoring')
    const [authKey] = fromCatalog('aruba-aoscx', 'snmp-monitoring').procedure.params.filter(
      (param) => param.type === 'secret',
    )
    if (!authKey) throw new Error('fixture')
    await user.type(screen.getByLabelText(authKey.label), 'clave-secreta-1')

    await user.selectOptions(screen.getByLabelText(PICKER), 'sw-sala')

    expect(screen.getByLabelText('Ubicación del switch')).toHaveValue('CPD-Rack2')
    expect(screen.getByLabelText(authKey.label)).toHaveValue('clave-secreta-1')
    expect(JSON.stringify(localStorage)).not.toContain('clave-secreta-1')
  })

  it('keeps the values as they are when the user goes back to «Ninguno, lo escribo yo»', async () => {
    const user = userEvent.setup()
    storeInventory()
    renderRunbook('aruba-aoscx', 'mgmt-ip')
    await user.selectOptions(screen.getByLabelText(PICKER), 'sw-core')

    await user.selectOptions(screen.getByLabelText(PICKER), '')

    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('192.168.99.2/24')
    expect(storedValues('aruba-aoscx', 'mgmt-ip')).toMatchObject({ ipCidr: '192.168.99.2/24' })
  })

  it('opens with the device of the address chosen and its values filled', () => {
    storeInventory()
    localStorage.setItem('switching-manual:aruba-aoscx/mgmt-ip:values', JSON.stringify({ gateway: '192.168.99.254' }))
    renderRunbook('aruba-aoscx', 'mgmt-ip', 'sw-core')

    expect(screen.getByLabelText(PICKER)).toHaveValue('sw-core')
    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('192.168.99.2/24')
    expect(screen.getByLabelText('Puerta de enlace')).toHaveValue('192.168.99.254')
    expect(storedValues('aruba-aoscx', 'mgmt-ip')).toEqual({ gateway: '192.168.99.254', ipCidr: '192.168.99.2/24' })
  })

  it('ignores a device of the address that is unknown or of another model', () => {
    storeInventory()
    localStorage.setItem('switching-manual:aruba-aoscx/mgmt-ip:values', JSON.stringify({ ipCidr: '10.9.9.9/24' }))

    for (const deviceId of ['no-existe', 'sw-planta', 'fw01']) {
      const { unmount } = renderRunbook('aruba-aoscx', 'mgmt-ip', deviceId)
      expect(screen.getByLabelText(PICKER)).toHaveValue('')
      expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('10.9.9.9/24')
      unmount()
    }
    expect(storedValues('aruba-aoscx', 'mgmt-ip')).toEqual({ ipCidr: '10.9.9.9/24' })
  })

  it('says so when the inventory has switches but none of this model', () => {
    storeInventory(inventory.filter((device) => device.marca !== 'Cisco'))
    renderRunbook('cisco-c1300', 'mgmt-ip')

    expect(screen.queryByLabelText(PICKER)).not.toBeInTheDocument()
    expect(within(section('Tus datos')).getByText('En tu inventario no hay switches de este modelo.')).toHaveClass(
      'muted',
    )
  })

  it('shows nothing about the inventory when this browser has no switches in it', () => {
    storeInventory([inventory[0]])
    renderRunbook('aruba-aoscx', 'mgmt-ip', 'sw-core')

    expect(screen.queryByLabelText(PICKER)).not.toBeInTheDocument()
    expect(screen.queryByText('En tu inventario no hay switches de este modelo.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('')
  })
})
