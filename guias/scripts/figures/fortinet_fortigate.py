"""Schemas for the FortiGate guides: every step is a CLI command, so each guide gets a schema of what travels where.

Run: python guias/scripts/figures/fortinet_fortigate.py
"""
import kit
from kit import Svg

kit.use('fortinet-fortigate')

# Approximate glyph widths (px per character) and font sizes, used by the layout check below.
CPP = {'fg-titulo': 10.5, 'fg-peque': 6.5}
SIZE = {'fg-titulo': 18, 'fg-peque': 11.5}


def metrics(cls):
    names = cls.split()
    key = 'fg-titulo' if 'fg-titulo' in names else 'fg-peque' if 'fg-peque' in names else None
    cpp, size = CPP.get(key, 7.3), SIZE.get(key, 13)
    if 'fg-negrita' in names:
        cpp *= 1.08
    return cpp, size


class Fig(Svg):
    """Svg that records every text, mark and container so the layout can be checked before saving."""

    def __init__(self, w, h):
        super().__init__(w, h)
        self.texts, self.marks, self.inside = [], [], []

    def text(self, x, y, s, cls='fg-texto', anchor=None):
        super().text(x, y, s, cls, anchor)
        if 'fg-num-t' in cls:
            return
        cpp, size = metrics(cls)
        width = len(s) * cpp + 8
        left = x - width / 2 if anchor == 'middle' else x - 4
        self.texts.append((s, left, y - size * 0.8, left + width, y + size * 0.25))

    def mark(self, n, x, y):
        super().mark(n, x, y)
        self.marks.append((f'mark {n}', x - 11, y - 11, x + 11, y + 11))

    def container(self, x, y, w, h, first, last):
        """Texts with index first..last-1 must stay inside this rectangle."""
        self.inside.append(((x, y, x + w, y + h), first, last))

    def card(self, x, y, w, h, title, lines, key=False):
        first = len(self.texts)
        self.box(x, y, w, h, title, lines, key)
        self.container(x, y, w, h, first, len(self.texts))

    def arrow(self, x1, y, x2, data=False):
        """A horizontal arrow from x1 to x2 with an open head at x2."""
        cls = 'fg-flecha fg-flecha--datos' if data else 'fg-flecha'
        d = -1 if x2 > x1 else 1
        self.add(f'<path class="{cls}" d="M{x1} {y} H{x2} M{x2 + 9 * d} {y - 6} L{x2} {y} L{x2 + 9 * d} {y + 6}"/>')

    def note(self, y, s, n=None):
        """A full-width band with one line of text, for the condition that explains the order."""
        self.rect(20, y, self.w - 40, 40, 'fg-lateral', rx=10)
        first = len(self.texts)
        self.text(44, y + 25, s)
        self.container(20, y, self.w - 40, 40, first, first + 1)
        if n:
            self.mark(n, 20, y)

    def check(self, *args, **kwargs):
        raise NotImplementedError('schemas only')

    def verify(self, name):
        problems = []
        for s, l, t, r, b in self.texts:
            if l < 0 or t < 0 or r > self.w or b > self.h:
                problems.append(f'{s!r} leaves the viewBox')
        for (x0, y0, x1, y1), first, last in self.inside:
            for s, l, t, r, b in self.texts[first:last]:
                if l < x0 or r > x1 or t < y0 or b > y1:
                    problems.append(f'{s!r} leaves its box')
        items = self.texts + self.marks
        for i, (a, al, at, ar, ab) in enumerate(items):
            for b_, bl, bt, br, bb in items[i + 1:]:
                if al < br and bl < ar and at < bb and bt < ab:
                    problems.append(f'{a!r} overlaps {b_!r}')
        if problems:
            raise SystemExit(f'{name}: ' + '; '.join(problems))

    def save(self, name):
        self.verify(name)
        super().save(name)


def settings(s, x, y, w, h, title, rows):
    """A key box with a bold title and left-aligned setting lines spaced for a mark beside each one."""
    s.rect(x, y, w, h, 'fg-caja fg-caja--clave', rx=12)
    first = len(s.texts)
    s.text(x + w / 2, y + 26, title, 'fg-texto fg-negrita', 'middle')
    for i, (line, cls) in enumerate(rows):
        s.text(x + 40, y + 60 + i * 28, line, cls)
    s.container(x, y, w, h, first, len(s.texts))
    return [y + 56 + i * 28 for i in range(len(rows))]


# 1. config-backup: FortiGate -> TFTP server -> company repository.
s = Fig(800, 290)
s.text(20, 30, 'Por qué la copia pasa por el servidor TFTP y dónde tiene que acabar', 'fg-texto fg-negrita')
s.card(20, 70, 230, 110, 'FortiGate', ['configuración completa', 'con VDOM: antes config global', 'execute backup config tftp'])
s.arrow(250, 125, 285, data=True)
s.text(267.5, 114, 'TFTP', 'fg-tenue fg-peque', 'middle')
s.card(285, 70, 230, 110, 'Servidor TFTP', ['192.168.10.40', 'fgt60f-antes-cambio.conf', 'sin usuario ni contraseña'])
s.arrow(515, 125, 550)
s.text(532.5, 114, 'mover', 'fg-tenue fg-peque', 'middle')
s.card(550, 70, 230, 110, 'Repositorio de copias', ['de la empresa', 'lugar definitivo de la copia'], key=True)
s.mark(1, 20, 70)
s.mark(2, 285, 70)
s.mark(3, 550, 70)
s.note(220, 'Sin contraseña al final del comando, el archivo viaja y se guarda sin cifrar.', 4)
s.save('esquema-copia-tftp')

# 2. ntp-client: settings in config system ntp and where the time comes from.
s = Fig(800, 320)
s.text(20, 30, 'De dónde coge la hora el FortiGate después de esta guía', 'fg-texto fg-negrita')
ys = settings(s, 20, 60, 340, 170, 'FortiGate · config system ntp', [
    ('ntpsync enable   (de fábrica: disable)', 'fg-texto'),
    ('type custom   (de fábrica: fortiguard)', 'fg-texto'),
    ('ntpserver, entrada 1:', 'fg-texto'),
    ('server 192.168.10.5', 'fg-tenue'),
])
s.mark(1, 40, ys[0])
s.mark(2, 40, ys[1])
s.mark(3, 40, ys[2])
s.card(480, 60, 300, 70, 'Servidor de FortiGuard', ['el de Fortinet, solo con type fortiguard'])
s.arrow(480, 95, 360)
s.text(420, 86, 'ya no se usa', 'fg-tenue fg-peque', 'middle')
s.card(480, 160, 300, 90, 'Servidor de tiempo de la empresa', ['192.168.10.5', 'con un nombre, el FortiGate necesita DNS'], key=True)
s.arrow(480, 195, 360, data=True)
s.text(420, 186, 'hora (NTP)', 'fg-tenue fg-peque', 'middle')
s.mark(4, 420, 214)
s.note(268, 'Compruébalo con diagnose sys ntp status; puede tardar unos minutos en sincronizar.')
s.save('esquema-ntp')

# 3. syslog-remote: what is sent, how, and to where.
s = Fig(800, 300)
s.text(20, 30, 'Qué envía el FortiGate al servidor syslog y con qué valores', 'fg-texto fg-negrita')
ys = settings(s, 20, 60, 320, 150, 'FortiGate', [
    ('config log syslogd setting', 'fg-tenue'),
    ('status enable  (de fábrica: disable)', 'fg-texto'),
    ('server 192.168.10.30', 'fg-texto'),
])
s.mark(1, 40, ys[1])
s.mark(2, 40, ys[2])
s.arrow(340, 135, 520, data=True)
s.text(430, 124, 'registros', 'fg-tenue fg-peque', 'middle')
s.text(430, 156, 'UDP 514 · facility local7', 'fg-tenue fg-peque', 'middle')
s.mark(3, 430, 178)
s.card(520, 60, 260, 150, 'Servidor syslog', ['192.168.10.30', 'acepta mensajes del FortiGate', 'busca sus registros filtrando', 'por la IP del FortiGate'], key=True)
s.mark(4, 520, 60)
s.note(240, 'Si la hora del FortiGate no está sincronizada, los registros llegan con la hora mal.', 5)
s.save('esquema-syslog')

# 4. memory-recovery: the memory thresholds and why the cluster does not fail over by itself.
s = Fig(800, 300)
s.text(20, 30, 'Por qué el nodo saturado no cede el servicio al otro', 'fg-texto fg-negrita')
ys = settings(s, 20, 60, 330, 150, 'Memoria usada del nodo primario', [
    ('88 %: entra en modo de conservación', 'fg-texto'),
    ('95 %: descarta las sesiones nuevas', 'fg-texto'),
    ('82 %: sale del modo de conservación', 'fg-tenue'),
])
s.mark(1, 40, ys[0])
s.mark(2, 40, ys[1])
s.mark(3, 40, ys[2])
s.arrow(350, 105, 480)
s.text(415, 94, 'sigue respondiendo', 'fg-tenue fg-peque', 'middle')
s.mark(4, 415, 128)
s.card(480, 60, 300, 90, 'Nodo secundario', ['sano y en espera', 'no toma el servicio'], key=True)
s.note(238, 'Solo conmuta por memoria con memory-based-failover activado; de fábrica no lo está.', 5)
s.save('esquema-modo-conservacion')

print('written', sorted(p.name for p in kit.OUT.glob('*.svg')))
