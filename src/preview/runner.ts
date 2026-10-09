import { evaluateCondition } from '../logic/conditions';
import { choiceHandle, getTarget, nodeMap } from '../logic/graphUtils';
import { applyOperation, initialStore, type VariableStore } from '../logic/variables';
import type { EditorGraph, EditorNode, Value, VariableDef } from '../model/types';
import { formatValue } from '../logic/values';
import { translate, type Params } from '../i18n/translate';
import { ConditionError } from '../logic/conditions';
import { VariableError } from '../logic/variables';

/** Maximum consecutive non-interactive nodes before the runner assumes an infinite loop. */
export const MAX_AUTO_STEPS = 200;
/** Maximum total nodes executed in one session. */
export const MAX_TOTAL_STEPS = 5000;

export type LogKind = 'dialogue' | 'choice' | 'condition' | 'variable' | 'event' | 'end' | 'error';
export interface LogEntry {
  kind: LogKind;
  nodeId?: string;
  /** English message (for tests/logs); the UI renders `t(key, params)`. */
  message: string;
  key: string;
  params: Params;
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
  errorKey?: string;
  errorParams?: Params;
}

const blank = (vars: VariableStore): PreviewState => ({
  status: 'finished', speaker: '', text: '', portraitId: '', expression: '', choices: [], vars, events: [], log: [], steps: 0,
});

/** Begin a session at the Start node. Pure: returns a new state. */
export function startPreview(graph: EditorGraph, defs: VariableDef[], overrides: Record<string, Value> = {}): PreviewState {
  const state = blank(initialStore(defs, overrides));
  const starts = graph.nodes.filter((n) => n.type === 'start');
  if (starts.length !== 1) return fail(state, undefined, starts.length ? 'run.multiStart' : 'run.noStart');
  const start = starts[0] as EditorNode;
  const next = getTarget(graph, start.id, 'next');
  if (!next) return fail(state, start.id, 'run.startNotConnected');
  return run(graph, state, next);
}

/** Continue after a dialogue line. No-op unless the state is waiting on a dialogue. */
export function advance(graph: EditorGraph, state: PreviewState): PreviewState {
  if (state.status !== 'dialogue' || !state.nodeId) return state;
  const next = getTarget(graph, state.nodeId, 'next');
  if (!next) return fail(state, state.nodeId, 'run.dialogueNoNext');
  return run(graph, state, next);
}

/** Pick a choice. No-op unless the state is waiting on a choice and `choiceId` is offered. */
export function choose(graph: EditorGraph, state: PreviewState, choiceId: string): PreviewState {
  if (state.status !== 'choice' || !state.nodeId) return state;
  const picked = state.choices.find((c) => c.id === choiceId);
  if (!picked) return state;
  const logged: PreviewState = { ...state, log: [...state.log, entry('choice', state.nodeId, 'runlog.chose', { text: picked.text })] };
  const next = getTarget(graph, state.nodeId, choiceHandle(choiceId));
  if (!next) return fail(logged, state.nodeId, 'run.choiceNotConnected', { text: picked.text });
  return run(graph, logged, next);
}

function fail(state: PreviewState, nodeId: string | undefined, key: string, params: Params = {}): PreviewState {
  const message = translate('en', key, params);
  return {
    ...state, status: 'error', nodeId, choices: [], error: message, errorKey: key, errorParams: params,
    log: [...state.log, { kind: 'error', nodeId, message, key, params }],
  };
}

const entry = (kind: LogKind, nodeId: string | undefined, key: string, params: Params = {}): LogEntry => ({ kind, nodeId, key, params, message: translate('en', key, params) });

const reasonOf = (e: unknown): Params =>
  e instanceof ConditionError || e instanceof VariableError
    ? { reasonKey: e.key, reasonParams: JSON.stringify(e.params) }
    : { reasonKey: 'err.compareTypes', reasonParams: JSON.stringify({ a: '?', b: '?' }) };

function run(graph: EditorGraph, initial: PreviewState, firstId: string): PreviewState {
  const nodes = nodeMap(graph);
  let state: PreviewState = { ...initial, vars: { ...initial.vars }, events: [...initial.events], log: [...initial.log], error: undefined };
  let id: string | undefined = firstId;
  let auto = 0;

  const log = (kind: LogKind, nodeId: string, key: string, params: Params = {}) => state.log.push(entry(kind, nodeId, key, params));

  while (id !== undefined) {
    const node = nodes.get(id);
    if (!node) return fail(state, undefined, 'run.missingNode', { id });
    if (state.steps >= MAX_TOTAL_STEPS) return fail(state, id, 'run.loopTotal', { n: MAX_TOTAL_STEPS });
    if (auto >= MAX_AUTO_STEPS) return fail(state, id, 'run.loopAuto', { n: MAX_AUTO_STEPS });
    state = { ...state, steps: state.steps + 1 };

    switch (node.type) {
      case 'start':
        return fail(state, id, 'run.backToStart');
      case 'dialogue': {
        const speaker = node.data.speakerOverride.trim() || node.data.speaker;
        log('dialogue', id, 'runlog.dialogue', { speaker: speaker || '???', text: node.data.text });
        return { ...state, status: 'dialogue', nodeId: id, speaker, text: node.data.text, portraitId: node.data.portraitId, expression: node.data.expression, choices: [] };
      }
      case 'choice': {
        if (node.data.choices.length === 0) return fail(state, id, 'run.noChoices');
        log('choice', id, 'runlog.choices', { list: node.data.choices.map((c) => `"${c.text}"`).join(' / ') });
        return { ...state, status: 'choice', nodeId: id, choices: node.data.choices.map((c) => ({ id: c.id, text: c.text })) };
      }
      case 'condition': {
        const left = state.vars[node.data.variable];
        if (left === undefined) return fail(state, id, 'run.undefinedVarCondition', { name: node.data.variable });
        let result: boolean;
        try {
          result = evaluateCondition(left, node.data.operator, node.data.value);
        } catch (e) {
          return fail(state, id, 'run.invalidCondition', reasonOf(e));
        }
        log('condition', id, 'runlog.condition', { variable: node.data.variable, left: formatValue(left), op: node.data.operator, right: formatValue(node.data.value), result: String(result) });
        const t = getTarget(graph, id, result ? 'true' : 'false');
        if (!t) return fail(state, id, 'run.branchNotConnected', { branchValue: String(result) });
        id = t;
        auto++;
        break;
      }
      case 'variable': {
        const cur = state.vars[node.data.variable];
        if (cur === undefined) return fail(state, id, 'run.undefinedVarNode', { name: node.data.variable });
        try {
          const nv = applyOperation(cur, node.data.operation, node.data.value);
          state.vars[node.data.variable] = nv;
          log('variable', id, 'runlog.variable', { variable: node.data.variable, from: formatValue(cur), to: formatValue(nv), operation: node.data.operation, operand: formatValue(node.data.value) });
        } catch (e) {
          return fail(state, id, 'run.invalidOperation', reasonOf(e));
        }
        const t = getTarget(graph, id, 'next');
        if (!t) return fail(state, id, 'run.variableNoNext');
        id = t;
        auto++;
        break;
      }
      case 'event': {
        const params: Record<string, Value> = {};
        for (const p of node.data.params) params[p.key] = p.value;
        state.events.push({ name: node.data.eventName, params });
        log('event', id, node.data.eventName ? 'runlog.event' : 'runlog.eventUnnamed', { name: node.data.eventName, params: Object.entries(params).map(([k, v]) => `${k}=${formatValue(v)}`).join(', ') });
        const t = getTarget(graph, id, 'next');
        if (!t) return fail(state, id, 'run.eventNoNext');
        id = t;
        auto++;
        break;
      }
      case 'end':
        log('end', id, node.data.endingName ? 'runlog.endNamed' : 'runlog.end', { name: node.data.endingName });
        return { ...state, status: 'finished', nodeId: id, choices: [], endingName: node.data.endingName };
    }
  }
  return fail(state, undefined, 'run.unexpectedEnd');
}
