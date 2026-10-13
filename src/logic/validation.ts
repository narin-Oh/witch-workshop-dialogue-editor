import { findEventSpec } from '../model/eventCatalog';
import type { EditorGraph, EditorNode, Severity, ValidationIssue, VariableDef } from '../model/types';
import { hasCycleFrom, nodeMap, outputHandles, reachableFrom } from './graphUtils';
import { isValueOfType, operatorsFor, operationsFor } from './values';
import { translate, type Params } from '../i18n/translate';

/** Language-neutral node descriptor for messages; translated at display time (e.g. Dialogue "Hi" in English, the Korean equivalent in Korean). */
export function nodeParams(n: EditorNode): Params {
  switch (n.type) {
    case 'dialogue':
      return { nodeType: n.type, nodeText: n.data.text || n.data.speaker };
    case 'end':
      return { nodeType: n.type, nodeText: n.data.endingName };
    case 'event':
      return { nodeType: n.type, nodeText: n.data.eventName };
    case 'condition':
    case 'variable':
      return { nodeType: n.type, nodeText: n.data.variable };
    default:
      return { nodeType: n.type };
  }
}
const truncate = (s: string, n = 24): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Validates one graph against the project's variable definitions. Pure; returns all issues. */
export function validateGraph(graph: EditorGraph, variables: VariableDef[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let seq = 0;
  const add = (severity: Severity, code: string, params: Params = {}, ref: { nodeId?: string; edgeId?: string } = {}, variant?: string) => {
    const key = `issue.${variant ?? code}`;
    issues.push({ id: `${code}#${seq++}`, severity, code, key, params, message: translate('en', key, params), ...ref });
  };

  const nodes = nodeMap(graph);
  const varByName = new Map(variables.map((v) => [v.name, v]));

  // --- project-level variable definitions ---
  const seenNames = new Set<string>();
  for (const v of variables) {
    if (!v.name.trim()) add('error', 'VARIABLE_NAME_EMPTY');
    else if (seenNames.has(v.name)) add('error', 'VARIABLE_NAME_DUPLICATE', { name: v.name });
    else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.name)) add('error', 'VARIABLE_NAME_INVALID', { name: v.name });
    seenNames.add(v.name);
    if (!isValueOfType(v.initialValue, v.type)) add('error', 'VARIABLE_INITIAL_TYPE', { name: v.name, type: v.type });
  }

  // --- structural: ids, start node ---
  const idCount = new Map<string, number>();
  for (const n of graph.nodes) idCount.set(n.id, (idCount.get(n.id) ?? 0) + 1);
  for (const [id, c] of idCount) if (c > 1) add('error', 'DUPLICATE_NODE_ID', { id, count: c }, { nodeId: id });

  const starts = graph.nodes.filter((n) => n.type === 'start');
  if (starts.length === 0) add('error', 'NO_START');
  for (const extra of starts.slice(1)) add('error', 'MULTIPLE_START', {}, { nodeId: extra.id });
  const start = starts[0];

  // --- edges ---
  const perHandle = new Map<string, number>();
  for (const e of graph.edges) {
    const src = nodes.get(e.source);
    const dst = nodes.get(e.target);
    if (!src || !dst) {
      add('error', 'BROKEN_EDGE', {}, { edgeId: e.id, nodeId: src?.id ?? dst?.id });
      continue;
    }
    if (!outputHandles(src).some((h) => h.id === e.sourceHandle)) {
      add('error', 'BROKEN_EDGE', { ...nodeParams(src), handle: e.sourceHandle }, { edgeId: e.id, nodeId: src.id }, 'BROKEN_EDGE_HANDLE');
    }
    if (dst.type === 'start') add('error', 'EDGE_INTO_START', {}, { edgeId: e.id, nodeId: dst.id });
    const k = `${e.source}|${e.sourceHandle}`;
    perHandle.set(k, (perHandle.get(k) ?? 0) + 1);
  }
  for (const [k, c] of perHandle) {
    if (c > 1) {
      const [nodeId] = k.split('|');
      add('error', 'DUPLICATE_OUTPUT', {}, { nodeId });
    }
  }

  const connected = (n: EditorNode, handle: string) => graph.edges.some((e) => e.source === n.id && e.sourceHandle === handle && nodes.has(e.target));

  // --- per node ---
  for (const n of graph.nodes) {
    const np = nodeParams(n);
    const ref = { nodeId: n.id };
    switch (n.type) {
      case 'start':
        if (!connected(n, 'next')) add('error', 'START_NO_NEXT', {}, ref);
        break;
      case 'dialogue':
        if (!n.data.text.trim()) add('error', 'DIALOGUE_EMPTY_TEXT', np, ref);
        if (n.data.displayMode === 'character' && !n.data.speaker.trim() && !n.data.speakerOverride.trim()) add('warning', 'DIALOGUE_NO_SPEAKER', np, ref);
        if (!connected(n, 'next')) add('error', 'MISSING_NEXT', np, ref);
        break;
      case 'choice': {
        if (n.data.choices.length === 0) add('error', 'CHOICE_NONE', {}, ref);
        n.data.choices.forEach((c, i) => {
          if (!c.text.trim()) add('error', 'CHOICE_EMPTY_TEXT', { n: i + 1 }, ref);
          if (!connected(n, `choice:${c.id}`)) add('error', 'CHOICE_NOT_CONNECTED', { n: i + 1, text: c.text ? ` "${truncate(c.text)}"` : '' }, ref);
        });
        break;
      }
      case 'condition': {
        const v = varByName.get(n.data.variable);
        if (!n.data.variable) add('error', 'CONDITION_NO_VARIABLE', {}, ref);
        else if (!v) add('error', 'CONDITION_UNKNOWN_VARIABLE', { name: n.data.variable }, ref);
        else {
          if (!operatorsFor(v.type).includes(n.data.operator)) add('error', 'CONDITION_BAD_OPERATOR', { op: n.data.operator, type: v.type, name: v.name }, ref);
          if (!isValueOfType(n.data.value, v.type)) add('error', 'CONDITION_VALUE_TYPE', { type: v.type, name: v.name }, ref);
        }
        if (!connected(n, 'true')) add('error', 'CONDITION_TRUE_MISSING', np, ref);
        if (!connected(n, 'false')) add('error', 'CONDITION_FALSE_MISSING', np, ref);
        break;
      }
      case 'variable': {
        const v = varByName.get(n.data.variable);
        if (!n.data.variable) add('error', 'VARIABLE_NO_VARIABLE', {}, ref);
        else if (!v) add('error', 'VARIABLE_UNKNOWN', { name: n.data.variable }, ref);
        else {
          if (!operationsFor(v.type).includes(n.data.operation)) add('error', 'VARIABLE_BAD_OPERATION', { op: n.data.operation, type: v.type, name: v.name }, ref);
          if (!isValueOfType(n.data.value, v.type)) add('error', 'VARIABLE_VALUE_TYPE', { type: v.type, name: v.name }, ref);
        }
        if (!connected(n, 'next')) add('error', 'MISSING_NEXT', np, ref);
        break;
      }
      case 'event': {
        if (!n.data.eventName.trim()) add('error', 'EVENT_NO_NAME', {}, ref);
        const spec = findEventSpec(n.data.eventName);
        const keys = new Set<string>();
        for (const p of n.data.params) {
          if (!p.key.trim()) add('error', 'EVENT_PARAM_NO_KEY', np, ref);
          else if (keys.has(p.key)) add('error', 'EVENT_PARAM_DUPLICATE', { ...np, key: p.key }, ref);
          keys.add(p.key);
          if (!isValueOfType(p.value, p.valueType)) add('error', 'EVENT_PARAM_TYPE', { ...np, key: p.key, type: p.valueType }, ref);
        }
        for (const req of spec?.params.filter((p) => p.required) ?? []) {
          const p = n.data.params.find((x) => x.key === req.key);
          if (!p) add('error', 'EVENT_PARAM_MISSING', { ...np, key: req.key }, ref);
          else if (p.valueType !== req.valueType) add('error', 'EVENT_PARAM_TYPE', { ...np, key: req.key, type: req.valueType }, ref);
          else if (req.valueType === 'string' && typeof p.value === 'string' && !p.value.trim()) add('error', 'EVENT_PARAM_MISSING', { ...np, key: req.key }, ref, 'EVENT_PARAM_EMPTY');
        }
        if (!connected(n, 'next')) add('error', 'MISSING_NEXT', np, ref);
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
      if (!reach.has(n.id)) add('warning', 'UNREACHABLE', nodeParams(n), { nodeId: n.id });
    }
    if (!graph.nodes.some((n) => n.type === 'end' && reach.has(n.id))) add('warning', 'NO_END_REACHABLE');
    if (hasCycleFrom(graph, start.id)) add('warning', 'CYCLE');
  }

  return issues;
}

export const errorsOf = (issues: ValidationIssue[]): ValidationIssue[] => issues.filter((i) => i.severity === 'error');
