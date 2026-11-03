import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, applyEdgeChanges, applyNodeChanges, useReactFlow,
  type AriaLabelConfig, type Connection as FlowConnection, type Edge, type EdgeChange, type NodeChange, type NodePositionChange, type NodeSelectionChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Device, Position } from '../../domain/types';
import type { InventoryRepository } from '../../ports/InventoryRepository';
import { analyzeInventory } from '../../domain/inventoryAnalysis';
import { GRID, connectDevices, connectionsOf, disconnectDevices, layoutDevices, moveDevice, placeUnplaced, newDevice, withoutDevice } from '../../domain/infraMap';
import { typeOf } from '../../content';
import { useInventory } from './useInventory';
import { DeviceNode, type DeviceNodeType } from './DeviceNode';
import { DevicePalette, PALETTE_DRAG_TYPE } from './DevicePalette';
import { DeviceInspector, InventoryOverview } from './DeviceInspector';

const nodeTypes = { device: DeviceNode };
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

/** «Mi infraestructura» as a map: the inventory drawn as devices joined by their uplinks, edited with the mouse. */
export function InfraMapPage({ repository }: { repository: InventoryRepository }) {
  return <ReactFlowProvider><InfraMap repository={repository} /></ReactFlowProvider>;
}

function InfraMap({ repository }: { repository: InventoryRepository }) {
  const { devices, loaded, message, setMessage, persist } = useInventory(repository);
  const { screenToFlowPosition } = useReactFlow();
  const canvas = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<DeviceNodeType[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const byId = useMemo(() => new Map(devices.map(d => [d.id, d])), [devices]);
  const nameOf = (id: string) => byId.get(id)?.nombre ?? id;
  const findings = useMemo(() => analyzeInventory(devices, new Date()), [devices]);
  const selected = selectedId ? byId.get(selectedId) : undefined;

  // React Flow keeps the measured size on each node: rebuild them from the inventory without losing it.
  useEffect(() => {
    const positions = layoutDevices(devices);
    setNodes(prev => {
      const old = new Map(prev.map(n => [n.id, n]));
      return devices.map(d => ({
        ...old.get(d.id), id: d.id, type: 'device', position: positions.get(d.id)!, data: { device: d },
        selected: d.id === selectedId, deletable: false, ariaLabel: d.nombre,
      }));
    });
    setEdges(prev => {
      const picked = new Set(prev.filter(e => e.selected).map(e => e.id));
      return connectionsOf(devices).map(c => ({ id: c.id, source: c.from, target: c.to, selected: picked.has(c.id), ariaLabel: `Conexión entre ${nameOf(c.from)} y ${nameOf(c.to)}` }));
    });
  }, [devices]);
  useEffect(() => setNodes(ns => ns.map(n => (n.selected === (n.id === selectedId) ? n : { ...n, selected: n.id === selectedId }))), [selectedId]);

  // Every write starts from what is stored right now, so quick successive edits never overwrite each other with stale copies.
  const edit = async (id: string, change: (d: Device) => Device | null) => {
    const current = (await repository.list()).find(d => d.id === id);
    const next = current && change(current);
    if (next) await repository.save(next);
  };

  // The selection is ours (it opens the ficha); nodes are deleted only from the ficha, never with the keyboard.
  const onNodesChange = (changes: NodeChange<DeviceNodeType>[]) => {
    const selection = changes.filter(isSelection);
    const chosen = selection.find(c => c.selected);
    if (chosen) setSelectedId(chosen.id);
    else if (selection.some(c => c.id === selectedId)) setSelectedId(null);
    setNodes(ns => applyNodeChanges(changes.filter(c => c.type !== 'select' && c.type !== 'remove'), ns));
    // A drag that ends or a move with the arrow keys leaves the device in its new place.
    const moved = changes.filter(isDrop).filter(c => {
      const stored = byId.get(c.id)?.posicion;
      return Math.round(c.position!.x) !== stored?.x || Math.round(c.position!.y) !== stored?.y;
    });
    if (moved.length) void persist(async () => {
      // Devices still placed by the map are pinned where they are, or the move would make them reflow onto each other.
      // Pins and moves go in one write, so a full storage never leaves the move half saved.
      const current = await repository.list();
      const changed = new Map(placeUnplaced(current).map(d => [d.id, d]));
      for (const c of moved) {
        const device = changed.get(c.id) ?? current.find(d => d.id === c.id);
        if (device) changed.set(c.id, moveDevice(device, c.position!));
      }
      await repository.saveAll([...changed.values()]);
    }, '');
  };

  const onEdgesChange = (changes: EdgeChange[]) => setEdges(es => applyEdgeChanges(changes, es));

  const onConnect = ({ source, target }: FlowConnection) => {
    const to = byId.get(target);
    if (!to || !byId.has(source)) return;
    void persist(() => edit(source, from => connectDevices(from, to)), `${nameOf(source)} conectado a ${to.nombre}.`);
  };

  const disconnect = (pairs: [string, string][]) => {
    const success = pairs.length === 1 ? `Conexión entre ${nameOf(pairs[0][0])} y ${nameOf(pairs[0][1])} quitada.` : `${pairs.length} conexiones quitadas.`;
    void persist(async () => {
      let current = await repository.list();
      const changed = new Map<string, Device>();
      for (const [a, b] of pairs) {
        for (const d of disconnectDevices(current, a, b)) { changed.set(d.id, d); current = current.map(x => (x.id === d.id ? d : x)); }
      }
      for (const d of changed.values()) await repository.save(d);
    }, success);
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
      added = newDevice(tipo.id, tipo.nombre, await repository.list(), spot);
      await repository.save(added);
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
    const removed = await persist(async () => {
      for (const u of withoutDevice(await repository.list(), d.id)) await repository.save(u);
      await repository.remove(d.id);
    }, `${d.nombre} borrado.`);
    if (removed) setSelectedId(null);
  };

  const connections = selected
    ? connectionsOf(devices).filter(c => c.from === selected.id || c.to === selected.id).map(c => (c.from === selected.id ? c.to : c.from)).map(id => ({ id, nombre: nameOf(id) }))
    : [];

  return (
    <section className="infra-map">
      <p className="notice">Tu inventario se guarda <b>solo en este navegador</b>: no se envía a ningún servidor. Si borras los datos del navegador, se pierde, así que expórtalo de vez en cuando desde <a href="#mi-infraestructura/lista">Lista</a>.</p>
      {message && <p className="muted" role="status">{message}</p>}
      <div className="infra-workspace">
        <DevicePalette onAdd={tipo => void add(tipo)} />
        <section className="infra-canvas" aria-label="Mapa de tu infraestructura" ref={canvas}
          onDragOver={e => { if (e.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={onDrop}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)} onEdgesDelete={es => disconnect(es.map(e => [e.source, e.target]))}
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
        {selected ? (
          <DeviceInspector key={selected.id} device={selected} connections={connections} findings={findings.filter(f => f.deviceId === selected.id)}
            onChange={change => update(selected, change)} onRename={nombre => rename(selected, nombre)} onDisconnect={other => disconnect([[selected.id, other]])} onDelete={() => void remove(selected)} />
        ) : <InventoryOverview empty={devices.length === 0} findings={findings} />}
      </div>
    </section>
  );
}
