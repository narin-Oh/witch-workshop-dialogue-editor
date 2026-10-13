import { NODE_H, NODE_W } from './graphEdit';
import type { EditorGraph, EditorNode } from '../model/types';

export type Direction = 'up' | 'down' | 'left' | 'right';

function center(n: EditorNode): { x: number; y: number } {
  const w = n.measured?.width ?? NODE_W;
  const h = n.measured?.height ?? NODE_H;
  return { x: n.position.x + w / 2, y: n.position.y + h / 2 };
}

const VECTORS: Record<Direction, { ax: number; ay: number }> = {
  right: { ax: 1, ay: 0 },
  left: { ax: -1, ay: 0 },
  down: { ax: 0, ay: 1 },
  up: { ax: 0, ay: -1 },
};

/**
 * The nearest node that lies in `dir` from the source, judged by the nodes' visual centers.
 * A candidate must be within the 90-degree cone around the direction (distance along the direction > 0 and
 * sideways offset <= distance along it). The Start node is never a target (it has no input).
 * Ties on distance prefer the smaller sideways offset. Returns undefined if nothing qualifies.
 */
export function findNearestInDirection(graph: EditorGraph, sourceId: string, dir: Direction): EditorNode | undefined {
  const source = graph.nodes.find((n) => n.id === sourceId);
  if (!source) return undefined;
  const c0 = center(source);
  const { ax, ay } = VECTORS[dir];
  let best: { node: EditorNode; dist: number; side: number } | undefined;
  for (const n of graph.nodes) {
    if (n.id === sourceId || n.type === 'start') continue;
    const c = center(n);
    const dx = c.x - c0.x;
    const dy = c.y - c0.y;
    const along = dx * ax + dy * ay;
    const side = Math.abs(dx * ay - dy * ax);
    if (along <= 0 || side > along) continue;
    const dist = Math.hypot(dx, dy);
    if (!best || dist < best.dist - 1e-6 || (Math.abs(dist - best.dist) <= 1e-6 && side < best.side)) best = { node: n, dist, side };
  }
  return best?.node;
}
