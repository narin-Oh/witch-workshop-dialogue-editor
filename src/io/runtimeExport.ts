import { getTarget, nodeMap, reachableFrom } from '../logic/graphUtils';
import { errorsOf, validateGraph } from '../logic/validation';
import type { RuntimeDialogue, RuntimeEventParam, RuntimeNode, RuntimeNodeType, RuntimeTypedValue, RuntimeVariable } from '../model/runtime';
import type { EditorGraph, EditorNode, Value, ValueType, ValidationIssue, VariableDef } from '../model/types';

export class ExportError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(`Cannot export: ${issues.length} error(s) in the graph.`);
  }
}

export function toTypedValue(type: ValueType, v: Value): RuntimeTypedValue {
  return {
    valueType: type,
    intValue: type === 'int' ? (v as number) : 0,
    boolValue: type === 'bool' ? (v as boolean) : false,
    stringValue: type === 'string' ? (v as string) : '',
  };
}

const emptyValue = (): RuntimeTypedValue => toTypedValue('int', 0);

function baseNode(id: string, type: RuntimeNodeType): RuntimeNode {
  return {
    id, type, speaker: '', displayName: '', text: '', portraitId: '', expression: '', choices: [],
    variable: '', operator: '', compare: emptyValue(), nextTrue: '', nextFalse: '',
    operation: '', operand: emptyValue(), eventName: '', eventParams: [], next: '', endingName: '',
  };
}

/**
 * Convert an editor graph into runtime data. Refuses (throws ExportError) if the graph has any validation error,
 * so invalid graphs can never be exported silently. The editor-only Start node is not exported:
 * `startNodeId` is the first executable node it points to. Unreachable nodes are omitted.
 */
export function exportRuntime(graph: EditorGraph, variables: VariableDef[]): RuntimeDialogue {
  const errors = errorsOf(validateGraph(graph, variables));
  if (errors.length) throw new ExportError(errors);

  const nodes = nodeMap(graph);
  const start = graph.nodes.find((n) => n.type === 'start') as EditorNode;
  const startNodeId = getTarget(graph, start.id, 'next') as string;
  const reach = reachableFrom(graph, start.id);
  const next = (n: EditorNode, h: string): string => getTarget(graph, n.id, h) as string;

  const out: RuntimeNode[] = [];
  for (const n of graph.nodes) {
    if (n.type === 'start' || !reach.has(n.id)) continue;
    const r = baseNode(n.id, n.type);
    switch (n.type) {
      case 'dialogue':
        r.speaker = n.data.speaker;
        r.displayName = n.data.speakerOverride.trim() || n.data.speaker;
        r.text = n.data.text;
        r.portraitId = n.data.portraitId;
        r.expression = n.data.expression;
        r.next = next(n, 'next');
        break;
      case 'choice':
        r.choices = n.data.choices.map((c) => ({ id: c.id, text: c.text, next: next(n, `choice:${c.id}`) }));
        break;
      case 'condition': {
        const def = variables.find((v) => v.name === n.data.variable) as VariableDef;
        r.variable = n.data.variable;
        r.operator = n.data.operator;
        r.compare = toTypedValue(def.type, n.data.value);
        r.nextTrue = next(n, 'true');
        r.nextFalse = next(n, 'false');
        break;
      }
      case 'variable': {
        const def = variables.find((v) => v.name === n.data.variable) as VariableDef;
        r.variable = n.data.variable;
        r.operation = n.data.operation;
        r.operand = toTypedValue(def.type, n.data.value);
        r.next = next(n, 'next');
        break;
      }
      case 'event':
        r.eventName = n.data.eventName;
        r.eventParams = n.data.params.map((p): RuntimeEventParam => ({ key: p.key, ...toTypedValue(p.valueType, p.value) }));
        r.next = next(n, 'next');
        break;
      case 'end':
        r.endingName = n.data.endingName;
        break;
    }
    out.push(r);
  }
  void nodes;

  // Only variables this dialogue actually uses.
  const used = new Set<string>();
  for (const r of out) if (r.variable) used.add(r.variable);
  const vars: RuntimeVariable[] = variables
    .filter((v) => used.has(v.name))
    .map((v) => ({ name: v.name, scope: v.scope, valueType: v.type, initial: toTypedValue(v.type, v.initialValue) }));

  return { schemaVersion: 1, id: graph.id, name: graph.name, startNodeId, variables: vars, nodes: out };
}

export function runtimeToJson(d: RuntimeDialogue): string {
  return JSON.stringify(d, null, 2);
}
