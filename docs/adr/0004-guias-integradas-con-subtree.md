# 0004 · Guías de switching integradas con git subtree

- Estado: aceptada (2026-10-30)

## Contexto

Las guías de switching (Manuales) son un proyecto propio, con su repo `Absolute-Beginners-IT/guias`, que puede seguir evolucionando por su cuenta. A la vez tienen que formar parte de esta web, dentro de la aplicación, junto al mapa y al modo «Mi infraestructura».

## Decisión

Se integran en `guias/` con `git subtree` (historial comprimido). Su repo no se toca. Se despliegan dentro de la aplicación, en `app.example.com/guias/`, con su propio build: un único `index.html` con rutas relativas.

Los cambios en las guías se hacen en su repo y se traen aquí con:

```bash
git subtree pull --prefix=guias https://github.com/Absolute-Beginners-IT/guias.git main --squash
```

## Por qué no otras opciones

- Submódulo de git: obliga a clonar con `--recursive` y a fijar commits a mano; es fácil acabar con una carpeta vacía.
- Fusionar el código de las dos aplicaciones ya: son semanas de trabajo antes de saber si la web tiene uso, y rompería la posibilidad de desarrollar las guías por separado.

## Consecuencias

- Una sola web y un solo repo para desplegar, sin dependencias entre los dos códigos.
- Dos aplicaciones con su propio aspecto: la cabecera y el aviso de prototipo se tienen que mantener coherentes a mano.
- Editar `guias/` directamente en este repo provoca conflictos en el siguiente `subtree pull`: los cambios van primero a su repo.
