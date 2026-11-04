import type { InventorySwitch } from '../planner/inventoryImport'

interface DevicePickerProps {
  /** Every switch of the inventory kept in this browser; with none, the picker is not shown. */
  inventory: InventorySwitch[]
  /** The inventory switches whose model fits this runbook. */
  devices: InventorySwitch[]
  value: string
  onChange: (deviceId: string) => void
  /** Labels of the params a device can fill in this runbook. */
  fillable: string[]
  /** Labels the chosen device filled, once one is chosen. */
  filled?: string[]
}

const quoted = (labels: string[]) => {
  const items = labels.map((label) => `«${label}»`)
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : (items[0] ?? '')
}

function hint(fillable: string[], device: InventorySwitch | undefined, filled: string[] | undefined): string {
  if (device && filled) {
    return filled.length > 0
      ? `Puesto desde ${device.nombre}: ${quoted(filled)}. El resto lo escribes tú.`
      : `${device.nombre} no tiene datos que sirvan en esta guía: escríbelos tú.`
  }
  return fillable.length > 0
    ? `Del equipo que elijas se toman estos datos, si los tiene: ${quoted(fillable)}; el resto lo escribes tú.`
    : 'En esta guía el equipo no aporta ningún dato: escríbelos tú.'
}

/** Fills a runbook with a switch of «Mi infraestructura», the website's inventory kept in this browser. */
export function DevicePicker({ inventory, devices, value, onChange, fillable, filled }: DevicePickerProps) {
  if (inventory.length === 0) return null
  if (devices.length === 0) return <p className="muted">En tu inventario no hay switches de este modelo.</p>

  const device = devices.find((item) => item.id === value)
  return (
    <div className="field device-picker">
      <label htmlFor="device-picker">Rellenar con un equipo de mi infraestructura</label>
      <select id="device-picker" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Ninguno, lo escribo yo</option>
        {devices.map((item) => (
          <option key={item.id} value={item.id}>
            {item.ip?.trim() ? `${item.nombre} (${item.ip.trim()})` : item.nombre}
          </option>
        ))}
      </select>
      <p className="muted">{hint(fillable, device, filled)}</p>
    </div>
  )
}
