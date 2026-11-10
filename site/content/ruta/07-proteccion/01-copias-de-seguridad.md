---
title: "Copias de seguridad que se pueden restaurar"
description: "Decide cuánto puedes perder y cuánto puedes tardar, elige el tipo de copia, protégela del ransomware y comprueba que de verdad recuperas los datos."
weight: 1
equipo: "disco"
duracion: "60 min"
nivel: "Inicial"
objetivos:
  - "Explicar el RPO y el RTO con palabras sencillas y usarlos para decidir la frecuencia de las copias."
  - "Distinguir copia completa, incremental y diferencial."
  - "Aplicar la regla 3-2-1 y su extensión 3-2-1-1-0 contra el ransomware."
  - "Hacer una copia en tu laboratorio, borrar un fichero y restaurarlo."
requisitos:
  - "Módulo 2 (sistemas operativos): salas «Windows Server: primeros pasos» y «Linux para administradores»"
  - "Módulo 3, sala «¿Qué hay en una infraestructura?»"
---

{{% tarea n="1" titulo="Cuánto puedes perder y cuánto puedes tardar" %}}
Antes de elegir un programa de copias hay que responder a dos preguntas de negocio. Tienen nombre propio:

| Siglas | En inglés | Pregunta que responde | Ejemplo |
| --- | --- | --- | --- |
| **RPO** | Recovery Point Objective (punto de recuperación) | ¿Cuántos datos, medidos en tiempo, podemos permitirnos **perder**? | «Como mucho, el trabajo de las últimas 24 horas». |
| **RTO** | Recovery Time Objective (tiempo de recuperación) | ¿Cuánto tiempo podemos estar **sin el servicio** hasta que vuelva a funcionar? | «El ERP tiene que volver en menos de 4 horas». |

El RPO decide **cada cuánto copias**: si haces una copia cada noche, en el peor caso pierdes casi un día de trabajo. El RTO decide **cómo copias y dónde guardas**: restaurar 2 TB desde una nube lenta puede llevar días, aunque la copia esté perfecta.

No los decides tú solo: pregunta a cada responsable cuánto le duele perder datos y estar parado. Un servidor de ficheros y un ERP rara vez tienen los mismos objetivos.

Pulsa cada etapa para verlos sobre un incidente real:

{{< evolucion datos="rpo-rto" >}}

{{< aviso titulo="La distinción que importa" >}}
**RPO mira hacia atrás** (los datos que pierdes desde la última copia). **RTO mira hacia delante** (el tiempo que tardas en volver a estar en marcha). Una copia cada hora da un RPO bajo, pero si restaurarla lleva dos días, el RTO sigue siendo malo.
{{< /aviso >}}

{{< pregunta texto="¿Qué objetivo indica cuántos datos, medidos en tiempo, se pueden perder: el RPO o el RTO?" respuesta="rpo|el rpo" pista="El que mira hacia atrás, hasta la última copia." >}}
{{% /tarea %}}

{{% tarea n="2" titulo="Completa, incremental y diferencial" %}}
No hace falta copiarlo todo cada vez. Hay tres tipos de copia:

| Tipo | Qué copia | Ventaja | Inconveniente |
| --- | --- | --- | --- |
| **Completa** | Todo, siempre. | Restaurar es lo más sencillo: un solo juego de copia. | Tarda más y ocupa más. |
| **Incremental** | Solo lo que cambió desde la **última copia de cualquier tipo**. | Cada copia es rápida y pequeña. | Para restaurar necesitas la completa **y todas** las incrementales posteriores, en orden. |
| **Diferencial** | Lo que cambió desde la **última copia completa**. | Para restaurar necesitas solo la completa y la última diferencial. | Cada día ocupa un poco más, hasta la siguiente completa. |

Ejemplo con una completa el domingo: si el jueves necesitas restaurar, con incrementales usas domingo + lunes + martes + miércoles; con diferenciales, domingo + miércoles.

Pulsa cada etapa para ver la semana entera:

{{< evolucion datos="tipos-copia" >}}

Muchos programas actuales (Veeam, restic, Borg y similares, por poner ejemplos) hacen copias «incrementales para siempre» con deduplicación: solo guardan los bloques nuevos, pero cada punto de restauración se ve como si fuera completo. La idea de fondo sigue siendo la misma.

{{< pregunta texto="¿Qué tipo de copia guarda solo lo que cambió desde la última copia completa?" respuesta="diferencial|la diferencial|copia diferencial" >}}
{{% /tarea %}}

{{% tarea n="3" titulo="De 3-2-1 a 3-2-1-1-0: copias que sobreviven al ransomware" %}}
En el módulo 3 viste la regla **3-2-1**: **3** copias de los datos (contando el original), en **2** soportes distintos y **1** fuera de la oficina. Protege contra averías, borrados e incendios.

El **ransomware** (programas que cifran tus datos y piden un rescate) cambió las reglas: si el atacante consigue credenciales de administrador, busca el repositorio de copias y lo cifra o lo borra antes de atacar. Por eso hoy se usa la extensión **3-2-1-1-0**:

| Número | Significado |
| --- | --- |
| **3** | Tres copias de los datos. |
| **2** | En dos soportes distintos (disco del servidor, NAS, cinta, nube…). |
| **1** | Una fuera de la oficina. |
| **1** | Una **inmutable** (nadie puede modificarla ni borrarla hasta que caduque) o **desconectada** (offline: una cinta o un disco que se guarda desenchufado). |
| **0** | **Cero errores** al verificar las copias y en las pruebas de restauración. |

Dos errores muy habituales que no son copias de seguridad:

- **El RAID**: protege contra la avería de un disco, pero si alguien borra un fichero o el ransomware lo cifra, el RAID replica el daño al instante.
- **Las instantáneas (snapshots) de las VM**: viven en el mismo almacenamiento que la máquina. Si cae la cabina, caen con ella. Úsalas antes de un cambio, no como copia.

Y un detalle clave: el repositorio de copias **no debe aceptar las credenciales del dominio**. Si la misma cuenta que entra en los servidores entra en las copias, el ransomware también.

{{< pregunta texto="En 3-2-1-1-0, ¿qué significa el 0?" respuesta="cero errores|0 errores|ningun error|ninguno|sin errores|errores cero|cero fallos|sin fallos" pista="Tiene que ver con verificar y probar las restauraciones." >}}
{{% /tarea %}}

{{% tarea n="4" titulo="Pruébalo en tu laboratorio: copia, borra y restaura" %}}
Vas a hacer una copia en tu Ubuntu (`192.168.50.20`) con **restic**, un programa libre que cifra y deduplica. Conéctate por SSH y prepara unos datos de prueba:

```
mkdir -p ~/datos
echo "Informe trimestral" > ~/datos/informe.txt
echo "Lista de proveedores" > ~/datos/proveedores.txt
sudo apt install restic
```

Crea el repositorio de copias. restic te pedirá una contraseña: **guárdala en tu gestor de contraseñas**, porque sin ella la copia es irrecuperable (lo verás en la sala 4).

```
sudo mkdir -p /srv/copias && sudo chown $USER /srv/copias
restic init --repo /srv/copias
restic -r /srv/copias backup ~/datos
restic -r /srv/copias snapshots
```

Ahora simula el desastre y restaura en una carpeta aparte, para no pisar nada:

```
rm ~/datos/informe.txt
restic -r /srv/copias restore latest --target ~/restaurado
cat ~/restaurado/home/$USER/datos/informe.txt
```

Si ves «Informe trimestral», has recuperado el fichero. Ojo: en el laboratorio la copia está en el mismo disco que los datos, lo que incumple la regla 3-2-1. En una empresa, el repositorio estaría en otro equipo y habría una segunda copia fuera.

¿Prefieres Windows? En `SRV-DC01` añade un segundo disco a la VM, inicialízalo y dale formato con la letra `E:` (en **Administración de discos**), crea la carpeta `C:\Datos` con un par de ficheros e instala **Copias de seguridad de Windows Server**:

```
Install-WindowsFeature Windows-Server-Backup
wbadmin start backup -backupTarget:E: -include:C:\Datos -quiet
wbadmin get versions
```

Para restaurar, usa el asistente **Recuperar** de `wbadmin.msc` y elige restaurar el fichero en otra ubicación.

Haz la copia, borra el fichero, restáuralo y marca la tarea.
{{% /tarea %}}

{{% tarea n="5" titulo="Una copia que no se ha probado no es una copia" %}}
Que el programa diga «Correcto» solo significa que **escribió** algo. Saber que puedes **recuperarlo** exige restaurar de verdad. Un plan razonable:

| Prueba | Frecuencia orientativa | Qué compruebas |
| --- | --- | --- |
| Restaurar una muestra de ficheros | Mensual | Que los datos se leen y están completos. |
| Restaurar una VM entera en una red aislada | Trimestral o semestral | Que arranca y que el servicio funciona. |
| Restauración completa de un servicio crítico | Anual | Que cumples el **RTO** pactado, cronómetro en mano. |

Además, vigila cada día: el resultado de los trabajos y las **horas desde la última copia correcta**. Si un servidor lleva más de un día sin copia buena, algo va mal aunque nadie se haya quejado. Y cada vez que des de alta una VM nueva, comprueba que entra en el plan de copias.

Apunta cada prueba (fecha, qué restauraste, cuánto tardaste, problemas encontrados). Ese registro es lo que demuestra que se cumple el **0** de 3-2-1-1-0.

{{< pregunta texto="¿Qué objetivo compruebas cronometrando una restauración completa: el RPO o el RTO?" respuesta="rto|el rto" >}}
{{% /tarea %}}
