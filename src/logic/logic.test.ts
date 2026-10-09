import { describe, expect, it } from 'vitest';
import { evaluateCondition } from './conditions';
import { applyOperation, initialStore } from './variables';
import { COALESCE_MS, canRedo, canUndo, commitFrom, createHistory, pushHistory, redo, replacePresent, undo } from './history';
import { connectNodes, copySelection, deleteSelection, pasteClipboard, pruneEdges, sameGraphContent } from './graphEdit';
import { newId } from '../model/ids';
import { vdef, simpleGraph, nodeOf } from '../test.helpers';
import { GraphBuilder } from '../samples/builder';
import type { EditorGraph } from '../model/types';

describe('conditions', () => {
  it('evaluates all six operators on ints', () => {
    expect(evaluateCondition(5, '==', 5)).toBe(true);
    expect(evaluateCondition(5, '!=', 5)).toBe(false);
    expect(evaluateCondition(5, '>', 4)).toBe(true);
    expect(evaluateCondition(5, '<', 4)).toBe(false);
    expect(evaluateCondition(5, '>=', 5)).toBe(true);
    expect(evaluateCondition(5, '<=', 4)).toBe(false);
  });
  it('supports equality for bool and string only', () => {
    expect(evaluateCondition(true, '==', true)).toBe(true);
    expect(evaluateCondition('a', '!=', 'b')).toBe(true);
    expect(() => evaluateCondition(true, '>', false)).toThrow();
    expect(() => evaluateCondition('a', '<', 'b')).toThrow();
  });
  it('rejects mismatched types', () => {
    expect(() => evaluateCondition(1, '==', '1')).toThrow(/Cannot compare/);
  });
});

describe('variables', () => {
  it('applies set / add / subtract', () => {
    expect(applyOperation(10, 'add', 5)).toBe(15);
    expect(applyOperation(10, 'subtract', 3)).toBe(7);
    expect(applyOperation(false, 'set', true)).toBe(true);
  });
  it('rejects invalid operations', () => {
    expect(() => applyOperation(true, 'add', true)).toThrow();
    expect(() => applyOperation(1, 'set', 'x')).toThrow();
  });
  it('builds the initial store with overrides by id', () => {
    const gold = vdef('gold', 'int', 100);
    const flag = vdef('flag', 'bool', false, 'local');
    expect(initialStore([gold, flag])).toEqual({ gold: 100, flag: false });
    expect(initialStore([gold, flag], { [gold.id]: 7 })).toEqual({ gold: 7, flag: false });
  });
});

describe('ids', () => {
  it('generates full-length unique ids', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId('n')));
    expect(ids.size).toBe(2000);
    expect([...ids][0]).toMatch(/^n_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('history', () => {
  it('undoes and redoes', () => {
    let h = createHistory(1);
    h = pushHistory(h, 2, 0);
    h = pushHistory(h, 3, 10);
    expect(h.present).toBe(3);
    h = undo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(3);
    expect(canUndo(h)).toBe(true);
  });
  it('coalesces keyed edits within the window only', () => {
    let h = createHistory('a');
    h = pushHistory(h, 'b', 0, 'type');
    h = pushHistory(h, 'bc', 100, 'type');
    h = pushHistory(h, 'bcd', 200, 'type');
    expect(h.past).toEqual(['a']);
    h = pushHistory(h, 'bcde', 200 + COALESCE_MS + 1, 'type');
    expect(h.past).toEqual(['a', 'bcd']);
  });
  it('a drag is one undo step', () => {
    let h = createHistory({ x: 0 });
    const base = h.present;
    for (let x = 1; x <= 30; x++) h = replacePresent(h, { x });
    h = commitFrom(h, base, (a, b) => a.x === b.x, 5);
    expect(h.past).toEqual([{ x: 0 }]);
    expect(undo(h).present).toEqual({ x: 0 });
  });
  it('a no-op drag adds no step', () => {
    const h = createHistory({ x: 0 });
    expect(commitFrom(h, h.present, (a, b) => a.x === b.x, 5).past).toHaveLength(0);
  });
  it('new edits clear redo', () => {
    let h = pushHistory(createHistory(1), 2, 0);
    h = undo(h);
    h = pushHistory(h, 9, 1);
    expect(h.future).toEqual([]);
  });
});

describe('graph editing', () => {
  it('connects, replaces an existing connection from the same handle, and rejects invalid ones', () => {
    const g = new GraphBuilder('t').start('s').say('a', 'A', 'x').say('b', 'A', 'y').build();
    const [s, a, b] = g.nodes.map((n) => n.id) as [string, string, string];
    let g2 = connectNodes(g, { source: s, sourceHandle: 'next', target: a });
    g2 = connectNodes(g2, { source: s, sourceHandle: 'next', target: b });
    expect(g2.edges).toHaveLength(1);
    expect(g2.edges[0]?.target).toBe(b);
    expect(connectNodes(g2, { source: a, sourceHandle: 'next', target: s })).toBe(g2); // into Start
    expect(connectNodes(g2, { source: a, sourceHandle: 'nope', target: b })).toBe(g2);
  });
  it('prunes edges of removed choices', () => {
    const g = new GraphBuilder('t').start('s').choice('c', 'a', 'b').end('e', 'x').link('c', 0, 'e').link('c', 1, 'e').build();
    const c = nodeOf(g, 'choice');
    if (c.type !== 'choice') throw new Error();
    const trimmed: EditorGraph = { ...g, nodes: g.nodes.map((n) => (n.id === c.id && n.type === 'choice' ? { ...n, data: { choices: [n.data.choices[0] as never] } } : n)) };
    expect(pruneEdges(trimmed).edges).toHaveLength(1);
  });
  it('deletes selected nodes with their edges', () => {
    const g = simpleGraph();
    const sel = { ...g, nodes: g.nodes.map((n) => (n.type === 'dialogue' ? { ...n, selected: true } : n)) } as EditorGraph;
    const r = deleteSelection(sel);
    expect(r.nodes).toHaveLength(2);
    expect(r.edges).toHaveLength(0);
  });
  it('copy/paste remaps ids, choices and inner edges; Start is never copied', () => {
    const g = new GraphBuilder('t').start('s').choice('c', 'a', 'b').say('d', 'A', 'x').end('e', 'E')
      .link('s', 'next', 'c').link('c', 0, 'd').link('c', 1, 'e').link('d', 'next', 'e').build();
    const all = { ...g, nodes: g.nodes.map((n) => ({ ...n, selected: true })) } as EditorGraph;
    const clip = copySelection(all);
    expect(clip?.nodes.some((n) => n.type === 'start')).toBe(false);
    expect(clip?.edges).toHaveLength(3); // c→d, c→e, d→e (s→c excluded)
    const pasted = pasteClipboard(g, clip!, { x: 40, y: 40 });
    expect(pasted.nodes).toHaveLength(g.nodes.length + 3);
    const ids = new Set(pasted.nodes.map((n) => n.id));
    expect(ids.size).toBe(pasted.nodes.length);
    const newChoice = pasted.nodes.filter((n) => n.type === 'choice').find((n) => n.selected)!;
    if (newChoice.type !== 'choice') throw new Error();
    const handles = newChoice.data.choices.map((c) => `choice:${c.id}`);
    const out = pasted.edges.filter((e) => e.source === newChoice.id);
    expect(out.map((e) => e.sourceHandle).sort()).toEqual(handles.sort());
    for (const e of pasted.edges) expect(ids.has(e.source) && ids.has(e.target)).toBe(true);
    expect(sameGraphContent(g, g)).toBe(true);
  });
});
