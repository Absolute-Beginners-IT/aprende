import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import type { Link } from '../../domain/types';
import { edgeGeometry, type Route } from '../../domain/infraMap';

export type InfraEdgeType = Edge<{ link: Link; route: Route }, 'infra'>;

/** The text on a line: «LAG» for a LAG and the speed when it is known. */
export const edgeLabel = (link: Link) => [link.tipo === 'lag' ? 'LAG' : '', link.velocidad ?? ''].filter(Boolean).join(' · ');

/**
 * A link on the map as an orthogonal line; its style comes from the `infra-edge--<tipo>` class of the edge. Its route
 * (see `routeEdges`) gives each end its own spot on the side of its device and the line its own height to bend at,
 * so crossing links and links between the same pair never hide each other.
 */
export function InfraEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, interactionWidth }: EdgeProps<InfraEdgeType>) {
  const geometry = data ? edgeGeometry({ sourceX, sourceY, targetX, targetY }, data.route) : { sourceX, sourceY, targetX, targetY, label: { x: 0, y: 0 } };
  const [path] = getSmoothStepPath({ ...geometry, sourcePosition, targetPosition, borderRadius: 6 });
  const text = data ? edgeLabel(data.link) : '';
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={interactionWidth} />
      {text && (
        <EdgeLabelRenderer>
          <div className="infra-edge__label nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${geometry.label.x}px, ${geometry.label.y}px)` }}>{text}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
