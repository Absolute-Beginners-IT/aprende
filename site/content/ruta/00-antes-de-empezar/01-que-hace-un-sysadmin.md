---
title: "Qué hace un administrador de sistemas"
description: "En qué consiste el trabajo, cómo está organizada esta ruta y la mentalidad con la que conviene empezar."
weight: 1
equipo: "libro"
duracion: "15 min"
nivel: "Inicial"
objetivos:
  - "Distinguir una incidencia de un cambio."
  - "Saber cómo funcionan las salas, las tareas y las preguntas de esta ruta."
  - "Conocer las reglas básicas antes de tocar una red real."
requisitos:
  - "Ninguno: empieza aquí"
---

{{% tarea n="1" titulo="El trabajo en una frase" %}}
Un administrador de sistemas **mantiene funcionando lo que la empresa usa para trabajar**: la red, los servidores, las cuentas de usuario, el correo, las copias de seguridad… y lo mejora sin romperlo.

En el día a día hay dos tipos de trabajo:

| Tipo | Qué es | Ejemplo |
| --- | --- | --- |
| Incidencia | Algo que funcionaba ha dejado de funcionar. Hay que restablecer el servicio cuanto antes. | «No puedo imprimir», «no hay Internet». |
| Cambio | Una modificación planificada: se prepara, se avisa y se puede deshacer. | Actualizar el firmware del firewall, crear una VLAN nueva. |

El tercer tipo, el **mantenimiento** (parches, revisar copias, renovar certificados), es lo que evita que las incidencias aparezcan.

{{< pregunta texto="Un usuario llama porque ayer imprimía y hoy no puede. ¿Es una incidencia o un cambio?" respuesta="incidencia|una incidencia" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Cómo funciona esta ruta" %}}
La ruta está pensada para seguirla **en orden**:

- **Módulos**: grandes bloques (redes, sistemas operativos, servicios…). Cada uno se apoya en el anterior.
- **Salas**: lecciones cortas dentro de un módulo, de 15 a 40 minutos.
- **Tareas**: cada sala se divide en tareas. Lee, haz lo que se pide y responde la pregunta.
- **Preguntas**: el campo muestra el formato de la respuesta, con un asterisco por carácter. Por ejemplo, `***` es una palabra de tres letras. Las mayúsculas y las tildes no importan.

Tu progreso se guarda **en tu navegador**: no hay cuentas ni se envía nada a ningún servidor.

{{< pregunta texto="¿Dónde se guarda tu progreso?" respuesta="en tu navegador|navegador|en el navegador|el navegador" pista="Está en el último párrafo de esta tarea." >}}
{{% /tarea %}}

{{% tarea n="3" titulo="La mentalidad correcta" %}}
Cuatro reglas que te ahorrarán disgustos:

1. **Entiende antes de copiar.** Si pegas un comando de Internet sin saber qué hace, el problema pasa a ser tuyo.
2. **Pide permiso.** Escanear una red, reiniciar un servidor o cambiar una regla del firewall en una empresa requiere autorización, aunque «solo sea mirar».
3. **Prueba primero en el laboratorio.** Lo que rompas allí no le importa a nadie.
4. **Documenta.** Lo que no está escrito, para el siguiente (o para ti dentro de seis meses) no existe.

{{< aviso titulo="La distinción que importa" >}}
Tener la contraseña de administrador no es lo mismo que tener permiso para usarla. El acceso técnico no sustituye a la autorización.
{{< /aviso >}}

{{< pregunta texto="¿Qué necesitas antes de escanear la red de una empresa?" respuesta="autorizacion|permiso|una autorizacion|autorizacion por escrito" >}}
{{% /tarea %}}
