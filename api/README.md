# api.example.com (futuro)

Esta carpeta está reservada. **No hay backend todavía** y no hace falta: ver [docs/adr/0002-sin-api-por-ahora.md](../docs/adr/0002-sin-api-por-ahora.md).

## Cuándo crearla

- El alumno quiere su progreso en varios dispositivos.
- Un mentor revisa el trabajo de sus alumnos.
- Un equipo comparte un inventario.

## Contrato de partida

La app ya habla con un puerto (`app/src/ports/InventoryRepository.ts`). La primera versión de la API solo tiene que cubrirlo:

| Método | Ruta | Equivale a |
| --- | --- | --- |
| `GET` | `/inventario` | `list()` |
| `PUT` | `/inventario/{id}` | `save(device)` |
| `DELETE` | `/inventario/{id}` | `remove(id)` |

## Reglas que aplicar desde el primer día

- Identidad y autorización comprobadas en cada operación del servidor, nunca solo en la app.
- CORS limitado a `https://app.example.com`. CORS no sustituye a la autorización.
- Límite de peticiones y validación de entradas.
- PostgreSQL y el broker de colas en red privada, nunca expuestos a Internet.
- Copias de seguridad externas y pruebas de restauración.
- Los inventarios contienen IPs y topología: trátalos como datos sensibles.
