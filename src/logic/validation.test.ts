import { describe, expect, it } from 'vitest';
import { validateGraph } from './validation';
import { GraphBuilder } from '../samples/builder';
import { simpleGraph, vdef } from '../test.helpers';
import type { EditorGraph } from '../model/types';

const codes = (g: EditorGraph, vars = [vdef('gold', 'int', 0), vdef('flag', 'bool', false)]) => validateGraph(g, vars).map((i) => i.code);

describe('validateGraph', () => {
  it('accepts a minimal valid graph', () => {
    expect(validateGraph(simpleGraph(), [])).toEqual([]);
  });
  it('reports a missing Start', () => {
    const g = simpleGraph();
    expect(codes({ ...g, nodes: g.nodes.filter((n) => n.type !== 'start'), edges: [] })).toContain('NO_START');
  });
  it('reports multiple Start nodes', () => {
    const g = new GraphBuilder('t').start('a').start('b').end('e', 'x').link('a', 'next', 'e').link('b', 'next', 'e').build();
    expect(codes(g)).toContain('MULTIPLE_START');
  });
  it('requires Start to be connected', () => {
    const g = new GraphBuilder('t').start('s').end('e', 'x').build();
    expect(codes(g)).toContain('START_NO_NEXT');
  });
  it('reports broken connections', () => {
    const g = simpleGraph();
    const broken = { ...g, edges: [...g.edges, { id: 'bad', source: g.nodes[1]!.id, sourceHandle: 'next', target: 'ghost' }] };
    expect(codes(broken)).toContain('BROKEN_EDGE');
    const badHandle = { ...g, edges: g.edges.map((e) => ({ ...e, sourceHandle: 'choice:gone' })) };
    expect(codes(badHandle)).toContain('BROKEN_EDGE');
  });
  it('warns about unreachable nodes', () => {
    const g = new GraphBuilder('t').start('s').say('d', 'A', 'x').end('e', 'x').end('orphan', 'y').link('s', 'next', 'd').link('d', 'next', 'e').build();
    const issues = validateGraph(g, []);
    const u = issues.find((i) => i.code === 'UNREACHABLE');
    expect(u?.severity).toBe('warning');
    expect(u?.nodeId).toBe(g.nodes.find((n) => n.type === 'end' && n.data.endingName === 'y')?.id);
  });
  it('reports missing dialogue text and missing next', () => {
    const g = new GraphBuilder('t').start('s').say('d', 'A', '   ').link('s', 'next', 'd').build();
    expect(codes(g)).toEqual(expect.arrayContaining(['DIALOGUE_EMPTY_TEXT', 'MISSING_NEXT']));
  });
  it('validates choices', () => {
    const g = new GraphBuilder('t').start('s').choice('c', 'ok', '').end('e', 'x').link('s', 'next', 'c').link('c', 0, 'e').build();
    const c = codes(g);
    expect(c).toContain('CHOICE_EMPTY_TEXT');
    expect(c).toContain('CHOICE_NOT_CONNECTED');
  });
  it('validates condition configuration', () => {
    const base = (variable: string, op: '>' | '==', value: number | boolean) =>
      new GraphBuilder('t').start('s').cond('c', variable, op, value).end('a', 'a').end('b', 'b').link('s', 'next', 'c').link('c', 'true', 'a').link('c', 'false', 'b').build();
    expect(codes(base('gold', '>', 1))).toEqual([]);
    expect(codes(base('', '==', 1))).toContain('CONDITION_NO_VARIABLE');
    expect(codes(base('nope', '==', 1))).toContain('CONDITION_UNKNOWN_VARIABLE');
    expect(codes(base('flag', '>', true))).toContain('CONDITION_BAD_OPERATOR');
    expect(codes(base('gold', '==', true))).toContain('CONDITION_VALUE_TYPE');
    const half = new GraphBuilder('t').start('s').cond('c', 'gold', '>', 1).end('a', 'a').link('s', 'next', 'c').link('c', 'true', 'a').build();
    expect(codes(half)).toContain('CONDITION_FALSE_MISSING');
  });
  it('validates variable nodes', () => {
    const g = new GraphBuilder('t').start('s').set('v', 'flag', 'add', true).end('e', 'x').link('s', 'next', 'v').link('v', 'next', 'e').build();
    expect(codes(g)).toContain('VARIABLE_BAD_OPERATION');
  });
  it('requires event parameters from the catalog', () => {
    const g = new GraphBuilder('t').start('s').event('ev', 'OpenShop').end('e', 'x').link('s', 'next', 'ev').link('ev', 'next', 'e').build();
    expect(codes(g)).toContain('EVENT_PARAM_MISSING'); // shopId is empty
    const named = new GraphBuilder('t').start('s').event('ev', 'OpenShop', { shopId: 'main' }).end('e', 'x').link('s', 'next', 'ev').link('ev', 'next', 'e').build();
    expect(codes(named)).toEqual([]);
    const noName = new GraphBuilder('t').start('s').event('ev', '').end('e', 'x').link('s', 'next', 'ev').link('ev', 'next', 'e').build();
    expect(codes(noName)).toContain('EVENT_NO_NAME');
  });
  it('flags duplicate / invalid variable names and loops', () => {
    expect(codes(simpleGraph(), [vdef('a', 'int', 0), vdef('a', 'int', 0), vdef('1x', 'int', 0)])).toEqual(expect.arrayContaining(['VARIABLE_NAME_DUPLICATE', 'VARIABLE_NAME_INVALID']));
    const loop = new GraphBuilder('t').start('s').say('a', 'A', 'x').link('s', 'next', 'a').link('a', 'next', 'a').build();
    expect(codes(loop)).toEqual(expect.arrayContaining(['CYCLE', 'NO_END_REACHABLE']));
  });
});
