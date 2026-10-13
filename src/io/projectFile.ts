import { NODE_TYPES, OPERATORS, normalizeDisplayMode } from '../model/types';
import type { EditorEdge, EditorGraph, EditorNode, EditorProject, Value, ValueType, VariableDef } from '../model/types';
import { isValueOfType } from '../logic/values';
import { stripTransient } from '../logic/graphEdit';
import { translate, type Params } from '../i18n/translate';

export const FILE_APP = 'witch-workshop-dialogue-editor';
export const FORMAT_VERSION = 1;

export class ProjectFileError extends Error {
  constructor(public readonly key: string, public readonly params: Params = {}) {
    super(translate('en', key, params));
  }
}

interface Envelope {
  app: typeof FILE_APP;
  formatVersion: typeof FORMAT_VERSION;
  project: EditorProject;
}

/** Remove transient React Flow state so saved files are deterministic. */
export function cleanProject(p: EditorProject): EditorProject {
  return {
    ...p,
    graphs: p.graphs.map((g) => ({
      ...g,
      nodes: g.nodes.map(stripTransient),
      edges: g.edges.map((e): EditorEdge => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target })),
    })),
  };
}

export function serializeProject(p: EditorProject): string {
  const env: Envelope = { app: FILE_APP, formatVersion: FORMAT_VERSION, project: cleanProject(p) };
  return JSON.stringify(env, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function fail(key: string, params?: Params): never {
  throw new ProjectFileError(key, params);
}

function checkValueType(t: unknown): ValueType {
  if (t === 'int' || t === 'bool' || t === 'string') return t;
  return fail('file.unknownValueType', { type: String(t) });
}

function checkVariable(v: unknown, i: number): VariableDef {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name)) return fail('file.variableMalformed', { n: i + 1 });
  const type = checkValueType(v.type);
  if (v.scope !== 'global' && v.scope !== 'local') fail('file.badScope', { name: v.name });
  if (!isValueOfType(v.initialValue, type)) fail('file.badInitial', { name: v.name, type });
  return { id: v.id, name: v.name, type, scope: v.scope as 'global' | 'local', initialValue: v.initialValue };
}

function checkNode(n: unknown): EditorNode {
  if (!isObj(n) || !isStr(n.id) || !isObj(n.position) || !isObj(n.data)) return fail('file.nodeMalformed');
  if (!isStr(n.type) || !(NODE_TYPES as readonly string[]).includes(n.type)) return fail('file.unknownNodeType', { type: String(n.type) });
  const { x, y } = n.position;
  if (typeof x !== 'number' || typeof y !== 'number') fail('file.badPosition', { id: n.id });
  const d = n.data;
  const need = (...keys: string[]) => keys.forEach((k) => { if (!(k in d)) fail('file.nodeMissingField', { id: String(n.id), type: String(n.type), field: k }); });
  switch (n.type) {
    case 'start': need('note'); break;
    case 'dialogue': need('speaker', 'speakerOverride', 'text', 'portraitId', 'expression'); break;
    case 'choice':
      need('choices');
      if (!Array.isArray(d.choices) || d.choices.some((c) => !isObj(c) || !isStr(c.id) || !isStr(c.text))) fail('file.badChoices', { id: n.id });
      break;
    case 'condition':
      need('variable', 'operator', 'value');
      if (!(OPERATORS as readonly string[]).includes(d.operator as string)) fail('file.badOperator', { id: n.id });
      break;
    case 'variable': need('variable', 'operation', 'value'); break;
    case 'event':
      need('eventName', 'params');
      if (!Array.isArray(d.params) || d.params.some((p) => !isObj(p) || !isStr(p.id) || !isStr(p.key))) fail('file.badParams', { id: n.id });
      break;
    case 'end': need('endingName'); break;
  }
  // Older files have no displayMode: those dialogue nodes are Character Dialogue. Unknown values fall back the same way.
  const data = n.type === 'dialogue' ? { ...d, displayMode: normalizeDisplayMode(d.displayMode) } : d;
  return { id: n.id, type: n.type, position: { x, y }, data } as unknown as EditorNode;
}

function checkGraph(g: unknown): EditorGraph {
  if (!isObj(g) || !isStr(g.id) || !isStr(g.name) || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return fail('file.graphMalformed');
  const edges = g.edges.map((e): EditorEdge => {
    if (!isObj(e) || !isStr(e.id) || !isStr(e.source) || !isStr(e.sourceHandle) || !isStr(e.target)) return fail('file.edgeMalformed');
    return { id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target };
  });
  return { id: g.id, name: g.name, nodes: g.nodes.map(checkNode), edges };
}

/** Parse and structurally validate a project file. Throws ProjectFileError with a readable message. */
export function parseProject(text: string): EditorProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('file.notJson');
  }
  if (!isObj(raw) || raw.app !== FILE_APP) return fail('file.notProject');
  if (raw.formatVersion !== FORMAT_VERSION) return fail('file.version', { version: String(raw.formatVersion) });
  const p = raw.project;
  if (!isObj(p) || !isStr(p.id) || !isStr(p.name) || !Array.isArray(p.variables) || !Array.isArray(p.graphs) || !isStr(p.activeGraphId)) return fail('file.malformed');
  const graphs = p.graphs.map(checkGraph);
  if (graphs.length === 0) fail('file.noGraphs');
  const variables = p.variables.map(checkVariable);
  const overrides: Record<string, Value> = {};
  if (isObj(p.previewOverrides)) {
    for (const [k, v] of Object.entries(p.previewOverrides)) {
      const def = variables.find((x) => x.id === k);
      if (def && isValueOfType(v, def.type)) overrides[k] = v;
    }
  }
  const activeGraphId = graphs.some((g) => g.id === p.activeGraphId) ? p.activeGraphId : (graphs[0] as EditorGraph).id;
  return { formatVersion: 1, id: p.id, name: p.name, variables, graphs, activeGraphId, previewOverrides: overrides };
}
