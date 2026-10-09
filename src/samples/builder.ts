import { createNode, newChoice, paramsForEvent } from '../model/factory';
import { newId } from '../model/ids';
import type { ChoiceItem, EditorEdge, EditorGraph, EditorNode, NodeDataMap, NodeType, Operator, Value, VariableOperation } from '../model/types';

/** Small DSL for authoring sample graphs with readable keys; ids are generated and positions auto-laid-out. */
export class GraphBuilder {
  private nodes = new Map<string, EditorNode>();
  private edges: EditorEdge[] = [];
  private choiceIds = new Map<string, ChoiceItem[]>();

  constructor(private name: string) {}

  private add<T extends NodeType>(key: string, type: T, data?: NodeDataMap[T]): this {
    this.nodes.set(key, createNode(type, { x: 0, y: 0 }, data));
    return this;
  }
  start(key: string) { return this.add(key, 'start'); }
  say(key: string, speaker: string, text: string, expression = 'neutral', portraitId = '', speakerOverride = '') {
    return this.add(key, 'dialogue', { speaker, speakerOverride, text, portraitId: portraitId || speaker.toLowerCase(), expression });
  }
  choice(key: string, ...texts: string[]) {
    const items = texts.map((t) => newChoice(t));
    this.choiceIds.set(key, items);
    return this.add(key, 'choice', { choices: items });
  }
  cond(key: string, variable: string, operator: Operator, value: Value) { return this.add(key, 'condition', { variable, operator, value }); }
  set(key: string, variable: string, operation: VariableOperation, value: Value) { return this.add(key, 'variable', { variable, operation, value }); }
  event(key: string, eventName: string, params: Record<string, Value> = {}) {
    const ps = paramsForEvent(eventName).map((p) => ({ ...p, value: params[p.key] ?? p.value }));
    return this.add(key, 'event', { eventName, params: ps });
  }
  end(key: string, endingName: string) { return this.add(key, 'end', { endingName }); }

  /** Connect `from` (handle: 'next' | 'true' | 'false' | choice index) to `to`. */
  link(from: string, handle: 'next' | 'true' | 'false' | number, to: string): this {
    const src = this.nodes.get(from);
    const dst = this.nodes.get(to);
    if (!src || !dst) throw new Error(`Unknown node key: ${!src ? from : to}`);
    const h = typeof handle === 'number' ? `choice:${(this.choiceIds.get(from) as ChoiceItem[])[handle]?.id}` : handle;
    this.edges.push({ id: newId('e'), source: src.id, sourceHandle: h, target: dst.id });
    return this;
  }

  build(): EditorGraph {
    const nodes = [...this.nodes.values()];
    layout(nodes, this.edges);
    return { id: newId('g'), name: this.name, nodes, edges: this.edges };
  }
}

/** Layered left-to-right layout: column = longest-path depth from Start, rows stacked per column. */
export function layout(nodes: EditorNode[], edges: EditorEdge[]): void {
  const depth = new Map<string, number>();
  const start = nodes.find((n) => n.type === 'start') ?? nodes[0];
  if (!start) return;
  depth.set(start.id, 0);
  // Relax longest-path depth with a bounded number of passes (cycles can't grow past the node count).
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      const d = depth.get(e.source);
      if (d === undefined) continue;
      if ((depth.get(e.target) ?? -1) < d + 1 && d + 1 <= nodes.length) {
        depth.set(e.target, d + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const columns = new Map<number, EditorNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), n]);
  }
  for (const [d, list] of columns) {
    list.forEach((n, i) => {
      n.position = { x: 60 + d * 340, y: 60 + i * 230 };
    });
  }
}
