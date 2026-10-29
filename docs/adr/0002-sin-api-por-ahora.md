# 0002 · Sin API por ahora

- Estado: aceptada (2026-10-29)

## Contexto

La metodología incluye `api.example.com` para la lógica de negocio. Hoy la guía no tiene cuentas de usuario y el inventario del alumno cabe en su navegador.

## Decisión

No se construye la API. La app guarda los datos del alumno en `localStorage` a través del puerto `InventoryRepository`, de modo que añadir la API solo exige un adaptador nuevo.

## Cuándo revisarla

Cuando aparezca al menos una de estas necesidades: progreso del alumno en varios dispositivos, un mentor que revisa el trabajo de sus alumnos o inventarios compartidos por un equipo.

## Consecuencias

- Sin servidor que mantener, parchear ni vigilar, y sin datos sensibles de terceros (IPs, topologías) en nuestra infraestructura.
- Los datos del alumno se pierden si borra los datos del navegador; la app debe avisarlo y permitir exportarlos.
- Cuando llegue la API, aplican las reglas de la metodología: autorización en cada operación del servidor, CORS limitado a `app.example.com`, base de datos y broker en red privada y copias externas con pruebas de restauración.
