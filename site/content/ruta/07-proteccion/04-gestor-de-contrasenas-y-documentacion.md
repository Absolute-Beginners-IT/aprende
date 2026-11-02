---
title: "Gestor de contraseñas y documentación"
description: "Guarda las credenciales compartidas donde deben estar y escribe la documentación que permitirá a otra persona arreglar las cosas cuando tú no estés."
weight: 4
equipo: "llave"
duracion: "40 min"
nivel: "Inicial"
objetivos:
  - "Explicar por qué las credenciales compartidas van en un gestor de contraseñas y nunca en el inventario."
  - "Organizar un gestor de contraseñas por equipos y con acceso de emergencia."
  - "Distinguir los documentos básicos de una infraestructura: inventario, esquemas, procedimientos y post mortem."
  - "Escribir un procedimiento de restauración que otra persona pueda seguir."
requisitos:
  - "Sala «Copias de seguridad que se pueden restaurar»"
  - "Sala «Seguridad básica: parches, privilegios y MFA»"
---

{{% tarea n="1" titulo="Las contraseñas compartidas, en un gestor" %}}
En cualquier empresa hay credenciales que comparten varias personas: la cuenta `Administrador` de emergencia, el panel del proveedor de Internet, la Wi-Fi de invitados, la tarjeta de red del SAI, la contraseña del repositorio de copias. ¿Dónde se guardan?

| Sitio | ¿Vale? | Por qué |
| --- | --- | --- |
| Una hoja de cálculo o el inventario | No | Cualquiera que vea el fichero las ve todas, se copia sin control y no hay registro de quién las consultó. |
| Un pósit o un cuaderno | No | Se pierde, se fotografía y no se puede cambiar a la vez para todos. |
| La memoria del administrador | No | El día que se va o se pone enfermo, nadie puede entrar. |
| Un **gestor de contraseñas** de equipo | Sí | Cifrado, con permisos por persona o grupo, registro de accesos y una sola copia que todos ven actualizada. |

Hay opciones en la nube, opciones que alojas tú y opciones basadas en un fichero cifrado (Bitwarden, Vaultwarden o KeePassXC son ejemplos conocidos). Lo importante no es la marca, sino cómo lo usas.

{{< aviso titulo="La distinción que importa" >}}
El **inventario** dice **qué** hay y **dónde** (nombre, IP, modelo, función). El **gestor** guarda **cómo se entra**. En el inventario, como mucho, escribe «credenciales: ver entrada SAI-01 en el gestor». Nunca la contraseña.
{{< /aviso >}}

{{< pregunta texto="¿Dónde deben guardarse las credenciales compartidas de la empresa?" respuesta="gestor de contrasenas|en un gestor de contrasenas|en el gestor de contrasenas|un gestor de contrasenas|gestor|en un gestor" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Un gestor bien organizado" %}}
Un gestor mal organizado acaba siendo la hoja de cálculo de antes, pero cifrada. Unas reglas sencillas:

- **Colecciones por área**: red, servidores, copias, proveedores… y cada persona ve solo las que necesita (el mínimo privilegio de la sala anterior también aplica aquí).
- **Cada persona con su propia cuenta** en el gestor, protegida con **MFA**. Nada de una cuenta compartida «it@empresa».
- **Una entrada por credencial**, con nombre claro, usuario, URL o IP y una nota: para qué sirve y quién la usa.
- **Acceso de emergencia** («romper el cristal»): ¿qué pasa si el gestor no está disponible o nadie recuerda la contraseña maestra? Guarda el kit de recuperación y la contraseña maestra de emergencia en un sobre cerrado en una caja fuerte, o usa la función de acceso de emergencia del propio gestor. Si el gestor está en tus servidores, inclúyelo en las copias de seguridad.
- **Cambiar al salir alguien**: el registro del gestor te dice qué credenciales podía ver la persona que se va. Esas son las que hay que cambiar.

Recuerda la contraseña del repositorio de restic de la primera sala: si solo la tenía en la cabeza el administrador que se fue, las copias están cifradas para siempre.

{{< pregunta texto="¿Con qué factor adicional, además de la contraseña maestra, debe proteger cada persona su cuenta del gestor? (siglas)" respuesta="mfa|2fa" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="Documentación que sobrevive a su autor" %}}
La prueba de una buena documentación es sencilla: **si mañana no estás, ¿podría otra persona restaurar una copia, reiniciar el firewall o dar de baja a un usuario leyendo solo lo que dejaste escrito?**

Los documentos que no pueden faltar:

| Documento | Qué contiene |
| --- | --- |
| **Inventario** | Cada equipo con nombre, IP, función, ubicación, garantía y responsable. |
| **Esquemas** | Cómo se conecta todo: red física, VLAN, dónde viven las VM. |
| **Procedimientos (runbooks)** | Los pasos exactos para tareas habituales o de emergencia: restaurar, apagar la sala, dar de alta un usuario. |
| **Planes de cambio (MOP)** | Qué se va a cambiar, cómo, cómo se comprueba y **cómo se vuelve atrás**. |
| **Post mortem** | Qué pasó en un incidente, por qué y qué se cambia para que no se repita, sin buscar culpables. |

En el toolkit de este proyecto tienes plantillas listas para usar en [06-Runbooks]({{< param "repoURL" >}}toolkit/06-Runbooks): una de MOP y otra de post mortem. También puedes descargarlas desde [Herramientas]({{< relref "/herramientas" >}}).

Tres costumbres que la mantienen viva: documenta **mientras** haces el cambio, no «luego»; pon fecha y autor en cada documento; y guárdala en un sitio que siga accesible si caen los servidores (por ejemplo, una copia impresa o exportada del procedimiento de recuperación, junto al sobre de emergencia).

{{< pregunta texto="¿Qué documento describe un cambio planificado, cómo comprobarlo y cómo volver atrás?" respuesta="mop|plan de cambio|el mop|plan de cambios|un mop|method of procedure" >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Escribe tu primer procedimiento" %}}
Vas a juntar todo el módulo en un documento. Escribe un procedimiento de restauración de la copia que hiciste en la primera sala, pensado para alguien que nunca ha tocado tu laboratorio:

1. **Qué** restaura y en qué equipo está el repositorio (Ubuntu, `192.168.50.20`, `/srv/copias`).
2. **Con qué credenciales**: «contraseña del repositorio en el gestor, entrada *restic laboratorio*». Nunca la contraseña en el documento.
3. **Los comandos exactos**, en orden, y dónde quedan los ficheros restaurados.
4. **Cómo comprobar** que la restauración fue bien.
5. **Fecha, autor y la última vez que se probó.**

Después, pide a alguien (o a ti mismo dentro de una semana) que lo siga sin ayuda. Lo que no entienda es lo que falta escribir.

Escribe el procedimiento, guarda la contraseña del repositorio en tu gestor y marca la tarea.
{{% /tarea %}}
