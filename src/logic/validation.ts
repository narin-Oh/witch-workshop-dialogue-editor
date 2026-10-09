import { findEventSpec } from '../model/eventCatalog';
import type { EditorGraph, EditorNode, Severity, ValidationIssue, VariableDef } from '../model/types';
import { hasCycleFrom, nodeMap, outputHandles, reachableFrom } from './graphUtils';
import { isValueOfType, operatorsFor, operationsFor } from './values';

/** Human-readable node label for messages. */
export function describeNode(n: EditorNode): string {
  switch (n.type) {
    case 'dialogue':
      return `Dialogue "${truncate(n.data.text || n.data.speaker || '(empty)')}"`;
    case 'end':
      return n.data.endingName ? `End "${n.data.endingName}"` : 'End';
    case 'event':
      return n.data.eventName ? `Event ${n.data.eventName}` : 'Event';
    case 'condition':
      return `Condition on ${n.data.variable || '(none)'}`;
    case 'variable':
      return `Variable ${n.data.variable || '(none)'}`;
    case 'choice':
      return 'Choice';
    case 'start':
      return 'Start';
  }
}
const truncate = (s: string, n = 24): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Validates one graph against the project's variable definitions. Pure; returns all issues. */
export function validateGraph(graph: EditorGraph, variables: VariableDef[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let seq = 0;
  const add = (severity: Severity, code: string, message: string, ref: { nodeId?: string; edgeId?: string } = {}) =>
    issues.push({ id: `${code}#${seq++}`, severity, code, message, ...ref });

  const nodes = nodeMap(graph);
  const varByName = new Map(variables.map((v) => [v.name, v]));

  // --- project-level variable definitions ---
  const seenNames = new Set<string>();
  for (const v of variables) {
    if (!v.name.trim()) add('error', 'VARIABLE_NAME_EMPTY', 'A variable has an empty name.');
    else if (seenNames.has(v.name)) add('error', 'VARIABLE_NAME_DUPLICATE', `Variable name "${v.name}" is defined more than once.`);
    else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.name)) add('error', 'VARIABLE_NAME_INVALID', `Variable name "${v.name}" must use letters, digits and underscores only (not starting with a digit).`);
    seenNames.add(v.name);
    if (!isValueOfType(v.initialValue, v.type)) add('error', 'VARIABLE_INITIAL_TYPE', `Variable "${v.name}" has an initial value that does not match type ${v.type}.`);
  }

  // --- structural: ids, start node ---
  const idCount = new Map<string, number>();
  for (const n of graph.nodes) idCount.set(n.id, (idCount.get(n.id) ?? 0) + 1);
  for (const [id, c] of idCount) if (c > 1) add('error', 'DUPLICATE_NODE_ID', `Node id "${id}" is used ${c} times.`, { nodeId: id });

  const starts = graph.nodes.filter((n) => n.type === 'start');
  if (starts.length === 0) add('error', 'NO_START', 'The graph has no Start node. Add one from the palette.');
  for (const extra of starts.slice(1)) add('error', 'MULTIPLE_START', 'Only one Start node is allowed.', { nodeId: extra.id });
  const start = starts[0];

  // --- edges ---
  const perHandle = new Map<string, number>();
  for (const e of graph.edges) {
    const src = nodes.get(e.source);
    const dst = nodes.get(e.target);
    if (!src || !dst) {
      add('error', 'BROKEN_EDGE', 'A connection points to a node that does not exist.', { edgeId: e.id, nodeId: src?.id ?? dst?.id });
      continue;
    }
    if (!outputHandles(src).some((h) => h.id === e.sourceHandle)) {
      add('error', 'BROKEN_EDGE', `${describeNode(src)} has a connection from an output ("${e.sourceHandle}") that no longer exists.`, { edgeId: e.id, nodeId: src.id });
    }
    if (dst.type === 'start') add('error', 'EDGE_INTO_START', 'Nothing can connect into the Start node.', { edgeId: e.id, nodeId: dst.id });
    const k = `${e.source}|${e.sourceHandle}`;
    perHandle.set(k, (perHandle.get(k) ?? 0) + 1);
  }
  for (const [k, c] of perHandle) {
    if (c > 1) {
      const [nodeId] = k.split('|');
      add('error', 'DUPLICATE_OUTPUT', 'An output has more than one connection; exactly one is allowed.', { nodeId });
    }
  }

  const connected = (n: EditorNode, handle: string) => graph.edges.some((e) => e.source === n.id && e.sourceHandle === handle && nodes.has(e.target));

  // --- per node ---
  for (const n of graph.nodes) {
    const label = describeNode(n);
    switch (n.type) {
      case 'start':
        if (!connected(n, 'next')) add('error', 'START_NO_NEXT', 'Start must connect to the first node of the conversation.', { nodeId: n.id });
        break;
      case 'dialogue':
        if (!n.data.text.trim()) add('error', 'DIALOGUE_EMPTY_TEXT', `${label} has no dialogue text.`, { nodeId: n.id });
        if (!n.data.speaker.trim() && !n.data.speakerOverride.trim()) add('warning', 'DIALOGUE_NO_SPEAKER', `${label} has no speaker name.`, { nodeId: n.id });
        if (!connected(n, 'next')) add('error', 'MISSING_NEXT', `${label} is not connected to a next node (use an End node to finish).`, { nodeId: n.id });
        break;
      case 'choice': {
        if (n.data.choices.length === 0) add('error', 'CHOICE_NONE', 'A Choice node needs at least one choice.', { nodeId: n.id });
        n.data.choices.forEach((c, i) => {
          if (!c.text.trim()) add('error', 'CHOICE_EMPTY_TEXT', `Choice ${i + 1} has no text.`, { nodeId: n.id });
          if (!connected(n, `choice:${c.id}`)) add('error', 'CHOICE_NOT_CONNECTED', `Choice ${i + 1}${c.text ? ` "${truncate(c.text)}"` : ''} is not connected to a node.`, { nodeId: n.id });
        });
        break;
      }
      case 'condition': {
        const v = varByName.get(n.data.variable);
        if (!n.data.variable) add('error', 'CONDITION_NO_VARIABLE', 'Condition has no variable selected.', { nodeId: n.id });
        else if (!v) add('error', 'CONDITION_UNKNOWN_VARIABLE', `Condition uses undefined variable "${n.data.variable}".`, { nodeId: n.id });
        else {
          if (!operatorsFor(v.type).includes(n.data.operator)) add('error', 'CONDITION_BAD_OPERATOR', `Operator "${n.data.operator}" cannot be used with ${v.type} variable "${v.name}".`, { nodeId: n.id });
          if (!isValueOfType(n.data.value, v.type)) add('error', 'CONDITION_VALUE_TYPE', `Condition compares ${v.type} variable "${v.name}" with a value of the wrong type.`, { nodeId: n.id });
        }
        if (!connected(n, 'true')) add('error', 'CONDITION_TRUE_MISSING', `${label}: the True branch is not connected.`, { nodeId: n.id });
        if (!connected(n, 'false')) add('error', 'CONDITION_FALSE_MISSING', `${label}: the False branch is not connected.`, { nodeId: n.id });
        break;
      }
      case 'variable': {
        const v = varByName.get(n.data.variable);
        if (!n.data.variable) add('error', 'VARIABLE_NO_VARIABLE', 'Variable node has no variable selected.', { nodeId: n.id });
        else if (!v) add('error', 'VARIABLE_UNKNOWN', `Variable node uses undefined variable "${n.data.variable}".`, { nodeId: n.id });
        else {
          if (!operationsFor(v.type).includes(n.data.operation)) add('error', 'VARIABLE_BAD_OPERATION', `"${n.data.operation}" cannot be used with ${v.type} variable "${v.name}".`, { nodeId: n.id });
          if (!isValueOfType(n.data.value, v.type)) add('error', 'VARIABLE_VALUE_TYPE', `Value for ${v.type} variable "${v.name}" has the wrong type.`, { nodeId: n.id });
        }
        if (!connected(n, 'next')) add('error', 'MISSING_NEXT', `${label} is not connected to a next node.`, { nodeId: n.id });
        break;
      }
      case 'event': {
        if (!n.data.eventName.trim()) add('error', 'EVENT_NO_NAME', 'Event node has no event name.', { nodeId: n.id });
        const spec = findEventSpec(n.data.eventName);
        const keys = new Set<string>();
        for (const p of n.data.params) {
          if (!p.key.trim()) add('error', 'EVENT_PARAM_NO_KEY', `${label} has a parameter without a key.`, { nodeId: n.id });
          else if (keys.has(p.key)) add('error', 'EVENT_PARAM_DUPLICATE', `${label} has duplicate parameter "${p.key}".`, { nodeId: n.id });
          keys.add(p.key);
          if (!isValueOfType(p.value, p.valueType)) add('error', 'EVENT_PARAM_TYPE', `Parameter "${p.key}" of ${label} does not match type ${p.valueType}.`, { nodeId: n.id });
        }
        for (const req of spec?.params.filter((p) => p.required) ?? []) {
          const p = n.data.params.find((x) => x.key === req.key);
          if (!p) add('error', 'EVENT_PARAM_MISSING', `${label} is missing required parameter "${req.key}".`, { nodeId: n.id });
          else if (p.valueType !== req.valueType) add('error', 'EVENT_PARAM_TYPE', `Parameter "${req.key}" of ${label} must be ${req.valueType}.`, { nodeId: n.id });
          else if (req.valueType === 'string' && typeof p.value === 'string' && !p.value.trim()) add('error', 'EVENT_PARAM_MISSING', `${label} requires a value for "${req.key}".`, { nodeId: n.id });
        }
        if (!connected(n, 'next')) add('error', 'MISSING_NEXT', `${label} is not connected to a next node.`, { nodeId: n.id });
        break;
      }
      case 'end':
        break;
    }
  }

  // --- reachability (needs a valid single start) ---
  if (start) {
    const reach = reachableFrom(graph, start.id);
    for (const n of graph.nodes) {
      if (!reach.has(n.id)) add('warning', 'UNREACHABLE', `${describeNode(n)} cannot be reached from Start (it is left out of the export).`, { nodeId: n.id });
    }
    if (!graph.nodes.some((n) => n.type === 'end' && reach.has(n.id))) add('warning', 'NO_END_REACHABLE', 'No End node is reachable from Start.');
    if (hasCycleFrom(graph, start.id)) add('warning', 'CYCLE', 'The graph contains a loop. Make sure the player can always leave it (the preview stops runaway loops).');
  }

  return issues;
}

export const errorsOf = (issues: ValidationIssue[]): ValidationIssue[] => issues.filter((i) => i.severity === 'error');
