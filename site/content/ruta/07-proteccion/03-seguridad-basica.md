---
title: "Seguridad básica: parches, privilegios y MFA"
description: "Las cuatro costumbres que frenan la mayoría de los incidentes: parchear con calma pero sin falta, dar el mínimo privilegio, separar la cuenta de administrador y pedir un segundo factor."
weight: 3
equipo: "escudo"
duracion: "45 min"
nivel: "Inicial"
objetivos:
  - "Organizar una cadencia de parches con grupo piloto."
  - "Aplicar el principio de mínimo privilegio y usar cuentas de administración separadas."
  - "Explicar qué es la MFA y dónde es imprescindible."
  - "Dar de baja correctamente a una persona que se va de la empresa."
requisitos:
  - "Sala «Copias de seguridad que se pueden restaurar»"
  - "Módulo 2 (sistemas operativos): salas «Windows Server: primeros pasos» y «Linux para administradores»"
---

{{% tarea n="1" titulo="Parches: con calma, pero sin falta" %}}
Los **parches** son las actualizaciones que corrigen fallos de seguridad. Muchos ataques aprovechan vulnerabilidades que ya tenían parche desde hacía meses: el problema no era el fallo, sino que nadie había actualizado.

Una cadencia sencilla que funciona en la mayoría de las empresas:

| Paso | Qué haces |
| --- | --- |
| 1. Cada mes | Microsoft publica sus parches el **segundo martes de cada mes** («Patch Tuesday»). Linux publica continuamente; revisa al menos una vez al mes. |
| 2. Grupo piloto | Instala primero en unos pocos equipos poco críticos y espera unos días. |
| 3. Resto de equipos | Si el piloto va bien, despliega al resto en una ventana de mantenimiento, con copia reciente. |
| 4. Urgencias | Si un fallo se está explotando activamente, no esperes al mes siguiente: parchea cuanto antes. |

Mira los parches pendientes en tu laboratorio:

```
sudo apt update
apt list --upgradable
```

```
Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 5
```

El primero, en Ubuntu, refresca la lista de paquetes y muestra lo que falta por actualizar; el segundo, en `SRV-DC01`, muestra las últimas actualizaciones instaladas. No te olvides de los equipos que no son servidores: firewall, switches, NAS e hipervisores también tienen firmware que parchear.

{{< pregunta texto="¿Cómo se llama el conjunto de equipos donde instalas los parches antes que en el resto?" respuesta="grupo piloto|piloto|el grupo piloto" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Mínimo privilegio y cuentas separadas" %}}
El **principio de mínimo privilegio** dice que cada persona y cada servicio deben tener **solo los permisos que necesitan** para su trabajo, y nada más. Si una cuenta con pocos permisos cae en manos de un atacante, el daño es pequeño.

Para los administradores, eso se traduce en **dos cuentas**:

| Cuenta | Ejemplo | Para qué se usa |
| --- | --- | --- |
| **Normal** | `tunombre` | Correo, navegador, documentos: el día a día. |
| **De administración** | `adm-tunombre` | Solo para administrar servidores y servicios. Nunca para leer el correo ni navegar. |

¿Por qué? Porque la mayoría de los ataques entran por un correo o una web maliciosa. Si abres ese correo con tu cuenta normal, el atacante consigue una cuenta normal. Si lo abres con una cuenta de administrador del dominio, consigue la empresa entera.

Otras reglas que van con esta:

- Las cuentas **genéricas** (`Administrador`, `root`) quedan para emergencias, con la contraseña en el gestor de contraseñas.
- Los servicios usan **cuentas de servicio** propias, con permisos limitados, no la cuenta de un administrador.
- Revisa cada cierto tiempo quién está en los grupos privilegiados (en Windows, **Admins. del dominio**; en Linux, el grupo `sudo`).

{{< aviso titulo="La distinción que importa" >}}
Tener **dos cuentas** no sirve de nada si la de administración se usa para todo. La separación vale por **lo que no haces** con la cuenta privilegiada.
{{< /aviso >}}

{{< pregunta texto="¿Cómo se llama el principio de dar a cada cuenta solo los permisos que necesita?" respuesta="minimo privilegio|principio de minimo privilegio|menor privilegio|privilegio minimo" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="MFA: la contraseña ya no basta" %}}
La **MFA** (Multi-Factor Authentication, autenticación multifactor) pide al menos **dos factores de tipo distinto** para entrar:

| Factor | Ejemplo |
| --- | --- |
| Algo que **sabes** | Una contraseña o un PIN. |
| Algo que **tienes** | Una aplicación de autenticación en el móvil, una llave de seguridad física. |
| Algo que **eres** | Tu huella o tu cara. |

Una contraseña robada, por sí sola, ya no abre la puerta. Por eso la MFA es **imprescindible** en todo lo que se puede alcanzar desde Internet (correo, VPN, escritorio remoto publicado, paneles en la nube) y en las cuentas de administración.

Dos matices: dos contraseñas seguidas **no** son MFA (son dos veces el mismo factor), y los códigos por SMS son mejor que nada, pero las aplicaciones de autenticación y las llaves físicas son más resistentes al robo.

{{< pregunta texto="Una contraseña y un PIN, ¿cuentan como MFA? (sí/no)" respuesta="no" pista="Mira de qué tipo es cada factor." >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Cuando alguien se va" %}}
Una cuenta de alguien que ya no trabaja en la empresa es una puerta abierta que nadie vigila. El procedimiento de baja debe ser **inmediato** y estar escrito:

1. **Deshabilita** la cuenta el mismo día de la salida (no la borres aún: puede que necesites sus ficheros o su correo, y deshabilitada no sirve para entrar).
2. Revoca sus accesos remotos: VPN, MFA, sesiones abiertas en servicios en la nube.
3. **Cambia las contraseñas compartidas** que conocía (Wi-Fi, cuentas genéricas, paneles de proveedores). El gestor de contraseñas te dirá cuáles tenía.
4. Pasado el plazo que marque la empresa, archiva sus datos y elimina la cuenta.

Practica en el laboratorio. En Ubuntu, crea un usuario de prueba y bloquéalo:

```
sudo adduser becario
sudo usermod -L becario
sudo chage -E 1 becario
```

`usermod -L` bloquea su contraseña y `chage -E 1` pone como fecha de caducidad el 2 de enero de 1970, así que la cuenta queda caducada y tampoco se puede entrar con claves SSH (no uses `0`: el manual de `shadow` advierte que puede interpretarse como «sin caducidad»). En `SRV-DC01`, que desde el módulo 4 es controlador de dominio, ya no hay cuentas locales: la baja se hace en Active Directory.

```
New-ADUser -Name "becario" -SamAccountName "becario"
Disable-ADAccount -Identity "becario"
Get-ADUser -Identity "becario"
```

En la salida de `Get-ADUser`, `Enabled` debe valer `False`. En un servidor que no es controlador de dominio, el equivalente con cuentas locales es `New-LocalUser` y `Disable-LocalUser`.

Crea y deshabilita la cuenta de prueba en los dos sistemas y marca la tarea.
{{% /tarea %}}
