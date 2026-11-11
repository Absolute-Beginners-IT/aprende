import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { Device } from '../../domain/types';
import { typeOf } from '../../content';

export type DeviceNodeType = Node<{ device: Device }, 'device'>;

/**
 * A device on the map, coloured by family. The dot on top joins it to the device it hangs from (a datos link);
 * the dot below receives the devices that hang from it.
 */
export function DeviceNode({ data: { device }, selected }: NodeProps<DeviceNodeType>) {
  const type = typeOf(device.tipo);
  const marcaModelo = [device.marca, device.modelo].filter(Boolean).join(' ');
  return (
    <div className={`infra-node fam-${type.familia}${selected ? ' selected' : ''}`}>
      <Handle type="source" position={Position.Top} />
      <span className="infra-node__name">{device.nombre}</span>
      <span className="infra-node__type">{type.nombre}</span>
      {marcaModelo && <span className="infra-node__model">{marcaModelo}</span>}
      <Handle type="target" position={Position.Bottom} />
    </div>
  );
}
