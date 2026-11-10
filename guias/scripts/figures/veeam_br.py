"""Redrawn Veeam Backup & Replication 13 console screens and one schema for the Veeam guides.

Run: python -I guias/scripts/figures/veeam_br.py
"""
import kit
from kit import Svg

kit.use('veeam-br')

# 1. Ready to Install (install step «Revisar la configuración de la instalación»).
s = Svg(720, 470)
s.window('Veeam Backup & Replication')
s.text(18, 68, 'Ready to Install', 'fg-titulo')
s.text(18, 90, 'Installation will begin with the following settings.', 'fg-tenue')
s.add('<path class="fg-linea" d="M1 104 H719"/>')
rows = [('Installation folder:', 'C:\\Program Files\\Veeam'), ('vPower cache folder:', 'C:\\ProgramData\\Veeam\\Backup\\IRCache'),
        ('Guest catalog folder:', 'C:\\VBRCatalog'), ('Service account:', 'LOCAL SYSTEM'), ('Database engine:', 'PostgreSQL'),
        ('Database server:', 'SRV-VBR01:5432'), ('Database name:', 'VeeamBackup'), ('Primary service port:', '443'),
        ('REST API service port:', '9419'), ('Check for product updates:', 'Automatically')]
for i, (k, v) in enumerate(rows):
    s.text(18, 134 + i * 20, k)
    s.text(248, 134 + i * 20, v)
s.outline(240, 178, 300, 78)
s.mark(1, 552, 196)
s.outline(240, 258, 160, 40)
s.mark(2, 412, 270)
s.add('<circle class="fg-icono" cx="26" cy="424" r="6"/>')
s.text(40, 429, 'Customize Settings', 'fg-enlace')
s.mark(3, 172, 424)
s.rect(432, 410, 80, 30, 'fg-boton', rx=3)
s.text(472, 430, 'Back', anchor='middle')
s.rect(528, 410, 80, 30, 'fg-boton fg-boton--principal', rx=3)
s.text(568, 430, 'Install', 'fg-texto fg-negrita', 'middle')
s.mark(4, 620, 410)
s.rect(624 + 10, 410, 74, 30, 'fg-boton', rx=3)
s.text(671, 430, 'Cancel', anchor='middle')
s.save('instalar-listo')

# 2. Add Backup Repository: type list (repository step «Abrir el asistente»).
s = Svg(700, 420)
s.window('Add Backup Repository')
s.text(22, 62, 'Add Backup Repository', 'fg-titulo')
s.text(22, 84, 'Select the type of backup repository you want to add.', 'fg-tenue')
items = [('Direct attached storage', 'Microsoft Windows or Linux server with internal or direct attached storage.'),
         ('Network attached storage', 'Network share on a file server or a NAS device.'),
         ('Deduplicating storage appliance', 'Dedicated backup appliances from storage vendors.'),
         ('Object storage', 'On-prem object storage system or a cloud object storage provider.')]
for i, (name, desc) in enumerate(items):
    y = 122 + i * 62
    s.add(f'<rect class="fg-icono" x="24" y="{y - 6}" width="22" height="26" rx="4"/>')
    s.text(62, y + 4, name, 'fg-enlace fg-negrita')
    s.text(62, y + 24, desc, 'fg-tenue')
s.outline(54, 108, 440, 48)
s.mark(1, 506, 122)
s.add('<rect class="fg-caja" x="430" y="140" width="240" height="78" rx="8"/>')
s.text(446, 164, 'Direct attached storage', 'fg-texto fg-negrita')
s.text(446, 188, 'Microsoft Windows', 'fg-texto')
s.text(446, 208, 'Linux', 'fg-tenue')
s.outline(438, 172, 160, 24)
s.mark(2, 612, 184)
s.rect(596, 376, 84, 26, 'fg-boton', rx=3)
s.text(638, 394, 'Cancel', anchor='middle')
s.save('repositorio-tipo')

# 3. New Backup Repository, Repository step (repository step «Indicar la carpeta»).
s = Svg()
s.wizard('New Backup Repository', ['Name', 'Server', 'Repository', 'Mount Servers', 'Review', 'Apply', 'Summary'], 2,
         'Repository', ['Type in path to the folder where backup files should be stored, and set', 'repository load control options.'])
s.band(177, 146, 606, 'Location')
s.text(185, 196, 'Path to folder:')
s.field(282, 178, 410, 'E:\\Backups')
s.text(704, 196, 'Browse...', 'fg-enlace')
s.text(304, 224, '2.1 TB free of 2.4 TB', 'fg-tenue')
s.text(722, 224, 'Populate', 'fg-enlace')
s.outline(276, 172, 422, 38)
s.mark(1, 270, 172)
s.outline(714, 208, 66, 24)
s.mark(2, 772, 244)
s.band(177, 250, 606, 'Load control')
s.check(185, 292, True, 'Limit maximum concurrent tasks to:')
s.field(420, 286, 80, '4', spinner=True)
s.check(185, 324, False, 'Limit read and write data rate to:', 'fg-tenue')
s.outline(179, 282, 330, 34)
s.mark(3, 522, 300)
s.text(177, 422, 'Customize repository settings...', 'fg-enlace')
s.save('repositorio-carpeta')

# 4. New Backup Job, Storage step (backup-job step «Elegir el destino y la retención»).
s = Svg()
s.wizard('New Backup Job', ['Name', 'Virtual Machines', 'Storage', 'Guest Processing', 'Schedule', 'Summary'], 2,
         'Storage', ['Specify backup repository to store the backup files produced by this job and', 'customize advanced job settings if required.'])
s.text(177, 176, 'Backup repository:')
s.field(296, 158, 486, 'REPO-LOCAL-01 (Created by Veeam Backup)', select=True)
s.text(318, 204, '2.1 TB free of 2.4 TB', 'fg-tenue')
s.text(707, 204, 'Map backup', 'fg-enlace')
s.outline(290, 152, 498, 38)
s.mark(1, 284, 152)
s.text(177, 246, 'Retention policy:')
s.field(286, 228, 90, '14', spinner=True)
s.text(388, 246, 'days')
s.outline(280, 222, 146, 38)
s.mark(2, 438, 240)
s.check(177, 274, False, 'Keep certain full backups longer for archival purposes', 'fg-tenue')
s.text(177, 422, 'Advanced job settings...', 'fg-enlace')
s.save('trabajo-destino')

# 5. New Backup Job, Schedule step (backup-job step «Programar la copia»).
s = Svg()
s.wizard('New Backup Job', ['Name', 'Virtual Machines', 'Storage', 'Guest Processing', 'Schedule', 'Summary'], 4,
         'Schedule', ['Specify the job scheduling options. If you do not set the schedule, the job will', 'need to be controlled manually.'],
         buttons=('< Previous', 'Apply', 'Finish', 'Cancel'))
s.check(177, 150, True, 'Run the job automatically')
s.radio(199, 180, True, 'Daily at this time:')
s.field(340, 174, 96, '22:00', spinner=True)
s.field(448, 174, 250, 'Everyday', select=True)
s.radio(199, 214, False, 'Monthly at this time:', 'fg-tenue')
s.field(340, 208, 96, '22:00', off=True)
s.radio(199, 248, False, 'Periodically every:', 'fg-tenue')
s.field(340, 242, 96, '1', off=True)
s.outline(193, 168, 512, 38)
s.mark(1, 187, 168)
s.band(177, 288, 606, 'Automatic retry')
s.check(185, 326, True, 'Retry failed items processing:')
s.field(392, 320, 70, '3', spinner=True)
s.text(474, 338, 'times')
s.text(207, 370, 'Wait before each retry attempt for:')
s.field(450, 352, 70, '10', spinner=True)
s.text(532, 370, 'minutes')
s.outline(179, 316, 340, 34)
s.mark(2, 531, 330)
s.mark(3, 577, 434)
s.save('trabajo-horario')

# 6. Entire VM Restore, Restore Mode step (vm-restore step «Elegir el modo»).
s = Svg()
s.wizard('Entire VM Restore', ['Virtual Machines', 'Restore Mode', 'Host', 'Storage', 'Name', 'Network', 'Reason', 'Summary'], 1,
         'Restore Mode', ['Specify whether selected VMs should be restored back to the original location,', 'or to a new location or with different settings.'])
s.radio(177, 152, False, 'Restore to the original location')
s.text(199, 184, 'Quickly initiate the restore of selected VM to its original location, with', 'fg-tenue')
s.text(199, 201, 'the original name and settings.', 'fg-tenue')
s.outline(171, 144, 300, 30)
s.mark(2, 484, 158)
s.radio(177, 230, True, 'Restore to a new location, or with different settings', 'fg-texto fg-negrita')
s.text(199, 262, 'Customize the restored VM location, and change its settings. The wizard', 'fg-tenue')
s.text(199, 279, 'populates all controls with the original VM settings as the defaults.', 'fg-tenue')
s.outline(171, 222, 400, 30)
s.mark(1, 584, 236)
s.save('restaurar-modo')

# 7. Configuration Backup Settings (config-backup steps 1 to 5).
s = Svg(560, 450)
s.window('Configuration Backup Settings')
s.band(16, 50, 528, 'Backup')
s.check(20, 88, True, 'Enable configuration backup to the following repository:')
s.field(20, 110, 520, 'REPO-LOCAL-01', select=True)
s.text(42, 156, '2.1 TB free of 2.4 TB', 'fg-tenue')
s.outline(14, 80, 532, 62)
s.mark(1, 13, 80)
s.text(20, 192, 'Restore points to keep:')
s.field(176, 174, 76, '10', spinner=True)
s.text(440, 192, 'Notifications...', 'fg-enlace')
s.outline(170, 168, 88, 38)
s.mark(2, 270, 186)
s.text(20, 230, 'Perform backup on:')
s.text(176, 230, 'Daily at 06:00')
s.text(440, 230, 'Schedule...', 'fg-enlace')
s.outline(432, 214, 90, 24)
s.mark(3, 534, 226)
s.text(20, 264, 'Last successful backup:')
s.text(176, 264, 'Never', 'fg-tenue')
s.text(440, 264, 'Backup now', 'fg-enlace')
s.outline(432, 248, 90, 24)
s.mark(5, 534, 260)
s.check(20, 292, True, 'Enable configuration backup file encryption')
s.text(42, 330, 'Password:')
s.field(42, 338, 420, 'Configuration backup (Last edited: today)', select=True)
s.text(472, 356, 'Add...', 'fg-enlace')
s.outline(14, 284, 532, 86)
s.mark(4, 13, 284)
s.rect(282, 404, 80, 28, 'fg-boton fg-boton--principal', rx=3)
s.text(322, 423, 'OK', anchor='middle')
s.rect(370, 404, 80, 28, 'fg-boton', rx=3)
s.text(410, 423, 'Cancel', anchor='middle')
s.rect(458, 404, 80, 28, 'fg-boton', rx=3)
s.text(498, 423, 'Apply', anchor='middle')
s.save('copia-configuracion')

# 8. Where everything lives: VM on Proxmox, snapshot, worker, backup server, repository, configuration backup.
s = Svg(800, 380)
s.text(20, 30, 'Qué viaja y dónde se guarda en una copia de una máquina de Proxmox VE', 'fg-texto fg-negrita')




s.rect(16, 52, 300, 300, 'fg-lateral', rx=14)
s.text(30, 74, 'PROXMOX VE', 'fg-tenue fg-peque')
s.box(36, 88, 260, 82, 'Máquina virtual', ['sigue funcionando durante la copia', 'snapshot temporal en QCOW2'])
s.box(36, 196, 260, 82, 'Worker', ['VM pequeña que crea Veeam', 'lee los discos y los envía'], key=True)
s.add('<path class="fg-flecha fg-flecha--datos" d="M166 170 V196"/>')
s.box(380, 60, 400, 106, 'Servidor de copias (Windows Server)', ['consola de Veeam y servicios', 'base de datos de configuración VeeamBackup', 'decide qué se copia, cuándo y dónde'])
s.box(380, 196, 400, 82, 'Repositorio REPO-LOCAL-01', ['E:\\Backups en el servidor de copias', 'aquí quedan los puntos de restauración'], key=True)
s.add('<path class="fg-flecha fg-flecha--datos" d="M296 237 H380"/>')
s.text(338, 228, 'datos', 'fg-tenue fg-peque', 'middle')
s.add('<path class="fg-flecha" d="M380 120 C 340 120, 330 210, 296 220" stroke-dasharray="5 4"/>')
s.text(330, 150, 'órdenes', 'fg-tenue fg-peque', 'middle')
s.box(380, 292, 400, 60, 'Copia de la configuración (.bco)', ['VeeamConfigBackup en un repositorio, y otra copia fuera'])
s.add('<path class="fg-flecha" d="M580 166 V196 M580 278 V292"/>')
s.mark(1, 36, 88)
s.mark(2, 36, 196)
s.mark(3, 380, 196)
s.mark(4, 380, 292)
s.save('esquema-copia')
print('written', sorted(p.name for p in kit.OUT.glob('*.svg')))
