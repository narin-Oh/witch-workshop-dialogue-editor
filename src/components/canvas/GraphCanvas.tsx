import { useT } from '../../i18n';
import { Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow, useReactFlow, type Edge, type Node } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react';
import { activeGraphOf } from '../../logic/projectOps';
import type { NodeType } from '../../model/types';
import { NODE_TYPES } from '../../model/types';
import { selectProject, useEditorStore } from '../../store/editorStore';
import { Leaf, Moon, Sparkle, Star } from '../ui/Motifs';
import { NODE_META } from './nodeMeta';
import { nodeTypes } from './NodeCard';

export const PALETTE_MIME = 'application/x-witch-node';

const EDGE_COLORS: Record<string, string> = { true: 'rgb(52 117 93)', false: 'rgb(163 62 105)' };
const DEFAULT_EDGE = '#8f84ad';

function EmptyHint() {
  const t = useT();
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="max-w-sm rounded-3xl border border-line bg-panel/90 p-6 text-center shadow-card">
        <div className="mb-2 flex justify-center gap-2 text-primary-deep">
          <Moon size={22} />
          <Sparkle size={22} />
          <Star size={22} />
          <Leaf size={22} />
        </div>
        <h2 className="font-serif text-lg font-bold">{t('empty.title')}</h2>
        <p className="mt-1 text-text-sub">{t('empty.body')}</p>
      </div>
    </div>
  );
}

export function GraphCanvas() {
  const t = useT();
  const project = useEditorStore(selectProject);
  const graph = activeGraphOf(project);
  const { onNodesChange, onEdgesChange, onConnect, beginDrag, endDrag, addNode } = useEditorStore.getState();
  const focusRequest = useEditorStore((s) => s.focusRequest);
  const rf = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  // On opening a graph: fit it if it fits at a readable zoom, otherwise start at the Start node.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const nodes = rf.getNodes();
      const width = wrapRef.current?.clientWidth ?? 1000;
      if (!nodes.length) return;
      const bounds = rf.getNodesBounds(nodes);
      if (bounds.width * 0.7 <= width * 0.9) {
        void rf.fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.5 });
      } else {
        const start = nodes.find((n) => n.type === 'start') ?? nodes[0];
        if (start) void rf.setViewport({ x: 60 - start.position.x * 0.8, y: 120 - start.position.y * 0.8, zoom: 0.8 });
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.id]);

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => {
        const color = EDGE_COLORS[e.sourceHandle] ?? DEFAULT_EDGE;
        return { ...e, targetHandle: 'in', style: { stroke: color }, markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 } } as Edge;
      }),
    [graph.edges],
  );

  useEffect(() => {
    if (!focusRequest) return;
    void rf.fitView({ nodes: [{ id: focusRequest.nodeId }], duration: 350, maxZoom: 1.1, padding: 0.8 });
  }, [focusRequest, rf]);

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes(PALETTE_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);
  const onDrop = useCallback(
    (e: DragEvent) => {
      const type = e.dataTransfer.getData(PALETTE_MIME) as NodeType;
      if (!(NODE_TYPES as readonly string[]).includes(type)) return;
      e.preventDefault();
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(type, { x: Math.round(p.x - 130), y: Math.round(p.y - 30) });
    },
    [rf, addNode],
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      {graph.nodes.length === 0 && <EmptyHint />}
      <ReactFlow
        key={graph.id}
        nodes={graph.nodes as unknown as Node[]}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(c) => c.source && c.target && onConnect({ source: c.source, sourceHandle: c.sourceHandle ?? 'next', target: c.target })}
        onNodeDragStart={beginDrag}
        onNodeDragStop={endDrag}
        onSelectionDragStart={beginDrag}
        onSelectionDragStop={endDrag}
        deleteKeyCode={null}
        minZoom={0.15}
        maxZoom={1.8}
        snapToGrid
        snapGrid={[10, 10]}
        connectionRadius={28}
        aria-label={t('canvas.aria')}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} color="#d6cde6" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          maskColor="rgb(248 246 251 / 0.7)"
          nodeStrokeWidth={2}
          nodeColor={(n) => {
            const t = n.type as NodeType;
            return t in NODE_META ? `rgb(var(--c-${{ start: 'mint', dialogue: 'primary', choice: 'yellow', condition: 'blue', variable: 'peach', event: 'pink', end: 'mauve' }[t]}))` : '#ccc';
          }}
        />
      </ReactFlow>
    </div>
  );
}
