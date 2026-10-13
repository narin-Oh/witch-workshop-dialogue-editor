import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportRuntime, runtimeToJson } from './runtimeExport';
import { parseProject, serializeProject } from './projectFile';
import { createNode } from '../model/factory';
import { createProject } from '../model/factory';
import { GraphBuilder } from '../samples/builder';
import { advance, startPreview } from '../preview/runner';
import { errorsOf, validateGraph } from '../logic/validation';
import { activeGraphOf } from '../logic/projectOps';
import { useEditorStore } from '../store/editorStore';
import type { EditorGraph, EditorProject } from '../model/types';

/** Narration + scene text + character line, all with speaker/portrait values filled in so "preserved when hidden" is observable. */
function modesGraph(): EditorGraph {
  const b = new GraphBuilder('Modes').start('s').narrate('n', 'The shop is quiet.').scene('t', '10 minutes later...').say('c', 'Mira', 'You are back.').end('e', 'Done');
  b.link('s', 'next', 'n').link('n', 'next', 't').link('t', 'next', 'c').link('c', 'next', 'e');
  const g = b.build();
  for (const node of g.nodes) {
    if (node.type === 'dialogue' && node.data.displayMode !== 'character') node.data = { ...node.data, speaker: 'Hidden Mira', speakerOverride: 'Shown?', portraitId: 'mira', expression: 'happy' };
  }
  return g;
}
const wrap = (g: EditorGraph): EditorProject => ({ ...createProject('T'), graphs: [g], activeGraphId: g.id });
const dialogues = (g: EditorGraph) => g.nodes.filter((n) => n.type === 'dialogue') as Extract<EditorGraph['nodes'][number], { type: 'dialogue' }>[];

describe('dialogue display mode: data model and compatibility', () => {
  it('new Dialogue nodes default to Character Dialogue', () => {
    expect(createNode('dialogue', { x: 0, y: 0 }).data).toMatchObject({ displayMode: 'character' });
  });

  it('opens older project files (no displayMode) as Character Dialogue and exports them as "character"', () => {
    const p = wrap(modesGraph());
    const raw = JSON.parse(serializeProject(p));
    for (const n of raw.project.graphs[0].nodes) if (n.type === 'dialogue') delete n.data.displayMode; // what a pre-feature file looks like
    const opened = parseProject(JSON.stringify(raw));
    expect(dialogues(opened.graphs[0]!).map((n) => n.data.displayMode)).toEqual(['character', 'character', 'character']);
    const exported = exportRuntime(opened.graphs[0]!, opened.variables);
    expect(exported.nodes.filter((n) => n.type === 'dialogue').map((n) => n.displayMode)).toEqual(['character', 'character', 'character']);
  });

  it('treats an unknown displayMode value as Character Dialogue', () => {
    const raw = JSON.parse(serializeProject(wrap(modesGraph())));
    raw.project.graphs[0].nodes.find((n: { type: string }) => n.type === 'dialogue').data.displayMode = 'hologram';
    expect(dialogues(parseProject(JSON.stringify(raw)).graphs[0]!)[0]!.data.displayMode).toBe('character');
  });

  it('preserves the mode and the hidden speaker/portrait values through save and open', () => {
    const p = wrap(modesGraph());
    const text = serializeProject(p);
    const again = parseProject(text);
    expect(serializeProject(again)).toBe(text);
    const [narr, scene, chara] = dialogues(again.graphs[0]!);
    expect(narr!.data).toMatchObject({ displayMode: 'narration', speaker: 'Hidden Mira', speakerOverride: 'Shown?', portraitId: 'mira', expression: 'happy' });
    expect(scene!.data).toMatchObject({ displayMode: 'sceneTransition', speaker: 'Hidden Mira', portraitId: 'mira' });
    expect(chara!.data.displayMode).toBe('character');
  });
});

describe('dialogue display mode: Unity export', () => {
  const p = wrap(modesGraph());
  const exported = exportRuntime(p.graphs[0]!, p.variables);
  const byText = (t: string) => exported.nodes.find((n) => n.text === t)!;

  it('exports the mode on dialogue nodes and "" on every other node type', () => {
    expect(byText('The shop is quiet.').displayMode).toBe('narration');
    expect(byText('10 minutes later...').displayMode).toBe('sceneTransition');
    expect(byText('You are back.').displayMode).toBe('character');
    expect(exported.nodes.filter((n) => n.type !== 'dialogue').every((n) => n.displayMode === '')).toBe(true);
    expect(exported.schemaVersion).toBe(1);
  });

  it('exports no speaker or portrait for narration / scene text, but keeps them for character lines', () => {
    for (const t of ['The shop is quiet.', '10 minutes later...']) {
      const n = byText(t);
      expect([n.speaker, n.displayName, n.portraitId, n.expression]).toEqual(['', '', '', '']);
    }
    expect(byText('You are back.')).toMatchObject({ speaker: 'Mira', displayName: 'Mira', portraitId: 'mira' });
  });

  it('writes displayMode into the JSON text', () => {
    const json = runtimeToJson(exported);
    expect(json).toContain('"displayMode": "sceneTransition"');
    expect(JSON.parse(json).nodes.length).toBe(exported.nodes.length);
  });
});

describe('dialogue display mode: validation', () => {
  it('does not warn about a missing speaker for narration or scene text, but still does for character lines', () => {
    const g = modesGraph();
    for (const n of dialogues(g)) n.data = { ...n.data, speaker: '', speakerOverride: '' };
    const issues = validateGraph(g, []);
    const noSpeaker = issues.filter((i) => i.code === 'DIALOGUE_NO_SPEAKER');
    expect(noSpeaker).toHaveLength(1);
    expect(noSpeaker[0]!.nodeId).toBe(dialogues(g).find((n) => n.data.displayMode === 'character')!.id);
    expect(errorsOf(issues)).toEqual([]);
  });

  it('still validates text and connections in the other modes', () => {
    const g = modesGraph();
    const [narr, scene] = dialogues(g);
    narr!.data = { ...narr!.data, text: '  ' };
    const edgesWithoutScene = g.edges.filter((e) => e.source !== scene!.id);
    const codes = validateGraph({ ...g, edges: edgesWithoutScene }, []).map((i) => `${i.code}:${i.nodeId === narr!.id ? 'narr' : i.nodeId === scene!.id ? 'scene' : '?'}`);
    expect(codes).toContain('DIALOGUE_EMPTY_TEXT:narr');
    expect(codes).toContain('MISSING_NEXT:scene');
  });
});

describe('dialogue display mode: preview runner', () => {
  it('reports the mode for each line and advances scene text with the normal advance (no timer)', () => {
    const p = wrap(modesGraph());
    const g = p.graphs[0]!;
    let s = startPreview(g, p.variables);
    expect([s.status, s.displayMode, s.speaker, s.portraitId, s.text]).toEqual(['dialogue', 'narration', '', '', 'The shop is quiet.']);
    s = advance(g, s);
    expect([s.status, s.displayMode, s.speaker, s.portraitId, s.text]).toEqual(['dialogue', 'sceneTransition', '', '', '10 minutes later...']);
    s = advance(g, s); // one advance moves on: there is no delay state
    expect([s.status, s.displayMode, s.speaker]).toEqual(['dialogue', 'character', 'Mira']);
    expect(advance(g, s).status).toBe('finished');
  });
});

describe('dialogue display mode: undo / redo and switching modes', () => {
  beforeEach(() => {
    const p = wrap(modesGraph());
    useEditorStore.getState().loadProject(p);
  });
  const first = () => dialogues(activeGraphOf(useEditorStore.getState().history.present)).find((n) => n.data.text === 'You are back.')!;

  it('changing the mode is one undoable step and keeps speaker/portrait values when switching away and back', () => {
    const id = first().id;
    const st = () => useEditorStore.getState();
    st().updateNodeData(id, (d) => ({ ...d, displayMode: 'narration' }) as never);
    expect(first().data).toMatchObject({ displayMode: 'narration', speaker: 'Mira', portraitId: 'mira' });
    st().updateNodeData(id, (d) => ({ ...d, displayMode: 'character' }) as never);
    expect(first().data).toMatchObject({ displayMode: 'character', speaker: 'Mira', portraitId: 'mira' });
    st().undo();
    expect(first().data.displayMode).toBe('narration');
    st().undo();
    expect(first().data.displayMode).toBe('character');
    st().redo();
    expect(first().data.displayMode).toBe('narration');
  });
});

describe('user guide example docs/examples/display-modes-example', () => {
  const dir = new URL('../../docs/examples/', import.meta.url);
  const project = parseProject(readFileSync(new URL('display-modes-example.witchproj.json', dir), 'utf8'));
  const g = project.graphs[0]!;

  it('opens, validates cleanly and exports exactly the committed Unity JSON', () => {
    expect(validateGraph(g, project.variables)).toEqual([]);
    expect(dialogues(g).map((n) => n.data.displayMode)).toEqual(['character', 'narration', 'sceneTransition', 'character']);
    const committed = readFileSync(new URL('display-modes-example.dialogue.json', dir), 'utf8');
    expect(runtimeToJson(exportRuntime(g, project.variables))).toBe(committed.trimEnd());
  });

  it('shows "10 minutes later..." as scene text that advances with one normal advance', () => {
    let s = startPreview(g, project.variables);
    while (s.status === 'dialogue' && s.displayMode !== 'sceneTransition') s = advance(g, s);
    expect(s.text).toBe('10분 후...');
    expect(advance(g, s).displayMode).toBe('character');
  });
});
