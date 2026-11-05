import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import packageJson from '../package.json'
import { App } from './App'
import { catalog } from './content/catalog'

const brands = () => screen.getByRole('navigation', { name: 'Marcas' })
const tasks = () => screen.getByRole('navigation', { name: 'Tareas' })
const openAt = (hash: string) => {
  window.location.hash = hash
  return render(<App />)
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
  document.documentElement.removeAttribute('data-theme')
})

describe('App', () => {
  it('says on every page that the manual is a prototype', () => {
    for (const hash of ['', '#/plan', '#/status', '#/f']) {
      const { unmount } = openAt(hash)
      expect(screen.getByRole('note', { name: 'Aviso de prototipo' })).toHaveTextContent(
        'Prototipo en desarrollo: el contenido se está revisando y no sustituye a la documentación oficial del fabricante ni a una prueba en laboratorio.',
      )
      unmount()
    }
  })

  it('shows the navigation of the website that embeds the manual when it is built with VITE_SITE_NAV', () => {
    vi.stubEnv(
      'VITE_SITE_NAV',
      JSON.stringify([
        { label: 'Inicio', href: '../../' },
        { label: 'Mapa', href: '../#mapa' },
        { label: 'Guías', href: './', current: true },
      ]),
    )
    try {
      render(<App />)
      const nav = within(screen.getByRole('navigation', { name: 'Secciones de la web' }))
      expect(nav.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
        ['Inicio', '../../'],
        ['Mapa', '../#mapa'],
        ['Guías', './'],
      ])
      expect(nav.getByRole('link', { name: 'Guías' })).toHaveAttribute('aria-current', 'page')
      expect(nav.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('on the website, shows the planner as a tab of «Mi infraestructura», after the map and the list and before the deployment plan', () => {
    vi.stubEnv(
      'VITE_SITE_NAV',
      JSON.stringify([
        { id: 'inicio', label: 'Inicio', href: '../../' },
        { id: 'infra', label: 'Mi infraestructura', href: '../#mi-infraestructura' },
        { id: 'guias', label: 'Guías', href: './', current: true },
      ]),
    )
    try {
      const { unmount } = openAt('#/plan')
      const site = within(screen.getByRole('navigation', { name: 'Secciones de la web' }))
      expect(site.getByRole('link', { name: 'Mi infraestructura' })).toHaveAttribute('aria-current', 'page')
      expect(site.getByRole('link', { name: 'Guías' })).not.toHaveAttribute('aria-current')
      const tabs = within(screen.getByRole('navigation', { name: 'Mi infraestructura' }))
      expect(tabs.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
        ['Mapa', '../#mi-infraestructura'],
        ['Lista', '../#mi-infraestructura/lista'],
        ['Red y VLAN', '#/plan'],
        ['Plan de despliegue', '../#mi-infraestructura/plan'],
      ])
      expect(tabs.getByRole('link', { name: 'Red y VLAN' })).toHaveAttribute('aria-current', 'page')
      expect(screen.queryByRole('link', { name: 'Planificador de red' })).not.toBeInTheDocument()
      unmount()

      openAt('#/f')
      expect(
        within(screen.getByRole('navigation', { name: 'Secciones de la web' })).getByRole('link', { name: 'Guías' }),
      ).toHaveAttribute('aria-current', 'page')
      expect(screen.queryByRole('navigation', { name: 'Mi infraestructura' })).not.toBeInTheDocument()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('keeps the planner in its own header when built on its own', () => {
    openAt('#/plan')
    expect(screen.getByRole('link', { name: 'Planificador de red' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('navigation', { name: 'Mi infraestructura' })).not.toBeInTheDocument()
  })

  it('ignores a VITE_SITE_NAV that is not a valid list of links', () => {
    for (const value of ['not json', '{"label":"Inicio"}', '[{"label":"Inicio"}]']) {
      vi.stubEnv('VITE_SITE_NAV', value)
      try {
        const { unmount } = render(<App />)
        expect(screen.queryByRole('navigation', { name: 'Secciones de la web' }), value).not.toBeInTheDocument()
        unmount()
      } finally {
        vi.unstubAllEnvs()
      }
    }
  })

  it('shows no website navigation when built on its own', () => {
    render(<App />)
    expect(screen.queryByRole('navigation', { name: 'Secciones de la web' })).not.toBeInTheDocument()
  })

  it('shows the manual title and one tab per brand', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Manual de Switching' })).toBeInTheDocument()
    expect(
      within(brands())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Aruba CX 6100', 'Cisco Catalyst 1300', 'MikroTik CRS317', 'Ruijie NBS3200'])
  })

  it('lists every task of the brand in the sidebar, grouped and in working order', () => {
    openAt('#/p/aruba-aoscx')

    const group = within(tasks()).getByRole('list', { name: 'VLANs y puertos' })

    expect(
      within(group)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
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
    expect(within(tasks()).getByRole('link', { name: 'Configurar un puerto trunk' })).not.toHaveAttribute(
      'aria-current',
    )
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

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Cisco Catalyst 1300', 'Ruijie NBS3200'])
    expect(within(nav).getByRole('link', { name: 'Cisco Catalyst 1300' })).toHaveAttribute(
      'href',
      '#/p/cisco-c1300/poe-port',
    )
  })

  it('keeps a firewall apart from the switches in the brand tabs and in the same task on another brand', () => {
    const { unmount } = openAt('#/p/aruba-aoscx/ntp-client')
    expect(within(brands()).queryByRole('link', { name: 'FortiGate' })).not.toBeInTheDocument()
    const others = screen.getByRole('navigation', { name: 'Misma tarea en otra marca' })
    expect(within(others).queryByRole('link', { name: 'FortiGate' })).not.toBeInTheDocument()
    unmount()

    openAt('#/p/fortinet-fortigate/ntp-client')
    expect(
      within(brands())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['FortiGate'])
    expect(screen.queryByRole('navigation', { name: 'Misma tarea en otra marca' })).not.toBeInTheDocument()
  })

  it('does not offer inventory switches on a firewall runbook', () => {
    localStorage.setItem(
      'mapa-infra:inventario',
      JSON.stringify([
        {
          id: 'sw1',
          nombre: 'SW1',
          tipo: 'switch',
          marca: 'HPE Aruba',
          modelo: '6100',
          criticidad: 'Media',
          monitorizado: false,
        },
      ]),
    )
    openAt('#/p/fortinet-fortigate/ntp-client')

    expect(screen.queryByText('En tu inventario no hay switches de este modelo.')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Si pierdes el acceso al equipo' })).toBeInTheDocument()
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

    const item = within(tasks())
      .getByRole('link', { name: /Crear una VLAN/ })
      .closest('li')

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

  it('opens a runbook from a device of the inventory with its values, marking the runbook as current', () => {
    localStorage.setItem(
      'mapa-infra:inventario',
      JSON.stringify([
        { id: 'sw core', nombre: 'SW-CORE', tipo: 'switch', marca: 'Aruba', modelo: 'CX 6100', ip: '10.1.1.2/24' },
      ]),
    )
    openAt('#/p/aruba-aoscx/mgmt-ip?equipo=sw%20core')

    expect(screen.getByLabelText('Rellenar con un equipo de mi infraestructura')).toHaveValue('sw core')
    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('10.1.1.2/24')
    expect(within(brands()).getByRole('link', { name: 'Aruba CX 6100' })).toHaveAttribute('aria-current', 'page')
    expect(within(tasks()).getByRole('link', { name: 'Configurar la IP de gestión' })).toHaveAttribute(
      'aria-current',
      'page',
    )
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

    expect(
      within(dialog()).getByRole('link', { name: /Configurar la IP de gestión.*Cisco Catalyst 1300/ }),
    ).toBeInTheDocument()

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
    expect(
      within(dialog()).getByRole('link', { name: /Configurar un puerto trunk.*Aruba CX 6100/ }),
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('link', { name: 'Manual de Switching' }))
    const recents = await screen.findByRole('list', { name: 'Recientes' })

    expect(within(recents).getByRole('link', { name: /Configurar un puerto trunk.*Aruba CX 6100/ })).toHaveAttribute(
      'href',
      '#/p/aruba-aoscx/port-trunk',
    )
  })

  it('opens the fundamentals from the header, with every article in reading order', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx')

    await user.click(screen.getByRole('link', { name: 'Fundamentos' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Fundamentos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fundamentos' })).toHaveAttribute('aria-current', 'page')
    expect(
      within(brands())
        .getAllByRole('link')
        .filter((link) => link.hasAttribute('aria-current')),
    ).toEqual([])
    const articles = within(screen.getByRole('navigation', { name: 'Artículos' })).getAllByRole('link')
    expect(articles.map((link) => link.getAttribute('href'))).toEqual([
      '#/f',
      '#/f/what-is-a-switch',
      '#/f/traffic-basics',
      '#/f/switch-types',
      '#/f/management-basics',
      '#/f/vendors',
      '#/f/safe-changes',
      '#/f/vlan-design',
    ])
  })

  it('compares the brands of this manual on the fundamentals page', () => {
    openAt('#/f')

    const table = screen.getByRole('table', { name: 'Marcas de este manual' })
    const rows = within(table).getAllByRole('row').slice(1)

    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Aruba CX 6100',
      'Cisco Catalyst 1300',
      'FortiGate',
      'MikroTik CRS317',
      'Ruijie NBS3200',
    ])
    expect(within(rows[4] as HTMLElement).getByText('Interfaz web')).toBeInTheDocument()
  })

  it('shows an article with its sections and links its tasks to the brand in use', () => {
    localStorage.setItem('switching-manual:last-platform', JSON.stringify('cisco-c1300'))
    openAt('#/f/what-is-a-switch')

    expect(screen.getByRole('heading', { level: 1, name: 'Qué es un switch y para qué sirve' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(1)
    const related = screen.getByRole('navigation', { name: 'Guías relacionadas' })
    expect(within(related).getByRole('link', { name: 'Crear una VLAN' })).toHaveAttribute(
      'href',
      '#/p/cisco-c1300/vlan-create',
    )
  })

  it.each(['#/f/nothing-here', '#/f/what-is-a-switch/extra'])('says so when %s is not a fundamentals page', (hash) => {
    openAt(hash)

    expect(screen.getByText('No encontramos esa página.')).toBeInTheDocument()
  })

  it('opens a fundamentals article from the quick search', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx')

    await user.keyboard('{Control>}k{/Control}')
    await user.type(within(dialog()).getByRole('searchbox', { name: 'Buscar' }), 'que es un switch')
    expect(within(dialog()).getAllByRole('link')[0]).toHaveTextContent(/Qué es un switch y para qué sirve.*Fundamentos/)
    await user.keyboard('{Enter}')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Qué es un switch y para qué sirve' }),
    ).toBeInTheDocument()
  })

  it('shows the app version and the date of the most recent content review in the footer', () => {
    openAt('#/')

    const latest = [...catalog.procedures, ...catalog.platforms]
      .map((item) => item.status.reviewed)
      .sort()
      .at(-1)
    const footer = screen.getByRole('contentinfo')

    expect(footer).toHaveTextContent(`Versión ${packageJson.version}`)
    expect(footer).toHaveTextContent(`Contenido revisado hasta ${latest}`)
  })

  it('cycles the theme from the header between system, light and dark, and remembers it', async () => {
    const user = userEvent.setup()
    const { unmount } = openAt('#/')
    const themeButton = () => screen.getByRole('button', { name: /^Tema:/ })

    expect(themeButton()).toHaveAccessibleName('Tema: Sistema. Cambiar a Claro')
    await user.click(themeButton())
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    await user.click(themeButton())
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(themeButton()).toHaveAccessibleName('Tema: Oscuro. Cambiar a Sistema')

    unmount()
    document.documentElement.removeAttribute('data-theme')
    openAt('#/')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    await user.click(themeButton())
    expect(document.documentElement).not.toHaveAttribute('data-theme')
    expect(within(screen.getByRole('contentinfo')).queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('lets keyboard users skip the navigation and land on the page content', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx')

    await user.tab()
    const skip = screen.getByRole('button', { name: 'Saltar al contenido' })
    expect(skip).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('main')).toHaveFocus()
    expect(window.location.hash).toBe('#/p/aruba-aoscx')
  })

  it('shows the content status as a brand by task matrix, linked to each runbook', () => {
    openAt('#/status')

    expect(screen.getByRole('heading', { level: 1, name: 'Estado del contenido' })).toBeInTheDocument()
    expect(
      within(brands())
        .getAllByRole('link')
        .filter((link) => link.hasAttribute('aria-current')),
    ).toEqual([])
    expect(screen.getByText(`${catalog.procedures.length} guías`)).toBeInTheDocument()
    const matrix = screen.getByRole('table', { name: 'Guías por marca y tarea' })
    const vlanRow = within(matrix).getByRole('row', { name: /^Crear una VLAN/ })
    expect(within(vlanRow).getByRole('link', { name: /Aruba CX 6100/ })).toHaveAttribute(
      'href',
      '#/p/aruba-aoscx/vlan-create',
    )
    const poeRow = within(matrix).getByRole('row', { name: /^Reiniciar un dispositivo PoE/ })
    // Cells follow the brand columns: Aruba, Cisco, MikroTik (no PoE), Ruijie.
    expect(within(poeRow).getAllByRole('cell')[2]).toHaveTextContent('—')
  })

  it('reaches the network planner from the header', () => {
    openAt('#/')

    const link = within(screen.getByRole('navigation', { name: 'Herramientas' })).getByRole('link', {
      name: 'Planificador de red',
    })
    expect(link).toHaveAttribute('href', '#/plan')
  })

  it('shows the network planner at its own address', () => {
    openAt('#/plan')

    expect(screen.getByRole('heading', { level: 1, name: 'Planificador de red' })).toBeInTheDocument()
  })

  it('reaches the content status from the footer', () => {
    openAt('#/')

    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Estado del contenido' })).toHaveAttribute(
      'href',
      '#/status',
    )
  })
})

describe('inside the website', () => {
  const library = () => within(screen.getByRole('navigation', { name: 'Biblioteca' }))
  const switchPlatforms = ['Aruba CX 6100', 'Cisco Catalyst 1300', 'MikroTik CRS317', 'Ruijie NBS3200']
  const upcomingTypes = ['Virtualización', 'Almacenamiento']

  beforeEach(() => {
    vi.stubEnv(
      'VITE_SITE_NAV',
      JSON.stringify([
        { id: 'inicio', label: 'Inicio', href: '../../' },
        { id: 'infra', label: 'Mi infraestructura', href: '../#mi-infraestructura' },
        { id: 'guias', label: 'Guías', href: './', current: true },
      ]),
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('drops the manual header for a slim toolbar with the search and the sidebar toggle', async () => {
    const user = userEvent.setup()
    openAt('#/p/aruba-aoscx')

    expect(screen.queryByRole('link', { name: 'Manual de Switching' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Marcas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Herramientas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tareas' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar Ctrl K' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Tema:/ })).toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Guías' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('names the browser tab after the section of the website, not after the offline manual', () => {
    const { unmount } = openAt('#/p/aruba-aoscx')
    expect(document.title).toBe('Guías · sysadmin junior')
    unmount()

    openAt('#/plan')
    expect(document.title).toBe('Red y VLAN · sysadmin junior')
  })

  it('draws the same top bar as the rest of the website: sections, a folding menu and the theme button', async () => {
    const user = userEvent.setup()
    for (const hash of ['#/p/aruba-aoscx', '#/plan']) {
      const { unmount } = openAt(hash)

      const bar = within(
        screen.getByRole('navigation', { name: 'Secciones de la web' }).closest('header') as HTMLElement,
      )
      expect(bar.getByRole('link', { name: /sysadmin junior/ })).toHaveAttribute('href', '../../')
      expect(bar.getByRole('navigation', { name: 'Secciones de la web' })).toBeInTheDocument()
      const menu = bar.getByText('Menú')
      expect(menu.tagName).toBe('SUMMARY')
      const folded = within(bar.getByRole('navigation', { name: 'Menú de secciones' }))
      expect(folded.getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Inicio',
        'Mi infraestructura',
        'Guías',
      ])
      expect(screen.getAllByRole('button', { name: /^Tema:/ })).toHaveLength(1)
      expect(bar.getByRole('button', { name: /^Tema:/ })).toHaveTextContent('Tema: Sistema')
      await user.click(bar.getByRole('button', { name: /^Tema:/ }))
      expect(document.documentElement).toHaveAttribute('data-theme', 'light')
      expect(bar.getByRole('button', { name: /^Tema:/ })).toHaveTextContent('Tema: Claro')
      unmount()
      localStorage.clear()
      document.documentElement.removeAttribute('data-theme')
    }
  })

  it('links the prototype notice to the website page that explains it, as the other pages do', () => {
    openAt('#/p/aruba-aoscx')

    const notice = within(screen.getByRole('note', { name: 'Aviso de prototipo' }))
    expect(notice.getByRole('link', { name: 'Qué es esto' })).toHaveAttribute('href', '../../que-es-esto/')
  })

  it('shows the library by device type: the switches with their brands, the other types coming soon', () => {
    openAt('#/status')

    const switches = within(library().getByRole('group', { name: 'Switches' }))
    for (const name of switchPlatforms) {
      const id = catalog.platforms.find((platform) => platform.name === name)?.id
      expect(switches.getByRole('link', { name })).toHaveAttribute('href', `#/p/${id}`)
    }
    const firewalls = within(library().getByRole('group', { name: 'Firewalls' }))
    expect(firewalls.getByRole('link', { name: 'FortiGate' })).toHaveAttribute('href', '#/p/fortinet-fortigate')
    for (const type of upcomingTypes) {
      const group = library().getByRole('group', { name: type })
      expect(group).toHaveTextContent('Próximamente')
      expect(within(group).queryByRole('link')).not.toBeInTheDocument()
    }
    expect(library().getByRole('link', { name: 'Fundamentos' })).toHaveAttribute('href', '#/f')
    expect(library().getByRole('link', { name: 'Estado del contenido' })).toHaveAttribute('aria-current', 'page')
  })

  it('expands the brand in use with its tasks grouped, and marks the open runbook', async () => {
    const user = userEvent.setup()
    openAt('#/p/cisco-c1300/vlan-create')

    const brand = library().getByRole('link', { name: 'Cisco Catalyst 1300' }).closest('li') as HTMLElement
    expect(within(brand).getByRole('navigation', { name: 'Tareas' })).toBe(tasks())
    expect(within(tasks()).getByRole('list', { name: 'VLANs y puertos' })).toBeInTheDocument()
    expect(within(tasks()).getByRole('link', { name: 'Crear una VLAN' })).toHaveAttribute('aria-current', 'page')
    expect(within(tasks()).getByRole('link', { name: 'Crear una VLAN' })).toHaveAttribute(
      'href',
      '#/p/cisco-c1300/vlan-create',
    )

    await user.click(within(tasks()).getByRole('link', { name: 'Configurar la IP de gestión' }))

    expect(await screen.findByRole('heading', { level: 1, name: /Configurar la IP de gestión/ })).toBeInTheDocument()
    expect(within(tasks()).getByRole('link', { name: 'Configurar la IP de gestión' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('folds and unfolds the tasks of a brand with its own button, without leaving the page', async () => {
    const user = userEvent.setup()
    openAt('#/p/cisco-c1300/vlan-create')

    const fold = library().getByRole('button', { name: 'Tareas de Cisco Catalyst 1300' })
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    await user.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Tareas' })).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#/p/cisco-c1300/vlan-create')

    const aruba = library().getByRole('button', { name: 'Tareas de Aruba CX 6100' })
    expect(aruba).toHaveAttribute('aria-expanded', 'false')
    await user.click(aruba)
    expect(aruba).toHaveAttribute('aria-expanded', 'true')
    expect(within(tasks()).getByRole('link', { name: 'Crear una VLAN' })).toHaveAttribute(
      'href',
      '#/p/aruba-aoscx/vlan-create',
    )
    await user.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'true')
  })

  it('marks the brand sheet as the current page when it is open', () => {
    openAt('#/p/mikrotik-routeros')

    expect(library().getByRole('link', { name: 'MikroTik CRS317' })).toHaveAttribute('aria-current', 'page')
    expect(within(tasks()).getAllByRole('link').length).toBeGreaterThan(1)
  })

  it('keeps the articles under «Fundamentos» on the fundamentals pages', () => {
    openAt('#/f/what-is-a-switch')

    const articles = within(library().getByRole('navigation', { name: 'Artículos' }))
    expect(articles.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
      catalog.fundamentals.map((item) => `#/f/${item.id}`),
    )
    expect(articles.getByRole('link', { name: 'Qué es un switch y para qué sirve' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('shows «Red y VLAN» as part of «Mi infraestructura», without the library', () => {
    openAt('#/plan')

    expect(screen.queryByRole('navigation', { name: 'Biblioteca' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buscar Ctrl K' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guías' })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Mi infraestructura' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Secciones de la web' })).getByRole('link', {
        name: 'Mi infraestructura',
      }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('opens the library home with one card per device type, the recent runbooks and the background reading', () => {
    localStorage.setItem('switching-manual:recents', JSON.stringify(['aruba-aoscx/port-trunk']))
    openAt('#/')

    expect(screen.getByRole('heading', { level: 1, name: 'Guías' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Manual de Switching' })).not.toBeInTheDocument()
    expect(screen.getByText(/ficha de un equipo en «Mi infraestructura»/)).toBeInTheDocument()

    const cards = within(screen.getByRole('list', { name: 'Tipos de equipo' }))
    const switches = cards.getByRole('heading', { name: 'Switches' }).closest('li') as HTMLElement
    const switchTasks = new Set(catalog.procedures.map((item) => item.task)).size
    expect(switches).toHaveTextContent(`${switchTasks} tareas`)
    for (const platform of catalog.platforms.filter((item) => item.deviceType === 'switch')) {
      const guides = catalog.procedures.filter((item) => item.platform === platform.id).length
      const link = within(switches).getByRole('link', { name: new RegExp(`^${platform.name}`) })
      expect(link).toHaveAttribute('href', `#/p/${platform.id}`)
      expect(link).toHaveTextContent(`${guides} guías`)
    }
    const firewalls = cards.getByRole('heading', { name: 'Firewalls' }).closest('li') as HTMLElement
    expect(firewalls).toHaveTextContent('1 marca · 3 tareas')
    expect(within(firewalls).getByRole('link', { name: /^FortiGate/ })).toHaveTextContent('3 guías')
    for (const type of upcomingTypes) {
      expect(cards.getByRole('heading', { name: type }).closest('li')).toHaveTextContent('Próximamente')
    }

    const main = within(screen.getByRole('main'))
    expect(within(main.getByRole('list', { name: 'Recientes' })).getByRole('link')).toHaveAttribute(
      'href',
      '#/p/aruba-aoscx/port-trunk',
    )
    expect(main.getByRole('link', { name: 'fundamentos' })).toHaveAttribute('href', '#/f')
    expect(main.getByRole('link', { name: 'estado del contenido' })).toHaveAttribute('href', '#/status')
  })

  it('keeps the quick search, with Ctrl+K and with the slash key', async () => {
    const user = userEvent.setup()
    openAt('#/')

    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByRole('dialog', { name: 'Buscar guías' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Buscar guías' })).not.toBeInTheDocument()

    await user.keyboard('/')
    expect(screen.getByRole('dialog', { name: 'Buscar guías' })).toBeInTheDocument()
  })

  it('opens a runbook from a device of the inventory with its values', () => {
    localStorage.setItem(
      'mapa-infra:inventario',
      JSON.stringify([
        { id: 'sw core', nombre: 'SW-CORE', tipo: 'switch', marca: 'Aruba', modelo: 'CX 6100', ip: '10.1.1.2/24' },
      ]),
    )
    openAt('#/p/aruba-aoscx/mgmt-ip?equipo=sw%20core')

    expect(screen.getByLabelText('Rellenar con un equipo de mi infraestructura')).toHaveValue('sw core')
    expect(screen.getByLabelText('IP de gestión con prefijo')).toHaveValue('10.1.1.2/24')
    expect(within(tasks()).getByRole('link', { name: 'Configurar la IP de gestión' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('built on its own', () => {
  it('keeps the manual header, the brand tabs and the task sidebar, without the library', () => {
    openAt('#/p/aruba-aoscx')

    expect(screen.getByRole('link', { name: 'Manual de Switching' })).toHaveAttribute('href', '#/')
    // A switch shows the switch brands; the FortiGate firewall has its own tab set.
    expect(within(brands()).getAllByRole('link')).toHaveLength(4)
    expect(
      within(screen.getByRole('navigation', { name: 'Herramientas' })).getByRole('link', { name: 'Fundamentos' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tareas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar Ctrl K' })).toBeInTheDocument()
    expect(within(tasks()).getByRole('link', { name: 'Ficha del equipo' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('navigation', { name: 'Biblioteca' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guías' })).not.toBeInTheDocument()
  })

  it('keeps its own home page', () => {
    openAt('#/')

    expect(screen.getByRole('heading', { level: 1, name: 'Manual de Switching' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Tipos de equipo' })).not.toBeInTheDocument()
  })
})
