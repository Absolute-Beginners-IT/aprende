"""Drawing kit for the guides' figures (guias/src/content/figures/<platform>/*.svg).

Screens are simplified, redrawn from the documented field names; schemas explain what travels where. Classes are the
fg-* ones in guias/src/styles.css, so every figure follows the light and dark themes. Each platform has its own script:
    python -I guias/scripts/figures/<platform>.py
writes its SVGs into guias/src/content/figures/<platform>/.
"""
from html import escape
from pathlib import Path

FIGURES = Path(__file__).resolve().parents[2] / 'src' / 'content' / 'figures'
W, H = 800, 500
OUT = FIGURES  # set by each platform script with use(platform)


def use(platform):
    """Points save() at the figures folder of one platform, creating it if needed."""
    global OUT
    OUT = FIGURES / platform
    OUT.mkdir(parents=True, exist_ok=True)
    return OUT


class Svg:
    def __init__(self, w=W, h=H):
        self.w, self.h, self.parts = w, h, []

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, cls='fg-texto', anchor=None):
        a = f' text-anchor="{anchor}"' if anchor else ''
        self.add(f'<text class="{cls}" x="{x}" y="{y}"{a}>{escape(s)}</text>')

    def rect(self, x, y, w, h, cls, rx=4):
        self.add(f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}"/>')

    def field(self, x, y, w, value, select=False, spinner=False, off=False):
        self.rect(x, y, w, 26, 'fg-campo')
        self.text(x + 9, y + 18, value, 'fg-tenue' if off else 'fg-texto')
        if select:
            self.add(f'<path class="fg-icono" d="M{x + w - 18} {y + 10} l5 5 l5 -5"/>')
        if spinner:
            self.add(f'<path class="fg-icono" d="M{x + w - 30} {y + 10} l4 4 l4 -4 M{x + w - 16} {y + 15} l4 -4 l4 4"/>')

    def check(self, x, y, on, label, cls='fg-texto'):
        self.rect(x, y, 14, 14, 'fg-casilla fg-casilla--si' if on else 'fg-casilla', rx=2)
        if on:
            self.add(f'<path class="fg-visto" d="M{x + 3} {y + 7} l3 3 l6 -6"/>')
        self.text(x + 22, y + 12, label, cls)

    def radio(self, x, y, on, label, cls='fg-texto'):
        self.add(f'<circle class="fg-casilla" cx="{x + 7}" cy="{y + 7}" r="7"/>')
        if on:
            self.add(f'<circle class="fg-seleccion" cx="{x + 7}" cy="{y + 7}" r="4"/>')
        self.text(x + 22, y + 12, label, cls)

    def band(self, x, y, w, label):
        self.rect(x, y, w, 24, 'fg-banda', rx=0)
        self.text(x + 8, y + 17, label)

    def mark(self, n, x, y):
        self.add(f'<circle class="fg-num" cx="{x}" cy="{y}" r="11"/>')
        self.text(x, y + 4, str(n), 'fg-num-t', 'middle')

    def outline(self, x, y, w, h):
        self.rect(x, y, w, h, 'fg-resalte', rx=6)

    def window(self, title):
        self.rect(0.5, 0.5, self.w - 1, self.h - 1, 'fg-ventana', rx=8)
        self.add(f'<path class="fg-barra" d="M1 9 a8 8 0 0 1 8 -8 h{self.w - 18} a8 8 0 0 1 8 8 v25 h-{self.w - 2} z"/>')
        self.text(14, 22, title)
        self.add(f'<path class="fg-icono" d="M{self.w - 24} 12 l10 10 M{self.w - 14} 12 l-10 10"/>')

    def wizard(self, title, steps, current, heading, description, buttons=('< Previous', 'Next >', 'Finish', 'Cancel'), main=1):
        self.window(title)
        self.add(f'<rect class="fg-lateral" x="1" y="34" width="160" height="{self.h - 35}"/>')
        for i, s in enumerate(steps):
            y = 66 + i * 32
            cls = 'fg-texto fg-negrita' if i == current else ('fg-texto' if i < current else 'fg-tenue')
            if i == current:
                self.add(f'<rect class="fg-seleccion" x="4" y="{y - 14}" width="3" height="20"/>')
            self.text(16, y, s, cls)
        self.text(177, 68, heading, 'fg-titulo')
        for i, line in enumerate(description):
            self.text(177, 94 + i * 17, line, 'fg-tenue')
        self.add(f'<path class="fg-linea" d="M177 {104 + 17 * len(description)} H{self.w - 17}"/>')
        xs = [449, 537, 625, 713]
        for i, (x, label) in enumerate(zip(xs, buttons)):
            cls = 'fg-boton fg-boton--principal' if i == main else ('fg-boton fg-boton--apagado' if label == 'Finish' else 'fg-boton')
            self.rect(x, self.h - 52, 80, 26, cls, rx=3)
            self.text(x + 40, self.h - 34, label, 'fg-tenue' if label == 'Finish' else 'fg-texto', 'middle')

    def save(self, name):
        body = '\n  '.join(self.parts)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" aria-hidden="true">\n'
               f'  {body}\n</svg>\n')
        (OUT / f'{name}.svg').write_text(svg, encoding='utf-8')


    def box(self, x, y, w, h, title, lines, key=False):
        """A schema box: a bold title and centred lines; key boxes are highlighted."""
        self.rect(x, y, w, h, 'fg-caja fg-caja--clave' if key else 'fg-caja', rx=12)
        self.text(x + w / 2, y + 24, title, 'fg-texto fg-negrita', 'middle')
        for i, line in enumerate(lines):
            self.text(x + w / 2, y + 46 + i * 18, line, 'fg-tenue fg-peque', 'middle')
