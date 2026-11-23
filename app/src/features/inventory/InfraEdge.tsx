import type { CSSProperties } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import type { Link } from '../../domain/types';
import type { PowerRole } from '../../domain/topology';
import { edgeGeometry, powerLabel, type PowerEdge, type Route } from '../../domain/infraMap';

/**
 * `power` says which end of a power link is the outlet and which the power supply (see `powerEndRoles`). From «Capas»:
 * `color` of the picked VLAN when the line carries it, `flag` when a VLAN does not get through it, `ports` to label.
 */
export type InfraEdgeType = Edge<{ link: Link; route: Route; power?: { a: PowerRole; b: PowerRole }; color?: string; flag?: string; ports?: boolean }, 'infra'>;

/** The ports of a link as a label, such as «gi1/0/1 – 1/1/1»; '' when it has none. */
const portsLabel = (link: Link) => (link.a.puerto || link.b.puerto ? `${link.a.puerto ?? '?'} – ${link.b.puerto ?? '?'}` : '');

/** The text on a line: the outlet and power supply of a power link; otherwise «LAG» for a LAG and the speed when known. */
export const edgeLabel = (link: Link, power?: { a: PowerRole; b: PowerRole }) => (link.tipo === 'energia' && power
  ? powerLabel(link, power)
  : [link.tipo === 'lag' ? 'LAG' : '', link.velocidad ?? ''].filter(Boolean).join(' · '));

/**
 * A link on the map as an orthogonal line; its style comes from the `infra-edge--<tipo>` class of the edge. Its route
 * (see `routeEdges`) gives each end its own spot on the side of its device and the line its own height to bend at,
 * so crossing links and links between the same pair never hide each other.
 */
export function InfraEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, interactionWidth }: EdgeProps<InfraEdgeType>) {
  const geometry = data ? edgeGeometry({ sourceX, sourceY, targetX, targetY }, data.route) : { sourceX, sourceY, targetX, targetY, label: { x: 0, y: 0 } };
  const [path] = getSmoothStepPath({ ...geometry, sourcePosition, targetPosition, borderRadius: 6 });
  const text = data ? [edgeLabel(data.link, data.power), data.ports ? portsLabel(data.link) : ''].filter(Boolean).join(' · ') : '';
  const flag = data?.flag;
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={interactionWidth} style={data?.color ? { '--vlan-color': data.color } as CSSProperties : undefined} />
      {(text || flag) && (
        <EdgeLabelRenderer>
          <div className={`infra-edge__label nodrag nopan${flag ? ' has-gap' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${geometry.label.x}px, ${geometry.label.y}px)` }}>
            {flag && <span className="infra-edge__flag">⚠ {flag}</span>}{flag && text ? ' · ' : ''}{text}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/** A power link in the «Energía» view: `line` is where `layoutPower` put it; `power` says which end is the outlet. */
export type PowerLineEdgeType = Edge<{ link: Link; line: PowerEdge; power: { a: PowerRole; b: PowerRole } }, 'power'>;

/**
 * A power link in the «Energía» view: straight up from the device (or regleta) it feeds into its bar or SAI, or, when
 * the two ends are not one above the other, up to the height `layoutPower` gave it, sideways and up again. The x of
 * both ends come from the layout; the heights from the handles React Flow measures.
 */
export function PowerLineEdge({ id, sourceY, targetY, data, interactionWidth }: EdgeProps<PowerLineEdgeType>) {
  if (!data) return null;
  const { lowerX, upperX, bendY } = data.line;
  const bend = Math.min(Math.max(bendY, Math.min(sourceY, targetY)), Math.max(sourceY, targetY));
  const path = lowerX === upperX ? `M ${lowerX} ${sourceY} V ${targetY}` : `M ${lowerX} ${sourceY} V ${bend} H ${upperX} V ${targetY}`;
  const text = edgeLabel(data.link, data.power);
  const labelY = (sourceY + (lowerX === upperX ? targetY : bend)) / 2;
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={interactionWidth} />
      {text && (
        <EdgeLabelRenderer>
          <div className="infra-edge__label nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${lowerX}px, ${labelY}px)` }}>{text}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
