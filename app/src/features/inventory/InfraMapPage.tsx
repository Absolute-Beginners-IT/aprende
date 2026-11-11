import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, applyNodeChanges, useReactFlow,
  type AriaLabelConfig, type Connection as FlowConnection, type EdgeChange, type NodeChange, type NodePositionChange, type NodeSelectionChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Device, LinkType, Position } from '../../domain/types';
import type { InventoryRepository } from '../../ports/InventoryRepository';
import { analyzeInventory } from '../../domain/inventoryAnalysis';
import {
  GRID, arrangeByTiers, connectDevices, connectionsOf, drawnLinks, groupBoxes, layoutDevices, linkName, linkTypesIn, moveDevice,
  newDevice, placeUnplaced, routeEdges, tierLabels,
} from '../../domain/infraMap';
import { typeOf } from '../../content';
import { useInventory } from './useInventory';
import { DeviceNode, type DeviceNodeType } from './DeviceNode';
import { InfraEdge, type InfraEdgeType } from './InfraEdge';
import { GroupBoxNode, TierLabelNode, type GroupBoxNodeType, type TierLabelNodeType } from './MapDecorations';
import { MapLegend, loadHiddenLines, saveHiddenLines } from './MapLegend';
import { DevicePalette, PALETTE_DRAG_TYPE } from './DevicePalette';
import { DeviceInspector, InventoryOverview } from './DeviceInspector';

type MapNode = DeviceNodeType | GroupBoxNodeType | TierLabelNodeType;

const nodeTypes = { device: DeviceNode, groupBox: GroupBoxNode, tierLabel: TierLabelNode };
const edgeTypes = { infra: InfraEdge };
/** Decorations stay behind the devices and take no gesture, focus or selection. */
const DECORATION = { draggable: false, selectable: false, focusable: false, connectable: false, deletable: false, zIndex: -1 } as const;
// A small inventory is shown at its real size instead of blown up to fill the canvas.
const FIT_VIEW = { padding: 0.2, maxZoom: 1 };
/** Rough size of a device on the map, to centre a new one on the spot where it is added. */
const NODE_SIZE = { width: 160, height: 64 } as const;

const DIRECTION: Record<string, string> = { up: 'arriba', down: 'abajo', left: 'la izquierda', right: 'la derecha' };
const ARIA_LABELS: Partial<AriaLabelConfig> = {
  'node.a11yDescription.default': 'Pulsa Intro o Espacio para seleccionar el equipo y abrir su ficha.',
  'node.a11yDescription.keyboardDisabled': 'Pulsa Intro o Espacio para seleccionar el equipo y abrir su ficha. Después puedes moverlo con las flechas.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) => `Equipo movido hacia ${DIRECTION[direction] ?? direction}. Nueva posición: x ${x}, y ${y}.`,
  'edge.a11yDescription.default': 'Pulsa Intro o Espacio para seleccionar la conexión y Supr para quitarla.',
  'controls.ariaLabel': 'Controles del mapa',
  'controls.zoomIn.ariaLabel': 'Acercar',
  'controls.zoomOut.ariaLabel': 'Alejar',
  'controls.fitView.ariaLabel': 'Ver todo el mapa',
  'handle.ariaLabel': 'Punto de conexión',
};

const isSelection = (c: NodeChange<DeviceNodeType>): c is NodeSelectionChange => c.type === 'select';
const isDrop = (c: NodeChange<DeviceNodeType>): c is NodePositionChange => c.type === 'position' && c.dragging === false && !!c.position;
const changedId = (c: NodeChange<MapNode>) => ('id' in c ? c.id : c.item.id);

/** The first spot around `center`, ring by ring on the map grid, that no device covers. */
function freeSpot(center: Position, taken: Position[]): Position {
  const clear = (p: Position) => taken.every(t => Math.abs(t.x - p.x) >= GRID.col * 0.9 || Math.abs(t.y - p.y) >= GRID.row * 0.9);
  for (let ring = 0; ring < 12; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const spot = { x: center.x + dx * GRID.col, y: center.y + dy * GRID.row };
        if (clear(spot)) return spot;
      }
    }
  }
  return center;
}

/** «Mi infraestructura» as a map: the inventory drawn as devices joined by their links, edited with the mouse. */
export function InfraMapPage({ repository }: { repository: InventoryRepository }) {
  return <ReactFlowProvider><InfraMap repository={repository} /></ReactFlowProvider>;
}

function InfraMap({ repository }: { repository: InventoryRepository }) {
  const { topology, devices, loaded, message, setMessage, persist } = useInventory(repository);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const canvas = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<DeviceNodeType[]>([]);
  const [pickedEdges, setPickedEdges] = useState<ReadonlySet<string>>(new Set());
  const [hiddenLines, setHiddenLines] = useState<LinkType[]>(loadHiddenLines);
  const [confirmingArrange, setConfirmingArrange] = useState(false);

  const byId = useMemo(() => new Map(devices.map(d => [d.id, d])), [devices]);
  const nameOf = (id: string) => byId.get(id)?.nombre ?? id;
  const findings = useMemo(() => analyzeInventory(topology, new Date()), [topology]);
  const selected = selectedId ? byId.get(selectedId) : undefined;

  // React Flow keeps the measured size on each node: rebuild them from the inventory without losing it.
  useEffect(() => {
    const positions = layoutDevices(topology);
    setNodes(prev => {
      const old = new Map(prev.map(n => [n.id, n]));
      return devices.map(d => ({
        ...old.get(d.id), id: d.id, type: 'device', position: positions.get(d.id)!, data: { device: d },
        selected: d.id === selectedId, deletable: false, ariaLabel: d.nombre,
      }));
    });
  }, [topology]);
  useEffect(() => setNodes(ns => ns.map(n => (n.selected === (n.id === selectedId) ? n : { ...n, selected: n.id === selectedId }))), [selectedId]);

  // Boxes, tier names and lines follow the devices where they are shown right now, so they move along while dragging.
  const decorations = useMemo((): MapNode[] => {
    const shown = new Map(nodes.map(n => [n.id, n]));
    const rectOf = (id: string) => {
      const n = shown.get(id);
      return n && { ...n.position, width: n.measured?.width ?? NODE_SIZE.width, height: n.measured?.height ?? NODE_SIZE.height };
    };
    const boxes: GroupBoxNodeType[] = groupBoxes(topology, rectOf).map(box => ({
      ...DECORATION, id: `box:${box.id}`, type: 'groupBox', position: { x: box.x, y: box.y }, width: box.width, height: box.height,
      data: { nombre: box.nombre, label: `${box.nombre}: ${box.miembros.map(nameOf).join(', ')}` },
    }));
    const tiers: TierLabelNodeType[] = tierLabels(devices, new Map(nodes.map(n => [n.id, n.position]))).map(tier => ({
      ...DECORATION, id: `tier:${tier.id}`, type: 'tierLabel', position: { x: tier.x, y: tier.y }, data: { nombre: tier.nombre },
    }));
    return [...tiers, ...boxes];
  }, [topology, nodes]);
  const flowNodes = useMemo(() => [...decorations, ...nodes], [decorations, nodes]);

  const edges = useMemo((): InfraEdgeType[] => {
    // Lines are routed by the centre of each device as shown now, so devices of different widths order their lines right.
    const centres = new Map(nodes.map(n => [n.id, {
      x: n.position.x + (n.measured?.width ?? NODE_SIZE.width) / 2, y: n.position.y + (n.measured?.height ?? NODE_SIZE.height) / 2,
    }]));
    const visible = drawnLinks(topology).filter(l => !hiddenLines.includes(l.tipo));
    const routes = routeEdges(visible, id => centres.get(id));
    return visible.map(l => {
      const route = routes.get(l.id)!;
      return {
        id: l.id, type: 'infra', source: route.source, sourceHandle: route.sourceHandle, target: route.target, targetHandle: route.targetHandle,
        selected: pickedEdges.has(l.id), className: `infra-edge infra-edge--${l.tipo}`, ariaLabel: linkName(l, nameOf), data: { link: l, route },
      };
    });
  }, [topology, nodes, hiddenLines, pickedEdges]);
  const linkTypes = useMemo(() => linkTypesIn(topology), [topology]);

  const toggleLines = (tipo: LinkType, show: boolean) => {
    const next = show ? hiddenLines.filter(t => t !== tipo) : [...hiddenLines.filter(t => t !== tipo), tipo];
    setHiddenLines(next);
    saveHiddenLines(next);
  };

  // Every write starts from what is stored right now, so quick successive edits never overwrite each other with stale copies.
  const edit = async (id: string, change: (d: Device) => Device | null) => {
    const current = (await repository.load()).equipos.find(d => d.id === id);
    const next = current && change(current);
    if (next) await repository.apply({ saveDevices: [next] });
  };

  // The selection is ours (it opens the ficha); nodes are deleted only from the ficha, never with the keyboard.
  const onNodesChange = (all: NodeChange<MapNode>[]) => {
    // Boxes and tier names are worked out from the devices: only changes to devices count.
    const changes = all.filter(c => byId.has(changedId(c))) as NodeChange<DeviceNodeType>[];
    const selection = changes.filter(isSelection);
    const chosen = selection.find(c => c.selected);
    if (chosen) setSelectedId(chosen.id);
    else if (selection.some(c => c.id === selectedId)) setSelectedId(null);
    // Only real changes touch the nodes: a new array for nothing would redraw the decorations and measure them again, forever.
    const applied = changes.filter(c => c.type !== 'select' && c.type !== 'remove');
    if (applied.length) setNodes(ns => applyNodeChanges(applied, ns));
    // A drag that ends or a move with the arrow keys leaves the device in its new place.
    const moved = changes.filter(isDrop).filter(c => {
      const stored = byId.get(c.id)?.posicion;
      return Math.round(c.position!.x) !== stored?.x || Math.round(c.position!.y) !== stored?.y;
    });
    if (moved.length) void persist(async () => {
      // Devices still placed by the map are pinned where they are, or the move would make them reflow onto each other.
      // Pins and moves go in one write, so a full storage never leaves the move half saved.
      const current = await repository.load();
      const changed = new Map(placeUnplaced(current).map(d => [d.id, d]));
      for (const c of moved) {
        const device = changed.get(c.id) ?? current.equipos.find(d => d.id === c.id);
        if (device) changed.set(c.id, moveDevice(device, c.position!));
      }
      await repository.apply({ saveDevices: [...changed.values()] });
    }, '');
  };

  // Lines are worked out from the links; only which ones are selected is kept here. A removal goes through onEdgesDelete.
  const onEdgesChange = (changes: EdgeChange<InfraEdgeType>[]) => setPickedEdges(prev => {
    const next = new Set(prev);
    for (const c of changes) if (c.type === 'select') { if (c.selected) next.add(c.id); else next.delete(c.id); }
    return next.size === prev.size && [...next].every(id => prev.has(id)) ? prev : next;
  });

  // Every device by tiers, the ones the user placed included, in one write: only after the learner confirms it.
  const arrange = async () => {
    setConfirmingArrange(false);
    const ok = await persist(async () => {
      await repository.apply({ saveDevices: arrangeByTiers(await repository.load()) });
    }, 'Equipos colocados por capas.');
    if (ok) setTimeout(() => void fitView(FIT_VIEW));
  };

  const onConnect = ({ source, target }: FlowConnection) => {
    const to = byId.get(target);
    if (!to || !byId.has(source)) return;
    // The dragged device hangs from the one it is dropped on, unless the pair is already joined that way.
    void persist(async () => {
      const link = connectDevices(await repository.load(), source, target);
      if (link) await repository.apply({ addLinks: [link] });
    }, `${nameOf(source)} conectado a ${to.nombre}.`);
  };

  /** Removes the given links in one write; `between` names the two devices of each one for the message. */
  const disconnect = (links: { id: string; between: [string, string] }[]) => {
    const success = links.length === 1 ? `Conexión entre ${nameOf(links[0].between[0])} y ${nameOf(links[0].between[1])} quitada.` : `${links.length} conexiones quitadas.`;
    void persist(() => repository.apply({ removeLinks: links.map(l => l.id) }), success);
  };

  const add = async (tipoId: string, at?: Position) => {
    const tipo = typeOf(tipoId);
    let spot = at;
    if (!spot) {
      const rect = canvas.current?.getBoundingClientRect();
      const center = screenToFlowPosition({ x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2, y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2 });
      spot = freeSpot({ x: center.x - NODE_SIZE.width / 2, y: center.y - NODE_SIZE.height / 2 }, nodes.map(n => n.position));
    }
    let added: Device | undefined;
    const ok = await persist(async () => {
      added = newDevice(tipo.id, tipo.nombre, (await repository.load()).equipos, spot);
      await repository.apply({ saveDevices: [added] });
    }, () => `${added!.nombre} añadido.`);
    if (ok && added) setSelectedId(added.id);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const tipo = e.dataTransfer.getData(PALETTE_DRAG_TYPE);
    if (!tipo) return;
    e.preventDefault();
    const at = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    void add(tipo, { x: at.x - NODE_SIZE.width / 2, y: at.y - NODE_SIZE.height / 2 });
  };

  const update = (d: Device, change: (d: Device) => Device) => persist(() => edit(d.id, change), `${change(d).nombre} actualizado.`);
  const rename = (d: Device, nombre: string) => {
    if (devices.some(o => o.id !== d.id && o.nombre.toLowerCase() === nombre.toLowerCase())) {
      setMessage(`Ya existe un equipo llamado ${nombre}.`);
      return Promise.resolve(false);
    }
    return update(d, current => ({ ...current, nombre }));
  };
  const remove = async (d: Device) => {
    // The device, its links and its place in any group go in one write: never a half-deleted device.
    const removed = await persist(() => repository.apply({ removeDevices: [d.id] }), `${d.nombre} borrado.`);
    if (removed) setSelectedId(null);
  };

  // One entry per link of the selected device, named after the device at its other end.
  const connections = selected
    ? connectionsOf(topology).filter(c => c.from === selected.id || c.to === selected.id)
      .map(c => ({ id: c.id, other: c.from === selected.id ? c.to : c.from })).map(c => ({ ...c, nombre: nameOf(c.other) }))
    : [];

  return (
    <section className="infra-map">
      <p className="notice">Tu inventario se guarda <b>solo en este navegador</b>: no se envía a ningún servidor. Si borras los datos del navegador, se pierde, así que expórtalo de vez en cuando desde <a href="#mi-infraestructura/lista">Lista</a>.</p>
      {message && <p className="muted" role="status">{message}</p>}
      <div className="infra-workspace">
        <DevicePalette onAdd={tipo => void add(tipo)} />
        <div className="infra-stage">
          <div className="infra-toolbar">
            {confirmingArrange ? (
              <div className="infra-confirm" role="group" aria-label="Confirmar la colocación por capas">
                <span>Todos los equipos se colocarán por capas y se perderá la posición que hayas dado a cada uno. ¿Quieres seguir?</span>
                <button type="button" onClick={() => void arrange()}>Sí, colocar por capas</button>
                <button type="button" onClick={() => setConfirmingArrange(false)}>Cancelar</button>
              </div>
            ) : <button type="button" disabled={devices.length === 0} onClick={() => setConfirmingArrange(true)}>Colocar por capas</button>}
          </div>
          <section className="infra-canvas" aria-label="Mapa de tu infraestructura" ref={canvas}
            onDragOver={e => { if (e.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={onDrop}>
            <ReactFlow<MapNode, InfraEdgeType> nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
              onNodeClick={(_, node) => { if (node.type === 'device') setSelectedId(node.id); }}
              onEdgesDelete={es => disconnect(es.flatMap(e => (e.data ? [{ id: e.id, between: [e.data.link.a.equipo, e.data.link.b.equipo] as [string, string] }] : [])))}
              deleteKeyCode={['Backspace', 'Delete']} fitView fitViewOptions={FIT_VIEW} minZoom={0.2} ariaLabelConfig={ARIA_LABELS}>
              <Background variant={BackgroundVariant.Dots} gap={20} />
              <Controls showInteractive={false} fitViewOptions={FIT_VIEW} />
            </ReactFlow>
            {loaded && devices.length === 0 && (
              <div className="infra-empty">
                <p><b>Tu mapa está vacío.</b> Pulsa un tipo de equipo en la paleta para añadir el primero, o importa tu inventario en CSV desde <a href="#mi-infraestructura/lista">Lista</a>.</p>
              </div>
            )}
          </section>
          <MapLegend types={linkTypes} hidden={hiddenLines} onToggle={toggleLines} />
        </div>
        {selected ? (
          <DeviceInspector key={selected.id} device={selected} connections={connections} findings={findings.filter(f => f.deviceId === selected.id)}
            onChange={change => update(selected, change)} onRename={nombre => rename(selected, nombre)} onDisconnect={id => disconnect(connections.filter(c => c.id === id).map(c => ({ id, between: [selected.id, c.other] })))} onDelete={() => void remove(selected)} />
        ) : <InventoryOverview empty={devices.length === 0} findings={findings} />}
      </div>
    </section>
  );
}
