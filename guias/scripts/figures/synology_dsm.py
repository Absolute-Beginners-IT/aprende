"""Redrawn Synology DSM screens and schemas for the Synology DSM guides.

Screens are simplified from the field names the guides state; a label a guide does not give is drawn as a grey
placeholder bar, never invented. Run: python guias/scripts/figures/synology_dsm.py
"""
import itertools

import kit
from kit import Svg

kit.use('synology-dsm')

# Estimated glyph widths (px per character) and text box heights, to check that nothing overlaps or overflows.
WIDTHS = (('fg-titulo', 10.5, 15, 4), ('fg-num-t', 7.3, 10, 3), ('fg-peque', 6.5, 10, 3), ('fg-negrita', 7.8, 11, 3))


def metrics(cls):
    for name, cw, up, down in WIDTHS:
        if name in cls.split():
            return cw, up, down
    return 7.3, 11, 3


class Fig(Svg):
    """An Svg that remembers where every text, mark and placeholder lands, and checks it on save."""

    def __init__(self, w, h):
        super().__init__(w, h)
        self.items, self.problems, self._quiet = [], [], False

    def text(self, x, y, s, cls='fg-texto', anchor=None):
        super().text(x, y, s, cls, anchor)
        if self._quiet or not s:
            return
        cw, up, down = metrics(cls)
        width = len(s) * cw
        left = x - width / 2 if anchor == 'middle' else x
        self.items.append((f'text «{s}»', left, y - up, left + width, y + down))

    def mark(self, n, x, y):
        self._quiet = True
        super().mark(n, x, y)
        self._quiet = False
        self.items.append((f'mark {n}', x - 11, y - 11, x + 11, y + 11))

    def field(self, x, y, w, value, select=False, spinner=False, off=False):
        room = w - 17 - (22 if select else 0)
        if len(value) * 7.3 > room:
            self.problems.append(f'field «{value}» does not fit in {w}px')
        super().field(x, y, w, value, select, spinner, off)

    def box(self, x, y, w, h, title, lines, key=False):
        for s, cw in [(title, 7.8)] + [(line, 6.5) for line in lines]:
            if len(s) * cw > w - 16:
                self.problems.append(f'box line «{s}» does not fit in {w}px')
        if 46 + (len(lines) - 1) * 18 + 8 > h:
            self.problems.append(f'box «{title}» too short for its lines')
        super().box(x, y, w, h, title, lines, key)

    def button(self, x, y, w, label, main=False):
        if len(label) * 7.8 > w - 16:
            self.problems.append(f'button «{label}» does not fit in {w}px')
        self.rect(x, y, w, 26, 'fg-boton fg-boton--principal' if main else 'fg-boton', rx=3)
        self.text(x + w / 2, y + 18, label, 'fg-texto fg-negrita' if main else 'fg-texto', 'middle')

    def bar(self, x, y, w):
        """A placeholder for a label the guide does not name."""
        self.rect(x, y, w, 10, 'fg-banda', rx=3)
        self.items.append(('placeholder', x, y, x + w, y + 10))

    def check_bar(self, x, y, on, w=150):
        self.check(x, y, on, '')
        self.bar(x + 22, y + 2, w)

    def radio_bar(self, x, y, on, w=150):
        self.radio(x, y, on, '')
        self.bar(x + 22, y + 2, w)

    def arrow(self, x1, y1, x2, y2, data=False):
        cls = 'fg-flecha fg-flecha--datos' if data else 'fg-flecha'
        head = f' M{x2 - 8} {y2 - 6} L{x2} {y2} L{x2 - 8} {y2 + 6}' if y1 == y2 and x2 > x1 else ''
        if x1 == x2 and y2 > y1:
            head = f' M{x2 - 6} {y2 - 8} L{x2} {y2} L{x2 + 6} {y2 - 8}'
        self.add(f'<path class="{cls}" d="M{x1} {y1} L{x2} {y2}{head}"/>')

    def save(self, name):
        for (a, *ra), (b, *rb) in itertools.combinations(self.items, 2):
            if ra[0] < rb[2] and rb[0] < ra[2] and ra[1] < rb[3] and rb[1] < ra[3]:
                self.problems.append(f'{a} overlaps {b}')
        for label, x1, y1, x2, y2 in self.items:
            if x1 < 2 or y1 < 2 or x2 > self.w - 2 or y2 > self.h - 2:
                self.problems.append(f'{label} leaves the viewBox')
        if self.problems:
            raise SystemExit(f'{name}:\n  ' + '\n  '.join(self.problems))
        super().save(name)


def panel(s, section, tabs=(), active=0, title='Control Panel', slot=3):
    """A DSM app window: a list of sections on the left (only the open one named) and its tabs on top."""
    s.window(title)
    s.add(f'<rect class="fg-lateral" x="1" y="34" width="180" height="{s.h - 35}"/>')
    for i in range(7):
        y = 60 + i * 30
        if i == slot:
            s.add(f'<rect class="fg-seleccion" x="4" y="{y - 14}" width="3" height="20"/>')
            s.text(16, y, section, 'fg-texto fg-negrita')
        else:
            s.bar(16, y - 9, 70 + (i * 37) % 60)
    x = 198
    for i, tab in enumerate(tabs):
        width = len(tab) * 7.3 if tab else 60
        if tab:
            s.text(x, 66, tab, 'fg-texto fg-negrita' if i == active else 'fg-texto')
        else:
            s.bar(x, 57, width)
        if i == active:
            s.add(f'<rect class="fg-seleccion" x="{x}" y="74" width="{width:.0f}" height="3"/>')
        x += width + 28
    if tabs:
        s.add(f'<path class="fg-linea" d="M181 78 H{s.w - 1}"/>')
    return x


def tab_end(tabs, upto):
    """The x where tab number `upto` ends, to place a mark after it."""
    x = 198
    for tab in tabs[:upto]:
        x += (len(tab) * 7.3 if tab else 60) + 28
    return x + (len(tabs[upto]) * 7.3 if tabs[upto] else 60)


# 1. Update & Restore, Configuration Backup (config-backup step «Exportar la configuración»).
tabs = ['DSM Update', 'Configuration Backup']
s = Fig(760, 380)
panel(s, 'Update & Restore', tabs, 1, slot=6)
s.mark(1, tab_end(tabs, 1) + 26, 62)
s.band(198, 96, 546, 'Manual Export')
s.button(206, 132, 90, 'Export', main=True)
s.outline(200, 126, 102, 38)
s.mark(2, 316, 145)
s.band(198, 184, 546, 'Automatic Backup')
s.radio_bar(206, 220, False, 180)
s.radio(206, 248, True, 'Self-defined')
s.outline(200, 240, 116, 30)
s.mark(3, 330, 255)
s.band(198, 292, 546, 'Restore DSM Configurations')
s.button(206, 328, 90, 'Restore')
s.save('copia-configuracion')

# 2. Where the .dss file goes (config-backup step «Guardar la copia en su sitio»).
s = Fig(800, 360)
s.text(20, 30, 'Adónde va la copia de la configuración de un NAS Synology', 'fg-texto fg-negrita')
s.box(20, 56, 230, 104, 'NAS Synology', ['Update & Restore,', 'Configuration Backup:', 'Manual Export, Export'])
s.box(290, 56, 220, 104, 'Tu ordenador', ['se descarga un archivo .dss', 'con el nombre del modelo', 'y la fecha'], key=True)
s.box(550, 56, 230, 104, 'Repositorio de copias', ['de la empresa, fuera del NAS', 'una copia que solo está en', 'tu ordenador se pierde con él'], key=True)
s.arrow(250, 108, 288, 108, data=True)
s.arrow(510, 108, 548, 108, data=True)
s.box(20, 216, 360, 110, 'Cuenta Synology (Automatic Backup)', ['opcional: una versión por NAS', 'se borra si no se sube nada en 180 días', 'si la usas, cifrado Self-defined'])
s.add('<path class="fg-flecha" d="M135 160 V214" stroke-dasharray="5 4"/>')
s.box(420, 216, 360, 110, 'Datos de las carpetas compartidas', ['no van dentro del .dss', 'se copian aparte con Hyper Backup'])
for n, (x, y) in enumerate([(20, 56), (290, 56), (550, 56), (20, 216), (420, 216)], 1):
    s.mark(n, x, y)
s.save('esquema-copia-configuracion')

# 3. Choosing what to restore (config-restore step «Elegir qué partes restaurar»).
s = Fig(560, 340)
s.window('')
s.check_bar(24, 62, True, 160)
s.check(24, 92, False, 'Network')
s.check_bar(24, 122, False, 130)
s.check_bar(24, 152, False, 110)
s.outline(16, 54, 230, 128)
s.mark(1, 260, 70)
s.outline(98, 86, 30, 26)
s.mark(2, 142, 99)
s.add('<path class="fg-linea" d="M1 200 H559"/>')
s.check(24, 222, False, 'Overwrite conflicting settings')
s.outline(16, 214, 266, 30)
s.mark(3, 296, 229)
s.button(454, 290, 86, 'Apply', main=True)
s.mark(4, 434, 303)
s.save('restaurar-partes')

# 4. Update & Restore, DSM Update (firmware-upgrade steps 1 to 3).
tabs = ['DSM Update', 'Configuration Backup']
s = Fig(760, 380)
panel(s, 'Update & Restore', tabs, 0, slot=6)
s.mark(1, tab_end(tabs, 0) + 14, 44)
s.bar(206, 102, 220)
s.bar(206, 122, 320)
s.button(206, 146, 100, 'Download', main=True)
s.mark(2, 320, 159)
s.button(346, 146, 110, 'Update Now')
s.mark(3, 470, 159)
s.band(198, 206, 546, 'Update Settings')
s.radio_bar(206, 244, False, 260)
s.radio(206, 274, True, 'Automatically install important updates')
s.radio_bar(206, 304, False, 200)
s.outline(200, 266, 326, 30)
s.mark(4, 540, 281)
s.save('actualizar-dsm')

# 5. Regional Options, Time (ntp-client steps 1 to 3).
tabs = ['Time', None, None]
s = Fig(760, 400)
panel(s, 'Regional Options', tabs, 0, slot=4)
s.mark(1, tab_end(tabs, 0) + 14, 44)
s.text(206, 118, 'Time zone')
s.field(300, 100, 330, '', select=True)
s.mark(2, 646, 113)
s.band(198, 146, 546, 'Time Setting')
s.radio_bar(206, 184, False, 180)
s.radio(206, 214, True, 'Synchronize with NTP server')
s.field(228, 240, 230, '192.168.10.5')
s.outline(200, 206, 266, 68)
s.mark(3, 480, 221)
s.button(494, 240, 110, 'Update Now')
s.mark(4, 620, 253)
s.button(654, 350, 86, 'Apply', main=True)
s.mark(5, 634, 363)
s.save('hora-ntp')

# 6. Web Assistant at finds.synology.com (os-install step «Buscar el NAS con Web Assistant»).
s = Fig(720, 220)
s.window('finds.synology.com')
s.text(18, 72, 'Web Assistant', 'fg-titulo')
s.rect(18, 100, 684, 46, 'fg-campo', rx=4)
s.add('<rect class="fg-icono" x="32" y="110" width="20" height="26" rx="3"/>')
s.bar(66, 118, 150)
s.text(300, 128, 'Not installed', 'fg-texto fg-negrita')
s.outline(292, 108, 116, 30)
s.mark(1, 422, 123)
s.button(590, 110, 96, 'Connect', main=True)
s.mark(2, 568, 123)
s.save('web-assistant')

# 7. The order of a new installation (os-install step «Instalar DSM»).
s = Fig(800, 250)
s.text(20, 30, 'Instalación de un NAS nuevo: cada paso necesita el anterior', 'fg-texto fg-negrita')
steps = [('Buscar el NAS', ['finds.synology.com', 'estado Not installed', 'pulsa Connect'], False),
         ('Instalar DSM', ['descarga DSM', 'formatea los discos:', 'se borra todo', 'el NAS se reinicia'], True),
         ('Administración', ['cuenta con nombre propio', 'contraseña fuerte', 'guardada en el gestor'], False),
         ('IP fija', ['IP 192.168.99.30/24', 'p. enlace 192.168.99.1', 'DNS 192.168.10.5', 'entra por la IP nueva'], True)]
for i, (title, lines, key) in enumerate(steps):
    x = 16 + i * 194
    s.box(x, 60, 182, 130, title, lines, key)
    s.mark(i + 1, x, 60)
    if i:
        s.arrow(x - 12, 125, x - 1, 125)
s.text(20, 226, 'Al cambiar la IP la sesión se corta: vuelve a entrar por 192.168.99.30:5000.', 'fg-tenue fg-peque')
s.save('esquema-instalacion')

# 8. Terminal & SNMP, SNMP (snmp-monitoring steps «Activar SNMPv3» and «Activar el cifrado»).
tabs = [None, 'SNMP']
s = Fig(760, 470)
panel(s, 'Terminal & SNMP', tabs, 1, slot=5)
s.check(206, 100, True, 'Enable SNMP service')
s.check(226, 130, False, 'SNMPv1, SNMPv2c service', 'fg-tenue')
s.check(226, 158, True, 'SNMPv3 service')
s.outline(200, 92, 260, 86)
s.mark(1, 474, 106)
s.bar(246, 194, 90)
s.field(380, 186, 220, 'monitor')
s.bar(246, 224, 110)
s.field(380, 216, 220, '••••••••')
s.text(246, 264, 'Protocol')
s.field(380, 246, 120, 'SHA', select=True)
s.outline(372, 180, 236, 98)
s.mark(2, 622, 196)
s.check(206, 300, True, 'Enable SNMP privacy')
s.text(246, 344, 'Protocol')
s.field(380, 326, 120, 'AES', select=True)
s.bar(246, 364, 110)
s.field(380, 356, 220, '••••••••')
s.outline(200, 292, 408, 96)
s.mark(3, 622, 306)
s.button(654, 426, 86, 'Apply', main=True)
s.mark(4, 634, 439)
s.save('snmp-v3')

# 9. Who may ask the NAS over SNMP (snmp-monitoring step «Limitar el acceso al servidor de monitorización»).
s = Fig(800, 360)
s.text(20, 26, 'Quién puede consultar el NAS por SNMP', 'fg-texto fg-negrita')
s.box(20, 46, 280, 100, 'Servidor de monitorización', ['192.168.10.40', 'consulta SNMPv3, nivel authPriv', 'usuario monitor, SHA y AES'], key=True)
s.box(20, 186, 280, 82, 'Otro equipo de la red', ['la misma consulta', 'no responde'])
s.rect(400, 46, 30, 222, 'fg-caja fg-caja--clave', rx=6)
s.box(520, 46, 260, 222, 'NAS Synology', ['SNMP service activo', 'solo SNMPv3', 'escucha en UDP 161'])
s.arrow(300, 96, 518, 96, data=True)
s.text(350, 88, 'UDP 161', 'fg-tenue fg-peque', 'middle')
s.add('<path class="fg-flecha" d="M300 227 H396"/>')
s.add('<path class="fg-icono" d="M380 219 l12 12 M392 219 l-12 12"/>')
s.text(340, 219, 'denegado', 'fg-tenue fg-peque', 'middle')
s.text(415, 296, 'Cortafuegos de DSM (perfil activo)', 'fg-texto fg-negrita', 'middle')
s.text(415, 318, 'permite UDP 161 solo desde 192.168.10.40', 'fg-tenue fg-peque', 'middle')
s.text(415, 336, 'y lo deniega al resto', 'fg-tenue fg-peque', 'middle')
for n, (x, y) in enumerate([(20, 46), (415, 46), (20, 186), (520, 46)], 1):
    s.mark(n, x, y)
s.save('esquema-snmp')

# 10. Log Center, Log Sending (syslog-remote steps 1 to 3).
s = Fig(760, 400)
panel(s, 'Log Sending', title='Log Center', slot=2)
s.check(206, 62, True, 'Send logs to a syslog server')
s.mark(1, 452, 69)
rows = [('Server', '192.168.10.30', False), ('Port', '514', False), ('Transfer protocol', 'UDP', True),
        ('Log format', 'BSD (RFC 3164)', True)]
for i, (label, value, select) in enumerate(rows):
    y = 92 + i * 34
    s.text(226, y + 18, label)
    s.field(380, y, 200, value, select=select)
s.outline(372, 86, 216, 66)
s.mark(2, 602, 102)
s.outline(372, 154, 216, 66)
s.mark(3, 602, 170)
s.button(226, 250, 130, 'Send test log')
s.mark(4, 370, 263)
s.button(654, 350, 86, 'Apply', main=True)
s.mark(5, 634, 363)
s.save('envio-registros')

# 11. User & Group, User, Create (user-admin step «Abrir el asistente de creación de usuarios»).
tabs = ['User', None]
s = Fig(760, 300)
panel(s, 'User & Group', tabs, 0, slot=6)
s.mark(1, tab_end(tabs, 0) + 14, 44)
s.button(206, 94, 86, 'Create', main=True)
s.mark(2, 306, 107)
for i in range(4):
    y = 138 + i * 32
    s.add(f'<path class="fg-linea" d="M198 {y} H744"/>')
    s.bar(214, y + 11, 100 + (i * 29) % 50)
    s.bar(400, y + 11, 160)
s.save('crear-usuario')

# 12. The user's data (user-admin step «Escribir los datos del usuario»).
s = Fig(600, 290)
s.window('')
s.text(24, 76, 'Name')
s.field(170, 58, 300, 'jconde')
s.mark(1, 486, 71)
s.bar(24, 104, 90)
s.field(170, 92, 300, '')
s.bar(24, 138, 60)
s.field(170, 126, 300, '')
s.text(24, 178, 'Password')
s.field(170, 160, 300, '••••••••')
s.mark(2, 486, 173)
s.text(170, 220, 'Generate Random Password', 'fg-enlace')
s.mark(3, 374, 216)
s.save('usuario-datos')

# 13. Join groups (user-admin step «Añadirlo al grupo administrators»).
s = Fig(560, 260)
s.window('')
s.band(16, 50, 528, 'Join groups')
s.check(28, 94, True, 'administrators', 'fg-texto fg-negrita')
s.outline(20, 86, 150, 30)
s.mark(1, 184, 101)
for i in range(3):
    s.check_bar(28, 130 + i * 30, False, 80 + i * 20)
s.save('usuario-grupos')

print('written', sorted(p.name for p in kit.OUT.glob('*.svg')))
