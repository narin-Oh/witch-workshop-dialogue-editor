import { describe, expect, it } from 'vitest';
import { advance, choose, startPreview, MAX_AUTO_STEPS, type PreviewState } from './runner';
import { GraphBuilder } from '../samples/builder';
import { simpleGraph, vdef } from '../test.helpers';
import type { EditorGraph } from '../model/types';

const vars = [vdef('gold', 'int', 10), vdef('flag', 'bool', false)];

describe('runner', () => {
  it('plays a linear conversation to the end', () => {
    const g = simpleGraph();
    let s = startPreview(g, []);
    expect(s.status).toBe('dialogue');
    expect(s.text).toBe('Hello');
    s = advance(g, s);
    expect(s.status).toBe('finished');
    expect(s.endingName).toBe('Done');
  });
  it('follows choices and logs them', () => {
    const g = new GraphBuilder('t').start('s').choice('c', 'left', 'right').say('l', 'A', 'L').say('r', 'A', 'R').end('e', 'x')
      .link('s', 'next', 'c').link('c', 0, 'l').link('c', 1, 'r').link('l', 'next', 'e').link('r', 'next', 'e').build();
    let s = startPreview(g, []);
    expect(s.status).toBe('choice');
    s = choose(g, s, s.choices[1]!.id);
    expect(s.text).toBe('R');
    expect(s.log.some((l) => l.message.includes('right'))).toBe(true);
    expect(choose(g, s, 'bogus')).toBe(s);
  });
  it('branches on conditions, tracks variables and logs events', () => {
    const build = () => new GraphBuilder('t').start('s').cond('c', 'gold', '>=', 20).set('add', 'gold', 'add', 15).say('rich', 'A', 'rich').say('poor', 'A', 'poor')
      .event('ev', 'GiveItem', { itemId: 'herb', amount: 2 }).end('e', 'x')
      .link('s', 'next', 'c').link('c', 'true', 'rich').link('c', 'false', 'add').link('add', 'next', 'ev').link('ev', 'next', 'poor').link('rich', 'next', 'e').link('poor', 'next', 'e').build();
    const g = build();
    const s = startPreview(g, vars);
    expect(s.text).toBe('poor');
    expect(s.vars.gold).toBe(25);
    expect(s.events).toEqual([{ name: 'GiveItem', params: { itemId: 'herb', amount: 2 } }]);
    const rich = startPreview(g, vars, { [vars[0]!.id]: 50 });
    expect(rich.text).toBe('rich');
  });
  it('does not mutate the previous state (supports back/undo)', () => {
    const g = simpleGraph();
    const s0 = startPreview(g, []);
    const snapshot = JSON.stringify(s0);
    advance(g, s0);
    expect(JSON.stringify(s0)).toBe(snapshot);
  });
  it('detects infinite automatic loops', () => {
    const g = new GraphBuilder('t').start('s').set('a', 'gold', 'add', 1).set('b', 'gold', 'add', 1).link('s', 'next', 'a').link('a', 'next', 'b').link('b', 'next', 'a').build();
    const s = startPreview(g, vars);
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/infinite loop/);
    expect(s.steps).toBeLessThanOrEqual(MAX_AUTO_STEPS + 1);
  });
  it('allows loops that wait for the player', () => {
    const g = new GraphBuilder('t').start('s').say('a', 'A', 'again?').link('s', 'next', 'a').link('a', 'next', 'a').build();
    let s: PreviewState = startPreview(g, []);
    for (let i = 0; i < 50; i++) s = advance(g, s);
    expect(s.status).toBe('dialogue');
  });
  it('reports invalid transitions instead of crashing', () => {
    const g = simpleGraph();
    const ghost: EditorGraph = { ...g, edges: g.edges.map((e, i) => (i === 0 ? { ...e, target: 'ghost' } : e)) };
    expect(startPreview(ghost, []).status).toBe('error');
    const unconnected: EditorGraph = { ...g, edges: [] };
    expect(startPreview(unconnected, []).error).toMatch(/Start is not connected/);
    const noStart: EditorGraph = { ...g, nodes: g.nodes.filter((n) => n.type !== 'start') };
    expect(startPreview(noStart, []).error).toMatch(/No Start/);
    const typeErr = new GraphBuilder('t').start('s').cond('c', 'flag', '>', true).end('e', 'x').link('s', 'next', 'c').link('c', 'true', 'e').link('c', 'false', 'e').build();
    expect(startPreview(typeErr, vars).error).toMatch(/Invalid condition/);
    const undef = new GraphBuilder('t').start('s').set('v', 'missing', 'set', 1).end('e', 'x').link('s', 'next', 'v').link('v', 'next', 'e').build();
    expect(startPreview(undef, vars).error).toMatch(/undefined variable/);
  });
  it('uses the speaker override as the displayed name', () => {
    const g = new GraphBuilder('t').start('s').say('d', 'Witch', 'hi', 'neutral', '', 'Lumi').end('e', 'x').link('s', 'next', 'd').link('d', 'next', 'e').build();
    expect(startPreview(g, []).speaker).toBe('Lumi');
  });
});
