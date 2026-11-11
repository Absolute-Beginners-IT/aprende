import type { Node, NodeProps } from '@xyflow/react';

// What the map draws behind the devices: a box around each group of peers and the name of each tier. They are nodes
// that cannot be selected, moved or focused, so the devices on top keep every gesture and the keyboard order.

export type GroupBoxNodeType = Node<{ nombre: string; label: string }, 'groupBox'>;
export type TierLabelNodeType = Node<{ nombre: string }, 'tierLabel'>;

/** A labelled box around devices that work as one: a group, an HA pair or a stack. */
export function GroupBoxNode({ data: { nombre, label } }: NodeProps<GroupBoxNodeType>) {
  return (
    <div className="infra-group" role="group" aria-label={label}>
      <span className="infra-group__name">{nombre}</span>
    </div>
  );
}

/** The name of a tier at the left edge of the map. */
export function TierLabelNode({ data: { nombre } }: NodeProps<TierLabelNodeType>) {
  return <span className="infra-tier">{nombre}</span>;
}
