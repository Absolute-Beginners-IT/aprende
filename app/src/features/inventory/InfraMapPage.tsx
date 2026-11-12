import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, applyNodeChanges, useReactFlow,
  type AriaLabelConfig, type Connection as FlowConnection, type EdgeChange, type NodeChange, type NodePositionChange, type NodeSelectionChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Device, DeviceGroup, GroupType, Link, LinkType, Position } from '../../domain/types';
import type { InventoryRepository } from '../../ports/InventoryRepository';
import { analyzeInventory } from '../../domain/inventoryAnalysis';
import { LINK_TYPE_NAMES, groupOf, isPowerSupplier, powerEndRoles, powerFeedersOf } from '../../domain/topology';
import {
  BAR_HEIGHT, GRID, POWER_NODE, arrangeByTiers, connectDevices, connectionsOf, drawnLinks, editLink, groupBoxes, groupRefusal, layoutDevices, layoutPower,
  linkName, linkRefusal, linkTypesIn, moveDevice, newDevice, placeUnplaced, routeEdges, tierLabels, type LinkDraft, type LinkRefusal,
} from '../../domain/infraMap';
import { typeOf } from '../../content';
import { useInventory } from './useInventory';
import { DeviceNode, type DeviceNodeType } from './DeviceNode';
import { InfraEdge, PowerLineEdge, type InfraEdgeType, type PowerLineEdgeType } from './InfraEdge';
import { RegletaBarNode, type RegletaBarNodeType } from './RegletaBarNode';
import { MapViewTabs, loadMapView, saveMapView, type MapView } from './MapViewTabs';
import { GroupBoxNode, TierLabelNode, type GroupBoxNodeType, type TierLabelNodeType } from './MapDecorations';
import { MapLegend, loadHiddenLines, saveHiddenLines } from './MapLegend';
import { DevicePalette, PALETTE_DRAG_TYPE } from './DevicePalette';
import { DeviceInspector, InventoryOverview } from './DeviceInspector';
import { LinkInspector, NewLinkForm } from './LinkForms';
import { GroupPanel } from './GroupPanel';

/** What the learner works with on the map: devices and, in the «Energía» view, regletas drawn as bars. */
type ItemNode = DeviceNodeType | RegletaBarNodeType;
type MapNode = ItemNode | GroupBoxNodeType | TierLabelNodeType;
type MapEdge = InfraEdgeType | PowerLineEdgeType;

const nodeTypes = { device: DeviceNode, regletaBar: RegletaBarNode, groupBox: GroupBoxNode, tierLabel: TierLabelNode };
const edgeTypes = { infra: InfraEdge, power: PowerLineEdge };
const LEGEND_POWER: LinkType[] = ['energia'];
const NO_LINES: LinkType[] = [];
/** Decorations stay behind the devices and take no gesture, focus or selection. */
const DECORATION = { draggable: false, selectable: false, focusable: false, connectable: false, deletable: false, zIndex: -1 } as const;
// A small inventory is shown at its real size instead of blown up to fill the canvas.
const FIT_VIEW = { padding: 0.2, maxZoom: 1 };
/** Rough size of a device on the map, to centre a new one on the spot where it is added. */
const NODE_SIZE = { width: 160, height: 64 } as const;
/** Ctrl + click (Cmd + click on a Mac) adds a device to the selection or takes it out; Shift + drag selects with a box. */
const MULTI_SELECTION_KEYS = ['Control', 'Meta'];

const DIRECTION: Record<string, string> = { up: 'arriba', down: 'abajo', left: 'la izquierda', right: 'la derecha' };
const ARIA_LABELS: Partial<AriaLabelConfig> = {
  'node.a11yDescription.default': 'Pulsa Intro o Espacio para seleccionar el equipo y abrir su ficha.',
  'node.a11yDescription.keyboardDisabled': 'Pulsa Intro o Espacio para seleccionar el equipo y abrir su ficha. Después puedes moverlo con las flechas.',
  'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) => `Equipo movido hacia ${DIRECTION[direction] ?? direction}. Nueva posición: x ${x}, y ${y}.`,
  'edge.a11yDescription.default': 'Pulsa Intro o Espacio para seleccionar la conexión y abrir su ficha, o Supr para quitarla.',
  'controls.ariaLabel': 'Controles del mapa',
  'controls.zoomIn.ariaLabel': 'Acercar',
  'controls.zoomOut.ariaLabel': 'Alejar',
  'controls.fitView.ariaLabel': 'Ver todo el mapa',
  'handle.ariaLabel': 'Punto de conexión',
};

const isSelection = (c: NodeChange<ItemNode>): c is NodeSelectionChange => c.type === 'select';
const isDrop = (c: NodeChange<ItemNode>): c is NodePositionChange => c.type === 'position' && c.dragging === false && !!c.position;
/** Names as a Spanish list: «A», «A y B», «A, B y C». */
const listNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names.join(''));
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
  // The selected devices in the order they were picked: one opens its ficha, several can be grouped.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [nodes, setNodes] = useState<ItemNode[]>([]);
  const [pickedEdges, setPickedEdges] = useState<ReadonlySet<string>>(new Set());
  const [hiddenLines, setHiddenLines] = useState<LinkType[]>(loadHiddenLines);
  // «Red» or «Energía»: two drawings of the same inventory. Switching only changes what is drawn, never what is stored.
  const [view, setView] = useState<MapView>(loadMapView);
  const [confirmingArrange, setConfirmingArrange] = useState(false);
  // Two devices just joined on the map: the link is saved only when its form is sent.
  const [pendingLink, setPendingLink] = useState<{ from: string; to: string } | null>(null);

  const byId = useMemo(() => new Map(devices.map(d => [d.id, d])), [devices]);
  const nameOf = (id: string) => byId.get(id)?.nombre ?? id;
  const findings = useMemo(() => analyzeInventory(topology, new Date()), [topology]);
  const selectedDevices = selectedIds.flatMap(id => byId.get(id) ?? []);
  const selected = selectedDevices.length === 1 ? selectedDevices[0] : undefined;
  const selectedLink = selectedDevices.length === 0 && pickedEdges.size === 1 ? drawnLinks(topology).find(l => pickedEdges.has(l.id)) : undefined;
  const select = (id: string | null) => { setSelectedIds(id ? [id] : []); setPickedEdges(new Set()); };
  // The «Energía» view is worked out from the power links each time: it is never saved and never moves the «Red» view.
  const powerLayout = useMemo(() => (view === 'energia' ? layoutPower(topology) : null), [topology, view]);

  const switchView = (next: MapView) => {
    if (next === view) return;
    setView(next);
    saveMapView(next);
    setPendingLink(null);
    setPickedEdges(new Set());
    setTimeout(() => void fitView(FIT_VIEW));
  };

  // React Flow keeps the measured size on each node: rebuild them from the inventory without losing it, as long as
  // the node is drawn the same way (a device has a fixed width in the «Energía» view).
  useEffect(() => {
    setNodes(prev => {
      const old = new Map(prev.map(n => [n.id, n]));
      const kept = (id: string, type: ItemNode['type']) => {
        const node = old.get(id);
        return node && node.type === type && Boolean(node.type === 'device' && node.data.power) === (view === 'energia' && type === 'device') ? node : undefined;
      };
      const common = (d: Device) => ({ id: d.id, selected: selectedIds.includes(d.id), deletable: false, ariaLabel: d.nombre });
      if (powerLayout) {
        const bars: RegletaBarNodeType[] = powerLayout.bars.flatMap(b => {
          const d = byId.get(b.id);
          return d ? [{
            ...kept(d.id, 'regletaBar'), ...common(d), type: 'regletaBar' as const, position: { x: b.x, y: b.y }, width: b.width, height: BAR_HEIGHT,
            data: { device: d }, draggable: false,
          }] : [];
        });
        const shown: DeviceNodeType[] = devices.filter(d => powerLayout.positions.has(d.id)).map(d => ({
          ...(kept(d.id, 'device') as DeviceNodeType | undefined), ...common(d), type: 'device' as const, position: powerLayout.positions.get(d.id)!,
          width: POWER_NODE.width, data: { device: d, power: true }, draggable: false,
        }));
        return [...bars, ...shown];
      }
      const positions = layoutDevices(topology);
      return devices.map((d): DeviceNodeType => ({
        ...(kept(d.id, 'device') as DeviceNodeType | undefined), ...common(d), type: 'device', position: positions.get(d.id)!,
        data: { device: d, feeds: isPowerSupplier(d.tipo) ? undefined : powerFeedersOf(topology, d.id).map(nameOf) },
      }));
    });
  }, [topology, powerLayout]);
  useEffect(() => setNodes(ns => ns.map(n => (n.selected === selectedIds.includes(n.id) ? n : { ...n, selected: selectedIds.includes(n.id) }))), [selectedIds]);

  // Boxes, tier names and lines follow the devices where they are shown right now, so they move along while dragging.
  const decorations = useMemo((): MapNode[] => {
    if (view === 'energia') return [];
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
  }, [topology, nodes, view]);
  const flowNodes = useMemo(() => [...decorations, ...nodes], [decorations, nodes]);

  const edges = useMemo((): MapEdge[] => {
    const powerOf = (l: Link) => powerEndRoles(byId.get(l.a.equipo)?.tipo, byId.get(l.b.equipo)?.tipo);
    if (powerLayout) {
      // «Energía»: one short line per power link, where the power layout put it, drawn over the bars it may cross.
      const links = new Map(drawnLinks(topology).map(l => [l.id, l]));
      return powerLayout.edges.flatMap((line): PowerLineEdgeType[] => {
        const l = links.get(line.id);
        return l ? [{
          id: l.id, type: 'power', source: line.lower, sourceHandle: 'top', target: line.upper, targetHandle: 'bottom', zIndex: 1,
          selected: pickedEdges.has(l.id), className: 'infra-edge infra-edge--energia', ariaLabel: linkName(l, nameOf), data: { link: l, line, power: powerOf(l) },
        }] : [];
      });
    }
    // Lines are routed by the centre of each device as shown now, so devices of different widths order their lines right.
    const centres = new Map(nodes.map(n => [n.id, {
      x: n.position.x + (n.measured?.width ?? NODE_SIZE.width) / 2, y: n.position.y + (n.measured?.height ?? NODE_SIZE.height) / 2,
    }]));
    // «Red» draws no power lines: what feeds each device is on its badge, and the power has a view of its own.
    const visible = drawnLinks(topology).filter(l => l.tipo !== 'energia' && !hiddenLines.includes(l.tipo));
    const routes = routeEdges(visible, id => centres.get(id));
    return visible.map(l => {
      const route = routes.get(l.id)!;
      return {
        id: l.id, type: 'infra', source: route.source, sourceHandle: route.sourceHandle, target: route.target, targetHandle: route.targetHandle,
        selected: pickedEdges.has(l.id), className: `infra-edge infra-edge--${l.tipo}`, ariaLabel: linkName(l, nameOf),
        data: { link: l, route },
      };
    });
  }, [topology, nodes, hiddenLines, pickedEdges, powerLayout]);
  const linkTypes = useMemo(() => {
    const present = linkTypesIn(topology);
    if (view === 'energia') return present.includes('energia') ? LEGEND_POWER : NO_LINES;
    return present.filter(t => t !== 'energia');
  }, [topology, view]);

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
    const changes = all.filter(c => byId.has(changedId(c))) as NodeChange<ItemNode>[];
    const selection = changes.filter(isSelection);
    if (selection.length) setSelectedIds(prev => {
      const next = prev.filter(id => !selection.some(c => c.id === id && !c.selected));
      for (const c of selection) if (c.selected && !next.includes(c.id)) next.push(c.id);
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
    // Only real changes touch the nodes: a new array for nothing would redraw the decorations and measure them again, forever.
    // The «Energía» view is worked out, never moved: only the «Red» view takes moves.
    const applied = changes.filter(c => c.type !== 'select' && c.type !== 'remove' && (view === 'red' || c.type !== 'position'));
    if (applied.length) setNodes(ns => applyNodeChanges(applied, ns));
    // A drag that ends or a move with the arrow keys leaves the device in its new place.
    const moved = view !== 'red' ? [] : changes.filter(isDrop).filter(c => {
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
  const onEdgesChange = (changes: EdgeChange<MapEdge>[]) => setPickedEdges(prev => {
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

  // Joining two devices only opens the form of the new link: nothing is saved until it is sent.
  const onConnect = ({ source, target }: FlowConnection) => {
    if (source === target || !byId.has(source) || !byId.has(target)) return;
    setPendingLink({ from: source, to: target });
  };

  const refusalText = (refusal: LinkRefusal, from: string, to: string) => (refusal === 'mismo-equipo'
    ? 'Un enlace une dos equipos distintos.'
    : `${nameOf(to)} ya cuelga de ${nameOf(from)}: ${nameOf(from)} no puede colgar también de ${nameOf(to)}.`);

  /** Saves the new link in one write, or says why it cannot be made. The dragged device is its `a` end. */
  const createLink = (draft: LinkDraft): string | null => {
    if (!pendingLink) return null;
    const { from, to } = pendingLink;
    const refusal = linkRefusal(topology, from, to, draft.tipo);
    if (refusal) return refusalText(refusal, from, to);
    setPendingLink(null);
    void persist(async () => {
      const link = connectDevices(await repository.load(), from, to, draft);
      if (link) await repository.apply({ addLinks: [link] });
    }, `Enlace ${LINK_TYPE_NAMES[draft.tipo]} creado entre ${nameOf(from)} y ${nameOf(to)}.`);
    return null;
  };

  /** Saves the ficha of a link in one write, or says why its new type cannot go that way. */
  const saveLink = (link: Link, draft: LinkDraft): string | null => {
    const refusal = linkRefusal(topology, link.a.equipo, link.b.equipo, draft.tipo, link.id);
    if (refusal) return refusalText(refusal, link.a.equipo, link.b.equipo);
    void persist(async () => {
      const stored = (await repository.load()).enlaces.find(l => l.id === link.id);
      if (stored) await repository.apply({ updateLinks: [editLink(stored, draft)] });
    }, `Enlace entre ${nameOf(link.a.equipo)} y ${nameOf(link.b.equipo)} actualizado.`);
    return null;
  };

  /** Removes the given links in one write; `between` names the two devices of each one for the message. */
  const disconnect = (links: { id: string; between: [string, string] }[]) => {
    const success = links.length === 1 ? `Conexión entre ${nameOf(links[0].between[0])} y ${nameOf(links[0].between[1])} quitada.` : `${links.length} conexiones quitadas.`;
    // A removed line is no longer selected: a new link given the same id later must not come up selected.
    setPickedEdges(prev => (links.some(l => prev.has(l.id)) ? new Set([...prev].filter(id => !links.some(l => l.id === id))) : prev));
    void persist(() => repository.apply({ removeLinks: links.map(l => l.id) }), success);
  };

  /** Makes the selected devices one group in one write, or says why they cannot be grouped. */
  const group = (tipo: GroupType, nombre: string): string | null => {
    const name = nombre.trim();
    const ids = selectedDevices.map(d => d.id);
    if (!name) return 'Escribe un nombre para el grupo.';
    const refusal = groupRefusal(topology, ids);
    if (refusal) return `No se puede agrupar: ${nameOf(refusal.equipo)} ya está en el grupo ${refusal.grupo.nombre}.`;
    void persist(async () => {
      if (!groupRefusal(await repository.load(), ids)) await repository.apply({ addGroups: [{ tipo, nombre: name, miembros: ids }] });
    }, `Grupo ${name} creado.`);
    return null;
  };

  const leaveGroup = (d: Device, g: DeviceGroup) => void persist(async () => {
    const stored = groupOf((await repository.load()).grupos, d.id);
    if (stored) await repository.apply({ saveGroups: [{ ...stored, miembros: stored.miembros.filter(m => m !== d.id) }] });
  }, `${d.nombre} ha salido del grupo ${g.nombre}.`);

  const ungroup = (g: DeviceGroup) => void persist(() => repository.apply({ removeGroups: [g.id] }), `Grupo ${g.nombre} deshecho.`);

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
    if (ok && added) select(added.id);
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
    if (removed) select(null);
  };

  // One entry per link of the selected device, named after the device at its other end.
  const connections = selected
    ? connectionsOf(topology).filter(c => c.from === selected.id || c.to === selected.id)
      .map(c => ({ id: c.id, other: c.from === selected.id ? c.to : c.from })).map(c => ({ ...c, nombre: nameOf(c.other) }))
    : [];

  // The inspector column shows, first to last: the form of a link being drawn, the ficha of the selected line, the
  // devices selected together, the ficha of the selected device, or the gaps of the whole inventory.
  const inspector = () => {
    if (pendingLink) {
      return <NewLinkForm key={`${pendingLink.from}>${pendingLink.to}`} nameA={nameOf(pendingLink.from)} nameB={nameOf(pendingLink.to)}
        types={{ tipoA: byId.get(pendingLink.from)?.tipo, tipoB: byId.get(pendingLink.to)?.tipo }} linkTypes={view === 'energia' ? LEGEND_POWER : undefined}
        onCreate={createLink} onCancel={() => setPendingLink(null)} />;
    }
    if (selectedLink) {
      return <LinkInspector key={selectedLink.id} link={selectedLink} nameOf={nameOf}
        types={{ tipoA: byId.get(selectedLink.a.equipo)?.tipo, tipoB: byId.get(selectedLink.b.equipo)?.tipo }} onSave={draft => saveLink(selectedLink, draft)}
        onRemove={() => disconnect([{ id: selectedLink.id, between: [selectedLink.a.equipo, selectedLink.b.equipo] }])} onClose={() => setPickedEdges(new Set())} />;
    }
    if (selectedDevices.length > 1) return <GroupPanel key={selectedIds.join(' ')} devices={selectedDevices} onGroup={group} />;
    if (!selected) return <InventoryOverview empty={devices.length === 0} findings={findings} />;
    const grupo = groupOf(topology.grupos, selected.id);
    return (
      <DeviceInspector key={selected.id} device={selected} connections={connections} group={grupo} findings={findings.filter(f => f.deviceId === selected.id)}
        onChange={change => update(selected, change)} onRename={nombre => rename(selected, nombre)} onDisconnect={id => disconnect(connections.filter(c => c.id === id).map(c => ({ id, between: [selected.id, c.other] })))}
        onLeaveGroup={() => grupo && leaveGroup(selected, grupo)} onUngroup={() => grupo && ungroup(grupo)} onDelete={() => void remove(selected)} />
    );
  };

  return (
    <section className="infra-map">
      <p className="notice">Tu inventario se guarda <b>solo en este navegador</b>: no se envía a ningún servidor. Si borras los datos del navegador, se pierde, así que expórtalo de vez en cuando desde <a href="#mi-infraestructura/lista">Lista</a>.</p>
      {message && <p className="muted" role="status">{message}</p>}
      <div className="infra-workspace">
        <DevicePalette onAdd={tipo => void add(tipo)} />
        <div className="infra-stage">
          <MapViewTabs view={view} onChange={switchView} controls="infra-canvas" />
          <div className="infra-toolbar">
            {powerLayout ? (
              <p className="muted infra-power-note">
                SAI arriba, regletas como barras y, debajo, los equipos que alimenta cada una. Esta vista se calcula sola: no se guarda ni cambia la vista «Red».
                {powerLayout.unpowered.length > 0 && <> <span>{`Sin enlaces de energía: ${listNames(powerLayout.unpowered.map(nameOf))}.`}</span></>}
              </p>
            ) : confirmingArrange ? (
              <div className="infra-confirm" role="group" aria-label="Confirmar la colocación por capas">
                <span>Todos los equipos se colocarán por capas y se perderá la posición que hayas dado a cada uno. ¿Quieres seguir?</span>
                <button type="button" onClick={() => void arrange()}>Sí, colocar por capas</button>
                <button type="button" onClick={() => setConfirmingArrange(false)}>Cancelar</button>
              </div>
            ) : <button type="button" disabled={devices.length === 0} onClick={() => setConfirmingArrange(true)}>Colocar por capas</button>}
          </div>
          <section className="infra-canvas" id="infra-canvas" aria-label="Mapa de tu infraestructura" ref={canvas}
            onDragOver={e => { if (e.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={onDrop}>
            <ReactFlow<MapNode, MapEdge> nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodesDraggable={view === 'red'}
              onNodeClick={(e, node) => { if ((node.type === 'device' || node.type === 'regletaBar') && !e.ctrlKey && !e.metaKey) select(node.id); }}
              onEdgesDelete={es => disconnect(es.flatMap(e => (e.data ? [{ id: e.id, between: [e.data.link.a.equipo, e.data.link.b.equipo] as [string, string] }] : [])))}
              selectNodesOnDrag={false} multiSelectionKeyCode={MULTI_SELECTION_KEYS}
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
          <MapLegend types={linkTypes} hidden={view === 'red' ? hiddenLines : NO_LINES} onToggle={toggleLines} />
        </div>
        {inspector()}
      </div>
    </section>
  );
}
