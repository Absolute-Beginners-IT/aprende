"""Redrawn Proxmox VE 9 screens and schemas for the Proxmox VE guides.

Screens are simplified from the field names the guides' steps quote; schemas explain what travels where.
Run: python guias/scripts/figures/proxmox_ve.py
"""
import math

import kit
from kit import Svg

kit.use('proxmox-ve')


def width(s, cls):
    """Estimated width of a text: 7.3 px per character at 13 px, 6.5 at 11.5 px, 10.5 for titles, 8 px padding."""
    per = 10.5 if 'fg-titulo' in cls else 6.5 if 'fg-peque' in cls else 7.3
    if 'fg-negrita' in cls:
        per *= 1.08
    return len(s) * per + 8


def height(cls):
    return 18 if 'fg-titulo' in cls else 11.5 if 'fg-peque' in cls else 13


class Fig(Svg):
    """An Svg that records every text and mark, so verify() can catch overflows and overlaps."""

    def __init__(self, w=800, h=500):
        super().__init__(w, h)
        self.texts, self.marks, self.problems = [], [], []

    def text(self, x, y, s, cls='fg-texto', anchor=None):
        super().text(x, y, s, cls, anchor)
        if 'fg-num-t' in cls:
            return
        w, h = width(s, cls) - 8, height(cls)
        x0 = x - w / 2 if anchor == 'middle' else x - w if anchor == 'end' else x
        self.texts.append((x0, y - h * 0.8, x0 + w, y + h * 0.2, s))

    def mark(self, n, x, y):
        super().mark(n, x, y)
        self.marks.append((x - 11, y - 11, x + 11, y + 11, f'mark {n}'))

    def field(self, x, y, w, value, select=False, spinner=False, off=False):
        room = w - 9 - (24 if select else 36 if spinner else 0)
        if width(value, 'fg-texto') - 8 > room:
            self.problems.append(f'field value too wide: {value}')
        super().field(x, y, w, value, select, spinner, off)

    def box(self, x, y, w, h, title, lines, key=False):
        if width(title, 'fg-texto fg-negrita') > w:
            self.problems.append(f'box title too wide: {title}')
        for line in lines:
            if width(line, 'fg-peque') > w:
                self.problems.append(f'box line too wide: {line}')
        if 46 + (len(lines) - 1) * 18 + 8 > h:
            self.problems.append(f'box too short: {title}')
        super().box(x, y, w, h, title, lines, key)

    def button(self, x, y, w, label, main=False):
        if width(label, 'fg-texto') > w:
            self.problems.append(f'button label too wide: {label}')
        self.rect(x, y, w, 26, 'fg-boton fg-boton--principal' if main else 'fg-boton', rx=3)
        self.text(x + w / 2, y + 18, label, 'fg-texto fg-negrita' if main else 'fg-texto', 'middle')

    def arrow(self, x1, y1, x2, y2, data=False, dashed=False, via=None):
        """A line (or a curve through via) with an open arrowhead at (x2, y2)."""
        cls = 'fg-flecha fg-flecha--datos' if data else 'fg-flecha'
        dash = ' stroke-dasharray="5 4"' if dashed else ''
        if via:
            (cx1, cy1), (cx2, cy2) = via
            d, fx, fy = f'M{x1} {y1} C {cx1} {cy1}, {cx2} {cy2}, {x2} {y2}', cx2, cy2
        else:
            d, fx, fy = f'M{x1} {y1} L{x2} {y2}', x1, y1
        self.add(f'<path class="{cls}" d="{d}"{dash}/>')
        a = math.atan2(y2 - fy, x2 - fx)
        p = [(x2 - 9 * math.cos(a + s), y2 - 9 * math.sin(a + s)) for s in (0.45, -0.45)]
        self.add(f'<path class="{cls}" d="M{p[0][0]:.1f} {p[0][1]:.1f} L{x2} {y2} L{p[1][0]:.1f} {p[1][1]:.1f}"/>')

    def dialog(self, x, y, w, h, title):
        self.rect(x, y, w, h, 'fg-ventana', rx=6)
        self.rect(x + 0.5, y + 0.5, w - 1, 28, 'fg-barra', rx=6)
        self.text(x + 12, y + 19, title, 'fg-texto fg-negrita')

    def verify(self, name):
        found = list(self.problems)
        items = self.texts + self.marks
        for x0, y0, x1, y1, s in items:
            if x0 < 0 or y0 < 0 or x1 > self.w or y1 > self.h:
                found.append(f'outside the canvas: {s}')
        for i, a in enumerate(items):
            for b in items[i + 1:]:
                if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                    found.append(f'overlap: {a[4]} / {b[4]}')
        if found:
            raise SystemExit(f'{name}:\n  ' + '\n  '.join(found))

    def save(self, name):
        self.verify(name)
        super().save(name)


def web(s, tree, selected, menu, chosen):
    """The Proxmox VE web interface, simplified: resource tree, content menu of the selected item, main panel."""
    s.window('Proxmox VE')
    s.add(f'<rect class="fg-lateral" x="1" y="34" width="160" height="{s.h - 35}"/>')
    s.add(f'<path class="fg-linea" d="M161 34 V{s.h - 1} M311 34 V{s.h - 1}"/>')
    for i, (label, depth) in enumerate(tree):
        y = 62 + i * 26
        if i == selected:
            s.add(f'<rect class="fg-seleccion" x="4" y="{y - 14}" width="3" height="20"/>')
        s.text(16 + depth * 16, y, label, 'fg-texto fg-negrita' if i == selected else 'fg-texto')
    for i, (label, depth) in enumerate(menu):
        y = 62 + i * 26
        if i == chosen:
            s.rect(166, y - 17, 140, 24, 'fg-banda', rx=3)
        s.text(176 + depth * 16, y, label, 'fg-texto fg-negrita' if i == chosen else 'fg-texto')


# 1. vlan-bridge step «Marcar el puente como VLAN aware»: System, Network, vmbr0, Edit, VLAN aware, Apply Configuration.
s = Fig(800, 420)
web(s, [('Datacenter', 0), ('pve1', 1), ('101', 2)], 1, [('System', 0), ('Network', 1)], 1)
s.mark(1, 286, 88)
s.button(326, 48, 60, 'Edit')
s.button(396, 48, 160, 'Apply Configuration')
s.outline(390, 42, 172, 38)
s.mark(4, 576, 61)
s.band(320, 92, 470, 'Name')
s.rect(320, 118, 470, 26, 'fg-banda', rx=0)
s.text(328, 136, 'vmbr0', 'fg-texto fg-negrita')
s.outline(318, 116, 474, 30)
s.mark(2, 410, 131)
s.dialog(420, 186, 340, 200, 'Edit')
s.text(438, 248, 'Name:')
s.field(520, 230, 220, 'vmbr0', off=True)
s.check(520, 280, True, 'VLAN aware')
s.outline(512, 272, 120, 30)
s.mark(3, 646, 287)
s.button(660, 344, 80, 'OK', main=True)
s.save('puente-vlan-aware')

# 2. vlan-bridge step «Poner la máquina virtual en la VLAN»: Hardware, Network Device, Edit, VLAN Tag.
s = Fig(800, 400)
web(s, [('Datacenter', 0), ('pve1', 1), ('101', 2)], 2, [('Hardware', 0)], 0)
s.mark(1, 286, 62)
s.button(326, 48, 60, 'Edit')
s.rect(320, 92, 470, 26, 'fg-banda', rx=0)
s.text(328, 110, 'Network Device', 'fg-texto fg-negrita')
s.outline(318, 90, 474, 30)
s.mark(2, 470, 105)
s.dialog(420, 170, 340, 180, 'Edit: Network Device')
s.text(438, 238, 'VLAN Tag:')
s.field(530, 220, 120, '20')
s.outline(524, 214, 132, 38)
s.mark(3, 670, 233)
s.button(660, 306, 80, 'OK', main=True)
s.save('tarjeta-vlan')

# 3. vm-backup rollback step «Borrar la copia»: storage copias-nas, Backups, the copy of VM 101, Remove.
s = Fig(800, 190)
web(s, [('Datacenter', 0), ('pve1', 1), ('101', 2), ('copias-nas', 2)], 3, [('Backups', 0)], 0)
s.mark(1, 140, 140)
s.mark(2, 286, 62)
s.button(326, 48, 80, 'Remove')
s.outline(320, 42, 92, 38)
s.mark(4, 426, 61)
s.rect(320, 92, 470, 26, 'fg-banda', rx=0)
s.text(328, 110, 'vzdump-qemu-101-…', 'fg-texto fg-negrita')
s.outline(318, 90, 474, 30)
s.mark(3, 490, 105)
s.save('copia-borrar')

# 4. os-install step «Elegir el disco de destino»: the disk, the Options button, ext4 or ZFS.
s = Fig(720, 340)
s.window('Proxmox VE 9')
s.field(24, 88, 300, '(disco de destino)', select=True, off=True)
s.outline(18, 82, 312, 38)
s.mark(1, 344, 101)
s.button(372, 88, 90, 'Options')
s.outline(366, 82, 102, 38)
s.mark(2, 482, 101)
s.dialog(372, 150, 320, 150, 'Options')
s.radio(392, 196, True, 'ext4', 'fg-texto fg-negrita')
s.radio(392, 228, False, 'ZFS')
s.outline(386, 188, 90, 64)
s.mark(3, 490, 208)
s.text(24, 300, 'Todo lo que haya en el disco elegido se borra.', 'fg-tenue')
s.save('instalar-disco')

# 5. config-backup: what goes into the archive, and where it ends up.
s = Fig(800, 360)
s.text(20, 30, 'Qué se guarda en la copia de la configuración y adónde va', 'fg-texto fg-negrita')
s.rect(16, 50, 360, 290, 'fg-lateral', rx=14)
s.text(30, 68, 'NODO PVE1', 'fg-tenue fg-peque')
s.box(36, 84, 320, 120, 'Configuración del nodo', ['/etc/pve: usuarios, permisos, almacenamiento', 'y configuración de las máquinas virtuales',
                                                   '/etc/network/interfaces: red, puentes y VLAN', '/etc/hosts y /etc/hostname'])
s.arrow(196, 204, 196, 250)
s.text(206, 232, 'tar -czf', 'fg-tenue fg-peque')
s.box(36, 250, 320, 74, '/root/pve1-antes-cambio.tar.gz', ['un solo archivo comprimido'], key=True)
s.box(456, 84, 328, 88, 'Otro equipo', ['descarga el archivo', 'por SFTP o con scp'])
s.arrow(356, 287, 456, 140, data=True, via=((410, 287), (410, 140)))
s.box(456, 206, 328, 74, 'Repositorio de copias', ['de la empresa, fuera del servidor'], key=True)
s.arrow(620, 172, 620, 206)
s.text(456, 316, 'No incluye los discos de las máquinas virtuales:', 'fg-tenue fg-peque')
s.text(456, 332, 'esos se copian con vzdump.', 'fg-tenue fg-peque')
s.mark(1, 36, 84)
s.mark(2, 36, 250)
s.mark(3, 456, 84)
s.mark(4, 456, 206)
s.save('esquema-copia-configuracion')

# 6. config-restore: extract aside, compare, return only what is needed.
s = Fig(800, 380)
s.text(20, 30, 'Restaurar sin pisar la configuración en uso', 'fg-texto fg-negrita')
s.box(16, 120, 200, 74, 'Archivo de la copia', ['pve1-antes-cambio.tar.gz', 'en /root'])
s.arrow(216, 157, 276, 157, data=True)
s.text(246, 148, 'tar -xzf', 'fg-tenue fg-peque', 'middle')
s.box(276, 60, 230, 270, '/root/restaurar', ['copia extraída aparte:', 'etc/pve', 'etc/network/interfaces', 'etc/hosts y etc/hostname'], key=True)
s.rect(566, 60, 218, 270, 'fg-lateral', rx=14)
s.text(578, 76, 'EN USO', 'fg-tenue fg-peque')
s.box(580, 92, 192, 104, 'Máquina 101', ['/etc/pve/qemu-server/', '101.conf', 'con la máquina apagada'])
s.box(580, 212, 192, 104, 'Red del nodo', ['/etc/network/interfaces', 'y después ifreload -a', 'desde la consola física'])
s.arrow(506, 144, 580, 144, data=True)
s.text(536, 136, 'cp', 'fg-tenue fg-peque', 'middle')
s.arrow(506, 190, 566, 190, dashed=True)
s.text(536, 182, 'diff', 'fg-tenue fg-peque', 'middle')
s.arrow(506, 264, 580, 264, data=True)
s.text(536, 256, 'cp', 'fg-tenue fg-peque', 'middle')
s.text(20, 360, 'Los discos de las máquinas no vienen en esta copia: vuelven desde una copia de la máquina virtual.', 'fg-tenue fg-peque')
s.mark(1, 276, 60)
s.mark(2, 536, 210)
s.mark(3, 580, 92)
s.mark(4, 580, 212)
s.save('esquema-restaurar')

# 7. firmware-upgrade: apt update, apt full-upgrade, reboot only with a new kernel, the previous kernel as the way back.
s = Fig(800, 340)
s.text(20, 30, 'Actualizar un nodo: qué hace cada paso', 'fg-texto fg-negrita')
s.box(16, 60, 230, 90, 'Repositorios', ['los configurados en el nodo', 'publican las versiones'])
s.arrow(246, 105, 285, 105)
s.box(285, 60, 230, 90, 'apt update', ['descarga la lista de', 'versiones disponibles'])
s.arrow(515, 105, 554, 105)
s.box(554, 60, 230, 90, 'apt full-upgrade', ['instala todo; puede quitar', 'o añadir paquetes'], key=True)
s.arrow(669, 150, 669, 200)
s.box(554, 200, 230, 108, 'Reinicio', ['solo si llega un núcleo nuevo', '(proxmox-kernel-…), con las', 'máquinas movidas o apagadas'])
s.arrow(554, 254, 515, 254, dashed=True)
s.box(285, 200, 230, 108, 'Menú de arranque', ['el núcleo anterior sigue en', 'Advanced options: es la', 'vuelta atrás si algo falla'])
s.box(16, 200, 230, 108, '¿Por qué no upgrade?', ['upgrade no quita ni añade', 'paquetes y dejaría la', 'actualización a medias'])
s.mark(1, 285, 60)
s.mark(2, 554, 60)
s.mark(3, 554, 200)
s.mark(4, 285, 200)
s.save('esquema-actualizar')

# 8. ntp-client: the line in chrony.conf, chronyd asking the company time server, and how to check it.
s = Fig(800, 330)
s.text(20, 30, 'De dónde toma la hora el nodo', 'fg-texto fg-negrita')
s.box(16, 60, 200, 90, '/etc/chrony/chrony.conf', ['server 192.168.10.5 iburst', 'línea añadida al final'])
s.arrow(216, 105, 300, 105)
s.text(258, 96, 'lee', 'fg-tenue fg-peque', 'middle')
s.box(300, 60, 200, 90, 'chronyd (nodo)', ['systemctl restart chronyd', 'aplica la configuración'], key=True)
s.arrow(500, 95, 584, 95, data=True)
s.text(542, 86, 'consulta', 'fg-tenue fg-peque', 'middle')
s.arrow(584, 125, 500, 125, data=True)
s.text(542, 143, 'hora', 'fg-tenue fg-peque', 'middle')
s.box(584, 60, 200, 90, 'Servidor de tiempo', ['192.168.10.5', 'de la empresa'])
s.box(300, 200, 200, 90, 'chronyc sources', ['lista los servidores;', '^* es el que se usa'])
s.arrow(400, 150, 400, 200, dashed=True)
s.text(20, 230, 'iburst: la primera', 'fg-tenue fg-peque')
s.text(20, 246, 'sincronización tarda', 'fg-tenue fg-peque')
s.text(20, 262, 'segundos en vez de minutos.', 'fg-tenue fg-peque')
s.mark(1, 16, 60)
s.mark(2, 300, 60)
s.mark(3, 584, 60)
s.mark(4, 300, 200)
s.save('esquema-hora')

# 9. snmp-monitoring: the user file, the agent file, the firewall rule, and the SNMPv3 query from the NMS.
s = Fig(800, 360)
s.text(20, 30, 'Quién pregunta, por dónde entra y dónde está el usuario SNMPv3', 'fg-texto fg-negrita')
s.box(16, 60, 190, 100, 'Monitorización', ['192.168.10.40', 'SNMPv3 authPriv', 'SHA y AES'])
s.arrow(206, 110, 276, 110, data=True)
s.text(241, 101, 'UDP 161', 'fg-tenue fg-peque', 'middle')
s.box(276, 60, 200, 100, 'Firewall de Proxmox', ['deja pasar UDP 161', 'solo desde 192.168.10.40'])
s.arrow(476, 110, 546, 110, data=True)
s.box(546, 60, 238, 100, 'snmpd', ['agente SNMP del nodo', 'responde solo lectura'], key=True)
s.box(276, 220, 240, 104, '/var/lib/snmp/snmpd.conf', ['createUser monitor SHA … AES …', 'se añade con snmpd parado; al', 'arrancar pasa a claves derivadas'])
s.box(546, 220, 238, 104, '/etc/snmp/snmpd.conf', ['agentaddress udp:161', 'rouser monitor priv', '(solo lectura, con cifrado)'])
s.arrow(665, 220, 665, 160)
s.arrow(516, 236, 590, 160)
s.mark(1, 276, 220)
s.mark(2, 546, 220)
s.mark(3, 276, 60)
s.mark(4, 16, 60)
s.save('esquema-snmp')

# 10. syslog-remote: journald, rsyslog with its own file, UDP 514 to the syslog server.
s = Fig(800, 340)
s.text(20, 30, 'Cómo salen los registros del nodo hacia el servidor syslog', 'fg-texto fg-negrita')
s.box(16, 60, 190, 90, 'journald', ['registro del sistema', 'del nodo'])
s.arrow(206, 105, 276, 105)
s.text(241, 96, 'lee', 'fg-tenue fg-peque', 'middle')
s.box(276, 60, 238, 90, 'rsyslog', ['lee journald y reenvía', 'los mensajes'], key=True)
s.arrow(514, 105, 584, 105, data=True)
s.text(549, 96, 'UDP 514', 'fg-tenue fg-peque', 'middle')
s.box(584, 60, 200, 90, 'Servidor syslog', ['192.168.10.30', 'filtra por la IP del nodo'])
s.box(276, 210, 238, 112, '90-servidor-remoto.conf', ['en /etc/rsyslog.d/', '*.* @192.168.10.30:514', '*.*: todo origen y severidad', '@ = UDP; @@ sería TCP'])
s.arrow(395, 210, 395, 150)
s.mark(1, 276, 60)
s.mark(2, 276, 210)
s.mark(3, 549, 128)
s.mark(4, 584, 60)
s.save('esquema-syslog')

# 11. user-admin: user in the group, the group with the Administrator role on /, root@pam apart.
s = Fig(800, 350)
s.text(20, 30, 'Por qué el usuario nuevo puede administrarlo todo', 'fg-texto fg-negrita')
s.box(16, 70, 240, 104, 'jconde@pve', ['reino pve (usuarios de Proxmox)', 'contraseña con pveum passwd', 'segundo factor TOTP'])
s.arrow(256, 122, 306, 122)
s.text(281, 113, 'miembro', 'fg-tenue fg-peque', 'middle')
s.box(306, 70, 200, 104, 'Grupo admin', ['comentario: Administradores'])
s.arrow(506, 122, 546, 122)
s.box(546, 70, 238, 104, '/ (raíz)', ['permiso: grupo admin', 'rol Administrator', 'se hereda en todo lo demás'], key=True)
s.box(16, 220, 240, 104, 'root@pam', ['reino Linux PAM', 'entra siempre por consola o SSH', 'no depende de estos usuarios'])
s.text(286, 262, 'Cada administrador entra con su propia cuenta,', 'fg-tenue fg-peque')
s.text(286, 278, 'para no trabajar con root.', 'fg-tenue fg-peque')
s.mark(1, 306, 70)
s.mark(2, 546, 70)
s.mark(3, 16, 70)
s.mark(4, 16, 220)
s.save('esquema-usuarios')

# 12. vm-backup: vzdump from the VM to another storage, and qmrestore with a free ID to test it.
s = Fig(800, 285)
s.text(20, 30, 'Dónde queda la copia de una máquina virtual y cómo se prueba', 'fg-texto fg-negrita')
s.box(16, 60, 220, 104, 'Máquina 101', ['modo snapshot: sigue en marcha', 'modo stop: se para mientras', 'se copia (el más consistente)'])
s.arrow(236, 112, 296, 112, data=True)
s.text(266, 103, 'vzdump', 'fg-tenue fg-peque', 'middle')
s.box(296, 60, 220, 104, 'copias-nas', ['otro almacenamiento', 'vzdump-qemu-101-….vma.zst', 'comprimido con zstd'], key=True)
s.arrow(516, 112, 584, 112, data=True)
s.text(550, 103, 'qmrestore', 'fg-tenue fg-peque', 'middle')
s.box(584, 60, 200, 104, 'Prueba', ['restaurada con otro número', 'libre, sin tocar la original;', 'después se borra'])
s.text(20, 214, 'No guardes la copia en el mismo almacenamiento donde están los discos de la máquina.', 'fg-tenue fg-peque')
s.text(20, 262, 'Una copia solo está comprobada cuando se ha restaurado alguna vez.', 'fg-tenue fg-peque')
s.mark(1, 16, 60)
s.mark(2, 296, 60)
s.mark(3, 584, 60)
s.save('esquema-vzdump')

# 13. vm-snapshot: the snapshot, the change, then delete it (keep the change) or roll back (lose the change).
s = Fig(800, 360)
s.text(20, 30, 'Snapshot antes de un cambio: dos salidas', 'fg-texto fg-negrita')
s.box(16, 120, 220, 104, 'qm snapshot', ['guarda el estado de los discos', 'con el nombre antes_actualizar', '--vmstate 1: también la memoria'])
s.arrow(236, 172, 296, 172)
s.box(296, 120, 180, 104, 'Cambio', ['actualización o', 'configuración,', 'y comprobarlo'])
s.arrow(476, 150, 556, 100)
s.box(556, 50, 228, 104, 'Funciona: qm delsnapshot', ['se queda el cambio; la', 'snapshot ocupaba espacio y', 'ralentizaba los discos'])
s.arrow(476, 196, 556, 250)
s.box(556, 200, 228, 104, 'Sale mal: qm rollback', ['vuelve al estado de la snapshot', 'y se pierde lo cambiado después', 'sin memoria: qm start 101'], key=True)
s.arrow(556, 290, 126, 224, dashed=True, via=((380, 350), (140, 330)))
s.mark(1, 16, 120)
s.mark(2, 296, 120)
s.mark(3, 556, 50)
s.mark(4, 556, 200)
s.save('esquema-snapshot')

print('written', sorted(p.name for p in kit.OUT.glob('*.svg')))
