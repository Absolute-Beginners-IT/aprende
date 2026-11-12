import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { Device } from '../../domain/types';

export type RegletaBarNodeType = Node<{ device: Device }, 'regletaBar'>;

/**
 * A regleta in the «Energía» view: a horizontal bar as wide as the devices it feeds (see `layoutPower`). The dot on top
 * joins it to the SAI that feeds it; the dot below receives the devices plugged into it. Clicking it opens its ficha.
 */
export function RegletaBarNode({ data: { device }, selected }: NodeProps<RegletaBarNodeType>) {
  return (
    <div className={`infra-bar${selected ? ' selected' : ''}`}>
      <Handle type="source" position={Position.Top} id="top" />
      <span className="infra-bar__name">{device.nombre}</span>
      <Handle type="target" position={Position.Bottom} id="bottom" />
    </div>
  );
}
