import { newId } from './ids';
import type { ChoiceItem, EditorGraph, EditorNode, EditorProject, EventParam, NodeData, NodeDataMap, NodeType, Position } from './types';
import { findEventSpec } from './eventCatalog';

export function defaultNodeData<T extends NodeType>(type: T): NodeDataMap[T];
export function defaultNodeData(type: NodeType): NodeData {
  switch (type) {
    case 'start':
      return { note: '' };
    case 'dialogue':
      return { speaker: '', speakerOverride: '', text: '', portraitId: '', expression: 'neutral' };
    case 'choice':
      return { choices: [newChoice(''), newChoice('')] };
    case 'condition':
      return { variable: '', operator: '==', value: true };
    case 'variable':
      return { variable: '', operation: 'set', value: 0 };
    case 'event':
      return { eventName: '', params: [] };
    case 'end':
      return { endingName: '' };
  }
}

export function newChoice(text: string): ChoiceItem {
  return { id: newId('c'), text };
}

export function paramsForEvent(eventName: string): EventParam[] {
  const spec = findEventSpec(eventName);
  if (!spec) return [];
  return spec.params.map((p) => ({ id: newId('x'), key: p.key, valueType: p.valueType, value: p.defaultValue }));
}

export function createNode<T extends NodeType>(type: T, position: Position, data?: NodeDataMap[T]): EditorNode {
  return { id: newId('n'), type, position, data: data ?? defaultNodeData(type) } as EditorNode;
}

export function createGraph(name: string, withStart = true): EditorGraph {
  const nodes: EditorNode[] = withStart ? [createNode('start', { x: 80, y: 160 })] : [];
  return { id: newId('g'), name, nodes, edges: [] };
}

export function createProject(name = 'New Project'): EditorProject {
  const graph = createGraph('Untitled Dialogue');
  return { formatVersion: 1, id: newId('p'), name, variables: [], graphs: [graph], activeGraphId: graph.id, previewOverrides: {} };
}
