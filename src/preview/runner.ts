import { evaluateCondition } from '../logic/conditions';
import { choiceHandle, getTarget, nodeMap } from '../logic/graphUtils';
import { applyOperation, initialStore, type VariableStore } from '../logic/variables';
import type { EditorGraph, EditorNode, Value, VariableDef } from '../model/types';
import { formatValue } from '../logic/values';

/** Maximum consecutive non-interactive nodes before the runner assumes an infinite loop. */
export const MAX_AUTO_STEPS = 200;
/** Maximum total nodes executed in one session. */
export const MAX_TOTAL_STEPS = 5000;

export type LogKind = 'dialogue' | 'choice' | 'condition' | 'variable' | 'event' | 'end' | 'error';
export interface LogEntry {
  kind: LogKind;
  nodeId?: string;
  message: string;
}
export interface PreviewEvent {
  name: string;
  params: Record<string, Value>;
}

export type PreviewStatus = 'dialogue' | 'choice' | 'finished' | 'error';
export interface PreviewState {
  status: PreviewStatus;
  /** Node currently waiting for the user (dialogue/choice), or the last node run. */
  nodeId?: string;
  speaker: string;
  text: string;
  portraitId: string;
  expression: string;
  choices: { id: string; text: string }[];
  vars: VariableStore;
  events: PreviewEvent[];
  log: LogEntry[];
  steps: number;
  endingName?: string;
  error?: string;
}

const blank = (vars: VariableStore): PreviewState => ({
  status: 'finished', speaker: '', text: '', portraitId: '', expression: '', choices: [], vars, events: [], log: [], steps: 0,
});

/** Begin a session at the Start node. Pure: returns a new state. */
export function startPreview(graph: EditorGraph, defs: VariableDef[], overrides: Record<string, Value> = {}): PreviewState {
  const state = blank(initialStore(defs, overrides));
  const starts = graph.nodes.filter((n) => n.type === 'start');
  if (starts.length !== 1) return fail(state, undefined, starts.length ? 'Multiple Start nodes.' : 'No Start node.');
  const start = starts[0] as EditorNode;
  const next = getTarget(graph, start.id, 'next');
  if (!next) return fail(state, start.id, 'Start is not connected to any node.');
  return run(graph, state, next);
}

/** Continue after a dialogue line. No-op unless the state is waiting on a dialogue. */
export function advance(graph: EditorGraph, state: PreviewState): PreviewState {
  if (state.status !== 'dialogue' || !state.nodeId) return state;
  const next = getTarget(graph, state.nodeId, 'next');
  if (!next) return fail(state, state.nodeId, 'Dialogue is not connected to a next node.');
  return run(graph, state, next);
}

/** Pick a choice. No-op unless the state is waiting on a choice and `choiceId` is offered. */
export function choose(graph: EditorGraph, state: PreviewState, choiceId: string): PreviewState {
  if (state.status !== 'choice' || !state.nodeId) return state;
  const picked = state.choices.find((c) => c.id === choiceId);
  if (!picked) return state;
  const logged: PreviewState = { ...state, log: [...state.log, { kind: 'choice', nodeId: state.nodeId, message: `Chose: "${picked.text}"` }] };
  const next = getTarget(graph, state.nodeId, choiceHandle(choiceId));
  if (!next) return fail(logged, state.nodeId, `Choice "${picked.text}" is not connected to a node.`);
  return run(graph, logged, next);
}

function fail(state: PreviewState, nodeId: string | undefined, message: string): PreviewState {
  return { ...state, status: 'error', nodeId, choices: [], error: message, log: [...state.log, { kind: 'error', nodeId, message }] };
}

function run(graph: EditorGraph, initial: PreviewState, firstId: string): PreviewState {
  const nodes = nodeMap(graph);
  let state: PreviewState = { ...initial, vars: { ...initial.vars }, events: [...initial.events], log: [...initial.log], error: undefined };
  let id: string | undefined = firstId;
  let auto = 0;

  const log = (kind: LogKind, nodeId: string, message: string) => state.log.push({ kind, nodeId, message });

  while (id !== undefined) {
    const node = nodes.get(id);
    if (!node) return fail(state, undefined, `A connection leads to a node that does not exist (${id}).`);
    if (state.steps >= MAX_TOTAL_STEPS) return fail(state, id, `Stopped after ${MAX_TOTAL_STEPS} steps: possible infinite loop.`);
    if (auto >= MAX_AUTO_STEPS) return fail(state, id, `Stopped after ${MAX_AUTO_STEPS} automatic steps without player input: infinite loop.`);
    state = { ...state, steps: state.steps + 1 };

    switch (node.type) {
      case 'start':
        return fail(state, id, 'A connection leads back into the Start node.');
      case 'dialogue': {
        const speaker = node.data.speakerOverride.trim() || node.data.speaker;
        log('dialogue', id, `${speaker || '???'}: ${node.data.text}`);
        return { ...state, status: 'dialogue', nodeId: id, speaker, text: node.data.text, portraitId: node.data.portraitId, expression: node.data.expression, choices: [] };
      }
      case 'choice': {
        if (node.data.choices.length === 0) return fail(state, id, 'Choice node has no choices.');
        log('choice', id, `Choices: ${node.data.choices.map((c) => `"${c.text}"`).join(' / ')}`);
        return { ...state, status: 'choice', nodeId: id, choices: node.data.choices.map((c) => ({ id: c.id, text: c.text })) };
      }
      case 'condition': {
        const left = state.vars[node.data.variable];
        if (left === undefined) return fail(state, id, `Condition uses undefined variable "${node.data.variable}".`);
        let result: boolean;
        try {
          result = evaluateCondition(left, node.data.operator, node.data.value);
        } catch (e) {
          return fail(state, id, `Invalid condition: ${(e as Error).message}.`);
        }
        log('condition', id, `${node.data.variable} (${formatValue(left)}) ${node.data.operator} ${formatValue(node.data.value)} → ${result}`);
        const t = getTarget(graph, id, result ? 'true' : 'false');
        if (!t) return fail(state, id, `The ${result ? 'True' : 'False'} branch of a condition is not connected.`);
        id = t;
        auto++;
        break;
      }
      case 'variable': {
        const cur = state.vars[node.data.variable];
        if (cur === undefined) return fail(state, id, `Variable node uses undefined variable "${node.data.variable}".`);
        try {
          const nv = applyOperation(cur, node.data.operation, node.data.value);
          state.vars[node.data.variable] = nv;
          log('variable', id, `${node.data.variable}: ${formatValue(cur)} → ${formatValue(nv)} (${node.data.operation} ${formatValue(node.data.value)})`);
        } catch (e) {
          return fail(state, id, `Invalid variable operation: ${(e as Error).message}.`);
        }
        const t = getTarget(graph, id, 'next');
        if (!t) return fail(state, id, 'Variable node is not connected to a next node.');
        id = t;
        auto++;
        break;
      }
      case 'event': {
        const params: Record<string, Value> = {};
        for (const p of node.data.params) params[p.key] = p.value;
        state.events.push({ name: node.data.eventName, params });
        log('event', id, `Event ${node.data.eventName || '(unnamed)'}(${Object.entries(params).map(([k, v]) => `${k}=${formatValue(v)}`).join(', ')})`);
        const t = getTarget(graph, id, 'next');
        if (!t) return fail(state, id, 'Event node is not connected to a next node.');
        id = t;
        auto++;
        break;
      }
      case 'end':
        log('end', id, `Ended${node.data.endingName ? `: ${node.data.endingName}` : ''}`);
        return { ...state, status: 'finished', nodeId: id, choices: [], endingName: node.data.endingName };
    }
  }
  return fail(state, undefined, 'Execution ended unexpectedly.');
}
