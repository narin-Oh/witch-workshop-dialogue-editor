import { describe, expect, it } from 'vitest';
import { findNearestInDirection } from './directional';
import { connectionProblem, removeEdges, connectNodes } from './graphEdit';
import { GraphBuilder } from '../samples/builder';
import type { EditorGraph } from '../model/types';

function layoutGraph() {
  const g = new GraphBuilder('t').start('s').say('a', 'A', 'a').say('r', 'A', 'right').say('far', 'A', 'far-right').say('l', 'A', 'left').say('u', 'A', 'up').say('d', 'A', 'down').end('e', 'E').build();
  const by = (text: string) => g.nodes.find((n) => (n.type === 'dialogue' && n.data.text === text) || (n.type === 'end' && n.data.endingName === text))!;
  const pos = (text: string, x: number, y: number) => (by(text).position = { x, y });
  pos('a', 1000, 1000);
  pos('right', 1400, 1010);
  pos('far-right', 2000, 1000);
  pos('left', 600, 990);
  pos('up', 1010, 600);
  pos('down', 990, 1400);
  g.nodes.find((n) => n.type === 'start')!.position = { x: 1400, y: 1000 };
  return { g: g as EditorGraph, id: (t: string) => by(t).id };
}

describe('findNearestInDirection', () => {
  it('picks the nearest node in each direction by visual position', () => {
    const { g, id } = layoutGraph();
    expect(findNearestInDirection(g, id('a'), 'right')?.id).toBe(id('right'));
    expect(findNearestInDirection(g, id('a'), 'left')?.id).toBe(id('left'));
    expect(findNearestInDirection(g, id('a'), 'up')?.id).toBe(id('up'));
    expect(findNearestInDirection(g, id('a'), 'down')?.id).toBe(id('down'));
  });

  it('never targets the Start node (no input) even when it is the nearest in that direction', () => {
    const { g, id } = layoutGraph();
    const start = g.nodes.find((n) => n.type === 'start')!;
    start.position = { x: 1200, y: 1000 }; // closer than "right"
    expect(findNearestInDirection(g, id('a'), 'right')?.id).toBe(id('right'));
  });

  it('returns undefined when nothing lies in that direction, or the node is unknown', () => {
    const { g, id } = layoutGraph();
    expect(findNearestInDirection(g, id('far-right'), 'right')).toBeUndefined();
    expect(findNearestInDirection(g, 'ghost', 'right')).toBeUndefined();
  });

  it('ignores nodes outside the 90-degree cone', () => {
    const g = new GraphBuilder('t').start('s').say('a', 'A', 'a').say('b', 'A', 'b').build();
    const a = g.nodes.find((n) => n.type === 'dialogue' && n.data.text === 'a')!;
    const b = g.nodes.find((n) => n.type === 'dialogue' && n.data.text === 'b')!;
    a.position = { x: 0, y: 0 };
    b.position = { x: 100, y: 400 }; // mostly below
    expect(findNearestInDirection(g, a.id, 'right')).toBeUndefined();
    expect(findNearestInDirection(g, a.id, 'down')?.id).toBe(b.id);
  });

  it('uses measured node sizes for centers', () => {
    const g = new GraphBuilder('t').start('s').say('a', 'A', 'a').say('b', 'A', 'b').say('c', 'A', 'c').build();
    const [a, b, c] = ['a', 'b', 'c'].map((t) => g.nodes.find((n) => n.type === 'dialogue' && n.data.text === t)!);
    a!.position = { x: 0, y: 0 };
    b!.position = { x: 500, y: 0 };
    c!.position = { x: 500, y: 300 };
    expect(findNearestInDirection(g, a!.id, 'right')?.id).toBe(b!.id);
    // a very tall b pushes its center far down; c becomes the nearer candidate to the right
    b!.measured = { width: 260, height: 1200 };
    expect(findNearestInDirection(g, a!.id, 'right')?.id).toBe(c!.id);
  });

  it('breaks distance ties by the smaller sideways offset', () => {
    const g = new GraphBuilder('t').start('s').say('a', 'A', 'a').say('b', 'A', 'b').say('c', 'A', 'c').build();
    const [a, b, c] = ['a', 'b', 'c'].map((t) => g.nodes.find((n) => n.type === 'dialogue' && n.data.text === t)!);
    a!.position = { x: 0, y: 0 };
    b!.position = { x: 300, y: 0 };
    c!.position = { x: 0, y: 300 }; // same distance, but down for 'right' is outside the cone anyway
    expect(findNearestInDirection(g, a!.id, 'right')?.id).toBe(b!.id);
  });
});

describe('connection rules and edge removal', () => {
  it('connectionProblem reports each rule', () => {
    const g = new GraphBuilder('t').start('s').say('a', 'A', 'a').choice('c', 'x', 'y').build();
    const [s, a, c] = [g.nodes[0]!, g.nodes[1]!, g.nodes[2]!];
    expect(connectionProblem(g, { source: a.id, sourceHandle: 'next', target: c.id })).toBeNull();
    expect(connectionProblem(g, { source: a.id, sourceHandle: 'next', target: s.id })).toBe('into-start');
    expect(connectionProblem(g, { source: a.id, sourceHandle: 'true', target: c.id })).toBe('bad-output');
    expect(connectionProblem(g, { source: 'ghost', sourceHandle: 'next', target: c.id })).toBe('missing-node');
  });

  it('removeEdges removes only the given edges and keeps every node', () => {
    const g = new GraphBuilder('t').start('s').say('a', 'A', 'a').say('b', 'A', 'b').build();
    const [s, a, b] = [g.nodes[0]!, g.nodes[1]!, g.nodes[2]!];
    let g2 = connectNodes(g, { source: s.id, sourceHandle: 'next', target: a.id });
    g2 = connectNodes(g2, { source: a.id, sourceHandle: 'next', target: b.id });
    const first = g2.edges[0]!;
    const r = removeEdges(g2, [first.id]);
    expect(r.edges.map((e) => e.id)).toEqual([g2.edges[1]!.id]);
    expect(r.nodes).toBe(g2.nodes);
    expect(removeEdges(g2, ['nope'])).toBe(g2);
  });
});
