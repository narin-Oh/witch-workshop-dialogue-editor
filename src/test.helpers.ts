import { createNode } from './model/factory';
import { newId } from './model/ids';
import type { EditorGraph, EditorNode, VariableDef } from './model/types';
import { GraphBuilder } from './samples/builder';

export const vdef = (name: string, type: VariableDef['type'], initialValue: VariableDef['initialValue'], scope: VariableDef['scope'] = 'global'): VariableDef => ({ id: newId('v'), name, type, scope, initialValue });

/** Minimal valid graph: Start → Dialogue → End. */
export function simpleGraph(): EditorGraph {
  return new GraphBuilder('t').start('s').say('d', 'A', 'Hello').end('e', 'Done').link('s', 'next', 'd').link('d', 'next', 'e').build();
}
export const nodeOf = (g: EditorGraph, type: EditorNode['type']): EditorNode => g.nodes.find((n) => n.type === type) as EditorNode;
export { createNode };
