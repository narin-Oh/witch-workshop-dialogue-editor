import { describe, expect, it } from 'vitest';
import { exportRuntime, ExportError, runtimeToJson } from './runtimeExport';
import { cleanProject, parseProject, ProjectFileError, serializeProject } from './projectFile';
import { loadAutosave, saveAutosave } from './autosave';
import { createSampleProject } from '../samples';
import { createProject } from '../model/factory';
import { GraphBuilder } from '../samples/builder';
import { vdef } from '../test.helpers';
import type { RuntimeDialogue, RuntimeNode } from '../model/runtime';
import type { EditorGraph } from '../model/types';

function memoryStorage(failWrite = false): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => { if (failWrite) throw new DOMException('full', 'QuotaExceededError'); m.set(k, v); },
  };
}

describe('project file', () => {
  it('round-trips the sample project without data loss', () => {
    const p = createSampleProject();
    const back = parseProject(serializeProject(p));
    expect(back).toEqual(cleanProject(p));
  });
  it('strips transient selection/measurement state', () => {
    const p = createSampleProject();
    const g = p.graphs[0] as EditorGraph;
    const dirty = { ...p, graphs: [{ ...g, nodes: g.nodes.map((n) => ({ ...n, selected: true, measured: { width: 1, height: 2 } })) }] };
    expect(serializeProject(dirty)).not.toContain('measured');
    expect(serializeProject(dirty)).not.toContain('selected');
  });
  it('rejects bad files with readable errors', () => {
    expect(() => parseProject('not json')).toThrow(ProjectFileError);
    expect(() => parseProject('{}')).toThrow(/not a Witch Workshop/);
    expect(() => parseProject(JSON.stringify({ app: 'witch-workshop-dialogue-editor', formatVersion: 99 }))).toThrow(/Unsupported/);
    const p = JSON.parse(serializeProject(createProject()));
    p.project.graphs[0].nodes[0].type = 'bogus';
    expect(() => parseProject(JSON.stringify(p))).toThrow(/Unknown node type/);
  });
  it('keeps preview overrides for known variables only', () => {
    const p = createSampleProject();
    const v = p.variables[0]!;
    const withOv = { ...p, previewOverrides: { [v.id]: 77, ghost: 1 } };
    expect(parseProject(serializeProject(withOv)).previewOverrides).toEqual({ [v.id]: 77 });
  });
});

describe('autosave', () => {
  it('saves and restores', () => {
    const s = memoryStorage();
    const p = createSampleProject();
    expect(saveAutosave(p, s).ok).toBe(true);
    expect(loadAutosave(s)).toEqual(cleanProject(p));
  });
  it('reports write failures instead of throwing', () => {
    const r = saveAutosave(createProject(), memoryStorage(true));
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
  it('quarantines corrupt data rather than deleting it', () => {
    const s = memoryStorage();
    s.setItem('witch-workshop:autosave:v1', '{broken');
    expect(loadAutosave(s)).toBeNull();
    expect(s.getItem('witch-workshop:autosave:corrupt')).toBe('{broken');
    expect(s.getItem('witch-workshop:autosave:v1')).toBeNull();
  });
  it('works when storage is unavailable', () => {
    expect(saveAutosave(createProject(), null).ok).toBe(false);
    expect(loadAutosave(null)).toBeNull();
  });
});

const NODE_KEYS = ['id', 'type', 'speaker', 'displayName', 'text', 'portraitId', 'expression', 'choices', 'variable', 'operator', 'compare', 'nextTrue', 'nextFalse', 'operation', 'operand', 'eventName', 'eventParams', 'next', 'endingName'].sort();
const VALUE_KEYS = ['valueType', 'intValue', 'boolValue', 'stringValue'].sort();

describe('runtime export', () => {
  const project = createSampleProject();
  const graph = project.graphs[0] as EditorGraph;
  const data = exportRuntime(graph, project.variables);

  it('resolves the editor-only Start node to the first executable node', () => {
    expect(data.nodes.some((n) => (n.type as string) === 'start')).toBe(false);
    const start = graph.nodes.find((n) => n.type === 'start')!;
    const firstId = graph.edges.find((e) => e.source === start.id)!.target;
    expect(data.startNodeId).toBe(firstId);
    expect(data.nodes.find((n) => n.id === data.startNodeId)).toBeTruthy();
  });
  it('uses one fixed field set on every node and typed values (JsonUtility-safe)', () => {
    const typed = (v: Record<string, unknown>) => {
      expect(Object.keys(v).sort()).toEqual(VALUE_KEYS);
      expect(['int', 'bool', 'string']).toContain(v.valueType);
      expect(typeof v.intValue).toBe('number');
      expect(typeof v.boolValue).toBe('boolean');
      expect(typeof v.stringValue).toBe('string');
    };
    for (const n of data.nodes) {
      expect(Object.keys(n).sort()).toEqual(NODE_KEYS);
      typed(n.compare as never);
      typed(n.operand as never);
      for (const p of n.eventParams) expect(Object.keys(p).sort()).toEqual(['key', ...VALUE_KEYS].sort());
      for (const c of n.choices) expect(Object.keys(c).sort()).toEqual(['id', 'next', 'text']);
    }
    for (const v of data.variables) { typed(v.initial as never); expect(Object.keys(v).sort()).toEqual(['initial', 'name', 'scope', 'valueType']); }
  });
  it('contains no null and no mixed-type values anywhere in the JSON', () => {
    const walk = (x: unknown) => {
      expect(x).not.toBeNull();
      expect(x).not.toBeUndefined();
      if (Array.isArray(x)) x.forEach(walk);
      else if (typeof x === 'object') Object.values(x as object).forEach(walk);
    };
    walk(JSON.parse(runtimeToJson(data)));
  });
  it('points every link at an existing node or leaves it empty', () => {
    const ids = new Set(data.nodes.map((n) => n.id));
    const links = (n: RuntimeNode) => [n.next, n.nextTrue, n.nextFalse, ...n.choices.map((c) => c.next)];
    for (const n of data.nodes) for (const l of links(n)) if (l) expect(ids.has(l)).toBe(true);
    const dlg = data.nodes.find((n) => n.type === 'dialogue')!;
    expect(dlg.next).toBeTruthy();
  });
  it('exports variable scopes and only the variables used', () => {
    const gold = data.variables.find((v) => v.name === 'gold')!;
    expect(gold.scope).toBe('global');
    expect(data.variables.find((v) => v.name === 'haggle')?.scope).toBe('local');
    expect(data.variables.some((v) => v.name === 'moonpetals')).toBe(false); // belongs to the other sample
  });
  it('is stable: exporting twice yields identical JSON, and it survives a JSON round trip', () => {
    const again = exportRuntime(graph, project.variables);
    expect(runtimeToJson(again)).toBe(runtimeToJson(data));
    expect(JSON.parse(runtimeToJson(data)) as RuntimeDialogue).toEqual(data);
  });
  it('refuses to export graphs with errors', () => {
    const bad = new GraphBuilder('bad').start('s').say('d', 'A', '').link('s', 'next', 'd').build();
    expect(() => exportRuntime(bad, [])).toThrow(ExportError);
    try { exportRuntime(bad, []); } catch (e) { expect((e as ExportError).issues.length).toBeGreaterThan(0); }
  });
  it('omits unreachable nodes and keeps warnings exportable', () => {
    const g = new GraphBuilder('t').start('s').say('d', 'A', 'x').end('e', 'x').end('orphan', 'y').link('s', 'next', 'd').link('d', 'next', 'e').build();
    const d = exportRuntime(g, [vdef('unused', 'int', 0)]);
    expect(d.nodes).toHaveLength(2);
    expect(d.variables).toHaveLength(0);
  });
});
