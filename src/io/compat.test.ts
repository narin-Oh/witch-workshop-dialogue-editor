import { describe, expect, it } from 'vitest';
import { exportRuntime } from './runtimeExport';
import { parseProject, serializeProject } from './projectFile';

/** A project file written by the pre-localization editor (formatVersion 1), kept verbatim as a compatibility fixture. */
const LEGACY = JSON.stringify({
  app: 'witch-workshop-dialogue-editor',
  formatVersion: 1,
  project: {
    formatVersion: 1, id: 'p_1', name: 'Legacy', activeGraphId: 'g_1', previewOverrides: { v_1: 5 },
    variables: [{ id: 'v_1', name: 'gold', type: 'int', scope: 'global', initialValue: 10 }],
    graphs: [{
      id: 'g_1', name: 'Legacy graph',
      nodes: [
        { id: 'n_s', type: 'start', position: { x: 0, y: 0 }, data: { note: '' } },
        { id: 'n_d', type: 'dialogue', position: { x: 300, y: 0 }, data: { speaker: 'Mira', speakerOverride: '', text: 'Hi', portraitId: 'mira', expression: 'neutral' } },
        { id: 'n_v', type: 'variable', position: { x: 600, y: 0 }, data: { variable: 'gold', operation: 'add', value: 5 } },
        { id: 'n_e', type: 'end', position: { x: 900, y: 0 }, data: { endingName: 'Done' } },
      ],
      edges: [
        { id: 'e1', source: 'n_s', sourceHandle: 'next', target: 'n_d' },
        { id: 'e2', source: 'n_d', sourceHandle: 'next', target: 'n_v' },
        { id: 'e3', source: 'n_v', sourceHandle: 'next', target: 'n_e' },
      ],
    }],
  },
});

describe('backward compatibility', () => {
  it('opens a pre-localization project file and keeps every identifier', () => {
    const p = parseProject(LEGACY);
    expect(p.graphs[0]!.nodes.map((n) => n.type)).toEqual(['start', 'dialogue', 'variable', 'end']);
    expect(p.previewOverrides).toEqual({ v_1: 5 });
    expect(JSON.parse(serializeProject(p)).project.graphs[0].nodes[1].id).toBe('n_d');
  });
  it('exports the legacy project with the unchanged runtime schema', () => {
    const p = parseProject(LEGACY);
    const data = exportRuntime(p.graphs[0]!, p.variables);
    expect(data.startNodeId).toBe('n_d');
    expect(data.nodes.map((n) => n.id)).toEqual(['n_d', 'n_v', 'n_e']);
    expect(data.nodes[1]).toMatchObject({ type: 'variable', variable: 'gold', operation: 'add', operand: { valueType: 'int', intValue: 5, boolValue: false, stringValue: '' }, next: 'n_e' });
    expect(Object.keys(data).sort()).toEqual(['id', 'name', 'nodes', 'schemaVersion', 'startNodeId', 'variables']);
  });
});
