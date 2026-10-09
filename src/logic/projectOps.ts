import type { EditorGraph, EditorProject, Value, VariableDef } from '../model/types';
import { newId } from '../model/ids';
import { coerceValue, defaultValueFor, operationsFor, operatorsFor } from './values';

export function activeGraphOf(p: EditorProject): EditorGraph {
  return p.graphs.find((g) => g.id === p.activeGraphId) ?? (p.graphs[0] as EditorGraph);
}

export function updateActiveGraph(p: EditorProject, fn: (g: EditorGraph) => EditorGraph): EditorProject {
  const g = activeGraphOf(p);
  const next = fn(g);
  return next === g ? p : { ...p, graphs: p.graphs.map((x) => (x.id === g.id ? next : x)) };
}

export function uniqueVariableName(vars: VariableDef[], base = 'variable'): string {
  const names = new Set(vars.map((v) => v.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base}${i}`)) return `${base}${i}`;
}

export function newVariable(vars: VariableDef[]): VariableDef {
  return { id: newId('v'), name: uniqueVariableName(vars), type: 'int', scope: 'global', initialValue: 0 };
}

/** Update a variable definition. Renames propagate to every node that references it; a type change coerces values. */
export function updateVariable(p: EditorProject, id: string, patch: Partial<Omit<VariableDef, 'id'>>): EditorProject {
  const old = p.variables.find((v) => v.id === id);
  if (!old) return p;
  let next: VariableDef = { ...old, ...patch };
  if (patch.type && patch.type !== old.type) next = { ...next, initialValue: coerceValue(old.initialValue, patch.type) };
  if (patch.initialValue !== undefined) next = { ...next, initialValue: coerceValue(patch.initialValue, next.type) };
  const overrides = { ...p.previewOverrides };
  if (patch.type && patch.type !== old.type) delete overrides[id];
  const renamed = next.name !== old.name;
  const typeChanged = next.type !== old.type;
  const graphs = renamed || typeChanged
    ? p.graphs.map((g) => ({
        ...g,
        nodes: g.nodes.map((n) => {
          if (n.type === 'condition' && n.data.variable === old.name) {
            return { ...n, data: { ...n.data, variable: next.name, ...(typeChanged ? { value: coerceValue(n.data.value, next.type), operator: operatorsFor(next.type).includes(n.data.operator) ? n.data.operator : '==' } : {}) } };
          }
          if (n.type === 'variable' && n.data.variable === old.name) {
            return { ...n, data: { ...n.data, variable: next.name, ...(typeChanged ? { value: coerceValue(n.data.value, next.type), operation: operationsFor(next.type).includes(n.data.operation) ? n.data.operation : 'set' } : {}) } };
          }
          return n;
        }),
      }))
    : p.graphs;
  return { ...p, graphs, previewOverrides: overrides, variables: p.variables.map((v) => (v.id === id ? next : v)) };
}

export function removeVariable(p: EditorProject, id: string): EditorProject {
  const overrides = { ...p.previewOverrides };
  delete overrides[id];
  return { ...p, variables: p.variables.filter((v) => v.id !== id), previewOverrides: overrides };
}

export function setPreviewOverride(p: EditorProject, id: string, value: Value | undefined): EditorProject {
  const overrides = { ...p.previewOverrides };
  if (value === undefined) delete overrides[id];
  else overrides[id] = value;
  return { ...p, previewOverrides: overrides };
}

/** Names of variables referenced by nodes in a graph (for "in use" hints). */
export function variablesInUse(g: EditorGraph): Set<string> {
  const s = new Set<string>();
  for (const n of g.nodes) if ((n.type === 'condition' || n.type === 'variable') && n.data.variable) s.add(n.data.variable);
  return s;
}

export { defaultValueFor };
