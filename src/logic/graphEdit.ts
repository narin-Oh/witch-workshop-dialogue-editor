import { newId } from '../model/ids';
import type { EditorEdge, EditorGraph, EditorNode, Position } from '../model/types';
import { choiceHandle, findEdge, nodeMap, outputHandles } from './graphUtils';

export interface Connection {
  source: string;
  sourceHandle: string;
  target: string;
}

export type ConnectionProblem = 'missing-node' | 'into-start' | 'bad-output';

/** The rules for a legal connection (shared by drag, click and keyboard connecting). Returns the problem, or null if allowed. */
export function connectionProblem(graph: EditorGraph, c: Connection): ConnectionProblem | null {
  const nodes = nodeMap(graph);
  const src = nodes.get(c.source);
  const dst = nodes.get(c.target);
  if (!src || !dst) return 'missing-node';
  if (dst.type === 'start') return 'into-start';
  if (!outputHandles(src).some((h) => h.id === c.sourceHandle)) return 'bad-output';
  return null;
}

/** Add a connection. Each output handle holds at most one edge (a new one replaces the old). Returns the same graph if invalid. */
export function connectNodes(graph: EditorGraph, c: Connection): EditorGraph {
  if (connectionProblem(graph, c)) return graph;
  const existing = findEdge(graph, c.source, c.sourceHandle);
  if (existing && existing.target === c.target) return graph;
  const edges = graph.edges.filter((e) => !(e.source === c.source && e.sourceHandle === c.sourceHandle));
  edges.push({ id: newId('e'), source: c.source, sourceHandle: c.sourceHandle, target: c.target });
  return { ...graph, edges };
}

/** Remove the given edges only (never nodes). Returns the same graph if none matched. */
export function removeEdges(graph: EditorGraph, ids: string[]): EditorGraph {
  const drop = new Set(ids);
  const edges = graph.edges.filter((e) => !drop.has(e.id));
  return edges.length === graph.edges.length ? graph : { ...graph, edges };
}

/** Drop edges whose endpoints or source handle no longer exist (e.g. after deleting a choice). */
export function pruneEdges(graph: EditorGraph): EditorGraph {
  const nodes = nodeMap(graph);
  const edges = graph.edges.filter((e) => {
    const s = nodes.get(e.source);
    return !!s && nodes.has(e.target) && outputHandles(s).some((h) => h.id === e.sourceHandle);
  });
  return edges.length === graph.edges.length ? graph : { ...graph, edges };
}

export function deleteSelection(graph: EditorGraph): EditorGraph {
  const removed = new Set(graph.nodes.filter((n) => n.selected).map((n) => n.id));
  const nodes = graph.nodes.filter((n) => !removed.has(n.id));
  const edges = graph.edges.filter((e) => !e.selected && !removed.has(e.source) && !removed.has(e.target));
  return nodes.length === graph.nodes.length && edges.length === graph.edges.length ? graph : { ...graph, nodes, edges };
}

export interface Clipboard {
  nodes: EditorNode[];
  edges: EditorEdge[];
}

/** Copy selected nodes (Start is never copied: a graph has exactly one) and edges fully inside the selection. */
export function copySelection(graph: EditorGraph): Clipboard | null {
  const nodes = graph.nodes.filter((n) => n.selected && n.type !== 'start').map(stripTransient);
  if (!nodes.length) return null;
  const ids = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e, selected: undefined }));
  return { nodes: structuredClone(nodes), edges: structuredClone(edges) };
}

export function stripTransient(n: EditorNode): EditorNode {
  const { selected: _s, measured: _m, ...rest } = n;
  return rest as EditorNode;
}

/**
 * Paste a clipboard into a graph with fresh IDs (nodes, edges and choices) and an offset.
 * Pasted nodes become the selection. Edges are remapped consistently, including choice handles.
 */
export function pasteClipboard(graph: EditorGraph, clip: Clipboard, offset: Position): EditorGraph {
  const idMap = new Map<string, string>();
  const handleMap = new Map<string, string>();
  const pasted: EditorNode[] = clip.nodes.map((n) => {
    const copy = structuredClone(n);
    const id = newId('n');
    idMap.set(n.id, id);
    if (copy.type === 'choice') {
      copy.data.choices = copy.data.choices.map((c) => {
        const nid = newId('c');
        handleMap.set(`${n.id}|${choiceHandle(c.id)}`, choiceHandle(nid));
        return { ...c, id: nid };
      });
    }
    if (copy.type === 'event') copy.data.params = copy.data.params.map((p) => ({ ...p, id: newId('x') }));
    return { ...copy, id, position: { x: n.position.x + offset.x, y: n.position.y + offset.y }, selected: true } as EditorNode;
  });
  const edges: EditorEdge[] = clip.edges.flatMap((e) => {
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    if (!source || !target) return [];
    const sourceHandle = handleMap.get(`${e.source}|${e.sourceHandle}`) ?? e.sourceHandle;
    return [{ id: newId('e'), source, sourceHandle, target }];
  });
  return {
    ...graph,
    nodes: [...graph.nodes.map((n) => (n.selected ? ({ ...n, selected: false } as EditorNode) : n)), ...pasted],
    edges: [...graph.edges.map((e) => (e.selected ? { ...e, selected: false } : e)), ...edges],
  };
}

/** Structural equality ignoring transient React Flow fields (selection, measurement). */
export function sameGraphContent(a: EditorGraph, b: EditorGraph): boolean {
  const strip = (g: EditorGraph) => JSON.stringify({ n: g.nodes.map(stripTransient), e: g.edges.map((e) => [e.id, e.source, e.sourceHandle, e.target]) });
  return a === b || strip(a) === strip(b);
}

/** Approximate on-canvas node size, used to keep newly added nodes from stacking on top of each other. */
export const NODE_W = 260;
export const NODE_H = 150;

/** Shift `desired` downward until it does not overlap an existing node. */
export function findFreePosition(nodes: EditorNode[], desired: Position, step = NODE_H + 20, maxTries = 40): Position {
  let y = desired.y;
  for (let i = 0; i < maxTries; i++) {
    const clash = nodes.some((n) => Math.abs(n.position.x - desired.x) < NODE_W && Math.abs(n.position.y - y) < NODE_H);
    if (!clash) return { x: desired.x, y };
    y += step;
  }
  return { x: desired.x, y };
}
