---
title: "{{ replace .File.ContentBaseName "-" " " | strings.TrimLeft "0123456789 " | title }}"
description: ""
weight: 1
equipo: "servidor"  # icono: libro, portatil, router, servidor, terminal, switch, usuarios, disco, firewall, wifi, nube, capas, sai, escudo, llave, grafica, bandera
duracion: "20 min"
nivel: "Inicial"
objetivos:
  - ""
requisitos:
  - ""
draft: true
---

<!-- Plantilla de sala (formato de docs/metodologia). Cada tarea: explicación corta + una pregunta comprobable.
     Las respuestas válidas se separan con "|"; escribe al menos una variante sin tildes. -->

{{% tarea n="1" titulo="La idea básica" %}}
Qué problema resuelve y un esquema sencillo.

{{< aviso titulo="La distinción que importa" >}}
El matiz que un junior suele confundir.
{{< /aviso >}}

{{< pregunta texto="Pregunta que se responde con lo explicado arriba" respuesta="respuesta|variante" pista="Dónde mirar" >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Pruébalo en tu laboratorio" %}}
Pasos concretos. Las tareas sin pregunta se completan con el botón.
{{% /tarea %}}
