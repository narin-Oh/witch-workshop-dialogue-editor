import type { EditorEdge, EditorGraph, EditorNode } from '../model/types';

export interface HandleSpec {
  id: string;
  label: string;
}

export const choiceHandle = (choiceId: string): string => `choice:${choiceId}`;

/** Output handles a node exposes. Single source of truth for UI, validation, preview and export. */
export function outputHandles(node: EditorNode): HandleSpec[] {
  switch (node.type) {
    case 'end':
      return [];
    case 'condition':
      return [
        { id: 'true', label: 'True' },
        { id: 'false', label: 'False' },
      ];
    case 'choice':
      return node.data.choices.map((c, i) => ({ id: choiceHandle(c.id), label: `${i + 1}` }));
    default:
      return [{ id: 'next', label: 'Next' }];
  }
}

export function hasInput(node: EditorNode): boolean {
  return node.type !== 'start';
}

export function nodeMap(graph: EditorGraph): Map<string, EditorNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

export function findEdge(graph: EditorGraph, source: string, handle: string): EditorEdge | undefined {
  return graph.edges.find((e) => e.source === source && e.sourceHandle === handle);
}

/** Target node id for a node's output handle, or undefined when unconnected. */
export function getTarget(graph: EditorGraph, source: string, handle: string): string | undefined {
  return findEdge(graph, source, handle)?.target;
}

/** Ids of nodes reachable from `startId` following edges whose endpoints exist. */
export function reachableFrom(graph: EditorGraph, startId: string): Set<string> {
  const nodes = nodeMap(graph);
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!nodes.has(e.source) || !nodes.has(e.target)) continue;
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const seen = new Set<string>();
  if (!nodes.has(startId)) return seen;
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const t of adj.get(id) ?? []) if (!seen.has(t)) stack.push(t);
  }
  return seen;
}

/** True if a cycle is reachable from `startId`. */
export function hasCycleFrom(graph: EditorGraph, startId: string): boolean {
  const nodes = nodeMap(graph);
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!nodes.has(e.source) || !nodes.has(e.target)) continue;
    adj.set(e.source, [...(adj.get(e.source) ?? []), e.target]);
  }
  const state = new Map<string, 1 | 2>(); // 1 = on stack, 2 = done
  const visit = (id: string): boolean => {
    state.set(id, 1);
    for (const t of adj.get(id) ?? []) {
      const s = state.get(t);
      if (s === 1) return true;
      if (!s && visit(t)) return true;
    }
    state.set(id, 2);
    return false;
  };
  return nodes.has(startId) ? visit(startId) : false;
}
