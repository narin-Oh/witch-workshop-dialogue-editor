import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeGraphOf } from '../logic/projectOps';
import { createProject } from '../model/factory';
import { GraphBuilder } from '../samples/builder';
import type { EditorGraph, EditorNode } from '../model/types';
import { useEditorStore } from './editorStore';

const st = () => useEditorStore.getState();
const graph = (): EditorGraph => activeGraphOf(st().history.present);
const ids = (g: EditorGraph) => g.edges.map((e) => `${e.source}:${e.sourceHandle}>${e.target}`).sort();

/** Dialogue A at x=0, B at x=500 (right), C at x=0,y=500 (below), choice K at x=1000, condition Q at x=1000,y=500, end E at x=1500. */
function load(selectedKey = 'a', extra?: (b: GraphBuilder) => void) {
  const b = new GraphBuilder('t').start('s').say('a', 'A', 'a').say('b', 'A', 'b').say('c', 'A', 'c').choice('k', 'one', 'two').cond('q', 'flag', '==', true).end('e', 'E');
  extra?.(b);
  const g = b.build();
  const node = (key: string): EditorNode => g.nodes.find((n) => (n.type === 'dialogue' && n.data.text === key) || (n.type === 'end' && key === 'e') || (n.type === 'choice' && key === 'k') || (n.type === 'condition' && key === 'q') || (n.type === 'start' && key === 's'))!;
  const place = (key: string, x: number, y: number) => (node(key).position = { x, y });
  place('s', -600, 0); place('a', 0, 0); place('b', 500, 0); place('c', 0, 500); place('k', 1000, 0); place('q', 1000, 500); place('e', 1500, 0);
  node(selectedKey).selected = true;
  const p = createProject('T');
  st().loadProject({ ...p, graphs: [{ ...g, id: p.graphs[0]!.id }], activeGraphId: p.graphs[0]!.id });
  return { id: (key: string) => node(key).id };
}

beforeEach(() => {
  vi.stubGlobal('window', { confirm: vi.fn(() => true) });
});
afterEach(() => vi.unstubAllGlobals());

describe('Alt+arrow keyboard connect', () => {
  it('connects a single-output node to the nearest node in that direction, and undo/redo work', () => {
    const { id } = load('a');
    expect(st().connectDirectional('right')).toBe(true);
    expect(ids(graph())).toEqual([`${id('a')}:next>${id('b')}`]);
    st().undo();
    expect(graph().edges).toEqual([]);
    st().redo();
    expect(ids(graph())).toEqual([`${id('a')}:next>${id('b')}`]);
  });

  it('does nothing (and records no history) when no node lies in that direction', () => {
    load('a');
    const before = st().history.present;
    expect(st().connectDirectional('up')).toBe(true); // handled, but nothing to connect
    expect(st().history.present).toBe(before);
    expect(st().history.past.length).toBe(0);
  });

  it('requires exactly one selected node', () => {
    load('a');
    st().onNodesChange([{ id: graph().nodes[2]!.id, type: 'select', selected: true }]);
    expect(st().connectDirectional('right')).toBe(false);
    expect(graph().edges).toEqual([]);
  });

  it('End nodes have no output: nothing happens', () => {
    load('e');
    const before = st().history.present;
    expect(st().connectDirectional('left')).toBe(true);
    expect(st().history.present).toBe(before);
  });

  it('with several outputs it asks which output to use instead of picking the first', () => {
    const { id } = load('q');
    const before = st().history.present;
    expect(st().connectDirectional('left')).toBe(true); // nearest left of Q is C (below-left) or A... a node exists to the left
    expect(st().popover?.kind).toBe('output');
    expect(st().history.present).toBe(before); // nothing connected yet
    st().pickPopover('false');
    const e = graph().edges;
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ source: id('q'), sourceHandle: 'false' });
    expect(st().popover).toBeNull();
    st().undo();
    expect(graph().edges).toEqual([]);
  });

  it('a choice node connects the picked choice only', () => {
    const { id } = load('k');
    st().connectDirectional('right'); // target: E
    expect(st().popover).toMatchObject({ kind: 'output', sourceId: id('k'), targetId: id('e') });
    const choiceHandle = graph().nodes.find((n) => n.id === id('k'))!.type === 'choice' ? (graph().nodes.find((n) => n.id === id('k')) as Extract<EditorNode, { type: 'choice' }>).data.choices[1]!.id : '';
    st().pickPopover(`choice:${choiceHandle}`);
    expect(graph().edges).toHaveLength(1);
    expect(graph().edges[0]!.sourceHandle).toBe(`choice:${choiceHandle}`);
  });

  it('closing the menu leaves everything unchanged', () => {
    load('q');
    const before = st().history.present;
    st().connectDirectional('left');
    st().closePopover();
    expect(st().popover).toBeNull();
    expect(st().history.present).toBe(before);
  });

  it('never silently overwrites: asks before replacing a different connection, and declining changes nothing', () => {
    const { id } = load('a', (b) => b.link('a', 'next', 'c'));
    const confirm = vi.fn(() => false);
    vi.stubGlobal('window', { confirm });
    st().connectDirectional('right'); // existing A->C, nearest right is B
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(ids(graph())).toEqual([`${id('a')}:next>${id('c')}`]);
    expect(st().history.past.length).toBe(0);
    confirm.mockReturnValue(true);
    st().connectDirectional('right');
    expect(ids(graph())).toEqual([`${id('a')}:next>${id('b')}`]);
    st().undo();
    expect(ids(graph())).toEqual([`${id('a')}:next>${id('c')}`]);
  });

  it('connecting to the node it is already connected to is a no-op without a prompt', () => {
    const { id } = load('a', (b) => b.link('a', 'next', 'b'));
    const confirm = vi.fn(() => true);
    vi.stubGlobal('window', { confirm });
    st().connectDirectional('right');
    expect(confirm).not.toHaveBeenCalled();
    expect(ids(graph())).toEqual([`${id('a')}:next>${id('b')}`]);
    expect(st().history.past.length).toBe(0);
  });

  it('applies the existing validation rules (nothing may connect into Start)', () => {
    const { id } = load('a');
    st().applyConnection(id('a'), 'next', id('s'));
    expect(graph().edges).toEqual([]);
    expect(st().toast?.kind).toBe('error');
    st().applyConnection(id('a'), 'true', id('b')); // not an output of a dialogue node
    expect(graph().edges).toEqual([]);
  });
});

describe('handle double-click', () => {
  const dbl = (nodeId: string, type: 'source' | 'target', handleId: string | null, hadGesture = false) =>
    st().handleDoubleClick({ nodeId, type, handleId, hadGesture, point: { x: 10, y: 10 } }, () => {});

  it('removes only the connection on an output handle; the node stays; undo/redo work', () => {
    const { id } = load('a', (b) => b.link('a', 'next', 'b').link('b', 'next', 'c'));
    const nodes = graph().nodes.length;
    dbl(id('a'), 'source', 'next');
    expect(ids(graph())).toEqual([`${id('b')}:next>${id('c')}`]);
    expect(graph().nodes).toHaveLength(nodes);
    st().undo();
    expect(graph().edges).toHaveLength(2);
    st().redo();
    expect(graph().edges).toHaveLength(1);
  });

  it('removes the single connection on an input handle', () => {
    const { id } = load('a', (b) => b.link('a', 'next', 'b'));
    dbl(id('b'), 'target', 'in');
    expect(graph().edges).toEqual([]);
  });

  it('with several incoming connections, asks which one to remove and removes only that one', () => {
    const { id } = load('a', (b) => b.link('a', 'next', 'b').link('c', 'next', 'b'));
    dbl(id('b'), 'target', 'in');
    expect(graph().edges).toHaveLength(2); // nothing removed yet
    const p = st().popover;
    expect(p?.kind).toBe('edge');
    const victim = graph().edges.find((e) => e.source === id('c'))!;
    st().pickPopover(victim.id);
    expect(ids(graph())).toEqual([`${id('a')}:next>${id('b')}`]);
    st().undo();
    expect(graph().edges).toHaveLength(2);
  });

  it('a handle with nothing attached changes nothing', () => {
    const { id } = load('a');
    const before = st().history.present;
    dbl(id('a'), 'source', 'next');
    expect(st().history.present).toBe(before);
  });

  it('during a connection gesture, double-click cancels only the gesture and keeps existing connections', () => {
    const { id } = load('a', (b) => b.link('a', 'next', 'b'));
    const before = st().history.present;
    const clear = vi.fn();
    st().handleDoubleClick({ nodeId: id('b'), type: 'target', handleId: 'in', hadGesture: true, point: { x: 0, y: 0 } }, clear);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(st().history.present).toBe(before);
    expect(ids(graph())).toEqual([`${id('a')}:next>${id('b')}`]);
  });

  it('reverts exactly the click-connection that the first click of the double-click created', () => {
    const { id } = load('a', (b) => b.link('c', 'next', 'b'));
    const pre = st().history.present;
    st().onConnect({ source: id('a'), sourceHandle: 'next', target: id('b') }, true); // click 1 completes a connect
    expect(graph().edges).toHaveLength(2);
    st().handleDoubleClick({ nodeId: id('b'), type: 'target', handleId: 'in', hadGesture: true, point: { x: 0, y: 0 } }, () => {});
    expect(st().history.present).toBe(pre);
    expect(ids(graph())).toEqual([`${id('c')}:next>${id('b')}`]); // the pre-existing connection survives
    expect(st().history.past.length).toBe(0);
    expect(st().history.future.length).toBe(0);
  });

  it('does not revert an older connection (or one followed by other edits)', () => {
    const { id } = load('a');
    st().onConnect({ source: id('a'), sourceHandle: 'next', target: id('b') }, true);
    st().onConnect({ source: id('b'), sourceHandle: 'next', target: id('c') }, false); // another connection edit since
    const present = st().history.present;
    st().handleDoubleClick({ nodeId: id('b'), type: 'target', handleId: 'in', hadGesture: true, point: { x: 0, y: 0 } }, () => {});
    expect(st().history.present).toBe(present);
    expect(graph().edges).toHaveLength(2);
  });

  it('drag connections (not click) are never reverted by a gesture double-click', () => {
    const { id } = load('a');
    st().onConnect({ source: id('a'), sourceHandle: 'next', target: id('b') }, false);
    const present = st().history.present;
    st().handleDoubleClick({ nodeId: id('c'), type: 'target', handleId: 'in', hadGesture: true, point: { x: 0, y: 0 } }, () => {});
    expect(st().history.present).toBe(present);
  });
});
