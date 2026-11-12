import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { Device } from '../../domain/types';
import { typeOf } from '../../content';

/**
 * `feeds` names what feeds the device over its power links (its regletas or SAIs), shown as a badge in the «Red» view;
 * `power` marks the «Energía» view, where every device has the same width so its short lines land on it.
 */
export type DeviceNodeType = Node<{ device: Device; feeds?: string[]; power?: boolean }, 'device'>;

/**
 * A device on the map, coloured by family. The dot on top joins it to the device it hangs from (a datos link);
 * the dot below receives the devices that hang from it. The anchors on the sides only hold HA and stack lines.
 * A device on one power feed shows its badge in the warning colour: if that feed fails, it goes off.
 */
export function DeviceNode({ data: { device, feeds, power }, selected }: NodeProps<DeviceNodeType>) {
  const type = typeOf(device.tipo);
  const marcaModelo = [device.marca, device.modelo].filter(Boolean).join(' ');
  return (
    <div className={`infra-node fam-${type.familia}${power ? ' infra-node--power' : ''}${selected ? ' selected' : ''}`}>
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" isConnectable={false} className="infra-node__anchor" />
      <span className="infra-node__name">{device.nombre}</span>
      <span className="infra-node__type">{type.nombre}</span>
      {marcaModelo && <span className="infra-node__model">{marcaModelo}</span>}
      {feeds && feeds.length > 0 && (
        <span className={`infra-node__power${feeds.length === 1 ? ' is-single' : ''}`}
          title={feeds.length === 1 ? `Se alimenta solo de ${feeds[0]}: si falla, se apaga.` : `Se alimenta de ${feeds.join(' y ')}.`}>
          ⚡ {feeds.join(' · ')}
        </span>
      )}
      <Handle type="source" position={Position.Right} id="right" isConnectable={false} className="infra-node__anchor" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
    </div>
  );
}
